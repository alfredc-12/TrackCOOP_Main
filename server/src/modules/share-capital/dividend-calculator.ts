export type DividendCalculationMember = {
  memberId: string;
  memberCode: string;
  memberName: string;
  membershipType: "Associate" | "True Member";
  shareCapitalBalance: number;
};

export type CalculatedDividendAllocation = DividendCalculationMember & {
  dividendAmount: number;
};

export type MonthlyShareCapitalMember = Omit<DividendCalculationMember, "shareCapitalBalance"> & {
  monthlyShareCapital: number[];
};

export type ShareCapitalLedgerEntry = {
  transactionId: string;
  transactionDate: string;
  direction: "Credit" | "Debit";
  amount: number;
};

export type CalculatedInterestAllocation = Omit<MonthlyShareCapitalMember, "monthlyShareCapital"> & {
  totalShareMonths: number;
  averageShareMonth: number;
  dividendAmount: number;
};

export type InterestOnShareCapitalCalculation = {
  distributableSurplus: number;
  interestAllocationAmount: number;
  totalAverageShareMonth: number;
  ratePerPeso: number;
  interestRate: number;
  allocations: CalculatedInterestAllocation[];
};

function monthKey(value: string) {
  return `${value.slice(0, 7)}-01`;
}

function shiftMonth(value: string, offset: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 10);
}

function listMonths(start: string, end: string) {
  const months: string[] = [];
  let cursor = monthKey(start);
  const last = monthKey(end);
  while (cursor <= last) {
    months.push(cursor);
    cursor = shiftMonth(cursor, 1);
  }
  return months;
}

export function calculateMonthlyShareCapitalBalances(
  transactions: ShareCapitalLedgerEntry[],
  coverageStart: string,
  coverageEnd: string,
) {
  const months = listMonths(coverageStart, coverageEnd);
  if (!months.length) return [];
  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  const changes = new Map<string, number>();
  let openingBalance = 0;

  for (const transaction of [...transactions].sort((left, right) => {
    const dateOrder = left.transactionDate.localeCompare(right.transactionDate);
    return dateOrder || left.transactionId.localeCompare(right.transactionId, undefined, { numeric: true });
  })) {
    const amount = Math.max(0, Number(transaction.amount) || 0);
    const delta = transaction.direction === "Debit" ? -amount : amount;
    const day = Number(transaction.transactionDate.slice(8, 10));
    const effectiveMonth = day <= 7
      ? monthKey(transaction.transactionDate)
      : shiftMonth(monthKey(transaction.transactionDate), 1);
    if (effectiveMonth < firstMonth) {
      openingBalance += delta;
    } else if (effectiveMonth <= lastMonth) {
      changes.set(effectiveMonth, (changes.get(effectiveMonth) ?? 0) + delta);
    }
  }

  let balance = Math.max(0, openingBalance);
  return months.map((month) => {
    balance = Math.max(0, balance + (changes.get(month) ?? 0));
    return cents(balance);
  });
}

function cents(value: number) {
  return Number(value.toFixed(2));
}

export function calculateDividendAllocations(
  members: DividendCalculationMember[],
  dividendRate: number,
): CalculatedDividendAllocation[] {
  const rate = Number(dividendRate);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100) {
    throw new Error("Dividend rate must be greater than 0 and no more than 100 percent.");
  }

  return members
    .map((member) => ({
      ...member,
      shareCapitalBalance: Math.max(0, Number(member.shareCapitalBalance) || 0),
    }))
    .filter((member) => member.shareCapitalBalance > 0)
    .map((member) => ({
      ...member,
      dividendAmount: cents(member.shareCapitalBalance * rate / 100),
    }));
}

export function calculateDividendPool(allocations: CalculatedDividendAllocation[]) {
  return cents(allocations.reduce((total, allocation) => total + allocation.dividendAmount, 0));
}

function validateNonNegative(value: number, label: string) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new Error(`${label} must be zero or greater.`);
  }
  return normalized;
}

function adjustRoundedAllocations(
  allocations: Array<{ dividendAmount: number; rawAmount: number }>,
  targetAmount: number,
) {
  let remainingCents = Math.round((targetAmount - allocations.reduce((total, allocation) => total + allocation.dividendAmount, 0)) * 100);
  if (!remainingCents || !allocations.length) return;

  const order = allocations
    .map((allocation, index) => ({ index, remainder: allocation.rawAmount - allocation.dividendAmount }))
    .sort((left, right) => right.remainder - left.remainder)
    .map((item) => item.index);
  let cursor = 0;
  while (remainingCents !== 0 && cursor < order.length * 2) {
    const index = order[cursor % order.length];
    if (remainingCents > 0) {
      allocations[index].dividendAmount = cents(allocations[index].dividendAmount + 0.01);
      remainingCents -= 1;
    } else if (allocations[index].dividendAmount >= 0.01) {
      allocations[index].dividendAmount = cents(allocations[index].dividendAmount - 0.01);
      remainingCents += 1;
    }
    cursor += 1;
  }
}

export function calculateInterestOnShareCapital(
  members: MonthlyShareCapitalMember[],
  netSurplus: number,
  statutoryReserves: number,
  interestAllocationRate: number,
): InterestOnShareCapitalCalculation {
  const normalizedNetSurplus = validateNonNegative(netSurplus, "Net surplus");
  const normalizedStatutoryReserves = validateNonNegative(statutoryReserves, "Statutory reserves");
  const normalizedAllocationRate = Number(interestAllocationRate);
  if (!Number.isFinite(normalizedAllocationRate) || normalizedAllocationRate < 0 || normalizedAllocationRate > 70) {
    throw new Error("Interest allocation rate must be between 0 and 70 percent so at least 30 percent remains for patronage refund.");
  }
  if (normalizedStatutoryReserves > normalizedNetSurplus) {
    throw new Error("Statutory reserves cannot exceed net surplus.");
  }

  const distributableSurplus = cents(normalizedNetSurplus - normalizedStatutoryReserves);
  const interestAllocationAmount = cents(distributableSurplus * normalizedAllocationRate / 100);
  const normalizedMembers = members
    .map((member) => {
      const monthlyShareCapital = member.monthlyShareCapital.map((value) => Math.max(0, Number(value) || 0));
      const totalShareMonths = cents(monthlyShareCapital.reduce((total, value) => total + value, 0));
      const averageShareMonth = monthlyShareCapital.length ? cents(totalShareMonths / monthlyShareCapital.length) : 0;
      return { ...member, monthlyShareCapital, totalShareMonths, averageShareMonth };
    })
    .filter((member) => member.averageShareMonth > 0);
  const totalAverageShareMonth = cents(normalizedMembers.reduce((total, member) => total + member.averageShareMonth, 0));
  const ratePerPeso = totalAverageShareMonth > 0
    ? Number((interestAllocationAmount / totalAverageShareMonth).toFixed(7))
    : 0;
  const allocations = normalizedMembers.map((member) => ({
    memberId: member.memberId,
    memberCode: member.memberCode,
    memberName: member.memberName,
    membershipType: member.membershipType,
    totalShareMonths: member.totalShareMonths,
    averageShareMonth: member.averageShareMonth,
    dividendAmount: cents(member.averageShareMonth * ratePerPeso),
    rawAmount: member.averageShareMonth * ratePerPeso,
  }));
  adjustRoundedAllocations(allocations, interestAllocationAmount);

  return {
    distributableSurplus,
    interestAllocationAmount,
    totalAverageShareMonth,
    ratePerPeso,
    interestRate: ratePerPeso,
    allocations: allocations.map((allocation) => ({
      memberId: allocation.memberId,
      memberCode: allocation.memberCode,
      memberName: allocation.memberName,
      membershipType: allocation.membershipType,
      totalShareMonths: allocation.totalShareMonths,
      averageShareMonth: allocation.averageShareMonth,
      dividendAmount: allocation.dividendAmount,
    })),
  };
}
