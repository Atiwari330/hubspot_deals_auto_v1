# HubSpot Deals API - Complete Integration Guide for Next.js
*Last Updated: October 2025*

## Table of Contents
1. [Overview](#overview)
2. [Authentication Setup](#authentication-setup)
3. [Environment Configuration](#environment-configuration)
4. [Core API Endpoints](#core-api-endpoints)
5. [Filtering Deals by Stage](#filtering-deals-by-stage)
6. [Working with Pipelines](#working-with-pipelines)
7. [Code Examples for Next.js](#code-examples-for-nextjs)
8. [Rate Limits & Best Practices](#rate-limits--best-practices)
9. [Error Handling](#error-handling)
10. [Common Patterns](#common-patterns)

---

## Overview

The HubSpot Deals API allows you to programmatically manage deal records in HubSpot CRM. Deals represent transactions with contacts or companies and are tracked through pipeline stages until won or lost.

### Key Capabilities
- Create, read, update, and delete deals
- Filter deals by pipeline and deal stage
- Retrieve deal properties and associations
- Access historical property values
- Search deals with complex filters

---

## Authentication Setup

### Private App Authentication

You're using **Private Apps** which provide a static access token for authentication. This is the recommended approach for single-account integrations.

#### Access Token Location
- Navigate to: **Settings → Integrations → Private Apps** in your HubSpot account
- Create a private app or access an existing one
- Copy the **Access Token** (starts with `pat-...`)

#### Required Scopes for Deals
Ensure your private app has these scopes enabled:
- `crm.objects.deals.read` - Read deals
- `crm.objects.deals.write` - Create/update deals
- `crm.schemas.deals.read` - Read deal properties
- `crm.objects.contacts.read` - Read associated contacts (if needed)
- `crm.objects.companies.read` - Read associated companies (if needed)

---

## Environment Configuration

### .env.local Setup

Create a `.env.local` file in your Next.js project root:

```env
# HubSpot Private App Credentials
HUBSPOT_ACCESS_TOKEN=pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Optional: For public apps (not applicable to your setup)
# HUBSPOT_CLIENT_ID=your-client-id
# HUBSPOT_CLIENT_SECRET=your-client-secret
```

### Security Best Practices
- **Never commit** `.env.local` to version control
- Add `.env.local` to your `.gitignore`
- Use different tokens for development, staging, and production
- Rotate tokens periodically
- Limit scopes to only what's necessary

---

## Core API Endpoints

### Base URL
```
https://api.hubapi.com
```

### Primary Deals Endpoints

#### 1. Get All Deals
```
GET /crm/v3/objects/deals
```

**Query Parameters:**
- `limit` - Number of results (max 100, default 10)
- `properties` - Comma-separated list of properties to return
- `associations` - Comma-separated list of associated objects to return
- `archived` - Include archived deals (default: false)

**Example:**
```
GET /crm/v3/objects/deals?limit=50&properties=dealname,dealstage,amount,closedate,pipeline
```

#### 2. Get a Single Deal
```
GET /crm/v3/objects/deals/{dealId}
```

**Query Parameters:**
- `properties` - Properties to return
- `propertiesWithHistory` - Properties to return with historical values
- `associations` - Associated objects to return

#### 3. Search Deals (Most Important for Your Use Case)
```
POST /crm/v3/objects/deals/search
```

This endpoint allows filtering by deal stage and other properties.

#### 4. Create a Deal
```
POST /crm/v3/objects/deals
```

#### 5. Update a Deal
```
PATCH /crm/v3/objects/deals/{dealId}
```

#### 6. Batch Operations
```
POST /crm/v3/objects/deals/batch/read
POST /crm/v3/objects/deals/batch/create
POST /crm/v3/objects/deals/batch/update
POST /crm/v3/objects/deals/batch/archive
```

---

## Filtering Deals by Stage

### Using the Search API

The **CRM Search API** is the primary way to filter deals by stage. It's available at:
```
POST /crm/v3/objects/deals/search
```

### Search Request Structure

```json
{
  "filterGroups": [
    {
      "filters": [
        {
          "propertyName": "dealstage",
          "operator": "EQ",
          "value": "appointmentscheduled"
        },
        {
          "propertyName": "pipeline",
          "operator": "EQ",
          "value": "default"
        }
      ]
    }
  ],
  "properties": [
    "dealname",
    "dealstage",
    "pipeline",
    "amount",
    "closedate",
    "hs_object_id"
  ],
  "limit": 100,
  "after": 0
}
```

### Filter Operators

| Operator | Description | Example Use Case |
|----------|-------------|------------------|
| `EQ` | Equal to | Exact match on deal stage |
| `NEQ` | Not equal to | Exclude certain stages |
| `LT` | Less than | Amount filters |
| `LTE` | Less than or equal | Date comparisons |
| `GT` | Greater than | Amount filters |
| `GTE` | Greater than or equal | Date comparisons |
| `IN` | In list | Multiple stages at once |
| `NOT_IN` | Not in list | Exclude multiple stages |
| `HAS_PROPERTY` | Has a value | Deal has amount set |
| `NOT_HAS_PROPERTY` | No value | Deal missing data |
| `CONTAINS_TOKEN` | Contains text | Search in deal name |
| `BETWEEN` | Within range | Date or amount ranges |

### Filter Logic

**AND Logic** - All conditions must be true:
```json
{
  "filters": [
    {"propertyName": "dealstage", "operator": "EQ", "value": "qualifiedtobuy"},
    {"propertyName": "amount", "operator": "GT", "value": "10000"}
  ]
}
```

**OR Logic** - Multiple filter groups:
```json
{
  "filterGroups": [
    {
      "filters": [
        {"propertyName": "dealstage", "operator": "EQ", "value": "qualifiedtobuy"}
      ]
    },
    {
      "filters": [
        {"propertyName": "dealstage", "operator": "EQ", "value": "appointmentscheduled"}
      ]
    }
  ]
}
```

### Filtering Multiple Deal Stages (Your Use Case)

To get deals in specific stages:

```json
{
  "filterGroups": [
    {
      "filters": [
        {
          "propertyName": "dealstage",
          "operator": "IN",
          "values": [
            "appointmentscheduled",
            "qualifiedtobuy",
            "presentationscheduled"
          ]
        },
        {
          "propertyName": "pipeline",
          "operator": "EQ",
          "value": "default"
        }
      ]
    }
  ],
  "properties": [
    "dealname",
    "dealstage",
    "pipeline",
    "amount",
    "closedate",
    "hubspot_owner_id",
    "hs_object_id"
  ],
  "limit": 100
}
```

### Important Notes on Deal Stages

1. **Internal IDs vs. Labels**
   - Deal stages have internal IDs (e.g., "appointmentscheduled", "closedwon")
   - For the default pipeline, IDs match the lowercase label
   - For custom pipelines, IDs are numeric strings (e.g., "258551227")
   - Always use the internal ID in API calls, not the display label

2. **Finding Deal Stage Internal IDs**
   - You can find them in your HubSpot settings: Settings → Objects → Deals → Pipelines
   - Or retrieve them via the Pipelines API (see next section)

### Default Searchable Properties for Deals

The search API automatically searches these properties when using the `query` parameter:
- `dealname`
- `pipeline`
- `dealstage`
- `description`
- `dealtype`

---

## Working with Pipelines

### Get All Pipelines

```
GET /crm/v3/pipelines/deals
```

**Response includes:**
- Pipeline ID and label
- All stages with their IDs and labels
- Stage metadata (probability, isClosed)
- Display order

**Example Response:**
```json
{
  "results": [
    {
      "label": "Sales Pipeline",
      "displayOrder": 0,
      "id": "default",
      "stages": [
        {
          "label": "Appointment Scheduled",
          "displayOrder": 0,
          "id": "appointmentscheduled",
          "metadata": {
            "isClosed": "false",
            "probability": "0.2"
          },
          "createdAt": "2021-01-01T00:00:00.000Z",
          "updatedAt": "2024-06-15T10:30:00.000Z",
          "archived": false
        },
        {
          "label": "Qualified to Buy",
          "displayOrder": 1,
          "id": "qualifiedtobuy",
          "metadata": {
            "isClosed": "false",
            "probability": "0.4"
          }
        }
      ]
    }
  ]
}
```

### Get Specific Pipeline

```
GET /crm/v3/pipelines/deals/{pipelineId}
```

### Get All Stages in a Pipeline

```
GET /crm/v3/pipelines/deals/{pipelineId}/stages
```

### Mapping Strategy

For your use case, you should:

1. **On Application Startup** - Fetch all pipelines and cache them
2. **Create a Mapping** - Map stage labels to internal IDs
3. **Use Internal IDs** - When filtering or creating deals

**Example Mapping Code:**
```javascript
const pipelineMapping = {};
const stageMapping = {};

pipelines.forEach(pipeline => {
  pipelineMapping[pipeline.label] = pipeline.id;
  stageMapping[pipeline.id] = {};
  
  pipeline.stages.forEach(stage => {
    stageMapping[pipeline.id][stage.label] = stage.id;
  });
});

// Usage
const stageId = stageMapping['default']['Appointment Scheduled'];
// Returns: "appointmentscheduled"
```

---

## Code Examples for Next.js

### 1. API Route Handler (App Router)

**File: `app/api/deals/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';

const HUBSPOT_API_BASE = 'https://api.hubapi.com';
const ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dealStages = searchParams.get('stages')?.split(',') || [];
    const pipeline = searchParams.get('pipeline') || 'default';

    // Build search request
    const searchBody = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'dealstage',
              operator: 'IN',
              values: dealStages
            },
            {
              propertyName: 'pipeline',
              operator: 'EQ',
              value: pipeline
            }
          ]
        }
      ],
      properties: [
        'dealname',
        'dealstage',
        'pipeline',
        'amount',
        'closedate',
        'hubspot_owner_id',
        'hs_object_id',
        'createdate',
        'hs_lastmodifieddate'
      ],
      limit: 100
    };

    const response = await fetch(
      `${HUBSPOT_API_BASE}/crm/v3/objects/deals/search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(searchBody)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`HubSpot API Error: ${error.message}`);
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      deals: data.results,
      total: data.total,
      paging: data.paging
    });

  } catch (error) {
    console.error('Error fetching deals:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

### 2. API Route Handler (Pages Router)

**File: `pages/api/deals.ts`**

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';

const HUBSPOT_API_BASE = 'https://api.hubapi.com';
const ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;

interface Deal {
  id: string;
  properties: {
    dealname: string;
    dealstage: string;
    amount: string;
    closedate: string;
    pipeline: string;
  };
}

interface DealsResponse {
  success: boolean;
  deals?: Deal[];
  total?: number;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DealsResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { stages, pipeline = 'default' } = req.query;
    const dealStages = typeof stages === 'string' 
      ? stages.split(',') 
      : Array.isArray(stages) 
        ? stages 
        : [];

    const searchBody = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'dealstage',
              operator: 'IN',
              values: dealStages
            },
            {
              propertyName: 'pipeline',
              operator: 'EQ',
              value: pipeline
            }
          ]
        }
      ],
      properties: [
        'dealname',
        'dealstage',
        'pipeline',
        'amount',
        'closedate',
        'hubspot_owner_id'
      ],
      limit: 100
    };

    const response = await fetch(
      `${HUBSPOT_API_BASE}/crm/v3/objects/deals/search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(searchBody)
      }
    );

    if (!response.ok) {
      throw new Error(`HubSpot API returned ${response.status}`);
    }

    const data = await response.json();

    return res.status(200).json({
      success: true,
      deals: data.results,
      total: data.total
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
```

### 3. Client-Side Fetching

**File: `components/DealsList.tsx`**

```typescript
'use client';

import { useState, useEffect } from 'react';

interface Deal {
  id: string;
  properties: {
    dealname: string;
    dealstage: string;
    amount: string;
    closedate: string;
  };
}

export default function DealsList() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDeals();
  }, []);

  const fetchDeals = async () => {
    try {
      setLoading(true);
      const stages = ['appointmentscheduled', 'qualifiedtobuy', 'presentationscheduled'];
      const response = await fetch(
        `/api/deals?stages=${stages.join(',')}&pipeline=default`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch deals');
      }

      const data = await response.json();
      setDeals(data.deals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading deals...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Open Deals ({deals.length})</h2>
      <ul>
        {deals.map(deal => (
          <li key={deal.id}>
            <strong>{deal.properties.dealname}</strong>
            <span> - Stage: {deal.properties.dealstage}</span>
            <span> - Amount: ${deal.properties.amount}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### 4. Utility Functions

**File: `lib/hubspot.ts`**

```typescript
const HUBSPOT_API_BASE = 'https://api.hubapi.com';
const ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;

interface HubSpotSearchOptions {
  stages?: string[];
  pipeline?: string;
  properties?: string[];
  limit?: number;
  after?: number;
}

export class HubSpotDealsAPI {
  private baseUrl: string;
  private accessToken: string;

  constructor(accessToken?: string) {
    this.baseUrl = HUBSPOT_API_BASE;
    this.accessToken = accessToken || ACCESS_TOKEN || '';
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`HubSpot API Error: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  async searchDeals(options: HubSpotSearchOptions) {
    const {
      stages = [],
      pipeline = 'default',
      properties = ['dealname', 'dealstage', 'pipeline', 'amount', 'closedate'],
      limit = 100,
      after = 0
    } = options;

    const filters = [];

    if (stages.length > 0) {
      filters.push({
        propertyName: 'dealstage',
        operator: stages.length === 1 ? 'EQ' : 'IN',
        ...(stages.length === 1 ? { value: stages[0] } : { values: stages })
      });
    }

    if (pipeline) {
      filters.push({
        propertyName: 'pipeline',
        operator: 'EQ',
        value: pipeline
      });
    }

    const searchBody = {
      filterGroups: filters.length > 0 ? [{ filters }] : [],
      properties,
      limit,
      after
    };

    return this.request('/crm/v3/objects/deals/search', {
      method: 'POST',
      body: JSON.stringify(searchBody)
    });
  }

  async getDeal(dealId: string, properties?: string[]) {
    const params = properties ? `?properties=${properties.join(',')}` : '';
    return this.request(`/crm/v3/objects/deals/${dealId}${params}`);
  }

  async getAllPipelines() {
    return this.request('/crm/v3/pipelines/deals');
  }

  async getPipelineStages(pipelineId: string) {
    return this.request(`/crm/v3/pipelines/deals/${pipelineId}/stages`);
  }

  async getAllDeals(properties?: string[], limit: number = 100) {
    const params = new URLSearchParams();
    if (properties) params.append('properties', properties.join(','));
    params.append('limit', limit.toString());

    return this.request(`/crm/v3/objects/deals?${params.toString()}`);
  }
}

// Usage example
export async function getOpenDeals() {
  const api = new HubSpotDealsAPI();
  
  const result = await api.searchDeals({
    stages: ['appointmentscheduled', 'qualifiedtobuy', 'presentationscheduled'],
    pipeline: 'default',
    properties: ['dealname', 'dealstage', 'amount', 'closedate', 'hubspot_owner_id']
  });

  return result.results;
}
```

### 5. Server Action (App Router)

**File: `app/actions/deals.ts`**

```typescript
'use server';

import { HubSpotDealsAPI } from '@/lib/hubspot';

export async function fetchOpenDeals(stages: string[]) {
  try {
    const api = new HubSpotDealsAPI();
    const result = await api.searchDeals({
      stages,
      pipeline: 'default',
      limit: 100
    });

    return {
      success: true,
      deals: result.results,
      total: result.total
    };
  } catch (error) {
    console.error('Error fetching deals:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      deals: [],
      total: 0
    };
  }
}
```

---

## Rate Limits & Best Practices

### Current Rate Limits (October 2025)

| Account Type | Daily Limit | Burst Limit (10 seconds) |
|--------------|-------------|--------------------------|
| Free | 250,000 | 100 requests |
| Professional | 650,000 | 190 requests |
| Enterprise | 1,000,000 | 190 requests |
| **Search API** | - | **5 requests/second** |

### Important Notes

1. **Search API has separate limits**: 5 requests per second per authentication token
2. **Rate limit headers** are included in every response:
   - `X-HubSpot-RateLimit-Daily`
   - `X-HubSpot-RateLimit-Daily-Remaining`
   - `X-HubSpot-RateLimit-Interval-Milliseconds`

### Best Practices

#### 1. Implement Rate Limiting

```typescript
class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private requestsPerSecond: number;
  private lastRequestTime = 0;

  constructor(requestsPerSecond: number = 4) {
    this.requestsPerSecond = requestsPerSecond;
  }

  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      const minInterval = 1000 / this.requestsPerSecond;

      if (timeSinceLastRequest < minInterval) {
        await new Promise(resolve => 
          setTimeout(resolve, minInterval - timeSinceLastRequest)
        );
      }

      const fn = this.queue.shift();
      if (fn) {
        this.lastRequestTime = Date.now();
        await fn();
      }
    }

    this.processing = false;
  }
}

// Usage
const limiter = new RateLimiter(4); // 4 requests per second for search API

export async function searchDealsThrottled(searchBody: any) {
  return limiter.throttle(() =>
    fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(searchBody)
    }).then(res => res.json())
  );
}
```

#### 2. Implement Exponential Backoff

```typescript
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // If rate limited, wait and retry
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter 
          ? parseInt(retryAfter) * 1000 
          : Math.pow(2, attempt) * 1000; // Exponential backoff

        console.log(`Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  throw new Error(`Failed after ${maxRetries} retries: ${lastError!.message}`);
}
```

#### 3. Cache Frequently Used Data

```typescript
// Cache pipelines and stages - they rarely change
let pipelineCache: any = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 3600000; // 1 hour

export async function getCachedPipelines() {
  const now = Date.now();

  if (pipelineCache && (now - cacheTimestamp) < CACHE_TTL) {
    return pipelineCache;
  }

  const api = new HubSpotDealsAPI();
  pipelineCache = await api.getAllPipelines();
  cacheTimestamp = now;

  return pipelineCache;
}
```

#### 4. Use Batch Endpoints When Possible

```typescript
// Instead of multiple individual requests
// BAD: Multiple requests
for (const dealId of dealIds) {
  await fetch(`/crm/v3/objects/deals/${dealId}`);
}

// GOOD: Single batch request
await fetch('/crm/v3/objects/deals/batch/read', {
  method: 'POST',
  body: JSON.stringify({
    inputs: dealIds.map(id => ({ id })),
    properties: ['dealname', 'amount', 'dealstage']
  })
});
```

#### 5. Pagination Strategy

```typescript
async function getAllDealsWithPagination(searchCriteria: any) {
  const allDeals = [];
  let after = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch('/crm/v3/objects/deals/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...searchCriteria,
        limit: 100, // Max for search API
        after
      })
    });

    const data = await response.json();
    allDeals.push(...data.results);

    // Check if there are more results
    hasMore = data.paging?.next?.after != null;
    after = data.paging?.next?.after || 0;

    // Important: Respect rate limits between pagination requests
    if (hasMore) {
      await new Promise(resolve => setTimeout(resolve, 250)); // 250ms delay
    }
  }

  return allDeals;
}
```

#### 6. Monitor Rate Limit Headers

```typescript
async function monitoredFetch(url: string, options: RequestInit) {
  const response = await fetch(url, options);

  // Log rate limit info
  const dailyLimit = response.headers.get('X-HubSpot-RateLimit-Daily');
  const dailyRemaining = response.headers.get('X-HubSpot-RateLimit-Daily-Remaining');
  const intervalRemaining = response.headers.get('X-HubSpot-RateLimit-Interval-Milliseconds');

  console.log('Rate Limit Status:', {
    dailyLimit,
    dailyRemaining,
    intervalRemaining,
    percentageUsed: dailyLimit && dailyRemaining 
      ? ((parseInt(dailyLimit) - parseInt(dailyRemaining)) / parseInt(dailyLimit) * 100).toFixed(2) + '%'
      : 'N/A'
  });

  // Alert if approaching limit
  if (dailyRemaining && parseInt(dailyRemaining) < 10000) {
    console.warn('⚠️ Approaching daily rate limit!');
  }

  return response;
}
```

---

## Error Handling

### Common Error Responses

#### 1. Rate Limit Error (429)

```json
{
  "status": "error",
  "message": "You have reached your secondly limit.",
  "errorType": "RATE_LIMIT",
  "correlationId": "c033cdaa-2c40-4a64-ae48-b4cec88dad24",
  "policyName": "TEN_SECONDLY_ROLLING",
  "requestId": "3d3e35b7-0dae-4b9f-a6e3-9c230cbcf8dd"
}
```

#### 2. Authentication Error (401)

```json
{
  "status": "error",
  "message": "This request requires authentication",
  "correlationId": "abc-123-def"
}
```

#### 3. Validation Error (400)

```json
{
  "status": "error",
  "message": "Property values were not valid",
  "correlationId": "xyz-789",
  "category": "VALIDATION_ERROR",
  "errors": [
    {
      "message": "Invalid stage ID"
    }
  ]
}
```

### Error Handling Pattern

```typescript
export async function safeHubSpotRequest<T>(
  requestFn: () => Promise<T>
): Promise<{ success: true; data: T } | { success: false; error: string; code?: string }> {
  try {
    const data = await requestFn();
    return { success: true, data };
  } catch (error) {
    if (error instanceof Response) {
      const errorData = await error.json().catch(() => ({}));
      
      switch (error.status) {
        case 401:
          return {
            success: false,
            error: 'Authentication failed. Check your access token.',
            code: 'AUTH_ERROR'
          };
        case 429:
          return {
            success: false,
            error: `Rate limit exceeded: ${errorData.message}`,
            code: 'RATE_LIMIT'
          };
        case 400:
          return {
            success: false,
            error: `Validation error: ${errorData.message}`,
            code: 'VALIDATION_ERROR'
          };
        default:
          return {
            success: false,
            error: errorData.message || 'Unknown API error',
            code: 'API_ERROR'
          };
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'UNKNOWN_ERROR'
    };
  }
}

// Usage
const result = await safeHubSpotRequest(() => api.searchDeals({ stages: ['closedwon'] }));

if (result.success) {
  console.log('Deals:', result.data);
} else {
  console.error('Error:', result.error);
  if (result.code === 'RATE_LIMIT') {
    // Handle rate limit specifically
  }
}
```

---

## Common Patterns

### Pattern 1: Get All Open Deals

```typescript
export async function getOpenDeals() {
  const api = new HubSpotDealsAPI();
  
  // Define which stages are "open" (not closed won/lost)
  const openStages = [
    'appointmentscheduled',
    'qualifiedtobuy',
    'presentationscheduled',
    'decisionmakerboughtin',
    'contractsent'
  ];

  const result = await api.searchDeals({
    stages: openStages,
    properties: [
      'dealname',
      'dealstage',
      'amount',
      'closedate',
      'hubspot_owner_id',
      'pipeline',
      'createdate'
    ],
    limit: 100
  });

  return result.results;
}
```

### Pattern 2: Get Deals by Stage with Mapping

```typescript
export async function getDealsGroupedByStage() {
  const api = new HubSpotDealsAPI();
  
  // Get pipelines to get stage labels
  const pipelines = await api.getAllPipelines();
  const defaultPipeline = pipelines.results.find(p => p.id === 'default');
  
  // Create stage ID to label mapping
  const stageMap = new Map();
  defaultPipeline?.stages.forEach(stage => {
    stageMap.set(stage.id, stage.label);
  });

  // Get all deals
  const deals = await getOpenDeals();
  
  // Group by stage
  const grouped = deals.reduce((acc, deal) => {
    const stageId = deal.properties.dealstage;
    const stageLabel = stageMap.get(stageId) || stageId;
    
    if (!acc[stageLabel]) {
      acc[stageLabel] = [];
    }
    acc[stageLabel].push(deal);
    
    return acc;
  }, {} as Record<string, any[]>);

  return grouped;
}
```

### Pattern 3: Filter by Amount Range

```typescript
export async function getHighValueDeals(minAmount: number = 10000) {
  const api = new HubSpotDealsAPI();
  
  const searchBody = {
    filterGroups: [
      {
        filters: [
          {
            propertyName: 'amount',
            operator: 'GTE',
            value: minAmount.toString()
          },
          {
            propertyName: 'dealstage',
            operator: 'NOT_IN',
            values: ['closedlost', 'closedwon']
          }
        ]
      }
    ],
    properties: ['dealname', 'amount', 'dealstage', 'closedate'],
    sorts: [
      {
        propertyName: 'amount',
        direction: 'DESCENDING'
      }
    ],
    limit: 100
  };

  const response = await fetch(
    'https://api.hubapi.com/crm/v3/objects/deals/search',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(searchBody)
    }
  );

  const data = await response.json();
  return data.results;
}
```

### Pattern 4: Get Deals with Associated Contacts

```typescript
export async function getDealsWithContacts() {
  // Note: Search API doesn't support associations parameter
  // You need to use the regular GET endpoint or make separate calls

  // Option 1: Use GET endpoint (limited filtering)
  const response = await fetch(
    'https://api.hubapi.com/crm/v3/objects/deals?limit=100&associations=contacts&properties=dealname,dealstage,amount',
    {
      headers: {
        'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`
      }
    }
  );

  const data = await response.json();
  return data.results;

  // Option 2: Search first, then get associations
  // Step 1: Search for deals
  const searchResult = await searchDeals({ stages: ['qualifiedtobuy'] });
  const dealIds = searchResult.results.map(d => d.id);

  // Step 2: Get associations in batch
  const associationsResponse = await fetch(
    'https://api.hubapi.com/crm/v3/associations/DEALS/CONTACTS/batch/read',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: dealIds.map(id => ({ id }))
      })
    }
  );

  return associationsResponse.json();
}
```

### Pattern 5: Real-time Deal Updates with Polling

```typescript
export function useDealPolling(stages: string[], intervalMs: number = 30000) {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const response = await fetch(
          `/api/deals?stages=${stages.join(',')}`
        );
        const data = await response.json();
        setDeals(data.deals);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching deals:', error);
      }
    };

    fetchDeals(); // Initial fetch
    const interval = setInterval(fetchDeals, intervalMs);

    return () => clearInterval(interval);
  }, [stages, intervalMs]);

  return { deals, loading };
}
```

---

## Additional Resources

### Official HubSpot Documentation
- [Deals API Reference](https://developers.hubspot.com/docs/api/crm/deals)
- [CRM Search API](https://developers.hubspot.com/docs/api-reference/search/guide)
- [Pipelines API](https://developers.hubspot.com/docs/api/crm/pipelines)
- [Private Apps Guide](https://developers.hubspot.com/docs/api/private-apps)
- [API Usage Guidelines](https://developers.hubspot.com/docs/developer-tooling/platform/usage-guidelines)

### Key Endpoints Summary

| Purpose | Method | Endpoint |
|---------|--------|----------|
| Search deals | POST | `/crm/v3/objects/deals/search` |
| Get all deals | GET | `/crm/v3/objects/deals` |
| Get single deal | GET | `/crm/v3/objects/deals/{dealId}` |
| Create deal | POST | `/crm/v3/objects/deals` |
| Update deal | PATCH | `/crm/v3/objects/deals/{dealId}` |
| Delete deal | DELETE | `/crm/v3/objects/deals/{dealId}` |
| Batch read | POST | `/crm/v3/objects/deals/batch/read` |
| Get pipelines | GET | `/crm/v3/pipelines/deals` |
| Get pipeline stages | GET | `/crm/v3/pipelines/deals/{pipelineId}/stages` |

### Important Limits to Remember
- Search API: **5 requests/second**
- Max results per search page: **100 deals**
- Max total search results: **10,000 deals**
- Max filters per search: **18 filters** (5 groups × 6 filters, max 18 total)
- Deal property names are **case-sensitive**
- Stage IDs must be **internal values**, not display labels

---

## Quick Start Checklist

For your specific use case (getting open deals by stage):

1. ✅ Create private app in HubSpot
2. ✅ Enable `crm.objects.deals.read` scope
3. ✅ Copy access token to `.env.local`
4. ✅ Fetch pipelines to get stage IDs
5. ✅ Use search API with stage filters
6. ✅ Implement rate limiting
7. ✅ Cache pipeline data
8. ✅ Handle pagination for >100 results
9. ✅ Monitor rate limit headers
10. ✅ Implement error handling with retry logic

---

## Example Complete Implementation

Here's a complete working example for your Next.js app:

**File: `lib/hubspot-client.ts`**

```typescript
export class HubSpotClient {
  private token: string;
  private baseUrl = 'https://api.hubapi.com';
  
  constructor(token: string) {
    this.token = token;
  }

  async searchDeals(filters: {
    stages: string[];
    pipeline?: string;
  }) {
    const response = await fetch(`${this.baseUrl}/crm/v3/objects/deals/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filterGroups: [{
          filters: [
            {
              propertyName: 'dealstage',
              operator: 'IN',
              values: filters.stages
            },
            ...(filters.pipeline ? [{
              propertyName: 'pipeline',
              operator: 'EQ' as const,
              value: filters.pipeline
            }] : [])
          ]
        }],
        properties: [
          'dealname',
          'dealstage',
          'amount',
          'closedate',
          'pipeline',
          'hubspot_owner_id'
        ],
        limit: 100
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }
}
```

**File: `app/api/deals/open/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { HubSpotClient } from '@/lib/hubspot-client';

export async function GET() {
  try {
    const client = new HubSpotClient(process.env.HUBSPOT_ACCESS_TOKEN!);
    
    const openStages = [
      'appointmentscheduled',
      'qualifiedtobuy',
      'presentationscheduled'
    ];

    const data = await client.searchDeals({
      stages: openStages,
      pipeline: 'default'
    });

    return NextResponse.json({
      success: true,
      deals: data.results,
      total: data.total
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch deals' },
      { status: 500 }
    );
  }
}
```

This guide provides everything you need to work with the HubSpot Deals API in your Next.js application!