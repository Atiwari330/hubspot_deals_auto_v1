# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HubSpot Deals Auto v1 is a TypeScript CLI application for automated HubSpot CRM deal management. Built for a VP of Revenue Operations at an EHR software company, it focuses on:

- **Deal Fetching**: Retrieves deals from specific pipeline stages ("Proposal" and "Demo - Completed")
- **Deal Hygiene Monitoring**: Validates 13 required deal properties and calculates completeness scores
- **Quarterly Sales Forecasting**: Analyzes Proposal-stage deals closing in current quarter to forecast ARR
- **AI-Powered Reporting**: Uses OpenAI GPT-4o-mini to generate automated email reports about missing deal data and revenue forecasts

## Essential Commands

```bash
npm run fetch-deals        # Fetch and display deals from Proposal/Demo stages
npm run deal-hygiene       # Check deal data quality and generate AI email report
npm run forecast           # Generate quarterly sales forecast for Proposal-stage deals
npm run discover-properties # Explore available HubSpot deal properties
npm run build              # Compile TypeScript to dist/
npm start                  # Run compiled application
```

**Usage Notes:**
- `fetch-deals`: Displays comprehensive deal information with all 60+ properties, owner details, and financial metrics
- `deal-hygiene`: Critical tool that validates 13 required fields, scores deals (Excellent/Good/Poor), and generates professional email reports organized by owner
- `forecast`: Analyzes Proposal-stage deals closing in current quarter, calculates total forecasted ARR, and generates AI-powered email with monthly/owner breakdowns
- `discover-properties`: Utility to explore HubSpot's property schema and find internal property names for custom fields

## High-Level Architecture

### Core Modules

**hubspot.ts** - HubSpot API Client Layer (268 lines)
- All HubSpot API communication
- Key functions: `searchDealsByStages()`, `fetchOwners()`, `findStageIdsByLabels()`
- Fetches 60+ properties per deal including financial metrics, dates, engagement data
- Uses parallel fetching for owner enrichment

**index.ts** - Main Deal Fetcher CLI (188 lines)
- Entry point for `npm run fetch-deals`
- Targets "Proposal" and "Demo" stages
- Rich console output with Unicode formatting

**deal-hygiene.ts** - Data Quality Checker & AI Report Generator (433 lines)
- Entry point for `npm run deal-hygiene`
- Validates 13 required properties (defined in `types.ts`)
- Calculates completeness scores: Excellent (90-100%), Good (70-89%), Poor (<70%)
- Generates AI email reports using OpenAI `gpt-4o-mini` model
- Groups missing fields by deal owner for accountability
- Filters to "Sales" pipeline by default

**forecast.ts** - Quarterly Sales Forecast Generator (500+ lines)
- Entry point for `npm run forecast`
- Analyzes deals in "Proposal" stage from Sales pipeline
- Filters to current quarter based on close dates (Q1-Q4 auto-detection)
- Uses `amount` field as ARR (no calculation needed - already annual value)
- Generates monthly breakdown (ARR per month, deal counts, top deals)
- Generates owner breakdown (ARR per sales rep, attribution)
- Creates AI-powered email reports using OpenAI `gpt-4o-mini` model
- Skips deals missing close date or amount fields

**types.ts** - Type Definitions & Business Rules (150+ lines)
- Defines `REQUIRED_PROPERTIES`: 13 critical fields for hygiene checking
- TypeScript interfaces for hygiene reports and summaries
- TypeScript interfaces for forecast reports (`QuarterInfo`, `ForecastDeal`, `MonthlyForecast`, `OwnerForecast`, `ForecastSummary`)
- Helper: `isPropertyMissing()` - determines if a property value is considered empty

**agent.ts** - Vercel AI SDK Integration (93 lines)
- Prepared for future AI agent use (not currently active)
- Defines `searchDealsTool` for natural language queries
- Function: `queryHubSpotDeals()` for AI-powered deal search

**properties-discovery.ts** - Property Explorer (145 lines)
- Entry point for `npm run discover-properties`
- Discovers all HubSpot deal properties via API
- Filters by keywords to identify custom properties

### Data Flow

```
.env (API Keys)
    ↓
HubSpot API (hubspot.ts)
    ↓
Deal Data + Owner Data
    ↓
┌──────────────┬─────────────────┬──────────────────┬───────────────────┐
│              │                 │                  │                   │
index.ts   deal-hygiene.ts   forecast.ts      agent.ts (future)
│              │                 │                  │
Display    Validate & Score  Filter by Quarter    AI Queries
All Deals      ↓                 & Calculate ARR
           OpenAI GPT-4o-mini        ↓
               ↓               OpenAI GPT-4o-mini
           Email Report            ↓
                              Email Forecast
```

## Configuration

### Environment Variables (Required)

```
HUBSPOT_ACCESS_TOKEN=your_token_here
OPENAI_API_KEY=your_key_here
```

### HubSpot API Scopes Required

- `crm.objects.deals.read`
- `crm.objects.deals.write`
- `crm.objects.owners.read`
- `crm.schemas.deals.read`
- `crm.objects.companies.read`
- `crm.objects.contacts.read`

### 13 Required Properties for Hygiene Checking

Defined in `src/types.ts` as `REQUIRED_PROPERTIES`:
1. `amount` - Deal value
2. `closedate` - Close date
3. `hs_tcv` - Total Contract Value
4. `hs_arr` - Annual Recurring Revenue
5. `hs_mrr` - Monthly Recurring Revenue
6. `hs_acv` - Annual Contract Value
7. `num_contacted_notes` - Contact notes count
8. `product_s` - Product selection
9. `deal_type` - Type of deal
10. `prior_ehr` - Prior EHR system
11. `patient_volume` - Patient volume
12. `proposal_stage` - Proposal stage
13. `demo_date` - Demo date

## Important Patterns & Conventions

### Stage-Based Deal Filtering

- Uses case-insensitive partial matching: `stageLabel.toLowerCase().includes(targetStage.toLowerCase())`
- Default target stages: "proposal" and "demo"
- `deal-hygiene.ts` filters to "Sales" pipeline only to avoid duplicate deals

### Property Fetching Strategy

- Requests 60+ properties per deal in a single API call via `searchDealsByStages()`
- Includes: financial metrics, dates, owner info, engagement metrics, custom fields
- Owner data enriched via parallel `Promise.all()` calls in `hubspot.ts:239`

### AI Email Generation

- Model: `gpt-4.5-mini` via OpenAI API
- Prompt engineering in `deal-hygiene.ts:generateEmailReport()` (lines 90-179)
- Strict formatting: plain text, no markdown, organized by owner
- AI generates professional tone with specific instructions for revenue ops context

### Hygiene Scoring Logic

```typescript
completeness = (filledProperties / totalRequired) * 100
- Excellent: 90-100%
- Good: 70-89%
- Poor: <70%
- Critical: Missing 3+ properties
```

### Forecasting Logic

**Quarter Detection:**
```typescript
Q1: January 1 - March 31
Q2: April 1 - June 30
Q3: July 1 - September 30
Q4: October 1 - December 31
```

**Filtering Rules:**
- Stage: "Proposal" only (case-insensitive)
- Pipeline: "Sales" only (to avoid duplicates)
- Close Date: Must exist AND fall within current quarter
- Amount: Must exist (represents ARR already - no calculation needed)

**Important:** The `amount` field in HubSpot already contains ARR (Annual Recurring Revenue). No multiplication is needed.

**Skipped Deals:**
- Deals missing `closedate` are skipped entirely
- Deals missing `amount` are skipped entirely
- Deals with close dates outside current quarter are filtered out (not counted as skipped)

**Breakdown Calculations:**
- **Monthly Breakdown:** Groups deals by month of close date, sums ARR per month
- **Owner Breakdown:** Groups deals by owner, sums ARR per owner
- **Average Deal Size:** Total ARR ÷ Total Deals in forecast

### TypeScript Configuration

- ES Modules (`type: "module"` in package.json)
- Strict mode enabled
- Target: ES2020, Module: ESNext
- Runtime: `tsx` for development, compiled to `dist/` for production

## Common Extension Points

### Add New Required Property for Hygiene

1. Update `REQUIRED_PROPERTIES` array in `src/types.ts:8`
2. Ensure property is included in `searchBody.properties` in `hubspot.ts:192` (if not already)
3. Hygiene checker will automatically validate the new property

### Change Target Pipeline Stages

**For fetch-deals:**
- Modify `targetStages` array in `src/index.ts:23`

**For deal-hygiene:**
- Modify `targetStages` array in `src/deal-hygiene.ts:16`
- To change pipeline filter, update `pipelineFilter` at `src/deal-hygiene.ts:34`

**For forecast:**
- Modify `TARGET_STAGE` constant in `src/forecast.ts:18` (currently "proposal")
- Quarter is auto-detected; to override, modify `getCurrentQuarter()` function

### Add More Properties to Fetch

Edit `searchBody.properties` array in `src/hubspot.ts:192-265` to include additional property internal names. Use `npm run discover-properties` to find internal names for custom fields.

### Customize AI Email Reports

**For hygiene reports:**
Modify the prompt in `src/deal-hygiene.ts:generateEmailReport()` (lines 90-179). Key sections:
- Tone and style instructions
- Formatting requirements (plain text vs markdown)
- Deal organization strategy (by owner, by completeness, etc.)
- Email structure (greeting, body, call-to-action)

**For forecast reports:**
Modify the prompt in `src/forecast.ts:generateForecastEmail()`. Key sections:
- Executive summary format
- Monthly breakdown presentation
- Owner breakdown attribution
- Confidence language (forecast vs guaranteed)
- Call-to-action and next steps

### Filter by Different Pipeline

Add pipeline filtering logic before processing deals:
```typescript
const salesDeals = allDeals.filter(deal =>
  deal.properties.pipeline === 'desired_pipeline_id'
);
```

Or modify the existing filter in `deal-hygiene.ts:34-36`.

## Testing & Debugging

- **Test API connectivity**: Use `src/test-hubspot.ts` (not in package.json scripts, run with `npx tsx src/test-hubspot.ts`)
- **Explore properties**: `npm run discover-properties` to see all available fields
- **Check console output**: All errors logged with emoji prefixes (🚨, ⚠️, ℹ️)
- **Verify environment**: Ensure `.env` has valid tokens before running

## GitHub Actions Automation

The project includes two automated workflows:

**1. Daily Deal Hygiene Check** (`.github/workflows/daily-deal-hygiene.yml`)
- Runs twice daily: 8:00 AM EDT and 1:28 PM EDT
- Executes `npm run deal-hygiene`
- Uploads console output as artifacts

**2. Weekly Sales Forecast** (`.github/workflows/quarterly-forecast.yml`)
- Runs weekly on Mondays at 9:00 AM EDT
- Executes `npm run forecast`
- Generates current quarter revenue projections

Both workflows use GitHub secrets for API keys and support manual triggering via `workflow_dispatch`.

## Notes

- The `agent.ts` module is prepared for future Vercel AI SDK integration but not currently used in main workflows
- Property display names are hardcoded mappings in display functions (not fetched from HubSpot metadata)
- Deal owner information requires separate API calls, handled efficiently with parallel fetching
- OpenAI API key is required for both `deal-hygiene` and `forecast` commands
- All AI reports use the `gpt-4o-mini` model for cost-effective, high-quality text generation
- Forecast assumes the `amount` field already contains ARR - no multiplication or conversion is performed
