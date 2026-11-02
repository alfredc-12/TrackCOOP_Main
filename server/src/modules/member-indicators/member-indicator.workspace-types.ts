import type {
  IndicatorLabelThresholds,
  IndicatorThresholds,
} from "./member-indicator.scoring";

export type RfmClassification = "Active" | "Needs Monitoring" | "Inactive";
export type RfmQuality =
  | "Current"
  | "Potentially Outdated"
  | "Historical"
  | "Missing"
  | "Incompatible Version"
  | "Requires Review";
export type RfmFilters = {
  page: number;
  pageSize: number;
  search?: string;
  classification?: RfmClassification | "Not Yet Scored";
  context: "current" | "historical" | "run";
  basisEnd?: string;
  runId?: string;
  membershipType?: "Associate" | "True Member";
  officialStatus?: "Active" | "Inactive";
  barangay?: string;
  sector?: string;
  version?: string;
  quality?: RfmQuality;
  minScore?: number;
  maxScore?: number;
  recencyScore?: number;
  frequencyScore?: number;
  contributionScore?: number;
  minRecency?: number;
  maxRecency?: number;
  minFrequency?: number;
  maxFrequency?: number;
  minContribution?: number;
  maxContribution?: number;
  sortBy:
    | "fullName"
    | "totalScore"
    | "recencyScore"
    | "frequencyScore"
    | "contributionScore"
    | "computedAt"
    | "recencyDays"
    | "frequencyCount"
    | "validatedShareCapital";
  sortDirection: "asc" | "desc";
};
export type RfmSettings = {
  formulaVersion: string;
  configurationFingerprint: string;
  thresholds: IndicatorThresholds;
  labels: IndicatorLabelThresholds;
  qualifyingParticipationStatuses: string[];
};
export type ParticipationEvidence = {
  id: string;
  activityId: string;
  activity: string;
  date: string;
  status: string;
  qualifies: boolean;
  inFrequencyWindow: boolean;
  reason: string;
};
export type ContributionEvidence = {
  id: string;
  date: string;
  amount: number;
  status: string;
  qualifies: boolean;
  reason: string;
};
export type RfmEvidence = {
  participation: ParticipationEvidence[];
  contributions: ContributionEvidence[];
  lastParticipation: string | null;
  qualifyingAllTimeThroughBasis: number;
  frequencyInPeriod: number;
  validatedPaymentCount: number;
  sourceFreshness: "Not independently verified";
};
export type RfmSnapshotMetadata = {
  formulaVersion: string;
  configurationFingerprint: string;
  configuration: RfmSettings;
  runId: string;
  advisoryOnly: true;
  officialStatusUnchanged: true;
  evidence: RfmEvidence;
  basisPeriod: { start: string; end: string };
  rawMetrics: {
    recencyDays: number | null;
    frequencyCount: number;
    contributionAmount: number;
    sourceCounts: {
      qualifyingParticipation: number;
      validatedShareCapitalPayments: number;
    };
  };
  scoring: {
    method: "configured-thresholds";
    recencyScore: number;
    frequencyScore: number;
    contributionScore: number;
    totalScore: number;
    label: RfmClassification;
    explanation: string;
    safeguardApplied: boolean;
  };
};
export type RfmMemberRow = {
  memberId: string;
  memberCode: string;
  fullName: string;
  membershipType: string;
  officialMemberStatus: string;
  barangay: string | null;
  sector: string | null;
  indicatorId: string | null;
  basisStart: string | null;
  basisEnd: string | null;
  recencyDays: number | null;
  frequencyCount: number | null;
  validatedShareCapital: number | null;
  recencyScore: number | null;
  frequencyScore: number | null;
  contributionScore: number | null;
  totalScore: number | null;
  classification: RfmClassification | null;
  scoringVersion: string | null;
  computedAt: string | null;
  computedBy: string | null;
  configurationFingerprint: string | null;
  evidenceAvailable: boolean;
  participationEvidenceCount?: number | null;
  paymentEvidenceCount?: number | null;
  lastParticipation: string | null;
  quality: RfmQuality;
  calculationAgeDays: number | null;
  basisAgeDays: number | null;
  lowestComponents: string[];
};
export type RfmComponent =
  | "recencyScore"
  | "frequencyScore"
  | "contributionScore";
export type RfmComponentDiagnostic = {
  component: RfmComponent;
  average: number | null;
  median: number | null;
  distribution: { score: number; count: number; percentage: number | null }[];
  lowPercentage: number | null;
  highPercentage: number | null;
};
export type RfmSummary = {
  eligible: number;
  scored: number;
  notScored: number;
  active: number;
  needsMonitoring: number;
  inactive: number;
  coverage: number | null;
  average: number | null;
  median: number | null;
  latestCalculation: string | null;
  basisPeriods: { start: string | null; end: string | null; count: number }[];
  versions: { version: string; count: number }[];
  byType: {
    type: string;
    eligible: number;
    scored: number;
    coverage: number | null;
  }[];
  quality: { status: RfmQuality; count: number }[];
};
export type RfmWorkspace = {
  rows: RfmMemberRow[];
  total: number;
  page: number;
  pageSize: number;
  filters: RfmFilters;
  summary: RfmSummary;
  components: RfmComponentDiagnostic[];
  matrix: {
    recency: number;
    frequency: number;
    count: number;
    percentage: number | null;
    contributions: number[];
  }[];
  options: {
    barangays: string[];
    sectors: string[];
    versions: string[];
    bases: string[];
  };
  settings: RfmSettings;
  generatedAt: string;
};
export type RfmHistory = {
  rows: RfmMemberRow[];
  total: number;
  page: number;
  pageSize: number;
};
export type RfmRun = {
  id: string;
  basisStart: string | null;
  basisEnd: string | null;
  computedAt: string;
  version: string;
  count: number;
  legacy: boolean;
};
export type RfmRecalculationInput = {
  memberId?: string;
  basisPeriodEnd: string;
  basisPeriodStart?: string | null;
};
export type RfmPreview = {
  basis: { start: string; end: string };
  settings: RfmSettings;
  affected: number;
  newlyScored: number;
  changed: number;
  unchanged: number;
  missingParticipation: number;
  zeroContributions: number;
  previewFingerprint: string;
  generatedAt: string;
};
export type RfmRecalculationResult = RfmPreview & {
  runId: string;
  saved: number;
  skippedIdentical: number;
  computedAt: string;
};
