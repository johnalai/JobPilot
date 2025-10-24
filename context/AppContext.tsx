import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { View, Resume, Application, Job, Message, Task, ResumeVersion } from '../types';

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

  generationContext: GenerationContext | null;
  setGenerationContext: (context: GenerationContext | null) => void;

  selectedJobForViewing: Job | null;
  setSelectedJobForViewing: (job: Job | null) => void;

  selectedApplicationForInterview: Application | null;
  setSelectedApplicationForInterview: (app: Application | null) => void;

  chatHistory: Message[];
  setChatHistory: React.Dispatch<React.SetStateAction<Message[]>>;

  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;

  frequentlySearchedKeywords: string[];
  setFrequentlySearchedKeywords: React.Dispatch<React.SetStateAction<string[]>>;

  isNewUser: boolean; // New: State to track if the user is new for onboarding tour
  setIsNewUser: (isNew: boolean) => void; // New: Function to set isNewUser

  // New: Global error state
  error: string | null;
  setError: (message: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [view, setView] = useState<View>('dashboard');
  
  const [resumes, setResumes] = useState<Resume[]>(() => {
    try {
      const saved = localStorage.getItem('resumes');
      const loadedResumes: Resume[] = saved ? JSON.parse(saved) : [];
      
      return loadedResumes.map(resume => {
        const activeContent = resume.activeContent || (resume as any).content || {};
        const versions = resume.versions || [];

        // Ensure all ResumeContent fields are present, even if empty/default
        const normalizedActiveContent = {
          rawText: activeContent.rawText || '',
          skills: activeContent.skills || [],
          experience: activeContent.experience || [],
          education: activeContent.education || [],
          contactInfo: activeContent.contactInfo || { name: '', address: '', phone: '', email: '' },
        };

        const normalizedVersions = versions.length > 0
          ? versions.map((version: ResumeVersion) => ({
              ...version,
              content: {
                rawText: version.content?.rawText || '',
                skills: version.content?.skills || [],
                experience: version.content?.experience || [],
                education: version.content?.education || [],
                contactInfo: version.content?.contactInfo || { name: '', address: '', phone: '', email: '' },
              }
            }))
          : [{
              content: normalizedActiveContent, // Use the normalized active content for the initial version
              timestamp: Date.now(),
              versionName: 'Initial Import (Legacy)',
            }];

        return {
          ...resume,
          activeContent: normalizedActiveContent,
          versions: normalizedVersions,
        };
      });
    } catch (e) {
      console.error("Failed to load resumes from localStorage. Data might be corrupted or incompatible. Starting fresh.", e);
      return [];
    }
  });

  const [defaultResumeId, setDefaultResumeId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('defaultResumeId') || null;
    } catch (e) {
      console.error("Failed to load defaultResumeId from localStorage. Starting fresh.", e);
      return null;
    }
  });

  const [applications, setApplications] = useState<Application[]>(() => {
    try {
      const saved = localStorage.getItem('applications');
      const loadedApps: Application[] = saved ? JSON.parse(saved) : [];
      // Basic normalization for applications if needed in the future
      return loadedApps;
    } catch (e) {
      console.error("Failed to load applications from localStorage. Data might be corrupted or incompatible. Starting fresh.", e);
      return [];
    }
  });
  
  const [savedJobs, setSavedJobs] = useState<Job[]>(() => {
    try {
      const saved = localStorage.getItem('savedJobs');
      const loadedJobs: Job[] = saved ? JSON.parse(saved) : [];
      // Basic normalization for jobs if needed in the future
      return loadedJobs;
    } catch (e) {
      console.error("Failed to load savedJobs from localStorage. Data might be corrupted or incompatible. Starting fresh.", e);
      return [];
    }
  });

  const [chatHistory, setChatHistory] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('chatHistory');
      const loadedHistory: Message[] = saved ? JSON.parse(saved) : [];
      return loadedHistory;
    } catch (e) {
      console.error("Failed to load chatHistory from localStorage. Data might be corrupted or incompatible. Starting fresh.", e);
      return [];
    }
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('tasks');
      const loadedTasks: Task[] = saved ? JSON.parse(saved) : [];
      return loadedTasks.map(task => ({
        ...task,
        priority: task.priority || 'Medium', // Ensure priority defaults
        status: task.status || 'Pending', // Ensure status defaults
        description: task.description || '', // Ensure description defaults
      }));
    } catch (e) {
      console.error("Failed to load tasks from localStorage. Data might be corrupted or incompatible. Starting fresh.", e);
      return [];
    }
  });

  const [frequentlySearchedKeywords, setFrequentlySearchedKeywords] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('frequentlySearchedKeywords');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load frequently searched keywords from localStorage. Data might be corrupted or incompatible. Starting fresh.", e);
      return [];
    }
  });

  const [generationContext, setGenerationContext] = useState<GenerationContext | null>(null);
  const [selectedJobForViewing, setSelectedJobForViewing] = useState<Job | null>(null);
  const [selectedApplicationForInterview, setSelectedApplicationForInterview] = useState<Application | null>(null);

  // New: State for onboarding tour
  const [isNewUser, setIsNewUserState] = useState<boolean>(() => {
    try {
      const hasCompleted = localStorage.getItem('hasCompletedOnboarding');
      return hasCompleted !== 'true'; // If not 'true', then it's a new user
    } catch (e) {
      console.error("Failed to load onboarding status from localStorage. Starting fresh.", e);
      return true; // Assume new user if status cannot be read
    }
  });

  // New: Wrapper to also update localStorage
  const setIsNewUser = (isNew: boolean) => {
    setIsNewUserState(isNew);
    try {
      localStorage.setItem('hasCompletedOnboarding', (!isNew).toString());
    } catch (e) {
      console.error("Failed to save onboarding status to localStorage.", e);
    }
  };

  // New: Global error state for AI API calls or other critical issues
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000); // Clear error after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [error]);


  useEffect(() => {
    try {
      localStorage.setItem('resumes', JSON.stringify(resumes));
    } catch (e) {
      console.error("Failed to save resumes to localStorage.", e);
    }
  }, [resumes]);

  useEffect(() => {
    try {
      if (defaultResumeId) {
          localStorage.setItem('defaultResumeId', defaultResumeId);
      } else {
          localStorage.removeItem('defaultResumeId');
      }
    } catch (e) {
      console.error("Failed to save defaultResumeId to localStorage.", e);
    }
  }, [defaultResumeId]);

  useEffect(() => {
    try {
      localStorage.setItem('applications', JSON.stringify(applications));
    } catch (e) {
      console.error("Failed to save applications to localStorage.", e);
    }
  }, [applications]);

  useEffect(() => {
    try {
      localStorage.setItem('savedJobs', JSON.stringify(savedJobs));
    } catch (e) {
      console.error("Failed to save savedJobs to localStorage.", e);
    }
  }, [savedJobs]);

  useEffect(() => {
    try {
      localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    } catch (e) {
      console.error("Failed to save chatHistory to localStorage.", e);
    }
  }, [chatHistory]);

  useEffect(() => {
    try {
      localStorage.setItem('tasks', JSON.stringify(tasks));
    } catch (e) {
      console.error("Failed to save tasks to localStorage.", e);
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem('frequentlySearchedKeywords', JSON.stringify(frequentlySearchedKeywords));
    } catch (e) {
      console.error("Failed to save frequentlySearchedKeywords to localStorage.", e);
    }
  }, [frequentlySearchedKeywords]);


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
    chatHistory,
    setChatHistory,
    tasks,
    setTasks,
    frequentlySearchedKeywords,
    setFrequentlySearchedKeywords,
    isNewUser, // New: Add to context value
    setIsNewUser, // New: Add to context value
    error, // New: Add global error to context value
    setError, // New: Add global error setter to context value
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