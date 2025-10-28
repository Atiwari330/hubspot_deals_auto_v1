import 'dotenv/config';
import { fetchPipelines, searchDealsByStages, findStageIdsByLabels, fetchOwners } from './hubspot';

async function main() {
  console.log('🚀 Starting HubSpot Deals Fetcher (All Properties)...\n');

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

    console.log('💼 Fetching owner information...\n');

    // Collect all unique owner IDs
    const ownerIds = result.results
      .map(deal => deal.properties.hubspot_owner_id)
      .filter(id => id);

    // Fetch all owners
    const ownersMap = await fetchOwners(accessToken, ownerIds);

    console.log('━'.repeat(80));
    console.log(`\n✅ Found ${result.total} deal(s) in "Proposal" and "Demo - Completed" stages:\n`);
    console.log('━'.repeat(80));

    if (result.results.length > 0) {
      result.results.forEach((deal, index) => {
        const props = deal.properties;
        const owner = props.hubspot_owner_id ? ownersMap.get(props.hubspot_owner_id) : null;

        console.log(`\n${index + 1}. ${props.dealname || 'Unnamed Deal'}`);
        console.log('   ' + '─'.repeat(60));

        // Basic Information
        console.log(`   📌 ID: ${deal.id}`);
        console.log(`   📊 Pipeline: ${props.pipeline || 'N/A'}`);
        console.log(`   🎯 Stage: ${props.dealstage || 'N/A'}`);

        // Owner Information
        if (owner) {
          console.log(`   👤 Owner: ${owner.firstName} ${owner.lastName} (${owner.email})`);
        } else if (props.hubspot_owner_id) {
          console.log(`   👤 Owner ID: ${props.hubspot_owner_id}`);
        }

        // Financial Details
        console.log(`   💰 Amount: $${props.amount || 'N/A'}`);
        if (props.amount_in_home_currency) {
          console.log(`   💵 Amount (Home Currency): $${props.amount_in_home_currency}`);
        }
        if (props.hs_tcv) console.log(`   📈 TCV: $${props.hs_tcv}`);
        if (props.hs_arr) console.log(`   📈 ARR: $${props.hs_arr}`);
        if (props.hs_mrr) console.log(`   📈 MRR: $${props.hs_mrr}`);
        if (props.hs_acv) console.log(`   📈 ACV: $${props.hs_acv}`);

        // Date Information
        console.log(`   📅 Created: ${props.createdate ? new Date(props.createdate).toLocaleDateString() : 'N/A'}`);
        console.log(`   📅 Close Date: ${props.closedate ? new Date(props.closedate).toLocaleDateString() : 'N/A'}`);
        if (props.hs_lastmodifieddate) {
          console.log(`   📅 Last Modified: ${new Date(props.hs_lastmodifieddate).toLocaleDateString()}`);
        }

        // Deal Type & Priority
        if (props.dealtype) console.log(`   🏷️  Deal Type: ${props.dealtype}`);
        if (props.hs_priority) console.log(`   ⚡ Priority: ${props.hs_priority}`);
        if (props.hs_deal_stage_probability) {
          console.log(`   🎲 Probability: ${props.hs_deal_stage_probability}%`);
        }

        // Description
        if (props.description) {
          const desc = props.description.length > 100
            ? props.description.substring(0, 100) + '...'
            : props.description;
          console.log(`   📝 Description: ${desc}`);
        }

        // Source & Campaign
        if (props.hs_analytics_source) {
          console.log(`   🔍 Source: ${props.hs_analytics_source}`);
        }
        if (props.hs_campaign) {
          console.log(`   📢 Campaign: ${props.hs_campaign}`);
        }

        // Engagement Metrics
        if (props.num_notes) console.log(`   💬 Notes: ${props.num_notes}`);
        if (props.num_contacted_notes) console.log(`   📞 Contacts: ${props.num_contacted_notes}`);

        // Forecast
        if (props.hs_forecast_amount) {
          console.log(`   🔮 Forecast Amount: $${props.hs_forecast_amount}`);
        }
        if (props.hs_manual_forecast_category) {
          console.log(`   🔮 Forecast Category: ${props.hs_manual_forecast_category}`);
        }

        // Show ALL other properties that have values
        const displayedProps = [
          'dealname', 'pipeline', 'dealstage', 'hubspot_owner_id', 'amount',
          'amount_in_home_currency', 'hs_tcv', 'hs_arr', 'hs_mrr', 'hs_acv',
          'createdate', 'closedate', 'hs_lastmodifieddate', 'dealtype', 'hs_priority',
          'hs_deal_stage_probability', 'description', 'hs_analytics_source', 'hs_campaign',
          'num_notes', 'num_contacted_notes', 'hs_forecast_amount', 'hs_manual_forecast_category'
        ];

        const otherProps = Object.entries(props)
          .filter(([key, value]) => !displayedProps.includes(key) && value != null && value !== '')
          .sort(([a], [b]) => a.localeCompare(b));

        if (otherProps.length > 0) {
          console.log(`   📋 Other Properties:`);
          otherProps.forEach(([key, value]) => {
            const displayValue = typeof value === 'string' && value.length > 50
              ? value.substring(0, 50) + '...'
              : value;
            console.log(`      • ${key}: ${displayValue}`);
          });
        }
      });
    } else {
      console.log('\n   No deals found in these stages.');
    }

    console.log('\n' + '━'.repeat(80));
    console.log(`\n📊 Summary: ${result.total} total deal(s) retrieved`);
    console.log(`👥 Owners: ${ownersMap.size} unique owner(s)`);
    console.log('\n✨ Done!\n');
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
