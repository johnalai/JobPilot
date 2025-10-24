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

export type View = 'dashboard' | 'resume-hub' | 'job-finder' | 'saved-jobs' | 'applications' | 'application-generator' | 'interview-coach' | 'task-manager';

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
  contactInfo?: { // New: Structured contact information
    name: string;
    address: string;
    phone: string;
    email: string;
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
}

export type ApplicationStatus = 'Not Started' | 'Draft' | 'Applied' | 'Submitted' | 'Interviewing' | 'Offer' | 'Rejected';

export interface Application {
  id: string;
  job: Job;
  baseResumeId: string;
  status: ApplicationStatus;
  applicationDate: string;
  generatedResume?: string;
  generatedCoverLetter?: string;
  atsScore?: {
    score: number;
    feedback: string;
    missingKeywords?: string[]; // New: Keywords from job not in resume
    integrationSuggestions?: string[]; // New: How to integrate missing keywords
    jargonCheck?: string; // New: Feedback on jargon usage
  };
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