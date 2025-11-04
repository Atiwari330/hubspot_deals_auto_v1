# Google Drive Integration Setup Guide

This guide will walk you through setting up Google Drive integration for the Deal Hygiene script, so that reports are automatically saved to Google Docs.

## Overview

The `deal-hygiene-gdrive` script extends the standard deal hygiene checker by automatically uploading reports to Google Drive. It creates a Google Doc with:
- **Section 1**: Detailed hygiene analysis (all console output)
- **Section 2**: AI-generated email report

Documents are named with format: `Deal Hygiene - YYYY-MM-DD`

---

## Prerequisites

- Google account with access to Google Drive
- Google Cloud Platform account (free tier is sufficient)
- Admin access to configure GitHub Secrets (if using GitHub Actions)

---

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click **Select a project** → **New Project**
3. Enter project name (e.g., "HubSpot Deal Hygiene")
4. Click **Create**
5. Wait for project creation, then select your new project

---

## Step 2: Enable Required APIs

You need to enable two APIs for your project:

1. In Google Cloud Console, navigate to **APIs & Services** → **Library**
2. Search for and enable:
   - **Google Drive API** - for creating files and folders
   - **Google Docs API** - for creating and editing documents

### Using gcloud CLI (Optional)

If you have gcloud CLI installed:

```bash
gcloud services enable drive.googleapis.com
gcloud services enable docs.googleapis.com
```

---

## Step 3: Create Service Account

A service account allows your application to authenticate with Google APIs without user interaction.

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **Service Account**
3. Fill in details:
   - **Name**: `hubspot-hygiene-bot` (or your preference)
   - **Description**: "Service account for HubSpot deal hygiene Google Drive uploads"
4. Click **Create and Continue**
5. Skip the optional role assignment (click **Continue**)
6. Skip the optional user access (click **Done**)

---

## Step 4: Create Service Account Key

1. In the **Credentials** page, find your service account in the list
2. Click on the service account name
3. Go to the **Keys** tab
4. Click **Add Key** → **Create new key**
5. Select **JSON** format
6. Click **Create**
7. A JSON file will download automatically - **save it securely**

**IMPORTANT**: This JSON file contains sensitive credentials. Never commit it to git or share it publicly.

Your service account email looks like:
```
hubspot-hygiene-bot@your-project-id.iam.gserviceaccount.com
```

You'll need this email in the next step.

---

## Step 5: Create and Share Google Drive Folder

**This is a critical step** - the service account must have access to your folder.

1. Open [Google Drive](https://drive.google.com)
2. Create a new folder where reports will be saved (or use existing folder)
   - Example name: "HubSpot Deal Hygiene Reports"
3. Right-click the folder → **Share**
4. In the "Add people and groups" field, paste your **service account email**
   - Example: `hubspot-hygiene-bot@your-project-id.iam.gserviceaccount.com`
5. Set permission level to **Editor**
6. **IMPORTANT**: Uncheck "Notify people" (no need to email a service account)
7. Click **Share**

### Get Folder ID

You need the folder ID for configuration:

1. Open the folder in Google Drive
2. Look at the URL in your browser:
   ```
   https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j
                                            ^^^^^^^^^^^^^^^^^^
                                            This is your folder ID
   ```
3. Copy the folder ID (the part after `/folders/`)

---

## Step 6: Configure Local Environment

### Option A: Using JSON Credentials (Recommended for GitHub Actions)

1. Open your service account JSON file
2. Minify it to a single line (remove all whitespace and newlines):

   ```bash
   # On Linux/Mac/Windows (with jq installed):
   cat service-account-key.json | jq -c

   # Or manually: copy the JSON and use an online minifier
   ```

3. Add to your `.env` file:

   ```env
   # Google Drive Configuration
   GOOGLE_CREDENTIALS={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
   GOOGLE_DRIVE_FOLDER_ID=your-folder-id-here
   ```

### Option B: Using Individual Environment Variables (Alternative)

Alternatively, you can split the credentials:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nPrivate\nKey\nHere\n-----END PRIVATE KEY-----\n"
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_DRIVE_FOLDER_ID=your-folder-id-here
```

**Note**: The private key must include `\n` for newlines.

---

## Step 7: Test the Integration

Run the script locally to verify everything works:

```bash
npm run deal-hygiene-gdrive
```

Expected output:
```
🚀 Starting HubSpot Deal Hygiene Checker with Google Drive Integration...

[... standard hygiene output ...]

📤 Uploading report to Google Drive...

📝 Creating Google Doc: "Deal Hygiene - 2025-11-03"
✅ Document created with ID: abc123...
🔗 View at: https://docs.google.com/document/d/abc123.../edit

📝 Inserting content into document...
✅ Content inserted successfully!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ GOOGLE DRIVE UPLOAD COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 Document: Deal Hygiene - 2025-11-03
🔗 URL: https://docs.google.com/document/d/abc123.../edit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Check your Google Drive folder to verify the document was created with the correct content.

---

## Step 8: Configure GitHub Actions (Optional)

If you want to run this automatically via GitHub Actions:

### Add GitHub Secrets

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add two secrets:

   **Secret 1: GOOGLE_CREDENTIALS**
   - Name: `GOOGLE_CREDENTIALS`
   - Value: Your minified service account JSON (from Step 6)

   **Secret 2: GOOGLE_DRIVE_FOLDER_ID**
   - Name: `GOOGLE_DRIVE_FOLDER_ID`
   - Value: Your folder ID (from Step 5)

### The workflow file is already created at:
`.github/workflows/deal-hygiene-gdrive.yml`

It runs twice daily at 8:00 AM EDT and 1:28 PM EDT (matching the standard hygiene workflow).

---

## Troubleshooting

### Error: "Permission denied" (403)

**Cause**: Service account doesn't have access to the folder.

**Solution**:
1. Verify you shared the folder with the service account email
2. Check the email matches exactly what's in your JSON credentials
3. Ensure permission level is **Editor**, not **Viewer**
4. Wait a few minutes after sharing - permissions can take time to propagate

### Error: "Invalid credentials"

**Cause**: Environment variables not set correctly.

**Solution**:
1. Check `GOOGLE_CREDENTIALS` is valid JSON (use a JSON validator)
2. Ensure no extra quotes or escaping issues
3. For `GOOGLE_PRIVATE_KEY`, verify `\n` is used for line breaks, not actual newlines

### Error: "Resource not found" (404)

**Cause**: Invalid folder ID.

**Solution**:
1. Double-check the folder ID from the Drive URL
2. Verify you're using the ID, not the folder name
3. Ensure the folder hasn't been deleted

### Error: "Failed to parse GOOGLE_CREDENTIALS"

**Cause**: JSON is not properly formatted or escaped.

**Solution**:
1. Use `jq -c` to minify the JSON properly
2. Ensure no line breaks in the minified JSON
3. In GitHub Secrets, paste the JSON as-is (no additional quotes)

### Documents created but appear in wrong folder

**Cause**: Using wrong folder ID or folder ID not provided.

**Solution**:
1. Verify `GOOGLE_DRIVE_FOLDER_ID` is set correctly
2. Check you copied the entire folder ID from the URL
3. If blank, documents go to the service account's root Drive

---

## Security Best Practices

1. **Never commit credentials to git**
   - Add `service-account-*.json` to `.gitignore`
   - Keep `.env` in `.gitignore` (already configured)

2. **Rotate service account keys periodically**
   - Google recommends rotating every 90 days
   - Create new key, update secrets, delete old key

3. **Use minimal permissions**
   - Only share specific folder with service account
   - Don't give service account broader Drive access

4. **Secure GitHub Secrets**
   - Use repository secrets, not environment secrets for sensitive data
   - Review who has access to secrets regularly

5. **Monitor API usage**
   - Check Google Cloud Console for unusual activity
   - Set up billing alerts if concerned about quota usage

---

## API Quotas and Limits

Google Drive and Docs APIs have generous free quotas:

- **Google Drive API**: 20,000 queries per 100 seconds per user
- **Google Docs API**: 300 reads/writes per minute per user

For this use case (creating 1-2 documents per day), you're well within free limits.

---

## Additional Resources

- [Google Drive API Documentation](https://developers.google.com/drive/api/guides/about-sdk)
- [Google Docs API Documentation](https://developers.google.com/docs/api/how-tos/overview)
- [Service Account Documentation](https://cloud.google.com/iam/docs/service-accounts)
- [googleapis npm package](https://www.npmjs.com/package/googleapis)

---

## Summary Checklist

Before running the script, ensure you've completed:

- [ ] Created Google Cloud project
- [ ] Enabled Google Drive API and Google Docs API
- [ ] Created service account
- [ ] Downloaded service account JSON key
- [ ] Created/identified target Google Drive folder
- [ ] Shared folder with service account email (Editor permission)
- [ ] Copied folder ID from Drive URL
- [ ] Added `GOOGLE_CREDENTIALS` to `.env` file
- [ ] Added `GOOGLE_DRIVE_FOLDER_ID` to `.env` file
- [ ] Tested with `npm run deal-hygiene-gdrive`
- [ ] (Optional) Added GitHub Secrets for automated runs

---

## Support

If you encounter issues not covered in the troubleshooting section:

1. Check the console output for specific error messages
2. Verify all environment variables are set correctly
3. Review the Google Cloud Console audit logs for API errors
4. Ensure service account has proper permissions on the folder

The script will still display CLI output even if Google Drive upload fails, so you'll always have access to the hygiene report.
