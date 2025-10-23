
import React, { useState, useCallback, useEffect } from 'react';
// FIX: Use relative paths for local module imports.
import { parseResumeText } from '../services/geminiService';
import { LoadingSpinner } from './icons';
import { useAppContext } from '../context/AppContext';
import { Resume, ResumeContent } from '../types';

const EditIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" />
    </svg>
);

const ResumeHub: React.FC = () => {
  const { resumes, setResumes, defaultResumeId, setDefaultResumeId } = useAppContext();
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [view, setView] = useState<'view' | 'add'>('view');
  
  const [rawText, setRawText] = useState('');
  const [newResumeName, setNewResumeName] = useState('');
  const [parsedContent, setParsedContent] = useState<ResumeContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [currentEditedName, setCurrentEditedName] = useState('');
  
  const selectedResume = resumes.find(r => r.id === selectedResumeId);
  
  useEffect(() => {
    // Reset edit mode when selected resume changes
    setIsEditingName(false);
  }, [selectedResumeId]);

  const resetAddForm = () => {
    setRawText('');
    setNewResumeName('');
    setParsedContent(null);
    setLoading(false);
    setStatusMessage('');
    setError(null);
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatusMessage('Extracting text from file...');
    setError(null);
    setParsedContent(null);
    setRawText('');

    try {
      let extractedText = '';
      if (file.type === 'application/pdf') {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.mjs`;
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        
        const textItems = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            textItems.push(...textContent.items.map(item => ('str' in item ? item.str : '')));
        }
        extractedText = textItems.join(' ');
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value;
      } else {
        throw new Error("Unsupported file type. Please upload a PDF or DOCX file.");
      }
      
      setRawText(extractedText);
      if (!newResumeName && file.name) {
        setNewResumeName(file.name.replace(/\.[^/.]+$/, "")); // Use filename as default name
      }
      await runAIParser(extractedText);

    } catch (e: any) {
      setError(e.message || "Failed to process the file.");
      setLoading(false);
      setStatusMessage('');
    }
    
    if(event.target) event.target.value = '';
  };
  
  const runAIParser = useCallback(async (textToParse: string) => {
    if (!textToParse.trim()) {
      setError("Text is empty. Please upload or paste resume content.");
      setLoading(false);
      return;
    }
    setStatusMessage('Parsing with AI...');
    setLoading(true);
    setError(null);
    try {
      const parsedData = await parseResumeText(textToParse);
      setParsedContent({ skills: [], experience: [], education: [], ...parsedData, rawText: textToParse });
    } catch (e: any) {
      setError(e.message || "Failed to parse resume.");
    } finally {
      setLoading(false);
      setStatusMessage('');
    }
  }, []);

  const handleSaveNewResume = () => {
    if (!newResumeName.trim() || !parsedContent) {
        setError("Please provide a name for the resume and ensure it has been parsed.");
        return;
    }
    const newResume: Resume = {
        id: Date.now().toString(),
        name: newResumeName,
        content: parsedContent
    };
    const isFirstResume = resumes.length === 0;
    setResumes(prev => [...prev, newResume]);
    if (isFirstResume) {
      setDefaultResumeId(newResume.id);
    }
    setView('view');
    setSelectedResumeId(newResume.id);
  };
  
  const handleDeleteResume = (idToDelete: string) => {
    setResumes(prev => prev.filter(r => r.id !== idToDelete));
    if (selectedResumeId === idToDelete) {
        setSelectedResumeId(null);
    }
  }

  const handleStartEditName = () => {
    if (selectedResume) {
        setIsEditingName(true);
        setCurrentEditedName(selectedResume.name);
    }
  };

  const handleSaveName = () => {
    if (selectedResume && currentEditedName.trim()) {
        setResumes(prev => prev.map(r => 
            r.id === selectedResume.id ? { ...r, name: currentEditedName.trim() } : r
        ));
        setIsEditingName(false);
    }
  };


  const renderResumeDetails = (resumeContent: ResumeContent) => (
    <div className="space-y-6 h-[28rem] overflow-y-auto pr-2">
      <div>
        <h4 className="font-semibold text-lg mb-2">Skills</h4>
        <div className="flex flex-wrap gap-2">
          {resumeContent.skills.map((skill, index) => (
            <span key={index} className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-sm font-medium px-2.5 py-1 rounded-full">
              {skill}
            </span>
          ))}
        </div>
      </div>
      <div>
        <h4 className="font-semibold text-lg mb-2">Experience</h4>
        <div className="space-y-4">
          {resumeContent.experience.map((exp, index) => (
            <div key={index} className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
              <p className="font-bold">{exp.title}</p>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{exp.company}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{exp.description}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="font-semibold text-lg mb-2">Education</h4>
        <div className="space-y-3">
          {resumeContent.education.map((edu, index) => (
            <div key={index} className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
              <p className="font-bold">{edu.institution}</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{edu.degree}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Resume Hub</h2>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">Manage your saved resumes. Add, view, and set a default for job searching.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Resume List */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
          <h3 className="text-xl font-semibold mb-4">My Resumes</h3>
          <div className="space-y-2">
            {resumes.map(resume => (
              <div key={resume.id} onClick={() => { setSelectedResumeId(resume.id); setView('view'); }}
                className={`p-3 rounded-lg cursor-pointer transition-colors border-2 ${selectedResumeId === resume.id ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-500' : 'bg-gray-100 dark:bg-gray-700/50 border-transparent hover:border-blue-400'}`}>
                <div className="flex justify-between items-center">
                    <div>
                        <p className="font-semibold">{resume.name}</p>
                        {resume.id === defaultResumeId && <span className="text-xs text-green-600 dark:text-green-400 font-bold">Default</span>}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); setDefaultResumeId(resume.id); }} disabled={resume.id === defaultResumeId} className="text-xs font-semibold disabled:opacity-50 text-blue-600 hover:underline">Set Default</button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteResume(resume.id); }} className="text-xs font-semibold text-red-600 hover:underline">Delete</button>
                    </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => { setView('add'); setSelectedResumeId(null); resetAddForm(); }} className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
            + Add New Resume
          </button>
        </div>

        {/* Display/Add Section */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
          {view === 'add' ? (
            <div>
                <h3 className="text-xl font-semibold mb-4">Add New Resume</h3>
                <div className="space-y-4">
                    <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} placeholder="Paste resume text here, or upload a file."
                        className="w-full h-64 p-4 border rounded-lg bg-gray-50 dark:bg-gray-700"/>
                    <div className="flex gap-4">
                        <label className="cursor-pointer bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-semibold py-2 px-4 rounded-lg flex-1 text-center">
                            Upload File <input type="file" accept=".pdf,.docx" className="hidden" onChange={handleFileChange} disabled={loading}/>
                        </label>
                        <button onClick={() => runAIParser(rawText)} disabled={loading || !rawText} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 flex-1">
                          {loading ? <LoadingSpinner className="w-5 h-5 mx-auto"/> : 'Parse Content'}
                        </button>
                    </div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    {statusMessage && <p className="text-blue-500 text-sm text-center mt-2">{statusMessage}</p>}
                    {parsedContent && (
                        <div className="mt-4 p-4 border-t dark:border-gray-700">
                           {renderResumeDetails(parsedContent)}
                           <div className="mt-4 flex gap-4 items-center">
                             <input type="text" value={newResumeName} onChange={(e) => setNewResumeName(e.target.value)} placeholder="Enter a name for this resume" className="flex-grow p-2 border rounded-lg bg-gray-50 dark:bg-gray-700"/>
                             <button onClick={handleSaveNewResume} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Save Resume</button>
                           </div>
                        </div>
                    )}
                </div>
            </div>
          ) : selectedResume ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                  {isEditingName ? (
                      <div className="flex items-center gap-2 flex-grow">
                          <input
                              type="text"
                              value={currentEditedName}
                              onChange={(e) => setCurrentEditedName(e.target.value)}
                              className="flex-grow p-2 border rounded-lg bg-gray-50 dark:bg-gray-700 text-xl font-semibold"
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                          />
                          <button onClick={handleSaveName} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg text-sm">Save</button>
                          <button onClick={() => setIsEditingName(false)} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg text-sm">Cancel</button>
                      </div>
                  ) : (
                      <div className="flex items-center gap-3">
                          <h3 className="text-xl font-semibold">{selectedResume.name}</h3>
                          <button onClick={handleStartEditName} className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400">
                            <EditIcon className="w-5 h-5" />
                          </button>
                      </div>
                  )}
              </div>
              {renderResumeDetails(selectedResume.content)}
            </div>
          ) : (
             <div className="flex justify-center items-center h-full text-center">
                <p className="text-gray-500 dark:text-gray-400">Select a resume to view its details, or add a new one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResumeHub;
