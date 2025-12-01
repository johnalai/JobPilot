
import React, { useState, useEffect, useRef, useCallback } from 'react';
// Import useAppContext from AppContext.tsx
import { useAppContext } from '../context/AppContext';
import { Job, GroundingDetail } from '../types';
import { PaperAirplaneIcon, BookmarkIcon as BookmarkOutlineIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';
import { analyzeJobUrl, analyzeJobText, getCompanyInsights, isAvoidedDomain } from '../services/geminiService'; // Import isAvoidedDomain
import CompanyInsightsDisplay from './CompanyInsightsDisplay'; // Assuming this component exists
import MarkdownRenderer from './MarkdownRenderer';

function JobFinder() {
  const {
    jobs,
    setJobs,
    savedJobs, // Use savedJobs from context to check if a job is saved
    saveJob,   // Use saveJob from context to add/update
    removeSavedJob, // Use removeSavedJob from context to remove
    addFrequentlySearchedKeyword,
    frequentlySearchedKeywords,
  } = useAppContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showCompanyInsights, setShowCompanyInsights] = useState(false);
  const [jobDescriptionInput, setJobDescriptionInput] = useState(''); // For manual input
  const [isManualInputMode, setIsManualInputMode] = useState(false); // To toggle input mode
  const [showKeywords, setShowKeywords] = useState(false);

  // Infinite scroll
  const observer = useRef<IntersectionObserver | null>(null);
  const lastJobElementRef = useCallback((node: HTMLLIElement | null) => { // Changed to HTMLLIElement
    if (loading) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        // This is a placeholder for actual infinite scroll logic.
        fetchMoreJobs();
      }
    });

    if (node) observer.current.observe(node);
  }, [loading]);

  // Placeholder for fetching more jobs for infinite scroll
  const fetchMoreJobs = useCallback(() => {
    // Implement actual pagination API call here
    console.log("Simulating fetching more jobs...");
    // For now, just generate a few dummy jobs
    setLoading(true);
    setTimeout(() => {
      const newJobs: Job[] = Array.from({ length: 5 }, (_, i) => ({
        id: `dummy-${jobs?.length || 0 + i}`,
        title: `Simulated Job ${jobs?.length || 0 + i}`,
        company: `Simulated Corp ${jobs?.length || 0 % 3}`,
        location: `Remote, Earth`,
        description: `This is a simulated job description for Simulated Job ${jobs?.length || 0 + i}. It requires basic skills and enthusiasm.`,
        requirements: ['Simulated Skill 1', 'Simulated Skill 2'], // Corrected to string[]
        isSaved: false,
        sourceUrl: `https://example.com/simulated-job-${jobs?.length || 0 + i}`,
      }));
      // Fix: Use functional update for setJobs
      setJobs((prevJobs) => [...(prevJobs || []), ...newJobs]);
      setLoading(false);
    }, 1000);
  }, [jobs, setJobs]);

  const isValidUrl = (urlString: string): boolean => {
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (e) {
      return false;
    }
  };

  const handleSearch = async () => {
    if (!searchQuery && !locationQuery && !isManualInputMode) {
      setError('Please enter a search query and/or location, or switch to manual input mode.');
      return;
    }

    setError(null);
    setLoading(true);
    setSelectedJob(null); // Clear selected job on new search
    setJobs([]); // Clear previous jobs
    setShowCompanyInsights(false);

    let jobData: Record<string, any> | null = null;
    let newGroundingDetails: GroundingDetail[] = [];
    let jobDescriptionText = '';

    if (isManualInputMode) {
      if (!jobDescriptionInput) {
        setError('Please enter job description text in manual input mode.');
        setLoading(false);
        return;
      }
      jobDescriptionText = jobDescriptionInput;
      jobData = await analyzeJobText(jobDescriptionInput);
    } else {
      // Prioritize URL if it looks like one, otherwise treat as text search
      if (searchQuery.startsWith('http://') || searchQuery.startsWith('https://')) {
        try {
          // Use analyzeJobUrl for direct URL analysis
          const result = await analyzeJobUrl(searchQuery);
          jobData = result;
          if (jobData?.groundingMetadata?.groundingChunks) {
            newGroundingDetails = jobData.groundingMetadata.groundingChunks;
          }
          jobDescriptionText = jobData?.description || '';
        } catch (urlError) {
          console.error('Error analyzing URL directly, falling back to text search:', urlError);
          // Fallback to text search if URL analysis fails
          jobData = await analyzeJobText(`${searchQuery} ${locationQuery}`);
          if (jobData) jobDescriptionText = jobData.description || '';
        }
      } else {
        // Use Gemini to find jobs based on text query and location
        jobDescriptionText = `Searching for "${searchQuery}" in "${locationQuery}". This is a dynamically generated job description based on your query. We are looking for talented individuals to join our team.`;
        jobData = await analyzeJobText(jobDescriptionText);
      }
    }

    if (jobData) {
      const companyInsights = await getCompanyInsights(jobData.company || 'Unknown Company');

      const newJob: Job = {
        id: jobData.id || `job-${Date.now()}`,
        title: jobData.title || searchQuery || 'N/A',
        company: jobData.company || 'N/A',
        location: jobData.location || locationQuery || 'N/A',
        description: jobData.description || jobDescriptionText,
        requirements: jobData.requirements || [], // Ensure this is an array
        niceToHave: jobData.niceToHave || [],     // Ensure this is an array
        sourceUrl: jobData.sourceUrl || newGroundingDetails.find(gd => gd.uri && isValidUrl(gd.uri) && !isAvoidedDomain(gd.uri))?.uri || '#',
        originalPostText: jobDescriptionText,
        isSaved: (savedJobs || []).some(job => job.id === jobData.id), // Check against actual savedJobs
        groundingDetails: newGroundingDetails,
        companyInsights: companyInsights || undefined,
      };
      setJobs([newJob]);
      setSelectedJob(newJob);

      // Add keywords
      if (searchQuery) {
        addFrequentlySearchedKeyword(searchQuery);
      }
      if (locationQuery) {
        addFrequentlySearchedKeyword(locationQuery);
      }
    } else {
      setError('Could not extract complete job details. Please provide more context or try another input.');
    }
    setLoading(false);
  };

  const handleToggleSaveJob = (jobToSave: Job) => {
    const isJobSaved = (savedJobs || []).some(job => job.id === jobToSave.id);
    if (isJobSaved) {
      removeSavedJob(jobToSave.id);
      // Update the local `jobs` state to reflect the change
      // Fix: Use functional update for setJobs
      setJobs(prevJobs => (prevJobs || []).map(job =>
        job.id === jobToSave.id ? { ...job, isSaved: false } : job
      ));
      // Update selectedJob if it's the one being toggled
      if (selectedJob?.id === jobToSave.id) {
        setSelectedJob(prev => prev ? { ...prev, isSaved: false } : null);
      }
    } else {
      saveJob(jobToSave);
      // Update the local `jobs` state to reflect the change
      // Fix: Use functional update for setJobs
      setJobs(prevJobs => (prevJobs || []).map(job =>
        job.id === jobToSave.id ? { ...job, isSaved: true } : job
      ));
      // Update selectedJob if it's the one being toggled
      if (selectedJob?.id === jobToSave.id) {
        setSelectedJob(prev => prev ? { ...prev, isSaved: true } : null);
      }
    }
  };

  const renderGroundingLinks = (groundingDetails?: GroundingDetail[], sourceUrl?: string) => {
    const uniqueLinks = new Map<string, { uri: string, title?: string }>();

    // Add sourceUrl first if valid and not avoided
    if (sourceUrl && isValidUrl(sourceUrl) && !isAvoidedDomain(sourceUrl)) {
      const normalizedUri = new URL(sourceUrl).hostname.toLowerCase().replace(/\/+$/, '');
      uniqueLinks.set(normalizedUri, { uri: sourceUrl, title: new URL(sourceUrl).hostname });
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

      </div>
    );
  };

  return (
    <div className="job-finder-section bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 min-h-[70vh]">
      <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 text-center">Find Your Next Opportunity</h2>

      {/* Toggle between URL/Text input modes */}
      <div className="flex justify-center mb-6">
        <button
          onClick={() => setIsManualInputMode(false)}
          className={`px-5 py-2 rounded-l-lg text-lg font-medium transition-colors duration-200
            ${!isManualInputMode
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
            }`}
        >
          Search/URL Input
        </button>
        <button
          onClick={() => setIsManualInputMode(true)}
          className={`px-5 py-2 rounded-r-lg text-lg font-medium transition-colors duration-200
            ${isManualInputMode
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
            }`}
        >
          Manual Job Description
        </button>
      </div>

      {isManualInputMode ? (
        <div className="mb-6">
          <label htmlFor="jobDescriptionInput" className="block text-lg font-medium text-gray-700 dark:text-gray-200 mb-2">
            Paste Job Description:
          </label>
          <textarea
            id="jobDescriptionInput"
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white resize-y min-h-[200px]"
            rows={10}
            value={jobDescriptionInput}
            onChange={(e) => setJobDescriptionInput(e.target.value)}
            placeholder="Paste the full job description here..."
          ></textarea>
        </div>
      ) : (
        <div className="job-search-filters grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <input
            type="text"
            className="col-span-1 md:col-span-2 p-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white"
            placeholder="Job title, keywords, or job URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <input
            type="text"
            className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white"
            placeholder="Location (e.g., Remote, Toronto, CA)"
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
      )}


      <div className="flex justify-center mb-6">
        <button
          onClick={handleSearch}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg flex items-center transition-colors duration-200"
          disabled={loading}
        >
          {loading ? (
            <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <MagnifyingGlassIcon className="h-5 w-5 mr-3" />
          )}
          {isManualInputMode ? 'Analyze Job' : 'Search Jobs'}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded-md relative mb-6 flex items-center">
          <XMarkIcon className="h-5 w-5 mr-2" />
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Frequently Searched Keywords */}
      {(frequentlySearchedKeywords?.length || 0) > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowKeywords(!showKeywords)}
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm mb-2 focus:outline-none"
          >
            {showKeywords ? 'Hide Recent Searches' : 'Show Recent Searches'}
          </button>
          {showKeywords && (
            <div className="flex flex-wrap gap-2 mt-2">
              {[...(frequentlySearchedKeywords || [])].sort((a, b) => (b?.lastUsed || '').localeCompare(a?.lastUsed || '')).map((keyword) => (
                <span
                  key={keyword?.id}
                  onClick={() => {
                    setSearchQuery(keyword?.term || '');
                    setShowKeywords(false); // Hide after selection
                  }}
                  className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
                >
                  {keyword?.term} <XMarkIcon className="h-3 w-3 inline-block ml-1 text-gray-500" />
                </span>
              ))}
            </div>
          )}
        </div>
      )}


      <div className="job-list-section mt-8">
        {(jobs?.length || 0) === 0 && !loading && !error && (
          <p className="text-center text-gray-500 dark:text-gray-400 text-lg">
            No jobs found. Start by searching or pasting a job description!
          </p>
        )}

        {selectedJob && renderJobDetails()}

        {/* If there are multiple jobs (e.g., from future pagination), render a list */}
        {(jobs?.length || 0) > 0 && !selectedJob && (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((job, index) => (
              <li
                key={job.id}
                ref={index === jobs.length - 1 ? lastJobElementRef : null}
                className="bg-gray-50 dark:bg-gray-800 p-5 rounded-lg shadow hover:shadow-lg transition-shadow duration-200 border border-gray-200 dark:border-gray-700 cursor-pointer"
                onClick={() => setSelectedJob(job)}
              >
                <h3 className="text-xl font-semibold text-blue-600 dark:text-blue-400 mb-1">{job.title}</h3>
                <p className="text-gray-800 dark:text-gray-200 mb-2">{job.company} - {job.location}</p>
                <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
                  <span>{job.postedDate || 'N/A'}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent opening job details
                      handleToggleSaveJob(job);
                    }}
                    className={`p-1 rounded-full transition-colors duration-200
                      ${job.isSaved
                        ? 'text-blue-500 hover:text-blue-600'
                        : 'text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400'
                      }`}
                  >
                    {job.isSaved ? <BookmarkSolidIcon className="h-5 w-5" /> : <BookmarkOutlineIcon className="h-5 w-5" />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {loading && (
          <p className="text-center text-blue-600 dark:text-blue-400 mt-8 text-lg animate-pulse">Loading jobs...</p>
        )}
      </div>
    </div>
  );
}

export default JobFinder;
