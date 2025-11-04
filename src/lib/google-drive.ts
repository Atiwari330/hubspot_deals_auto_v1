import { google } from 'googleapis';
import type { drive_v3 } from 'googleapis';
import { getGoogleAuthClient, COMBINED_SCOPES } from './google-auth.js';

/**
 * Creates and returns authenticated Google Drive API client
 *
 * @returns Authenticated Drive v3 client
 */
export async function getDriveClient(): Promise<drive_v3.Drive> {
  const auth = await getGoogleAuthClient(COMBINED_SCOPES);
  const drive = google.drive({ version: 'v3', auth });
  return drive;
}

/**
 * Creates an empty Google Doc in the specified folder
 *
 * @param fileName - Name of the document to create
 * @param folderId - Parent folder ID (optional, defaults to root)
 * @returns Created document metadata including ID and web view link
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
 * Uploads HTML content and converts it to a Google Doc
 *
 * This is useful for creating docs with formatted content directly.
 *
 * @param fileName - Name of the document to create
 * @param htmlContent - HTML content to convert to Google Doc format
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
 * Uploads a generic file to Google Drive
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
 * MIME types for common file formats
 */
export const MIME_TYPES = {
  GOOGLE_DOC: 'application/vnd.google-apps.document',
  GOOGLE_SHEET: 'application/vnd.google-apps.spreadsheet',
  GOOGLE_SLIDES: 'application/vnd.google-apps.presentation',
  PDF: 'application/pdf',
  TEXT: 'text/plain',
  HTML: 'text/html',
  JSON: 'application/json',
  CSV: 'text/csv',
};
