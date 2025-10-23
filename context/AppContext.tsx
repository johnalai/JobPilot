import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { View, Resume, Application, Job, Message, Task } from '../types'; // Import Task

// FIX: Define GenerationContext to be used for generating applications.
interface GenerationContext {
  job: Job;
  baseResume: Resume; // Now contains activeContent and versions
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

  chatHistory: Message[];
  setChatHistory: React.Dispatch<React.SetStateAction<Message[]>>;

  // New state for Task Manager
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;

  // New state for frequently searched keywords
  frequentlySearchedKeywords: string[];
  setFrequentlySearchedKeywords: React.Dispatch<React.SetStateAction<string[]>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [view, setView] = useState<View>('dashboard');
  
  const [resumes, setResumes] = useState<Resume[]>(() => {
    try {
      const saved = localStorage.getItem('resumes');
      const loadedResumes: Resume[] = saved ? JSON.parse(saved) : [];
      // Ensure existing resumes have the new 'versions' property if loading old data
      return loadedResumes.map(resume => ({
        ...resume,
        activeContent: resume.activeContent || (resume as any).content, // Handle potential old 'content' field
        versions: resume.versions || [{
          content: resume.activeContent || (resume as any).content,
          timestamp: Date.now(), // Use current time or a default if no timestamp
          versionName: 'Initial Import',
        }],
      }));
    } catch (e) {
      console.error("Failed to load resumes from localStorage, starting fresh.", e);
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

  const [chatHistory, setChatHistory] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('chatHistory');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // New state for Task Manager
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('tasks');
      const loadedTasks: Task[] = saved ? JSON.parse(saved) : [];
      // Ensure tasks have a priority field for older saved data
      return loadedTasks.map(task => ({
        ...task,
        priority: task.priority || 'Medium', // Default to 'Medium' if not present
      }));
    } catch (e) {
      return [];
    }
  });

  // New state for frequently searched keywords
  const [frequentlySearchedKeywords, setFrequentlySearchedKeywords] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('frequentlySearchedKeywords');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load frequently searched keywords from localStorage, starting fresh.", e);
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

  useEffect(() => {
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
  }, [chatHistory]);

  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('frequentlySearchedKeywords', JSON.stringify(frequentlySearchedKeywords));
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
    tasks, // Add tasks to context value
    setTasks, // Add setTasks to context value
    frequentlySearchedKeywords, // Add to context value
    setFrequentlySearchedKeywords, // Add to context value
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