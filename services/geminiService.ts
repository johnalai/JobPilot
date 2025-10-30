
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { Application, CompanyInsights, Job, ResumeContent, SkillGapAnalysis, WebGroundingChunk } from '../types';

// Initialize the Gemini API client
// Always use `const ai = new GoogleGenAI({apiKey: process.env.API_KEY});`

// FIX: Safely initialize GoogleGenAI. If API_KEY is missing, provide a mock object to prevent app crash,
// but log a clear error to the console so the user knows why AI features won't work.
let ai: GoogleGenAI;
if (!process.env.API_KEY) {
  console.error("CRITICAL ERROR: Google Gemini API Key (process.env.API_KEY) is missing. AI features will not function.");
  // Provide a mock object for 'ai' to prevent crashes when attempting to call methods on it.
  // Any calls to generateContent on this mock will throw a specific error.
  ai = {
    models: {
      generateContent: async () => { throw new Error("Google Gemini API Key is missing. Please configure process.env.API_KEY."); },
      generateContentStream: async function* () { throw new Error("Google Gemini API Key is missing. Please configure process.env.API_KEY."); },
      generateImages: async () => { throw new Error("Google Gemini API Key is missing. Please configure process.env.API_KEY."); },
      generateVideos: async () => { throw new Error("Google Gemini API Key is missing. Please configure process.env.API_KEY."); },
    },
    chats: {
      create: () => ({
        sendMessage: async () => { throw new Error("Google Gemini API Key is missing. Please configure process.env.API_KEY."); },
        sendMessageStream: async function* () { throw new Error("Google Gemini API Key is missing. Please configure process.env.API_KEY."); },
      }),
    },
    live: {
      connect: async () => { throw new Error("Google Gemini API Key is missing. Please configure process.env.API_KEY."); },
    },
    operations: {
      getVideosOperation: async () => { throw new Error("Google Gemini API Key is missing. Please configure process.env.API_KEY."); },
    }
  } as unknown as GoogleGenAI; // Type assertion to satisfy type checker
} else {
  ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
}

// Domains to avoid as primary job sources due to being aggregators or difficult to parse directly.
// This list can be extended based on observed poor quality results.
export const DOMAINS_TO_AVOID_AS_PRIMARY_SOURCE = [
  'linkedin.com/jobs',
  'indeed.com',
  'ziprecruiter.com',
  'glassdoor.com',
  'monster.com',
  'careerbuilder.com',
  'simplyhired.com',
  'dice.com',
  'remotive.io', // ATS platform, not direct job board
  'lever.co', // ATS platform, not direct job board
  'workday.com', // ATS platform, not direct job board
];

// Helper to extract the domain from a URL
export function getDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Remove 'www.' prefix if present
    return hostname.startsWith('www.') ? hostname.substring(4) : hostname;
  } catch (e) {
    return '';
  }
}

// Interface for chat history, aligning with Gemini's content structure
interface RoleAndParts {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface FindJobsFilters {
  query: string;
  location: string;
  workModel: 'Any' | 'Remote' | 'Hybrid' | 'On-site';
  minSalary: string;
  experienceLevel: 'Any' | 'Entry-Level' | 'Mid-Level' | 'Senior';
  skills: string;
}

/**
 * Streams chat responses from the Gemini model.
 * @param prompt The user's message.
 * @param history The previous chat messages for context.
 * @returns An async generator of GenerateContentResponse chunks.
 */
// FIX: Update the return type of the async function to be a Promise that resolves to an AsyncGenerator.
export async function getChatStream(prompt: string, history: RoleAndParts[]): Promise<AsyncGenerator<GenerateContentResponse, any, unknown>> {
  const chat = ai.chats.create({
    model: 'gemini-2.5-flash', // Use gemini-2.5-flash for general chat tasks
    config: {
      systemInstruction: 'You are a helpful AI assistant for career advice, job searching, and application generation. Provide concise and relevant information. If asked about real-time events or specific company details, use your search capabilities.',
    },
  });
  const stream = await chat.sendMessageStream({ message: prompt });
  return stream;
}

/**
 * Finds jobs based on filters and optionally a base resume, using Google Search grounding.
 * The model's response will contain job summaries and grounding links.
 * The output structure needs to be carefully parsed from the model's text response,
 * as `responseSchema` is prohibited with `googleSearch`.
 *
 * This function will use a two-step approach:
 * 1. Use Google Search to get relevant job information.
 * 2. Parse the natural language response into structured Job objects using another model call.
 *
 * @param filters Job search filters.
 * @param baseResumeContent Optional content of the user's default resume for tailoring.
 * @returns An array of Job objects.
 */
export async function findJobs(filters: FindJobsFilters, baseResumeContent: ResumeContent | null): Promise<Job[]> {
  const resumeContext = baseResumeContent ? `Here is my resume summary: ${baseResumeContent.rawText.substring(0, 1000)}` : '';
  const filterDetails = Object.entries(filters)
    .filter(([, value]) => value && value !== 'Any')
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');

  const fullPrompt = `Find relevant job postings based on these criteria: ${filterDetails}. 
  ${resumeContext ? `Consider my resume content: ${resumeContext}.` : ''}
  For each job, provide the Title, Company, Location, a brief Description, Work Model (if available), and Date Posted (if available).
  Summarize at least 3-5 distinct job postings.
  Format the output as a JSON array of Job objects. If a field is not found, use "Not Specified".
  Respond ONLY with the JSON array, nothing else.
  The JSON structure should strictly follow the Job interface:
  [{
    "id": "unique-job-id-1",
    "title": "Job Title",
    "company": "Company Name",
    "location": "Job Location",
    "description": "Brief description of the job.",
    "workModel": "Remote/Hybrid/On-site/Not Specified",
    "datePosted": "Date posted (e.g., 2024-07-20 or Not Available)",
    "sourceUrl": "Optional URL if found in search",
    "grounding": []
  }]`;

  try {
    // Step 1: Use Google Search to find job information
    const searchResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        // Prohibited: responseMimeType and responseSchema with googleSearch
      },
    });

    // Extract text from the response. The model is instructed to provide JSON in the text.
    const textResponse = searchResponse.text;
    if (!textResponse) {
      console.warn("No text response from job search model.");
      return [];
    }

    // Attempt to extract JSON from the text response
    const jsonMatch = textResponse.match(/```json\n([\s\S]*?)\n```/);
    let rawJobsJsonString = jsonMatch ? jsonMatch[1] : textResponse; // Try to extract from code block, fallback to full text

    let parsedJobs: Job[] = [];
    try {
      parsedJobs = JSON.parse(rawJobsJsonString);
    } catch (parseError) {
      console.error("Failed to parse JSON directly from model's text response, attempting regex fallback:", parseError);
      // Fallback: If JSON parsing fails, try to parse individual job-like structures from text
      const jobRegex = /Title:\s*(.*?)\nCompany:\s*(.*?)\nLocation:\s*(.*?)\nDescription:\s*(.*?)(?=\nTitle:|\n\n|$)/gs;
      let match;
      const fallbackJobs: Job[] = [];
      let idCounter = 0;
      while ((match = jobRegex.exec(textResponse)) !== null) {
          fallbackJobs.push({
              id: `job-fallback-${Date.now()}-${idCounter++}`,
              title: match[1].trim(),
              company: match[2].trim(),
              location: match[3].trim(),
              description: match[4].trim(),
          });
      }
      parsedJobs = fallbackJobs;
    }

    // Add grounding information if available
    const groundingChunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const finalJobs: Job[] = parsedJobs.map(job => ({
        ...job,
        id: job.id || `job-${Date.now()}-${Math.random()}`, // Ensure ID exists
        grounding: groundingChunks as WebGroundingChunk[] || [], // Type assertion based on expected output
    }));

    // Filter out undesirable domains from grounding sources
    const filteredJobs = finalJobs.map(job => ({
      ...job,
      grounding: job.grounding?.filter(chunk => {
        if ('web' in chunk && chunk.web?.uri) {
          return !DOMAINS_TO_AVOID_AS_PRIMARY_SOURCE.some(domain => getDomain(chunk.web.uri!).includes(domain));
        }
        return false;
      })
    }));

    return filteredJobs;

  } catch (error) {
    console.error('Error finding jobs with Google Search grounding:', error);
    throw new Error('Failed to find jobs. Please check your query or try again later.');
  }
}

/**
 * Parses job details from a given URL using Google Search and model extraction.
 * @param url The URL of the job posting.
 * @returns A partial Job object with extracted details.
 */
export async function analyzeJobUrl(url: string): Promise<Partial<Job>> {
  if (!url || !url.startsWith('http')) {
    throw new Error("Invalid URL provided. Must start with http:// or https://");
  }

  const prompt = `Extract the following details from this job posting URL: "${url}".
  Provide: Job Title, Company Name, Location, Full Description, Work Model (e.g., Remote, Hybrid, On-site), and Date Posted.
  Format the output as a JSON object strictly following this schema:
  {
    "title": string,
    "company": string,
    "location": string,
    "description": string,
    "workModel"?: "Remote" | "Hybrid" | "On-site",
    "datePosted"?: string,
    "sourceUrl": string,
    "grounding": [{ "web": { "uri": string, "title"?: string }}] // Include grounding chunks for source
  }`;

  try {
    // Step 1: Use Google Search to access the URL content
    const searchResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const textResponse = searchResponse.text;
    if (!textResponse) {
      throw new Error("No text response from URL analysis model.");
    }
    
    // Attempt to extract JSON from the text response (model is instructed to provide JSON)
    const jsonMatch = textResponse.match(/```json\n([\s\S]*?)\n```/);
    let rawJobJsonString = jsonMatch ? jsonMatch[1] : textResponse;

    let parsedJob: Partial<Job>;
    try {
        parsedJob = JSON.parse(rawJobJsonString);
    } catch (parseError) {
        console.error("Failed to parse JSON directly from model's text response for URL, attempting markdown fallback:", parseError);
        // Fallback parsing if JSON is not perfectly formatted but still contains key-value pairs
        const titleMatch = textResponse.match(/Title:\s*(.*)/i);
        const companyMatch = textResponse.match(/Company:\s*(.*)/i);
        const locationMatch = textResponse.match(/Location:\s*(.*)/i);
        const descriptionMatch = textResponse.match(/Description:\s*([\s\S]*?)(?=\n\w+:|\n\n|$)/i);
        const workModelMatch = textResponse.match(/Work Model:\s*(.*)/i);
        const datePostedMatch = textResponse.match(/Date Posted:\s*(.*)/i);

        parsedJob = {
            title: titleMatch ? titleMatch[1].trim() : undefined,
            company: companyMatch ? companyMatch[1].trim() : undefined,
            location: locationMatch ? locationMatch[1].trim() : undefined,
            description: descriptionMatch ? descriptionMatch[1].trim() : undefined,
            workModel: workModelMatch ? (workModelMatch[1].trim() as "Remote" | "Hybrid" | "On-site") : undefined,
            datePosted: datePostedMatch ? datePostedMatch[1].trim() : undefined,
        };
    }

    // Add grounding information
    const groundingChunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks as WebGroundingChunk[] || [];
    const sourceUri = groundingChunks.find(chunk => 'web' in chunk && chunk.web?.uri === url)?.web?.uri || url;

    return { ...parsedJob, sourceUrl: sourceUri, grounding: groundingChunks };

  } catch (error) {
    console.error('Error analyzing job URL:', error);
    throw new Error('Failed to parse job details from URL. Ensure it is a valid job posting link.');
  }
}

/**
 * Parses job details from raw text description.
 * @param text The raw job description text.
 * @returns A partial Job object with extracted details.
 */
export async function analyzeJobText(text: string): Promise<Partial<Job>> {
  if (!text || text.trim().length < 50) { // Require minimum text length for meaningful analysis
    throw new Error("Job description text is too short or empty for analysis.");
  }

  const prompt = `Extract the following details from this job description text:
  "${text}"
  Provide: Job Title, Company Name, Location, Full Description, Work Model (e.g., Remote, Hybrid, On-site), and Date Posted.
  Format the output as a JSON object strictly following this schema:
  {
    "title": string,
    "company": string,
    "location": string,
    "description": string,
    "workModel"?: "Remote" | "Hybrid" | "On-site",
    "datePosted"?: string
  }`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro', // Use Pro for better text understanding and extraction
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            company: { type: Type.STRING },
            location: { type: Type.STRING },
            description: { type: Type.STRING },
            workModel: {
              type: Type.STRING,
              enum: ['Remote', 'Hybrid', 'On-site'],
              nullable: true
            },
            datePosted: { type: Type.STRING, nullable: true },
          },
          required: ['title', 'company', 'location', 'description'],
        },
      },
    });

    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr) as Partial<Job>;
  } catch (error) {
    console.error('Error analyzing job text:', error);
    throw new Error('Failed to parse job details from text. Ensure the text is a valid job description.');
  }
}

/**
 * Analyzes skill gaps between a job description and a resume.
 * @param job The job to analyze against.
 * @param resume The user's resume content.
 * @returns A SkillGapAnalysis object.
 */
export async function analyzeSkillGap(job: Job, resume: ResumeContent): Promise<SkillGapAnalysis> {
  const prompt = `Compare the following job description with the provided resume to identify matching skills, missing skills, and suggestions for how to acquire or highlight missing skills.
  Job Description:
  ${job.description}

  Resume:
  ${resume.rawText}

  Provide the analysis in a JSON object strictly following this schema:
  {
    "matchingSkills": string[],
    "missingSkills": string[],
    "suggestions": string[]
  }`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Flash is generally good for structured extraction
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchingSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
            missingSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['matchingSkills', 'missingSkills', 'suggestions'],
        },
      },
    });

    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr) as SkillGapAnalysis;
  } catch (error) {
    console.error('Error analyzing skill gap:', error);
    throw new Error('Failed to perform skill gap analysis. Please try again.');
  }
}

/**
 * Analyzes the ATS compliance of a resume against a job description.
 * @param job The job to analyze against.
 * @param resumeText The generated/tailored resume text.
 * @returns An ATS score and feedback object.
 */
export async function analyzeATSCompliance(job: Job, resumeText: string): Promise<Application['atsScore']> {
  if (!resumeText) {
    throw new Error("Resume content is empty. Cannot perform ATS analysis.");
  }

  const prompt = `Given the following job description and a resume, evaluate the resume's Applicant Tracking System (ATS) compliance.
  Provide a score from 0-100, overall feedback, a list of keywords from the job description that are missing from the resume,
  suggestions on how to integrate those missing keywords, and an assessment of jargon usage.
  
  Job Description:
  ${job.description}

  Resume to evaluate:
  ${resumeText}

  Provide the analysis in a JSON object strictly following this schema:
  {
    "score": number,
    "feedback": string,
    "missingKeywords": string[],
    "integrationSuggestions": string[],
    "jargonCheck": string
  }`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER, description: 'ATS match score out of 100.' },
            feedback: { type: Type.STRING, description: 'Overall feedback on ATS compliance.' },
            missingKeywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Keywords from job description missing in resume.' },
            integrationSuggestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Suggestions to integrate missing keywords.' },
            jargonCheck: { type: Type.STRING, description: 'Assessment of industry jargon usage.' },
          },
          required: ['score', 'feedback', 'missingKeywords', 'integrationSuggestions', 'jargonCheck'],
        },
      },
    });

    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr) as Application['atsScore'];
  } catch (error) {
    console.error('Error analyzing ATS compliance:', error);
    throw new Error('Failed to perform ATS compliance analysis. Please try again.');
  }
}

/**
 * Generates a tailored resume for a specific job.
 * @param job The target job.
 * @param baseResumeContent The user's base resume content.
 * @param customHeader Optional custom header for the document.
 * @returns The generated resume text.
 */
export async function generateResumeForJob(job: Job, baseResumeContent: ResumeContent, customHeader: string): Promise<string> {
  const prompt = `Generate a resume tailored specifically for the "${job.title}" position at "${job.company}".
  Use the following base resume content, but emphasize skills and experience most relevant to the job description,
  and rephrase bullet points to align with job requirements. Ensure keywords from the job description are naturally integrated.
  ${customHeader ? `Include this exact header at the very top:\n${customHeader}\n\n` : ''}

  Job Description:
  ${job.description}

  Base Resume Content:
  ${baseResumeContent.rawText}

  Focus on a modern, clean, and ATS-friendly format. Prioritize impact and measurable achievements.
  DO NOT include any introductory or concluding remarks, only the resume content.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro', // Pro for high-quality text generation
      contents: prompt,
      // No responseMimeType or responseSchema as it's free-form text
    });
    return response.text;
  } catch (error) {
    console.error('Error generating resume:', error);
    throw new Error('Failed to generate tailored resume. Please try again.');
  }
}

/**
 * Generates a tailored cover letter for a specific job.
 * @param job The target job.
 * @param baseResumeContent The user's base resume content.
 * @param tone The desired tone for the cover letter.
 * @param customHeader Optional custom header for the document.
 * @returns The generated cover letter text.
 */
export async function generateCoverLetterForJob(job: Job, baseResumeContent: ResumeContent, tone: string, customHeader: string): Promise<string> {
  const prompt = `Write a cover letter for the "${job.title}" position at "${job.company}".
  Adopt a ${tone} tone. Highlight how my skills and experiences align with the job description, drawing from my resume.
  Address it to the Hiring Manager or Team if no specific name is available.
  ${customHeader ? `Include this exact header at the very top:\n${customHeader}\n\n` : ''}

  Job Description:
  ${job.description}

  My Resume Content:
  ${baseResumeContent.rawText}

  Ensure it is concise, professional, and expresses genuine interest in the role and company.
  DO NOT include any introductory or concluding remarks, only the cover letter content.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro', // Pro for high-quality text generation
      contents: prompt,
      // No responseMimeType or responseSchema as it's free-form text
    });
    return response.text;
  } catch (error) {
    console.error('Error generating cover letter:', error);
    throw new Error('Failed to generate tailored cover letter. Please try again.');
  }
}

/**
 * Parses raw resume text into a structured ResumeContent object.
 * @param resumeText The raw text of the resume.
 * @returns A structured ResumeContent object.
 */
export async function parseResumeText(resumeText: string): Promise<ResumeContent> {
  const prompt = `Parse the following raw resume text and extract the key information into a structured JSON object.
  Extract:
  - Raw Text (the original input)
  - Skills (as an array of strings)
  - Experience (as an array of objects with title, company, description)
  - Education (as an array of objects with institution, degree)
  - Contact Info (name, address, phone, email, optional linkedin, github, portfolio)

  Resume Text:
  ${resumeText}

  Provide the output strictly as a JSON object following this schema:
  {
    "rawText": string,
    "skills": string[],
    "experience": [
      { "title": string, "company": string, "description": string }
    ],
    "education": [
      { "institution": string, "degree": string }
    ],
    "contactInfo": {
      "name": string,
      "address": string,
      "phone": string,
      "email": string,
      "linkedin"?: string,
      "github"?: string,
      "portfolio"?: string
    }
  }`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro', // Pro for complex parsing
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rawText: { type: Type.STRING },
            skills: { type: Type.ARRAY, items: { type: Type.STRING } },
            experience: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  company: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ['title', 'company', 'description'],
              },
            },
            education: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  institution: { type: Type.STRING },
                  degree: { type: Type.STRING },
                },
                required: ['institution', 'degree'],
              },
            },
            contactInfo: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                address: { type: Type.STRING },
                phone: { type: Type.STRING },
                email: { type: Type.STRING },
                linkedin: { type: Type.STRING, nullable: true },
                github: { type: Type.STRING, nullable: true },
                portfolio: { type: Type.STRING, nullable: true },
              },
              required: ['name', 'address', 'phone', 'email'],
            },
          },
          required: ['rawText', 'skills', 'experience', 'education', 'contactInfo'],
        },
      },
    });

    const jsonStr = response.text.trim();
    const parsedContent = JSON.parse(jsonStr) as ResumeContent;
    // Ensure rawText is the original input resumeText, not the model's summary if any.
    return { ...parsedContent, rawText: resumeText };
  } catch (error) {
    console.error('Error parsing resume text:', error);
    throw new Error('Failed to parse resume text. Please ensure the text is a valid resume.');
  }
}

/**
 * Fetches company insights using Google Search and model extraction.
 * This function uses a two-step approach:
 * 1. Use Google Search to gather raw information.
 * 2. Parse the natural language response into a structured CompanyInsights object using another model call.
 * @param companyName The name of the company to get insights for.
 * @returns A CompanyInsights object.
 */
export async function getCompanyInsights(companyName: string): Promise<CompanyInsights | null> {
  if (!companyName) {
    return null;
  }

  const searchPrompt = `Find recent information, industry, size, headquarters, Glassdoor rating and URL, website for "${companyName}". Summarize recent news or key developments.`;

  try {
    // Step 1: Use Google Search to gather raw information
    const searchResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: searchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const rawInsightsText = searchResponse.text;
    if (!rawInsightsText || rawInsightsText.trim() === '') {
      console.warn(`No raw text received for company insights for ${companyName}.`);
      return null;
    }

    // Step 2: Parse the raw text into a structured CompanyInsights object
    const parsePrompt = `Parse the following text into a JSON object strictly following the CompanyInsights schema.
    Extract company name, industry, size, headquarters, Glassdoor rating, Glassdoor URL, recent news (as an array of headlines/summaries), and website.
    If a field is not found, omit it or set to null. Ensure Glassdoor URL and website are full URLs.

    Text to parse:
    ${rawInsightsText}

    Schema:
    {
      "companyName": string,
      "industry"?: string,
      "size"?: string,
      "headquarters"?: string,
      "glassdoorRating"?: number,
      "glassdoorUrl"?: string,
      "recentNews"?: string[],
      "website"?: string
    }`;

    const parseResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Use Flash for parsing structured JSON
      contents: parsePrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            companyName: { type: Type.STRING },
            industry: { type: Type.STRING, nullable: true },
            size: { type: Type.STRING, nullable: true },
            headquarters: { type: Type.STRING, nullable: true },
            glassdoorRating: { type: Type.NUMBER, nullable: true },
            glassdoorUrl: { type: Type.STRING, nullable: true },
            recentNews: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
            website: { type: Type.STRING, nullable: true },
          },
          required: ['companyName'],
        },
      },
    });

    const jsonStr = parseResponse.text.trim();
    const insights = JSON.parse(jsonStr) as CompanyInsights;

    // Ensure companyName is explicitly set, as the model might infer it differently
    insights.companyName = companyName;

    return insights;
  } catch (error) {
    console.error(`Error fetching company insights for ${companyName}:`, error);
    // Return null or re-throw specific errors if needed
    return null;
  }
}
    