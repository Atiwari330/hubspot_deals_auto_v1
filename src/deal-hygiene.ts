import 'dotenv/config';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
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
  console.log('DEAL HYGIENE REPORT - SALES PIPELINE ONLY');
  console.log('━'.repeat(80));

  console.log(`\n📊 Analyzed: ${summary.totalDeals} deal(s) in Sales pipeline ("Proposal" and "Demo - Completed" stages)`);
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
 * Generates an AI-powered email report for the team
 */
async function generateEmailReport(
  summary: HygieneSummary,
  reports: DealHygieneReport[]
): Promise<string> {
  // Organize critical deals by owner for better accountability
  const dealsByOwner = new Map<string, DealHygieneReport[]>();

  summary.criticalDeals.forEach(deal => {
    const ownerName = deal.dealOwnerName || 'Unassigned';
    if (!dealsByOwner.has(ownerName)) {
      dealsByOwner.set(ownerName, []);
    }
    dealsByOwner.get(ownerName)!.push(deal);
  });

  // Prepare data for AI in a structured format
  const dataForAI = {
    totalDeals: summary.totalDeals,
    overallHealth: summary.averageCompleteness,
    criticalDealsCount: summary.criticalDeals.length,
    dealsByOwner: Array.from(dealsByOwner.entries()).map(([owner, deals]) => ({
      owner,
      dealCount: deals.length,
      deals: deals.map(deal => ({
        name: deal.dealName,
        id: deal.dealId,
        pipeline: deal.dealPipelineName,
        stage: deal.dealStageName,
        completeness: deal.completenessScore,
        missingFields: deal.missingProperties.map(mp => mp.label),
      }))
    })),
    topMissingProperties: Array.from(summary.propertyMissingCounts.entries())
      .sort((a, b) => b[1].missingCount - a[1].missingCount)
      .slice(0, 5)
      .map(([_, data]) => ({
        field: data.label,
        missingCount: data.missingCount,
        percentage: data.percentage
      }))
  };

  console.log('🤖 Generating AI-powered email report...\n');

  try {
    const { text } = await generateText({
      model: openai('gpt-5-mini'),
      prompt: `You are assisting a VP of Revenue Operations at a software company that sells EHR (Electronic Health Records) systems.

Your task is to create a professional email that the VP can send to their sales team every other day about HubSpot deal hygiene.

<context>
- The VP needs to ensure all deals have complete, required information
- This is a regular reminder email (sent every other day)
- Tone should be professional but casual - this is a helpful FYI, not demanding
- The team is busy, so keep it actionable but not bossy
</context>

<data>
Total deals analyzed: ${dataForAI.totalDeals} (Sales pipeline only - Proposal and Demo stages)
Overall health: ${dataForAI.overallHealth}% complete (average)
Critical issues: ${dataForAI.criticalDealsCount} deals missing 3+ required fields

Deals by owner (critical issues only):
${JSON.stringify(dataForAI.dealsByOwner, null, 2)}

Top missing fields across all deals:
${JSON.stringify(dataForAI.topMissingProperties, null, 2)}
</data>

<requirements>
SUBJECT LINE:
- MUST be exactly: "HubSpot Deal Hygiene Report"
- Do NOT vary or customize the subject

OPENING:
- Start with "Quick health check:" followed by 1-2 sentences about the stats
- Include total deals, pipeline name, overall health percentage, and number of critical deals

BODY - DEALS BY OWNER:
- Organize by owner name
- YOU MUST LIST EVERY SINGLE DEAL - Do NOT summarize, truncate, or use phrases like "other deals" or "listed similarly"
- For each deal show: deal name (with Deal ID if available) and specific missing fields
- Use plain hyphens (-) for lists

BODY - MISSING FIELDS SUMMARY:
- Include "Most commonly missing fields" section
- Show top 5 missing fields with count and percentage

CALL-TO-ACTION:
- MUST be simple and casual: "When you have some time, please make sure these deals are updated."
- Do NOT include deadlines, timelines, or "reply if you can't complete" language
- Do NOT be bossy or demanding

SIGN-OFF:
- MUST be just: "Best"
- Do NOT include "thanks for keeping our pipeline accurate" or similar
- Do NOT include "reach out if you need help" language
</requirements>

<formatting>
- Use PLAIN TEXT ONLY - NO markdown formatting
- Do NOT use asterisks (**), underscores (_), or any markup symbols
- Do NOT use markdown bullets - use plain hyphens (-) for lists
- The email will be copied directly into an email client
- Make it easy to scan with clear sections and line breaks
</formatting>

<example>
Subject: HubSpot Deal Hygiene Report

Quick health check: We reviewed 25 Sales-pipeline deals (Proposal and Demo stages). Overall completeness is 82%, and there are 7 deals missing 3+ required fields.

Owner: Christopher Garraffa
- Alpine Springs Addiction Treatment - Robert's Referral (Deal ID: 36660836688)
  - Missing fields: Next Meeting Start Time, Deal Collaborator, Next Activity Date (EDT)

Owner: Humberto Buniotto
- Luna (Zinnia) - Robert's Referral (Deal ID: 38678781552)
  - Missing fields: Next Meeting Start Time, Deal Collaborator, Next Activity Date (EDT)

Most commonly missing fields
- Next Meeting Start Time: missing in 20 deals (80%)
- Next Activity Date (EDT): missing in 14 deals (56%)

When you have some time, please make sure these deals are updated.

Best
</example>

IMPORTANT: Do NOT include any meta-commentary, explanations, or notes - just output the email exactly as it should be sent. List EVERY single deal for EVERY owner - do not abbreviate or summarize.`,
    });

    return text;
  } catch (error) {
    console.error('❌ Failed to generate AI email:', error instanceof Error ? error.message : error);
    return 'Failed to generate email report. Please check your OpenAI API configuration.';
  }
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

    // Find the Sales pipeline
    const salesPipeline = pipelines.find(p => p.label === 'Sales');
    if (!salesPipeline) {
      throw new Error('Sales pipeline not found');
    }

    console.log(`✅ Found Sales pipeline (ID: ${salesPipeline.id})\n`);

    // Find stages matching "proposal" and "demo" ONLY in Sales pipeline
    const targetStages = ['proposal', 'demo'];
    const salesPipelineOnly = [salesPipeline];
    const stageIds = findStageIdsByLabels(salesPipelineOnly, targetStages);

    console.log(`✅ Found ${stageIds.length} matching stage(s) in Sales pipeline\n`);
    console.log('📋 Fetching deals in Sales pipeline only...\n');

    // Search for deals in those stages, restricted to Sales pipeline
    const result = await searchDealsByStages(accessToken, stageIds, salesPipeline.id);

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

    // Generate AI-powered email report
    const emailReport = await generateEmailReport(summary, reports);

    // Display copy-pasteable email
    console.log('\n' + '━'.repeat(80));
    console.log('📧 EMAIL REPORT (Copy & Paste Below)');
    console.log('━'.repeat(80));
    console.log('\n' + emailReport + '\n');
    console.log('━'.repeat(80));

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
