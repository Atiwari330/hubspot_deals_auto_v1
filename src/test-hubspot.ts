import 'dotenv/config';
import { fetchPipelines, searchDealsByStages, findStageIdsByLabels } from './hubspot';

async function testHubSpot() {
  console.log('🧪 Testing HubSpot API Integration...\n');

  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN!;

  try {
    // 1. Fetch pipelines and stages
    console.log('📊 Fetching pipelines and stages...');
    const pipelines = await fetchPipelines(accessToken);

    console.log(`\n✅ Found ${pipelines.length} pipeline(s):\n`);

    for (const pipeline of pipelines) {
      console.log(`Pipeline: ${pipeline.label} (ID: ${pipeline.id})`);
      console.log('Stages:');
      for (const stage of pipeline.stages) {
        console.log(`  - ${stage.label} (ID: ${stage.id})`);
      }
      console.log('');
    }

    // 2. Find stages matching "proposal" and "demo"
    console.log('🔍 Finding stages matching "proposal" and "demo"...\n');
    const stageIds = findStageIdsByLabels(pipelines, ['proposal', 'demo']);

    console.log(`✅ Found ${stageIds.length} matching stage(s): ${stageIds.join(', ')}\n`);

    // 3. Search for deals in those stages
    if (stageIds.length > 0) {
      console.log('📋 Searching for deals in those stages...\n');
      const result = await searchDealsByStages(accessToken, stageIds);

      console.log(`✅ Found ${result.total} deal(s):\n`);

      if (result.results.length > 0) {
        result.results.forEach((deal, index) => {
          console.log(`Deal ${index + 1}:`);
          console.log(`  Name: ${deal.properties.dealname || 'Unnamed'}`);
          console.log(`  Stage: ${deal.properties.dealstage}`);
          console.log(`  Amount: ${deal.properties.amount || 'N/A'}`);
          console.log(`  Close Date: ${deal.properties.closedate || 'N/A'}`);
          console.log('');
        });
      } else {
        console.log('  No deals found in these stages.');
      }
    }

    console.log('✨ Test completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

testHubSpot();
