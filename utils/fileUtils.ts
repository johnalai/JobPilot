
import FileSaver from 'file-saver';
import { marked } from 'marked';

/**
 * Converts Markdown content to a styled HTML string suitable for DOCX conversion.
 * Applies professional styling for headers, lists, and general text.
 * @param markdownContent The Markdown string to convert.
 * @returns Styled HTML string.
 */
function markdownToStyledHtml(markdownContent: string): string {
  // Use marked to convert markdown to basic HTML.
  // marked v12: marked.parse is synchronous.
  let contentHtml = "";
  try {
    contentHtml = marked.parse(markdownContent) as string;
  } catch (e) {
    console.error("Error parsing markdown for export:", e);
    contentHtml = markdownContent; // Fallback
  }

  // Apply custom styling and structure using CSS, embedded in a full HTML document
  // The xmlns namespaces are important for Word to interpret the HTML as a document
  const styledHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: 'Calibri', sans-serif;
          line-height: 1.15; /* Standard resume line height */
          color: #000000;
          mso-ascii-font-family:Calibri;
          mso-hansi-font-family:Calibri;
        }
        p { margin: 0 0 10px 0; }
        h1, h2, h3, h4, h5, h6 {
          font-family: 'Calibri', sans-serif;
          color: #2F5496; /* Professional blue for headers */
          margin-top: 12px;
          margin-bottom: 6px;
        }
        h1 { font-size: 24pt; text-align: center; text-transform: uppercase; letter-spacing: 2px; color: #000000; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
        h2 { font-size: 14pt; border-bottom: 1px solid #ccc; padding-bottom: 4px; text-transform: uppercase; margin-top: 20px; }
        h3 { font-size: 12pt; font-weight: bold; color: #333; }
        h4 { font-size: 11pt; font-style: italic; font-weight: normal; }
        ul { margin-left: 20px; padding-left: 0; }
        li { margin-bottom: 2px; }
        a { color: #0563C1; text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="Section1">
        ${contentHtml}
      </div>
    </body>
    </html>
  `;

  return styledHtml;
}


/**
 * Downloads a given content string as a DOCX file.
 * Uses a native HTML-to-Word method (MHTML/HTML-based) that works in all browsers without dependencies.
 * @param content The content string (can be Markdown or plain text).
 * @param filename The name of the file to download (e.g., "resume.docx").
 */
export async function downloadDocxFile(
  content: string,
  filename: string,
) {
  const htmlContent = markdownToStyledHtml(content);
  
  // Create a Blob with the Word document MIME type
  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/msword'
  });
  
  // Handle FileSaver import difference in ESM/CJS
  // @ts-ignore
  const saveAs = FileSaver.saveAs || FileSaver;
  saveAs(blob, filename);
}

/**
 * Converts a Blob or File object to a Base64 string.
 * @param blob The Blob or File to convert.
 * @returns A Promise that resolves with the Base64 string.
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the "data:mime/type;base64," prefix
      resolve(base64String.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Generates a unique ID (e.g., for resumes, jobs, applications).
 * @returns A unique ID string.
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
