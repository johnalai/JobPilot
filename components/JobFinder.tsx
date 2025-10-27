import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { findJobs, FindJobsFilters, DOMAINS_TO_AVOID_AS_PRIMARY_SOURCE, getDomain } from '../services/geminiService';
import { Job, WebGroundingChunk } from '../types';
import { LoadingSpinner, BookmarkIcon, LocationMarkerIcon, CalendarIcon, BriefcaseIcon } from './icons';
import CompanyInsightsDisplay from './CompanyInsightsDisplay'; // Import new component

const initialFilters: FindJobsFilters = {
  query: '',
  location: '',
  workModel: 'Any',
  minSalary: '',
  experienceLevel: 'Any',
  skills: ''
};

const JobFinder: React.FC = () => {
  const {
    resumes,
    defaultResumeId,
    setView,
    setGenerationContext,
    selectedJobForViewing,
    setSelectedJobForViewing,
    savedJobs,
    setSavedJobs,
    frequentlySearchedKeywords, // Get from context
    setFrequentlySearchedKeywords, // Get from context
    setError, // Import setError from context
  } = useAppContext();

  const [filters, setFilters] = useState<FindJobsFilters>(() => {
    const savedFilters = localStorage.getItem('jobFilters');
    return savedFilters ? JSON.parse(savedFilters) : initialFilters;
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);// FIX: Explicitly specify the type of `jobs`
  const [loading, setLoading] = useState(false);
  const [currentError, setCurrentError] = useState<string | null>(null); // Use a local error state for display in this component

  // New states for autocomplete
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null); // Ref for the query input


  const selectedJob = selectedJobForViewing;
  const defaultResume = resumes.find(r => r.id === defaultResumeId);

  useEffect(() => {
    localStorage.setItem('jobFilters', JSON.stringify(filters));
  }, [filters]);
  
  // Effect to clear the selected job when the component is left
  useEffect(() => {
    return () => {
      if (selectedJobForViewing) {
        setSelectedJobForViewing(null);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));

    // Autocomplete logic for the 'query' field
    if (name === 'query') {
      if (value.trim().length > 0) {
        const lowerCaseValue = value.toLowerCase();
        const newSuggestions = frequentlySearchedKeywords
          .filter(keyword => keyword.toLowerCase().includes(lowerCaseValue))
          .slice(0, 5); // Limit to top 5 suggestions
        setFilteredSuggestions(newSuggestions);
        // Only show suggestions if there are actual suggestions
        setShowSuggestions(newSuggestions.length > 0);
      } else {
        setFilteredSuggestions([]);
        setShowSuggestions(false);
      }
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setFilters(prev => ({ ...prev, query: suggestion }));
    setFilteredSuggestions([]);
    setShowSuggestions(false);
    searchInputRef.current?.focus(); // Keep focus on the input after selection
  };

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setCurrentError(null); // Clear local error state
    setError(null); // Clear global error state for AI issues
    setJobs([]);
    setSelectedJobForViewing(null);

    // Save search query to frequently searched keywords
    if (filters.query.trim()) {
      setFrequentlySearchedKeywords(prev => {
        const normalizedQuery = filters.query.trim().toLowerCase();
        // Filter out the existing keyword (case-insensitive) and add the new one to the front
        const existingKeywords = prev.filter(k => k.toLowerCase() !== normalizedQuery);
        return [filters.query.trim(), ...existingKeywords].slice(0, 10); // Keep only the latest 10 unique keywords
      });
    }

    try {
      const results = await findJobs(filters, defaultResume?.activeContent || null);
      setJobs(results);
    } catch (e: any) {
      setCurrentError(e.message || "Failed to find jobs."); // Set local error
      setError(e.message || "Failed to find jobs (AI service error)."); // Set global error for persistent visibility
    } finally {
      setLoading(false);
      setShowSuggestions(false); // Hide suggestions after search
    }
  }, [filters, defaultResume, setSelectedJobForViewing, setFrequentlySearchedKeywords, setError]);

  const handleApply = (job: Job) => {
    if (!defaultResume) {
      setCurrentError("Please set a default resume before generating an application."); // Use local error
      // Clear error after a few seconds
      setTimeout(() => setCurrentError(null), 3000);
      return;
    }
    // FIX: Pass activeContent to generationContext
    setGenerationContext({ job, baseResume: { id: defaultResume.id, name: defaultResume.name, activeContent: defaultResume.activeContent, versions: defaultResume.versions } });
    setView('application-generator');
  };

  const handleToggleSaveJob = (job: Job) => {
    const isSaved = savedJobs.some(saved => saved.id === job.id);
    if (isSaved) {
      setSavedJobs(prev => prev.filter(saved => saved.id !== job.id));
    } else {
      setSavedJobs(prev => [...prev, job]);
    }
  };

  const handleSaveAllDisplayedJobs = () => {
    const newSavedJobs = new Set(savedJobs.map(j => j.id));
    const jobsToSave = jobs.filter(job => !newSavedJobs.has(job.id));
    if (jobsToSave.length > 0) {
      setSavedJobs(prev => [...prev, ...jobsToSave]);
      // Optionally provide feedback to user
      setCurrentError(`Successfully saved ${jobsToSave.length} jobs.`); // Use local error
      setTimeout(() => setCurrentError(null), 3000);
    } else {
      setCurrentError("All displayed jobs are already saved."); // Use local error
      setTimeout(() => setCurrentError(null), 3000);
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
          return <p key={index} className="mb-2" dangerouslySetInnerHTML={{ __html: line }}></p>; // Use dangerouslySetInnerHTML for markdown
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
        <button onClick={() => handleToggleSaveJob(job)} title="Save Job" className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
          <BookmarkIcon className="w-6 h-6" filled={savedJobs.some(j => j.id === job.id)} />
        </button>
      </div>

      <div className="mt-6 flex gap-3">
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
              // Update the specific job in the `jobs` array
              setJobs(prevJobs => prevJobs.map(j => 
                j.id === job.id ? { ...j, companyInsights: companyInsights } : j
              ));
              // Also update the selected job in context if it's the same one
              setSelectedJobForViewing(prevSelected => 
                prevSelected?.id === job.id ? { ...prevSelected, companyInsights: companyInsights } : prevSelected
              );
            }}
        />
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Find Your Next Job</h2>
      <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">Search for roles tailored to your profile.</p>

      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg relative"> {/* Added relative for positioning dropdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative"> {/* Wrapper for query input and suggestions */}
            <input
              ref={searchInputRef}
              name="query"
              value={filters.query}
              onChange={handleFilterChange}
              onFocus={() => filters.query.trim().length > 0 && filteredSuggestions.length > 0 && setShowSuggestions(true)} // Show on focus if input has value and suggestions exist
              onBlur={() => setTimeout(() => setShowSuggestions(false), 100)} // Hide after a small delay to allow click on suggestion
              placeholder="Keywords (e.g., 'React Developer')"
              className="w-full p-3 border rounded-lg bg-white dark:bg-gray-700"
              aria-label="Job search keywords"
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <ul className="absolute z-10 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-b-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredSuggestions.map((suggestion, index) => (
                  <li
                    key={index}
                    onMouseDown={(e) => { // Changed to onMouseDown
                      e.preventDefault(); // Prevent input blur from happening immediately
                      handleSelectSuggestion(suggestion);
                    }}
                    className="p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100"
                  >
                    {suggestion}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <input name="location" value={filters.location} onChange={handleFilterChange} placeholder="Location (e.g., 'San Francisco')" className="p-3 border rounded-lg bg-white dark:bg-gray-700" aria-label="Job location" />
          <select name="workModel" value={filters.workModel} onChange={handleFilterChange} className="p-3 border rounded-lg bg-white dark:bg-gray-700" aria-label="Work model">
              <option value="Any">Any Work Model</option>
              <option>Remote</option>
              <option>Hybrid</option>
              <option>On-site</option>
          </select>
        </div>
        <div className="mt-4 flex items-center justify-between">
            <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-sm font-semibold text-blue-600" aria-expanded={showAdvanced} aria-controls="advanced-filters">
                {showAdvanced ? 'Hide' : 'Show'} Advanced Filters
            </button>
        </div>
        {showAdvanced && (
            <div id="advanced-filters" className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
                <select name="experienceLevel" value={filters.experienceLevel} onChange={handleFilterChange} className="p-3 border rounded-lg bg-white dark:bg-gray-700" aria-label="Experience level">
                    <option value="Any">Any Experience Level</option>
                    <option>Entry-Level</option>
                    <option>Mid-Level</option>
                    <option>Senior</option>
                </select>
                <input type="number" name="minSalary" value={filters.minSalary} onChange={handleFilterChange} placeholder="Minimum Salary (e.g., 80000)" className="p-3 border rounded-lg bg-white dark:bg-gray-700" aria-label="Minimum salary" />
                <input name="skills" value={filters.skills} onChange={handleFilterChange} placeholder="Required Skills (e.g., Python, SQL)" className="p-3 border rounded-lg bg-white dark:bg-gray-700" aria-label="Required skills" />
            </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => { setFilters(initialFilters); }} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg">Clear</button>
            <button onClick={handleSearch} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50">
              {loading ? <LoadingSpinner className="w-6 h-6" /> : 'Search'}
            </button>
        </div>
      </div>
      
      {currentError && <p className="text-red-500 mt-4 text-center">{currentError}</p>} {/* Display local error */}
      {!defaultResume && jobs.length === 0 && <p className="text-yellow-600 mt-4 text-center">Tip: Add a default resume in the 'Resume Hub' for better search results.</p>}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8" style={{ minHeight: '60vh' }}>
        <div className="md:col-span-1 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg h-full overflow-y-auto">
          {loading && <div className="flex justify-center items-center h-full"><LoadingSpinner className="w-8 h-8" /></div>}
          {!loading && jobs.length === 0 && <p className="text-center text-gray-500 pt-4">No jobs found. Try a different search.</p>}
          {!loading && jobs.length > 0 && (
            <button
                onClick={handleSaveAllDisplayedJobs}
                className="w-full mb-4 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg"
            >
                Save All Displayed Jobs
            </button>
          )}
          <ul className="space-y-2">
            {jobs.map(job => (
              <li key={job.id} 
                className={`p-4 rounded-lg cursor-pointer transition-colors border-2 ${selectedJob?.id === job.id ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-500' : 'bg-gray-50 dark:bg-gray-700/50 border-transparent hover:border-blue-400'}`}>
                <div className="flex justify-between items-start" onClick={() => setSelectedJobForViewing(job)}>
                    <div>
                        <h4 className="font-bold">{job.title}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{job.company}</p>
                        <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 flex items-center justify-between">
                          <span className="flex items-center gap-1"><LocationMarkerIcon className="w-3 h-3"/>{job.location}</span>
                          {job.workModel && <span className="flex items-center gap-1"><BriefcaseIcon className="w-3 h-3"/>{job.workModel}</span>}
                        </div>
                        {/* Display the full description */}
                        {job.description && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 line-clamp-6">
                            {job.description}
                          </p>
                        )}
                        {job.datePosted && <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{job.datePosted}</p>}

                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleToggleSaveJob(job); }} title="Save Job" className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <BookmarkIcon className="w-5 h-5" filled={savedJobs.some(j => j.id === job.id)} />
                    </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
          {selectedJob ? renderJobDetails(selectedJob) : (
            <div className="flex justify-center items-center h-full">
              <p className="text-gray-500 dark:text-gray-400">Select a job to see the details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobFinder;