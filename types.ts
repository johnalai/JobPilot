import React from 'react';

// Moved from geminiService.ts to resolve circular dependency
export interface WebGroundingChunk {
  web: {
    uri?: string;
    title?: string;
  }
}

export type GroundingChunk = WebGroundingChunk;

export type TaskStatus = 'Pending' | 'In Progress' | 'Completed';
export type TaskPriority = 'Low' | 'Medium' | 'High'; // New: TaskPriority type

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string; // ISO date string e.g., 'YYYY-DD-MM'
  status: TaskStatus;
  priority: TaskPriority; // New: Added priority field
}

export type View = 'dashboard' | 'resume-hub' | 'job-finder' | 'saved-jobs' | 'applications' | 'application-generator' | 'interview-coach' | 'task-manager' | 'tailored-docs'; // Added 'tailored-docs'

export interface Experience {
  title: string;
  company: string;
  description: string;
}

export interface Education {
  institution: string;
  degree: string;
}

export interface ResumeContent {
  rawText: string;
  skills: string[];
  experience: Experience[];
  education: Education[];
  contactInfo: { // New: Structured contact information
    name: string;
    address: string;
    phone: string;
    email: string;
    linkedin?: string; // New: Optional LinkedIn URL
    github?: string; // New: Optional GitHub URL
    portfolio?: string; // New: Optional Portfolio URL
  };
}

export interface ResumeVersion {
  content: ResumeContent;
  timestamp: number;
  versionName: string;
}

export interface Resume {
  id: string;
  name: string;
  activeContent: ResumeContent; // The currently active/displayed content
  versions: ResumeVersion[]; // History of all saved contents
}

export interface ResumeTemplate {
  id: string;
  name: string;
  content: ResumeContent;
}

// New: Interface for Company Insights
export interface CompanyInsights {
  companyName: string;
  industry?: string;
  size?: string; // e.g., "1,001-5,000 employees"
  headquarters?: string;
  glassdoorRating?: number;
  glassdoorUrl?: string;
  recentNews?: string[]; // array of headlines/summaries
  website?: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  workModel?: string;
  datePosted?: string;
  sourceUrl?: string;
  grounding?: GroundingChunk[];
  companyInsights?: CompanyInsights; // New: Add company insights field
}

export type ApplicationStatus = 'Not Started' | 'Draft' | 'Applied' | 'Submitted' | 'Interviewing' | 'Offer' | 'Rejected';

export interface Application {
  id: string;
  job: Job;
  baseResumeId: string;
  status: ApplicationStatus;
  applicationDate: string;
  generatedResumeId?: string; // Changed from string content to ID
  generatedCoverLetterId?: string; // Changed from string content to ID
  atsScore?: {
    score: number;
    feedback: string;
    missingKeywords?: string[]; // New: Keywords from job not in resume
    integrationSuggestions?: string[]; // New: How to integrate missing keywords
    jargonCheck?: string; // New: Feedback on jargon usage
  };
}

// New: Types for Tailored Documents
export type TailoredDocumentType = 'resume' | 'coverLetter';

export interface TailoredDocument {
  id: string;
  name: string;
  type: TailoredDocumentType;
  content: string; // The raw generated text
  jobId: string; // The ID of the job it was tailored for
  jobTitle: string;
  jobCompany: string;
  generationDate: number; // Timestamp
}

export interface SkillGapAnalysis {
  matchingSkills: string[];
  missingSkills: string[];
  suggestions: string[];
}


export interface InterviewFeedback {
  score: number;
  strengths: string[];
  areasForImprovement: string[];
}

export interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
}