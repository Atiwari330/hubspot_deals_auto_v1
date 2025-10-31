/**
 * Weekly Pipeline Forecast Generator
 *
 * Generates weekly pipeline health report for board meetings including:
 * - Total active pipeline (SQL + Demo Completed + Proposal stages)
 * - Weighted pipeline using stage-specific probability weights
 * - Closed Won and Closed Lost deals from current week
 * - Stage-by-stage breakdown with deal counts and percentages
 *
 * Week Definition: Monday to Sunday (week ends Sunday)
 * Target Stages: SQL, Demo Completed, Proposal
 * Stage Weights: SQL (30%), Demo Completed (30%), Proposal (50%)
 */

import 'dotenv/config';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import {
  fetchPipelines,
  searchDealsByStages,
  fetchOwners,
  findStageIdsByLabels,
  type Pipeline,
} from './hubspot.js';
import type {
  WeeklyForecastMetrics,
  StageForecast,
  WeeklyForecastReport,
} from './types.js';

// Stage weights for probability-adjusted pipeline
const STAGE_WEIGHTS: Record<string, number> = {
  'sql': 0.30,           // 30% probability
  'demo': 0.30,          // 30% probability
  'proposal': 0.50,      // 50% probability
};

// Target stages for active pipeline
const ACTIVE_STAGES = ['sql', 'demo', 'proposal'];

/**
 * Get the current week boundaries (Monday to Sunday)
 * Returns the Monday start and Sunday end of the current week
 */
function getCurrentWeek(): { weekStart: Date; weekEnd: Date; weekEndingDate: Date } {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  // Calculate days since Monday (handle Sunday as 6 days since Monday)
  const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;

  // Get Monday of current week (start of week at 00:00:00)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysSinceMonday);
  weekStart.setHours(0, 0, 0, 0);

  // Get Sunday of current week (end of week at 23:59:59)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // Week ending date (Sunday at end of day)
  const weekEndingDate = new Date(weekEnd);
  weekEndingDate.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd, weekEndingDate };
}

/**
 * Format date for subject line (e.g., "Oct 31, 2025")
 */
function formatWeekEndingDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Check if a timestamp falls within the current week
 */
function isInCurrentWeek(timestamp: string | null, weekStart: Date, weekEnd: Date): boolean {
  if (!timestamp) return false;

  const date = new Date(timestamp);
  return date >= weekStart && date <= weekEnd;
}

/**
 * Get the stage weight for a given stage label
 */
function getStageWeight(stageLabel: string): number {
  const normalized = stageLabel.toLowerCase().trim();

  // Check for SQL
  if (normalized.includes('sql')) return STAGE_WEIGHTS['sql'];

  // Check for Demo (Demo Completed, Demo - Completed, etc.)
  if (normalized.includes('demo') && (normalized.includes('completed') || normalized.includes('complete'))) {
    return STAGE_WEIGHTS['demo'];
  }

  // Check for Proposal
  if (normalized.includes('proposal')) return STAGE_WEIGHTS['proposal'];

  // Default to 0 if no match
  return 0;
}

/**
 * Get readable stage name for reporting
 */
function getReadableStageName(stageLabel: string): string {
  const normalized = stageLabel.toLowerCase().trim();

  if (normalized.includes('sql')) return 'SQL';
  if (normalized.includes('demo') && (normalized.includes('completed') || normalized.includes('complete'))) {
    return 'Demo Completed';
  }
  if (normalized.includes('proposal')) return 'Proposal';

  return stageLabel; // Return original if no match
}

/**
 * Process active pipeline deals and calculate metrics
 */
function processActivePipelineDeals(
  deals: any[],
  pipelines: Pipeline[]
): { stageBreakdown: StageForecast[]; totalPipeline: number; weightedPipeline: number } {
  // Group deals by stage
  const stageGroups = new Map<string, {
    deals: any[];
    stageLabel: string;
    pipelineId: string;
  }>();

  for (const deal of deals) {
    const stageId = deal.properties.dealstage;
    const pipelineId = deal.properties.pipeline;

    if (!stageId) continue;

    // Find the stage label from pipelines
    let stageLabel = 'Unknown';
    for (const pipeline of pipelines) {
      const stage = pipeline.stages.find(s => s.id === stageId);
      if (stage) {
        stageLabel = stage.label;
        break;
      }
    }

    const key = `${pipelineId}:${stageId}`;
    if (!stageGroups.has(key)) {
      stageGroups.set(key, { deals: [], stageLabel, pipelineId });
    }

    stageGroups.get(key)!.deals.push(deal);
  }

  // Calculate metrics for each stage
  const stageBreakdown: StageForecast[] = [];
  let totalPipeline = 0;
  let weightedPipeline = 0;

  for (const [_, group] of stageGroups) {
    const readableName = getReadableStageName(group.stageLabel);
    const stageWeight = getStageWeight(group.stageLabel);

    let pipelineAmount = 0;
    let dealCount = 0;

    for (const deal of group.deals) {
      const amount = parseFloat(deal.properties.amount || '0');
      pipelineAmount += amount;
      dealCount++;
    }

    const weightedAmount = pipelineAmount * stageWeight;

    totalPipeline += pipelineAmount;
    weightedPipeline += weightedAmount;

    stageBreakdown.push({
      stageName: readableName,
      dealCount,
      pipelineAmount,
      weightedAmount,
      stageWeight,
      percentageOfTotal: 0, // Will calculate after we have total
    });
  }

  // Calculate percentages
  for (const stage of stageBreakdown) {
    stage.percentageOfTotal = totalPipeline > 0 ? (stage.pipelineAmount / totalPipeline) * 100 : 0;
  }

  // Sort by stage order (SQL -> Demo -> Proposal)
  const stageOrder = ['SQL', 'Demo Completed', 'Proposal'];
  stageBreakdown.sort((a, b) => {
    const aIndex = stageOrder.indexOf(a.stageName);
    const bIndex = stageOrder.indexOf(b.stageName);
    return aIndex - bIndex;
  });

  return { stageBreakdown, totalPipeline, weightedPipeline };
}

/**
 * Process closed deals from current week
 */
function processClosedDeals(
  deals: any[],
  weekStart: Date,
  weekEnd: Date,
  isClosedWon: boolean
): { count: number; amount: number } {
  const dateProperty = isClosedWon ? 'hs_date_entered_closedwon' : 'hs_date_entered_closedlost';

  let count = 0;
  let amount = 0;

  for (const deal of deals) {
    const dateEntered = deal.properties[dateProperty];

    if (isInCurrentWeek(dateEntered, weekStart, weekEnd)) {
      count++;
      amount += parseFloat(deal.properties.amount || '0');
    }
  }

  return { count, amount };
}

/**
 * Display forecast report in console
 */
function displayWeeklyForecastReport(report: WeeklyForecastReport): void {
  const { metrics, stageBreakdown } = report;

  console.log('\n');
  console.log('━'.repeat(100));
  console.log(`WEEKLY PIPELINE FORECAST - Week Ending ${formatWeekEndingDate(metrics.weekEnding)}`);
  console.log('━'.repeat(100));
  console.log('\n');

  // Pipeline Overview
  console.log('📊 PIPELINE OVERVIEW');
  console.log('─'.repeat(100));
  console.log(`   Total Active Pipeline (All Active Deals):     $${metrics.totalPipeline.toLocaleString()}`);
  console.log(`   Weighted Pipeline (Probability-Adjusted):     $${metrics.weightedPipeline.toLocaleString()}`);
  console.log(`   Closed Won (This Week):                       $${metrics.closedWon.amount.toLocaleString()} (${metrics.closedWon.count} deals)`);
  console.log(`   Closed Lost (This Week):                      $${metrics.closedLost.amount.toLocaleString()} (${metrics.closedLost.count} deals)`);
  console.log('\n');

  // Forecast by Stage
  console.log('📈 FORECAST BY STAGE (Active Pipeline)');
  console.log('─'.repeat(100));
  console.log(
    '   Stage'.padEnd(20) +
    'Deal Count'.padEnd(15) +
    'Pipeline $'.padEnd(20) +
    'Weighted $'.padEnd(20) +
    '% of Total'.padEnd(15)
  );
  console.log('   ' + '─'.repeat(95));

  for (const stage of stageBreakdown) {
    console.log(
      `   ${stage.stageName.padEnd(18)}` +
      `${stage.dealCount.toString().padEnd(15)}` +
      `$${stage.pipelineAmount.toLocaleString().padEnd(18)}` +
      `$${stage.weightedAmount.toLocaleString().padEnd(18)} (${(stage.stageWeight * 100).toFixed(0)}%)` +
      `${stage.percentageOfTotal.toFixed(1)}%`
    );
  }

  console.log('   ' + '─'.repeat(95));
  console.log(
    `   ${'TOTAL'.padEnd(18)}` +
    `${stageBreakdown.reduce((sum, s) => sum + s.dealCount, 0).toString().padEnd(15)}` +
    `$${report.totalActive.toLocaleString().padEnd(18)}` +
    `$${report.totalWeighted.toLocaleString().padEnd(18)}`
  );

  console.log('\n');
  console.log('━'.repeat(100));
  console.log('\n');
}

/**
 * Generate AI-powered email report
 */
async function generateWeeklyForecastEmail(report: WeeklyForecastReport): Promise<string> {
  const { metrics, stageBreakdown } = report;

  // Build stage breakdown text
  let stageBreakdownText = '';
  for (const stage of stageBreakdown) {
    stageBreakdownText += `${stage.stageName}: ${stage.dealCount} deals, $${stage.pipelineAmount.toLocaleString()} pipeline, $${stage.weightedAmount.toLocaleString()} weighted (${(stage.stageWeight * 100).toFixed(0)}% probability), ${stage.percentageOfTotal.toFixed(1)}% of total\n`;
  }

  const prompt = `You are generating a professional weekly revenue forecast email for a board meeting at Opus, an EHR software company in the behavioral health space.

**IMPORTANT FORMATTING REQUIREMENTS:**
- Output ONLY plain text optimized for copy-pasting into an email
- DO NOT use markdown formatting (no **, ##, bullets, etc.)
- Use simple ASCII characters only (no special unicode characters)
- Use spaces and line breaks for structure
- Create clean tables using spaces for alignment

**Data Summary:**
Week Ending: ${formatWeekEndingDate(metrics.weekEnding)}
Total Active Pipeline: $${metrics.totalPipeline.toLocaleString()}
Weighted Pipeline: $${metrics.weightedPipeline.toLocaleString()}
Closed Won (This Week): $${metrics.closedWon.amount.toLocaleString()} (${metrics.closedWon.count} deals)
Closed Lost (This Week): $${metrics.closedLost.amount.toLocaleString()} (${metrics.closedLost.count} deals)

Stage Breakdown:
${stageBreakdownText}

Total Active Deals: ${report.totalActive}
Total Weighted Forecast: $${report.totalWeighted.toLocaleString()}

**Email Structure:**
1. Subject Line: "Opus Weekly Revenue Forecast — Week Ending [date]"
2. Pipeline Overview section with 4 key metrics
3. Forecast by Stage table with columns: Stage | Deal Count | Pipeline $ | Weighted $ | % of Total
4. Brief executive summary paragraph highlighting key insights
5. Keep it concise and board-ready

**Tone:** Professional, executive-level, data-focused, confident

Generate the complete email now:`;

  try {
    console.log('🤖 Generating AI-powered email report...\n');

    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      prompt,
      temperature: 0.3,
    });

    console.log('✅ Email report generated successfully!\n');
    console.log('━'.repeat(100));
    console.log('📧 EMAIL REPORT (Copy and paste below)');
    console.log('━'.repeat(100));
    console.log('\n');
    console.log(text);
    console.log('\n');
    console.log('━'.repeat(100));

    return text;
  } catch (error) {
    console.error('❌ Error generating email report:', error);
    throw error;
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('\n');
  console.log('🚀 Starting Weekly Pipeline Forecast Generator...\n');

  // Validate environment variables
  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    throw new Error('❌ HUBSPOT_ACCESS_TOKEN not found in environment variables');
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('❌ OPENAI_API_KEY not found in environment variables');
  }

  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;

  // Get current week boundaries
  const { weekStart, weekEnd, weekEndingDate } = getCurrentWeek();
  console.log(`📅 Current Week: ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`);
  console.log(`📅 Week Ending: ${formatWeekEndingDate(weekEndingDate)}\n`);

  // Fetch pipelines
  console.log('🔍 Fetching pipelines and stages...\n');
  const pipelines = await fetchPipelines(accessToken);

  // Find Sales pipeline
  const salesPipeline = pipelines.find(p => p.label.toLowerCase() === 'sales');
  if (!salesPipeline) {
    throw new Error('❌ Could not find "Sales" pipeline');
  }

  console.log(`✅ Found Sales pipeline (ID: ${salesPipeline.id})\n`);

  // Find stage IDs for active pipeline stages
  console.log('🔍 Finding active pipeline stages (SQL, Demo Completed, Proposal)...\n');
  const activeStageIds = findStageIdsByLabels([salesPipeline], ACTIVE_STAGES);

  if (activeStageIds.length === 0) {
    throw new Error('❌ Could not find any active pipeline stages (SQL, Demo, Proposal)');
  }

  console.log(`✅ Found ${activeStageIds.length} active stage(s)\n`);

  // Find stage IDs for closed stages
  console.log('🔍 Finding closed stages (Closed Won, Closed Lost)...\n');
  const closedWonStageIds = findStageIdsByLabels([salesPipeline], ['closed won', 'closedwon']);
  const closedLostStageIds = findStageIdsByLabels([salesPipeline], ['closed lost', 'closedlost']);

  // Fetch active pipeline deals
  console.log('📋 Fetching active pipeline deals (SQL + Demo Completed + Proposal)...\n');
  const activePipelineResult = await searchDealsByStages(accessToken, activeStageIds, salesPipeline.id);
  const activeDeals = activePipelineResult.results;

  console.log(`✅ Found ${activeDeals.length} active deal(s)\n`);

  // Fetch closed deals
  let closedWonDeals: any[] = [];
  let closedLostDeals: any[] = [];

  if (closedWonStageIds.length > 0) {
    console.log('📋 Fetching Closed Won deals...\n');
    const closedWonResult = await searchDealsByStages(accessToken, closedWonStageIds, salesPipeline.id);
    closedWonDeals = closedWonResult.results;
    console.log(`✅ Found ${closedWonDeals.length} Closed Won deal(s)\n`);
  }

  if (closedLostStageIds.length > 0) {
    console.log('📋 Fetching Closed Lost deals...\n');
    const closedLostResult = await searchDealsByStages(accessToken, closedLostStageIds, salesPipeline.id);
    closedLostDeals = closedLostResult.results;
    console.log(`✅ Found ${closedLostDeals.length} Closed Lost deal(s)\n`);
  }

  // Process active pipeline
  console.log('📊 Calculating pipeline metrics...\n');
  const { stageBreakdown, totalPipeline, weightedPipeline } = processActivePipelineDeals(
    activeDeals,
    pipelines
  );

  // Process closed deals
  const closedWon = processClosedDeals(closedWonDeals, weekStart, weekEnd, true);
  const closedLost = processClosedDeals(closedLostDeals, weekStart, weekEnd, false);

  // Build report
  const report: WeeklyForecastReport = {
    metrics: {
      weekEnding: weekEndingDate,
      totalPipeline,
      weightedPipeline,
      closedWon,
      closedLost,
    },
    stageBreakdown,
    totalActive: totalPipeline,
    totalWeighted: weightedPipeline,
  };

  // Display console report
  displayWeeklyForecastReport(report);

  // Generate AI email report
  await generateWeeklyForecastEmail(report);

  console.log('\n✅ Weekly forecast generation complete!\n');
}

// Execute main function
main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
