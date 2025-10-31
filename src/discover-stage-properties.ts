import 'dotenv/config';
import { fetchPipelines } from './hubspot.js';

async function discoverStageProperties() {
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;

  if (!accessToken) {
    console.error('❌ Error: HUBSPOT_ACCESS_TOKEN environment variable is required');
    process.exit(1);
  }

  console.log('🔍 Discovering stage properties...\n');

  // Fetch all pipelines
  const pipelines = await fetchPipelines(accessToken);

  console.log(`📊 Found ${pipelines.length} pipeline(s):\n`);

  for (const pipeline of pipelines) {
    console.log(`Pipeline: "${pipeline.label}" (ID: ${pipeline.id})`);
    console.log(`  Stages (${pipeline.stages.length}):`);

    for (const stage of pipeline.stages) {
      console.log(`    ${stage.displayOrder}. "${stage.label}"`);
      console.log(`       ID: ${stage.id}`);
      console.log(`       Probability: ${stage.metadata.probability}`);
      console.log(`       Expected properties:`);
      console.log(`         - hs_date_entered_${stage.id}`);
      console.log(`         - hs_v2_date_entered_${stage.id}`);
      console.log(`         - hs_date_exited_${stage.id}`);
      console.log(`         - hs_v2_date_exited_${stage.id}`);
      console.log('');
    }
    console.log('━'.repeat(80) + '\n');
  }

  // Find Sales pipeline specifically
  const salesPipeline = pipelines.find(p =>
    p.label.toLowerCase().includes('sales')
  );

  if (salesPipeline) {
    console.log('🎯 SALES PIPELINE DETAILS:\n');
    console.log(`Pipeline ID: ${salesPipeline.id}`);
    console.log(`Pipeline Label: "${salesPipeline.label}"`);
    console.log(`\nStages for Stage Aging Analysis:`);

    const targetStageLabels = ['sql', 'demo', 'proposal', 'verbal'];

    for (const label of targetStageLabels) {
      const matchingStages = salesPipeline.stages.filter(s =>
        s.label.toLowerCase().includes(label)
      );

      if (matchingStages.length > 0) {
        console.log(`\n  "${label.toUpperCase()}" matches:`);
        matchingStages.forEach(stage => {
          console.log(`    - "${stage.label}" (ID: ${stage.id})`);
          console.log(`      Properties to try:`);
          console.log(`        1. hs_v2_date_entered_${stage.id} (preferred)`);
          console.log(`        2. hs_date_entered_${stage.id} (fallback)`);
        });
      } else {
        console.log(`\n  ⚠️  No stages found matching "${label}"`);
      }
    }
  } else {
    console.log('⚠️  No pipeline found with "sales" in the name');
    console.log('Available pipelines:');
    pipelines.forEach(p => console.log(`  - "${p.label}" (ID: ${p.id})`));
  }

  console.log('\n' + '━'.repeat(80));
  console.log('✅ Discovery complete!');
}

discoverStageProperties().catch(error => {
  console.error('❌ Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
