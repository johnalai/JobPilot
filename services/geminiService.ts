
import { GoogleGenAI, GenerateContentResponse, Type, Modality, LiveServerMessage } from "@google/genai";
import { CompanyInsights, Job, NormalizedResume } from '../types';
import { decode, decodeAudioData, encode, createBlob } from '../utils/audioUtils';
import type { MutableRefObject } from 'react';

// Helper to robustly extract JSON from model responses, handling preambles or markdown blocks.
function getCleanedJsonFromModelResponse(responseText: string): Record<string, any> | null {
  if (!responseText) {
    console.warn("getCleanedJsonFromModelResponse: Received empty response text.");
    return null;
  }

  // 1. Attempt to extract JSON from a markdown code block (```json\n...\n```)
  const jsonBlockMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    try {
      const jsonContent = jsonBlockMatch[1].trim();
      if (jsonContent) {
        return JSON.parse(jsonContent);
      }
    } catch (e) {
      console.error("Failed to parse JSON from markdown code block:", e);
    }
  }

  // 2. If no markdown block or parsing failed, attempt to find the first '{' and last '}'
  //    to extract a potential raw JSON string, ignoring leading/trailing non-JSON text.
  const firstCurly = responseText.indexOf('{');
  const lastCurly = responseText.lastIndexOf('}');

  if (firstCurly !== -1 && lastCurly !== -1 && lastCurly > firstCurly) {
    const potentialJsonString = responseText.substring(firstCurly, lastCurly + 1);
    try {
      const jsonContent = potentialJsonString.trim();
      if (jsonContent) {
        return JSON.parse(jsonContent);
      }
    } catch (e) {
      console.error("Failed to parse extracted JSON substring:", e);
    }
  }

  // 3. If all attempts fail, log a warning and return null.
  console.warn("Could not find or parse any valid JSON in the model response:", responseText);
  return null;
}

// Domains to avoid as primary job sources due to being aggregators or too generic
export const DOMAINS_TO_AVOID_AS_PRIMARY_SOURCE = [
  'google.com', 'bing.com', 'indeed.com', 'linkedin.com', 'ziprecruiter.com',
  'glassdoor.com', 'monster.com', 'careerbuilder.com', 'simplyhired.com',
  'job.com', 'dice.com', 'flexjobs.com', 'remotive.io', 'remoteok.com',
  'weworkremotely.com', 'remote.co', 'angel.co', 'ycombinator.com',
  'stackoverflow.com', 'builtinnyc.com', 'builtinchicago.com', // Example Built In sites
  'builtinaustin.com', 'builtinsf.com', 'builtinsocal.com', 'builtindc.com',
  'builtinchicago.com', 'builtinboston.com', 'builtincolorado.com',
  'lever.co', 'ashby.app', 'apply.workday.com', 'boards.greenhouse.io',
  'app.ripple.com', 'myworkdayjobs.com', 'talentlyft.com', 'comeet.com',
  'jobs.eu.lever.co', 'successfactors.eu', 'smartrecruiters.com',
  'jobvite.com', 'icims.com', 'ultipro.com', 'taleo.net', 'adp.com',
  'bamboohr.com', 'freshteam.com', 'hrsmart.com', 'pageuppeople.com',
  'workable.com', 'applicantstack.com', 'recruitee.com', 'jazzhr.com',
  'ceipal.com', 'hrmdirect.com', 'ziprecruiter.com', 'snagajob.com',
  'nexxt.com', 'careerjet.com', 'adview.com', 'jora.com', 'learn4good.com',
  'jobrapido.com', 'jobisjob.com', 'jobted.com', 'jobvertise.com',
  'monster.ca', 'indeed.ca', 'linkedin.ca', 'ca.linkedin.com', 'eluta.ca',
  'neuvoo.ca', 'ca.jora.com', 'jobbank.gc.ca', 'workopolis.com',
  'remotejobshive.com', 'remoterocketship.com', 'fullremotework.com',
  'weekday.works', 'builtintoronto.com' // Keeping this as a general aggregator
];

export function isAvoidedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return DOMAINS_TO_AVOID_AS_PRIMARY_SOURCE.some(avoidedDomain => {
      const avoidedHostname = avoidedDomain.toLowerCase();
      // Exact match or subdomain match (e.g., jobs.greenhouse.io matches greenhouse.io)
      return hostname === avoidedHostname || hostname.endsWith('.' + avoidedHostname);
    });
  } catch (e) {
    console.warn("Invalid URL for domain check:", url, e);
    return false; // If URL is invalid, it can't be an avoided domain.
  }
}

export async function analyzeJobUrl(jobUrl: string): Promise<Record<string, any> | null> {
  // Create a new GoogleGenAI instance for this API call
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Analyze the job posting at this URL: ${jobUrl}. Extract the job title, company, location, a detailed description, key requirements, and any "nice-to-have" qualifications. Return the output as a JSON object with keys: title, company, location, description, requirements (array of strings), niceToHave (array of strings). If a field is not found, use "N/A" for strings or empty arrays for lists. ALWAYS return valid JSON.`,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });
  return getCleanedJsonFromModelResponse(response.text);
}

export async function analyzeJobText(jobText: string): Promise<Record<string, any> | null> {
  // Create a new GoogleGenAI instance for this API call
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Analyze the following job posting text. Extract the job title, company, location, a detailed description, key requirements, and any "nice-to-have" qualifications. Return the output as a JSON object with keys: title, company, location, description, requirements (array of strings), niceToHave (array of strings). If a field is not found, use "N/A" for strings or empty arrays for lists. ALWAYS return valid JSON. \n\nJob Text:\n${jobText}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          company: { type: Type.STRING },
          location: { type: Type.STRING },
          description: { type: Type.STRING },
          requirements: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          niceToHave: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['title', 'company', 'location', 'description', 'requirements'],
      },
    },
  });
  return getCleanedJsonFromModelResponse(response.text);
}


export async function parseResumeText(resumeText: string): Promise<NormalizedResume | null> {
  // Create a new GoogleGenAI instance for this API call
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', // Flash is generally good for structured extraction
    contents: `Parse the following resume text and extract information into a structured JSON object.
    Ensure all fields, especially contactInfo, experience, education, and skills are correctly extracted.
    If a field is not found, use an empty string for text fields, an empty array for list fields, or null for numeric/boolean fields.
    For contactInfo, include name, email, phone, linkedin, github, portfolio, and address if available.
    For experience, include title, company, location, startDate, endDate, and description (as an array of bullet points).
    For education, include degree, major, institution, location, and graduationDate.
    For skills, categorize them (e.g., "Programming Languages", "Tools", "Soft Skills") with an array of items for each category.
    ALWAYS return valid JSON.

    Resume Text:\n${resumeText}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          contactInfo: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              email: { type: Type.STRING },
              phone: { type: Type.STRING },
              linkedin: { type: Type.STRING },
              github: { type: Type.STRING },
              portfolio: { type: Type.STRING },
              address: { type: Type.STRING },
            },
            required: ['name', 'email'],
          },
          summary: { type: Type.STRING },
          experience: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                company: { type: Type.STRING },
                location: { type: Type.STRING },
                startDate: { type: Type.STRING },
                endDate: { type: Type.STRING },
                description: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['title', 'company', 'startDate', 'endDate', 'description'],
            },
          },
          education: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                degree: { type: Type.STRING },
                major: { type: Type.STRING },
                institution: { type: Type.STRING },
                location: { type: Type.STRING },
                graduationDate: { type: Type.STRING },
              },
              required: ['degree', 'institution', 'graduationDate'],
            },
          },
          skills: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                items: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['category', 'items'],
            },
          },
          awards: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          certifications: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          projects: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                link: { type: Type.STRING },
              },
              required: ['name', 'description'],
            },
          },
        },
        required: ['contactInfo', 'summary', 'experience', 'education', 'skills'],
      },
    },
  });
  const parsed = getCleanedJsonFromModelResponse(response.text);
  return parsed as NormalizedResume | null;
}

export async function analyzeATSCompliance(
  resumeContent: string,
  jobDescription: string,
): Promise<{ score: number; feedback: string } | null> {
  // Create a new GoogleGenAI instance for this API call
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Compare the provided resume content with the job description.
    Generate an ATS (Applicant Tracking System) match score from 0-100, where 100 is a perfect match.
    Also, provide detailed feedback on how to improve the resume for this specific job, focusing on keywords, skills, and experience alignment.
    Return the output as a JSON object with keys: score (number), feedback (string).
    ALWAYS return valid JSON. If unable to generate, return { "score": 0, "feedback": "Unable to generate ATS feedback." }.

    Resume:\n${resumeContent}\n\nJob Description:\n${jobDescription}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          feedback: { type: Type.STRING },
        },
        required: ['score', 'feedback'],
      },
    },
  });

  const parsed = getCleanedJsonFromModelResponse(response.text);
  if (parsed) {
    return {
      score: parsed.score as number || 0, // Ensure score is always a number
      feedback: parsed.feedback as string || "No feedback provided."
    };
  }
  return null;
}

export async function autoFixResume(
  currentResumeContent: string,
  jobDescription: string,
  atsFeedback: string
): Promise<string | null> {
  // Create a new GoogleGenAI instance for this API call
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro', // Pro for quality rewriting
    contents: `You are an expert resume writer. Your task is to rewrite the provided resume to directly address the ATS (Applicant Tracking System) feedback provided below, while maintaining truthfulness and the candidate's voice.

    1. Integrate keywords from the job description mentioned in the feedback.
    2. Rephrase bullet points to be more impactful and relevant to the job.
    3. Ensure the resume is concise and professional.
    4. Return the FULL rewritten resume content in Markdown format.

    Current Resume:\n${currentResumeContent}\n\n
    Job Description:\n${jobDescription}\n\n
    ATS Feedback to Address:\n${atsFeedback}`,
    config: {
      temperature: 0.7,
      topP: 0.95,
      topK: 64,
    },
  });
  return response.text;
}

export async function generateTailoredResume(
  baseResumeContent: string,
  jobDescription: string,
  jobTitle: string,
  companyName: string,
  customHeader: string // Pass custom header directly
): Promise<string | null> {
  // Create a new GoogleGenAI instance for this API call
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro', // Pro for better writing quality
    contents: `Given the following base resume content and a job description for a ${jobTitle} position at ${companyName},
    tailor the resume to maximize its relevance and ATS compatibility for this specific role.
    Integrate relevant keywords and rephrase bullet points to align with the job requirements.
    The resume should be concise, professional, and highlight experience most relevant to the job.
    IMPORTANT: The custom header provided below MUST be at the very top of the resume, followed by the tailored content.
    Return the tailored resume content in Markdown format.

    Custom Header:\n${customHeader}\n\n
    Base Resume Content:\n${baseResumeContent}\n\n
    Job Description:\n${jobDescription}`,
    config: {
      temperature: 0.7,
      topP: 0.95,
      topK: 64,
    },
  });
  return response.text; // Expecting markdown
}

export async function generateCoverLetterForJob(
  baseResumeContent: string,
  jobDescription: string,
  jobTitle: string,
  companyName: string,
  applicantName: string,
  applicantEmail: string,
  customHeader: string // Pass custom header directly
): Promise<string | null> {
  // Create a new GoogleGenAI instance for this API call
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro', // Pro for better writing quality
    contents: `Draft a professional and compelling cover letter for the ${jobTitle} position at ${companyName}.
    The letter should be from ${applicantName} (${applicantEmail}).
    Highlight relevant experience and skills from the provided resume content that align with the job description.
    Show enthusiasm for the role and company.
    The custom header provided below MUST be at the very top of the cover letter, followed by the tailored content.
    Return the cover letter content in Markdown format.

    Custom Header:\n${customHeader}\n\n
    Resume Content:\n${baseResumeContent}\n\n
    Job Description:\n${jobDescription}`,
    config: {
      temperature: 0.7,
      topP: 0.95,
      topK: 64,
    },
  });
  return response.text; // Expecting markdown
}

export async function getCompanyInsights(
  companyName: string,
): Promise<CompanyInsights | null> {
  // Create a new GoogleGenAI instance for this API call
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Provide detailed insights about ${companyName}. Include an overview, company culture, products/services, pros, cons, Glassdoor rating (numeric), and relevant links (Crunchbase, LinkedIn, official website).
    Return the output as a JSON object with keys: companyName, overview, culture, productsAndServices, pros (array of strings), cons (array of strings), glassdoorRating (number or null), crunchbaseProfile (string or null), linkedinProfile (string or null), website (string or null).
    If a specific piece of information cannot be found, use null or an empty array for that field, but ALWAYS return a complete JSON object structure. Do NOT include any conversational text outside the JSON.

    Example JSON structure:
    {
      "companyName": "Example Corp",
      "overview": "...",
      "culture": "...",
      "productsAndServices": "...",
      "pros": ["Pro 1", "Pro 2"],
      "cons": ["Con 1", "Con 2"],
      "glassdoorRating": 4.2,
      "crunchbaseProfile": "https://www.crunchbase.com/organization/example",
      "linkedinProfile": "https://www.linkedin.com/company/example-corp",
      "website": "https://www.example.com"
    }
    `,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });
  const parsed = getCleanedJsonFromModelResponse(response.text);
  return parsed as CompanyInsights | null;
}

export async function getChatResponse(prompt: string): Promise<string> {
  // Create a new GoogleGenAI instance for this API call
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { thinkingConfig: { thinkingBudget: 0 } }
  });
  return response.text;
}

export async function findJobsFromResume(resumeContent: string): Promise<Partial<Job>[] | null> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro', // Using Pro for better reasoning and search integration
    contents: `Based on the following resume, act as an expert recruiter. First, identify the candidate's key skills, experience, and most suitable job titles. Then, use your search capabilities to find up to 5 current, real job openings that are a strong match. For each job, provide the job title, company name, location, a concise description, key requirements, nice-to-have qualifications, and a direct URL to the job posting.

    Return the output as a JSON object containing a single key "jobs", which is an array of job objects. Each job object must have the following keys: "title", "company", "location", "description", "requirements" (as an array of strings), "niceToHave" (as an array of strings), and "sourceUrl".
    If you cannot find a direct URL, provide the best available link. Do not invent jobs. Ensure the response is valid JSON.

    Resume Content:
    ---
    ${resumeContent}
    ---
    `,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          jobs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                company: { type: Type.STRING },
                location: { type: Type.STRING },
                description: { type: Type.STRING },
                requirements: { type: Type.ARRAY, items: { type: Type.STRING } },
                niceToHave: { type: Type.ARRAY, items: { type: Type.STRING } },
                sourceUrl: { type: Type.STRING },
              },
              required: ['title', 'company', 'location', 'description', 'sourceUrl'],
            }
          }
        },
        required: ['jobs'],
      },
    },
  });

  const parsedJson = getCleanedJsonFromModelResponse(response.text);
  if (parsedJson && Array.isArray(parsedJson.jobs)) {
    return parsedJson.jobs;
  }
  return null;
}

// Live API functions
// Removed all global Web Audio API related objects from here.
// They will be managed by the calling component (InterviewCoach).

export interface LiveSessionInstance {
  sendRealtimeInput: (input: { media: { data: string; mimeType: string } }) => void;
  sendToolResponse: (response: any) => void; // Simplified type for tool response
  close: () => void;
}

// sessionPromise and mediaRecorder are now managed by InterviewCoach.
// audioStream is also managed by InterviewCoach.

export const startLiveSession = ( // Not async, returns Promise directly
  onTranscript: (user: string, model: string) => void,
  onFunctionCall: (name: string, args: Record<string, any>, id: string) => Promise<any>,
  systemInstruction: string,
  micEnabled: boolean,
  voiceName: string,
  // --- Parameters passed from InterviewCoach ---
  inputAudioContext: AudioContext,
  outputAudioContext: AudioContext,
  inputNode: GainNode,
  outputNode: GainNode,
  sources: Set<AudioBufferSourceNode>,
  mediaStream: MediaStream | null, // The actual media stream from getUserMedia - ALLOW NULL
  setNextStartTime: (val: number) => void,
  getNextStartTime: () => number, // Function to get current nextStartTime
  sendToolResponseCallback: (response: any) => Promise<void>, // Callback to send tool response
  scriptProcessorRef: MutableRefObject<ScriptProcessorNode | null> // Pass scriptProcessor ref
): Promise<LiveSessionInstance> => {
  // IMPORTANT: Create a new GoogleGenAI instance here to ensure it uses the latest API key
  const liveAi = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // This is the promise to the session instance
  const sessionPromise: Promise<LiveSessionInstance> = liveAi.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks: {
      onopen: () => {
        console.debug('Live session opened');
        if (micEnabled && mediaStream && scriptProcessorRef.current) {
          // Stream audio from the microphone to the model.
          const source = inputAudioContext.createMediaStreamSource(mediaStream);
          // Configure the scriptProcessor that was created and passed from InterviewCoach
          scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
            const pcmBlob = createBlob(inputData); // Use the createBlob utility
            // CRITICAL: Solely rely on sessionPromise resolves and then call `session.sendRealtimeInput`
            sessionPromise.then((session) => {
              session.sendRealtimeInput({ media: pcmBlob });
            });
          };
          source.connect(scriptProcessorRef.current);
          // CRITICAL FIX: To prevent audio feedback, connect the scriptProcessor to the silent inputNode,
          // which is then connected to the destination. This makes the `onaudioprocess` event fire without
          // routing the microphone audio to the speakers.
          scriptProcessorRef.current.connect(inputNode);
        }
      },
      onmessage: async (message: LiveServerMessage) => {
        // console.debug('Live session message:', message);

        // Handle Audio Output
        const base64EncodedAudioString =
          message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (base64EncodedAudioString) {
          setNextStartTime(Math.max(getNextStartTime(), outputAudioContext.currentTime));
          try {
            const audioBuffer = await decodeAudioData(
              decode(base64EncodedAudioString),
              outputAudioContext,
              24000, // Expected sample rate
              1,     // Expected number of channels
            );
            const source = outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputNode);
            // outputNode is already connected to destination in InterviewCoach's useEffect

            source.addEventListener('ended', () => {
              sources.delete(source);
            });

            source.start(getNextStartTime()); // Use the latest nextStartTime
            setNextStartTime(getNextStartTime() + audioBuffer.duration);
            sources.add(source);
          } catch (e) {
            console.error("Error decoding or playing audio:", e);
          }
        }

        // Handle Function Calls
        if (message.toolCall) {
          for (const fc of message.toolCall.functionCalls) {
            console.debug('function call: ', fc);
            const result = await onFunctionCall(fc.name, fc.args, fc.id);
            const toolResponse = {
              functionResponses: {
                id : fc.id,
                name: fc.name,
                response: { result: result },
              }
            };
            await sendToolResponseCallback(toolResponse);
          }
        }

        // Handle Transcription
        if (message.serverContent?.outputTranscription) {
          // Transcription is handled by InterviewCoach's state
          // We pass the raw transcriptions and let the component manage concatenation
          onTranscript('', message.serverContent.outputTranscription.text);
        }
        if (message.serverContent?.inputTranscription) {
          onTranscript(message.serverContent.inputTranscription.text, '');
        }
        if (message.serverContent?.turnComplete) {
          onTranscript('TURN_COMPLETE', 'TURN_COMPLETE'); // Special signal for turn complete
        }

        // Handle Interruption
        const interrupted = message.serverContent?.interrupted;
        if (interrupted) {
          for (const source of sources.values()) {
            source.stop();
            sources.delete(source);
          }
          setNextStartTime(0);
        }
      },
      onerror: (e: ErrorEvent) => {
        console.error('Live session error:', e);
        // Error handling should be managed by the component that initiated the session.
        // It can catch errors from the `sessionPromise`.
      },
      onclose: (e: CloseEvent) => {
        console.debug('Live session closed');
      },
    },
    config: {
      responseModalities: [Modality.AUDIO],
      outputAudioTranscription: {}, // Enable transcription for model output audio.
      inputAudioTranscription: {}, // Enable transcription for user input audio.
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
      },
      systemInstruction: systemInstruction,
      // tools are not configured here, they would be passed in if needed
    },
  });

  return sessionPromise;
};

/**
 * Stops an active live session by resolving the session promise and calling close().
 * @param sessionPromise The promise for the live session instance.
 */
export const stopLiveSession = (sessionPromise: Promise<LiveSessionInstance> | null) => {
  if (sessionPromise) {
    sessionPromise.then(session => {
      try {
        session.close();
        console.debug('Live session closed successfully.');
      } catch (e) {
        console.error('Error closing live session:', e);
      }
    }).catch(e => {
      console.error('Could not get session to close it:', e);
    });
  }
};
