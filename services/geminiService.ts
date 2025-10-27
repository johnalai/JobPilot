import { GoogleGenAI, Type, GenerateContentResponse, Chat, Modality, FunctionDeclaration, Tool } from "@google/genai";
// FIX: Import GroundingChunk type directly as it's used for type annotations.
import { Job, Resume, ResumeContent, SkillGapAnalysis, Application, WebGroundingChunk, CompanyInsights, GroundingChunk } from '../types';

// This interface is needed for findJobs, it's defined in JobFinder.tsx but better to have it here or in types.ts
export interface FindJobsFilters {
  query: string;
  location: string;
  workModel: 'Any' | 'Remote' | 'Hybrid' | 'On-site';
  minSalary: string;
  experienceLevel: 'Any' | 'Entry-Level' | 'Mid-Level' | 'Senior';
  skills: string;
}

// List of domains to avoid as primary sources (paywalls, generic search results, etc.)
export const DOMAINS_TO_AVOID_AS_PRIMARY_SOURCE = [
  'remoterocketship.com', // Example paywalled site
  'ziprecruiter.com',     // Common paywalled site
  'google.com/search',    // Generic Google search results
  'aistudio.google.com',  // Placeholder/internal links
  // Add other domains to avoid as needed
];

// Helper to extract domain from URL
export const getDomain = (url: string) => {
  try {
      const hostname = new URL(url).hostname;
      // Remove 'www.' prefix if present
      return hostname.startsWith('www.') ? hostname.substring(4) : hostname;
  } catch (e) {
      return ''; // Invalid URL
  }
};

// Helper to clean LLM JSON response from markdown fences
const cleanJsonResponse = (jsonString: string): string => {
  // Remove markdown code block fences if they exist
  const cleaned = jsonString.replace(/```json\n?|\n?```/g, '').trim();
  return cleaned;
};

// Helper to remove internal LLM instructions from generated text outputs
const cleanLLMOutputInstructions = (text: string): string => {
  let cleanedText = text;
  // Remove explicit header markers and critical instructions
  cleanedText = cleanedText.replace(/---START OF COVER LETTER HEADER---\n?/g, '');
  cleanedText = cleanedText.replace(/\n?---END OF COVER LETTER HEADER---/g, '');
  cleanedText = cleanedText.replace(/CRITICAL: The following complete header block must be used EXACTLY as provided, including all line breaks. Do NOT add or change anything in it.\n?/g, '');
  cleanedText = cleanedText.replace(/CRITICAL: You MUST use the following complete header EXACTLY as provided, including all line breaks, at the very beginning of the cover letter. Do NOT add anything before it or modify its content.\n?/g, '');
  cleanedText = cleanedText.replace(/Return ONLY the full cover letter text, starting with the header above, followed by the salutation and body. Do NOT include any additional comments, instructions, or introductory\/concluding remarks outside the letter itself.\n?/g, '');
  // Clean up any remaining extra newlines at the start/end
  return cleanedText.trim();
};


const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

// For parsing resume text into structured data
export const parseResumeText = async (rawText: string): Promise<ResumeContent> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Parse the following resume text and extract skills, work experience, education, and crucially, the candidate's full name, address, phone number, and email address.
    Resume Text:
    ---
    ${rawText}
    ---
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          skills: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "A list of skills found in the resume."
          },
          experience: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Job title" },
                company: { type: Type.STRING, description: "Company name" },
                description: { type: Type.STRING, description: "A summary of responsibilities and achievements." }
              },
              required: ['title', 'company', 'description']
            },
            description: "A list of work experiences."
          },
          education: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                institution: { type: Type.STRING, description: "Name of the school or institution." },
                degree: { type: Type.STRING, description: "Degree or certification obtained." }
              },
              required: ['institution', 'degree']
            },
            description: "A list of educational qualifications."
          },
          contactInfo: { // New: Add contactInfo to schema
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Candidate's full name." },
              address: { type: Type.STRING, description: "Candidate's full mailing address." },
              phone: { type: Type.STRING, description: "Candidate's phone number." },
              email: { type: Type.STRING, description: "Candidate's email address." },
            },
          }
        },
        required: ['skills', 'experience', 'education', 'contactInfo'] // FIX: Made contactInfo object itself required
      }
    }
  });

  const jsonResponse = JSON.parse(response.text);
  return { ...jsonResponse, rawText };
};

// For finding jobs using Google Search and optionally Maps grounding
export const findJobs = async (filters: FindJobsFilters, resume: ResumeContent | null): Promise<Job[]> => {
  let prompt = `Find relevant job postings based on the following criteria:\n`;
  prompt += `- Keywords: ${filters.query}\n`;
  if (filters.location) prompt += `- Location: ${filters.location}\n`;
  if (filters.workModel !== 'Any') prompt += `- Work Model: ${filters.workModel}\n`;
  if (filters.minSalary) prompt += `- Minimum Salary: $${filters.minSalary}\n`;
  if (filters.experienceLevel !== 'Any') prompt += `- Experience Level: ${filters.experienceLevel}\n`;
  if (filters.skills) prompt += `- Required Skills: ${filters.skills}\n`;
  if (resume) {
      prompt += `\nConsider the following resume profile for tailoring the search:\n`;
      prompt += `- Key Skills: ${resume.skills.slice(0, 5).join(', ')}\n`;
      if (resume.experience.length > 0) {
        prompt += `- Most Recent Role: ${resume.experience[0].title} at ${resume.experience[0].company}\n`;
      }
  }
  // FIX: Removed the "up to 10" limit from the prompt.
  prompt += "\nReturn a comprehensive list of all relevant job postings. For each job, provide a title, company, location, and a comprehensive job description, capturing all available essential details. DO NOT provide a source URL in this response.";

  const tools: Tool[] = [{ googleSearch: {} }];

  let initialResponseText = '';
  let globalGroundingChunks: GroundingChunk[] = [];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: tools,
        thinkingConfig: { thinkingBudget: 512 }, // Increased thinking budget to allow for more comprehensive results
      },
    });
    initialResponseText = response.text;
    globalGroundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] || [];
  } catch (e: any) {
    console.error("Gemini API call (grounding) failed for findJobs:", e);
    // FIX: Replaced direct `setError` call with throwing an error.
    throw new Error(e.message || "Failed to search for jobs (initial AI call).");
  }


  // Filter out undesirable domains from the global grounding chunks
  const filteredGlobalGrounding = globalGroundingChunks.filter(chunk => {
      if ('web' in chunk && chunk.web?.uri) {
          return !DOMAINS_TO_AVOID_AS_PRIMARY_SOURCE.some(domain => getDomain(chunk.web.uri).includes(domain));
      }
      return false; // Only keep valid web chunks
  });

  let extractionResponseText = '';
  try {
    // Since the response is grounded text and not guaranteed JSON, we'll parse it with another LLM call.
    // This is a common pattern for extracting structured data from unstructured grounded responses.
    const extractionResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Extract the job postings from the following text into a clean JSON array. Each object should have 'title', 'company', 'location', 'description', 'workModel', 'datePosted'. If a field is not present, omit it. The 'description' should be as **comprehensive and detailed as possible, capturing ALL essential information.**
      CRITICAL: Do NOT summarize the description; provide it in its entirety from the source.
      
      Text:
      ---
      ${initialResponseText}
      ---
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              company: { type: Type.STRING },
              location: { type: Type.STRING },
              description: { type: Type.STRING },
              workModel: { type: Type.STRING },
              datePosted: { type: Type.STRING },
            },
            required: ['title', 'company', 'location', 'description']
          }
        },
        thinkingConfig: { thinkingBudget: 256 }, // FIX: Added thinking budget for JSON extraction
      }
    });
    extractionResponseText = extractionResponse.text;
  } catch (e: any) {
    console.error("Gemini API call (JSON extraction) failed for findJobs. Raw response:", initialResponseText, "Error:", e);
    // FIX: Replaced direct `setError` call with throwing an error.
    throw new Error(e.message || "Failed to process job search results (AI parsing).");
  }

  let extractedJobs: any[] = [];
  try {
    extractedJobs = JSON.parse(cleanJsonResponse(extractionResponseText));
  } catch (e: any) {
    console.error("Failed to parse JSON response for findJobs. Raw JSON output:", extractionResponseText, "Error:", e);
    // FIX: Replaced direct `setError` call with throwing an error.
    throw new Error("Failed to interpret job search results. AI returned invalid data.");
  }


  const jobs: Job[] = extractedJobs.map((job: any, index: number) => {
    const jobTitleLower = (job.title || '').toLowerCase();
    const companyNameLower = (job.company || '').toLowerCase();
    const jobKeywords = jobTitleLower.split(/\s+/).filter(Boolean); // Tokenize job title
    const companyKeywords = companyNameLower.split(/\s+/).filter(Boolean); // Tokenize company name

    // Heuristic: filter grounding chunks to be specific to this job
    let jobSpecificGrounding = filteredGlobalGrounding.filter(chunk => {
        if ('web' in chunk && chunk.web?.uri) {
            const uriLower = chunk.web.uri.toLowerCase();
            const titleLower = (chunk.web.title || '').toLowerCase();
            
            // Check for multiple keyword matches in URI or title
            const hasJobTitleKeywords = jobKeywords.some(keyword => uriLower.includes(keyword) || titleLower.includes(keyword));
            const hasCompanyKeywords = companyKeywords.some(keyword => uriLower.includes(keyword) || titleLower.includes(keyword));

            // Also prioritize if the domain of the chunk matches the company name (e.g., "google.com" for Google)
            const domainMatchesCompany = companyNameLower && getDomain(chunk.web.uri).includes(companyNameLower.replace(/\s/g, '').split(' ')[0]);

            return (hasJobTitleKeywords && hasCompanyKeywords) || domainMatchesCompany;
        }
        return false; 
    });

    // Deduplicate job-specific grounding links by URI
    const uniqueJobGrounding = Array.from(new Map(jobSpecificGrounding.map(chunk => {
        if ('web' in chunk && chunk.web?.uri) {
            return [chunk.web.uri, chunk];
        }
        return [null, null]; // Should not happen with current filter
    })).values()).filter(Boolean) as GroundingChunk[];

    // Determine the best sourceUrl from the unique job-specific grounding
    let finalSourceUrl: string | undefined;

    if (uniqueJobGrounding.length > 0) {
        // Prioritize:
        // 1. URLs containing common job posting paths/keywords
        // 2. URLs that are company career pages (e.g., 'careers.company.com')
        // 3. URLs with more keyword matches
        uniqueJobGrounding.sort((a, b) => {
            const uriA = ('web' in a && a.web?.uri) ? a.web.uri.toLowerCase() : '';
            const titleA = ('web' in a && a.web?.title) ? a.web.title.toLowerCase() : '';
            const uriB = ('web' in b && b.web?.uri) ? b.web.uri.toLowerCase() : '';
            const titleB = ('web' in b && b.web?.title) ? b.web.title.toLowerCase() : '';

            let scoreA = 0;
            let scoreB = 0;

            // Boost for job-specific path segments
            if (uriA.includes('/job/') || uriA.includes('/careers/') || uriA.includes('/posting/') || uriA.includes('/apply')) scoreA += 10;
            if (uriB.includes('/job/') || uriB.includes('/careers/') || uriB.includes('/posting/') || uriB.includes('/apply')) scoreB += 10;

            // Boost for company career subdomain
            if (getDomain(uriA).startsWith('careers.') || getDomain(uriA).startsWith('jobs.')) scoreA += 5;
            if (getDomain(uriB).startsWith('careers.') || getDomain(uriB).startsWith('jobs.')) scoreB += 5;

            // Score based on keyword matches in URI and title
            const calculateKeywordScore = (text: string, keywords: string[]) => keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 1 : 0), 0);
            scoreA += calculateKeywordScore(uriA + titleA, [...jobKeywords, ...companyKeywords]);
            scoreB += calculateKeywordScore(uriB + titleB, [...jobKeywords, ...companyKeywords]);
            
            return scoreB - scoreA; // Descending score
        });
        
        if ('web' in uniqueJobGrounding[0] && uniqueJobGrounding[0].web?.uri) {
            finalSourceUrl = uniqueJobGrounding[0].web.uri;
        }
    }

    // Fallback: If no job-specific grounding yields a sourceUrl, try to find a relevant one from global filtered grounding
    // This is to ensure a link is almost always present if any non-paywalled source was identified by Gemini.
    if (!finalSourceUrl && filteredGlobalGrounding.length > 0) {
        let fallbackCandidate: GroundingChunk | undefined;
        // Try to find a global grounding chunk that at least contains the company name
        fallbackCandidate = filteredGlobalGrounding.find(chunk => {
            if ('web' in chunk && chunk.web?.uri) {
                const uriLower = chunk.web.uri.toLowerCase();
                const titleLower = (chunk.web.title || '').toLowerCase();
                return companyKeywords.some(keyword => uriLower.includes(keyword) || titleLower.includes(keyword));
            }
            return false;
        });
        // If still no candidate, just take the first global filtered one
        if (!fallbackCandidate && filteredGlobalGrounding.length > 0) {
            fallbackCandidate = filteredGlobalGrounding[0];
        }
        if (fallbackCandidate && 'web' in fallbackCandidate && fallbackCandidate.web?.uri) {
            finalSourceUrl = fallbackCandidate.web.uri;
        }
    }


    return {
        ...job,
        id: `job-${Date.now()}-${index}`, // Ensure unique ID for each job
        sourceUrl: finalSourceUrl, // Assign the refined source URL
        grounding: uniqueJobGrounding, // Assign the filtered and unique, job-specific grounding
    };
  });

  return jobs;
};

// For fetching company insights
export const getCompanyInsights = async (companyName: string): Promise<CompanyInsights | null> => {
    if (!companyName.trim()) {
        throw new Error("Company name cannot be empty for insights search.");
    }
    
    // Initialize GoogleGenAI instance *before* making the API call
    const aiWithKey = new GoogleGenAI({ apiKey: process.env.API_KEY! });

    const prompt = `Find company insights for "${companyName}". Extract the following information into a structured JSON object.
    CRITICAL: The output MUST be a JSON object, wrapped in markdown code block fences (E.g., \`\`\`json\\n{...}\\n\`\`\`).
    - Company Name (as provided)
    - Industry (e.g., "Software Development", "Financial Services")
    - Company Size (e.g., "1,001-5,000 employees")
    - Headquarters location (City, State, Country)
    - Glassdoor Rating (a single number, e.g., 4.2)
    - Glassdoor URL (link to the company's Glassdoor profile)
    - Recent News (a list of 2-3 concise headlines or summaries from recent articles, if available)
    - Official Website URL

    If information is not available, omit the field.
    `;

    let responseText = '';
    try {
      const response = await aiWithKey.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          // responseMimeType: "application/json", // Removed as per guidelines for googleSearch tool
          // responseSchema: { // Removed as per guidelines for googleSearch tool
          //   type: Type.OBJECT,
          //   properties: {
          //     companyName: { type: Type.STRING, description: "The name of the company." },
          //     industry: { type: Type.STRING, description: "The industry the company operates in." },
          //     size: { type: Type.STRING, description: "The number of employees in the company." },
          //     headquarters: { type: Type.STRING, description: "The main headquarters location of the company." },
          //     glassdoorRating: { type: Type.NUMBER, description: "The average Glassdoor rating of the company." },
          //     glassdoorUrl: { type: Type.STRING, description: "The URL to the company's Glassdoor profile." },
          //     recentNews: {
          //       type: Type.ARRAY,
          //       items: { type: Type.STRING },
          //       description: "2-3 recent news headlines or summaries about the company."
          //     },
          //     website: { type: Type.STRING, description: "The official website URL of the company." },
          //   },
          //   required: ['companyName'] // Only companyName is strictly required, others are optional
          // },
          thinkingConfig: { thinkingBudget: 256 }, // Added thinking budget for JSON extraction
        },
      });
      responseText = response.text;
    } catch (e: any) {
      console.error("Gemini API call (company insights) failed for company:", companyName, "Error:", e);
      throw new Error(e.message || "Failed to fetch company insights (AI service error).");
    }

    try {
      const insights = JSON.parse(cleanJsonResponse(responseText));
      return insights;
    } catch (e: any) {
      console.error("Failed to parse JSON response for company insights. Raw JSON output:", responseText, "Error:", e);
      throw new Error("Failed to interpret company insights. AI returned invalid data. Raw response: " + responseText);
    }
};

// For the chatbot
export const getChatStream = async (message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[]) => {
    // FIX: Initialize GoogleGenAI inside the function to pick up latest API_KEY
    const aiChat = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const chat: Chat = aiChat.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: "You are JobBot, an expert career assistant. Help users with their job search, resume building, and interview preparation. Keep your answers concise and helpful."
        },
        history: history
    });
    return chat.sendMessageStream({ message });
};

// For analyzing a job from a URL
export const analyzeJobUrl = async (url: string): Promise<Partial<Job>> => {
    const prompt = `I will provide a URL to a job posting. Please act as if you have visited the URL and extract the key details from the job posting.
    URL: ${url}
    
    Extract the following information:
    - Job Title
    - Company Name
    - Location
    - A **full, comprehensive, and essential job description, capturing ALL available and essential details without any summarization or truncation**
    - Work Model (e.g., Remote, Hybrid, On-site)
    `;

    let initialResponseText = '';
    let globalGroundingChunks: GroundingChunk[] = [];

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
      initialResponseText = response.text;
      globalGroundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] || [];
    } catch (e: any) {
      console.error("Gemini API call (grounding) failed for analyzeJobUrl:", e);
      throw new Error(e.message || "Failed to analyze job URL (initial AI call).");
    }


    let extractionResponseText = '';
    try {
      const extractionResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `From the following text, extract the job details into a JSON object. The 'description' should be as **comprehensive and detailed as possible, capturing ALL essential information.**
          CRITICAL: Do NOT summarize the description; provide it in its entirety from the source.
          Text:
          ---
          ${initialResponseText}
          ---`,
          config: {
              responseMimeType: "application/json",
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      title: { type: Type.STRING },
                      company: { type: Type.STRING },
                      location: { type: Type.STRING },
                      description: { type: Type.STRING },
                      workModel: { type: Type.STRING },
                  },
                  required: ['title', 'company', 'location', 'description']
              },
              thinkingConfig: { thinkingBudget: 256 }, // FIX: Added thinking budget for JSON extraction
          }
      });
      extractionResponseText = extractionResponse.text;
    } catch (e: any) {
      console.error("Gemini API call (JSON extraction) failed for analyzeJobUrl. Raw response:", initialResponseText, "Error:", e);
      throw new Error(e.message || "Failed to process job URL (AI parsing).");
    }
    
    let extractedData: Partial<Job> = {};
    try {
      extractedData = JSON.parse(cleanJsonResponse(extractionResponseText));
    } catch (e: any) {
      console.error("Failed to parse JSON response for analyzeJobUrl. Raw JSON output:", extractionResponseText, "Error:", e);
      throw new Error("Failed to interpret job URL. AI returned invalid data.");
    }

    // Filter out undesirable domains from the global grounding chunks
    const filteredGrounding = globalGroundingChunks.filter(chunk => {
        if ('web' in chunk && chunk.web?.uri) {
            // FIX: Use chunk.web.uri directly here as `uri` is not in scope.
            return !DOMAINS_TO_AVOID_AS_PRIMARY_SOURCE.some(domain => getDomain(chunk.web.uri).includes(domain));
        }
        return false; // Only keep valid web chunks
    });

    // Deduplicate grounding links by URI
    const uniqueGrounding = Array.from(new Map(filteredGrounding.map(chunk => {
        if ('web' in chunk && chunk.web?.uri) {
            return [chunk.web.uri, chunk];
        }
        return [null, null];
    })).values()).filter(Boolean) as GroundingChunk[];

    let finalSourceUrl: string | undefined;

    // 1. Prioritize the original input URL if it's valid and not in the "to avoid" list
    if (url && getDomain(url) !== '' && !DOMAINS_TO_AVOID_AS_PRIMARY_SOURCE.some(domain => getDomain(url).includes(domain))) {
        finalSourceUrl = url;
    } else {
        // 2. If original URL is not suitable, try to find a better one from grounding
        if (uniqueGrounding.length > 0) {
            const jobTitleLower = (extractedData.title || '').toLowerCase();
            const companyNameLower = (extractedData.company || '').toLowerCase();
            const jobKeywords = jobTitleLower.split(/\s+/).filter(Boolean);
            const companyKeywords = companyNameLower.split(/\s+/).filter(Boolean);

            uniqueGrounding.sort((a, b) => {
                const uriA = ('web' in a && a.web?.uri) ? a.web.uri.toLowerCase() : '';
                const titleA = ('web' in a && a.web?.title) ? a.web.title.toLowerCase() : '';
                const uriB = ('web' in b && b.web?.uri) ? b.web.uri.toLowerCase() : '';
                const titleB = ('web' in b && b.web?.title) ? b.web.title.toLowerCase() : '';

                let scoreA = 0;
                let scoreB = 0;

                // Boost for job-specific path segments
                if (uriA.includes('/job/') || uriA.includes('/careers/') || uriA.includes('/posting/') || uriA.includes('/apply')) scoreA += 10;
                if (uriB.includes('/job/') || uriB.includes('/careers/') || uriB.includes('/posting/') || uriB.includes('/apply')) scoreB += 10;

                // Boost for company career subdomain
                if (getDomain(uriA).startsWith('careers.') || getDomain(uriA).startsWith('jobs.')) scoreA += 5;
                if (getDomain(uriB).startsWith('careers.') || getDomain(uriB).startsWith('jobs.')) scoreB += 5;

                // Score based on keyword matches in URI and title
                const calculateKeywordScore = (text: string, keywords: string[]) => keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 1 : 0), 0);
                scoreA += calculateKeywordScore(uriA + titleA, [...jobKeywords, ...companyKeywords]);
                scoreB += calculateKeywordScore(uriB + titleB, [...jobKeywords, ...companyKeywords]);

                return scoreB - scoreA; // Descending score
            });

            if ('web' in uniqueGrounding[0] && uniqueGrounding[0].web?.uri) {
                finalSourceUrl = uniqueGrounding[0].web.uri;
            }
        }
    }

    return { ...extractedData, sourceUrl: finalSourceUrl, grounding: uniqueGrounding };
};

// For analyzing job from raw text
export const analyzeJobText = async (text: string): Promise<Partial<Job>> => {
    let responseText = '';
    try {
      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `From the following job description text, extract the key details into a JSON object. The 'description' should be as **comprehensive and detailed as possible, capturing ALL essential information.**
          CRITICAL: Do NOT summarize the description; provide it in its entirety from the source.
          Text:
          ---
          ${text}
          ---`,
          config: {
              responseMimeType: "application/json",
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      title: { type: Type.STRING },
                      company: { type: Type.STRING },
                      location: { type: Type.STRING },
                      description: { type: Type.STRING },
                      workModel: { type: Type.STRING },
                  },
                  required: ['title', 'company', 'location', 'description']
              },
              thinkingConfig: { thinkingBudget: 256 }, // FIX: Added thinking budget for JSON extraction
          }
      });
      responseText = response.text;
    } catch (e: any) {
      console.error("Gemini API call (JSON extraction) failed for analyzeJobText. Raw response:", text, "Error:", e);
      throw new Error(e.message || "Failed to process job text (AI parsing).");
    }

    try {
      // No grounding chunks or sourceUrl extraction from text input directly
      return JSON.parse(cleanJsonResponse(responseText));
    } catch (e: any) {
      console.error("Failed to parse JSON response for analyzeJobText. Raw JSON output:", responseText, "Error:", e);
      throw new Error("Failed to interpret job text. AI returned invalid data.");
    }
};


// For generating a tailored resume
export const generateResumeForJob = async (job: Job, resumeContent: ResumeContent, customHeader?: string): Promise<string> => {
    let basePrompt = `
    Job Description:
    ---
    Title: ${job.title} at ${job.company}
    Description: ${job.description}
    ---

    Base Resume:
    ---
    ${resumeContent.rawText}
    ---

    Based on the job description, rewrite the 'Base Resume' to highlight the most relevant skills and experiences.
    Focus on tailoring the summary and experience bullet points to match the job requirements.
    Return only the full, updated resume text. Do not add any introductory phrases.
    `;
    
    let finalPrompt = '';
    if (customHeader && customHeader.trim()) {
      finalPrompt = `CRITICAL: Use the following header EXACTLY as provided at the very top of the resume. Do not add or change anything in the header.
---CUSTOM HEADER START---
${customHeader.trim()}
---CUSTOM HEADER END---

` + basePrompt;
    } else {
      finalPrompt = `First, generate a professional header for a resume containing a name and contact information (e.g. Name, City, Phone, Email). Then, using that exact header, rewrite the resume based on the job description provided below.
CRITICAL: When generating the header, ensure it is professional and includes the candidate's name and full contact information (address, phone, email) if available in the base resume content.
CRITICAL: Once generated, use this header EXACTLY as the first part of the resume.
` + basePrompt;
    }
    
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: finalPrompt });
    return response.text;
};

// For generating a tailored cover letter
export const generateCoverLetterForJob = async (job: Job, resumeContent: ResumeContent, userTone: string, customHeader?: string): Promise<string> => {
    let candidateInfoBlock = '';
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    if (customHeader && customHeader.trim()) {
        candidateInfoBlock = customHeader.trim();
    } else if (resumeContent.contactInfo) {
        const { name, address, phone, email } = resumeContent.contactInfo;
        const candidateName = name || '[Your Name]';
        const candidateAddress = address || '[Your Address]';
        const contactLine = [phone, email].filter(Boolean).join(' | ');

        // Ensure each part is on its own line and use placeholders if empty
        candidateInfoBlock = [
            candidateName,
            candidateAddress,
            contactLine,
        ].filter(Boolean).join('\n'); // Filter out empty lines
    } else {
        candidateInfoBlock = `[Your Name]\n[Your Address]\n[Your Phone] | [Your Email]`;
    }

    // Combine into a single, well-structured header string for the LLM
    // This ensures two newlines after contact, and the date followed by two newlines
    // FIX: Added explicit empty lines to ensure consistent spacing even if parts are missing, and strong critical instruction.
    const formattedHeaderForLLM = `CRITICAL: The following complete header block must be used EXACTLY as provided, including all line breaks. Do NOT add or change anything in it.
${candidateInfoBlock}

${today}

`; 

    let basePrompt = `
    Job Description:
    ---
    Title: ${job.title} at ${job.company}
    Description: ${job.description}
    ---

    Candidate's Resume:
    ---
    ${resumeContent.rawText}
    ---
    
    User-specified tone: ${userTone}

    Write a professional and compelling cover letter for the specified job, drawing from the candidate's resume.
    The tone should be ${userTone}. The letter should be concise (around 3-4 paragraphs) and tailored to the job description.
    Address why the candidate is a good fit for this specific role and company.
    Begin the letter with "Dear Hiring Manager," or the appropriate recipient if implied by the job description, followed by the body.
    `;
    
    // Explicitly instruct the LLM to use the header exactly and return only the letter.
    const finalPrompt = `CRITICAL: You MUST use the following complete header EXACTLY as provided, including all line breaks, at the very beginning of the cover letter. Do NOT add anything before it or modify its content.
---START OF COVER LETTER HEADER---
${formattedHeaderForLLM}---END OF COVER LETTER HEADER---

${basePrompt.trim()}
Return ONLY the full cover letter text, starting with the header above, followed by the salutation and body. Do NOT include any additional comments, instructions, or introductory\/concluding remarks outside the letter itself.
`;

    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: finalPrompt });
    return cleanLLMOutputInstructions(response.text); // Apply cleanup
};

export const analyzeATSCompliance = async (job: Job, generatedResume: string): Promise<Application['atsScore']> => {
  // FIX: Initialize GoogleGenAI inside the function to pick up latest API_KEY
  const aiPro = new GoogleGenAI({ apiKey: process.env.API_KEY! }); 
  const prompt = `Act as an advanced Applicant Tracking System (ATS). Analyze the provided tailored resume against the job description.
  Provide a score from 0 to 100 representing the match quality.
  Also provide concise feedback on why the score was given, focusing on keyword alignment and relevance of experience.
  Additionally, identify any specific keywords or phrases from the job description that are missing in the resume.
  Suggest concrete ways to integrate these missing keywords into the resume.
  Finally, assess the appropriate use of industry-specific jargon in the resume and provide feedback if it's lacking or overused.

  Job Description:
  ---
  ${job.description}
  ---

  Tailored Resume:
  ---
  ${generatedResume}
  ---
  `;
  let responseText = '';
  try {
    const response = await aiPro.models.generateContent({
      model: 'gemini-2.5-pro', // Using Pro for complex analysis
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER, description: "ATS match score from 0 to 100" },
            feedback: { type: Type.STRING, description: "Brief feedback on the score." },
            missingKeywords: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING }, 
              description: "Specific keywords or phrases from the job description missing in the resume." 
            },
            integrationSuggestions: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING }, 
              description: "Suggestions on how to integrate missing keywords into the resume." 
            },
            jargonCheck: { 
              type: Type.STRING, 
              description: "Assessment of appropriate industry-specific jargon usage in the resume." 
            },
          },
          required: ['score', 'feedback'] // Only score and feedback are strictly required initially
        },
        thinkingConfig: { thinkingBudget: 32768 }, // Max thinking budget for 2.5 Pro
      }
    });
    responseText = response.text;
  } catch (e: any) {
    console.error("Gemini API call (ATS analysis) failed. Raw response:", prompt, "Error:", e);
    throw new Error(e.message || "Failed to perform ATS analysis.");
  }

  try {
    return JSON.parse(cleanJsonResponse(responseText));
  } catch (e: any) {
    console.error("Failed to parse JSON response for ATS analysis. Raw JSON output:", responseText, "Error:", e);
    throw new Error("Failed to interpret ATS analysis results. AI returned invalid data.");
  }
}


// For skill gap analysis
export const analyzeSkillGap = async (job: Job, resumeContent: ResumeContent): Promise<SkillGapAnalysis> => {
  // FIX: Initialize GoogleGenAI inside the function to pick up latest API_KEY
  const aiPro = new GoogleGenAI({ apiKey: process.env.API_KEY! }); 
  const prompt = `
    Job Description Keywords & Requirements:
    ---
    ${job.description}
    ---

    Candidate's Skills from Resume:
    ---
    ${resumeContent.skills.join(', ')}
    ---

    Analyze the candidate's skills against the job description. Identify:
    1.  'matchingSkills': Skills the candidate has that are relevant to the job.
    2.  'missingSkills': Important skills required by the job that are not listed in the candidate's skills.
    3.  'suggestions': Actionable suggestions for how the candidate can bridge the gap for the missing skills (e.g., 'Highlight project X which used technology Y', 'Consider a short online course in Z').
  `;
  let responseText = '';
  try {
    const response = await aiPro.models.generateContent({
      model: 'gemini-2.5-pro', // Using Pro for complex analysis
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchingSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
            missingSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['matchingSkills', 'missingSkills', 'suggestions']
        },
        thinkingConfig: { thinkingBudget: 32768 }, // Max thinking budget for 2.5 Pro
      }
    });
    responseText = response.text;
  } catch (e: any) {
    console.error("Gemini API call (skill gap analysis) failed. Raw response:", prompt, "Error:", e);
    throw new Error(e.message || "Failed to perform skill gap analysis.");
  }

  try {
    return JSON.parse(cleanJsonResponse(responseText));
  } catch (e: any) {
    console.error("Failed to parse JSON response for skill gap analysis. Raw JSON output:", responseText, "Error:", e);
    throw new Error("Failed to interpret skill gap analysis results. AI returned invalid data.");
  }
};