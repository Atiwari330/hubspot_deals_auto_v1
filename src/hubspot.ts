const HUBSPOT_API_BASE = 'https://api.hubapi.com';

export interface DealStage {
  id: string;
  label: string;
  displayOrder: number;
  metadata: {
    probability: string;
  };
}

export interface Pipeline {
  id: string;
  label: string;
  displayOrder: number;
  stages: DealStage[];
}

export interface Deal {
  id: string;
  properties: Record<string, any>; // Allow any properties
  createdAt: string;
  updatedAt: string;
}

export interface SearchDealsResponse {
  results: Deal[];
  total: number;
}

export interface Owner {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * Fetches all deal pipelines and their stages from HubSpot
 */
export async function fetchPipelines(accessToken: string): Promise<Pipeline[]> {
  const response = await fetch(`${HUBSPOT_API_BASE}/crm/v3/pipelines/deals`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch pipelines: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.results || [];
}

/**
 * Searches for deals by stage IDs
 */
export async function searchDealsByStages(
  accessToken: string,
  stageIds: string[],
  pipeline?: string
): Promise<SearchDealsResponse> {
  const filters: any[] = [];

  if (stageIds.length > 0) {
    filters.push({
      propertyName: 'dealstage',
      operator: stageIds.length === 1 ? 'EQ' : 'IN',
      ...(stageIds.length === 1 ? { value: stageIds[0] } : { values: stageIds }),
    });
  }

  if (pipeline) {
    filters.push({
      propertyName: 'pipeline',
      operator: 'EQ',
      value: pipeline,
    });
  }

  const searchBody = {
    filterGroups: filters.length > 0 ? [{ filters }] : [],
    properties: [
      // Basic Info
      'dealname',
      'dealstage',
      'pipeline',
      'hs_object_id',

      // Financial
      'amount',
      'amount_in_home_currency',
      'hs_tcv',
      'hs_arr',
      'hs_mrr',
      'hs_acv',

      // Dates
      'createdate',
      'closedate',
      'hs_lastmodifieddate',
      'hs_lastactivitydate',
      'hs_date_entered_appointmentscheduled',
      'hs_date_exited_appointmentscheduled',
      'hs_date_entered_qualifiedtobuy',
      'hs_date_exited_qualifiedtobuy',
      'hs_date_entered_presentationscheduled',
      'hs_date_exited_presentationscheduled',
      'hs_date_entered_closedwon',
      'hs_date_entered_closedlost',

      // Owner & Team
      'hubspot_owner_id',
      'hubspot_team_id',

      // Deal Details
      'dealtype',
      'description',
      'hs_priority',
      'hs_next_step',
      'hs_deal_stage_probability',
      'hs_forecast_amount',
      'hs_forecast_probability',
      'hs_manual_forecast_category',

      // Source & Campaign
      'hs_analytics_source',
      'hs_analytics_source_data_1',
      'hs_analytics_source_data_2',
      'hs_campaign',

      // Engagement
      'notes_last_contacted',
      'notes_last_updated',
      'notes_next_activity_date',
      'num_contacted_notes',
      'num_notes',

      // Custom fields (common ones)
      'hs_closed_amount',
      'hs_closed_amount_in_home_currency',
      'hs_deal_amount_calculation_preference',
      'hs_is_closed',
      'hs_is_closed_won',
      'hs_projected_amount',
      'hs_projected_amount_in_home_currency',

      // Additional metadata
      'hs_created_by_user_id',
      'hs_updated_by_user_id',
      'hs_all_owner_ids',
      'hs_all_team_ids',
      'hs_all_accessible_team_ids',

      // Custom properties for Deal Hygiene
      'hs_next_meeting_start_time',  // Next Meeting Start Time
      'product_s',                     // Product/s
      'prior_ehr',                     // Prior EHR
      'hs_all_collaborator_owner_ids', // Deal Collaborator
      'proposal_stage',                // Deal Substage
    ],
    limit: 100,
  };

  const response = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/deals/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(searchBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to search deals: ${response.status} ${error}`);
  }

  const data = await response.json();
  return {
    results: data.results || [],
    total: data.total || 0,
  };
}

/**
 * Finds stage IDs by their labels (case-insensitive partial match)
 */
export function findStageIdsByLabels(
  pipelines: Pipeline[],
  stageLabels: string[]
): string[] {
  const stageIds: string[] = [];
  const normalizedLabels = stageLabels.map(l => l.toLowerCase().trim());

  for (const pipeline of pipelines) {
    for (const stage of pipeline.stages) {
      const normalizedStageLabel = stage.label.toLowerCase().trim();

      // Check if any of the search labels match (case-insensitive, partial match)
      if (normalizedLabels.some(label => normalizedStageLabel.includes(label))) {
        stageIds.push(stage.id);
      }
    }
  }

  return stageIds;
}

/**
 * Fetches owner details by owner ID
 */
export async function fetchOwner(accessToken: string, ownerId: string): Promise<Owner | null> {
  if (!ownerId) return null;

  try {
    const response = await fetch(`${HUBSPOT_API_BASE}/crm/v3/owners/${ownerId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null; // Return null if owner not found
    }

    const data = await response.json();
    return {
      id: data.id,
      email: data.email,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
    };
  } catch (error) {
    return null;
  }
}

/**
 * Fetches multiple owners in batch
 */
export async function fetchOwners(
  accessToken: string,
  ownerIds: string[]
): Promise<Map<string, Owner>> {
  const ownerMap = new Map<string, Owner>();
  const uniqueOwnerIds = [...new Set(ownerIds.filter(id => id))];

  // Fetch owners in parallel
  const ownerPromises = uniqueOwnerIds.map(ownerId =>
    fetchOwner(accessToken, ownerId)
  );

  const owners = await Promise.all(ownerPromises);

  owners.forEach((owner, index) => {
    if (owner) {
      ownerMap.set(uniqueOwnerIds[index], owner);
    }
  });

  return ownerMap;
}
