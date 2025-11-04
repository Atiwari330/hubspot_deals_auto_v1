import 'dotenv/config';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { fetchPipelines, searchDealsByStages, findStageIdsByLabels, fetchOwners } from './hubspot.js';
import {
  REQUIRED_PROPERTIES,
  isPropertyMissing,
  DealHygieneReport,
  HygieneSummary,
  PropertyCheck,
} from './types.js';
import { createGoogleDoc } from './lib/google-drive.js';
import { insertTextToDoc } from './lib/google-docs.js';

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

  // Parse and check close date
  const closeDate = props.closedate ? new Date(props.closedate) : null;
  const closeDateString = closeDate
    ? closeDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : null;
  const now = new Date();
  const isCloseDatePastDue = closeDate ? closeDate < now : false;

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
    closeDate: closeDate,
    closeDateString: closeDateString,
    isCloseDatePastDue: isCloseDatePastDue,
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

  // Identify deals with any issues (missing 1+ properties)
  const dealsWithIssues = reports.filter(r => r.totalMissing >= 1);

  // Identify deals with past-due close dates
  const dealsWithPastDueCloseDates = reports.filter(r => r.isCloseDatePastDue);
  const pastDueCount = dealsWithPastDueCloseDates.length;

  return {
    totalDeals: reports.length,
    averageCompleteness: averageCompleteness,
    propertyMissingCounts: propertyMissingCounts,
    dealsByCompleteness: {
      excellent: excellent,
      good: good,
      poor: poor,
    },
    dealsWithIssues: dealsWithIssues,
    dealsWithPastDueCloseDates: dealsWithPastDueCloseDates,
    pastDueCount: pastDueCount,
  };
}

/**
 * Formats and generates the hygiene report as text (returns as string array)
 * This replaces console.log with string building for Google Docs output
 */
function generateReportText(summary: HygieneSummary): string[] {
  const lines: string[] = [];

  lines.push('━'.repeat(80));
  lines.push('DEAL HYGIENE REPORT - SALES PIPELINE ONLY');
  lines.push('━'.repeat(80));
  lines.push('');

  lines.push(`📊 Analyzed: ${summary.totalDeals} deal(s) in Sales pipeline ("Proposal" and "Demo - Completed" stages)`);
  lines.push(`📈 Overall Health: ${summary.averageCompleteness}% complete (average)`);
  if (summary.pastDueCount > 0) {
    lines.push(`🚨 Past-Due Close Dates: ${summary.pastDueCount} deal(s) with close date in the past`);
  }
  lines.push('');

  // Deals with issues section
  if (summary.dealsWithIssues.length > 0) {
    lines.push('━'.repeat(80));
    lines.push(`🚨 DEALS WITH ISSUES (${summary.dealsWithIssues.length} deals missing 1+ required properties):`);
    lines.push('');

    summary.dealsWithIssues.forEach((deal, index) => {
      lines.push(`${index + 1}. Deal: "${deal.dealName}" [ID: ${deal.dealId}]`);
      lines.push(`   📊 Pipeline: ${deal.dealPipelineName}`);
      lines.push(`   🎯 Stage: ${deal.dealStageName}`);
      if (deal.dealOwnerName) {
        lines.push(`   👤 Owner: ${deal.dealOwnerName}`);
      }
      lines.push(`   ❌ Missing: ${deal.missingProperties.map(mp => mp.label).join(', ')}`);
      if (deal.isCloseDatePastDue && deal.closeDateString) {
        lines.push(`   🚨 Close Date Past Due: ${deal.closeDateString}`);
      }
      lines.push(`   📉 Completeness: ${deal.completenessScore}% (${deal.totalPresent}/${deal.totalRequired} properties)`);
      lines.push('');
    });
  } else {
    lines.push('━'.repeat(80));
    lines.push('✅ NO ISSUES - All deals have complete required properties');
    lines.push('');
  }

  // Summary by missing property
  lines.push('━'.repeat(80));
  lines.push('📋 SUMMARY BY PROPERTY:');
  lines.push('');

  // Sort properties by missing count (most missing first)
  const sortedProperties = Array.from(summary.propertyMissingCounts.entries())
    .sort((a, b) => b[1].missingCount - a[1].missingCount);

  sortedProperties.forEach(([propertyName, data]) => {
    const icon = data.missingCount === 0 ? '✅' : '❌';
    const status = data.missingCount === 0 ? 'Complete' : `${data.missingCount} deals missing`;
    lines.push(`   ${icon} ${data.label}: ${status} (${data.percentage}%)`);
  });

  // Deals by completeness
  lines.push('');
  lines.push('━'.repeat(80));
  lines.push('📊 DEALS BY COMPLETENESS:');
  lines.push('');
  lines.push(`   🟢 90-100% Complete: ${summary.dealsByCompleteness.excellent.length} deal(s)`);
  lines.push(`   🟡 70-89% Complete: ${summary.dealsByCompleteness.good.length} deal(s)`);
  lines.push(`   🔴 Below 70%: ${summary.dealsByCompleteness.poor.length} deal(s)`);

  // Show poor performers in detail
  if (summary.dealsByCompleteness.poor.length > 0) {
    lines.push('');
    lines.push('   🔴 Deals Below 70% Completeness:');
    lines.push('');
    summary.dealsByCompleteness.poor.forEach(deal => {
      lines.push(`      • "${deal.dealName}" - ${deal.completenessScore}% (Missing: ${deal.missingProperties.map(mp => mp.label).join(', ')})`);
    });
  }

  // Show deals with past-due close dates
  if (summary.pastDueCount > 0) {
    lines.push('');
    lines.push('━'.repeat(80));
    lines.push(`🚨 DEALS WITH PAST-DUE CLOSE DATES (${summary.pastDueCount} deal(s)):`);
    lines.push('');

    summary.dealsWithPastDueCloseDates.forEach((deal, index) => {
      const missingInfo = deal.totalMissing > 0
        ? ` | Missing ${deal.totalMissing} field(s)`
        : ' | All fields complete';
      lines.push(`   ${index + 1}. "${deal.dealName}" [ID: ${deal.dealId}]`);
      lines.push(`      Close Date: ${deal.closeDateString} (PAST DUE)`);
      lines.push(`      Owner: ${deal.dealOwnerName || 'Unassigned'} | Stage: ${deal.dealStageName}${missingInfo}`);
      lines.push('');
    });
  }

  lines.push('━'.repeat(80));
  lines.push('💡 RECOMMENDATIONS:');
  lines.push('');

  // Provide actionable recommendations
  const topMissingProperty = sortedProperties[0];
  if (topMissingProperty && topMissingProperty[1].missingCount > 0) {
    lines.push(`   1. Priority: Update "${topMissingProperty[1].label}" - missing from ${topMissingProperty[1].missingCount} deal(s)`);
  }

  if (summary.dealsWithIssues.length > 0) {
    lines.push(`   2. Focus on ${summary.dealsWithIssues.length} deal(s) with missing properties`);
  }

  if (summary.dealsByCompleteness.poor.length > 0) {
    lines.push(`   3. Review ${summary.dealsByCompleteness.poor.length} deal(s) below 70% completeness`);
  }

  lines.push('');

  return lines;
}

/**
 * Generates an AI-powered email report for the team
 */
async function generateEmailReport(
  summary: HygieneSummary,
  reports: DealHygieneReport[]
): Promise<string> {
  // Organize deals with issues by owner for better accountability
  // Include deals with missing fields OR past-due close dates
  const dealsByOwner = new Map<string, DealHygieneReport[]>();

  // Combine both types of issues into a single set (avoiding duplicates)
  const dealsToReport = new Set<DealHygieneReport>();
  summary.dealsWithIssues.forEach(deal => dealsToReport.add(deal));
  summary.dealsWithPastDueCloseDates.forEach(deal => dealsToReport.add(deal));

  dealsToReport.forEach(deal => {
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
    dealsWithIssuesCount: summary.dealsWithIssues.length,
    pastDueCount: summary.pastDueCount,
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
        isCloseDatePastDue: deal.isCloseDatePastDue,
        closeDateString: deal.closeDateString,
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
      model: openai('gpt-4o-mini'),
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
Deals with issues: ${dataForAI.dealsWithIssuesCount} deals missing 1+ required fields
Deals with past-due close dates: ${dataForAI.pastDueCount} deal(s)

Deals by owner (includes ALL deals with missing fields OR past-due close dates):
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
- Include total deals, pipeline name, overall health percentage, and number of deals with missing fields
- MUST also mention if there are any deals with past-due close dates (${dataForAI.pastDueCount} deals)

BODY - DEALS BY OWNER:
- Organize by owner name
- YOU MUST LIST EVERY SINGLE DEAL - Do NOT summarize, truncate, or use phrases like "other deals" or "listed similarly"
- For each deal show: deal name (with Deal ID if available) and specific missing fields
- CRITICAL: For EVERY deal where isCloseDatePastDue is true, you MUST show a separate line immediately after the missing fields line:
  "  - Close Date Past Due: [closeDateString]"
- This is NOT optional - if a deal has isCloseDatePastDue: true, you MUST include the "Close Date Past Due" line
- Even if a deal has NO missing fields, if isCloseDatePastDue is true, you MUST still list that deal under its owner with the past-due close date
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

Quick health check: We reviewed 25 Sales-pipeline deals (Proposal and Demo stages). Overall completeness is 82%, and there are 7 deals missing required fields. 3 deals have past-due close dates.

Owner: Christopher Garraffa
- Alpine Springs Addiction Treatment - Robert's Referral (Deal ID: 36660836688)
  - Missing fields: Deal Collaborator, Next Activity Date (EDT), Next Step
  - Close Date Past Due: Oct 15, 2024

Owner: Humberto Buniotto
- Luna (Zinnia) - Robert's Referral (Deal ID: 38678781552)
  - Missing fields: Deal Collaborator, Next Activity Date (EDT), Prior EHR
- Wellness Center XYZ (Deal ID: 38888888888)
  - Missing fields: None
  - Close Date Past Due: Sep 30, 2024

Most commonly missing fields
- Deal Collaborator: missing in 18 deals (72%)
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
 * Uploads report to Google Drive
 */
async function uploadToGoogleDrive(reportLines: string[], emailReport: string): Promise<void> {
  console.log('📤 Uploading report to Google Drive...\n');

  try {
    // Validate environment variable
    if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
      throw new Error('GOOGLE_DRIVE_FOLDER_ID environment variable is required');
    }

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    // Create document name with date: "Deal Hygiene - YYYY-MM-DD"
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    const docName = `Deal Hygiene - ${dateStr}`;

    console.log(`📝 Creating Google Doc: "${docName}"`);

    // Create the Google Doc
    const doc = await createGoogleDoc(docName, folderId);

    if (!doc.id) {
      throw new Error('Failed to create Google Doc - no document ID returned');
    }

    console.log(`✅ Document created with ID: ${doc.id}`);
    console.log(`🔗 View at: ${doc.webViewLink}\n`);

    // Prepare content to insert
    const content: string[] = [
      '═'.repeat(80),
      'DEAL HYGIENE REPORT',
      `Generated: ${today.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        dateStyle: 'full',
        timeStyle: 'long'
      })}`,
      '═'.repeat(80),
      '',
      '━'.repeat(80),
      'SECTION 1: DETAILED HYGIENE ANALYSIS',
      '━'.repeat(80),
      '',
      ...reportLines,
      '',
      '━'.repeat(80),
      'SECTION 2: AI-GENERATED EMAIL REPORT',
      '━'.repeat(80),
      '',
      emailReport,
      '',
      '━'.repeat(80),
      'END OF REPORT',
      '━'.repeat(80),
    ];

    console.log('📝 Inserting content into document...');

    // Insert all content
    await insertTextToDoc(doc.id, content);

    console.log('✅ Content inserted successfully!\n');
    console.log('━'.repeat(80));
    console.log('✨ GOOGLE DRIVE UPLOAD COMPLETE');
    console.log('━'.repeat(80));
    console.log(`📄 Document: ${docName}`);
    console.log(`🔗 URL: ${doc.webViewLink}`);
    console.log('━'.repeat(80));
    console.log('');

  } catch (error) {
    console.error('\n' + '━'.repeat(80));
    console.error('❌ ERROR UPLOADING TO GOOGLE DRIVE');
    console.error('━'.repeat(80));

    if (error instanceof Error) {
      console.error('\n📋 Basic Error Info:');
      console.error('   Error Type:', error.name);
      console.error('   Error Message:', error.message);

      // Check if this is a Google API (Gaxios) error with response details
      if ('response' in error) {
        const gaxiosError = error as any;

        console.error('\n🌐 HTTP Response Details:');
        console.error('   Status Code:', gaxiosError.response?.status || 'N/A');
        console.error('   Status Text:', gaxiosError.response?.statusText || 'N/A');

        if (gaxiosError.response?.data) {
          console.error('\n📦 Full Error Response Data:');
          console.error(JSON.stringify(gaxiosError.response.data, null, 2));
        }

        if (gaxiosError.config) {
          console.error('\n🔧 Request Configuration:');
          console.error('   Method:', gaxiosError.config.method || 'N/A');
          console.error('   URL:', gaxiosError.config.url || 'N/A');
        }
      }

      console.error('\n📚 Stack Trace:');
      console.error(error.stack);
    } else {
      console.error('\n⚠️ Unknown error type:', error);
    }

    console.error('\n' + '━'.repeat(80));
    console.error('ℹ️  The CLI report is still available above.');
    console.error('━'.repeat(80));
    console.error('');
    // Don't exit - we still want to show the CLI output
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting HubSpot Deal Hygiene Checker with Google Drive Integration...\n');

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

    // Generate report text (instead of displaying directly)
    const reportLines = generateReportText(summary);

    // Display to console
    console.log('\n' + reportLines.join('\n'));
    console.log('\n✨ CLI Report Complete!\n');

    // Generate AI-powered email report
    const emailReport = await generateEmailReport(summary, reports);

    // Display email to console
    console.log('━'.repeat(80));
    console.log('📧 EMAIL REPORT (Copy & Paste Below)');
    console.log('━'.repeat(80));
    console.log('\n' + emailReport + '\n');
    console.log('━'.repeat(80));
    console.log('');

    // Upload to Google Drive
    await uploadToGoogleDrive(reportLines, emailReport);

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
