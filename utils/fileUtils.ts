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
 * @param elementId - The ID of the HTML element to capture.
 * @param filename - The name for the downloaded PDF file.
 */
export const downloadElementAsPdf = async (elementId: string, filename: string) => {
  const input = document.getElementById(elementId);
  if (!input) {
    console.error(`Element with id ${elementId} not found.`);
    return;
  }

  // Add a temporary class to ensure dark mode styles are rendered correctly if needed
  const isDarkMode = document.documentElement.classList.contains('dark');
  if (isDarkMode) {
    input.classList.add('dark');
  }

  const canvas = await html2canvas(input, {
    scale: 2, // Higher scale for better quality
    backgroundColor: isDarkMode ? '#111827' : '#ffffff', // Set background color
    useCORS: true,
  });
  
  if (isDarkMode) {
    input.classList.remove('dark');
  }

  const imgData = canvas.toDataURL('image/png');
  
  // Calculate dimensions to fit the image in the PDF
  const pdf = new jspdf({
    orientation: 'portrait',
    unit: 'px',
    format: [canvas.width, canvas.height]
  });
  
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save(filename);
};