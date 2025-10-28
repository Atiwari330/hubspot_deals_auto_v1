# HubSpot Deals Auto v1

A command-line application that fetches and displays HubSpot deals by stage using TypeScript and the HubSpot API. Built with Vercel AI SDK integration ready for future AI-powered features.

## Features

- Fetch all pipelines and deal stages from HubSpot
- Search for deals by stage names (case-insensitive, partial matching)
- Currently configured to find deals in "Proposal" and "Demo - Completed" stages
- Clean, formatted CLI output with deal details (name, amount, close date, etc.)
- TypeScript for type safety
- Ready for Vercel AI SDK agent integration

## Prerequisites

- Node.js (v16 or higher)
- HubSpot account with API access
- HubSpot Private App Access Token

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Atiwari330/hubspot_deals_auto_v1.git
cd hubspot_deals_auto_v1
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
HUBSPOT_ACCESS_TOKEN=your_hubspot_access_token_here
OPENAI_API_KEY=your_openai_api_key_here
```

## Usage

Run the CLI application to fetch deals:

```bash
npm run fetch-deals
```

This will:
1. Connect to HubSpot API
2. Fetch all available pipelines and stages
3. Find stages matching "proposal" and "demo"
4. Retrieve all deals in those stages
5. Display formatted results in the terminal

## Project Structure

```
hubspot_deals_auto_v1/
├── src/
│   ├── index.ts         # Main CLI entry point
│   ├── hubspot.ts       # HubSpot API integration
│   ├── agent.ts         # Vercel AI SDK agent (prepared for future use)
│   └── test-hubspot.ts  # Direct API testing script
├── docs/                # API documentation
├── .env                 # Environment variables (not committed)
├── package.json
├── tsconfig.json
└── README.md
```

## Scripts

- `npm run fetch-deals` - Run the CLI application
- `npm run dev` - Run in development mode
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run the built application

## Current Implementation

The application currently uses a direct HubSpot API approach for simplicity. It:

- Fetches pipelines via `GET /crm/v3/pipelines/deals`
- Searches deals via `POST /crm/v3/objects/deals/search`
- Matches stage names using case-insensitive partial matching
- Returns deals with properties: name, stage, amount, close date, created date

## Example Output

```
🚀 Starting HubSpot Deals Fetcher...

🔍 Fetching pipelines and stages...

✅ Found 11 matching stage(s) for "proposal" and "demo":

   - Demo - Scheduled (Pipeline: Sales)
   - Demo - Completed (Pipeline: Sales)
   - Proposal (Pipeline: Sales)
   ...

📋 Fetching deals in these stages...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Found 50 deal(s) in "Proposal" and "Demo - Completed" stages:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Professional Counseling Center - Software Advice
   ID: 17489507655
   Stage ID: 59865091
   Amount: $28644.8
   Close Date: 2025-12-31T20:41:37.456Z
   Created: 2/12/2024

...
```

## Future Enhancements

- [ ] Integrate Vercel AI SDK agent for intelligent queries
- [ ] Add natural language processing for deal search
- [ ] Support for multiple output formats (JSON, CSV)
- [ ] Deal filtering by amount, close date, pipeline
- [ ] Deal analytics and insights using AI
- [ ] Web UI for visual deal management

## API Documentation

See the `docs/` directory for:
- `hubspot_api_deals_docs.md` - Complete HubSpot Deals API documentation
- `vercel_ai_sdk_agent_docs.md` - Vercel AI SDK agent documentation
- `credentials_unstructured.md` - API credentials and scopes

## Contributing

This is currently a private project. Contact the repository owner for collaboration.

## License

ISC

## Author

Adi Tiwari

---

Built with Claude Code
