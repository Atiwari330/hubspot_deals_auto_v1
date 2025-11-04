import { google } from 'googleapis';
import type { Auth } from 'googleapis';

/**
 * OAuth scopes for Google Drive API
 */
export const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive', // Full Drive access (needed for shared folders)
];

/**
 * OAuth scopes for Google Docs API
 */
export const DOCS_SCOPES = [
  'https://www.googleapis.com/auth/documents', // Read/write Google Docs
];

/**
 * Combined scopes for both Drive and Docs operations
 */
export const COMBINED_SCOPES = [
  'https://www.googleapis.com/auth/drive', // Full Drive access (needed for shared folders)
  'https://www.googleapis.com/auth/documents',
];

/**
 * Authentication mode configuration
 */
const AUTH_MODE = process.env.GOOGLE_AUTH_MODE || 'oauth'; // 'oauth' or 'service-account'

/**
 * Creates authenticated Google API client using OAuth 2.0
 *
 * This method uses OAuth 2.0 with refresh tokens to authenticate as a user.
 * Files created will be owned by the authenticated user and use their storage quota.
 *
 * Required environment variables:
 * - GOOGLE_OAUTH_CLIENT_ID: OAuth client ID from Google Cloud Console
 * - GOOGLE_OAUTH_CLIENT_SECRET: OAuth client secret from Google Cloud Console
 * - GOOGLE_OAUTH_REFRESH_TOKEN: Refresh token obtained from initial auth flow
 *
 * @param scopes - Array of required OAuth scopes
 * @returns Authenticated GoogleAuth client
 * @throws Error if required credentials are missing
 */
export async function getGoogleAuthClientOAuth(
  scopes: string[]
): Promise<Auth.OAuth2Client> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Missing OAuth credentials. Required environment variables:\n' +
      '  - GOOGLE_OAUTH_CLIENT_ID\n' +
      '  - GOOGLE_OAUTH_CLIENT_SECRET\n' +
      '  - GOOGLE_OAUTH_REFRESH_TOKEN\n\n' +
      'Run "npm run google-oauth-setup" to complete OAuth setup.'
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'http://localhost:3000/oauth2callback' // Redirect URI (must match console config)
  );

  // Set credentials with refresh token
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  // Enable automatic token refresh
  oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      console.log('📝 New refresh token received (update your .env file)');
      // Note: Refresh tokens are rarely issued after the first time
    }
  });

  return oauth2Client;
}

/**
 * Creates authenticated Google API client using service account credentials from JSON
 *
 * This method is ideal for GitHub Actions and CI/CD environments where the entire
 * service account JSON is stored as a single environment variable.
 *
 * @param scopes - Array of required OAuth scopes
 * @returns Authenticated GoogleAuth client
 * @throws Error if GOOGLE_CREDENTIALS is not set or invalid
 */
export async function getGoogleAuthClientFromJSON(
  scopes: string[]
): Promise<Auth.GoogleAuth> {
  if (!process.env.GOOGLE_CREDENTIALS) {
    throw new Error(
      'GOOGLE_CREDENTIALS environment variable not set. ' +
      'Please set it to your service account JSON (as a minified string).'
    );
  }

  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes,
    });

    return auth;
  } catch (error) {
    throw new Error(
      `Failed to parse GOOGLE_CREDENTIALS: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
      'Ensure the JSON is properly formatted and minified.'
    );
  }
}

/**
 * Creates authenticated Google API client (auto-detects OAuth vs Service Account)
 *
 * This function automatically determines which authentication method to use:
 * 1. OAuth 2.0 (recommended) - if GOOGLE_OAUTH_CLIENT_ID is set
 * 2. Service Account - if GOOGLE_CREDENTIALS is set
 *
 * @param scopes - Array of required OAuth scopes
 * @returns Authenticated client (OAuth2Client or GoogleAuth)
 * @throws Error if required credentials are missing
 */
export async function getGoogleAuthClient(
  scopes: string[]
): Promise<Auth.OAuth2Client | Auth.GoogleAuth> {
  // Prefer OAuth 2.0 authentication (recommended for 2025+)
  if (process.env.GOOGLE_OAUTH_CLIENT_ID) {
    console.log('🔐 Using OAuth 2.0 authentication...');
    return getGoogleAuthClientOAuth(scopes);
  }

  // Fall back to service account authentication (legacy)
  if (process.env.GOOGLE_CREDENTIALS) {
    console.log('🔐 Using Service Account authentication...');
    console.log('⚠️  Note: Service accounts have storage quota limitations.');
    console.log('⚠️  Consider switching to OAuth 2.0 (run: npm run google-oauth-setup)');
    return getGoogleAuthClientFromJSON(scopes);
  }

  // Check for individual service account env vars
  const credentials = {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    project_id: process.env.GOOGLE_PROJECT_ID,
  };

  if (credentials.client_email && credentials.private_key) {
    console.log('🔐 Using Service Account authentication (individual env vars)...');
    console.log('⚠️  Note: Service accounts have storage quota limitations.');
    console.log('⚠️  Consider switching to OAuth 2.0 (run: npm run google-oauth-setup)');

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes,
    });

    return auth;
  }

  // No valid credentials found
  throw new Error(
    'No Google authentication credentials found.\n\n' +
    'Option 1 (Recommended): OAuth 2.0\n' +
    '  Run: npm run google-oauth-setup\n\n' +
    'Option 2: Service Account\n' +
    '  Set GOOGLE_CREDENTIALS environment variable\n\n' +
    'See docs/google-oauth-setup.md for detailed instructions.'
  );
}
