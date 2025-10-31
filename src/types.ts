/**
 * Types for Deal Hygiene Checker
 */

export interface RequiredProperty {
  label: string;          // User-facing label (e.g., "Next Meeting Start Time")
  propertyName: string;   // HubSpot internal name (e.g., "hs_next_meeting_start_time")
}

export interface PropertyCheck {
  label: string;          // User-facing label
  propertyName: string;   // HubSpot internal name
  value: any;             // Actual value from HubSpot
  isMissing: boolean;     // Whether the property is missing/empty
}

export interface DealHygieneReport {
  dealId: string;
  dealName: string;
  dealStage: string;
  dealStageName: string;   // Readable stage name
  dealPipeline: string;
  dealPipelineName: string; // Readable pipeline name
  dealOwner: string | null;
  dealOwnerName: string | null;
  propertyChecks: PropertyCheck[];
  missingProperties: PropertyCheck[];
  completenessScore: number; // Percentage (0-100)
  totalRequired: number;
  totalPresent: number;
  totalMissing: number;
  closeDate: Date | null;  // Parsed close date
  closeDateString: string | null; // Formatted close date for display
  isCloseDatePastDue: boolean; // Whether close date is in the past
}

export interface HygieneSummary {
  totalDeals: number;
  averageCompleteness: number;
  propertyMissingCounts: Map<string, {
    label: string;
    missingCount: number;
    percentage: number;
  }>;
  dealsByCompleteness: {
    excellent: DealHygieneReport[];  // 90-100%
    good: DealHygieneReport[];       // 70-89%
    poor: DealHygieneReport[];       // Below 70%
  };
  dealsWithIssues: DealHygieneReport[]; // Missing 1+ properties
  dealsWithPastDueCloseDates: DealHygieneReport[]; // Close date is in the past
  pastDueCount: number; // Count of deals with past-due close dates
}

/**
 * Types for Quarterly Forecast
 */

export interface QuarterInfo {
  year: number;
  quarter: number;        // 1, 2, 3, or 4
  startDate: Date;
  endDate: Date;
  label: string;          // e.g., "Q4 2025"
}

export interface ForecastDeal {
  dealId: string;
  dealName: string;
  dealStage: string;
  dealStageName: string;
  dealOwner: string | null;
  dealOwnerName: string | null;
  amount: number;         // ARR value
  closeDate: Date;
  closeDateString: string; // Formatted date for display
}

export interface MonthlyForecast {
  month: string;          // e.g., "October 2025"
  monthNumber: number;    // 1-12
  totalARR: number;
  dealCount: number;
  deals: ForecastDeal[];
}

export interface OwnerForecast {
  ownerId: string | null;
  ownerName: string | null;
  totalARR: number;
  dealCount: number;
  deals: ForecastDeal[];
}

export interface ForecastSummary {
  quarter: QuarterInfo;
  totalARR: number;
  totalDeals: number;
  averageDealSize: number;
  monthlyBreakdown: MonthlyForecast[];
  ownerBreakdown: OwnerForecast[];
  allDeals: ForecastDeal[];
  skippedDealsCount: number; // Deals missing close date or amount
}

// The 12 required properties as defined by the user
export const REQUIRED_PROPERTIES: RequiredProperty[] = [
  { label: 'Product/s', propertyName: 'product_s' },
  { label: 'Prior EHR', propertyName: 'prior_ehr' },
  { label: 'Deal Collaborator', propertyName: 'hs_all_collaborator_owner_ids' },
  { label: 'Last Activity Date (EDT)', propertyName: 'notes_last_updated' },
  { label: 'Next Activity Date (EDT)', propertyName: 'notes_next_activity_date' },
  { label: 'Next Step', propertyName: 'hs_next_step' },
  { label: 'Close Date (EDT)', propertyName: 'closedate' },
  { label: 'Deal Name', propertyName: 'dealname' },
  { label: 'Deal Owner', propertyName: 'hubspot_owner_id' },
  { label: 'Deal Stage', propertyName: 'dealstage' },
  { label: 'Deal Substage', propertyName: 'proposal_stage' },
  { label: 'Amount', propertyName: 'amount' },
];

/**
 * Checks if a property value should be considered "missing"
 * A property is missing if it's:
 * - null
 * - undefined
 * - empty string
 * - empty array
 * - zero (for amount field)
 */
export function isPropertyMissing(propertyName: string, value: any): boolean {
  // Check for null, undefined, empty string
  if (value === null || value === undefined || value === '') {
    return true;
  }

  // Check for zero amount (considered missing)
  if (propertyName === 'amount' && value === 0) {
    return true;
  }

  // Check for empty array
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }

  // Check for string that's only whitespace
  if (typeof value === 'string' && value.trim() === '') {
    return true;
  }

  // Property is present
  return false;
}

/**
 * Types for Weekly Pipeline Forecast
 */

export interface WeeklyForecastMetrics {
  weekEnding: Date;          // Sunday end date of the week
  totalPipeline: number;     // Sum of all active deals in SQL + Demo + Proposal
  weightedPipeline: number;  // Probability-adjusted pipeline value
  closedWon: {
    count: number;
    amount: number;
  };
  closedLost: {
    count: number;
    amount: number;
  };
}

export interface StageForecast {
  stageName: string;         // Readable name (SQL, Demo Completed, Proposal)
  dealCount: number;         // Number of deals in this stage
  pipelineAmount: number;    // Total ARR in this stage
  weightedAmount: number;    // pipelineAmount × stageWeight
  stageWeight: number;       // Probability weight (0.30, 0.30, 0.50)
  percentageOfTotal: number; // % of total active pipeline
}

export interface WeeklyForecastReport {
  metrics: WeeklyForecastMetrics;
  stageBreakdown: StageForecast[];
  totalActive: number;       // Same as totalPipeline
  totalWeighted: number;     // Same as weightedPipeline
}

/**
 * Types for Stage Aging Analysis
 */

export interface StageConfig {
  stageId: string;           // Internal HubSpot stage ID
  stageName: string;         // Readable stage name
  thresholdDays: number;     // Days before flagging as stalled
  flagReason: string;        // Message to show when flagged (e.g., "Stalled in SQL")
}

export interface StageAgingDeal {
  dealId: string;
  dealName: string;
  dealStage: string;         // Stage ID
  dealStageName: string;     // Readable stage name
  pipeline: string;          // Pipeline ID
  pipelineName: string;      // Readable pipeline name
  dealOwner: string | null;
  dealOwnerName: string | null;
  amount: number | null;
  closeDate: Date | null;
  closeDateString: string | null;
  dateEnteredStage: Date;    // When deal entered current stage
  dateEnteredStageString: string; // Formatted date for display
  daysInStage: number;       // Days since entering current stage
  lastModifiedDate: Date | null;  // Last time any property changed
  daysSinceModified: number | null; // Days since last modification
  flagReasons: string[];     // Reasons for flagging (aging, no activity, past due)
  thresholdDays: number;     // Stage-specific threshold
  datePropertyUsed: string;  // Which property was used (for debugging)
}

export interface StageBreakdown {
  stageName: string;
  stageId: string;
  thresholdDays: number;
  totalDeals: number;
  flaggedDeals: number;      // Deals exceeding threshold
  averageDaysInStage: number;
  medianDaysInStage: number;
  longestDeal: StageAgingDeal | null;
  flaggedDealsList: StageAgingDeal[];
}

export interface StageAgingSummary {
  totalDeals: number;
  totalFlagged: number;      // Deals with any flag reason
  staleDeals: number;        // Deals exceeding stage threshold
  noActivityDeals: number;   // Deals with no activity in 7+ days
  pastDueDeals: number;      // Deals with close date in past
  stageBreakdowns: StageBreakdown[];
  overallAverageDays: number;
  overallMedianDays: number;
  allDeals: StageAgingDeal[];
}
