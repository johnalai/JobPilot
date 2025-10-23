import { GoogleGenAI, Type, GenerateContentResponse, Chat, Modality, FunctionDeclaration, Tool } from "@google/genai";
import { Job, Resume, ResumeContent, SkillGapAnalysis, GroundingChunk, Application, WebGroundingChunk } from '../types';

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

// Helper to encode Uint8Array to base64
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

// For parsing resume text into structured data
export const parseResumeText = async (rawText: string): Promise<ResumeContent> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Parse the following resume text and extract skills, work experience, and education.
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
          }
        }
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
  prompt += "\nReturn a list of 5 job postings. For each job, provide a title, company, location, a **full, comprehensive, and essential description, capturing ALL available and essential details without any summarization or truncation**, and if possible, work model and date posted. DO NOT provide a source URL in this response.";

  const tools: Tool[] = [{ googleSearch: {} }];

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      tools: tools,
    },
  });

  // Extract grounding chunks once from the main response
  const globalGroundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] || [];

  // Filter out undesirable domains from the global grounding chunks
  const filteredGlobalGrounding = globalGroundingChunks.filter(chunk => {
      if ('web' in chunk && chunk.web?.uri) {
          return !DOMAINS_TO_AVOID_AS_PRIMARY_SOURCE.some(domain => getDomain(chunk.web.uri).includes(domain));
      }
      return false; // Only keep valid web chunks
  });

  // Since the response is grounded text and not guaranteed JSON, we'll parse it with another LLM call.
  // This is a common pattern for extracting structured data from unstructured grounded responses.
  const extractionResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Extract the job postings from the following text into a clean JSON array. Each object should have 'title', 'company', 'location', 'description', 'workModel', 'datePosted'. If a field is not present, omit it. The 'description' should be as **comprehensive and detailed as possible, capturing ALL essential information.**
    
    Text:
    ---
    ${response.text}
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
      }
    }
  });

  const extractedJobs = JSON.parse(extractionResponse.text);

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

// For the chatbot
export const getChatStream = async (message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[]) => {
    const aiChat = new GoogleGenAI({ apiKey: process.env.API_KEY! }); // New instance for chat
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const extractionResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `From the following text, extract the job details into a JSON object. The 'description' should be as **comprehensive and detailed as possible, capturing ALL essential information.**
        Text:
        ---
        ${response.text}
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
            }
        }
    });
    
    const globalGroundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] || [];

    // Filter out undesirable domains from the global grounding chunks
    const filteredGrounding = globalGroundingChunks.filter(chunk => {
        if ('web' in chunk && chunk.web?.uri) {
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

    const extractedData = JSON.parse(extractionResponse.text);
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
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `From the following job description text, extract the key details into a JSON object. The 'description' should be as **comprehensive and detailed as possible, capturing ALL essential information.**
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
            }
        }
    });
    // No grounding chunks or sourceUrl extraction from text input directly
    return JSON.parse(response.text);
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
      finalPrompt = `CRITICAL: Use the following header EXACTLY as provided at the very top of the resume. Do not add or change anything in the header. Then, rewrite the resume based on the job description.\n---CUSTOM HEADER---\n${customHeader}\n---END CUSTOM HEADER---\n\n` + basePrompt;
    } else {
      finalPrompt = `First, generate a professional header for a resume containing a name and contact information (e.g. Name, City, Phone, Email). Then, using that exact header, rewrite the resume based on the job description provided below.\n\n` + basePrompt;
    }
    
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: finalPrompt });
    return response.text;
};

// For generating a tailored cover letter
export const generateCoverLetterForJob = async (job: Job, resumeContent: ResumeContent, userTone: string, customHeader?: string): Promise<string> => {
    let basePrompt = `
    Job Description:
    ---
    Title: ${job.title} at ${job.company}
    Description: ${job.description}
    ---

    Candidate's Resume Summary:
    ---
    Skills: ${resumeContent.skills.join(', ')}
    Experience: ${resumeContent.experience.map(e => `${e.title} at ${e.company}`).join('; ')}
    ---
    
    User-specified tone: ${userTone}

    Write a professional and compelling cover letter for the specified job, drawing from the candidate's resume summary.
    The tone should be ${userTone}. The letter should be concise (around 3-4 paragraphs) and tailored to the job description.
    Address why the candidate is a good fit for this specific role and company.
    `;
    
    let finalPrompt = '';
    if (customHeader && customHeader.trim()) {
        finalPrompt = `CRITICAL: Use the following header EXACTLY as provided at the very top of the cover letter. This header should be consistent with the one on the resume. Do not add or change anything in the header.\n---CUSTOM HEADER---\n${customHeader}\n---END CUSTOM HEADER---\n\n` + basePrompt;
    } else {
        finalPrompt = `Generate a professional header for the cover letter that would be consistent with a resume header (e.g. Name, City, Phone, Email). Then, using that exact header, write the cover letter.\n\n` + basePrompt;
    }

    finalPrompt += `\nReturn only the full cover letter text.`

    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: finalPrompt });
    return response.text;
};

export const analyzeATSCompliance = async (job: Job, generatedResume: string): Promise<Application['atsScore']> => {
  const aiPro = new GoogleGenAI({ apiKey: process.env.API_KEY! }); // New instance for Pro model
  const prompt = `Act as an advanced Applicant Tracking System (ATS). Analyze the provided tailored resume against the job description.
  Provide a score from 0 to 100 representing the match quality.
  Also provide concise feedback on why the score was given, focusing on keyword alignment and relevance of experience.

  Job Description:
  ---
  ${job.description}
  ---

  Tailored Resume:
  ---
  ${generatedResume}
  ---
  `;
  const response = await aiPro.models.generateContent({
    model: 'gemini-2.5-pro', // Using Pro for complex analysis
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER, description: "ATS match score from 0 to 100" },
          feedback: { type: Type.STRING, description: "Brief feedback on the score." }
        },
        required: ['score', 'feedback']
      },
      thinkingConfig: { thinkingBudget: 32768 }, // Max thinking budget for 2.5 Pro
    }
  });
  return JSON.parse(response.text);
}


// For skill gap analysis
export const analyzeSkillGap = async (job: Job, resumeContent: ResumeContent): Promise<SkillGapAnalysis> => {
  const aiPro = new GoogleGenAI({ apiKey: process.env.API_KEY! }); // New instance for Pro model
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
  return JSON.parse(response.text);
};


// REMOVED: Video Studio Functions (generateVideo and analyzeVideo)
// export const generateVideo = async (
//   prompt: string,
//   imageBytes?: string,
//   imageMimeType?: string,
//   aspectRatio: '16:9' | '9:16' = '16:9'
// ): Promise<{ uri: string, mimeType: string }> => {
//   // API Key selection check for Veo models
//   if (!window.aistudio.hasSelectedApiKey()) {
//     throw new Error('VEO models require an API key to be selected. Please select one.');
//   }
  
//   const aiVideo = new GoogleGenAI({ apiKey: process.env.API_KEY! }); // New instance for video model

//   let operation = await aiVideo.models.generateVideos({
//     model: 'veo-3.1-fast-generate-preview',
//     prompt: prompt,
//     image: imageBytes && imageMimeType ? {
//       imageBytes: imageBytes,
//       mimeType: imageMimeType,
//     } : undefined,
//     config: {
//       numberOfVideos: 1,
//       resolution: '720p',
//       aspectRatio: aspectRatio,
//     },
//   });

//   while (!operation.done) {
//     await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
//     operation = await aiVideo.operations.getVideosOperation({ operation: operation });
//   }

//   if (operation.response?.generatedVideos?.[0]?.video?.uri) {
//     return {
//       uri: operation.response.generatedVideos[0].video.uri,
//       mimeType: 'video/mp4' // Veo typically returns mp4
//     };
//   } else {
//     throw new Error('Video generation failed or returned no URI.');
//   }
// };

// export const analyzeVideo = async (videoUri: string, videoDescription: string): Promise<string> => {
//   const aiPro = new GoogleGenAI({ apiKey: process.env.API_KEY! }); // New instance for Pro model
//   const prompt = `Analyze the video at the following URL. Focus on ${videoDescription || 'summarizing its key information, themes, and significant events'}.
//   Video URL: ${videoUri}
//   `;

//   const response = await aiPro.models.generateContent({
//     model: 'gemini-2.5-pro', // Using Pro for video understanding
//     contents: prompt,
//     config: {
//       tools: [{ googleSearch: {} }], // Use Google Search to access video content if possible
//       thinkingConfig: { thinkingBudget: 32768 }, // Max thinking budget for 2.5 Pro
//     },
//   });
//   return response.text;
// };