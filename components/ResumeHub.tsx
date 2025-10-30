import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Resume, ResumeContent, ResumeVersion, Experience, Education } from '../types';
import { parseResumeText } from '../services/geminiService';
import { LoadingSpinner, TrashIcon, PencilIcon, CheckSquareIcon } from './icons';
import { downloadDocxFile } from '../utils/fileUtils';

import * as pdfjsLib from 'pdfjs-dist/build/pdf';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://aistudiocdn.com/pdfjs-dist@5.4.296/build/pdf.worker.min.js';


// Helper to render basic markdown-like formatting for display
const formattedMarkdown = (text: string = '') => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
    .replace(/\*(.*?)\*/g, '<em>$1</em>')    // Italic
    .split('\n')
    .map((line, index) => {
      line = line.trim();
      if (line.startsWith('* ') || line.startsWith('- ')) {
        return <li key={index} className="ml-4">{line.substring(2)}</li>;
      }
      if (line.length > 0) {
        return <p key={index} className="mb-2" dangerouslySetInnerHTML={{ __html: line }}></p>;
      }
      return null;
    });
};

// Helper function to extract text from various file types
const extractTextFromFile = async (file: File): Promise<string> => {
  const fileType = file.type;
  if (fileType === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    return fullText;
  } else if (fileType === 'text/plain') {
    return file.text();
  } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileType === 'application/msword') {
    return Promise.reject(new Error("DOCX text extraction is not directly supported in the browser. Please manually copy-paste the text or use a TXT/PDF file."));
  } else {
    return Promise.reject(new Error("Unsupported file type. Please upload a TXT, PDF, or DOCX file."));
  }
};


export const ResumeHub: React.FC = () => {
  const { resumes, setResumes, defaultResumeId, setDefaultResumeId, setError } = useAppContext();
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingResume, setEditingResume] = useState<Resume | null>(null);
  const [editingContent, setEditingContent] = useState<ResumeContent | null>(null);
  const [newVersionName, setNewVersionName] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [resumeToDeleteId, setResumeToDeleteId] = useState<string | null>(null);
  const [showContactInfoModal, setShowContactInfoModal] = useState(false);
  const [currentContactInfo, setCurrentContactInfo] = useState<ResumeContent['contactInfo'] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null); // New ref for JSON file input


  useEffect(() => {
    // When selected resume for editing changes, update editingContent
    if (editingResume) {
      setEditingContent(editingResume.activeContent);
      setResumeText(editingResume.activeContent.rawText); // Also set raw text for display
    } else {
      setEditingContent(null);
      setResumeText('');
    }
  }, [editingResume]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setIsLoading(true);
      setError(null); // Clear any previous errors

      try {
        const text = await extractTextFromFile(selectedFile);
        setResumeText(text);
        setError(null); // Clear error if successful
      } catch (err: any) {
        setError(err.message || "Error reading/parsing file.");
        setResumeText('');
      } finally {
        setIsLoading(false);
        // Clear the file input value to allow re-uploading the same file
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
      }
    }
  };


  // New: Handle JSON file upload
  const handleLoadJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const jsonFile = e.target.files[0];
      setIsLoading(true);
      setError(null);
      try {
        const fileContent = await jsonFile.text();
        const rawParsedData: Partial<Resume> = JSON.parse(fileContent);

        // Basic validation and normalization for safety
        if (
            rawParsedData &&
            typeof rawParsedData === 'object' &&
            rawParsedData.activeContent &&
            typeof rawParsedData.activeContent.rawText === 'string' &&
            Array.isArray(rawParsedData.activeContent.skills) &&
            Array.isArray(rawParsedData.activeContent.experience) &&
            Array.isArray(rawParsedData.activeContent.education) &&
            rawParsedData.activeContent.contactInfo &&
            typeof rawParsedData.activeContent.contactInfo.name === 'string'
        ) {
            // Apply normalization similar to how AppContext initializes
            const newResume: Resume = {
                id: rawParsedData.id || `resume-${Date.now()}`,
                name: rawParsedData.name || jsonFile.name.replace('.json', '') || `Loaded Resume ${resumes.length + 1}`,
                activeContent: {
                    rawText: rawParsedData.activeContent.rawText,
                    skills: rawParsedData.activeContent.skills.filter((s: any) => typeof s === 'string'),
                    experience: (rawParsedData.activeContent.experience || []).map((exp: any) => ({
                        title: typeof exp.title === 'string' ? exp.title : '',
                        company: typeof exp.company === 'string' ? exp.company : '',
                        description: typeof exp.description === 'string' ? exp.description : '',
                    })).filter((exp: any) => exp.title || exp.company || exp.description),
                    education: (rawParsedData.activeContent.education || []).map((edu: any) => ({
                        institution: typeof edu.institution === 'string' ? edu.institution : '',
                        degree: typeof edu.degree === 'string' ? edu.degree : '',
                    })).filter((edu: any) => edu.institution || edu.degree),
                    contactInfo: {
                        name: typeof rawParsedData.activeContent.contactInfo.name === 'string' ? rawParsedData.activeContent.contactInfo.name : '',
                        address: typeof rawParsedData.activeContent.contactInfo.address === 'string' ? rawParsedData.activeContent.contactInfo.address : '',
                        phone: typeof rawParsedData.activeContent.contactInfo.phone === 'string' ? rawParsedData.activeContent.contactInfo.phone : '',
                        email: typeof rawParsedData.activeContent.contactInfo.email === 'string' ? rawParsedData.activeContent.contactInfo.email : '',
                        linkedin: typeof rawParsedData.activeContent.contactInfo.linkedin === 'string' ? rawParsedData.activeContent.contactInfo.linkedin : undefined,
                        github: typeof rawParsedData.activeContent.contactInfo.github === 'string' ? rawParsedData.activeContent.contactInfo.github : undefined,
                        portfolio: typeof rawParsedData.activeContent.contactInfo.portfolio === 'string' ? rawParsedData.activeContent.contactInfo.portfolio : undefined,
                    },
                },
                versions: Array.isArray(rawParsedData.versions)
                    ? rawParsedData.versions.map((version: any) => ({
                        content: {
                            rawText: typeof version.content.rawText === 'string' ? version.content.rawText : '',
                            skills: Array.isArray(version.content.skills) ? version.content.skills.filter((s: any) => typeof s === 'string') : [],
                            experience: (version.content.experience || []).map((exp: any) => ({
                                title: typeof exp.title === 'string' ? exp.title : '',
                                company: typeof exp.company === 'string' ? exp.company : '',
                                description: typeof exp.description === 'string' ? exp.description : '',
                            })).filter((exp: any) => exp.title || exp.company || exp.description),
                            education: (version.content.education || []).map((edu: any) => ({
                                institution: typeof edu.institution === 'string' ? edu.institution : '',
                                degree: typeof edu.degree === 'string' ? edu.degree : '',
                            })).filter((edu: any) => edu.institution || edu.degree),
                            contactInfo: { name: '', address: '', phone: '', email: '', ...version.content.contactInfo },
                        },
                        timestamp: typeof version.timestamp === 'number' ? version.timestamp : Date.now(),
                        versionName: typeof version.versionName === 'string' ? version.versionName : 'Imported Version',
                    }))
                    : [{ content: rawParsedData.activeContent, timestamp: Date.now(), versionName: 'Initial Import from JSON' }],
            };
            setResumes(prev => [...prev, newResume]);
            setEditingResume(newResume);
            setError("Resume imported successfully!");
        } else {
            setError("Invalid JSON format for resume. Missing required fields or incorrect types.");
        }
      } catch (err: any) {
        setError(`Failed to load JSON: ${err.message || 'Invalid JSON file.'}`);
      } finally {
        setIsLoading(false);
        // Clear the file input value to allow re-uploading the same file
        if (jsonFileInputRef.current) {
          jsonFileInputRef.current.value = '';
        }
      }
    }
  };

  // New: Handle JSON file export
  const handleExportJson = useCallback(() => {
    if (editingResume) {
      const resumeJson = JSON.stringify(editingResume, null, 2); // Pretty print JSON
      const blob = new Blob([resumeJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${editingResume.name}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setError(`Exported "${editingResume.name}.json"`);
    } else {
      setError("No resume selected to export.");
    }
  }, [editingResume, setError]);


  const handleParseResume = useCallback(async () => {
    if (!resumeText.trim()) {
      setError('Please upload a resume file or paste text to parse.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const parsedContent = await parseResumeText(resumeText);
      const newResume: Resume = {
        id: `resume-${Date.now()}`,
        name: file?.name.replace(/\.[^/.]+$/, "") || `New Resume ${resumes.length + 1}`,
        activeContent: parsedContent,
        versions: [{ content: parsedContent, timestamp: Date.now(), versionName: 'Initial Parse' }],
      };
      setResumes(prev => [...prev, newResume]);
      setEditingResume(newResume); // Automatically open the newly parsed resume for editing
      setFile(null); // Clear file input
      setResumeText(''); // Clear text area
    } catch (e: any) {
      setError(e.message || 'Failed to parse resume. Please check the content format.');
    } finally {
      setIsLoading(false);
    }
  }, [resumeText, file, resumes, setResumes, setError]);

  const handleSaveResume = useCallback(() => {
    if (editingResume && editingContent) {
      // Save current edited content as the active content
      const updatedResume = {
        ...editingResume,
        activeContent: editingContent,
      };
      // If the currently active content is different from the last saved version, create a new version
      const lastVersion = editingResume.versions[editingResume.versions.length - 1];
      if (JSON.stringify(lastVersion.content) !== JSON.stringify(editingContent)) {
        updatedResume.versions = [
          ...editingResume.versions,
          { content: editingContent, timestamp: Date.now(), versionName: newVersionName || `Version ${editingResume.versions.length + 1}` }
        ];
      }
      setResumes(prev => prev.map(r => (r.id === updatedResume.id ? updatedResume : r)));
      setError("Resume saved successfully!");
      setNewVersionName('');
      // Optionally, close editing mode or stay in it
    }
  }, [editingResume, editingContent, newVersionName, setResumes, setError]);


  const handleSetDefault = useCallback((id: string) => {
    setDefaultResumeId(id);
    setError("Default resume set!");
  }, [setDefaultResumeId, setError]);

  const confirmDelete = useCallback((id: string) => {
    setResumeToDeleteId(id);
    setShowConfirmDelete(true);
  }, []);

  const handleDeleteResume = useCallback(() => {
    if (resumeToDeleteId) {
      setResumes(prev => prev.filter(r => r.id !== resumeToDeleteId));
      if (defaultResumeId === resumeToDeleteId) {
        setDefaultResumeId(null);
      }
      if (editingResume?.id === resumeToDeleteId) {
        setEditingResume(null);
      }
      setResumeToDeleteId(null);
      setShowConfirmDelete(false);
      setError("Resume deleted successfully!");
    }
  }, [resumeToDeleteId, resumes, defaultResumeId, editingResume, setResumes, setDefaultResumeId, setError]);

  const handleLoadVersion = useCallback((version: ResumeVersion) => {
    if (editingResume) {
      setEditingContent(version.content);
      setError(`Loaded version: "${version.versionName}"`);
    }
  }, [editingResume, setError]);

  const handleOpenContactInfoModal = useCallback(() => {
    if (editingContent) {
      setCurrentContactInfo(editingContent.contactInfo);
      setShowContactInfoModal(true);
    }
  }, [editingContent]);

  const handleSaveContactInfo = useCallback(() => {
    if (editingContent && currentContactInfo) {
      setEditingContent(prev => prev ? { ...prev, contactInfo: currentContactInfo } : null);
      setShowContactInfoModal(false);
      setError("Contact info updated!");
    }
  }, [editingContent, currentContactInfo, setError]);

  const handleDownloadDocx = useCallback(() => {
    if (editingResume && editingContent) {
      const docName = `${editingResume.name}-v${editingResume.versions.length}.docx`;
      // Format content for DOCX. For simplicity, just use the rawText from activeContent for download.
      // A more sophisticated implementation would format the structured content.
      downloadDocxFile(docName, editingContent.rawText);
      setError(`Downloading "${docName}"`);
    } else {
      setError("No resume selected for download.");
    }
  }, [editingResume, editingContent, setError]);


  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Resume Hub</h2>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
          Upload, parse, edit, and manage multiple versions of your resumes.
        </p>
      </div>

      {/* Upload & Parse Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
        <h3 className="text-xl font-semibold mb-4">Upload & Parse New Resume</h3>
        <div className="flex flex-col md:flex-row gap-4">
          <label className="flex-none w-auto inline-flex items-center justify-center mr-4 py-2 px-4 rounded-full border-0 text-sm font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300 dark:hover:file:bg-blue-800 cursor-pointer">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".txt,.pdf,.docx"
              className="sr-only" // Hide the actual input visually
            />
            Choose File {file ? `(${file.name})` : ''}
          </label>
          <textarea
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Or paste your resume text here (e.g., from a PDF or DOCX that couldn't be parsed)."
            rows={6}
            className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-700/50 resize-y"
          ></textarea>
        </div>
        <button
          onClick={handleParseResume}
          disabled={isLoading || !resumeText.trim()}
          className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading ? <LoadingSpinner className="w-5 h-5" /> : 'Parse Resume'}
        </button>
      </div>

      {/* Resume List Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
        <h3 className="text-xl font-semibold mb-4">My Saved Resumes</h3>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <label className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg text-sm text-center cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                <input
                    type="file"
                    ref={jsonFileInputRef}
                    onChange={handleLoadJson}
                    accept=".json"
                    className="sr-only"
                    disabled={isLoading}
                />
                {isLoading ? <LoadingSpinner className="w-4 h-4" /> : null}
                Import JSON Resume
            </label>
            {editingResume && (
              <button
                onClick={handleExportJson}
                disabled={isLoading}
                className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50"
              >
                Export Selected as JSON
              </button>
            )}
        </div>
        {resumes.length === 0 ? (
          <p className="text-center text-gray-500 pt-4">No resumes saved yet. Upload and parse one above!</p>
        ) : (
          <ul className="space-y-3">
            {resumes.map(resume => (
              <li
                key={resume.id}
                className={`p-4 rounded-lg border-2 ${resume.id === defaultResumeId ? 'border-green-500 dark:border-green-400' : 'border-gray-200 dark:border-gray-700'} ${editingResume?.id === resume.id ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-gray-50 dark:bg-gray-700/50'} hover:shadow-md transition-shadow cursor-pointer`}
                onClick={() => setEditingResume(resume)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-lg">{resume.name}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Last Updated: {new Date(resume.activeContent.contactInfo.name ? resume.versions[resume.versions.length - 1].timestamp : 0).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {resume.id === defaultResumeId && (
                      <span className="text-green-600 dark:text-green-400 font-semibold text-sm">Default</span>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); handleSetDefault(resume.id); }} className="p-2 rounded-full text-blue-600 dark:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-600" title="Set as Default">
                      <CheckSquareIcon className="w-5 h-5" filled={resume.id === defaultResumeId} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); confirmDelete(resume.id); }} className="p-2 rounded-full text-red-600 dark:text-red-400 hover:bg-gray-200 dark:hover:bg-gray-600" title="Delete Resume">
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Resume Editor Section */}
      {editingResume && editingContent && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Editing: {editingResume.name}</h3>
            <div className="flex gap-2">
              <button onClick={() => setEditingResume(null)} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg text-sm">
                Close Editor
              </button>
            </div>
          </div>

          {/* Contact Info Editor */}
          <div className="mb-6 p-4 border rounded-lg dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-semibold">Contact Information</h4>
              <button onClick={handleOpenContactInfoModal} className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1">
                <PencilIcon className="w-4 h-4" /> Edit
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <p><strong>Name:</strong> {editingContent.contactInfo.name}</p>
              <p><strong>Email:</strong> {editingContent.contactInfo.email}</p>
              <p><strong>Phone:</strong> {editingContent.contactInfo.phone}</p>
              <p><strong>Address:</strong> {editingContent.contactInfo.address}</p>
              {editingContent.contactInfo.linkedin && <p><strong>LinkedIn:</strong> <a href={editingContent.contactInfo.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">{editingContent.contactInfo.linkedin}</a></p>}
              {editingContent.contactInfo.github && <p><strong>GitHub:</strong> <a href={editingContent.contactInfo.github} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">{editingContent.contactInfo.github}</a></p>}
              {editingContent.contactInfo.portfolio && <p><strong>Portfolio:</strong> <a href={editingContent.contactInfo.portfolio} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">{editingContent.contactInfo.portfolio}</a></p>}
            </div>
          </div>

          {/* Main Content Editor */}
          <label htmlFor="resume-editor" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Resume Content (Markdown supported)</label>
          <textarea
            id="resume-editor"
            value={editingContent.rawText}
            onChange={(e) => setEditingContent(prev => prev ? { ...prev, rawText: e.target.value } : null)}
            rows={20}
            className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-700/50 font-mono text-sm"
          ></textarea>
          
          <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex-1 w-full sm:w-auto">
              <label htmlFor="version-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Version Name (Optional)</label>
              <input
                id="version-name"
                type="text"
                value={newVersionName}
                onChange={(e) => setNewVersionName(e.target.value)}
                placeholder="e.g., 'Update for Google'"
                className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-700"
              />
            </div>
            <div className="flex gap-3 mt-4 sm:mt-0">
              <button
                onClick={handleSaveResume}
                disabled={isLoading || !editingContent.rawText.trim() || JSON.stringify(editingResume.activeContent) === JSON.stringify(editingContent)}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <LoadingSpinner className="w-5 h-5" /> : 'Save Edits'}
              </button>
              <button onClick={handleDownloadDocx} className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 font-bold py-3 px-4 rounded-lg text-sm">
                Download DOCX
              </button>
            </div>
          </div>

          {/* Version History */}
          <div className="mt-8 p-4 border rounded-lg dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <h4 className="font-semibold mb-3">Version History ({editingResume.versions.length})</h4>
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {editingResume.versions.map((version, index) => (
                <li key={index} className="flex justify-between items-center p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                  <div>
                    <p className="font-medium">{version.versionName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(version.timestamp).toLocaleString()}</p>
                  </div>
                  <button onClick={() => handleLoadVersion(version)} className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
                    Load
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" role="dialog" aria-modal="true" aria-labelledby="delete-resume-title">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 id="delete-resume-title" className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Confirm Delete</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">Are you sure you want to delete this resume? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteResume}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Info Modal */}
      {showContactInfoModal && currentContactInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" role="dialog" aria-modal="true" aria-labelledby="edit-contact-title">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 id="edit-contact-title" className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Edit Contact Information</h3>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveContactInfo(); }} className="space-y-4">
              <div>
                <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                <input
                  id="contact-name"
                  type="text"
                  value={currentContactInfo.name}
                  onChange={(e) => setCurrentContactInfo(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="mt-1 w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-700"
                  required
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                <input
                  id="contact-email"
                  type="email"
                  value={currentContactInfo.email}
                  onChange={(e) => setCurrentContactInfo(prev => prev ? { ...prev, email: e.target.value } : null)}
                  className="mt-1 w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-700"
                  required
                />
              </div>
              <div>
                <label htmlFor="contact-phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
                <input
                  id="contact-phone"
                  type="tel"
                  value={currentContactInfo.phone}
                  onChange={(e) => setCurrentContactInfo(prev => prev ? { ...prev, phone: e.target.value } : null)}
                  className="mt-1 w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-700"
                  required
                />
              </div>
              <div>
                <label htmlFor="contact-address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
                <input
                  id="contact-address"
                  type="text"
                  value={currentContactInfo.address}
                  onChange={(e) => setCurrentContactInfo(prev => prev ? { ...prev, address: e.target.value } : null)}
                  className="mt-1 w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-700"
                  required
                />
              </div>
              <div>
                <label htmlFor="contact-linkedin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">LinkedIn URL (Optional)</label>
                <input
                  id="contact-linkedin"
                  type="url"
                  value={currentContactInfo.linkedin || ''}
                  onChange={(e) => setCurrentContactInfo(prev => prev ? { ...prev, linkedin: e.target.value || undefined } : null)}
                  className="mt-1 w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-700"
                  placeholder="https://linkedin.com/in/yourname"
                />
              </div>
              <div>
                <label htmlFor="contact-github" className="block text-sm font-medium text-gray-700 dark:text-gray-300">GitHub URL (Optional)</label>
                <input
                  id="contact-github"
                  type="url"
                  value={currentContactInfo.github || ''}
                  onChange={(e) => setCurrentContactInfo(prev => prev ? { ...prev, github: e.target.value || undefined } : null)}
                  className="mt-1 w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-700"
                  placeholder="https://github.com/yourusername"
                />
              </div>
              <div>
                <label htmlFor="contact-portfolio" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Portfolio URL (Optional)</label>
                <input
                  id="contact-portfolio"
                  type="url"
                  value={currentContactInfo.portfolio || ''}
                  onChange={(e) => setCurrentContactInfo(prev => prev ? { ...prev, portfolio: e.target.value || undefined } : null)}
                  className="mt-1 w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-700"
                  placeholder="https://yourportfolio.com"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowContactInfoModal(false)}
                  className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};