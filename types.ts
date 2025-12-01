export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  requirements?: string[]; // Changed from string to string[]
  niceToHave?: string[]; // Changed from string to string[]
  sourceUrl?: string;
  originalPostText?: string;
  postedDate?: string;
  salary?: string;
  jobType?: string;
  isSaved: boolean;
  groundingDetails?: GroundingDetail[];
  companyInsights?: CompanyInsights;
}

export interface GroundingDetail {
  title?: string;
  uri?: string;
  type?: 'web' | 'maps' | 'pdf' | 'html';
  pageNumbers?: number[];
  reviewSnippets?: {
    title: string;
    text: string;
  }[];
}

export interface CompanyInsights {
  companyName: string;
  overview: string;
  culture: string;
  productsAndServices: string;
  pros: string[];
  cons: string[];
  glassdoorRating: number | null;
  crunchbaseProfile?: string;
  linkedinProfile?: string;
  website?: string;
}

export interface Resume {
  id: string;
  name: string;
  content: string; // Markdown or raw text
  uploadDate: string;
  lastModified: string;
  normalizedContent: NormalizedResume | null;
  // File details
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  atsHistory?: AtsCheck[];
}

export interface AtsCheck {
  id: string;
  jobId?: string;
  jobTitle: string;
  company: string;
  date: string;
  score: number;
  feedback: string;
}

export interface NormalizedResume {
  contactInfo: ContactInfo;
  summary: string;
  experience: Experience[];
  education: Education[];
  skills: {
    category: string;
    items: string[];
  }[];
  awards?: string[];
  certifications?: string[];
  projects?: Project[];
  // Other sections as needed
}

export interface ContactInfo {
  name: string;
  email: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  address?: string;
}

export interface Experience {
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string[]; // Key achievements/responsibilities
}

export interface Education {
  degree: string;
  major: string;
  institution: string;
  location: string;
  graduationDate: string;
}

export interface Project {
  name: string;
  description: string;
  link?: string;
}

export interface Application {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  applicationDate: string;
  status: 'Applied' | 'Interviewing' | 'Offer' | 'Rejected' | 'Withdrawn';
  notes?: string;
  appliedResumeId?: string; // ID of the resume used
  appliedCoverLetterId?: string; // ID of the cover letter used
  generatedResumeId?: string; // ID of tailored resume
  generatedCoverLetterId?: string; // ID of tailored cover letter
  atsScore?: number;
  atsFeedback?: string;
}

export interface TailoredDocument {
  id: string;
  jobId: string;
  resumeId: string; // The base resume used
  jobTitle: string;
  jobCompany: string;
  type: 'resume' | 'coverLetter';
  content: string; // Markdown content
  generationDate: string;
  atsScore?: number;
  atsFeedback?: string;
}

export interface Task {
  id: string;
  title: string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'In Progress' | 'Completed';
  jobId?: string; // Optional: link to a specific job
  applicationId?: string; // Optional: link to a specific application
  description?: string;
}

export interface Keyword {
  id: string;
  term: string;
  count: number;
  lastUsed: string;
}

export type AppView =
  | 'Dashboard'
  | 'Resume Hub'
  | 'Find Jobs'
  | 'Saved Jobs'
  | 'My Applications'
  | 'Application Generator'
  | 'Interview Coach'
  | 'ChatBot'
  | 'Tailored Docs'
  | 'TaskManager'
  | 'Image Studio'
  | 'Video Studio';
