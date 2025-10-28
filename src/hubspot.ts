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
  properties: {
    dealname?: string;
    dealstage?: string;
    pipeline?: string;
    amount?: string;
    closedate?: string;
    hubspot_owner_id?: string;
    hs_object_id?: string;
    createdate?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SearchDealsResponse {
  results: Deal[];
  total: number;
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
      'dealname',
      'dealstage',
      'pipeline',
      'amount',
      'closedate',
      'hubspot_owner_id',
      'hs_object_id',
      'createdate',
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
