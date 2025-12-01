
import React, { useState, useEffect } from 'react';
// Import useAppContext from AppContext.tsx
import { useAppContext } from '../context/AppContext';
import { Job, GroundingDetail, TailoredDocument } from '../types';
import { DocumentTextIcon, XMarkIcon, PaperAirplaneIcon, BookmarkIcon as BookmarkOutlineIcon, PlusIcon } from '@heroicons/react/24/outline'; // Removed CheckIcon
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';
import { isAvoidedDomain } from '../services/geminiService';
import CompanyInsightsDisplay from './CompanyInsightsDisplay';
import MarkdownRenderer from './MarkdownRenderer';
import { generateId } from '../utils/fileUtils';

function SavedJobs() {
  const { savedJobs, saveJob, removeSavedJob, tailoredDocuments, currentResume, setCurrentView } = useAppContext();

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [filterCompany, setFilterCompany] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterTitle, setFilterTitle] = useState('');
  const [showCompanyInsights, setShowCompanyInsights] = useState(false);
  const [isManualAddModalOpen, setIsManualAddModalOpen] = useState(false);
  const [manualJobInput, setManualJobInput] = useState<Partial<Job>>({
    title: '', company: '', location: '', description: '',
    requirements: [], // Initialize as empty array
    niceToHave: [],   // Initialize as empty array
    sourceUrl: '',
  });

  useEffect(() => {
    // Clear selected job if savedJobs becomes empty
    if ((savedJobs?.length || 0) === 0) {
      setSelectedJob(null);
    } else if (selectedJob && !savedJobs?.some(job => job.id === selectedJob.id)) {
      // If selected job was removed, pick the first one or clear
      setSelectedJob(savedJobs[0] || null);
    }
  }, [savedJobs, selectedJob]); // Add selectedJob to dependencies to prevent stale closure

  const handleToggleSaveJob = (jobToToggle: Job) => {
    const isJobSaved = savedJobs?.some(job => job.id === jobToToggle.id);
    if (isJobSaved) {
      removeSavedJob(jobToToggle.id);
    } else {
      saveJob(jobToToggle);
    }
  };

  const handleApplyNow = (job: Job) => {
    alert(`Applying for ${job.title} at ${job.company}!`);
    // In a real app, navigate to ApplicationGenerator with job details or an external link
    // setCurrentView('Application Generator'); // Example navigation
  };

  const tailoredDocsForSelectedJob = selectedJob
    ? (tailoredDocuments || []).filter(doc => doc.jobId === selectedJob.id)
    : [];

  const filteredJobs = (savedJobs || []).filter(job => {
    const matchesCompany = filterCompany ? job.company?.toLowerCase().includes(filterCompany.toLowerCase()) : true;
    const matchesLocation = filterLocation ? job.location?.toLowerCase().includes(filterLocation.toLowerCase()) : true;
    const matchesTitle = filterTitle ? job.title?.toLowerCase().includes(filterTitle.toLowerCase()) : true;
    return matchesCompany && matchesLocation && matchesTitle;
  });

  const parseJob = (): Job | null => {
    if (!manualJobInput.title || !manualJobInput.company || !manualJobInput.description) {
      alert("Please fill in at least Title, Company, and Description.");
      return null;
    }

    const newJob: Job = {
      id: generateId(),
      title: manualJobInput.title,
      company: manualJobInput.company,
      location: manualJobInput.location || 'N/A',
      description: manualJobInput.description,
      requirements: manualJobInput.requirements || [], // Ensure it's an array
      niceToHave: manualJobInput.niceToHave || [],     // Ensure it's an array
      sourceUrl: manualJobInput.sourceUrl || '#',
      isSaved: true, // Manually added jobs are considered saved
      postedDate: new Date().toISOString().split('T')[0],
      groundingDetails: [],
      companyInsights: undefined,
    };
    return newJob;
  };

  const handleAddJob = () => {
    const newJob = parseJob();
    if (newJob) {
      saveJob(newJob); // Use saveJob to add
      setManualJobInput({ title: '', company: '', location: '', description: '', requirements: [], niceToHave: [], sourceUrl: '' });
      setIsManualAddModalOpen(false);
      setSelectedJob(newJob); // Optionally select the newly added job
    }
  };

  const isValidUrl = (urlString: string): boolean => {
    if (!urlString) return false; // Handle empty string case
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (e) {
      return false;
    }
  };

  const renderGroundingLinks = (groundingDetails?: GroundingDetail[], sourceUrl?: string) => {
    const uniqueLinks = new Map<string, { uri: string, title?: string }>();

    // Add sourceUrl first if valid and not avoided
    if (sourceUrl && isValidUrl(sourceUrl) && !isAvoidedDomain(sourceUrl)) {
      try {
        const url = new URL(sourceUrl);
        const hostname = url.hostname.toLowerCase().replace(/\/+$/, '');
        uniqueLinks.set(hostname, { uri: sourceUrl, title: url.hostname });
      } catch (e) {
        console.warn("Invalid sourceUrl encountered:", sourceUrl, e);
      }
    }

    groundingDetails?.forEach(detail => {
      if (detail.uri && isValidUrl(detail.uri) && !isAvoidedDomain(detail.uri)) {
        try {
          const url = new URL(detail.uri);
          const hostname = url.hostname.toLowerCase().replace(/\/+$/, '');
          // Only add if not already present or if it's a "better" title
          if (!uniqueLinks.has(hostname) || (detail.title && (uniqueLinks.get(hostname)?.title === hostname || uniqueLinks.get(hostname)?.title === undefined))) {
            uniqueLinks.set(hostname, { uri: detail.uri, title: detail.title || hostname });
          }
        } catch (e) {
          console.warn("Invalid grounding URI encountered:", detail.uri, e);
        }
      }
    });

    const links = Array.from(uniqueLinks.values());

    if (links.length === 0) {
      return <span className="text-gray-500 italic">No valid sources found.</span>;
    }

    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {links.map((link, index) => (
          <a
            key={index}
            href={link.uri}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline text-sm bg-blue-50 dark:bg-gray-700 px-2 py-1 rounded-full flex items-center"
          >
            <PaperAirplaneIcon className="h-4 w-4 mr-1" />
            {link.title || new URL(link.uri).hostname}
          </a>
        ))}
      </div>
    );
  };


  const renderJobDetails = () => {
    if (!selectedJob) return null;

    const isJobSaved = (savedJobs || []).some(job => job.id === selectedJob.id);

    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl mt-6 border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{selectedJob.title}</h2>
            <h3 className="text-xl text-blue-600 dark:text-blue-400 mb-2">{selectedJob.company} - {selectedJob.location}</h3>
          </div>
          <button
            onClick={() => handleToggleSaveJob(selectedJob)}
            className={`p-2 rounded-full transition-colors duration-200
              ${isJobSaved
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
              }`}
            aria-label={isJobSaved ? 'Unsave Job' : 'Save Job'}
          >
            {isJobSaved ? <BookmarkSolidIcon className="h-6 w-6" /> : <BookmarkOutlineIcon className="h-6 w-6" />}
          </button>
        </div>

        <div className="mb-4">
          <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Sources:</h4>
          {renderGroundingLinks(selectedJob.groundingDetails, selectedJob.sourceUrl)}
        </div>

        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Job Description:</h4>
        <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
          <MarkdownRenderer>{selectedJob.description}</MarkdownRenderer>
        </div>

        {selectedJob.requirements && selectedJob.requirements.length > 0 && (
          <div className="mt-4">
            <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Requirements:</h4>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300">
              {selectedJob.requirements.map((req, index) => (
                <li key={index}>{req}</li>
              ))}
            </ul>
          </div>
        )}

        {selectedJob.niceToHave && selectedJob.niceToHave.length > 0 && (
          <div className="mt-4">
            <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Nice-to-Have:</h4>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300">
              {selectedJob.niceToHave.map((nice, index) => (
                <li key={index}>{nice}</li>
              ))}
            </ul>
          </div>
        )}

        {selectedJob.companyInsights && (
          <CompanyInsightsDisplay companyInsights={selectedJob.companyInsights} />
        )}

        {/* Tailored Documents Section */}
        {currentResume && (
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Tailored Documents for This Job</h4>
            {tailoredDocsForSelectedJob.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No tailored resumes or cover letters for this job yet.
              </p>
            ) : (
              <ul className="space-y-3 mb-4">
                {tailoredDocsForSelectedJob.map(doc => (
                  <li key={doc.id} className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md flex justify-between items-center shadow-sm">
                    <div>
                      <p className="font-semibold text-gray-800 dark:text-gray-100">{doc.type === 'resume' ? 'Resume' : 'Cover Letter'}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-300">Generated: {new Date(doc.generationDate).toLocaleDateString()}</p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setCurrentView('Tailored Docs')} // Navigate to Tailored Docs
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200"
                        title="View Tailored Document"
                      >
                        <DocumentTextIcon className="h-5 w-5" />
                      </button>
                      {/* Add download button if needed */}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => setCurrentView('Application Generator')}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow transition-colors duration-200 flex items-center"
            >
              <PlusIcon className="h-5 w-5 mr-2" /> Generate New Tailored Docs
            </button>
          </div>
        )}

      </div>
    );
  };

  return (
    <div className="saved-jobs-section bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 min-h-[70vh]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white text-center">Your Saved Jobs ({(savedJobs?.length || 0)})</h2>
        <button
          onClick={() => setIsManualAddModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow flex items-center transition-colors duration-200"
        >
          <PlusIcon className="h-5 w-5 mr-2" /> Manually Add Job
        </button>
      </div>


      {/* Manual Add Job Modal */}
      {isManualAddModalOpen && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Manually Add Job Details</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="manualJobTitle" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Job Title<span className="text-red-500">*</span></label>
                <input
                  type="text"
                  id="manualJobTitle"
                  className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 dark:text-white"
                  value={manualJobInput.title}
                  onChange={(e) => setManualJobInput({ ...manualJobInput, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label htmlFor="manualJobCompany" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Company<span className="text-red-500">*</span></label>
                <input
                  type="text"
                  id="manualJobCompany"
                  className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 dark:text-white"
                  value={manualJobInput.company}
                  onChange={(e) => setManualJobInput({ ...manualJobInput, company: e.target.value })}
                  required
                />
              </div>
              <div>
                <label htmlFor="manualJobLocation" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Location</label>
                <input
                  type="text"
                  id="manualJobLocation"
                  className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 dark:text-white"
                  value={manualJobInput.location}
                  onChange={(e) => setManualJobInput({ ...manualJobInput, location: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="manualJobDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Description<span className="text-red-500">*</span></label>
                <textarea
                  id="manualJobDescription"
                  className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 dark:text-white min-h-[100px]"
                  value={manualJobInput.description}
                  onChange={(e) => setManualJobInput({ ...manualJobInput, description: e.target.value })}
                  required
                ></textarea>
              </div>
              <div>
                <label htmlFor="manualJobRequirements" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Requirements (one per line)</label>
                <textarea
                  id="manualJobRequirements"
                  className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 dark:text-white min-h-[80px]"
                  value={manualJobInput.requirements?.join('\n') || ''}
                  onChange={(e) => setManualJobInput({ ...manualJobInput, requirements: e.target.value.split('\n').map(s => s.trim()).filter(s => s.length > 0) })}
                  placeholder="e.g., Bachelor's degree&#10;5+ years experience"
                ></textarea>
              </div>
              <div>
                <label htmlFor="manualJobNiceToHave" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Nice-to-Have (one per line)</label>
                <textarea
                  id="manualJobNiceToHave"
                  className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 dark:text-white min-h-[80px]"
                  value={manualJobInput.niceToHave?.join('\n') || ''}
                  onChange={(e) => setManualJobInput({ ...manualJobInput, niceToHave: e.target.value.split('\n').map(s => s.trim()).filter(s => s.length > 0) })}
                  placeholder="e.g., Master's degree&#10;Experience with AWS"
                ></textarea>
              </div>
              <div>
                <label htmlFor="manualJobSourceUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Source URL</label>
                <input
                  type="url"
                  id="manualJobSourceUrl"
                  className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 dark:text-white"
                  value={manualJobInput.sourceUrl}
                  onChange={(e) => setManualJobInput({ ...manualJobInput, sourceUrl: e.target.value })}
                  placeholder="https://example.com/job-post"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setIsManualAddModalOpen(false)}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded-md hover:bg-gray-400 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAddJob}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
              >
                Add Job
              </button>
            </div>
          </div>
        </div>
      )}

      {(savedJobs?.length || 0) === 0 && !isManualAddModalOpen ? (
        <p className="text-center text-gray-500 dark:text-gray-400 text-lg mt-8">
          No jobs saved yet. Find jobs using "Find Jobs" or manually add them!
        </p>
      ) : (
        <>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <input
              type="text"
              placeholder="Filter by Title"
              className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white"
              value={filterTitle}
              onChange={(e) => setFilterTitle(e.target.value)}
            />
            <input
              type="text"
              placeholder="Filter by Company"
              className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white"
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
            />
            <input
              type="text"
              placeholder="Filter by Location"
              className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white"
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
            />
          </div>

          <div className="job-list-section grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Job List */}
            <div>
              {filteredJobs.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 text-lg mt-8">No jobs match your filters.</p>
              ) : (
                <ul className="space-y-4">
                  {filteredJobs.map(job => (
                    <li
                      key={job?.id}
                      className={`bg-gray-50 dark:bg-gray-800 p-5 rounded-lg shadow hover:shadow-lg transition-shadow duration-200 border cursor-pointer
                      ${selectedJob?.id === job?.id ? 'border-blue-500 dark:border-blue-400 shadow-xl' : 'border-gray-200 dark:border-gray-700'}`}
                      onClick={() => setSelectedJob(job)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-semibold text-blue-600 dark:text-blue-400">{job?.title}</h3>
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent selecting the job
                            handleToggleSaveJob(job);
                          }}
                          className={`p-1 rounded-full transition-colors duration-200
                            ${job?.isSaved
                              ? 'text-blue-500 hover:text-blue-600'
                              : 'text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400'
                            }`}
                          aria-label={job?.isSaved ? 'Unsave Job' : 'Save Job'}
                        >
                          {job?.isSaved ? <BookmarkSolidIcon className="h-6 w-6" /> : <BookmarkOutlineIcon className="h-6 w-6" />}
                        </button>
                      </div>
                      <p className="text-gray-800 dark:text-gray-200 mb-1">{job?.company} - {job?.location}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Posted: {job?.postedDate || 'N/A'}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Job Details Panel */}
            <div className="lg:col-span-1">
              {selectedJob ? (
                renderJobDetails()
              ) : (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl mt-6 border border-gray-200 dark:border-gray-700 text-center text-gray-500 dark:text-gray-400 min-h-[300px] flex items-center justify-center">
                  Select a job from the left to view details.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default SavedJobs;
