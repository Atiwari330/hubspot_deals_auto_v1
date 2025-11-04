# Google Drive & Docs API Integration Guide for Next.js TypeScript
## November 2025 - Complete Implementation Documentation

## Table of Contents
1. [Overview](#overview)
2. [Authentication Strategies](#authentication-strategies)
3. [Google Cloud Setup](#google-cloud-setup)
4. [Package Installation & Setup](#package-installation--setup)
5. [Service Account Authentication](#service-account-authentication)
6. [Google Drive API Integration](#google-drive-api-integration)
7. [Google Docs API Integration](#google-docs-api-integration)
8. [GitHub Actions Integration](#github-actions-integration)
9. [Complete Implementation Examples](#complete-implementation-examples)
10. [Best Practices & Security](#best-practices--security)

---

## Overview

This guide provides up-to-date (November 2025) instructions for integrating Google Drive and Google Docs APIs into a Next.js TypeScript application that runs via GitHub Actions. The primary goal is to automatically create Google Docs in a specific Drive folder when your application runs.

### Use Case
- Next.js TypeScript application using AI Vercel SDK and HubSpot API
- Runs daily via GitHub Actions
- Outputs results to a Google Doc in a specific folder
- No user interaction required (server-to-server authentication)

---

## Authentication Strategies

For GitHub Actions automation, you have two primary authentication options:

### Option 1: Service Account Key JSON (Simpler, Works Immediately)
**Pros:**
- Simple to set up and use
- Works immediately with no additional Google Cloud configuration
- Long-lived credentials (rotate as needed)
- Perfect for getting started quickly

**Cons:**
- Requires secure storage of JSON key file
- Key must be managed and rotated
- If key is compromised, it must be manually revoked

**Best For:** Rapid development, smaller projects, proof of concepts

### Option 2: Workload Identity Federation (Recommended for Production)
**Pros:**
- No long-lived credentials to manage
- Uses OIDC tokens from GitHub Actions
- More secure (short-lived tokens)
- Eliminates credential rotation burden
- Google's recommended approach for production

**Cons:**
- More complex initial setup
- Requires configuring Workload Identity Pool and Provider
- Tokens expire in ~1 hour (acceptable for most CI/CD)

**Best For:** Production applications, security-conscious projects, enterprise use

---

## Google Cloud Setup

### Step 1: Create a Google Cloud Project

1. Navigate to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing project
3. Note your Project ID

### Step 2: Enable Required APIs

Enable these APIs in your project:
- **Google Drive API** - For file and folder management
- **Google Docs API** - For creating and editing documents

```bash
# Using gcloud CLI (optional)
gcloud services enable drive.googleapis.com
gcloud services enable docs.googleapis.com
```

### Step 3A: Create Service Account (Service Account Auth Path)

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **Service Account**
3. Fill in details:
   - Name: `github-actions-drive-bot` (or your preference)
   - Description: "Service account for automated Google Drive uploads"
4. Click **Create and Continue**
5. Grant roles (select appropriate roles):
   - For basic usage: No role needed if you'll share folders directly
   - For org-wide access: Consider custom roles
6. Click **Done**
7. Click on the created service account
8. Go to **Keys** tab
9. Click **Add Key** → **Create new key**
10. Select **JSON** format
11. Download and securely store the key file
12. **CRITICAL:** The service account email looks like: `github-actions-drive-bot@your-project.iam.gserviceaccount.com`

### Step 3B: Set Up Workload Identity Federation (WIF Auth Path)

For production deployments using GitHub Actions:

1. Enable required APIs:
```bash
gcloud services enable iam.googleapis.com
gcloud services enable cloudresourcemanager.googleapis.com
gcloud services enable iamcredentials.googleapis.com
gcloud services enable sts.googleapis.com
```

2. Create Workload Identity Pool:
```bash
gcloud iam workload-identity-pools create "github-pool" \
  --location="global" \
  --display-name="GitHub Actions Pool" \
  --description="Identity pool for GitHub Actions"
```

3. Create Workload Identity Provider:
```bash
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"
```

4. Create Service Account:
```bash
gcloud iam service-accounts create github-actions-drive \
  --display-name="GitHub Actions Drive Bot"
```

5. Grant service account permissions to impersonate:
```bash
# Get your project number
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")

# Allow GitHub repo to impersonate service account
# Replace YOUR_GITHUB_ORG and YOUR_REPO_NAME
gcloud iam service-accounts add-iam-policy-binding \
  github-actions-drive@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/YOUR_GITHUB_ORG/YOUR_REPO_NAME"
```

6. Get the Workload Identity Provider resource name:
```bash
gcloud iam workload-identity-pools providers describe "github-provider" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="value(name)"
```

This returns something like:
```
projects/123456789/locations/global/workloadIdentityPools/github-pool/providers/github-provider
```

### Step 4: Share Google Drive Folder with Service Account

**CRITICAL STEP:**

1. Go to Google Drive
2. Create a folder where documents will be uploaded (or use existing)
3. Right-click the folder → **Share**
4. Add the service account email address (e.g., `github-actions-drive-bot@your-project.iam.gserviceaccount.com`)
5. Grant **Editor** permissions
6. Click **Share**
7. Note the folder ID from the URL (e.g., in `https://drive.google.com/drive/folders/FOLDER_ID`, copy `FOLDER_ID`)

**Important:** Without this sharing step, the service account cannot access the folder, even with Drive API enabled.

---

## Package Installation & Setup

### Install Dependencies

```bash
npm install googleapis
# or
yarn add googleapis
```

Latest version (as of November 2025): `googleapis@140+`

### TypeScript Types

The `googleapis` package includes TypeScript definitions out of the box. No additional `@types` packages needed.

### Environment Variables

Create a `.env.local` file (Next.js convention):

```env
# Service Account Authentication
GOOGLE_SERVICE_ACCOUNT_EMAIL="your-service-account@project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nPrivate\nKey\nHere\n-----END PRIVATE KEY-----\n"
GOOGLE_PROJECT_ID="your-project-id"

# Google Drive Configuration
GOOGLE_DRIVE_FOLDER_ID="your-folder-id-from-url"

# Optional: For Workload Identity Federation
GOOGLE_WORKLOAD_IDENTITY_PROVIDER="projects/123/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
```

### GitHub Secrets Setup

For GitHub Actions, add these secrets to your repository:

**For Service Account Auth:**
1. Go to repo **Settings** → **Secrets and variables** → **Actions**
2. Add secrets:
   - `GOOGLE_CREDENTIALS`: The entire service account JSON (minified to one line)
   - `GOOGLE_DRIVE_FOLDER_ID`: Your target folder ID

**For Workload Identity Federation:**
- `GOOGLE_PROJECT_ID`: Your Google Cloud project ID
- `GOOGLE_WORKLOAD_IDENTITY_PROVIDER`: Your WIF provider name
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Service account email
- `GOOGLE_DRIVE_FOLDER_ID`: Your target folder ID

**Tip:** To minify JSON for GitHub secrets:
```bash
cat service-account-key.json | jq -c
```

---

## Service Account Authentication

### Create Authentication Helper (Recommended Approach)

Create `lib/google-auth.ts`:

```typescript
import { google } from 'googleapis';
import type { Auth } from 'googleapis';

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  project_id?: string;
}

/**
 * Creates authenticated Google API client using service account
 * 
 * @param scopes - Array of required OAuth scopes
 * @returns Authenticated GoogleAuth client
 */
export async function getGoogleAuthClient(
  scopes: string[]
): Promise<Auth.GoogleAuth> {
  // Load credentials from environment variables
  const credentials: ServiceAccountCredentials = {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
    private_key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    project_id: process.env.GOOGLE_PROJECT_ID,
  };

  // Validate credentials
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error(
      'Missing Google service account credentials. Check GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY environment variables.'
    );
  }

  // Create auth client
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes,
  });

  return auth;
}

/**
 * Alternative: Load credentials from JSON file (local development)
 */
export async function getGoogleAuthClientFromFile(
  keyFilePath: string,
  scopes: string[]
): Promise<Auth.GoogleAuth> {
  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes,
  });

  return auth;
}

/**
 * Alternative: Load credentials from complete JSON in env (GitHub Actions pattern)
 */
export async function getGoogleAuthClientFromJSON(
  scopes: string[]
): Promise<Auth.GoogleAuth> {
  if (!process.env.GOOGLE_CREDENTIALS) {
    throw new Error('GOOGLE_CREDENTIALS environment variable not set');
  }

  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes,
  });

  return auth;
}
```

### Required OAuth Scopes

```typescript
// For Google Drive file operations
export const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file', // Access to files created by the app
  // OR for broader access:
  // 'https://www.googleapis.com/auth/drive', // Full Drive access
];

// For Google Docs operations
export const DOCS_SCOPES = [
  'https://www.googleapis.com/auth/documents', // Read/write Google Docs
];

// Combined for both operations
export const COMBINED_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
];
```

**Important Scope Notes:**
- `drive.file`: Only access files created by your app (more restrictive, more secure)
- `drive`: Full access to all Drive files (needed if you want to access pre-existing folders not created by your app)
- For your use case with a pre-shared folder, use `drive` or `drive.file` if the folder was created by the same app

---

## Google Drive API Integration

### Initialize Drive API Client

Create `lib/google-drive.ts`:

```typescript
import { google } from 'googleapis';
import type { drive_v3 } from 'googleapis';
import { getGoogleAuthClient, DRIVE_SCOPES } from './google-auth';

/**
 * Creates and returns authenticated Google Drive API client
 */
export async function getDriveClient(): Promise<drive_v3.Drive> {
  const auth = await getGoogleAuthClient(DRIVE_SCOPES);
  const drive = google.drive({ version: 'v3', auth });
  return drive;
}

/**
 * Upload a file to Google Drive
 * 
 * @param fileName - Name of the file to create
 * @param mimeType - MIME type of the file
 * @param content - File content (string or Buffer)
 * @param folderId - Parent folder ID (optional)
 * @returns Created file metadata
 */
export async function uploadFileToDrive(
  fileName: string,
  mimeType: string,
  content: string | Buffer,
  folderId?: string
): Promise<drive_v3.Schema$File> {
  const drive = await getDriveClient();

  const fileMetadata: drive_v3.Schema$File = {
    name: fileName,
    ...(folderId && { parents: [folderId] }),
  };

  const media = {
    mimeType,
    body: typeof content === 'string' ? content : content,
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id, name, webViewLink, createdTime',
  });

  return response.data;
}

/**
 * Create a Google Doc file (empty) in Drive
 * 
 * @param fileName - Name of the document
 * @param folderId - Parent folder ID (optional)
 * @returns Created document metadata
 */
export async function createGoogleDoc(
  fileName: string,
  folderId?: string
): Promise<drive_v3.Schema$File> {
  const drive = await getDriveClient();

  const fileMetadata: drive_v3.Schema$File = {
    name: fileName,
    mimeType: 'application/vnd.google-apps.document',
    ...(folderId && { parents: [folderId] }),
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    fields: 'id, name, webViewLink, createdTime',
  });

  return response.data;
}

/**
 * Upload and convert HTML to Google Doc
 * 
 * @param fileName - Name of the document
 * @param htmlContent - HTML content to convert
 * @param folderId - Parent folder ID (optional)
 * @returns Created document metadata
 */
export async function uploadHTMLAsGoogleDoc(
  fileName: string,
  htmlContent: string,
  folderId?: string
): Promise<drive_v3.Schema$File> {
  const drive = await getDriveClient();

  const fileMetadata: drive_v3.Schema$File = {
    name: fileName,
    mimeType: 'application/vnd.google-apps.document',
    ...(folderId && { parents: [folderId] }),
  };

  const media = {
    mimeType: 'text/html',
    body: htmlContent,
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id, name, webViewLink, createdTime',
  });

  return response.data;
}

/**
 * Upload a PDF file to Drive
 */
export async function uploadPDFToDrive(
  fileName: string,
  pdfBuffer: Buffer,
  folderId?: string
): Promise<drive_v3.Schema$File> {
  return uploadFileToDrive(fileName, 'application/pdf', pdfBuffer, folderId);
}
```

### File MIME Types Reference

```typescript
export const MIME_TYPES = {
  // Google Workspace types
  GOOGLE_DOC: 'application/vnd.google-apps.document',
  GOOGLE_SHEET: 'application/vnd.google-apps.spreadsheet',
  GOOGLE_SLIDES: 'application/vnd.google-apps.presentation',
  GOOGLE_FOLDER: 'application/vnd.google-apps.folder',
  
  // Common file types
  PDF: 'application/pdf',
  TEXT: 'text/plain',
  HTML: 'text/html',
  MARKDOWN: 'text/markdown',
  JSON: 'application/json',
  CSV: 'text/csv',
  
  // Office formats (can be converted to Google Workspace)
  MS_WORD: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  MS_EXCEL: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  MS_POWERPOINT: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
```

---

## Google Docs API Integration

### Initialize Docs API Client

Create `lib/google-docs.ts`:

```typescript
import { google } from 'googleapis';
import type { docs_v1 } from 'googleapis';
import { getGoogleAuthClient, DOCS_SCOPES } from './google-auth';

/**
 * Creates and returns authenticated Google Docs API client
 */
export async function getDocsClient(): Promise<docs_v1.Docs> {
  const auth = await getGoogleAuthClient(DOCS_SCOPES);
  const docs = google.docs({ version: 'v1', auth });
  return docs;
}

/**
 * Create a new Google Doc with content
 * 
 * @param title - Document title
 * @param content - Array of text content to insert
 * @returns Document ID and metadata
 */
export async function createDocWithContent(
  title: string,
  content: string[]
): Promise<{ documentId: string; documentUrl: string }> {
  const docs = await getDocsClient();

  // First, create the document
  const createResponse = await docs.documents.create({
    requestBody: {
      title,
    },
  });

  const documentId = createResponse.data.documentId!;

  // Then, add content using batchUpdate
  if (content.length > 0) {
    await insertTextToDoc(documentId, content);
  }

  return {
    documentId,
    documentUrl: `https://docs.google.com/document/d/${documentId}/edit`,
  };
}

/**
 * Insert text into an existing Google Doc
 * Uses endOfSegmentLocation for appending (recommended for multiple inserts)
 * 
 * @param documentId - Target document ID
 * @param textLines - Array of text lines to insert
 */
export async function insertTextToDoc(
  documentId: string,
  textLines: string[]
): Promise<void> {
  const docs = await getDocsClient();

  // Build requests array
  const requests: docs_v1.Schema$Request[] = textLines.map((text) => ({
    insertText: {
      text: text + '\n',
      endOfSegmentLocation: {
        segmentId: '', // Empty string = main document body
      },
    },
  }));

  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests,
    },
  });
}

/**
 * Insert text at specific index (advanced)
 * 
 * @param documentId - Target document ID
 * @param text - Text to insert
 * @param index - Position index (1 = beginning of doc)
 */
export async function insertTextAtIndex(
  documentId: string,
  text: string,
  index: number = 1
): Promise<void> {
  const docs = await getDocsClient();

  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          insertText: {
            text,
            location: { index },
          },
        },
      ],
    },
  });
}

/**
 * Insert formatted text with styling
 * 
 * @param documentId - Target document ID
 * @param text - Text to insert
 * @param formatting - Text style options
 */
export async function insertFormattedText(
  documentId: string,
  text: string,
  formatting?: {
    bold?: boolean;
    italic?: boolean;
    fontSize?: number;
    foregroundColor?: { red: number; green: number; blue: number };
  }
): Promise<void> {
  const docs = await getDocsClient();

  const requests: docs_v1.Schema$Request[] = [
    {
      insertText: {
        text: text + '\n',
        endOfSegmentLocation: {
          segmentId: '',
        },
      },
    },
  ];

  // Add formatting if provided
  if (formatting) {
    const startIndex = 1; // Adjust based on document state
    const endIndex = startIndex + text.length;

    requests.push({
      updateTextStyle: {
        textStyle: {
          bold: formatting.bold,
          italic: formatting.italic,
          fontSize: formatting.fontSize
            ? { magnitude: formatting.fontSize, unit: 'PT' }
            : undefined,
          foregroundColor: formatting.foregroundColor
            ? {
                color: {
                  rgbColor: formatting.foregroundColor,
                },
              }
            : undefined,
        },
        range: {
          startIndex,
          endIndex,
        },
        fields: Object.keys(formatting).join(','),
      },
    });
  }

  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests,
    },
  });
}

/**
 * Get document content
 * 
 * @param documentId - Document ID to read
 * @returns Document title and text content
 */
export async function getDocumentContent(
  documentId: string
): Promise<{ title: string; content: string }> {
  const docs = await getDocsClient();

  const response = await docs.documents.get({
    documentId,
  });

  const doc = response.data;
  const title = doc.title || '';

  // Extract text from document body
  let content = '';
  if (doc.body?.content) {
    for (const element of doc.body.content) {
      if (element.paragraph?.elements) {
        for (const paragraphElement of element.paragraph.elements) {
          if (paragraphElement.textRun?.content) {
            content += paragraphElement.textRun.content;
          }
        }
      }
    }
  }

  return { title, content };
}
```

### Advanced: Insert Tables into Docs

```typescript
/**
 * Insert a table into a Google Doc
 * 
 * @param documentId - Target document ID
 * @param rows - Number of rows
 * @param columns - Number of columns
 * @param data - 2D array of cell data (optional)
 */
export async function insertTable(
  documentId: string,
  rows: number,
  columns: number,
  data?: string[][]
): Promise<void> {
  const docs = await getDocsClient();

  const requests: docs_v1.Schema$Request[] = [
    {
      insertTable: {
        rows,
        columns,
        endOfSegmentLocation: {
          segmentId: '',
        },
      },
    },
  ];

  // If data provided, populate cells
  if (data && data.length > 0) {
    // After inserting table, get document to find table indices
    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });

    // Get updated document
    const doc = await docs.documents.get({ documentId });
    const tables = doc.data.body?.content?.filter((el) => el.table);
    
    if (tables && tables.length > 0) {
      const table = tables[tables.length - 1].table!;
      const cellRequests: docs_v1.Schema$Request[] = [];

      // Populate cells (simplified - assumes table structure)
      data.forEach((row, rowIndex) => {
        row.forEach((cellValue, colIndex) => {
          if (table.tableRows && table.tableRows[rowIndex]) {
            const cell = table.tableRows[rowIndex].tableCells?.[colIndex];
            if (cell?.content?.[0]?.startIndex) {
              cellRequests.push({
                insertText: {
                  text: cellValue,
                  location: {
                    index: cell.content[0].startIndex + 1,
                  },
                },
              });
            }
          }
        });
      });

      if (cellRequests.length > 0) {
        await docs.documents.batchUpdate({
          documentId,
          requestBody: { requests: cellRequests },
        });
      }
    }
  } else {
    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });
  }
}
```

---

## GitHub Actions Integration

### Workflow File Structure

Create `.github/workflows/daily-report.yml`:

#### Option A: Using Service Account Key JSON

```yaml
name: Daily Report to Google Drive

on:
  schedule:
    # Runs daily at 9 AM UTC
    - cron: '0 9 * * *'
  workflow_dispatch: # Allows manual triggering

permissions:
  contents: read

jobs:
  generate-and-upload:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build Next.js application
        run: npm run build

      - name: Run report generation script
        env:
          # Service Account credentials as single JSON secret
          GOOGLE_CREDENTIALS: ${{ secrets.GOOGLE_CREDENTIALS }}
          GOOGLE_DRIVE_FOLDER_ID: ${{ secrets.GOOGLE_DRIVE_FOLDER_ID }}
          # Your other API keys
          HUBSPOT_API_KEY: ${{ secrets.HUBSPOT_API_KEY }}
          # ... other environment variables
        run: |
          npm run generate-report

      - name: Upload artifacts (optional - for debugging)
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: error-logs
          path: ./logs/
```

#### Option B: Using Workload Identity Federation (Recommended)

```yaml
name: Daily Report to Google Drive (WIF)

on:
  schedule:
    - cron: '0 9 * * *'
  workflow_dispatch:

permissions:
  contents: read
  id-token: write # Required for OIDC token

jobs:
  generate-and-upload:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        id: auth
        uses: google-github-actions/auth@v3
        with:
          workload_identity_provider: ${{ secrets.GOOGLE_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_EMAIL }}
          create_credentials_file: true

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build Next.js application
        run: npm run build

      - name: Run report generation script
        env:
          # WIF automatically provides credentials via GOOGLE_APPLICATION_CREDENTIALS
          GOOGLE_APPLICATION_CREDENTIALS: ${{ steps.auth.outputs.credentials_file_path }}
          GOOGLE_DRIVE_FOLDER_ID: ${{ secrets.GOOGLE_DRIVE_FOLDER_ID }}
          HUBSPOT_API_KEY: ${{ secrets.HUBSPOT_API_KEY }}
        run: |
          npm run generate-report

      - name: Upload artifacts (optional)
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: error-logs
          path: ./logs/
```

### Report Generation Script

Create `scripts/generate-report.ts`:

```typescript
import { createGoogleDoc } from '../lib/google-drive';
import { insertTextToDoc } from '../lib/google-docs';
import { fetchHubSpotData } from '../lib/hubspot'; // Your HubSpot integration

interface ReportData {
  summary: string;
  details: string[];
  timestamp: string;
}

async function generateReport(): Promise<void> {
  try {
    console.log('Starting report generation...');

    // 1. Fetch your data
    const data = await fetchHubSpotData();
    
    // 2. Process and format data
    const reportData: ReportData = {
      summary: `Daily Report - ${new Date().toLocaleDateString()}`,
      details: [
        `Generated: ${new Date().toISOString()}`,
        '',
        '## Summary',
        data.summary,
        '',
        '## Detailed Analysis',
        ...data.details,
      ],
      timestamp: new Date().toISOString(),
    };

    // 3. Create Google Doc
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      throw new Error('GOOGLE_DRIVE_FOLDER_ID environment variable not set');
    }

    const fileName = `Daily Report - ${new Date().toISOString().split('T')[0]}.docx`;
    
    console.log(`Creating Google Doc: ${fileName}`);
    const doc = await createGoogleDoc(fileName, folderId);
    
    console.log(`Document created with ID: ${doc.id}`);
    console.log(`View at: ${doc.webViewLink}`);

    // 4. Add content to the document
    await insertTextToDoc(doc.id!, reportData.details);

    console.log('Report generated successfully!');
    console.log(`Document URL: ${doc.webViewLink}`);

  } catch (error) {
    console.error('Error generating report:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the report generation
generateReport();
```

Update `package.json`:

```json
{
  "scripts": {
    "generate-report": "tsx scripts/generate-report.ts"
  },
  "dependencies": {
    "googleapis": "^140.0.0"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

---

## Complete Implementation Examples

### Example 1: Create Doc with Formatted Content

```typescript
import { createGoogleDoc } from './lib/google-drive';
import { insertTextToDoc, insertFormattedText } from './lib/google-docs';

async function createFormattedReport() {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
  
  // Create doc
  const doc = await createGoogleDoc(
    `Report - ${new Date().toLocaleDateString()}`,
    folderId
  );
  
  const documentId = doc.id!;
  
  // Add title (bold, large)
  await insertFormattedText(documentId, 'Daily Analytics Report', {
    bold: true,
    fontSize: 18,
  });
  
  // Add subtitle
  await insertFormattedText(documentId, `Generated: ${new Date().toLocaleString()}`, {
    italic: true,
    fontSize: 11,
    foregroundColor: { red: 0.5, green: 0.5, blue: 0.5 },
  });
  
  // Add regular content
  await insertTextToDoc(documentId, [
    '',
    '## Key Metrics',
    '- Users: 1,234',
    '- Conversions: 56',
    '- Revenue: $12,345',
    '',
    '## Analysis',
    'The data shows positive trends across all metrics...',
  ]);
  
  console.log(`Report created: ${doc.webViewLink}`);
  return doc;
}
```

### Example 2: Convert HTML to Google Doc

```typescript
import { uploadHTMLAsGoogleDoc } from './lib/google-drive';

async function createDocFromHTML() {
  const htmlContent = `
    <html>
      <body>
        <h1>My Report</h1>
        <p>This is <strong>bold</strong> and this is <em>italic</em>.</p>
        <ul>
          <li>First item</li>
          <li>Second item</li>
        </ul>
        <table>
          <tr><th>Header 1</th><th>Header 2</th></tr>
          <tr><td>Data 1</td><td>Data 2</td></tr>
        </table>
      </body>
    </html>
  `;
  
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
  const doc = await uploadHTMLAsGoogleDoc(
    'HTML Report',
    htmlContent,
    folderId
  );
  
  console.log(`Document created: ${doc.webViewLink}`);
  return doc;
}
```

### Example 3: Upload PDF to Drive

```typescript
import fs from 'fs/promises';
import { uploadPDFToDrive } from './lib/google-drive';

async function uploadPDFReport() {
  // Assuming you generate a PDF somehow (e.g., using puppeteer, jsPDF, etc.)
  const pdfBuffer = await fs.readFile('./output/report.pdf');
  
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
  const file = await uploadPDFToDrive(
    `Report-${Date.now()}.pdf`,
    pdfBuffer,
    folderId
  );
  
  console.log(`PDF uploaded: ${file.webViewLink}`);
  return file;
}
```

### Example 4: Create Doc with Table

```typescript
import { createGoogleDoc } from './lib/google-drive';
import { insertTextToDoc, insertTable } from './lib/google-docs';

async function createReportWithTable() {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
  
  const doc = await createGoogleDoc('Sales Report', folderId);
  const documentId = doc.id!;
  
  // Add title
  await insertTextToDoc(documentId, ['Sales Report - Q4 2025', '']);
  
  // Add table
  const tableData = [
    ['Month', 'Revenue', 'Growth'],
    ['October', '$45,000', '+12%'],
    ['November', '$52,000', '+15%'],
    ['December', '$68,000', '+30%'],
  ];
  
  await insertTable(documentId, 4, 3, tableData);
  
  // Add conclusion
  await insertTextToDoc(documentId, [
    '',
    'Total Q4 Revenue: $165,000',
  ]);
  
  console.log(`Report with table created: ${doc.webViewLink}`);
  return doc;
}
```

---

## Best Practices & Security

### Security Best Practices

1. **Never commit credentials to Git**
   - Add to `.gitignore`: `credentials.json`, `service-account-*.json`, `.env.local`
   - Use environment variables for all secrets

2. **Use minimal scopes**
   - Only request scopes you actually need
   - Prefer `drive.file` over `drive` if possible

3. **Rotate service account keys**
   - If using service account keys, rotate them periodically (every 90 days recommended)
   - Use Workload Identity Federation in production to avoid key management

4. **Secure GitHub Secrets**
   - Use repository secrets, not environment secrets for sensitive data
   - Review who has access to secrets regularly

5. **Validate inputs**
   - Sanitize any user input before writing to documents
   - Validate folder IDs and file names

### Error Handling Best Practices

```typescript
import { GaxiosError } from 'googleapis-common';

export async function safeGoogleAPICall<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof GaxiosError) {
      console.error(`Google API Error in ${operationName}:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
      
      // Handle specific error codes
      if (error.response?.status === 403) {
        throw new Error(
          `Permission denied. Ensure service account has access to the resource.`
        );
      } else if (error.response?.status === 404) {
        throw new Error(
          `Resource not found. Check folder/document ID.`
        );
      } else if (error.response?.status === 429) {
        throw new Error(
          `Rate limit exceeded. Implement exponential backoff.`
        );
      }
    }
    throw error;
  }
}

// Usage
const doc = await safeGoogleAPICall(
  () => createGoogleDoc('My Doc', folderId),
  'createGoogleDoc'
);
```

### Rate Limiting & Quotas

Google APIs have rate limits. Implement retry logic with exponential backoff:

```typescript
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Only retry on rate limit or server errors
      if (error instanceof GaxiosError) {
        const status = error.response?.status;
        if (status === 429 || (status && status >= 500)) {
          const delay = initialDelay * Math.pow(2, i);
          console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      // Don't retry other errors
      throw error;
    }
  }
  
  throw lastError!;
}

// Usage
const doc = await retryWithBackoff(() =>
  createGoogleDoc('My Doc', folderId)
);
```

### Monitoring & Logging

```typescript
export function logGoogleAPIUsage(
  operation: string,
  success: boolean,
  durationMs: number,
  metadata?: Record<string, any>
) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    operation,
    success,
    durationMs,
    ...metadata,
  };
  
  console.log(JSON.stringify(logEntry));
  
  // In production, send to monitoring service
  // e.g., Datadog, CloudWatch, etc.
}

// Usage
const startTime = Date.now();
try {
  const doc = await createGoogleDoc('Report', folderId);
  logGoogleAPIUsage('createGoogleDoc', true, Date.now() - startTime, {
    documentId: doc.id,
  });
} catch (error) {
  logGoogleAPIUsage('createGoogleDoc', false, Date.now() - startTime, {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  throw error;
}
```

### Testing Strategy

```typescript
// Mock googleapis for testing
import { jest } from '@jest/globals';

jest.mock('googleapis', () => ({
  google: {
    auth: {
      GoogleAuth: jest.fn(),
    },
    drive: jest.fn(() => ({
      files: {
        create: jest.fn().mockResolvedValue({
          data: {
            id: 'mock-doc-id',
            name: 'Mock Document',
            webViewLink: 'https://docs.google.com/document/d/mock-doc-id/edit',
          },
        }),
      },
    })),
    docs: jest.fn(() => ({
      documents: {
        create: jest.fn(),
        batchUpdate: jest.fn(),
        get: jest.fn(),
      },
    })),
  },
}));

// Your tests
describe('Google Drive Integration', () => {
  it('should create a document', async () => {
    const doc = await createGoogleDoc('Test Doc', 'folder-id');
    expect(doc.id).toBe('mock-doc-id');
  });
});
```

---

## Troubleshooting Common Issues

### Issue 1: "Permission denied" (403 Error)

**Cause:** Service account doesn't have access to the folder.

**Solution:**
1. Verify you shared the folder with the service account email
2. Check the service account has Editor permissions
3. Confirm you're using the correct folder ID

### Issue 2: "Invalid credentials" Error

**Cause:** Environment variables not set correctly.

**Solution:**
1. Check `GOOGLE_PRIVATE_KEY` has proper line breaks (`\n`)
2. Ensure `GOOGLE_SERVICE_ACCOUNT_EMAIL` matches the service account
3. Verify `GOOGLE_CREDENTIALS` JSON is properly formatted (minified)

### Issue 3: "Resource not found" (404 Error)

**Cause:** Invalid document or folder ID.

**Solution:**
1. Double-check the folder ID from the Drive URL
2. Ensure the folder hasn't been deleted
3. Verify the service account has access

### Issue 4: Rate Limit Exceeded (429 Error)

**Cause:** Too many API requests in short time.

**Solution:**
1. Implement exponential backoff retry logic
2. Reduce frequency of requests
3. Consider batching operations
4. Request quota increase from Google if needed

### Issue 5: GitHub Actions Authentication Fails

**Cause:** Incorrect secret configuration or WIF setup.

**Solution:**
1. Verify all required secrets are set in GitHub
2. Check secret names match workflow file
3. For WIF, confirm workload identity provider is correct
4. Ensure service account has necessary permissions

---

## Additional Resources

### Official Documentation
- [Google Drive API Reference](https://developers.google.com/drive/api/reference/rest/v3)
- [Google Docs API Reference](https://developers.google.com/docs/api/reference/rest/v1)
- [googleapis npm package](https://www.npmjs.com/package/googleapis)
- [Google Auth Library](https://github.com/googleapis/google-auth-library-nodejs)
- [GitHub Actions google-github-actions/auth](https://github.com/google-github-actions/auth)

### Example Repositories
- [googleapis Node.js samples](https://github.com/googleapis/google-api-nodejs-client/tree/main/samples)
- [Google Workspace samples](https://github.com/googleworkspace)

### Community Resources
- [Stack Overflow - googleapis tag](https://stackoverflow.com/questions/tagged/google-api-nodejs-client)
- [Google Workspace Developer Forum](https://support.google.com/googleapi)

---

## Conclusion

This guide provides comprehensive, up-to-date (November 2025) instructions for integrating Google Drive and Docs APIs into your Next.js TypeScript application running via GitHub Actions.

**Key Takeaways:**
1. Use **Workload Identity Federation** for production GitHub Actions workflows
2. **Share folders** with the service account email for access
3. Use `googleapis` npm package (latest version)
4. Implement proper error handling and retry logic
5. Monitor API usage and implement rate limiting
6. Secure credentials using GitHub Secrets
7. Test thoroughly with mock implementations

**Next Steps:**
1. Set up Google Cloud Project and enable APIs
2. Create service account and share Drive folder
3. Implement authentication helper functions
4. Create Drive/Docs integration modules
5. Build your report generation logic
6. Set up GitHub Actions workflow
7. Test and deploy

Good luck with your implementation!