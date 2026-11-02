/**
 * Rental expense entries store the whole form as JSON in `financial_records.remarks`. This turns that text
 * back into something readable without trusting it: every field is optional and treated as a string. The
 * values describe what the bookkeeper typed. They are not proof that the payment was made.
 */
export type RentalExpenseEntry = {
  payee: string | null;
  paymentMethod: string | null;
  referenceNumber: string | null;
  receiptFileName: string | null;
  equipmentName: string | null;
};

export type ExpenseDescription = {
  description: string;
  rental: RentalExpenseEntry | null;
};

function text(value: unknown, max = 240) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

export function describeExpense(remarks: string | null, sourceModule: string, fallback: string): ExpenseDescription {
  const raw = (remarks ?? "").trim();
  if (sourceModule === "Rental" && raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const rental: RentalExpenseEntry = {
        payee: text(parsed.payee),
        paymentMethod: text(parsed.paymentMethod),
        referenceNumber: text(parsed.referenceNumber),
        receiptFileName: text(parsed.receiptFileName),
        equipmentName: text(parsed.equipmentName),
      };
      const description = text(parsed.description, 500) ?? text(parsed.remarks, 500) ?? text(parsed.category) ?? fallback;
      return { description, rental };
    } catch {
      // Not valid JSON after all: show the text as written.
    }
  }
  return { description: raw ? raw.replace(/\s+/g, " ").slice(0, 500) : fallback, rental: null };
}
