import 'dotenv/config';
import { google } from 'googleapis';
import http from 'http';
import { parse as parseUrl } from 'url';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as readline from 'readline';

// OAuth scopes needed for Drive and Docs
const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
];

const REDIRECT_URI = 'http://localhost:3000/oauth2callback';
const PORT = 3000;

/**
 * Prompt user for input
 */
function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Update .env file with refresh token
 */
function updateEnvFile(refreshToken: string, clientId?: string, clientSecret?: string) {
  const envPath = join(process.cwd(), '.env');

  let envContent: string;
  try {
    envContent = readFileSync(envPath, 'utf-8');
  } catch (error) {
    console.log('⚠️  No .env file found, creating new one...');
    envContent = '';
  }

  // Update or add OAuth credentials
  const updates = {
    GOOGLE_OAUTH_REFRESH_TOKEN: refreshToken,
    ...(clientId && { GOOGLE_OAUTH_CLIENT_ID: clientId }),
    ...(clientSecret && { GOOGLE_OAUTH_CLIENT_SECRET: clientSecret }),
  };

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      // Update existing
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      // Add new
      if (!envContent.endsWith('\n') && envContent.length > 0) {
        envContent += '\n';
      }
      envContent += `${key}=${value}\n`;
    }
  }

  writeFileSync(envPath, envContent, 'utf-8');
  console.log('✅ Updated .env file with OAuth credentials');
}

/**
 * Start HTTP server to receive OAuth callback
 */
function startCallbackServer(oauth2Client: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (req.url && req.url.startsWith('/oauth2callback')) {
          const url = parseUrl(req.url, true);
          const code = url.query.code as string;

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Authorization Successful</title>
                  <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                    h1 { color: #4CAF50; }
                    p { font-size: 18px; }
                  </style>
                </head>
                <body>
                  <h1>✅ Authorization Successful!</h1>
                  <p>You can close this window and return to the terminal.</p>
                </body>
              </html>
            `);

            server.close();
            resolve(code);
          } else {
            const error = url.query.error as string;
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Authorization Failed</title>
                  <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                    h1 { color: #f44336; }
                  </style>
                </head>
                <body>
                  <h1>❌ Authorization Failed</h1>
                  <p>Error: ${error || 'Unknown error'}</p>
                  <p>Please close this window and try again.</p>
                </body>
              </html>
            `);

            server.close();
            reject(new Error(`Authorization failed: ${error}`));
          }
        }
      } catch (error) {
        server.close();
        reject(error);
      }
    });

    server.listen(PORT, () => {
      console.log(`🌐 Callback server listening on http://localhost:${PORT}`);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('OAuth flow timed out after 5 minutes'));
    }, 5 * 60 * 1000);
  });
}

/**
 * Main setup function
 */
async function main() {
  console.log('━'.repeat(80));
  console.log('🔐 GOOGLE OAUTH 2.0 SETUP');
  console.log('━'.repeat(80));
  console.log('');
  console.log('This script will help you set up OAuth 2.0 authentication for Google Drive.');
  console.log('You will be prompted to log in with your Google account in a browser.');
  console.log('');

  // Get OAuth client credentials
  let clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  let clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log('⚠️  OAuth client credentials not found in .env file.');
    console.log('');
    console.log('You need to create an OAuth 2.0 Client ID in Google Cloud Console first.');
    console.log('See docs/google-oauth-setup.md for instructions.');
    console.log('');

    clientId = await prompt('Enter your OAuth Client ID: ');
    clientSecret = await prompt('Enter your OAuth Client Secret: ');

    if (!clientId || !clientSecret) {
      console.error('❌ Client ID and Secret are required.');
      process.exit(1);
    }
  }

  console.log('');
  console.log('✅ OAuth client credentials loaded');
  console.log('');

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    REDIRECT_URI
  );

  // Generate auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Required to get refresh token
    scope: SCOPES,
    prompt: 'consent', // Force consent screen to ensure refresh token
  });

  console.log('📋 Opening browser for authorization...');
  console.log('');
  console.log('If the browser doesn\'t open automatically, copy this URL:');
  console.log(authUrl);
  console.log('');

  // Try to open browser
  const platform = process.platform;
  const openCommand = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';

  try {
    const { exec } = require('child_process');
    exec(`${openCommand} "${authUrl}"`);
  } catch (error) {
    console.log('⚠️  Could not open browser automatically. Please open the URL manually.');
  }

  // Start callback server and wait for authorization code
  console.log('⏳ Waiting for authorization...');
  console.log('');

  try {
    const code = await startCallbackServer(oauth2Client);
    console.log('');
    console.log('✅ Authorization code received');
    console.log('');

    // Exchange code for tokens
    console.log('🔄 Exchanging authorization code for tokens...');
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      throw new Error(
        'No refresh token received. This can happen if you\'ve already authorized this app before. ' +
        'Try revoking access at https://myaccount.google.com/permissions and run this script again.'
      );
    }

    console.log('✅ Tokens received successfully');
    console.log('');

    // Save refresh token to .env
    console.log('💾 Saving credentials to .env file...');
    updateEnvFile(tokens.refresh_token, clientId, clientSecret);
    console.log('');

    console.log('━'.repeat(80));
    console.log('✨ SETUP COMPLETE!');
    console.log('━'.repeat(80));
    console.log('');
    console.log('Your OAuth credentials have been saved to .env file.');
    console.log('');
    console.log('You can now run:');
    console.log('  npm run deal-hygiene-gdrive');
    console.log('');
    console.log('Files will be created as you, using your Google Workspace storage.');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Error during OAuth setup:', error instanceof Error ? error.message : error);
    console.error('');
    process.exit(1);
  }
}

main();
