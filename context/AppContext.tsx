import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { View, Resume, Application, Job, Message, Task, ResumeVersion, TailoredDocument } from '../types';

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

  tailoredDocuments: TailoredDocument[]; // New: Tailored documents state
  setTailoredDocuments: React.Dispatch<React.SetStateAction<TailoredDocument[]>>; // New: Setter for tailored documents

  selectedTailoredDocumentId: string | null; // New: To select a tailored doc from other views
  setSelectedTailoredDocumentId: React.Dispatch<React.SetStateAction<string | null>>; // New: Setter for selected tailored doc ID

  generationContext: GenerationContext | null;
  setGenerationContext: (context: GenerationContext | null) => void;

  selectedJobForViewing: Job | null;
  setSelectedJobForViewing: React.Dispatch<React.SetStateAction<Job | null>>;

  selectedApplicationForInterview: Application | null;
  setSelectedApplicationForInterview: React.Dispatch<React.SetStateAction<Application | null>>;

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

// Normalization functions for robustness
const normalizeResume = (resume: any): Resume => {
  if (typeof resume !== 'object' || resume === null) {
    console.warn("Invalid top-level resume data found, returning default structure.", resume);
    return {
      id: `resume-${Date.now()}-${Math.random()}`,
      name: 'Corrupted Resume',
      activeContent: { rawText: '', skills: [], experience: [], education: [], contactInfo: { name: '', address: '', phone: '', email: '' } },
      versions: [],
    };
  }

  const activeContent = (typeof resume.activeContent === 'object' && resume.activeContent !== null) ? resume.activeContent : {};
  const versions = Array.isArray(resume.versions) ? resume.versions : [];

  const normalizedContactInfo = (typeof activeContent.contactInfo === 'object' && activeContent.contactInfo !== null)
    ? {
        name: typeof activeContent.contactInfo.name === 'string' ? activeContent.contactInfo.name : '',
        address: typeof activeContent.contactInfo.address === 'string' ? activeContent.contactInfo.address : '',
        phone: typeof activeContent.contactInfo.phone === 'string' ? activeContent.contactInfo.phone : '',
        email: typeof activeContent.contactInfo.email === 'string' ? activeContent.contactInfo.email : '',
        linkedin: typeof activeContent.contactInfo.linkedin === 'string' ? activeContent.contactInfo.linkedin : undefined, // New
        github: typeof activeContent.contactInfo.github === 'string' ? activeContent.contactInfo.github : undefined,     // New
        portfolio: typeof activeContent.contactInfo.portfolio === 'string' ? activeContent.contactInfo.portfolio : undefined, // New
      }
    : { name: '', address: '', phone: '', email: '' };

  const normalizedActiveContent = {
    rawText: typeof activeContent.rawText === 'string' ? activeContent.rawText : '',
    skills: Array.isArray(activeContent.skills) ? activeContent.skills.filter((s: any) => typeof s === 'string') : [],
    experience: Array.isArray(activeContent.experience) ? activeContent.experience.map((exp: any) => ({
      title: typeof exp.title === 'string' ? exp.title : '',
      company: typeof exp.company === 'string' ? exp.company : '',
      description: typeof exp.description === 'string' ? exp.description : '',
    })).filter((exp: any) => exp.title || exp.company || exp.description) : [],
    education: Array.isArray(activeContent.education) ? activeContent.education.map((edu: any) => ({
      institution: typeof edu.institution === 'string' ? edu.institution : '',
      degree: typeof edu.degree === 'string' ? edu.degree : '',
    })).filter((edu: any) => edu.institution || edu.degree) : [],
    contactInfo: normalizedContactInfo,
  };

  const normalizedVersions = versions.length > 0
    ? versions.map((version: any) => {
        if (typeof version !== 'object' || version === null) {
            console.warn("Invalid resume version data found, skipping.", version);
            return null; // Filter out later
        }
        const vContent = (typeof version.content === 'object' && version.content !== null) ? version.content : {};
        const normalizedVContactInfo = (typeof vContent.contactInfo === 'object' && vContent.contactInfo !== null)
            ? {
                name: typeof vContent.contactInfo.name === 'string' ? vContent.contactInfo.name : '',
                address: typeof vContent.contactInfo.address === 'string' ? vContent.contactInfo.address : '',
                phone: typeof vContent.contactInfo.phone === 'string' ? vContent.contactInfo.phone : '',
                email: typeof vContent.contactInfo.email === 'string' ? vContent.contactInfo.email : '',
                linkedin: typeof vContent.contactInfo.linkedin === 'string' ? vContent.contactInfo.linkedin : undefined, // New
                github: typeof vContent.contactInfo.github === 'string' ? vContent.contactInfo.github : undefined,     // New
                portfolio: typeof vContent.contactInfo.portfolio === 'string' ? vContent.contactInfo.portfolio : undefined, // New
              }
            : { name: '', address: '', phone: '', email: '' };

        return {
          timestamp: typeof version.timestamp === 'number' ? version.timestamp : Date.now(),
          versionName: typeof version.versionName === 'string' ? version.versionName : 'Unnamed Version',
          content: {
            rawText: typeof vContent.rawText === 'string' ? vContent.rawText : '',
            skills: Array.isArray(vContent.skills) ? vContent.skills.filter((s: any) => typeof s === 'string') : [],
            experience: Array.isArray(vContent.experience) ? vContent.experience.map((exp: any) => ({
              title: typeof exp.title === 'string' ? exp.title : '',
              company: typeof exp.company === 'string' ? exp.company : '',
              description: typeof exp.description === 'string' ? exp.description : '',
            })).filter((exp: any) => exp.title || exp.company || exp.description) : [],
            education: Array.isArray(vContent.education) ? vContent.education.map((edu: any) => ({
              institution: typeof edu.institution === 'string' ? edu.institution : '',
              degree: typeof edu.degree === 'string' ? edu.degree : '',
            })).filter((edu: any) => edu.institution || edu.degree) : [],
            contactInfo: normalizedVContactInfo,
          },
        };
      }).filter(Boolean) as ResumeVersion[] // Filter out any nulls from invalid versions
    : [{ // If no versions exist or all were invalid, create one from active content
        content: normalizedActiveContent,
        timestamp: Date.now(),
        versionName: 'Initial Import',
      }];


  return {
    id: typeof resume.id === 'string' ? resume.id : `resume-${Date.now()}-${Math.random()}`, // Ensure ID
    name: typeof resume.name === 'string' ? resume.name : 'Untitled Resume',
    activeContent: normalizedActiveContent,
    versions: normalizedVersions,
  };
};

const normalizeJob = (job: any): Job => {
  if (typeof job !== 'object' || job === null) {
    console.warn("Invalid top-level job data found, returning default structure.", job);
    return {
      id: `job-${Date.now()}-${Math.random()}`,
      title: 'Corrupted Job',
      company: 'Unknown Company',
      location: 'Not Specified',
      description: 'No description provided.',
    };
  }
  return {
    id: typeof job.id === 'string' ? job.id : `job-${Date.now()}-${Math.random()}`,
    title: typeof job.title === 'string' ? job.title : 'Untitled Job',
    company: typeof job.company === 'string' ? job.company : 'Unknown Company',
    location: typeof job.location === 'string' ? job.location : 'Not Specified',
    description: typeof job.description === 'string' ? job.description : 'No description provided.',
    workModel: typeof job.workModel === 'string' ? job.workModel : undefined,
    datePosted: typeof job.datePosted === 'string' ? job.datePosted : undefined,
    sourceUrl: typeof job.sourceUrl === 'string' ? job.sourceUrl : undefined,
    grounding: Array.isArray(job.grounding) ? job.grounding : [],
    companyInsights: (typeof job.companyInsights === 'object' && job.companyInsights !== null) ? job.companyInsights : undefined, // companyInsights is optional
  };
};

const normalizeApplication = (app: any): Application => {
  if (typeof app !== 'object' || app === null) {
    console.warn("Invalid top-level application data found, returning default structure.", app);
    return {
      id: `app-${Date.now()}-${Math.random()}`,
      job: normalizeJob({}), // Default job
      baseResumeId: 'unknown',
      status: 'Not Started',
      applicationDate: new Date().toISOString(),
    };
  }

  return {
    id: typeof app.id === 'string' ? app.id : `app-${Date.now()}-${Math.random()}`,
    job: normalizeJob(app.job), // Recursively normalize job
    baseResumeId: typeof app.baseResumeId === 'string' ? app.baseResumeId : 'unknown',
    status: (typeof app.status === 'string' && ['Not Started', 'Draft', 'Applied', 'Submitted', 'Interviewing', 'Offer', 'Rejected'].includes(app.status)) ? app.status : 'Not Started',
    applicationDate: typeof app.applicationDate === 'string' ? app.applicationDate : new Date().toISOString(),
    generatedResumeId: (app as any).generatedResume ? undefined : (typeof app.generatedResumeId === 'string' ? app.generatedResumeId : undefined),
    generatedCoverLetterId: (app as any).generatedCoverLetter ? undefined : (typeof app.generatedCoverLetterId === 'string' ? app.generatedCoverLetterId : undefined),
    atsScore: (typeof app.atsScore === 'object' && app.atsScore !== null) ? app.atsScore : undefined, // atsScore is optional, no deep normalization here for simplicity
  };
};

const normalizeTailoredDocument = (doc: any): TailoredDocument => {
  if (typeof doc !== 'object' || doc === null) {
    console.warn("Invalid top-level tailored document data found, returning default structure.", doc);
    return {
      id: `tailored-doc-${Date.now()}-${Math.random()}`,
      name: 'Corrupted Document',
      type: 'resume',
      content: '',
      jobId: 'unknown',
      jobTitle: 'Unknown Job',
      jobCompany: 'Unknown Company',
      generationDate: Date.now(),
    };
  }
  return {
    id: typeof doc.id === 'string' ? doc.id : `tailored-doc-${Date.now()}-${Math.random()}`,
    name: typeof doc.name === 'string' ? doc.name : 'Untitled Document',
    type: (typeof doc.type === 'string' && ['resume', 'coverLetter'].includes(doc.type)) ? doc.type : 'resume', // Default to 'resume' if type is missing or invalid
    content: typeof doc.content === 'string' ? doc.content : '',
    jobId: typeof doc.jobId === 'string' ? doc.jobId : 'unknown',
    jobTitle: typeof doc.jobTitle === 'string' ? doc.jobTitle : 'Unknown Job',
    jobCompany: typeof doc.jobCompany === 'string' ? doc.jobCompany : 'Unknown Company',
    generationDate: typeof doc.generationDate === 'number' ? doc.generationDate : Date.now(),
  };
};

const normalizeMessage = (msg: any): Message => {
  if (typeof msg !== 'object' || msg === null) {
    console.warn("Invalid top-level message data found, returning default structure.", msg);
    return {
      id: Date.now() + Math.random(),
      text: 'Corrupted message',
      sender: 'bot',
    };
  }
  return {
    id: typeof msg.id === 'number' ? msg.id : Date.now() + Math.random(),
    text: typeof msg.text === 'string' ? msg.text : '',
    sender: (typeof msg.sender === 'string' && ['user', 'bot'].includes(msg.sender)) ? msg.sender : 'bot', // Default sender if missing
  };
};

const normalizeTask = (task: any): Task => {
  if (typeof task !== 'object' || task === null) {
    console.warn("Invalid top-level task data found, returning default structure.", task);
    return {
      id: `task-${Date.now()}-${Math.random()}`,
      title: 'Corrupted Task',
      description: '',
      dueDate: new Date().toISOString().split('T')[0],
      status: 'Pending',
      priority: 'Medium',
    };
  }
  return {
    id: typeof task.id === 'string' ? task.id : `task-${Date.now()}-${Math.random()}`,
    title: typeof task.title === 'string' ? task.title : 'Untitled Task',
    description: typeof task.description === 'string' ? task.description : '',
    dueDate: typeof task.dueDate === 'string' ? task.dueDate : new Date().toISOString().split('T')[0],
    status: (typeof task.status === 'string' && ['Pending', 'In Progress', 'Completed'].includes(task.status)) ? task.status : 'Pending',
    priority: (typeof task.priority === 'string' && ['Low', 'Medium', 'High'].includes(task.priority)) ? task.priority : 'Medium',
  };
};


export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [view, setView] = useState<View>('dashboard');
  
  const [resumes, setResumes] = useState<Resume[]>(() => {
    try {
      const saved = localStorage.getItem('resumes');
      const loadedResumes: any[] = saved ? JSON.parse(saved) : [];
      return loadedResumes.map(normalizeResume);
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
      const loadedApps: any[] = saved ? JSON.parse(saved) : [];
      return loadedApps.map(normalizeApplication);
    } catch (e) {
      console.error("Failed to load applications from localStorage. Data might be corrupted or incompatible. Starting fresh.", e);
      return [];
    }
  });
  
  const [savedJobs, setSavedJobs] = useState<Job[]>(() => {
    try {
      const saved = localStorage.getItem('savedJobs');
      const loadedJobs: any[] = saved ? JSON.parse(saved) : [];
      return loadedJobs.map(normalizeJob);
    } catch (e) {
      console.error("Failed to load savedJobs from localStorage. Data might be corrupted or incompatible. Starting fresh.", e);
      return [];
    }
  });

  const [tailoredDocuments, setTailoredDocuments] = useState<TailoredDocument[]>(() => {
    try {
      const saved = localStorage.getItem('tailoredDocuments');
      const loadedDocs: any[] = saved ? JSON.parse(saved) : [];
      return loadedDocs.map(normalizeTailoredDocument);
    } catch (e) {
      console.error("Failed to load tailored documents from localStorage. Data might be corrupted or incompatible. Starting fresh.", e);
      return [];
    }
  });

  const [chatHistory, setChatHistory] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('chatHistory');
      const loadedHistory: any[] = saved ? JSON.parse(saved) : [];
      return loadedHistory.map(normalizeMessage);
    } catch (e) {
      console.error("Failed to load chatHistory from localStorage. Data might be corrupted or incompatible. Starting fresh.", e);
      return [];
    }
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('tasks');
      const loadedTasks: any[] = saved ? JSON.parse(saved) : [];
      return loadedTasks.map(normalizeTask);
    } catch (e) {
      console.error("Failed to load tasks from localStorage. Data might be corrupted or incompatible. Starting fresh.", e);
      return [];
    }
  });

  const [frequentlySearchedKeywords, setFrequentlySearchedKeywords] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('frequentlySearchedKeywords');
      const loadedKeywords: any[] = saved ? JSON.parse(saved) : [];
      // Ensure it's an array of strings, filter out non-strings if any
      return loadedKeywords.filter(item => typeof item === 'string');
    } catch (e) {
      console.error("Failed to load frequently searched keywords from localStorage. Data might be corrupted or incompatible. Starting fresh.", e);
      return [];
    }
  });

  const [generationContext, setGenerationContext] = useState<GenerationContext | null>(null);
  const [selectedJobForViewing, setSelectedJobForViewing] = useState<Job | null>(null);
  const [selectedApplicationForInterview, setSelectedApplicationForInterview] = useState<Application | null>(null);
  const [selectedTailoredDocumentId, setSelectedTailoredDocumentId] = useState<string | null>(null); // New state for selected tailored doc ID

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
      localStorage.setItem('tailoredDocuments', JSON.stringify(tailoredDocuments)); // New: Persist tailoredDocuments
    } catch (e) {
      console.error("Failed to save tailoredDocuments to localStorage.", e);
    }
  }, [tailoredDocuments]);

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
    tailoredDocuments, // New: Add to context value
    setTailoredDocuments, // New: Add to context value
    selectedTailoredDocumentId, // New: Add to context value
    setSelectedTailoredDocumentId, // New: Add to context value
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