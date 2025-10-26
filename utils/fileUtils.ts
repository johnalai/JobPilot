import { Document, Packer, Paragraph } from 'docx';
import jspdf from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Triggers a browser download for the given text content.
 * @param filename - The name of the file to be downloaded.
 * @param content - The text content of the file.
 * @param mimeType - The MIME type of the file.
 */
export const downloadTextFile = (filename: string, content: string, mimeType: string = 'text/plain') => {
  const element = document.createElement('a');
  const file = new Blob([content], { type: mimeType });
  element.href = URL.createObjectURL(file);
  element.download = filename;
  document.body.appendChild(element); // Required for this to work in FireFox
  element.click();
  document.body.removeChild(element);
};

/**
 * Generates a .docx file from text content and triggers a download.
 * @param filename - The name of the file to be downloaded (e.g., 'resume.docx').
 * @param content - The text content to be included in the document.
 */
export const downloadDocxFile = async (filename: string, content: string) => {
  const paragraphs = content.split('\n').map(text => new Paragraph({ text }));
  
  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  
  const element = document.createElement('a');
  element.href = url;
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
  URL.revokeObjectURL(url);
};

/**
 * Captures an HTML element by its ID, converts it to a canvas, and downloads it as a PDF.
 * This function is updated to apply a specific CSS class for consistent PDF styling
 * and to ensure standard 1-inch margins on the PDF document.
 * @param elementId - The ID of the HTML element to capture.
 * @param filename - The name for the downloaded PDF file.
 */
export const downloadElementAsPdf = async (elementId: string, filename: string) => {
  const input = document.getElementById(elementId);
  if (!input) {
    console.error(`Element with id ${elementId} not found.`);
    return;
  }

  // Store original styles to restore after capture
  const originalDisplay = input.style.display;
  const originalPosition = input.style.position;
  const originalLeft = input.style.left;
  const originalWidth = input.style.width;
  const originalHeight = input.style.height;

  // Temporarily make the element visible and in flow for html2canvas to capture correctly.
  // The .pdf-content-wrapper class now handles the internal width/height.
  input.style.display = 'block';
  input.style.position = 'static';
  input.style.left = '0';
  input.classList.add('pdf-content-wrapper'); // Add the styling class

  // Capture the HTML element as a canvas image
  const canvas = await html2canvas(input, {
    scale: 2, // Higher scale for better quality
    backgroundColor: '#ffffff', // Always use white background for PDF
    useCORS: true,
  });
  
  // Restore original styles and remove PDF class after capturing
  input.style.display = originalDisplay;
  input.style.position = originalPosition;
  input.style.left = originalLeft;
  input.style.width = originalWidth;
  input.style.height = originalHeight;
  input.classList.remove('pdf-content-wrapper');

  const imgData = canvas.toDataURL('image/png');
  
  // Initialize jsPDF with letter format (8.5in x 11in)
  const pdf = new jspdf({
    orientation: 'portrait',
    unit: 'pt', // Use points for consistent sizing (1 inch = 72 points)
    format: 'letter' 
  });

  const pdfPageWidth = pdf.internal.pageSize.getWidth();  // e.g., 612 pt (8.5 * 72)
  const pdfPageHeight = pdf.internal.pageSize.getHeight(); // e.g., 792 pt (11 * 72)

  const margin = 72; // 1 inch in points

  // Calculate the printable area dimensions within the PDF page
  const printableAreaWidth = pdfPageWidth - 2 * margin; // e.g., 612 - 144 = 468 pt
  const printableAreaHeight = pdfPageHeight - 2 * margin; // e.g., 792 - 144 = 648 pt

  // Calculate the image's effective height when scaled to fit the printableAreaWidth
  // This maintains the aspect ratio of the captured canvas content.
  const scaledImgHeight = (canvas.height * printableAreaWidth) / canvas.width;

  let currentSourceY = 0; // Y-coordinate in the original canvas (in pixels)
  
  // Iterate to add pages for content taller than one printable area
  while (currentSourceY < canvas.height) {
    if (currentSourceY !== 0) {
      pdf.addPage();
    }

    // Determine how much of the source image (in pixels) fits on the current PDF printable area height
    const sourceHeightToDraw = Math.min(
      canvas.height - currentSourceY, // Remaining source height in pixels
      (printableAreaHeight / scaledImgHeight) * canvas.height // Source pixels that correspond to one PDF printable area height
    );
    
    // Calculate the actual height this segment will occupy on the PDF page (in points)
    const destinationHeightOnPage = (sourceHeightToDraw / canvas.height) * scaledImgHeight;

    // Add image slice to the PDF page, positioned with margins
    pdf.addImage(
      imgData,          // Image data URL
      'PNG',            // Image format
      margin,           // x-coordinate on PDF page (left margin)
      margin,           // y-coordinate on PDF page (top margin)
      printableAreaWidth, // width on PDF page (content width between margins)
      destinationHeightOnPage, // height on PDF page
      undefined,        // alias
      'NONE',           // compression
      0,                // rotation
      0,                // sx (source x start from canvas, usually 0)
      currentSourceY,   // sy (source y start from canvas in pixels)
      canvas.width,     // sWidth (source width from canvas in pixels)
      sourceHeightToDraw // sHeight (source height from canvas in pixels)
    );

    currentSourceY += sourceHeightToDraw; // Advance the source Y position for the next page
  }

  pdf.save(filename);
};