# Google OAuth 2.0 Setup Guide

This guide will walk you through setting up OAuth 2.0 authentication for the Deal Hygiene Google Drive integration.

## Why OAuth 2.0?

As of 2025, Google has restricted service accounts from owning Drive files. Service accounts created after April 2025 have **0 bytes storage quota**, which causes the "storage quota exceeded" error.

**OAuth 2.0 solves this** by authenticating as YOU (the user), so files are created with your identity and use YOUR storage quota.

---

## Prerequisites

- Google Workspace (G Suite) account OR personal Gmail account
- Access to Google Cloud Console
- Permission to create OAuth clients in your Google Cloud project

---

## Part 1: Create OAuth 2.0 Client in Google Cloud Console

### Step 1: Navigate to Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project (or create a new one):
   - Click the project dropdown at the top
   - Select your existing project (`hubspot-deal-hygiene` if you created one earlier)

### Step 2: Enable Required APIs (if not already enabled)

1. Go to **APIs & Services** → **Library**
2. Search for and enable:
   - **Google Drive API**
   - **Google Docs API**

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**

2. Choose user type:
   - **Internal** (if using Google Workspace and want to restrict to your org)
   - **External** (if using personal Gmail or need access from any Google account)

3. Click **Create**

4. Fill in the required information:
   - **App name**: `HubSpot Deal Hygiene Reports`
   - **User support email**: Your email address
   - **Developer contact**: Your email address

5. Click **Save and Continue**

6. **Scopes** page:
   - Click **Add or Remove Scopes**
   - Search for and add:
     - `https://www.googleapis.com/auth/drive`
     - `https://www.googleapis.com/auth/documents`
   - Click **Update**
   - Click **Save and Continue**

7. **Test users** (if using External):
   - Click **Add Users**
   - Add your Google Workspace email address
   - Click **Save and Continue**

8. Click **Back to Dashboard**

### Step 4: Create OAuth 2.0 Client ID

1. Go to **APIs & Services** → **Credentials**

2. Click **Create Credentials** → **OAuth client ID**

3. Application type: Select **Web application**

4. Fill in the details:
   - **Name**: `Deal Hygiene CLI`
   - **Authorized redirect URIs**: Click **Add URI**
     - Enter: `http://localhost:3000/oauth2callback`
   - Click **Create**

5. **Important**: A dialog appears with your Client ID and Client Secret
   - **Copy both values** - you'll need them in the next step
   - Click **OK**

6. You can always retrieve these later:
   - Go to **APIs & Services** → **Credentials**
   - Find your OAuth 2.0 Client ID in the list
   - Click the edit icon (pencil)
   - Your Client ID is visible at the top
   - Click **Reset Secret** if you need to regenerate the secret

---

## Part 2: Run OAuth Setup Script

### Step 1: Add OAuth Credentials to .env

Open your `.env` file and update the OAuth credentials:

```env
GOOGLE_OAUTH_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-actual-client-secret
GOOGLE_OAUTH_REFRESH_TOKEN=your-refresh-token   # This will be filled by the setup script
```

Replace:
- `your-actual-client-id.apps.googleusercontent.com` with your OAuth Client ID
- `your-actual-client-secret` with your OAuth Client Secret
- Leave `GOOGLE_OAUTH_REFRESH_TOKEN` as is for now (the setup script will fill this in)

### Step 2: Run the Setup Script

```bash
npm run google-oauth-setup
```

### Step 3: Complete Authorization Flow

The script will:

1. **Open your browser automatically** (or show a URL to copy)

2. **Google Sign-In page appears**:
   - Sign in with your Google Workspace account
   - This is the account whose storage quota will be used

3. **Consent screen appears**:
   - Review the permissions requested:
     - View and manage Google Drive files
     - View and manage Google Docs
   - Click **Continue** or **Allow**

4. **Success page appears**:
   - You'll see "✅ Authorization Successful!"
   - You can close the browser window

5. **Return to terminal**:
   - The script will display:
     ```
     ✅ Tokens received successfully
     💾 Saving credentials to .env file...
     ✅ Updated .env file with OAuth credentials

     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ✨ SETUP COMPLETE!
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ```

6. **Verify .env file**:
   - Open `.env` and confirm `GOOGLE_OAUTH_REFRESH_TOKEN` now has a value
   - It should look like: `1//0gXXX...` (long string starting with `1//`)

---

## Part 3: Test the Integration

Run the Deal Hygiene script:

```bash
npm run deal-hygiene-gdrive
```

Expected output:
```
🔐 Using OAuth 2.0 authentication...
📤 Uploading report to Google Drive...
📝 Creating Google Doc: "Deal Hygiene - 2025-11-04"
✅ Document created with ID: abc123...
🔗 View at: https://docs.google.com/document/d/abc123.../edit
```

**Success!** The document should appear in your Google Drive folder, owned by you, using your storage quota.

---

## Part 4: Configure GitHub Actions (Optional)

To run this automatically in GitHub Actions, you need to add your OAuth credentials as repository secrets.

### Step 1: Add GitHub Secrets

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add three secrets:

   **Secret 1:**
   - Name: `GOOGLE_OAUTH_CLIENT_ID`
   - Value: Your OAuth Client ID from Google Cloud Console

   **Secret 2:**
   - Name: `GOOGLE_OAUTH_CLIENT_SECRET`
   - Value: Your OAuth Client Secret from Google Cloud Console

   **Secret 3:**
   - Name: `GOOGLE_OAUTH_REFRESH_TOKEN`
   - Value: Your refresh token from `.env` file (the long string starting with `1//`)

   **Secret 4:**
   - Name: `GOOGLE_DRIVE_FOLDER_ID`
   - Value: Your folder ID (already configured)

### Step 2: Update GitHub Workflow

The workflow file `.github/workflows/deal-hygiene-gdrive.yml` needs to be updated to use OAuth credentials instead of service account:

```yaml
- name: Run deal hygiene check with Google Drive upload
  env:
    HUBSPOT_ACCESS_TOKEN: ${{ secrets.HUBSPOT_ACCESS_TOKEN }}
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    # OAuth credentials (replaces GOOGLE_CREDENTIALS)
    GOOGLE_OAUTH_CLIENT_ID: ${{ secrets.GOOGLE_OAUTH_CLIENT_ID }}
    GOOGLE_OAUTH_CLIENT_SECRET: ${{ secrets.GOOGLE_OAUTH_CLIENT_SECRET }}
    GOOGLE_OAUTH_REFRESH_TOKEN: ${{ secrets.GOOGLE_OAUTH_REFRESH_TOKEN }}
    GOOGLE_DRIVE_FOLDER_ID: ${{ secrets.GOOGLE_DRIVE_FOLDER_ID }}
  run: npm run deal-hygiene-gdrive
```

### Step 3: Test GitHub Actions

1. Go to **Actions** tab in your repository
2. Find the "Daily Deal Hygiene Check with Google Drive Upload" workflow
3. Click **Run workflow** → **Run workflow** (manual trigger)
4. Wait for it to complete
5. Check your Google Drive folder for the new document

---

## Troubleshooting

### Error: "No refresh token received"

**Cause**: You've already authorized this app before, and Google doesn't issue a new refresh token.

**Solution**:
1. Go to [Google Account Permissions](https://myaccount.google.com/permissions)
2. Find "HubSpot Deal Hygiene Reports" in the list
3. Click **Remove Access**
4. Run `npm run google-oauth-setup` again

### Error: "Invalid client" or "redirect_uri_mismatch"

**Cause**: The redirect URI in your OAuth client doesn't match the one in the code.

**Solution**:
1. Go to Google Cloud Console → **APIs & Services** → **Credentials**
2. Edit your OAuth 2.0 Client ID
3. Ensure **Authorized redirect URIs** includes:
   - `http://localhost:3000/oauth2callback` (exactly as written, no trailing slash)
4. Save changes
5. Wait a few minutes for changes to propagate
6. Run `npm run google-oauth-setup` again

### Error: "Access blocked: This app's request is invalid"

**Cause**: OAuth consent screen is not properly configured.

**Solution**:
1. Go to Google Cloud Console → **APIs & Services** → **OAuth consent screen**
2. Ensure the scopes are added:
   - `https://www.googleapis.com/auth/drive`
   - `https://www.googleapis.com/auth/documents`
3. If using External user type, ensure your email is added as a test user
4. Save changes and try again

### Error: "The user's Drive storage quota has been exceeded"

**Cause**: The script is still using service account authentication instead of OAuth.

**Solution**:
1. Check your `.env` file
2. Ensure `GOOGLE_OAUTH_CLIENT_ID` is set and NOT commented out
3. Comment out or remove `GOOGLE_CREDENTIALS` line
4. The auth client will auto-detect which method to use (OAuth takes priority)

### Browser doesn't open automatically

**Cause**: Platform detection failed or browser not configured.

**Solution**:
1. The script will print the auth URL in the terminal
2. Manually copy the URL and paste it in your browser
3. Complete the authorization flow
4. The callback will still work

### Tokens expire or "invalid_grant" error

**Cause**: Refresh token has been revoked or expired.

**Solution**:
1. Refresh tokens can be revoked if:
   - You removed app access in Google Account settings
   - 6 months passed without using the token
   - You exceeded the 100 refresh tokens per client limit
2. Run `npm run google-oauth-setup` again to get a new refresh token

---

## Security Best Practices

1. **Never commit `.env` to git**
   - `.gitignore` already includes `.env`
   - Double-check before committing

2. **Rotate credentials periodically**
   - Refresh tokens don't expire, but good practice to regenerate annually
   - Can revoke and re-authorize at [Google Account Permissions](https://myaccount.google.com/permissions)

3. **Use repository secrets for GitHub Actions**
   - Never hardcode credentials in workflow files
   - Use organization secrets if sharing across repos

4. **Restrict OAuth client usage**
   - Use "Internal" user type if only your organization needs access
   - Limit test users to specific email addresses

5. **Monitor API usage**
   - Check Google Cloud Console for unusual API activity
   - Set up billing alerts (though APIs are free within quota)

---

## Understanding OAuth 2.0 Flow

Here's what happens behind the scenes:

1. **Authorization Request** (`npm run google-oauth-setup`):
   - Your app redirects you to Google's authorization server
   - You log in and grant permissions

2. **Authorization Code**:
   - Google redirects back to `http://localhost:3000/oauth2callback?code=XXX`
   - Your local HTTP server receives the code

3. **Token Exchange**:
   - App exchanges authorization code for access token + refresh token
   - Access token: short-lived (1 hour), used for API calls
   - Refresh token: long-lived, used to get new access tokens

4. **Automatic Token Refresh**:
   - When access token expires, `googleapis` automatically uses refresh token
   - Gets new access token without user interaction
   - This happens transparently in your scripts

5. **API Calls**:
   - Every Drive/Docs API call uses the current access token
   - Files are created as you (the authorized user)
   - Your storage quota is used

---

## FAQ

**Q: Do I need to re-authorize every time I run the script?**
A: No! After initial setup, the refresh token handles authentication automatically.

**Q: What if I want to use a different Google account?**
A: Run `npm run google-oauth-setup` again and log in with the different account. The new refresh token will replace the old one.

**Q: Can multiple people run this script with their own accounts?**
A: Yes! Each person runs `npm run google-oauth-setup` on their machine. Files will be created in their personal Drive using their quota.

**Q: What's the difference between this and service accounts?**
A: Service accounts are "robot" accounts with their own (0 bytes) storage. OAuth authenticates as YOU, so your storage is used.

**Q: Can I use this with a personal Gmail account?**
A: Yes! OAuth 2.0 works with both Workspace and personal accounts. Just choose "External" user type in the consent screen.

**Q: Is this secure for GitHub Actions?**
A: Yes! Refresh tokens are stored as encrypted GitHub Secrets, not in your code. Only your repository's workflows can access them.

---

## Summary

### What You Did:
1. ✅ Created OAuth 2.0 Client in Google Cloud Console
2. ✅ Configured OAuth consent screen with Drive/Docs scopes
3. ✅ Added Client ID and Secret to `.env`
4. ✅ Ran `npm run google-oauth-setup` and authorized the app
5. ✅ Obtained refresh token (saved to `.env`)
6. ✅ Tested with `npm run deal-hygiene-gdrive`

### What Changed:
- **Before**: Service account (0 bytes quota) → Files couldn't be created
- **After**: OAuth as you → Files created in your Drive with your quota

### Next Steps:
- Files are now automatically uploaded to your Google Drive folder
- GitHub Actions can run this automatically (after adding secrets)
- No more "storage quota exceeded" errors!

---

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Drive API Reference](https://developers.google.com/drive/api/guides/about-sdk)
- [Google Docs API Reference](https://developers.google.com/docs/api/how-tos/overview)
- [googleapis npm package](https://www.npmjs.com/package/googleapis)

---

Need help? Check the troubleshooting section above or review the error messages carefully - they usually indicate what's missing or misconfigured.
