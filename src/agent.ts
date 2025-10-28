import { generateText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import {
  fetchPipelines,
  searchDealsByStages,
  findStageIdsByLabels,
} from './hubspot';

const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN!;

if (!HUBSPOT_ACCESS_TOKEN) {
  throw new Error('HUBSPOT_ACCESS_TOKEN environment variable is required');
}

/**
 * Tool for searching HubSpot deals by stage names
 */
export const searchDealsTool = tool({
  description: `Search for deals in HubSpot by their stage names. This tool will fetch all available pipelines and stages, find stage IDs that match the provided stage names (case-insensitive partial match), and return all deals in those stages.`,

  parameters: z.object({
    stageNames: z.array(z.string()).describe('Array of deal stage names to search for (e.g., ["proposal", "demo completed"])'),
  }),

  execute: async ({ stageNames }) => {
    try {
      const pipelines = await fetchPipelines(HUBSPOT_ACCESS_TOKEN);
      const stageIds = findStageIdsByLabels(pipelines, stageNames);

      if (stageIds.length === 0) {
        return {
          success: false,
          error: `No stages found matching: ${stageNames.join(', ')}`,
          availableStages: pipelines.flatMap(p =>
            p.stages.map(s => ({ pipeline: p.label, stage: s.label }))
          ).slice(0, 20),
        };
      }

      const result = await searchDealsByStages(HUBSPOT_ACCESS_TOKEN, stageIds);

      return {
        success: true,
        total: result.total,
        stagesFound: stageIds.length,
        deals: result.results.map(deal => ({
          id: deal.id,
          name: deal.properties.dealname || 'Unnamed Deal',
          stage: deal.properties.dealstage,
          amount: deal.properties.amount || 'N/A',
          closeDate: deal.properties.closedate || 'N/A',
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Generates text response using the HubSpot deals tool
 */
export async function queryHubSpotDeals(prompt: string) {
  return await generateText({
    model: openai('gpt-4o'),
    system: `You are a HubSpot CRM assistant specialized in helping users find and analyze deals.

Your capabilities:
- Search for deals by their stage names (e.g., "proposal", "demo completed", "closed won")
- Provide deal information including name, amount, close date, and current stage
- Help users understand their deal pipeline

When searching for deals:
1. Use the searchDeals tool with the stage names the user mentions
2. Present the results in a clear, organized format
3. Include relevant details like deal name, amount, and close date

Be helpful, concise, and accurate. If a stage name doesn't match exactly, the tool will search for partial matches.`,

    prompt,

    tools: {
      searchDeals: searchDealsTool,
    },

    maxSteps: 5,
  });
}
