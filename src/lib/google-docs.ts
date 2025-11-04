import { google } from 'googleapis';
import type { docs_v1 } from 'googleapis';
import { getGoogleAuthClient, COMBINED_SCOPES } from './google-auth.js';

/**
 * Creates and returns authenticated Google Docs API client
 *
 * @returns Authenticated Docs v1 client
 */
export async function getDocsClient(): Promise<docs_v1.Docs> {
  const auth = await getGoogleAuthClient(COMBINED_SCOPES);
  const docs = google.docs({ version: 'v1', auth });
  return docs;
}

/**
 * Creates a new Google Doc with a title and initial content
 *
 * @param title - Document title
 * @param content - Array of text lines to insert (each line gets a newline)
 * @returns Document ID and URL
 */
export async function createDocWithContent(
  title: string,
  content: string[]
): Promise<{ documentId: string; documentUrl: string }> {
  const docs = await getDocsClient();

  // First, create the document with title
  const createResponse = await docs.documents.create({
    requestBody: {
      title,
    },
  });

  const documentId = createResponse.data.documentId!;

  // Then, add content using batchUpdate if we have content
  if (content.length > 0) {
    await insertTextToDoc(documentId, content);
  }

  return {
    documentId,
    documentUrl: `https://docs.google.com/document/d/${documentId}/edit`,
  };
}

/**
 * Inserts text into an existing Google Doc
 *
 * Uses endOfSegmentLocation to append text, which is the recommended approach
 * for multiple inserts.
 *
 * @param documentId - Target document ID
 * @param textLines - Array of text lines to insert (each gets a newline)
 */
export async function insertTextToDoc(
  documentId: string,
  textLines: string[]
): Promise<void> {
  const docs = await getDocsClient();

  // Build requests array - each line gets inserted with a newline
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
 * Inserts text at a specific index in the document
 *
 * Advanced usage - use insertTextToDoc for most cases.
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
 * Gets the content of a Google Doc
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

/**
 * Inserts formatted text with styling into a document
 *
 * @param documentId - Target document ID
 * @param text - Text to insert
 * @param formatting - Text style options (bold, italic, fontSize, color)
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
    // Get the current document to find where we inserted text
    const doc = await docs.documents.get({ documentId });
    const bodyStartIndex = 1;
    const currentLength = doc.data.body?.content?.reduce(
      (len, element) => {
        if (element.paragraph?.elements) {
          return len + element.paragraph.elements.reduce(
            (pLen, pElement) => pLen + (pElement.textRun?.content?.length || 0),
            0
          );
        }
        return len;
      },
      0
    ) || 0;

    const startIndex = bodyStartIndex;
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
