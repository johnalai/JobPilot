import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { TailoredDocument, TailoredDocumentType } from '../types';
import { downloadDocxFile, downloadElementAsPdf } from '../utils/fileUtils';
import { LoadingSpinner, TrashIcon, PencilIcon, BriefcaseIcon, ResumeIcon } from './icons';

// Helper to render basic markdown-like formatting for PDF export
const renderPrintableContent = (content: string, type: TailoredDocumentType) => {
  let htmlOutput = '';
  // Basic markdown for strong and emphasis
  const formatMarkdown = (text: string) => {
    if (!text) return ''; // Defensive check
    let processedText = text.replace(/\*\*(.*?)\*\*/g, '<span class="pdf-strong">$1</span>');
    processedText = processedText.replace(/\*(.*?)\*/g, '<span class="pdf-em">$1</span>');
    return processedText;
  };

  // Helper function to render an experience item
  function renderExperienceItem(itemLines: string[]): string {
    if (!itemLines || itemLines.length === 0) return ''; // Defensive check

    const format = (text: string) => formatMarkdown(text);
    let title = '';
    let company = '';
    let locationDate = '';
    const descriptionBullets: string[] = [];

    // Heuristic: First line might be "Title at Company" or "Title | Company"
    let firstLine = itemLines[0]?.trim() || ''; // Defensive access
    if (firstLine.match(/(\s*\|\s*){1,}/)) { // Contains pipes
        const parts = firstLine.split('|').map(s => s.trim());
        title = parts[0] || '';
        company = parts[1] || '';
        locationDate = parts.slice(2).filter(Boolean).join(', ') || ''; // Filter out empty parts
    } else if (firstLine.includes(' at ')) { // "Title at Company"
        const parts = firstLine.split(' at ');
        title = parts[0] || '';
        company = parts.slice(1).filter(Boolean).join(' at ') || '';
    } else { // Assume first line is just title
        title = firstLine;
    }

    // Remaining lines are description or more specific location/date
    for (let i = 1; i < itemLines.length; i++) {
        const line = itemLines[i]?.trim(); // Defensive access
        if (!line) continue; // Skip if line is undefined or empty

        if (line.match(/(\d{4}\s*–\s*\d{4}|\d{4}\s*–\s*Present)/) && !locationDate) { // Looks like date/location
            locationDate = line;
        } else if (line.match(/^(•|-|\d+\.)\s*/)) { // Bullet point
            descriptionBullets.push(line.replace(/^(•|-|\d+\.)\s*/, ''));
        } else { // General descriptive text
            descriptionBullets.push(line);
        }
    }

    let itemHtml = `<div class="pdf-experience-item">`;
    itemHtml += `<div class="pdf-flex pdf-justify-between pdf-items-baseline">`;
    if (title) itemHtml += `<h3 class="pdf-job-title">${format(title)}</h3>`;
    if (company) itemHtml += `<p class="pdf-company-name pdf-text-sm">${format(company)}</p>`;
    itemHtml += `</div>`;
    if (locationDate) itemHtml += `<p class="pdf-location-date pdf-text-xs pdf-text-right pdf-block pdf-clear-both">${format(locationDate)}</p>`;
    if (descriptionBullets.length > 0) {
        itemHtml += `<ul class="pdf-ul">`;
        descriptionBullets.forEach(bullet => {
            if (bullet) itemHtml += `<li class="pdf-li pdf-text-sm">${format(bullet)}</li>`;
        });
        itemHtml += `</ul>`;
    }
    itemHtml += `</div>`;
    return itemHtml;
  }

  // Helper function to render an education item
  function renderEducationItem(itemLines: string[]): string {
    if (!itemLines || itemLines.length === 0) return ''; // Defensive check

    const format = (text: string) => formatMarkdown(text);
    let degree = '';
    let institution = '';
    let locationDate = '';

    // Heuristic: First line might be "Degree | Institution"
    let firstLine = itemLines[0]?.trim() || ''; // Defensive access
    if (firstLine.match(/(\s*\|\s*){1,}/)) {
        const parts = firstLine.split('|').map(s => s.trim());
        degree = parts[0] || '';
        institution = parts[1] || '';
        locationDate = parts.slice(2).filter(Boolean).join(', ') || '';
    } else { // Assume first line is degree, try to find institution in subsequent lines
        degree = firstLine;
        for (let i = 1; i < itemLines.length; i++) {
            const line = itemLines[i]?.trim(); // Defensive access
            if (!line) continue;

            if (line.match(/University|College|Institute|Academy/i)) {
                institution = line;
            } else if (line.match(/(\d{4}\s*–\s*\d{4}|\d{4}\s*–\s*Present)/)) {
                locationDate = line;
            }
        }
    }

    let itemHtml = `<div class="pdf-education-item">`;
    itemHtml += `<div class="pdf-flex pdf-justify-between pdf-items-baseline">`;
    if (degree) itemHtml += `<h3 class="pdf-degree-title">${format(degree)}</h3>`;
    if (institution) itemHtml += `<p class="pdf-institution-name pdf-text-sm">${format(institution)}</p>`;
    itemHtml += `</div>`;
    if (locationDate) itemHtml += `<p class="pdf-location-date pdf-text-xs pdf-text-right pdf-block pdf-clear-both">${format(locationDate)}</p>`;
    itemHtml += `</div>`;
    return itemHtml;
  }


  if (type === 'resume') {
    const sections: { [key: string]: string[] } = {
        'contact': [], 'summary': [], 'profile': [], 'skills': [], 'experience': [], 'education': [], 'projects': [], 'awards': [], 'certifications': [], // Removed 'misc'
    };

    const lines = (content || '').split('\n'); // Ensure content is a string
    let currentSection: keyof typeof sections | '' = '';

    lines.forEach(line => {
        const trimmedLine = line.trim();
        
        // Heuristic to detect sections (case-insensitive, handles optional colon)
        const sectionMatch = trimmedLine.match(/^(contact|summary|profile|skills|experience|education|projects|awards|certifications)( information)?:?$/i);
        if (sectionMatch) {
            currentSection = sectionMatch[1].toLowerCase() as keyof typeof sections;
            if (!sections[currentSection]) sections[currentSection] = []; // Initialize if new
        } else if (currentSection && sections[currentSection]) {
            sections[currentSection].push(line); // Push original line to preserve spacing
        } else {
            // Lines that don't belong to a recognized section or before the first section marker
            // are initially considered part of a potential "contact" block.
            // Push to contact regardless, then we will parse more carefully.
            sections['contact'].push(line);
        }
    });

    // Render Contact Info
    if (sections['contact'] && sections['contact'].filter(Boolean).length > 0) { // Defensive check and filter empty strings
        let nameLine = '';
        const contactAddressLines: string[] = [];
        const contactPhoneEmailLines: string[] = [];

        // Attempt to extract distinct contact info elements
        sections['contact'].forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;

            if (trimmed.match(/\S+@\S+\.\S+/)) { // Email pattern
                contactPhoneEmailLines.push(trimmed);
            } else if (trimmed.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/)) { // Phone number pattern
                contactPhoneEmailLines.push(trimmed);
            } else if (!nameLine && trimmed.split(' ').length < 5 && trimmed.length > 3 && !trimmed.match(/(\d{1,5}(?:\s(?:[A-Za-z]+\.?\s){1,4}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Place|Pl|Square|Sq|Terrace|Ter|Parkway|Pkwy|Circle|Cir|Highway|Hwy)\.?,?|apt\.?|suite\.?|box\s?\d{1,5}|[A-Z]{2}\s\d{5}|\d{5}))/i)) { // Heuristic for name: not email/phone, not too long, not obviously an address line
                nameLine = trimmed;
            } else { // Assume it's an address line or other non-name, non-phone/email contact detail
                contactAddressLines.push(trimmed);
            }
        });

        // Fallback for name: if no clear name found, take the very first non-empty line as name if it's not a clear contact detail itself
        if (!nameLine && sections['contact'].filter(Boolean).length > 0) {
            const potentialNameLine = sections['contact'].filter(Boolean)[0]?.trim();
            if (potentialNameLine && !potentialNameLine.match(/\S+@\S+\.\S+/) && !potentialNameLine.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/) && contactAddressLines.indexOf(potentialNameLine) === -1 && contactPhoneEmailLines.indexOf(potentialNameLine) === -1) {
                 nameLine = potentialNameLine;
            }
        }
        
        htmlOutput += `<div class="pdf-header-block">`;
        if (nameLine) htmlOutput += `<h1 class="pdf-h1">${formatMarkdown(nameLine)}</h1>`;
        // Join remaining contact details, prioritizing address then phone/email
        const allContactDetails = [
            ...contactAddressLines.filter(Boolean), 
            ...contactPhoneEmailLines.filter(Boolean)
        ].map(c => formatMarkdown(c));
        
        if (allContactDetails.length > 0) {
            htmlOutput += `<p class="pdf-text-lg">${allContactDetails.join(' | ')}</p>`;
        }
        htmlOutput += `</div>`;
    }

    // Render Summary/Profile
    const summaryContent = (sections['summary'] && sections['summary'].filter(Boolean).length > 0) ? sections['summary'] : 
                           (sections['profile'] && sections['profile'].filter(Boolean).length > 0 ? sections['profile'] : []);
    if (summaryContent.length > 0) {
        htmlOutput += `<div class="pdf-section">
            <h2 class="pdf-h2">Summary</h2>
            ${summaryContent.filter(Boolean).map(p => `<p class="pdf-p pdf-text-sm">${formatMarkdown(p)}</p>`).join('')}
        </div>`;
    }

    // Render Skills
    if (sections['skills'] && sections['skills'].filter(Boolean).length > 0) {
        // Attempt to clean and format skills, splitting by common delimiters
        const allSkills = sections['skills'].filter(Boolean).join(' ').split(/•|,|;|·/).map(s => s.trim()).filter(Boolean);
        if (allSkills.length > 0) {
            htmlOutput += `<div class="pdf-section">
                <h2 class="pdf-h2">Skills</h2>
                <p class="pdf-p pdf-text-sm">${formatMarkdown(allSkills.join(' • '))}</p>
            </div>`;
        }
    }

    // Render Experience (more robust parsing)
    if (sections['experience'] && sections['experience'].filter(Boolean).length > 0) {
        htmlOutput += `<div class="pdf-section">
            <h2 class="pdf-h2">Experience</h2>`;
            let currentItem: string[] = [];
            sections['experience'].forEach((line, idx) => {
                const trimmed = line.trim();

                // If line looks like a new job title/company, or if it's the first non-empty line after a break
                // Regex for new entry: starts with Capital letter, contains alpha/space/comma, optionally followed by 'at CompanyName' or year range (more specific)
                const isNewExperienceEntry = trimmed.match(/^[A-Z][a-zA-Z\s,]+(?: at [A-Z][a-zA-Z\s,]+)?(?:\s+\d{4}\s*–\s*(?:\d{4}|Present))?$/) ||
                                           (trimmed.match(/(\s*\|\s*){1,}/) && !trimmed.startsWith('•') && !trimmed.startsWith('-'));

                if (isNewExperienceEntry && currentItem.length > 0) {
                    htmlOutput += renderExperienceItem(currentItem);
                    currentItem = [];
                }
                if (trimmed) { // Only push non-empty lines
                    currentItem.push(line); // Push original line to preserve internal newlines
                } else if (currentItem.length > 0) { // Empty line acts as a separator
                    htmlOutput += renderExperienceItem(currentItem);
                    currentItem = [];
                }
            });
            if (currentItem.length > 0) {
                htmlOutput += renderExperienceItem(currentItem);
            }
        htmlOutput += `</div>`;
    }

    // Render Education (more robust parsing)
    if (sections['education'] && sections['education'].filter(Boolean).length > 0) {
        htmlOutput += `<div class="pdf-section">
            <h2 class="pdf-h2">Education</h2>`;
            let currentItem: string[] = [];
            sections['education'].forEach((line, idx) => {
                const trimmed = line.trim();

                // Regex for new entry: starts with Capital letter, contains alpha/space/comma, optionally followed by year
                const isNewEducationEntry = trimmed.match(/^[A-Z][a-zA-Z\s,]+(?:, [A-Z][a-zA-Z\s,]+)?(?:\s+\d{4})?$/) ||
                                            (trimmed.match(/(\s*\|\s*){1,}/) && !trimmed.startsWith('•') && !trimmed.startsWith('-'));
                
                if (isNewEducationEntry && currentItem.length > 0) {
                    htmlOutput += renderEducationItem(currentItem);
                    currentItem = [];
                }
                if (trimmed) { // Only push non-empty lines
                    currentItem.push(line); // Push original line to preserve internal newlines
                } else if (currentItem.length > 0) { // Empty line acts as a separator
                    htmlOutput += renderEducationItem(currentItem);
                    currentItem = [];
                }
            });
            if (currentItem.length > 0) {
                htmlOutput += renderEducationItem(currentItem);
            }
        htmlOutput += `</div>`;
    }

    // Render Projects/Awards/Certifications (general lists)
    if (sections['projects'] && sections['projects'].filter(Boolean).length > 0) {
        htmlOutput += `<div class="pdf-section">
            <h2 class="pdf-h2">Projects</h2>
            <ul class="pdf-ul">${sections['projects'].filter(Boolean).map(line => `<li class="pdf-li pdf-text-sm">${formatMarkdown(line.replace(/^(•|-|\d+\.)\s*/, ''))}</li>`).join('')}</ul>
        </div>`;
    }
    if (sections['awards'] && sections['awards'].filter(Boolean).length > 0) {
        htmlOutput += `<div class="pdf-section">
            <h2 class="pdf-h2">Awards</h2>
            <ul class="pdf-ul">${sections['awards'].filter(Boolean).map(line => `<li class="pdf-li pdf-text-sm">${formatMarkdown(line.replace(/^(•|-|\d+\.)\s*/, ''))}</li>`).join('')}</ul>
        </div>`;
    }
    if (sections['certifications'] && sections['certifications'].filter(Boolean).length > 0) {
        htmlOutput += `<div class="pdf-section">
            <h2 class="pdf-h2">Certifications</h2>
            <ul class="pdf-ul">${sections['certifications'].filter(Boolean).map(line => `<li class="pdf-li pdf-text-sm">${formatMarkdown(line.replace(/^(•|-|\d+\.)\s*/, ''))}</li>`).join('')}</ul>
        </div>`;
    }

    // Removed the rendering of the 'misc' section as requested.

  } else { // coverLetter
    const lines = (content || '').split('\n'); // Ensure content is a string
    
    // Attempt to identify and format the header block (Name, Address, Contact Info, Date)
    let headerBlock: string[] = [];
    let bodyLines: string[] = [];
    let inHeader = true;

    for (const line of lines) {
        if (inHeader) {
            if (line.trim() === '' && headerBlock.length > 0) {
                // First empty line after content typically separates header from body
                inHeader = false;
            } else if (line.trim() !== '') {
                headerBlock.push(line);
            }
        } else {
            bodyLines.push(line);
        }
    }

    // Render Header Block
    if (headerBlock.length > 0) {
        htmlOutput += `<div class="pdf-mb-6">`;
        headerBlock.forEach((line, index) => {
            const trimmed = line.trim();
            if (!trimmed) {
                htmlOutput += `<p class="pdf-mb-1">&nbsp;</p>`; // Preserve empty lines in header
            } else if (trimmed.match(/^[A-Z][a-z]+ \d{1,2}, \d{4}$/)) { // Simple date detection
                 htmlOutput += `<p class="pdf-text-right pdf-mb-1">${formatMarkdown(trimmed)}</p>`;
            } else if (index === 0 && !trimmed.includes('|') && !trimmed.includes('@')) { // Likely name
                htmlOutput += `<p class="pdf-h3 pdf-mb-1">${formatMarkdown(trimmed)}</p>`;
            } else {
                htmlOutput += `<p class="pdf-mb-1 pdf-text-sm">${formatMarkdown(trimmed)}</p>`;
            }
        });
        htmlOutput += `</div>`;
    }

    // Render Body
    if (bodyLines.length > 0) {
        let currentParagraph: string[] = [];
        bodyLines.forEach((line, index) => {
            const trimmed = line.trim();
            if (trimmed === '' && currentParagraph.length > 0) {
                // End of paragraph
                htmlOutput += `<p class="pdf-p pdf-mt-4 pdf-mb-4">${formatMarkdown(currentParagraph.join(' '))}</p>`;
                currentParagraph = [];
            } else if (trimmed !== '') {
                currentParagraph.push(trimmed);
            }
            if (index === bodyLines.length - 1 && currentParagraph.length > 0) {
                 htmlOutput += `<p class="pdf-p pdf-mt-4 pdf-mb-4">${formatMarkdown(currentParagraph.join(' '))}</p>`;
            }
        });
    }
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
      // The downloadElementAsPdf function now handles temporary visibility and styling
      downloadElementAsPdf('printable-tailored-content', `${selectedDocument.name}.pdf`)
        .then(() => {
          // Success handled by setError elsewhere or silently
        })
        .catch(e => {
          setError(`Failed to download PDF: ${e.message || 'Unknown error.'}`);
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
                  {editedContent.split('\n').map((line, index) => (
                    <p key={index} className="mb-1">{line}</p>
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
      <div className="absolute -left-[9999px] top-0" id="printable-tailored-content" ref={printableDivRef}>
        {selectedDocument && (
          <div dangerouslySetInnerHTML={{ __html: renderPrintableContent(selectedDocument.content, selectedDocument.type) }} />
        )}
      </div>
    </div>
  );
};

export default TailoredDocuments;