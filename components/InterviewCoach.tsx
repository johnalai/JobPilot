import React, { useState, useEffect, useRef, useCallback } from 'react';
// FIX: Use relative paths for local module imports.
import { useAppContext } from '../context/AppContext';
import { LoadingSpinner } from './icons';
import { GoogleGenAI, LiveServerMessage, Modality, Blob, Type, FunctionDeclaration } from '@google/genai';
import { InterviewFeedback, Application } from '../types';

// Helper to decode base64 audio data
const decode = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

// Helper to encode audio data
const encode = (bytes: Uint8Array) => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

// Helper to convert raw PCM audio bytes to an AudioBuffer
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

interface TranscriptEntry {
    speaker: 'user' | 'model';
    text: string;
}

const FeedbackDisplay: React.FC<{ feedback: InterviewFeedback | null }> = ({ feedback }) => {
    if (!feedback) return null;

    const getScoreColor = (score: number) => {
        if (score >= 85) return 'text-green-500';
        if (score >= 70) return 'text-yellow-500';
        return 'text-red-500';
    };

    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (feedback.score / 100) * circumference;

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg mt-4 animate-fade-in">
            <h3 className="text-xl font-semibold mb-4 text-center">Live Feedback</h3>
            <div className="flex flex-col items-center">
                <div className="relative w-32 h-32">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                        <circle className="text-gray-200 dark:text-gray-700" strokeWidth="10" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" />
                        <circle className={`${getScoreColor(feedback.score)} transition-all duration-1000 ease-out`} strokeWidth="10" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" transform="rotate(-90 50 50)" />
                    </svg>
                    <div className={`absolute inset-0 flex items-center justify-center text-3xl font-bold ${getScoreColor(feedback.score)}`}>{feedback.score}</div>
                </div>
                <div className="mt-4 w-full space-y-3 text-sm">
                    <div>
                        <h4 className="font-bold text-green-600 dark:text-green-400">Strengths:</h4>
                        <ul className="list-disc list-inside text-gray-700 dark:text-gray-300">
                            {feedback.strengths.map((s, i) => <li key={`s-${i}`}>{s}</li>)}
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold text-yellow-600 dark:text-yellow-400">Areas for Improvement:</h4>
                        <ul className="list-disc list-inside text-gray-700 dark:text-gray-300">
                            {feedback.areasForImprovement.map((a, i) => <li key={`a-${i}`}>{a}</li>)}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

const InterviewCoach: React.FC = () => {
    const { selectedApplicationForInterview: app, setSelectedApplicationForInterview, applications } = useAppContext();
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
    const [latestFeedback, setLatestFeedback] = useState<InterviewFeedback | null>(null);

    const [manualJobTitle, setManualJobTitle] = useState('');

    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const microphoneStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

    const transcriptEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcripts]);

    const stopSession = useCallback(async () => {
        if (sessionPromiseRef.current) {
            const session = await sessionPromiseRef.current;
            session.close();
            sessionPromiseRef.current = null;
        }
        if (microphoneStreamRef.current) {
            microphoneStreamRef.current.getTracks().forEach(track => track.stop());
            microphoneStreamRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
           await inputAudioContextRef.current.close();
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            await outputAudioContextRef.current.close();
        }

        setIsSessionActive(false);
        setIsLoading(false);
        // Reset the selected application so the selection screen shows next time
        setSelectedApplicationForInterview(null);
    }, [setSelectedApplicationForInterview]);

    const startInterview = useCallback(async () => {
        if (!app) return;

        setIsLoading(true);
        setError(null);
        setTranscripts([]);
        setLatestFeedback(null);
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            microphoneStreamRef.current = stream;

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            let nextStartTime = 0;

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            
            const provideFeedbackFunctionDeclaration: FunctionDeclaration = {
                name: 'provideFeedback',
                description: 'Provide feedback on the candidate\'s last answer.',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        score: { type: Type.INTEGER, description: 'A score from 0-100 for the answer.' },
                        strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: '2-3 bullet points on what the candidate did well.' },
                        areasForImprovement: { type: Type.ARRAY, items: { type: Type.STRING }, description: '1-2 actionable suggestions for improvement.' },
                    },
                    required: ['score', 'strengths', 'areasForImprovement'],
                },
            };
            
            const systemInstruction = app.id.startsWith('manual-')
              ? `You are an expert interviewer conducting a friendly but professional mock interview for the role of "${app.job.title}". Ask common but relevant questions for this role. After the candidate answers, analyze their response and call the 'provideFeedback' function with your analysis. Then, conversationally summarize your feedback and ask the next question. Continue for 3-4 questions, then wrap up the interview.`
              : `You are an expert interviewer conducting a friendly but professional mock interview for the role of "${app.job.title}". The candidate's resume shows they have experience in: ${app.generatedResume}. The job description is: ${app.job.description}. Start by greeting the candidate and asking the first question. After the candidate answers, analyze their response and call the 'provideFeedback' function with your analysis. Then, conversationally summarize your feedback and ask the next question. Continue for 3-4 questions, then wrap up the interview.`;

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    systemInstruction,
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    tools: [{ functionDeclarations: [provideFeedbackFunctionDeclaration] }],
                },
                callbacks: {
                    onopen: () => {
                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const l = inputData.length;
                            const int16 = new Int16Array(l);
                            for (let i = 0; i < l; i++) {
                                int16[i] = inputData[i] * 32768;
                            }
                            const base64 = encode(new Uint8Array(int16.buffer));
                            const pcmBlob: Blob = { data: base64, mimeType: 'audio/pcm;rate=16000' };
                            
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
                        setIsLoading(false);
                        setIsSessionActive(true);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription || message.serverContent?.outputTranscription) {
                            const isUser = !!message.serverContent.inputTranscription;
                            const text = (message.serverContent.inputTranscription || message.serverContent.outputTranscription)?.text || '';
                            
                            if (isUser) setLatestFeedback(null); // Clear feedback when user starts talking

                            setTranscripts(prev => {
                                const last = prev[prev.length - 1];
                                if (last?.speaker === (isUser ? 'user' : 'model')) {
                                    const newLast = { ...last, text: last.text + text };
                                    return [...prev.slice(0, -1), newLast];
                                } else {
                                    return [...prev, { speaker: isUser ? 'user' : 'model', text }];
                                }
                            });
                        }

                        if (message.toolCall?.functionCalls) {
                            for (const fc of message.toolCall.functionCalls) {
                                if (fc.name === 'provideFeedback') {
                                    setLatestFeedback(fc.args as unknown as InterviewFeedback);
                                }
                            }
                        }

                        const audio = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                        if (audio) {
                            const audioBuffer = await decodeAudioData(decode(audio), outputAudioContextRef.current!, 24000, 1);
                            const source = outputAudioContextRef.current!.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContextRef.current!.destination);
                            const currentTime = outputAudioContextRef.current!.currentTime;
                            nextStartTime = Math.max(nextStartTime, currentTime);
                            source.start(nextStartTime);
                            nextStartTime += audioBuffer.duration;
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        setError(`Session error: ${e.message}`);
                        stopSession();
                    },
                    onclose: (e: CloseEvent) => {
                        stopSession();
                    },
                },
            });
        } catch (err: any) {
            setError(err.message || "Failed to start audio session.");
            setIsLoading(false);
        }
    }, [app, stopSession]);

    // This effect starts the interview *after* an application has been selected.
    useEffect(() => {
        if (app && !isSessionActive && !isLoading) {
            startInterview();
        }
    }, [app, isSessionActive, isLoading, startInterview]);


    // Cleanup on component unmount
    useEffect(() => {
        return () => {
            stopSession();
        };
    }, [stopSession]);
    
    // Renders the selection screen if no application is chosen yet.
    if (!app) {
        const handleStartManualInterview = () => {
            if (!manualJobTitle.trim()) return;
            const manualApp: Application = {
                id: 'manual-' + Date.now(),
                job: {
                    id: 'manual-' + Date.now(),
                    title: manualJobTitle,
                    company: 'a generic company',
                    location: 'any location',
                    description: `A generic job description for the role of ${manualJobTitle}.`
                },
                baseResumeId: '',
                status: 'Draft',
                applicationDate: new Date().toISOString(),
                generatedResume: 'No resume provided for this practice session.',
            };
            setSelectedApplicationForInterview(manualApp);
        };
    
        return (
          <div className="max-w-4xl mx-auto p-4 animate-fade-in">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Start Your Interview Practice</h2>
            <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">Choose a saved application for a tailored experience, or practice for any role.</p>
            
            <div className="mt-8">
              <h3 className="text-xl font-semibold mb-4">Practice for a Saved Application</h3>
              {applications.length > 0 ? (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                  {applications.map(savedApp => (
                    <div key={savedApp.id} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 flex justify-between items-center shadow">
                      <div>
                        <p className="font-bold">{savedApp.job.title}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{savedApp.job.company}</p>
                      </div>
                      <button onClick={() => setSelectedApplicationForInterview(savedApp)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg">
                        Practice
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No saved applications found. Apply for a job first to get a tailored interview.</p>
              )}
            </div>
    
            <div className="mt-8 pt-6 border-t dark:border-gray-700">
               <h3 className="text-xl font-semibold mb-4">Practice for Any Role</h3>
               <div className="flex flex-col sm:flex-row gap-4">
                 <input
                   type="text"
                   value={manualJobTitle}
                   onChange={(e) => setManualJobTitle(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleStartManualInterview()}
                   placeholder="Enter a job title (e.g., 'Software Engineer')"
                   className="flex-grow p-3 border rounded-lg bg-white dark:bg-gray-700"
                 />
                 <button onClick={handleStartManualInterview} disabled={!manualJobTitle.trim()} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50">
                   Start Practice
                 </button>
               </div>
            </div>
          </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Interview Coach</h2>
            <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
                Practicing for: <strong>{app.job.title}</strong> at <strong>{app.job.company}</strong>
            </p>
            
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center h-full">
                            <LoadingSpinner className="w-10 h-10"/>
                            <p className="mt-3">Connecting to Coach...</p>
                        </div>
                    )}
                    
                    {isSessionActive && (
                        <div className="flex flex-col h-[30rem]">
                            <div className="flex-1 overflow-y-auto pr-4 space-y-4">
                                {transcripts.map((t, i) => (
                                    <div key={i} className={`flex flex-col ${t.speaker === 'user' ? 'items-end' : 'items-start'}`}>
                                        <div className={`px-4 py-2 rounded-lg max-w-[80%] ${t.speaker === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
                                            {t.text}
                                        </div>
                                    </div>
                                ))}
                                <div ref={transcriptEndRef} />
                            </div>
                            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                <button onClick={stopSession} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg">
                                    End Interview
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="md:col-span-1">
                    <FeedbackDisplay feedback={latestFeedback} />
                </div>
            </div>

             {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
        </div>
    );
};

export default InterviewCoach;