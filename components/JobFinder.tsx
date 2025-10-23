import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { findJobs, FindJobsFilters } from '../services/geminiService';
import { Job } from '../types';
import { LoadingSpinner, BookmarkIcon, LocationMarkerIcon, CalendarIcon, BriefcaseIcon } from './icons';

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
  } = useAppContext();

  const [filters, setFilters] = useState<FindJobsFilters>(() => {
    const savedFilters = localStorage.getItem('jobFilters');
    return savedFilters ? JSON.parse(savedFilters) : initialFilters;
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  };

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setJobs([]);
    setSelectedJobForViewing(null);
    try {
      const results = await findJobs(filters, defaultResume?.content || null);
      setJobs(results);
    } catch (e: any) {
      setError(e.message || "Failed to find jobs.");
    } finally {
      setLoading(false);
    }
  }, [filters, defaultResume, setSelectedJobForViewing]);

  const handleApply = (job: Job) => {
    if (!defaultResume) {
      setError("Please set a default resume before generating an application.");
      return;
    }
    const resumeToUse = defaultResume;
    
    // Prompt to select a resume
    // For simplicity, we use the default resume here. A modal could be added.
    setGenerationContext({ job, baseResume: resumeToUse });
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
          return <p key={index} className="mb-2">{line}</p>;
        }
        return null;
      });
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
      <div className="mt-6 flex-grow overflow-y-auto pr-2">
        <h4 className="font-bold text-lg mb-2">Job Description</h4>
        <div className="prose prose-sm dark:prose-invert max-w-none">
            {formattedMarkdown(job.description)}
        </div>
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
      <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Find Your Next Job</h2>
      <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">Search for roles tailored to your profile.</p>

      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input name="query" value={filters.query} onChange={handleFilterChange} placeholder="Keywords (e.g., 'React Developer')" className="p-3 border rounded-lg bg-white dark:bg-gray-700" />
          <input name="location" value={filters.location} onChange={handleFilterChange} placeholder="Location (e.g., 'San Francisco')" className="p-3 border rounded-lg bg-white dark:bg-gray-700" />
          <select name="workModel" value={filters.workModel} onChange={handleFilterChange} className="p-3 border rounded-lg bg-white dark:bg-gray-700">
              <option value="Any">Any Work Model</option>
              <option>Remote</option>
              <option>Hybrid</option>
              <option>On-site</option>
          </select>
        </div>
        <div className="mt-4">
            <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-sm font-semibold text-blue-600">
                {showAdvanced ? 'Hide' : 'Show'} Advanced Filters
            </button>
        </div>
        {showAdvanced && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
                <select name="experienceLevel" value={filters.experienceLevel} onChange={handleFilterChange} className="p-3 border rounded-lg bg-white dark:bg-gray-700">
                    <option value="Any">Any Experience Level</option>
                    <option>Entry-Level</option>
                    <option>Mid-Level</option>
                    <option>Senior</option>
                </select>
                <input type="number" name="minSalary" value={filters.minSalary} onChange={handleFilterChange} placeholder="Minimum Salary (e.g., 80000)" className="p-3 border rounded-lg bg-white dark:bg-gray-700" />
                <input name="skills" value={filters.skills} onChange={handleFilterChange} placeholder="Required Skills (e.g., Python, SQL)" className="p-3 border rounded-lg bg-white dark:bg-gray-700" />
            </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setFilters(initialFilters)} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg">Clear</button>
            <button onClick={handleSearch} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50">
              {loading ? <LoadingSpinner className="w-6 h-6" /> : 'Search'}
            </button>
        </div>
      </div>
      
      {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
      {!defaultResume && jobs.length === 0 && <p className="text-yellow-600 mt-4 text-center">Tip: Add a default resume in the 'Resume Hub' for better search results.</p>}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8" style={{ minHeight: '60vh' }}>
        <div className="md:col-span-1 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg h-full overflow-y-auto">
          {loading && <div className="flex justify-center items-center h-full"><LoadingSpinner className="w-8 h-8" /></div>}
          {!loading && jobs.length === 0 && <p className="text-center text-gray-500 pt-4">No jobs found. Try a different search.</p>}
          <ul className="space-y-2">
            {jobs.map(job => (
              <li key={job.id} onClick={() => setSelectedJobForViewing(job)}
                className={`p-4 rounded-lg cursor-pointer transition-colors border-2 ${selectedJob?.id === job.id ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-500' : 'bg-gray-50 dark:bg-gray-700/50 border-transparent hover:border-blue-400'}`}>
                <h4 className="font-bold">{job.title}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{job.company}</p>
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 flex justify-between">
                  <span>{job.location}</span>
                  <span className="font-semibold">{job.datePosted}</span>
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