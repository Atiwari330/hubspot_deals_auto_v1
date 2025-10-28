import 'dotenv/config';
import { fetchPipelines, searchDealsByStages, findStageIdsByLabels, fetchOwners } from './hubspot';
import {
  REQUIRED_PROPERTIES,
  isPropertyMissing,
  DealHygieneReport,
  HygieneSummary,
  PropertyCheck,
} from './types';

/**
 * Analyzes a single deal for missing required properties
 */
function analyzeDeal(
  deal: any,
  stageMap: Map<string, string>,
  pipelineMap: Map<string, string>,
  ownersMap: Map<string, any>
): DealHygieneReport {
  const props = deal.properties;
  const propertyChecks: PropertyCheck[] = [];
  const missingProperties: PropertyCheck[] = [];

  // Check each required property
  for (const reqProp of REQUIRED_PROPERTIES) {
    const value = props[reqProp.propertyName];
    const isMissing = isPropertyMissing(reqProp.propertyName, value);

    const check: PropertyCheck = {
      label: reqProp.label,
      propertyName: reqProp.propertyName,
      value: value,
      isMissing: isMissing,
    };

    propertyChecks.push(check);

    if (isMissing) {
      missingProperties.push(check);
    }
  }

  // Calculate completeness score
  const totalRequired = REQUIRED_PROPERTIES.length;
  const totalPresent = totalRequired - missingProperties.length;
  const completenessScore = Math.round((totalPresent / totalRequired) * 100);

  // Get readable names
  const dealStageName = props.dealstage ? (stageMap.get(props.dealstage) || props.dealstage) : 'N/A';
  const dealPipelineName = props.pipeline ? (pipelineMap.get(props.pipeline) || props.pipeline) : 'N/A';
  const owner = props.hubspot_owner_id ? ownersMap.get(props.hubspot_owner_id) : null;
  const dealOwnerName = owner ? `${owner.firstName} ${owner.lastName}` : null;

  return {
    dealId: deal.id,
    dealName: props.dealname || 'Unnamed Deal',
    dealStage: props.dealstage || 'N/A',
    dealStageName: dealStageName,
    dealPipeline: props.pipeline || 'N/A',
    dealPipelineName: dealPipelineName,
    dealOwner: props.hubspot_owner_id || null,
    dealOwnerName: dealOwnerName,
    propertyChecks: propertyChecks,
    missingProperties: missingProperties,
    completenessScore: completenessScore,
    totalRequired: totalRequired,
    totalPresent: totalPresent,
    totalMissing: missingProperties.length,
  };
}

/**
 * Creates a summary report from all deal hygiene reports
 */
function createSummary(reports: DealHygieneReport[]): HygieneSummary {
  // Calculate average completeness
  const totalCompleteness = reports.reduce((sum, report) => sum + report.completenessScore, 0);
  const averageCompleteness = reports.length > 0 ? Math.round(totalCompleteness / reports.length) : 0;

  // Count missing properties across all deals
  const propertyMissingCounts = new Map<string, { label: string; missingCount: number; percentage: number }>();

  for (const reqProp of REQUIRED_PROPERTIES) {
    const missingCount = reports.filter(report =>
      report.missingProperties.some(mp => mp.propertyName === reqProp.propertyName)
    ).length;

    const percentage = reports.length > 0 ? Math.round((missingCount / reports.length) * 100) : 0;

    propertyMissingCounts.set(reqProp.propertyName, {
      label: reqProp.label,
      missingCount: missingCount,
      percentage: percentage,
    });
  }

  // Categorize deals by completeness
  const excellent = reports.filter(r => r.completenessScore >= 90);
  const good = reports.filter(r => r.completenessScore >= 70 && r.completenessScore < 90);
  const poor = reports.filter(r => r.completenessScore < 70);

  // Identify critical deals (missing 3+ properties)
  const criticalDeals = reports.filter(r => r.totalMissing >= 3);

  return {
    totalDeals: reports.length,
    averageCompleteness: averageCompleteness,
    propertyMissingCounts: propertyMissingCounts,
    dealsByCompleteness: {
      excellent: excellent,
      good: good,
      poor: poor,
    },
    criticalDeals: criticalDeals,
  };
}

/**
 * Formats and displays the hygiene report
 */
function displayReport(summary: HygieneSummary) {
  console.log('\n' + '━'.repeat(80));
  console.log('DEAL HYGIENE REPORT');
  console.log('━'.repeat(80));

  console.log(`\n📊 Analyzed: ${summary.totalDeals} deal(s) in "Proposal" and "Demo - Completed" stages`);
  console.log(`📈 Overall Health: ${summary.averageCompleteness}% complete (average)\n`);

  // Critical issues section
  if (summary.criticalDeals.length > 0) {
    console.log('━'.repeat(80));
    console.log(`🚨 CRITICAL ISSUES (${summary.criticalDeals.length} deals missing 3+ required properties):\n`);

    summary.criticalDeals.forEach((deal, index) => {
      console.log(`${index + 1}. Deal: "${deal.dealName}" [ID: ${deal.dealId}]`);
      console.log(`   📊 Pipeline: ${deal.dealPipelineName}`);
      console.log(`   🎯 Stage: ${deal.dealStageName}`);
      if (deal.dealOwnerName) {
        console.log(`   👤 Owner: ${deal.dealOwnerName}`);
      }
      console.log(`   ❌ Missing: ${deal.missingProperties.map(mp => mp.label).join(', ')}`);
      console.log(`   📉 Completeness: ${deal.completenessScore}% (${deal.totalPresent}/${deal.totalRequired} properties)\n`);
    });
  } else {
    console.log('━'.repeat(80));
    console.log('✅ NO CRITICAL ISSUES - No deals are missing 3 or more properties\n');
  }

  // Summary by missing property
  console.log('━'.repeat(80));
  console.log('📋 SUMMARY BY PROPERTY:\n');

  // Sort properties by missing count (most missing first)
  const sortedProperties = Array.from(summary.propertyMissingCounts.entries())
    .sort((a, b) => b[1].missingCount - a[1].missingCount);

  sortedProperties.forEach(([propertyName, data]) => {
    const icon = data.missingCount === 0 ? '✅' : '❌';
    const status = data.missingCount === 0 ? 'Complete' : `${data.missingCount} deals missing`;
    console.log(`   ${icon} ${data.label}: ${status} (${data.percentage}%)`);
  });

  // Deals by completeness
  console.log('\n' + '━'.repeat(80));
  console.log('📊 DEALS BY COMPLETENESS:\n');
  console.log(`   🟢 90-100% Complete: ${summary.dealsByCompleteness.excellent.length} deal(s)`);
  console.log(`   🟡 70-89% Complete: ${summary.dealsByCompleteness.good.length} deal(s)`);
  console.log(`   🔴 Below 70%: ${summary.dealsByCompleteness.poor.length} deal(s)`);

  // Show poor performers in detail
  if (summary.dealsByCompleteness.poor.length > 0) {
    console.log('\n   🔴 Deals Below 70% Completeness:\n');
    summary.dealsByCompleteness.poor.forEach(deal => {
      console.log(`      • "${deal.dealName}" - ${deal.completenessScore}% (Missing: ${deal.missingProperties.map(mp => mp.label).join(', ')})`);
    });
  }

  console.log('\n' + '━'.repeat(80));
  console.log('\n💡 RECOMMENDATIONS:\n');

  // Provide actionable recommendations
  const topMissingProperty = sortedProperties[0];
  if (topMissingProperty && topMissingProperty[1].missingCount > 0) {
    console.log(`   1. Priority: Update "${topMissingProperty[1].label}" - missing from ${topMissingProperty[1].missingCount} deal(s)`);
  }

  if (summary.criticalDeals.length > 0) {
    console.log(`   2. Focus on ${summary.criticalDeals.length} critical deal(s) with 3+ missing properties`);
  }

  if (summary.dealsByCompleteness.poor.length > 0) {
    console.log(`   3. Review ${summary.dealsByCompleteness.poor.length} deal(s) below 70% completeness`);
  }

  console.log('\n✨ Done!\n');
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting HubSpot Deal Hygiene Checker...\n');

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

    // Find stages matching "proposal" and "demo"
    const targetStages = ['proposal', 'demo'];
    const stageIds = findStageIdsByLabels(pipelines, targetStages);

    console.log(`✅ Found ${stageIds.length} matching stage(s)\n`);
    console.log('📋 Fetching deals in these stages...\n');

    // Search for deals in those stages
    const result = await searchDealsByStages(accessToken, stageIds);

    console.log('💼 Fetching owner information...\n');

    // Collect all unique owner IDs
    const ownerIds = result.results
      .map(deal => deal.properties.hubspot_owner_id)
      .filter(id => id);

    // Fetch all owners
    const ownersMap = await fetchOwners(accessToken, ownerIds);

    // Create mappings for stage IDs and pipeline IDs
    const stageMap = new Map<string, string>();
    const pipelineMap = new Map<string, string>();

    for (const pipeline of pipelines) {
      pipelineMap.set(pipeline.id, pipeline.label);
      for (const stage of pipeline.stages) {
        stageMap.set(stage.id, stage.label);
      }
    }

    console.log('🔬 Analyzing deal hygiene...\n');

    // Analyze each deal
    const reports: DealHygieneReport[] = result.results.map(deal =>
      analyzeDeal(deal, stageMap, pipelineMap, ownersMap)
    );

    // Create summary
    const summary = createSummary(reports);

    // Display report
    displayReport(summary);

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
