import 'dotenv/config';
import {
  fetchPipelines,
  searchDealsByStages,
  fetchOwners,
  resolveStageDateProperty,
  type Deal,
  type Pipeline,
} from './hubspot.js';
import {
  StageConfig,
  StageAgingDeal,
  StageBreakdown,
  StageAgingSummary,
} from './types.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SALES_PIPELINE_ID = '1c27e5a3-5e5e-4403-ab0f-d356bf268cf3';

const STAGE_CONFIGS: StageConfig[] = [
  {
    stageId: '17915773',
    stageName: 'SQL',
    thresholdDays: 10,
    flagReason: 'Stalled in SQL',
  },
  {
    stageId: '963167283',
    stageName: 'Demo - Completed',
    thresholdDays: 14,
    flagReason: 'Stalled in Demo',
  },
  {
    stageId: '59865091',
    stageName: 'Proposal',
    thresholdDays: 7,
    flagReason: 'Stalled in Proposal',
  },
];

const NO_ACTIVITY_THRESHOLD_DAYS = 7;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculates the number of days between two dates
 */
function calculateDaysBetween(startDate: Date, endDate: Date): number {
  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Formats a date as YYYY-MM-DD
 */
function formatDate(date: Date | null): string {
  if (!date) return 'N/A';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a date as "Month DD, YYYY"
 */
function formatDateLong(date: Date | null): string {
  if (!date) return 'N/A';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Formats currency
 */
function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Analyzes a deal for aging issues
 */
function analyzeDeal(
  deal: Deal,
  stageConfig: StageConfig,
  pipelineName: string,
  ownerMap: Map<string, { firstName: string; lastName: string; email: string }>
): StageAgingDeal | null {
  const now = new Date();

  // Resolve which date property to use
  const dateProperty = resolveStageDateProperty(deal, stageConfig.stageId);

  if (!dateProperty || !dateProperty.value) {
    console.log(
      `  ⚠️  Deal "${deal.properties.dealname}" (${deal.id}): No date-entered property found for stage ${stageConfig.stageName}`
    );
    return null;
  }

  const dateEnteredStage = new Date(dateProperty.value);
  const daysInStage = calculateDaysBetween(dateEnteredStage, now);

  // Parse last modified date
  const lastModifiedDate = deal.properties.hs_lastmodifieddate
    ? new Date(deal.properties.hs_lastmodifieddate)
    : null;
  const daysSinceModified = lastModifiedDate
    ? calculateDaysBetween(lastModifiedDate, now)
    : null;

  // Parse close date
  const closeDate = deal.properties.closedate
    ? new Date(deal.properties.closedate)
    : null;

  // Determine flag reasons
  const flagReasons: string[] = [];

  // Check aging threshold
  if (daysInStage > stageConfig.thresholdDays) {
    flagReasons.push(stageConfig.flagReason);
  }

  // Check for no recent activity
  if (daysSinceModified !== null && daysSinceModified > NO_ACTIVITY_THRESHOLD_DAYS) {
    flagReasons.push('No Recent Activity');
  }

  // Check for past-due close date
  if (closeDate && closeDate < now) {
    flagReasons.push('Past-Due Close Date');
  }

  // Get owner info
  const ownerId = deal.properties.hubspot_owner_id || null;
  const owner = ownerId ? ownerMap.get(ownerId) : null;
  const ownerName = owner
    ? `${owner.firstName} ${owner.lastName}`.trim()
    : null;

  // Parse amount
  const amount = deal.properties.amount
    ? parseFloat(deal.properties.amount)
    : null;

  return {
    dealId: deal.id,
    dealName: deal.properties.dealname || 'Unnamed Deal',
    dealStage: stageConfig.stageId,
    dealStageName: stageConfig.stageName,
    pipeline: SALES_PIPELINE_ID,
    pipelineName,
    dealOwner: ownerId,
    dealOwnerName: ownerName,
    amount,
    closeDate,
    closeDateString: closeDate ? formatDate(closeDate) : null,
    dateEnteredStage,
    dateEnteredStageString: formatDate(dateEnteredStage),
    daysInStage,
    lastModifiedDate,
    daysSinceModified,
    flagReasons,
    thresholdDays: stageConfig.thresholdDays,
    datePropertyUsed: dateProperty.property,
  };
}

/**
 * Calculates median of an array of numbers
 */
function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0;

  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

/**
 * Creates stage breakdown summary
 */
function createStageBreakdown(
  stageConfig: StageConfig,
  deals: StageAgingDeal[]
): StageBreakdown {
  const stageDeals = deals.filter(d => d.dealStage === stageConfig.stageId);
  const flaggedDeals = stageDeals.filter(
    d => d.daysInStage > stageConfig.thresholdDays
  );

  const daysInStageArray = stageDeals.map(d => d.daysInStage);
  const averageDaysInStage =
    daysInStageArray.length > 0
      ? daysInStageArray.reduce((sum, days) => sum + days, 0) / daysInStageArray.length
      : 0;
  const medianDaysInStage = calculateMedian(daysInStageArray);

  const longestDeal =
    stageDeals.length > 0
      ? stageDeals.reduce((longest, current) =>
          current.daysInStage > longest.daysInStage ? current : longest
        )
      : null;

  return {
    stageName: stageConfig.stageName,
    stageId: stageConfig.stageId,
    thresholdDays: stageConfig.thresholdDays,
    totalDeals: stageDeals.length,
    flaggedDeals: flaggedDeals.length,
    averageDaysInStage: Math.round(averageDaysInStage),
    medianDaysInStage: Math.round(medianDaysInStage),
    longestDeal,
    flaggedDealsList: flaggedDeals,
  };
}

/**
 * Creates overall summary
 */
function createSummary(deals: StageAgingDeal[]): StageAgingSummary {
  const totalFlagged = deals.filter(d => d.flagReasons.length > 0).length;
  const staleDeals = deals.filter(d =>
    d.flagReasons.some(r => r.includes('Stalled'))
  ).length;
  const noActivityDeals = deals.filter(d =>
    d.flagReasons.includes('No Recent Activity')
  ).length;
  const pastDueDeals = deals.filter(d =>
    d.flagReasons.includes('Past-Due Close Date')
  ).length;

  const stageBreakdowns = STAGE_CONFIGS.map(config =>
    createStageBreakdown(config, deals)
  );

  const allDaysInStage = deals.map(d => d.daysInStage);
  const overallAverageDays =
    allDaysInStage.length > 0
      ? allDaysInStage.reduce((sum, days) => sum + days, 0) / allDaysInStage.length
      : 0;
  const overallMedianDays = calculateMedian(allDaysInStage);

  return {
    totalDeals: deals.length,
    totalFlagged,
    staleDeals,
    noActivityDeals,
    pastDueDeals,
    stageBreakdowns,
    overallAverageDays: Math.round(overallAverageDays),
    overallMedianDays: Math.round(overallMedianDays),
    allDeals: deals,
  };
}

// ============================================================================
// DISPLAY FUNCTIONS
// ============================================================================

/**
 * Displays the stage aging report to console
 */
function displayReport(summary: StageAgingSummary): void {
  console.log('\n' + '━'.repeat(80));
  console.log('📊 STAGE AGING REPORT');
  console.log('━'.repeat(80));

  // Overall summary
  console.log('\n📈 Overall Summary:');
  console.log(`   Total Deals Analyzed: ${summary.totalDeals}`);
  console.log(`   Flagged Deals: ${summary.totalFlagged}`);
  console.log(`     • Stale (exceeding threshold): ${summary.staleDeals}`);
  console.log(`     • No Recent Activity (7+ days): ${summary.noActivityDeals}`);
  console.log(`     • Past-Due Close Date: ${summary.pastDueDeals}`);
  console.log(`   Overall Average Days in Stage: ${summary.overallAverageDays}`);
  console.log(`   Overall Median Days in Stage: ${summary.overallMedianDays}`);

  // Stage breakdowns
  console.log('\n' + '━'.repeat(80));
  console.log('📋 Stage Breakdown:');
  console.log('━'.repeat(80));

  for (const breakdown of summary.stageBreakdowns) {
    console.log(`\n🎯 ${breakdown.stageName} (Threshold: ${breakdown.thresholdDays} days):`);
    console.log(`   Total Deals: ${breakdown.totalDeals}`);
    console.log(`   Flagged (exceeding threshold): ${breakdown.flaggedDeals}`);
    console.log(`   Average Days in Stage: ${breakdown.averageDaysInStage}`);
    console.log(`   Median Days in Stage: ${breakdown.medianDaysInStage}`);

    if (breakdown.longestDeal) {
      console.log(
        `   Longest: "${breakdown.longestDeal.dealName}" (${breakdown.longestDeal.daysInStage} days)`
      );
    }
  }

  // Flagged deals table
  if (summary.totalFlagged > 0) {
    console.log('\n' + '━'.repeat(80));
    console.log('🚨 Flagged Deals:');
    console.log('━'.repeat(80));

    const flaggedDeals = summary.allDeals.filter(d => d.flagReasons.length > 0);

    // Sort by days in stage (descending)
    flaggedDeals.sort((a, b) => b.daysInStage - a.daysInStage);

    console.log(
      '\n' +
        'Deal Name'.padEnd(30) +
        'Owner'.padEnd(20) +
        'Stage'.padEnd(20) +
        'Days'.padEnd(8) +
        'Amount'.padEnd(15) +
        'Close Date'.padEnd(12) +
        'Flags'
    );
    console.log('─'.repeat(140));

    for (const deal of flaggedDeals) {
      const dealName =
        deal.dealName.length > 28
          ? deal.dealName.substring(0, 25) + '...'
          : deal.dealName;
      const owner =
        (deal.dealOwnerName || 'Unassigned').length > 18
          ? (deal.dealOwnerName || 'Unassigned').substring(0, 15) + '...'
          : deal.dealOwnerName || 'Unassigned';
      const stage =
        deal.dealStageName.length > 18
          ? deal.dealStageName.substring(0, 15) + '...'
          : deal.dealStageName;
      const days = String(deal.daysInStage);
      const amount = formatCurrency(deal.amount);
      const closeDate = deal.closeDateString || 'N/A';
      const flags = deal.flagReasons.join(', ');

      console.log(
        dealName.padEnd(30) +
          owner.padEnd(20) +
          stage.padEnd(20) +
          days.padEnd(8) +
          amount.padEnd(15) +
          closeDate.padEnd(12) +
          flags
      );
    }
  } else {
    console.log('\n✅ No flagged deals! All deals are within acceptable aging thresholds.');
  }

  console.log('\n' + '━'.repeat(80));
  console.log('✅ Stage Aging Analysis Complete');
  console.log('━'.repeat(80) + '\n');
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function main() {
  console.log('🚀 Starting Stage Aging Analyzer...\n');

  // Validate environment
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('❌ Error: HUBSPOT_ACCESS_TOKEN environment variable is required');
    process.exit(1);
  }

  try {
    // Step 1: Fetch pipelines
    console.log('🔍 Fetching pipelines...');
    const pipelines = await fetchPipelines(accessToken);
    const salesPipeline = pipelines.find(p => p.id === SALES_PIPELINE_ID);

    if (!salesPipeline) {
      console.error(`❌ Error: Sales pipeline (${SALES_PIPELINE_ID}) not found`);
      process.exit(1);
    }

    console.log(`✅ Found pipeline: "${salesPipeline.label}"\n`);

    // Step 2: Log stage property discovery
    console.log('🔬 Stage Configuration:');
    for (const config of STAGE_CONFIGS) {
      console.log(`   • ${config.stageName} (ID: ${config.stageId})`);
      console.log(`     Threshold: ${config.thresholdDays} days`);
      console.log(`     Properties: hs_v2_date_entered_${config.stageId} → hs_date_entered_${config.stageId}`);
    }
    console.log('');

    // Step 3: Search for deals in target stages
    console.log('🔍 Searching for deals in target stages...');
    const stageIds = STAGE_CONFIGS.map(c => c.stageId);
    const searchResponse = await searchDealsByStages(
      accessToken,
      stageIds,
      SALES_PIPELINE_ID
    );

    console.log(`✅ Found ${searchResponse.results.length} deal(s)\n`);

    if (searchResponse.results.length === 0) {
      console.log('ℹ️  No deals found in target stages. Exiting.');
      process.exit(0);
    }

    // Step 4: Fetch owners
    console.log('💼 Fetching deal owners...');
    const ownerIds = searchResponse.results
      .map(deal => deal.properties.hubspot_owner_id)
      .filter(id => id);
    const ownerMap = await fetchOwners(accessToken, ownerIds);
    console.log(`✅ Fetched ${ownerMap.size} owner(s)\n`);

    // Step 5: Analyze deals
    console.log('🔬 Analyzing deals for aging issues...');
    const analyzedDeals: StageAgingDeal[] = [];

    for (const deal of searchResponse.results) {
      const dealStageId = deal.properties.dealstage;
      const stageConfig = STAGE_CONFIGS.find(c => c.stageId === dealStageId);

      if (!stageConfig) {
        console.log(
          `  ⚠️  Deal "${deal.properties.dealname}" has unknown stage ID: ${dealStageId}`
        );
        continue;
      }

      const analyzedDeal = analyzeDeal(
        deal,
        stageConfig,
        salesPipeline.label,
        ownerMap
      );

      if (analyzedDeal) {
        analyzedDeals.push(analyzedDeal);
      }
    }

    console.log(`✅ Analyzed ${analyzedDeals.length} deal(s)\n`);

    // Step 6: Create summary
    const summary = createSummary(analyzedDeals);

    // Step 7: Display report
    displayReport(summary);

    process.exit(0);
  } catch (error) {
    console.error(
      '\n❌ Error:',
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}

main();
