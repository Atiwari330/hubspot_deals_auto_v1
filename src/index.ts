import 'dotenv/config';
import { fetchPipelines, searchDealsByStages, findStageIdsByLabels } from './hubspot';

async function main() {
  console.log('🚀 Starting HubSpot Deals Fetcher...\n');

  // Validate environment variables
  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    console.error('❌ Error: HUBSPOT_ACCESS_TOKEN environment variable is required');
    process.exit(1);
  }

  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;

  try {
    console.log('🔍 Fetching pipelines and stages...\n');

    // Fetch all pipelines and stages
    const pipelines = await fetchPipelines(accessToken);

    // Find stages matching "proposal" and "demo" (for "Demo - Completed")
    const targetStages = ['proposal', 'demo'];
    const stageIds = findStageIdsByLabels(pipelines, targetStages);

    console.log(`✅ Found ${stageIds.length} matching stage(s) for "${targetStages.join('" and "')}":\n`);

    // Show which stages were found
    for (const pipeline of pipelines) {
      for (const stage of pipeline.stages) {
        if (stageIds.includes(stage.id)) {
          console.log(`   - ${stage.label} (Pipeline: ${pipeline.label})`);
        }
      }
    }

    console.log('\n📋 Fetching deals in these stages...\n');

    // Search for deals in those stages
    const result = await searchDealsByStages(accessToken, stageIds);

    console.log('━'.repeat(80));
    console.log(`\n✅ Found ${result.total} deal(s) in "Proposal" and "Demo - Completed" stages:\n`);
    console.log('━'.repeat(80));

    if (result.results.length > 0) {
      result.results.forEach((deal, index) => {
        console.log(`\n${index + 1}. ${deal.properties.dealname || 'Unnamed Deal'}`);
        console.log(`   ID: ${deal.id}`);
        console.log(`   Stage ID: ${deal.properties.dealstage}`);
        console.log(`   Amount: $${deal.properties.amount || 'N/A'}`);
        console.log(`   Close Date: ${deal.properties.closedate || 'N/A'}`);
        console.log(`   Created: ${new Date(deal.createdAt).toLocaleDateString()}`);
      });
    } else {
      console.log('\n   No deals found in these stages.');
    }

    console.log('\n' + '━'.repeat(80));
    console.log(`\n📊 Summary: ${result.total} total deal(s) retrieved`);
    console.log('\n✨ Done!\n');
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
