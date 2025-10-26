import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Job, WebGroundingChunk } from '../types';
import { BookmarkIcon, LocationMarkerIcon, CalendarIcon, BriefcaseIcon, LoadingSpinner, ListUlIcon, GridIcon } from './icons';
import { analyzeJobUrl, analyzeJobText, DOMAINS_TO_AVOID_AS_PRIMARY_SOURCE, getDomain } from '../services/geminiService';
import CompanyInsightsDisplay from './CompanyInsightsDisplay'; // Import new component

const SavedJobs: React.FC = () => {
  const {
    savedJobs,
    setSavedJobs,
    setView,
    setGenerationContext,
    resumes,
    defaultResumeId,
    setError, // Import global setError
  } = useAppContext();

  const [selectedJob, setSelectedJob] = useState<Job | null>(savedJobs.length > 0 ? savedJobs[0] : null);
  // Removed local error state, now using global setError
  // const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list'); // New state for view mode
  
  // State for the manual add modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'link' | 'text'>('link');
  const [modalInput, setModalInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [modalError, setModalError] = useState('');

  const defaultResume = resumes.find(r => r.id === defaultResumeId);

  // FIX: Refactor handleUnsaveJob into handleToggleSaveJob to be consistent with JobFinder and handle both save/unsave
  const handleToggleSaveJob = (jobToToggle: Job) => {
    const isSaved = savedJobs.some(saved => saved.id === jobToToggle.id);
    if (isSaved) {
      // Unsave the job
      setSavedJobs(prev => prev.filter(job => job.id !== jobToToggle.id));
      if (selectedJob?.id === jobToToggle.id) {
          // If the unsaved job was selected, clear selection or pick next one
          const nextJob = savedJobs.filter(j => j.id !== jobToToggle.id)[0] || null;
          setSelectedJob(nextJob);
      }
    } else {
      // Save the job (though this component is for *saved* jobs, this function is flexible)
      setSavedJobs(prev => [...prev, jobToToggle]);
    }
  };
  
  const handleApply = (job: Job) => {
    if (!defaultResume) {
      setError("Please set a default resume in the Resume Hub before generating an application."); // Use global setError
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
    setError(null); // Clear global error for AI service issues

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
            sourceUrl: partialJob.sourceUrl || (modalMode === 'link' ? modalInput : undefined), // Ensure sourceUrl is preserved/set
            grounding: partialJob.grounding, // Ensure grounding is preserved
            ...partialJob,
        };
        setSavedJobs(prev => [newJob, ...prev]);
        setSelectedJob(newJob);
        setIsModalOpen(false);
        setModalInput('');

    } catch (e: any) {
        setModalError(e.message || 'Failed to parse job details.');
        setError(e.message || 'Failed to parse job details (AI service error).'); // Set global error
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
      
      // Filter out undesirable domains (already done in geminiService, but defensive check)
      if (uri && !DOMAINS_TO_AVOID_AS_PRIMARY_SOURCE.some(domain => getDomain(uri).includes(domain))) {
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
        <button onClick={(e) => { e.stopPropagation(); handleToggleSaveJob(job); }} title="Unsave Job" className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
          <BookmarkIcon className="w-6 h-6 text-yellow-500" filled={true} />
        </button>
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
      <div className="mt-6 flex-grow overflow-y-auto pr-2">
        <h4 className="font-bold text-lg mb-2">Job Description</h4>
        <div className="prose prose-sm dark:prose-invert max-w-none">
            {formattedMarkdown(job.description)}
        </div>
        {renderGroundingLinks(job.grounding)}

        {/* Company Insights Display */}
        <CompanyInsightsDisplay 
            companyName={job.company} 
            jobId={job.id} 
            currentInsights={job.companyInsights}
            onInsightsFetched={(companyInsights) => {
              // Update the specific job in the `savedJobs` array
              setSavedJobs(prevSavedJobs => prevSavedJobs.map(j => 
                j.id === job.id ? { ...j, companyInsights: companyInsights } : j
              ));
              // Also update the selected job in local state if it's the same one
              setSelectedJob(prevSelected => 
                prevSelected?.id === job.id ? { ...prevSelected, companyInsights: companyInsights } : prevSelected
              );
            }}
        />
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Saved Jobs</h2>
      <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">Review and apply to jobs you've saved.</p>
      {/* Removed local error display */}
      {/* {error && <p className="text-red-500 mt-4 text-center">{error}</p>} */}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8" style={{ minHeight: '60vh' }}>
        <div className="md:col-span-1 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg h-full flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm">
              + Add Job Manually
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-full ${viewMode === 'list' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                title="List View"
              >
                <ListUlIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-full ${viewMode === 'grid' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                title="Grid View"
              >
                <GridIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-grow overflow-y-auto">
            {savedJobs.length === 0 ? (
              <p className="text-center text-gray-500 pt-4">You have no saved jobs. Find jobs to save them.</p>
            ) : (
              <>
                {viewMode === 'list' ? (
                  <ul className="space-y-2">
                    {savedJobs.map(job => (
                      <li key={job.id} 
                        className={`p-4 rounded-lg cursor-pointer transition-colors border-2 ${selectedJob?.id === job.id ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-500' : 'bg-gray-50 dark:bg-gray-700/50 border-transparent hover:border-blue-400'}`}>
                        <div onClick={() => setSelectedJob(job)}> {/* Wrap details to handle selection */}
                          <h4 className="font-bold">{job.title}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{job.company}</p>
                          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 flex items-center justify-between">
                            <span className="flex items-center gap-1"><LocationMarkerIcon className="w-3 h-3"/>{job.location}</span>
                            {job.workModel && <span className="flex items-center gap-1"><BriefcaseIcon className="w-3 h-3"/>{job.workModel}</span>}
                          </div>
                          {job.description && (
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 line-clamp-6">
                              {job.description}
                            </p>
                          )}
                          {job.datePosted && <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{job.datePosted}</p>}
                        </div>
                        <div className="mt-3 flex justify-end gap-2"> {/* New action buttons container */}
                          <button onClick={(e) => { e.stopPropagation(); handleToggleSaveJob(job); }} title="Unsave Job" className="text-gray-500 hover:text-red-600 p-1 rounded-full">
                              <BookmarkIcon className="w-5 h-5" filled={savedJobs.some(j => j.id === job.id)} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleApply(job); }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded-lg text-sm">
                              Apply
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4"> {/* Responsive grid for job cards */}
                    {savedJobs.map(job => (
                      <div key={job.id} 
                        className={`p-4 rounded-lg cursor-pointer transition-colors border-2 ${selectedJob?.id === job.id ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-500' : 'bg-gray-50 dark:bg-gray-700/50 border-transparent hover:border-blue-400'} flex flex-col`}>
                        <div onClick={() => setSelectedJob(job)} className="flex-grow"> {/* Make content clickable for selection */}
                          <h4 className="font-bold text-base">{job.title}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{job.company}</p>
                          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 flex flex-wrap gap-x-2">
                            <span className="flex items-center gap-1"><LocationMarkerIcon className="w-3 h-3"/>{job.location}</span>
                            {job.workModel && <span className="flex items-center gap-1"><BriefcaseIcon className="w-3 h-3"/>{job.workModel}</span>}
                          </div>
                          {job.description && (
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 line-clamp-3"> {/* Shorter description for grid view */}
                              {job.description}
                            </p>
                          )}
                          {job.datePosted && <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{job.datePosted}</p>}
                        </div>
                        <div className="mt-3 flex justify-end gap-2"> {/* Action buttons at the bottom */}
                          <button onClick={(e) => { e.stopPropagation(); handleToggleSaveJob(job); }} title="Unsave Job" className="text-gray-500 hover:text-red-600 p-1 rounded-full">
                              <BookmarkIcon className="w-5 h-5" filled={savedJobs.some(j => j.id === job.id)} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleApply(job); }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded-lg text-sm">
                              Apply
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
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