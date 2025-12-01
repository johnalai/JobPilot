import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import {
  AppView,
  Job,
  Resume,
  Application,
  TailoredDocument,
  Task,
  Keyword,
  NormalizedResume,
  ContactInfo
} from '../types';
import { generateId } from '../utils/fileUtils';
// Import the new, robust local storage helpers
import { getLocalStorageItem, setLocalStorageItem } from '../utils/localStorageUtils';

// Export AppContextType explicitly
export interface AppContextType {
  loadingState: 'loading' | 'loaded' | 'error'; // Expose loading state
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  introEnabled: boolean;
  setIntroEnabled: (enabled: boolean) => void;

  // Jobs
  jobs: Job[];
  // Fix: Update setJobs to accept functional updates as well
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;

  // Saved Jobs
  savedJobs: Job[];
  saveJob: (job: Job) => void; // Add or update a saved job
  removeSavedJob: (jobId: string) => void;

  // Resumes
  resumes: Resume[];
  setResumes: (resumes: Resume[]) => void;
  addResume: (resume: Resume) => void;
  updateResume: (resumeId: string, updates: Partial<Resume>) => void;
  removeResume: (resumeId: string) => void;
  currentResume: Resume | null;
  setCurrentResume: (resume: Resume | null) => void;
  generateEmptyResume: (name?: string) => Resume;

  // Applications
  applications: Application[];
  setApplications: (applications: Application[]) => void;
  addApplication: (application: Application) => void;
  updateApplication: (
    applicationId: string,
    updates: Partial<Application>,
  ) => void;
  removeApplication: (applicationId: string) => void;

  // Tailored Documents
  tailoredDocuments: TailoredDocument[];
  setTailoredDocuments: (docs: TailoredDocument[]) => void;
  addTailoredDocument: (doc: TailoredDocument) => void;
  removeTailoredDocument: (docId: string) => void;

  // Tasks
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  removeTask: (taskId: string) => void;

  // Keywords
  frequentlySearchedKeywords: Keyword[];
  addFrequentlySearchedKeyword: (term: string) => void;
  updateFrequentlySearchedKeywords: (keywords: Keyword[]) => void; // Not used in current code but good to have
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children?: ReactNode;
}

// --- Strict Type Guard Validators ---
const isValidDateString = (dateString: any): boolean => {
    if (typeof dateString !== 'string' || !dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
};
const isValidJob = (item: any): item is Job => !!(item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.company === 'string');
const isValidResume = (item: any): item is Resume => !!(item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.content === 'string' && isValidDateString(item.lastModified));
const isValidApplication = (item: any): item is Application => !!(item && typeof item.id === 'string' && typeof item.jobTitle === 'string' && typeof item.companyName === 'string' && isValidDateString(item.applicationDate) && typeof item.status === 'string');
const isValidTailoredDoc = (item: any): item is TailoredDocument => !!(item && typeof item.id === 'string' && typeof item.jobId === 'string' && typeof item.type === 'string' && isValidDateString(item.generationDate));
const isValidTask = (item: any): item is Task => !!(item && typeof item.id === 'string' && typeof item.title === 'string' && isValidDateString(item.dueDate) && typeof item.priority === 'string' && typeof item.status === 'string');
const isValidKeyword = (item: any): item is Keyword => !!(item && typeof item.id === 'string' && typeof item.term === 'string' && typeof item.count === 'number' && isValidDateString(item.lastUsed));

// Re-architected to a standard function declaration to prevent any TSX parsing ambiguity.
function sanitizeArray<T>(key: string, defaultValue: T[], validator: (item: any) => item is T): T[] {
    const items = getLocalStorageItem<T[]>(key, defaultValue);
    if (!Array.isArray(items)) return defaultValue;
    const validItems = items.filter(validator);
    if (validItems.length < items.length) {
        console.warn(`Removed ${items.length - validItems.length} corrupted items from "${key}".`);
        setLocalStorageItem(key, validItems); // Auto-heal the stored data
    }
    return validItems;
}

// Export AppProvider explicitly and use modern component syntax
export const AppProvider = ({ children }: { children?: ReactNode }) => {
  const [loadingState, setLoadingState] = useState<'loading' | 'loaded' | 'error'>('loading');

  // Initialize all states with safe, empty defaults.
  const [currentView, setCurrentView] = useState<AppView>('Dashboard');
  const [introEnabled, setIntroEnabled] = useState<boolean>(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [tailoredDocuments, setTailoredDocuments] = useState<TailoredDocument[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [frequentlySearchedKeywords, setFrequentlySearchedKeywords] = useState<Keyword[]>([]);
  const [currentResume, setCurrentResume] = useState<Resume | null>(null);

  // Defer all localStorage reading to a useEffect to prevent render-blocking crashes.
  useEffect(() => {
    try {
      // Load and sanitize all data from localStorage
      const loadedCurrentView = getLocalStorageItem('currentView', 'Dashboard');
      const loadedIntroEnabled = getLocalStorageItem('introEnabled', true);
      const loadedSavedJobs = sanitizeArray('savedJobs', [], isValidJob);
      const loadedResumes = sanitizeArray('resumes', [], isValidResume);
      const loadedApplications = sanitizeArray('applications', [], isValidApplication);
      const loadedTailoredDocs = sanitizeArray('tailoredDocuments', [], isValidTailoredDoc);
      const loadedTasks = sanitizeArray('tasks', [], isValidTask);
      const loadedKeywords = sanitizeArray('frequentlySearchedKeywords', [], isValidKeyword);
      let loadedCurrentResume = getLocalStorageItem<Resume | null>('currentResume', null);

      // Post-load data consistency checks
      if (loadedCurrentResume && !loadedResumes.some(r => r.id === loadedCurrentResume?.id)) {
        loadedCurrentResume = loadedResumes[0] || null;
      }

      // Set all states at once
      setCurrentView(loadedCurrentView);
      setIntroEnabled(loadedIntroEnabled);
      setSavedJobs(loadedSavedJobs);
      setResumes(loadedResumes);
      setApplications(loadedApplications);
      setTailoredDocuments(loadedTailoredDocs);
      setTasks(loadedTasks);
      setFrequentlySearchedKeywords(loadedKeywords);
      setCurrentResume(loadedCurrentResume);

      setLoadingState('loaded'); // Mark loading as complete
    } catch (error) {
      console.error("Catastrophic error during application data initialization:", error);
      setLoadingState('error'); // On any failure, switch to the error state
    }
  }, []);

  // Persist state to local storage when it changes
  useEffect(() => { if (loadingState === 'loaded') setLocalStorageItem('currentView', currentView); }, [currentView, loadingState]);
  useEffect(() => { if (loadingState === 'loaded') setLocalStorageItem('introEnabled', introEnabled); }, [introEnabled, loadingState]);
  useEffect(() => { if (loadingState === 'loaded') setLocalStorageItem('savedJobs', savedJobs); }, [savedJobs, loadingState]);
  useEffect(() => { if (loadingState === 'loaded') setLocalStorageItem('resumes', resumes); }, [resumes, loadingState]);
  useEffect(() => { if (loadingState === 'loaded') setLocalStorageItem('currentResume', currentResume); }, [currentResume, loadingState]);
  useEffect(() => { if (loadingState === 'loaded') setLocalStorageItem('applications', applications); }, [applications, loadingState]);
  useEffect(() => { if (loadingState === 'loaded') setLocalStorageItem('tailoredDocuments', tailoredDocuments); }, [tailoredDocuments, loadingState]);
  useEffect(() => { if (loadingState === 'loaded') setLocalStorageItem('tasks', tasks); }, [tasks, loadingState]);
  useEffect(() => { if (loadingState === 'loaded') setLocalStorageItem('frequentlySearchedKeywords', frequentlySearchedKeywords); }, [frequentlySearchedKeywords, loadingState]);

  // --- Actions ---
  const saveJob = useCallback((job: Job) => {
    setSavedJobs((prev) => {
      const existingIndex = prev.findIndex((j) => j.id === job.id);
      return existingIndex !== -1 ? prev.map((j, i) => i === existingIndex ? { ...j, ...job, isSaved: true } : j) : [...prev, { ...job, isSaved: true }];
    });
  }, []);

  const removeSavedJob = useCallback((jobId: string) => setSavedJobs((prev) => prev.filter((job) => job.id !== jobId)), []);
  const addResume = useCallback((resume: Resume) => setResumes((prev) => [...prev, resume]), []);
  const updateResume = useCallback((resumeId: string, updates: Partial<Resume>) => setResumes((prev) => prev.map((r) => (r.id === resumeId ? { ...r, ...updates, lastModified: new Date().toISOString() } : r))), []);
  const removeResume = useCallback((resumeId: string) => {
    setResumes((prev) => prev.filter((r) => r.id !== resumeId));
    setCurrentResume(prev => (prev?.id === resumeId ? null : prev));
  }, []);
  const generateEmptyResume = useCallback((name: string = 'New Resume'): Resume => {
    const defaultContactInfo: ContactInfo = { name: 'Your Name', email: 'your.email@example.com', phone: '(123) 456-7890', linkedin: 'linkedin.com/in/yourprofile' };
    return { id: generateId(), name: name, content: `# ${defaultContactInfo.name}\n\n**Email**: ${defaultContactInfo.email} | **Phone**: ${defaultContactInfo.phone} | **LinkedIn**: ${defaultContactInfo.linkedin}\n\n## Summary\nA concise overview of your professional background and career goals.`, uploadDate: new Date().toISOString(), lastModified: new Date().toISOString(), normalizedContent: { contactInfo: defaultContactInfo, summary: 'A concise overview...', experience: [], education: [], skills: [] } };
  }, []);
  const addApplication = useCallback((application: Application) => setApplications((prev) => [...prev, application]), []);
  const updateApplication = useCallback((applicationId: string, updates: Partial<Application>) => setApplications((prev) => prev.map((app) => (app.id === applicationId ? { ...app, ...updates } : app))), []);
  const removeApplication = useCallback((applicationId: string) => setApplications((prev) => prev.filter((app) => app.id !== applicationId)), []);
  const addTailoredDocument = useCallback((doc: TailoredDocument) => setTailoredDocuments((prev) => [...prev, doc]), []);
  const removeTailoredDocument = useCallback((docId: string) => setTailoredDocuments((prev) => prev.filter((doc) => doc.id !== docId)), []);
  const addTask = useCallback((task: Task) => setTasks((prev) => [...prev, task]), []);
  const updateTask = useCallback((taskId: string, updates: Partial<Task>) => setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task))), []);
  const removeTask = useCallback((taskId: string) => setTasks((prev) => prev.filter((task) => task.id !== taskId)), []);
  const addFrequentlySearchedKeyword = useCallback((term: string) => {
    setFrequentlySearchedKeywords((prev) => {
      const existingIndex = prev.findIndex((k) => k.term.toLowerCase() === term.toLowerCase());
      if (existingIndex !== -1) return prev.map((k, i) => i === existingIndex ? { ...k, count: k.count + 1, lastUsed: new Date().toISOString() } : k);
      return [...prev, { id: generateId(), term, count: 1, lastUsed: new Date().toISOString() }];
    });
  }, []);
  const updateFrequentlySearchedKeywords = useCallback((keywords: Keyword[]) => setFrequentlySearchedKeywords(keywords), []);

  const contextValue: AppContextType = {
    loadingState, // Provide loadingState to consumers
    currentView, setCurrentView, introEnabled, setIntroEnabled, jobs, setJobs, savedJobs, saveJob, removeSavedJob,
    resumes, setResumes, addResume, updateResume, removeResume, currentResume, setCurrentResume, generateEmptyResume,
    applications, setApplications, addApplication, updateApplication, removeApplication,
    tailoredDocuments, setTailoredDocuments, addTailoredDocument, removeTailoredDocument,
    tasks, setTasks, addTask, updateTask, removeTask,
    frequentlySearchedKeywords, addFrequentlySearchedKeyword, updateFrequentlySearchedKeywords,
  };

  const handleClearDataAndReload = () => {
    console.warn("Clearing application data due to a critical error.");
    const keysToRemove = ['currentView', 'introEnabled', 'savedJobs', 'resumes', 'currentResume', 'applications', 'tailoredDocuments', 'tasks', 'frequentlySearchedKeywords'];
    keysToRemove.forEach(key => localStorage.removeItem(key));
    window.location.reload();
  };

  if (loadingState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
        <svg className="animate-spin h-10 w-10 text-blue-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="mt-4 text-lg text-gray-700">Loading Application...</p>
      </div>
    );
  }

  if (loadingState === 'error') {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 text-gray-800">
        <div className="bg-white shadow-2xl rounded-lg p-8 max-w-lg text-center border-t-4 border-red-500">
          <h1 className="text-3xl font-bold text-red-600 mb-4">Application Error</h1>
          <p className="text-lg text-gray-700 mb-6">The application has encountered a critical error, likely due to corrupted saved data.</p>
          <p className="text-lg text-gray-700 mb-8">To get you back up and running, please reset the application's data.</p>
          <button
            onClick={handleClearDataAndReload}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105"
          >
            Clear Data and Reload Application
          </button>
          <p className="text-xs text-gray-500 mt-6">Please note: This will remove all saved jobs, resumes, and applications stored in your browser.</p>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};