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
  criticalDeals: DealHygieneReport[]; // Missing 3+ properties
}

// The 13 required properties as defined by the user
export const REQUIRED_PROPERTIES: RequiredProperty[] = [
  { label: 'Next Meeting Start Time', propertyName: 'hs_next_meeting_start_time' },
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
 *
 * Exception: Amount of 0 is considered valid (not missing)
 */
export function isPropertyMissing(propertyName: string, value: any): boolean {
  // Special case: Amount of 0 is valid
  if (propertyName === 'amount' && value === 0) {
    return false;
  }

  // Check for null, undefined, empty string
  if (value === null || value === undefined || value === '') {
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
