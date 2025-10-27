import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { TailoredDocument, TailoredDocumentType, ResumeContent } from '../types';
import { downloadDocxFile, downloadElementAsPdf } from '../utils/fileUtils';
import { LoadingSpinner, TrashIcon, PencilIcon, BriefcaseIcon, ResumeIcon } from './icons';
import { renderResumeHtmlForPdf } from './ResumeHub'; // Import the new structured resume renderer

// Helper to render basic markdown-like formatting for PDF export
const renderPrintableContent = (content: string, type: TailoredDocumentType, resumeContent?: ResumeContent) => {
  let htmlOutput = '';
  // Basic markdown for strong and emphasis
  const formatMarkdown = (text: string) => {
    if (!text) return ''; // Defensive check
    let processedText = text.replace(/\*\*(.*?)\*\*/g, '<span class="pdf-strong">$1</span>');
    processedText = processedText.replace(/\*(.*?)\*/g, '<span class="pdf-em">$1</span>');
    return processedText;
  };

  if (type === 'resume') {
    if (resumeContent) {
      // Use the structured renderer for resumes if ResumeContent is available
      htmlOutput = renderResumeHtmlForPdf(resumeContent);
    } else {
      // Fallback: If resumeContent isn't provided (e.g., older document), render raw text with basic paragraph formatting
      htmlOutput = `<div class="pdf-content-wrapper">`;
      content.split('\n\n').forEach((paragraph, pIdx) => {
        if (paragraph.trim()) {
          htmlOutput += `<p class="pdf-p pdf-text-sm">${formatMarkdown(paragraph.split('\n').map(line => line.trim()).filter(Boolean).join(' '))}</p>`;
        }
      });
      htmlOutput += `</div>`;
    }
  } else { // coverLetter
    const paragraphs = content.split('\n\n'); // Split by double newline for distinct paragraphs
    
    htmlOutput += `<div class="pdf-content-wrapper">`;
    paragraphs.forEach((paragraph, index) => {
      const trimmedParagraph = paragraph.trim();
      if (trimmedParagraph) {
        // Handle lines within a paragraph, applying markdown and simple line breaks
        const formattedLines = trimmedParagraph.split('\n').map(line => formatMarkdown(line)).join('<br/>');
        htmlOutput += `<p class="pdf-p">${formattedLines}</p>`;
      } else {
        htmlOutput += `<p class="pdf-mb-1">&nbsp;</p>`; // Preserve empty lines between paragraphs
      }
    });
    htmlOutput += `</div>`;
  }

  return htmlOutput;
};

const TailoredDocuments: React.FC = () => {
  const { tailoredDocuments, setTailoredDocuments, setError, selectedTailoredDocumentId, setSelectedTailoredDocumentId } = useAppContext();
  const [selectedDocument, setSelectedDocument] = useState<TailoredDocument | null>(null);
  const [editedContent, setEditedContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const printableDivRef = useRef<HTMLDivElement>(null);

  // Effect to react to selectedTailoredDocumentId from AppContext
  useEffect(() => {
    if (selectedTailoredDocumentId) {
      const doc = tailoredDocuments.find(d => d.id === selectedTailoredDocumentId);
      if (doc) {
        setSelectedDocument(doc);
        setEditedContent(doc.content);
        setIsEditing(false); // Always start in view mode when navigated
        setError(null);
      } else {
        // If ID is set but document not found (e.g., deleted), clear selection
        setSelectedDocument(null);
        setEditedContent('');
        setSelectedTailoredDocumentId(null); // Clear context ID
        setError("Selected tailored document not found or was deleted.");
      }
    } else if (!selectedDocument) {
        // If no ID is set globally and no local selection, ensure content is empty
        setEditedContent('');
    }
  }, [selectedTailoredDocumentId, tailoredDocuments, setError, setSelectedTailoredDocumentId, selectedDocument]); // Added selectedDocument to deps for proper reset

  const handleSelectDocument = (doc: TailoredDocument) => {
    setSelectedDocument(doc);
    setEditedContent(doc.content);
    setIsEditing(false); // Always start in view mode
    setError(null);
    setSelectedTailoredDocumentId(doc.id); // Update context when selected locally
  };

  const handleSaveEdits = () => {
    if (!selectedDocument || !editedContent.trim()) {
      setError("No document selected or content is empty.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      setTailoredDocuments(prev => prev.map(doc =>
        doc.id === selectedDocument.id ? { ...doc, content: editedContent } : doc
      ));
      setSelectedDocument(prev => prev ? { ...prev, content: editedContent } : null); // Update local state too
      setIsEditing(false);
      setError("Document updated successfully!"); // Use setError for success message
    } catch (e: any) {
      setError(`Failed to save edits: ${e.message || 'Unknown error.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDocument = (id: string) => {
    setTailoredDocuments(prev => prev.filter(doc => doc.id !== id));
    if (selectedDocument?.id === id) {
      setSelectedDocument(null);
      setEditedContent('');
      setSelectedTailoredDocumentId(null); // Clear context ID if deleted
    }
    setError("Document deleted.");
  };

  const handleDownloadDocx = () => {
    if (selectedDocument) {
      downloadDocxFile(`${selectedDocument.name}.docx`, editedContent);
      // Removed setError("Downloading DOCX...") as it's not an error
    } else {
      setError("No document selected for download.");
    }
  };

  const handleDownloadPdf = () => {
    if (selectedDocument && printableDivRef.current) {
        // Create a temporary div for PDF content, as `printableDivRef.current` might not have structured content
        const tempPdfContentDiv = document.createElement('div');
        tempPdfContentDiv.id = 'temp-pdf-content';
        tempPdfContentDiv.innerHTML = renderPrintableContent(
            selectedDocument.content,
            selectedDocument.type,
            // Pass resume content if it's a resume. This requires fetching the resume first.
            selectedDocument.type === 'resume' ? null : undefined // Currently, we don't store parsed content in TailoredDocument. This will need adjustment if needed.
                                                                // For now, renderResumeHtmlForPdf expects ResumeContent directly.
                                                                // For Tailored Docs, we will render from the 'content' string itself.
        );

        // Append to body temporarily
        document.body.appendChild(tempPdfContentDiv);

        downloadElementAsPdf('temp-pdf-content', `${selectedDocument.name}.pdf`)
            .finally(() => {
                // Clean up the temporary div
                document.body.removeChild(tempPdfContentDiv);
            });
    } else {
      setError("No document selected for PDF download.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Tailored Documents</h2>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
          Manage your AI-generated resumes and cover letters. Edit, download, and fine-tune for your applications.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Document List */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg h-full overflow-y-auto">
          <h3 className="text-xl font-semibold mb-4">My Tailored Documents</h3>
          {tailoredDocuments.length === 0 ? (
            <p className="text-center text-gray-500 pt-4">No tailored documents saved yet. Generate one from the Application Generator!</p>
          ) : (
            <div className="space-y-2">
              {tailoredDocuments.map(doc => (
                <div key={doc.id} onClick={() => handleSelectDocument(doc)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors border-2 ${selectedDocument?.id === doc.id ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-500' : 'bg-gray-100 dark:bg-gray-700/50 border-transparent hover:border-blue-400'}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{doc.name}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {doc.type === 'resume' ? <ResumeIcon className="w-4 h-4 inline-block mr-1 text-blue-500" /> : <BriefcaseIcon className="w-4 h-4 inline-block mr-1 text-purple-500" />}
                        {doc.type === 'resume' ? 'Tailored Resume' : 'Cover Letter'} for {doc.jobTitle}
                      </p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc.id); }} className="text-xs font-semibold text-red-600 hover:underline">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Document Viewer/Editor */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg h-full">
          {selectedDocument ? (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">{selectedDocument.name}</h3>
                <div className="flex gap-2 items-center">
                  <button onClick={() => setIsEditing(!isEditing)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm">
                    {isEditing ? 'View Mode' : 'Edit Content'}
                  </button>
                  <button onClick={handleDownloadDocx} disabled={isSaving} className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50">
                    Download DOCX
                  </button>
                  <button onClick={handleDownloadPdf} disabled={isSaving} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50">
                    Download PDF
                  </button>
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-4">
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full h-96 p-3 border rounded-lg bg-gray-50 dark:bg-gray-700/50 font-mono text-sm"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={handleSaveEdits} disabled={isSaving || editedContent === selectedDocument.content} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">
                      {isSaving ? <LoadingSpinner className="w-5 h-5" /> : 'Save Edits'}
                    </button>
                    <button onClick={() => { setEditedContent(selectedDocument.content); setIsEditing(false); setError(null); }} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="prose dark:prose-invert max-w-none w-full h-96 p-3 border rounded-lg bg-gray-50 dark:bg-gray-700/50 overflow-y-auto">
                  {/* Render content for viewing, using basic paragraph splits */}
                  {editedContent.split('\n\n').map((paragraph, pIdx) => (
                      <p key={pIdx} className="mb-2">
                          {paragraph.split('\n').map((line, lIdx) => (
                              <React.Fragment key={`${pIdx}-${lIdx}`}>
                                  {line}
                                  {lIdx < paragraph.split('\n').length - 1 && <br />}
                              </React.Fragment>
                          ))}
                      </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex justify-center items-center h-full text-center">
              <p className="text-gray-500 dark:text-gray-400">Select a tailored document to view or edit.</p>
            </div>
          )}
        </div>
      </div>

      {/* Hidden div for PDF generation */}
      {/* The content of this div will be dynamically set by handleDownloadPdf before calling downloadElementAsPdf */}
      <div className="absolute -left-[9999px] top-0" id="printable-tailored-content" ref={printableDivRef}>
        {/* Content will be inserted here dynamically by handleDownloadPdf */}
      </div>
    </div>
  );
};

export default TailoredDocuments;