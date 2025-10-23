import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Job, WebGroundingChunk } from '../types';
import { BookmarkIcon, LocationMarkerIcon, CalendarIcon, BriefcaseIcon, LoadingSpinner } from './icons';
import { analyzeJobUrl, analyzeJobText, KNOWN_PAYWALLED_DOMAINS } from '../services/geminiService';

const SavedJobs: React.FC = () => {
  const {
    savedJobs,
    setSavedJobs,
    setView,
    setGenerationContext,
    resumes,
    defaultResumeId,
  } = useAppContext();

  const [selectedJob, setSelectedJob] = useState<Job | null>(savedJobs.length > 0 ? savedJobs[0] : null);
  const [error, setError] = useState<string | null>(null);
  
  // State for the manual add modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'link' | 'text'>('link');
  const [modalInput, setModalInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [modalError, setModalError] = useState('');

  const defaultResume = resumes.find(r => r.id === defaultResumeId);

  const handleUnsaveJob = (jobToUnsave: Job) => {
    setSavedJobs(prev => prev.filter(job => job.id !== jobToUnsave.id));
    if (selectedJob?.id === jobToUnsave.id) {
        const nextJob = savedJobs.find(j => j.id !== jobToUnsave.id) || null;
        setSelectedJob(nextJob);
    }
  };
  
  const handleApply = (job: Job) => {
    if (!defaultResume) {
      setError("Please set a default resume in the Resume Hub before generating an application.");
      return;
    }
    setGenerationContext({ job, baseResume: defaultResume });
    setView('application-generator');
  };

  const handleManualAdd = async () => {
    if (!modalInput.trim()) {
        setModalError('Please paste a link or job details.');
        return;
    }
    setIsParsing(true);
    setModalError('');
    try {
        const partialJob = modalMode === 'link'
            ? await analyzeJobUrl(modalInput)
            : await analyzeJobText(modalInput);
        
        // FIX: Provide default values for required Job properties, as `partialJob` is a Partial<Job>.
        // Properties from `partialJob` will override these defaults.
        const newJob: Job = {
            id: `manual-${Date.now()}`,
            title: 'Untitled Job',
            company: 'Unknown Company',
            location: 'Not Specified',
            description: 'No description provided.',
            ...partialJob,
        };
        setSavedJobs(prev => [newJob, ...prev]);
        setSelectedJob(newJob);
        setIsModalOpen(false);
        setModalInput('');

    } catch (e: any) {
        setModalError(e.message || 'Failed to parse job details.');
    } finally {
        setIsParsing(false);
    }
  };

  const formattedMarkdown = (text: string = '') => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
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

  // Helper function to extract domain from URL
  const getDomain = (url: string) => {
    try {
        const hostname = new URL(url).hostname;
        // Remove 'www.' prefix if present
        return hostname.startsWith('www.') ? hostname.substring(4) : hostname;
    } catch (e) {
        return ''; // Invalid URL
    }
  };

  const renderGroundingLinks = (groundingChunks?: Job['grounding']) => {
    if (!groundingChunks || groundingChunks.length === 0) return null;

    const uniqueLinks = new Map<string, { uri: string, title?: string }>();

    groundingChunks.forEach(chunk => {
      let uri = '';
      let title = '';

      // Only process web grounding chunks, maps grounding is removed
      if ('web' in chunk && chunk.web?.uri) {
        uri = chunk.web.uri;
        title = chunk.web.title || uri;
      }
      
      // Filter out paywalled domains
      if (uri && !KNOWN_PAYWALLED_DOMAINS.includes(getDomain(uri))) {
        uniqueLinks.set(uri, { uri, title });
      }
    });

    if (uniqueLinks.size === 0) return null;

    return (
      <div className="mt-4 pt-4 border-t dark:border-gray-700">
        <h4 className="font-bold text-lg mb-2">Sources:</h4>
        <ul className="list-disc list-inside text-sm text-blue-600 dark:text-blue-400">
          {Array.from(uniqueLinks.values()).map((link, index) => (
            <li key={index}>
              <a href={link.uri} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {link.title || link.uri}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderJobDetails = (job: Job) => (
    <div className="p-6 h-full flex flex-col animate-fade-in">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-2xl font-bold">{job.title}</h3>
          <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">{job.company}</p>
          <div className="mt-2 space-y-1 text-sm text-gray-500 dark:text-gray-400">
            <p className="flex items-center gap-2"><LocationMarkerIcon className="w-4 h-4" /> {job.location || 'Not Specified'}</p>
            <p className="flex items-center gap-2"><BriefcaseIcon className="w-4 h-4" /> {job.workModel || 'Not Specified'}</p>
            <p className="flex items-center gap-2"><CalendarIcon className="w-4 h-4" /> {job.datePosted || 'Not Available'}</p>
          </div>
        </div>
        <button onClick={() => handleUnsaveJob(job)} title="Unsave Job" className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
          <BookmarkIcon className="w-6 h-6 text-yellow-500" filled={true} />
        </button>
      </div>
      <div className="mt-6 flex-grow overflow-y-auto pr-2">
        <h4 className="font-bold text-lg mb-2">Job Description</h4>
        <div className="prose prose-sm dark:prose-invert max-w-none">
            {formattedMarkdown(job.description)}
        </div>
        {renderGroundingLinks(job.grounding)}
      </div>
      <div className="mt-6 border-t dark:border-gray-700 pt-4 flex gap-3">
        {job.sourceUrl && (
          <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-center bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg">
            View Original Post
          </a>
        )}
        <button onClick={() => handleApply(job)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg">
          Generate Application
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Saved Jobs</h2>
      <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">Review and apply to jobs you've saved.</p>
      {error && <p className="text-red-500 mt-4 text-center">{error}</p>}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8" style={{ minHeight: '60vh' }}>
        <div className="md:col-span-1 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg h-full flex flex-col">
          <button onClick={() => setIsModalOpen(true)} className="w-full mb-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">
            + Add Job Manually
          </button>
          <div className="flex-grow overflow-y-auto">
            {savedJobs.length === 0 ? (
              <p className="text-center text-gray-500 pt-4">You have no saved jobs. Find jobs to save them.</p>
            ) : (
              <ul className="space-y-2">
                {savedJobs.map(job => (
                  <li key={job.id} onClick={() => setSelectedJob(job)}
                    className={`p-4 rounded-lg cursor-pointer transition-colors border-2 ${selectedJob?.id === job.id ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-500' : 'bg-gray-50 dark:bg-gray-700/50 border-transparent hover:border-blue-400'}`}>
                    <h4 className="font-bold">{job.title}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{job.company}</p>
                     <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 flex items-center justify-between">
                      <span className="flex items-center gap-1"><LocationMarkerIcon className="w-3 h-3"/>{job.location}</span>
                      {job.workModel && <span className="flex items-center gap-1"><BriefcaseIcon className="w-3 h-3"/>{job.workModel}</span>}
                      <span className="font-semibold">{job.datePosted}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
          {selectedJob ? renderJobDetails(selectedJob) : (
            <div className="flex justify-center items-center h-full">
              <p className="text-gray-500 dark:text-gray-400">Select a saved job to see the details.</p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg">
            <h3 className="text-xl font-semibold mb-4">Add Job Manually</h3>
            <div className="flex border-b dark:border-gray-700 mb-4">
              <button onClick={() => setModalMode('link')} className={`py-2 px-4 font-semibold ${modalMode === 'link' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}>Add with Link</button>
              <button onClick={() => setModalMode('text')} className={`py-2 px-4 font-semibold ${modalMode === 'text' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}>Add with Text</button>
            </div>
            {modalMode === 'link' ? (
              <input type="text" value={modalInput} onChange={(e) => setModalInput(e.target.value)} placeholder="Paste job posting URL here" className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-700" />
            ) : (
              <textarea value={modalInput} onChange={(e) => setModalInput(e.target.value)} placeholder="Paste full job description here" className="w-full h-40 p-2 border rounded-lg bg-gray-50 dark:bg-gray-700"></textarea>
            )}
            {modalError && <p className="text-red-500 text-sm mt-2">{modalError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
              <button onClick={handleManualAdd} disabled={isParsing} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg w-28">
                {isParsing ? <LoadingSpinner className="w-5 h-5 mx-auto" /> : 'Save Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedJobs;