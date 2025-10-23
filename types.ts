// Moved from geminiService.ts to resolve circular dependency
export interface GroundingChunk {
  web: {
    uri?: string;
    title?: string;
  }
}

export type View = 'dashboard' | 'resume-hub' | 'job-finder' | 'saved-jobs' | 'applications' | 'application-generator' | 'interview-coach';

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
}

export interface Resume {
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

export type ApplicationStatus = 'Not Started' | 'Draft' | 'Submitted' | 'Interviewing' | 'Offer' | 'Rejected';

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