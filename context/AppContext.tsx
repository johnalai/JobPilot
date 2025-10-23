import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { View, Resume, Application, Job } from '../types';

// FIX: Define GenerationContext to be used for generating applications.
interface GenerationContext {
  job: Job;
  baseResume: Resume;
}

interface AppContextType {
  view: View;
  setView: (view: View) => void;
  
  resumes: Resume[];
  setResumes: React.Dispatch<React.SetStateAction<Resume[]>>;
  defaultResumeId: string | null;
  setDefaultResumeId: (id: string | null) => void;

  applications: Application[];
  setApplications: React.Dispatch<React.SetStateAction<Application[]>>;

  savedJobs: Job[];
  setSavedJobs: React.Dispatch<React.SetStateAction<Job[]>>;

  // FIX: Replace selectedJobForApplication with the more comprehensive generationContext.
  generationContext: GenerationContext | null;
  setGenerationContext: (context: GenerationContext | null) => void;

  selectedJobForViewing: Job | null;
  setSelectedJobForViewing: (job: Job | null) => void;

  selectedApplicationForInterview: Application | null;
  setSelectedApplicationForInterview: (app: Application | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [view, setView] = useState<View>('dashboard');
  
  const [resumes, setResumes] = useState<Resume[]>(() => {
    try {
      const saved = localStorage.getItem('resumes');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [defaultResumeId, setDefaultResumeId] = useState<string | null>(() => {
    return localStorage.getItem('defaultResumeId') || null;
  });

  const [applications, setApplications] = useState<Application[]>(() => {
    try {
      const saved = localStorage.getItem('applications');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  
  const [savedJobs, setSavedJobs] = useState<Job[]>(() => {
    try {
      const saved = localStorage.getItem('savedJobs');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // FIX: Add state for generationContext and remove unused selectedJobForApplication.
  const [generationContext, setGenerationContext] = useState<GenerationContext | null>(null);
  const [selectedJobForViewing, setSelectedJobForViewing] = useState<Job | null>(null);
  const [selectedApplicationForInterview, setSelectedApplicationForInterview] = useState<Application | null>(null);

  useEffect(() => {
    localStorage.setItem('resumes', JSON.stringify(resumes));
  }, [resumes]);

  useEffect(() => {
    if (defaultResumeId) {
        localStorage.setItem('defaultResumeId', defaultResumeId);
    } else {
        localStorage.removeItem('defaultResumeId');
    }
  }, [defaultResumeId]);

  useEffect(() => {
    localStorage.setItem('applications', JSON.stringify(applications));
  }, [applications]);

  useEffect(() => {
    localStorage.setItem('savedJobs', JSON.stringify(savedJobs));
  }, [savedJobs]);

  const value = {
    view,
    setView,
    resumes,
    setResumes,
    defaultResumeId,
    setDefaultResumeId,
    applications,
    setApplications,
    savedJobs,
    setSavedJobs,
    generationContext,
    setGenerationContext,
    selectedJobForViewing,
    setSelectedJobForViewing,
    selectedApplicationForInterview,
    setSelectedApplicationForInterview,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
