# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HubSpot Deals Auto v1 is a TypeScript CLI application for automated HubSpot CRM deal management. Built for a VP of Revenue Operations at an EHR software company, it focuses on:

- **Deal Fetching**: Retrieves deals from specific pipeline stages ("Proposal" and "Demo - Completed")
- **Deal Hygiene Monitoring**: Validates 13 required deal properties and calculates completeness scores
- **AI-Powered Reporting**: Uses OpenAI GPT-4.5-mini to generate automated email reports about missing deal data

## Essential Commands

```bash
npm run fetch-deals        # Fetch and display deals from Proposal/Demo stages
npm run deal-hygiene       # Check deal data quality and generate AI email report
npm run discover-properties # Explore available HubSpot deal properties
npm run build              # Compile TypeScript to dist/
npm start                  # Run compiled application
```

**Usage Notes:**
- `fetch-deals`: Displays comprehensive deal information with all 60+ properties, owner details, and financial metrics
- `deal-hygiene`: Critical tool that validates 13 required fields, scores deals (Excellent/Good/Poor), and generates professional email reports organized by owner
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
- Generates AI email reports using OpenAI `gpt-4.5-mini` model
- Groups missing fields by deal owner for accountability
- Filters to "Sales" pipeline by default

**types.ts** - Type Definitions & Business Rules (101 lines)
- Defines `REQUIRED_PROPERTIES`: 13 critical fields for hygiene checking
- TypeScript interfaces for reports and summaries
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
┌──────────────┬─────────────────┐
│              │                 │
index.ts   deal-hygiene.ts   agent.ts (future)
│              │                 │
Display    Validate & Score      AI Queries
All Deals      ↓
           OpenAI GPT-4.5-mini
               ↓
           Email Report
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

### Add More Properties to Fetch

Edit `searchBody.properties` array in `src/hubspot.ts:192-265` to include additional property internal names. Use `npm run discover-properties` to find internal names for custom fields.

### Customize AI Email Reports

Modify the prompt in `src/deal-hygiene.ts:generateEmailReport()` (lines 90-179). Key sections:
- Tone and style instructions
- Formatting requirements (plain text vs markdown)
- Deal organization strategy (by owner, by completeness, etc.)
- Email structure (greeting, body, call-to-action)

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

## Notes

- The `agent.ts` module is prepared for future Vercel AI SDK integration but not currently used in main workflows
- Property display names are hardcoded mappings in display functions (not fetched from HubSpot metadata)
- Deal owner information requires separate API calls, handled efficiently with parallel fetching
- OpenAI API key only required for `deal-hygiene` command
