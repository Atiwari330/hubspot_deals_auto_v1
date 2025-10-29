/**
 * Quarterly Sales Forecast Generator
 *
 * Analyzes deals in Proposal stage with close dates in current quarter
 * to generate revenue forecasts based on ARR (Amount field).
 */

import 'dotenv/config';
import { searchDealsByStages, fetchOwners, fetchPipelines, findStageIdsByLabels } from './hubspot.js';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import type {
  QuarterInfo,
  ForecastDeal,
  MonthlyForecast,
  OwnerForecast,
  ForecastSummary
} from './types.js';

// Target stage for forecasting
const TARGET_STAGE = 'proposal';

/**
 * Get current quarter information
 */
function getCurrentQuarter(): QuarterInfo {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11

  // Determine quarter (1-4) based on month
  const quarter = Math.floor(month / 3) + 1;

  // Calculate quarter start and end dates
  const quarterStartMonth = (quarter - 1) * 3;
  const startDate = new Date(year, quarterStartMonth, 1);

  const quarterEndMonth = quarter * 3;
  const endDate = new Date(year, quarterEndMonth, 0, 23, 59, 59, 999); // Last day of quarter

  return {
    year,
    quarter,
    startDate,
    endDate,
    label: `Q${quarter} ${year}`
  };
}

/**
 * Check if a date falls within a quarter
 */
function isInQuarter(date: Date, quarter: QuarterInfo): boolean {
  return date >= quarter.startDate && date <= quarter.endDate;
}

/**
 * Format currency value
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

/**
 * Get month name from month number (1-12)
 */
function getMonthName(monthNumber: number, year: number): string {
  const date = new Date(year, monthNumber - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Process deals and filter to current quarter
 */
function processForecastDeals(
  deals: any[],
  owners: Map<string, string>,
  quarter: QuarterInfo
): { forecastDeals: ForecastDeal[], skippedCount: number } {
  const forecastDeals: ForecastDeal[] = [];
  let skippedCount = 0;

  for (const deal of deals) {
    const properties = deal.properties;

    // Skip if missing close date
    const closeDateStr = properties.closedate;
    if (!closeDateStr) {
      skippedCount++;
      continue;
    }

    // Parse close date
    const closeDate = new Date(closeDateStr);

    // Skip if not in current quarter
    if (!isInQuarter(closeDate, quarter)) {
      continue;
    }

    // Skip if missing amount
    const amount = parseFloat(properties.amount);
    if (isNaN(amount) || amount === null || amount === undefined) {
      skippedCount++;
      continue;
    }

    // Create forecast deal
    forecastDeals.push({
      dealId: deal.id,
      dealName: properties.dealname || 'Untitled Deal',
      dealStage: properties.dealstage || '',
      dealStageName: properties.dealstage_label || 'Unknown Stage',
      dealOwner: properties.hubspot_owner_id || null,
      dealOwnerName: properties.hubspot_owner_id
        ? owners.get(properties.hubspot_owner_id) || 'Unknown Owner'
        : 'Unassigned',
      amount,
      closeDate,
      closeDateString: formatDate(closeDate)
    });
  }

  return { forecastDeals, skippedCount };
}

/**
 * Create forecast summary with breakdowns
 */
function createForecastSummary(
  forecastDeals: ForecastDeal[],
  quarter: QuarterInfo,
  skippedCount: number
): ForecastSummary {
  // Calculate totals
  const totalARR = forecastDeals.reduce((sum, deal) => sum + deal.amount, 0);
  const totalDeals = forecastDeals.length;
  const averageDealSize = totalDeals > 0 ? totalARR / totalDeals : 0;

  // Group by month
  const monthlyMap = new Map<number, ForecastDeal[]>();
  for (const deal of forecastDeals) {
    const month = deal.closeDate.getMonth() + 1; // 1-12
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, []);
    }
    monthlyMap.get(month)!.push(deal);
  }

  // Create monthly breakdown
  const monthlyBreakdown: MonthlyForecast[] = [];
  const quarterStartMonth = quarter.startDate.getMonth() + 1;
  const quarterEndMonth = quarter.endDate.getMonth() + 1;

  for (let month = quarterStartMonth; month <= quarterEndMonth; month++) {
    const deals = monthlyMap.get(month) || [];
    const monthARR = deals.reduce((sum, deal) => sum + deal.amount, 0);

    monthlyBreakdown.push({
      month: getMonthName(month, quarter.year),
      monthNumber: month,
      totalARR: monthARR,
      dealCount: deals.length,
      deals
    });
  }

  // Group by owner
  const ownerMap = new Map<string, ForecastDeal[]>();
  for (const deal of forecastDeals) {
    const ownerId = deal.dealOwner || 'unassigned';
    if (!ownerMap.has(ownerId)) {
      ownerMap.set(ownerId, []);
    }
    ownerMap.get(ownerId)!.push(deal);
  }

  // Create owner breakdown
  const ownerBreakdown: OwnerForecast[] = [];
  for (const [ownerId, deals] of ownerMap.entries()) {
    const ownerARR = deals.reduce((sum, deal) => sum + deal.amount, 0);
    ownerBreakdown.push({
      ownerId: ownerId === 'unassigned' ? null : ownerId,
      ownerName: deals[0]?.dealOwnerName || 'Unassigned',
      totalARR: ownerARR,
      dealCount: deals.length,
      deals
    });
  }

  // Sort by ARR descending
  ownerBreakdown.sort((a, b) => b.totalARR - a.totalARR);

  return {
    quarter,
    totalARR,
    totalDeals,
    averageDealSize,
    monthlyBreakdown,
    ownerBreakdown,
    allDeals: forecastDeals,
    skippedDealsCount: skippedCount
  };
}

/**
 * Display forecast report to console
 */
function displayForecastReport(summary: ForecastSummary): void {
  console.log('\n');
  console.log('━'.repeat(100));
  console.log(`QUARTERLY SALES FORECAST - ${summary.quarter.label.toUpperCase()}`);
  console.log('━'.repeat(100));
  console.log('');

  // Executive Summary
  console.log(`📊 Quarter: ${summary.quarter.label} (${formatDate(summary.quarter.startDate)} - ${formatDate(summary.quarter.endDate)})`);
  console.log(`💰 Total Forecasted ARR: ${formatCurrency(summary.totalARR)}`);
  console.log(`📈 Total Deals in Pipeline: ${summary.totalDeals}`);
  console.log(`📐 Average Deal Size: ${formatCurrency(summary.averageDealSize)}`);
  if (summary.skippedDealsCount > 0) {
    console.log(`⚠️  Skipped Deals (missing close date or amount): ${summary.skippedDealsCount}`);
  }
  console.log('');

  // Monthly Breakdown
  console.log('━'.repeat(100));
  console.log('📅 MONTHLY BREAKDOWN');
  console.log('━'.repeat(100));
  console.log('');

  for (const monthly of summary.monthlyBreakdown) {
    const percentage = summary.totalARR > 0
      ? ((monthly.totalARR / summary.totalARR) * 100).toFixed(1)
      : '0.0';

    console.log(`${monthly.month}`);
    console.log(`   ARR: ${formatCurrency(monthly.totalARR)} (${percentage}% of quarter)`);
    console.log(`   Deals: ${monthly.dealCount}`);

    if (monthly.deals.length > 0) {
      // Show top 3 deals for this month
      const topDeals = [...monthly.deals]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);

      console.log('   Top Deals:');
      for (const deal of topDeals) {
        console.log(`      • ${deal.dealName} - ${formatCurrency(deal.amount)} (${deal.dealOwnerName}) - Closes ${deal.closeDateString}`);
      }
    }
    console.log('');
  }

  // Owner Breakdown
  console.log('━'.repeat(100));
  console.log('👥 FORECAST BY SALES REP');
  console.log('━'.repeat(100));
  console.log('');

  for (const owner of summary.ownerBreakdown) {
    const percentage = summary.totalARR > 0
      ? ((owner.totalARR / summary.totalARR) * 100).toFixed(1)
      : '0.0';

    console.log(`${owner.ownerName}`);
    console.log(`   Forecasted ARR: ${formatCurrency(owner.totalARR)} (${percentage}% of quarter)`);
    console.log(`   Deal Count: ${owner.dealCount}`);
    console.log(`   Avg Deal Size: ${formatCurrency(owner.totalARR / owner.dealCount)}`);
    console.log('   Deals:');

    // Sort deals by close date
    const sortedDeals = [...owner.deals].sort((a, b) =>
      a.closeDate.getTime() - b.closeDate.getTime()
    );

    for (const deal of sortedDeals) {
      console.log(`      • ${deal.dealName} - ${formatCurrency(deal.amount)} - Closes ${deal.closeDateString}`);
    }
    console.log('');
  }

  console.log('━'.repeat(100));
}

/**
 * Generate AI-powered email report
 */
async function generateForecastEmail(summary: ForecastSummary): Promise<string> {
  console.log('\n📧 Generating AI-powered email report...\n');

  // Prepare data for AI
  const data = {
    quarter: summary.quarter.label,
    quarterDates: `${formatDate(summary.quarter.startDate)} - ${formatDate(summary.quarter.endDate)}`,
    totalARR: formatCurrency(summary.totalARR),
    totalDeals: summary.totalDeals,
    averageDealSize: formatCurrency(summary.averageDealSize),
    skippedDeals: summary.skippedDealsCount,
    monthlyBreakdown: summary.monthlyBreakdown.map(m => ({
      month: m.month,
      arr: formatCurrency(m.totalARR),
      dealCount: m.dealCount,
      percentage: summary.totalARR > 0
        ? ((m.totalARR / summary.totalARR) * 100).toFixed(1) + '%'
        : '0%',
      topDeals: m.deals
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)
        .map(d => ({
          name: d.dealName,
          arr: formatCurrency(d.amount),
          owner: d.dealOwnerName,
          closeDate: d.closeDateString
        }))
    })),
    ownerBreakdown: summary.ownerBreakdown.map(o => ({
      owner: o.ownerName,
      arr: formatCurrency(o.totalARR),
      dealCount: o.dealCount,
      percentage: summary.totalARR > 0
        ? ((o.totalARR / summary.totalARR) * 100).toFixed(1) + '%'
        : '0%',
      deals: o.deals.map(d => ({
        name: d.dealName,
        arr: formatCurrency(d.amount),
        closeDate: d.closeDateString
      }))
    }))
  };

  const prompt = `You are an executive assistant for a VP of Revenue Operations at an EHR software company.

Generate a professional quarterly sales forecast email based on the following data:

${JSON.stringify(data, null, 2)}

CONTEXT:
- This forecast shows Proposal-stage deals expected to close in ${data.quarter}
- The ARR (Annual Recurring Revenue) values come from the deal "Amount" field in HubSpot
- This is sent to the executive team to provide visibility into the sales pipeline

REQUIREMENTS:
1. Write in plain text format (NO markdown, NO asterisks, NO special formatting)
2. Use a professional but conversational tone appropriate for executive communication
3. Start with a brief executive summary highlighting:
   - Total forecasted ARR for the quarter
   - Number of deals in the pipeline
   - Key trends or insights (which month is strongest, top performers, etc.)

4. Include a monthly breakdown section showing:
   - ARR expected per month
   - Percentage of quarter's total
   - Number of deals closing that month
   - Top 3-5 deals for each month (name, ARR, owner, close date)

5. Include a sales rep breakdown section showing:
   - Each rep's total forecasted ARR
   - Their percentage contribution to the quarter
   - Number of deals they own
   - List of their deals with ARR and close dates

6. If there were skipped deals (missing close date or amount), mention this in a data quality note

7. End with a brief call-to-action or next steps (e.g., "Let me know if you need any adjustments to these projections")

8. Sign off casually with just "Best"

9. DO NOT include any meta-commentary like "Here's the email" or "Subject:" - just write the email body

10. Make sure all dollar amounts and dates are formatted exactly as provided in the data

11. Keep the tone confident but realistic - this is a forecast, not guaranteed revenue

WRITE ONLY THE EMAIL BODY (no subject line needed):`;

  try {
    const result = await generateText({
      model: openai('gpt-4o-mini'),
      prompt,
      temperature: 0.7,
      maxTokens: 2000,
    });

    return result.text;
  } catch (error: any) {
    console.error('❌ Failed to generate AI email:', error.message);
    return 'Failed to generate AI email report. Please check console output for details.';
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🚀 Starting Quarterly Sales Forecast Generator...\n');

    // Validate environment
    if (!process.env.HUBSPOT_ACCESS_TOKEN) {
      throw new Error('HUBSPOT_ACCESS_TOKEN not found in environment');
    }
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not found in environment');
    }

    const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;

    // Get current quarter
    const quarter = getCurrentQuarter();
    console.log(`📅 Generating forecast for ${quarter.label}`);
    console.log(`   Period: ${formatDate(quarter.startDate)} - ${formatDate(quarter.endDate)}\n`);

    // Fetch pipelines to find Sales pipeline
    console.log('🔍 Fetching pipelines...\n');
    const pipelines = await fetchPipelines(accessToken);
    const salesPipeline = pipelines.find(p =>
      p.label.toLowerCase() === 'sales'
    );

    if (!salesPipeline) {
      throw new Error('Sales pipeline not found');
    }

    console.log(`✅ Found Sales pipeline (ID: ${salesPipeline.id})\n`);

    // Find stage IDs for the target stage in Sales pipeline
    const salesPipelineOnly = [salesPipeline];
    const stageIds = findStageIdsByLabels(salesPipelineOnly, [TARGET_STAGE]);

    if (stageIds.length === 0) {
      throw new Error(`No stages found matching "${TARGET_STAGE}" in Sales pipeline`);
    }

    console.log(`✅ Found ${stageIds.length} matching stage(s) in Sales pipeline\n`);

    // Fetch deals in Proposal stage, restricted to Sales pipeline
    console.log(`📋 Fetching deals in "${TARGET_STAGE}" stage...\n`);
    const result = await searchDealsByStages(accessToken, stageIds, salesPipeline.id);
    const salesDeals = result.results;

    console.log(`✅ Found ${salesDeals.length} deal(s) in Sales pipeline\n`);

    if (salesDeals.length === 0) {
      console.log('ℹ️  No deals found in Proposal stage. Forecast is empty.\n');
      return;
    }

    // Fetch owner information
    console.log('💼 Fetching owner information...\n');

    // Collect all unique owner IDs
    const ownerIds = salesDeals
      .map(deal => deal.properties.hubspot_owner_id)
      .filter(id => id);

    // Fetch all owners
    const ownersMap = await fetchOwners(accessToken, ownerIds);

    // Create owner name map for easy lookup
    const ownerNames = new Map<string, string>();
    ownersMap.forEach((owner, id) => {
      ownerNames.set(id, `${owner.firstName} ${owner.lastName}`);
    });

    // Process deals for current quarter
    console.log('🔬 Processing deals and filtering to current quarter...\n');
    const { forecastDeals, skippedCount } = processForecastDeals(
      salesDeals,
      ownerNames,
      quarter
    );

    if (forecastDeals.length === 0) {
      console.log(`ℹ️  No deals closing in ${quarter.label}. Forecast is empty.`);
      if (skippedCount > 0) {
        console.log(`   (${skippedCount} deal(s) were skipped due to missing data or outside quarter)`);
      }
      console.log('');
      return;
    }

    // Create summary
    const summary = createForecastSummary(forecastDeals, quarter, skippedCount);

    // Display console report
    displayForecastReport(summary);

    // Generate AI email
    const emailBody = await generateForecastEmail(summary);

    // Display email
    console.log('━'.repeat(100));
    console.log('📧 AI-GENERATED EMAIL REPORT');
    console.log('━'.repeat(100));
    console.log('');
    console.log(emailBody);
    console.log('');
    console.log('━'.repeat(100));
    console.log('');

    console.log('✅ Forecast generation complete!\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run main function
main();
