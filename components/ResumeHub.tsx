
import React, { useState, useEffect } from 'react';
// Import useAppContext from AppContext.tsx
import { useAppContext } from '../context/AppContext';
import { Resume, NormalizedResume, Job, AtsCheck } from '../types';
import { ArrowUpTrayIcon, DocumentTextIcon, PlusIcon, TrashIcon, PencilSquareIcon, CloudArrowDownIcon, MagnifyingGlassIcon, ChartBarIcon, EyeIcon, ChevronDownIcon, ChevronUpIcon, SparklesIcon } from '@heroicons/react/24/outline';
// Import CheckCircleIcon from @heroicons/react/24/solid
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { generateId, downloadDocxFile } from '../utils/fileUtils';
import { parseResumeText, findJobsFromResume, autoFixResume } from '../services/geminiService';
import MarkdownRenderer from './MarkdownRenderer';
// @ts-ignore - Import via importmap
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';

// Helper to safely format dates and prevent crashes from invalid date strings
const isValidDate = (date: any): boolean => {
  return date && !isNaN(new Date(date).getTime());
};

function ResumeHub() {
  const {
    resumes,
    addResume,
    updateResume,
    removeResume,
    currentResume,
    setCurrentResume,
    generateEmptyResume,
    setJobs,
    jobs,
    savedJobs,
    setCurrentView,
  } = useAppContext();

  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(
    currentResume?.id || null
  );
  const [editingResumeContent, setEditingResumeContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [isFindingJobs, setIsFindingJobs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'edit' | 'history'>('preview');
  const [expandedHistoryItem, setExpandedHistoryItem] = useState<string | null>(null);

  useEffect(() => {
    if (currentResume) {
      setSelectedResumeId(currentResume.id);
      setEditingResumeContent(currentResume.content);
    } else if (resumes?.length > 0) {
      // If no current resume, but resumes exist, select the first one
      setCurrentResume(resumes[0]);
    }
  }, [currentResume, resumes, setCurrentResume]);


  useEffect(() => {
    if (selectedResumeId) {
      const resume = resumes?.find(r => r.id === selectedResumeId);
      if (resume) {
        setEditingResumeContent(resume.content);
        setCurrentResume(resume);
      }
    } else {
      setEditingResumeContent('');
      setCurrentResume(null);
    }
    setIsEditing(false); // Exit editing mode when selection changes
    setViewMode('preview'); // Default to preview
  }, [selectedResumeId, resumes, setCurrentResume]);

  const extractTextFromPdf = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n\n';
      }
      return fullText;
    } catch (e) {
      console.error("Error extracting PDF text:", e);
      throw new Error("Failed to extract text from PDF. Please ensure it is a text-based PDF.");
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploading(true);
      setError(null);
      
      try {
        let content = '';
        
        if (file.type === 'application/pdf') {
          content = await extractTextFromPdf(file);
        } else {
          // Handle text/md files
          content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
          });
        }

        if (!content.trim()) {
          throw new Error("File appears to be empty or unreadable.");
        }

        const newResume: Resume = {
          id: generateId(),
          name: file.name.split('.')[0],
          content: content,
          uploadDate: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          normalizedContent: null, // Will be populated by AI parsing
          atsHistory: [], // Initialize empty ATS history
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        };
        addResume(newResume);
        setSelectedResumeId(newResume.id);
        setUploading(false);

        // Trigger AI parsing for normalization
        await handleParseResume(newResume.id, content);

      } catch (err: any) {
        setError(err.message || 'Failed to read file.');
        console.error('File upload error:', err);
        setUploading(false);
      }
    }
  };

  const handleParseResume = async (resumeId: string, content: string) => {
    setParsing(true);
    setError(null);
    try {
      const parsedData: NormalizedResume | null = await parseResumeText(content);
      if (parsedData) {
        updateResume(resumeId, { normalizedContent: parsedData });
      } else {
        setError('AI failed to parse resume. Please check content format.');
      }
    } catch (err) {
      setError('AI parsing error. Please try again later.');
      console.error('AI parsing error:', err);
    } finally {
      setParsing(false);
    }
  };

  const handleAddEmptyResume = () => {
    const newResume = generateEmptyResume();
    addResume(newResume);
    setSelectedResumeId(newResume.id);
    setViewMode('edit');
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (selectedResumeId) {
      updateResume(selectedResumeId, { content: editingResumeContent });
      setIsEditing(false);
      setViewMode('preview');
      // Re-parse resume if content changed significantly? Or on demand?
      handleParseResume(selectedResumeId, editingResumeContent);
    }
  };

  const handleDeleteResume = (id: string) => {
    if (window.confirm('Are you sure you want to delete this resume?')) {
      removeResume(id);
      if (selectedResumeId === id) {
        setSelectedResumeId(null); // Clear selection if deleted
      }
    }
  };

  const handleDownloadResume = (resume: Resume) => {
    const filename = `${(resume?.name || 'resume').replace(/\s/g, '_')}_${(resume?.id || 'id').substring(0, 5)}.docx`;
    downloadDocxFile(resume?.content || '', filename);
  };

  const handleFindJobs = async () => {
    if (!selectedResume) {
      setError('Please select a resume to find jobs for.');
      return;
    }
    setIsFindingJobs(true);
    setError(null);
    try {
      const foundJobsData = await findJobsFromResume(selectedResume.content);
      if (foundJobsData && foundJobsData.length > 0) {
        const newJobs: Job[] = foundJobsData.map(jobData => ({
          id: generateId(),
          title: jobData.title || 'N/A',
          company: jobData.company || 'N/A',
          location: jobData.location || 'N/A',
          description: jobData.description || 'N/A',
          sourceUrl: jobData.sourceUrl || '#',
          isSaved: false,
          requirements: jobData.requirements || [],
          niceToHave: jobData.niceToHave || [],
        }));
        setJobs(newJobs);
        setCurrentView('Find Jobs');
      } else {
        setError('AI could not find any matching jobs. You can try editing your resume to be more specific.');
      }
    } catch (err) {
      console.error("Error finding jobs from resume:", err);
      setError('An AI error occurred while searching for jobs. Please try again.');
    } finally {
      setIsFindingJobs(false);
    }
  };

  const handleAutoFix = async (check: AtsCheck) => {
    if (!selectedResume) return;
    
    // Find the job to get the description
    // We look in savedJobs first, then current search results (jobs)
    const job = savedJobs.find(j => j.id === check.jobId) || jobs.find(j => j.id === check.jobId);
    
    if (!job) {
        setError("Could not find the job description associated with this ATS check. Ensure the job is in your Saved Jobs.");
        return;
    }

    setParsing(true); // Use parsing state to show loading
    setError(null);

    try {
        const improvedContent = await autoFixResume(selectedResume.content, job.description, check.feedback);
        if (improvedContent) {
            updateResume(selectedResume.id, { content: improvedContent });
            // Re-parse to update structure
            await handleParseResume(selectedResume.id, improvedContent);
            setViewMode('preview');
            alert("Resume successfully auto-fixed based on ATS feedback!");
        } else {
            setError("Failed to generate auto-fixed content.");
        }
    } catch (err) {
        console.error("Auto-fix error:", err);
        setError("An error occurred while auto-fixing the resume.");
    } finally {
        setParsing(false);
    }
  };

  const toggleHistoryItem = (id: string) => {
    if (expandedHistoryItem === id) {
        setExpandedHistoryItem(null);
    } else {
        setExpandedHistoryItem(id);
    }
  }

  const selectedResume = resumes?.find(r => r.id === selectedResumeId);

  // Helper to get score color text
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Helper to get progress bar color background
  const getProgressBarColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getLatestAtsCheck = (resume: Resume) => {
    if (!resume.atsHistory || resume.atsHistory.length === 0) return null;
    return [...resume.atsHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  };

  return (
    <div className="resume-upload-section bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 min-h-[70vh]">
      <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 text-center">Your Resume Hub</h2>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Pane: Resume List & Actions */}
        <div className="md:w-1/3 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Manage Resumes</h3>

          <div className="flex flex-col space-y-3 mb-6">
            <label htmlFor="resume-upload" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow cursor-pointer text-center flex items-center justify-center transition-colors duration-200">
              {uploading ? (
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
              )}
              Upload Resume (PDF/TXT/MD)
            </label>
            <input
              id="resume-upload"
              type="file"
              accept=".txt,.md,.pdf"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <button
              onClick={handleAddEmptyResume}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow flex items-center justify-center transition-colors duration-200"
            >
              <PlusIcon className="h-5 w-5 mr-2" /> Create New Resume
            </button>
          </div>

          {error && (
            <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 px-3 py-2 rounded-md mb-4 text-sm">
              {error}
            </div>
          )}

          {(resumes?.length || 0) === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 mt-8">No resumes uploaded yet.</p>
          ) : (
            <ul className="space-y-3">
              {resumes?.map((resume) => {
                const latestCheck = getLatestAtsCheck(resume);
                return (
                  <li
                    key={resume?.id}
                    className={`bg-white dark:bg-gray-700 p-3 rounded-lg shadow-sm flex flex-col border cursor-pointer hover:shadow-md transition-shadow duration-200
                      ${selectedResumeId === resume?.id ? 'border-blue-500 dark:border-blue-400 shadow-lg' : 'border-gray-200 dark:border-gray-600'}`}
                    onClick={() => setSelectedResumeId(resume?.id)}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <p className="font-semibold text-gray-900 dark:text-white truncate pr-2">{resume?.name || 'Untitled Resume'}</p>
                      <div className="flex space-x-2 flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); if (resume) handleDownloadResume(resume); }}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200"
                          title="Download DOCX"
                        >
                          <CloudArrowDownIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); if (resume?.id) handleDeleteResume(resume.id); }}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200"
                          title="Delete Resume"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                    
                    {latestCheck && (
                      <div className="flex items-center mb-2 bg-gray-50 dark:bg-gray-800 rounded px-2 py-1 w-fit border border-gray-100 dark:border-gray-600">
                        <div className={`h-2.5 w-2.5 rounded-full mr-2 ${getProgressBarColor(latestCheck.score)}`}></div>
                        <span className="text-xs text-gray-600 dark:text-gray-300">
                          ATS Score: <span className={`font-bold ${getScoreColor(latestCheck.score)}`}>{latestCheck.score}</span>
                        </span>
                      </div>
                    )}

                    <p className="text-xs text-gray-500 dark:text-gray-400">Modified: {isValidDate(resume?.lastModified) ? new Date(resume.lastModified).toLocaleDateString() : 'N/A'}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Right Pane: Resume Editor/Preview */}
        <div className="md:w-2/3 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
          {selectedResume ? (
            <>
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white truncate max-w-md">{selectedResume.name}</h3>
                <div className="flex space-x-2">
                  {/* View Switcher Buttons */}
                  <button
                    onClick={() => { setViewMode('preview'); setIsEditing(false); }}
                    className={`p-2 rounded-full transition-colors duration-200 ${viewMode === 'preview' ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-100' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                    title="Preview"
                  >
                    <EyeIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => { setViewMode('edit'); setIsEditing(true); }}
                    className={`p-2 rounded-full transition-colors duration-200 ${viewMode === 'edit' ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-100' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                    title="Edit Resume"
                  >
                    <PencilSquareIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => { setViewMode('history'); setIsEditing(false); }}
                    className={`p-2 rounded-full transition-colors duration-200 ${viewMode === 'history' ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-100' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                    title="ATS History"
                  >
                    <ChartBarIcon className="h-5 w-5" />
                  </button>

                  <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>

                  <button
                    onClick={handleFindJobs}
                    className="p-2 rounded-full bg-teal-100 text-teal-700 hover:bg-teal-200 dark:bg-teal-900 dark:text-teal-300 dark:hover:bg-teal-800 transition-colors duration-200 flex items-center"
                    title="Find Matching Jobs with AI"
                    disabled={isFindingJobs || parsing}
                  >
                    {isFindingJobs ? (
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <MagnifyingGlassIcon className="h-5 w-5" />
                    )}
                  </button>
                  
                  {isEditing && (
                    <button
                      onClick={handleSaveEdit}
                      className="p-2 rounded-full bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800 transition-colors duration-200"
                      title="Save Changes"
                    >
                      <CheckCircleIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>

              {(parsing || isFindingJobs) && (
                <div className="flex items-center text-blue-600 dark:text-blue-400 mb-4">
                  <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{parsing ? 'Analyzing and normalizing resume with AI...' : 'Finding matching jobs with AI...'}</span>
                </div>
              )}

              {viewMode === 'edit' && (
                <textarea
                  className="w-full h-[500px] p-4 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500 resize-y"
                  value={editingResumeContent}
                  onChange={(e) => setEditingResumeContent(e.target.value)}
                />
              )}

              {viewMode === 'preview' && (
                <div>
                  {/* Show latest ATS score summary if available */}
                  {(() => {
                    const latest = getLatestAtsCheck(selectedResume);
                    if (latest) {
                      return (
                        <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg flex items-center justify-between">
                          <div className="flex items-center">
                            <ChartBarIcon className="h-8 w-8 text-blue-500 mr-3" />
                            <div>
                              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Latest ATS Score for "{latest.jobTitle}"</p>
                              <div className="flex items-center mt-1">
                                <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mr-3">
                                  <div className={`h-2.5 rounded-full ${getProgressBarColor(latest.score)}`} style={{ width: `${latest.score}%` }}></div>
                                </div>
                                <span className={`font-bold text-lg ${getScoreColor(latest.score)}`}>{latest.score}/100</span>
                              </div>
                            </div>
                          </div>
                          <button 
                            onClick={() => { setViewMode('history'); setExpandedHistoryItem(latest.id); }}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            View Details
                          </button>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  <div className="prose dark:prose-invert max-w-none text-gray-800 dark:text-gray-200">
                    <MarkdownRenderer>{selectedResume.content}</MarkdownRenderer>
                  </div>
                </div>
              )}

              {viewMode === 'history' && (
                <div className="ats-history-section">
                    {!selectedResume.atsHistory || selectedResume.atsHistory.length === 0 ? (
                        <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                            <ChartBarIcon className="h-16 w-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                            <p className="text-lg">No ATS history available.</p>
                            <p className="text-sm mt-2">Use the "Application Generator" to check your resume against job descriptions.</p>
                            <button 
                                onClick={() => setCurrentView('Application Generator')}
                                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                            >
                                Go to Application Generator
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {[...selectedResume.atsHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((check) => (
                                <div key={check.id} className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 overflow-hidden shadow-sm">
                                    <div 
                                        className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors gap-4"
                                        onClick={() => toggleHistoryItem(check.id)}
                                    >
                                        <div className="flex-grow">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-gray-900 dark:text-white text-lg">{check.jobTitle}</span>
                                                <span className="text-sm text-gray-500 dark:text-gray-300">at {check.company}</span>
                                            </div>
                                            <p className="text-xs text-gray-400">{new Date(check.date).toLocaleDateString()} {new Date(check.date).toLocaleTimeString()}</p>
                                        </div>
                                        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                                            <div className="flex flex-col items-end min-w-[120px]">
                                                <span className={`text-lg font-bold ${getScoreColor(check.score)}`}>{check.score}/100</span>
                                                <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-600 mt-1">
                                                    <div 
                                                        className={`h-2 rounded-full ${getProgressBarColor(check.score)}`} 
                                                        style={{ width: `${check.score}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                            {expandedHistoryItem === check.id ? (
                                                <ChevronUpIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
                                            ) : (
                                                <ChevronDownIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
                                            )}
                                        </div>
                                    </div>
                                    {expandedHistoryItem === check.id && (
                                        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                                            <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-2 border-b border-gray-200 dark:border-gray-700 pb-2">Detailed ATS Feedback</h4>
                                            <div className="prose dark:prose-invert max-w-none text-sm text-gray-700 dark:text-gray-300 pt-2">
                                                <MarkdownRenderer>{check.feedback}</MarkdownRenderer>
                                            </div>
                                            
                                            {check.jobId && (savedJobs.some(j => j.id === check.jobId) || jobs.some(j => j.id === check.jobId)) && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleAutoFix(check); }}
                                                    disabled={parsing}
                                                    className="mt-4 flex items-center bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {parsing ? (
                                                        <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                    ) : (
                                                        <SparklesIcon className="h-4 w-4 mr-2" />
                                                    )}
                                                    Auto-Fix Resume based on this Feedback
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
              )}

              {viewMode !== 'history' && selectedResume.normalizedContent && (
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                    <DocumentTextIcon className="h-6 w-6 mr-2 text-blue-600 dark:text-blue-400" />
                    AI-Parsed Structure
                  </h4>
                  <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md text-sm text-gray-800 dark:text-gray-200 overflow-x-auto">
                    {JSON.stringify(selectedResume.normalizedContent, null, 2)}
                  </pre>
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 mt-20 text-lg">
              Select a resume or upload/create a new one to view and edit.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ResumeHub;
