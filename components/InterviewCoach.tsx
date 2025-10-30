import React, { useState, useEffect, useRef, useCallback } from 'react';
// FIX: Use relative paths for local module imports.
import { useAppContext } from '../context/AppContext';
import { LoadingSpinner } from './icons';
import { GoogleGenAI, LiveServerMessage, Modality, Blob, Type, FunctionDeclaration } from '@google/genai';
import { InterviewFeedback, Application } from '../types';
import { decode, decodeAudioData, encode } from '../utils/audioUtils'; // Import from new utils, and encode from audioUtils
// Removed downloadElementAsPdf import


interface TranscriptEntry {
    speaker: 'user' | 'model';
    text: string;
}

const AI_VOICES = [
    { name: 'Zephyr', value: 'Zephyr' },
    { name: 'Puck', value: 'Puck' },
    { name: 'Charon', value: 'Charon' },
    { name: 'Kore', value: 'Kore' },
    { name: 'Fenrir', value: 'Fenrir' },
];

const SUGGESTED_QA = [
    {
        question: "Tell me about yourself.",
        answer: "Start with your present, then go to the past (relevant experiences), and end with how your future goals align with this role/company. Keep it concise, around 1-2 minutes, and focus on professional achievements and aspirations."
    },
    {
        question: "Why are you interested in this position?",
        answer: "Show genuine interest by mentioning specific aspects of the role, the company's mission/culture, or recent achievements that resonate with you. Connect it to your skills and career goals."
    },
    {
        question: "What are your greatest strengths?",
        answer: "Choose 1-2 strengths relevant to the job, provide a specific example of how you've demonstrated them, and explain the positive outcome. Avoid generic terms without context."
    },
    {
        question: "What are your greatest weaknesses?",
        answer: "Identify a real, but not critical, weakness. Explain what you're doing to improve it, and show self-awareness and a commitment to growth. Frame it positively if possible (e.g., 'I used to struggle with X, but now I do Y')."
    },
    {
        question: "Where do you see yourself in five years?",
        answer: "Align your aspirations with the growth opportunities within the company. Show ambition and a desire to contribute long-term, but be realistic and flexible."
    },
    {
        question: "Why do you want to leave your current job?",
        answer: "Focus on growth opportunities, new challenges, or a better cultural fit rather than complaining about your previous role. Keep it positive and forward-looking."
    },
    {
        question: "Do you have any questions for us?",
        answer: "Always ask questions! Prepare 2-3 thoughtful questions about the role, team, company culture, or next steps. This shows engagement and genuine interest."
    }
];


const FeedbackDisplay: React.FC<{ feedback: InterviewFeedback | null, isLive?: boolean }> = ({ feedback, isLive = true }) => {
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
            <h3 className="text-xl font-semibold mb-4 text-center">{isLive ? 'Live Feedback' : 'Final Performance Summary'}</h3>
            <div className="flex flex-col items-center">
                <div className="relative w-32 h-32">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                        <circle className="text-gray-200 dark:text-gray-700" strokeWidth="10" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" />
                        <circle className={`${getScoreColor(feedback.score)} transition-all duration-1000 ease-out`} strokeWidth="10" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" transform="rotate(-90 50 50)" />
                    </svg>
                    <div className={`absolute inset-0 flex items-center justify-center text-3xl font-bold ${getScoreColor(feedback.score)}`}>{feedback.score}</div>
                </div>
                <p className="font-semibold mt-2">{isLive ? 'Match Score' : 'Overall Score'}</p>
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

// formatInterviewReportContent is removed


export const InterviewCoach: React.FC = () => {
    const { selectedApplicationForInterview: app, setSelectedApplicationForInterview, applications, resumes, setError } = useAppContext(); // Get global setError
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    // Removed local error state, now using global setError
    // const [error, setError] = useState<string | null>(null);
    const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
    const [latestFeedback, setLatestFeedback] = useState<InterviewFeedback | null>(null);
    const [cumulativeFeedback, setCumulativeFeedback] = useState<InterviewFeedback[]>([]);
    const [finalFeedback, setFinalFeedback] = useState<InterviewFeedback | null>(null);

    const [manualJobTitle, setManualJobTitle] = useState('');
    const [showSettings, setShowSettings] = useState(false); // State for collapsible settings
    const [showSuggestedQA, setShowSuggestedQA] = useState(false); // New: State for suggested Q&A

    // AI Voice & Speaking Rate States
    const [selectedVoice, setSelectedVoice] = useState<'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir'>('Zephyr');
    const [speakingRate, setSpeakingRate] = useState(1.0);

    // FIX: Infer LiveSession type dynamically from GoogleGenAI['live']['connect']
    const sessionPromiseRef = useRef<Promise<Awaited<ReturnType<GoogleGenAI['live']['connect']>>> | null>(null); // Store the actual promise
    const liveSessionRef = useRef<Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null>(null); // Store the resolved LiveSession object
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    let nextStartTime = useRef(0); // Using ref for nextStartTime for consistent updates
    const microphoneStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

    const transcriptEndRef = useRef<HTMLDivElement>(null);
    // Removed interviewReportCardRef as content will be generated dynamically now.

    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcripts]);

    const stopSession = useCallback(async () => {
        // Close the actual LiveSession object if it exists
        if (liveSessionRef.current) {
            liveSessionRef.current.close();
            liveSessionRef.current = null;
        }
        sessionPromiseRef.current = null; // Clear the promise reference too

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
           inputAudioContextRef.current = null;
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            await outputAudioContextRef.current.close();
            outputAudioContextRef.current = null;
        }
        nextStartTime.current = 0; // Reset nextStartTime
        setIsSessionActive(false);
        setIsLoading(false);
        setLatestFeedback(null); // Clear live feedback

        // Calculate final feedback when session stops
        if (cumulativeFeedback.length > 0) {
            const totalScore = cumulativeFeedback.reduce((sum, f) => sum + f.score, 0);
            const avgScore = totalScore / cumulativeFeedback.length;
            const allStrengths = Array.from(new Set(cumulativeFeedback.flatMap(f => f.strengths)));
            const allAreasForImprovement = Array.from(new Set(cumulativeFeedback.flatMap(f => f.areasForImprovement)));

            setFinalFeedback({
                score: Math.round(avgScore),
                strengths: allStrengths,
                areasForImprovement: allAreasForImprovement,
            });
        }
    }, [cumulativeFeedback, setError]); // Added setError to dependencies

    const createBlob = (data: Float32Array): Blob => {
      const l = data.length;
      const int16 = new Int16Array(l);
      for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
      }
      return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
      };
    };

    const startSession = useCallback(async () => {
      setIsLoading(true);
      setError(null);
      setTranscripts([]);
      setCumulativeFeedback([]);
      setFinalFeedback(null);
      setLatestFeedback(null);

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        nextStartTime.current = 0;

        microphoneStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

        const jobTitleForInstruction = app?.job.title || manualJobTitle || 'general role';
        const companyNameForInstruction = app?.job.company || '';
        
        // MODIFIED: Simplified systemInstruction to avoid potential "invalid argument" due to long text
        // and to not claim access to data not explicitly provided in live.connect.
        const systemInstruction = `You are an AI interview coach. Your goal is to conduct a mock interview for the position of "${jobTitleForInstruction}"${companyNameForInstruction ? ` at "${companyNameForInstruction}"` : ''}.
        Your responses should be concise.
        After each answer from the user, provide a quick score (0-100), identify 1-2 strengths, and 1-2 areas for improvement.
        Do NOT provide interview feedback at the start. Start by welcoming the candidate and asking the first question.
        Provide feedback ONLY when the user stops speaking for a turn.`;


        const getInterviewFeedbackFunction: FunctionDeclaration = {
          name: 'getInterviewFeedback',
          parameters: {
            type: Type.OBJECT,
            description: 'Provides real-time feedback on a user\'s interview answer.',
            properties: {
              score: { type: Type.NUMBER, description: 'Overall score for the answer (0-100).' },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: '1-2 key strengths of the answer.' },
              areasForImprovement: { type: Type.ARRAY, items: { type: Type.STRING }, description: '1-2 key areas for improvement in the answer.' },
            },
            required: ['score', 'strengths', 'areasForImprovement'],
          },
        };

        // CRITICAL FIX: Assign the actual promise from ai.live.connect
        const connectPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          callbacks: {
            onopen: () => {
              console.debug('Live session opened');
              setIsLoading(false);
              setIsSessionActive(true); // Only set active when successfully opened

              // Store the resolved session object for direct closure in stopSession
              connectPromise.then(session => {
                  liveSessionRef.current = session;
              }).catch(e => console.error("Error setting liveSessionRef after onopen:", e));


              const source = inputAudioContextRef.current?.createMediaStreamSource(microphoneStreamRef.current!);
              scriptProcessorRef.current = inputAudioContextRef.current?.createScriptProcessor(4096, 1, 1);
              if (scriptProcessorRef.current) {
                scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                  const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                  const pcmBlob = createBlob(inputData);
                  // Use the connectPromise here, not sessionPromiseRef.current directly
                  connectPromise.then((s) => { // 's' is the LiveSession object
                    s.sendRealtimeInput({ media: pcmBlob });
                  });
                };
                source?.connect(scriptProcessorRef.current);
                scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
              }
            },
            onmessage: async (message: LiveServerMessage) => {
              console.debug('Live session message:', message);
              // Handle model audio output
              const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              if (base64EncodedAudioString && outputAudioContextRef.current) {
                const audioBuffer = await decodeAudioData(
                  decode(base64EncodedAudioString),
                  outputAudioContextRef.current,
                  24000,
                  1,
                );
                const source = outputAudioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputAudioContextRef.current.destination); // Connect directly to destination
                
                nextStartTime.current = Math.max(nextStartTime.current, outputAudioContextRef.current.currentTime);
                source.start(nextStartTime.current);
                nextStartTime.current += audioBuffer.duration;
              }

              // Handle model transcription
              if (message.serverContent?.outputTranscription?.text) {
                setTranscripts(prev => {
                  const last = prev[prev.length - 1];
                  if (last && last.speaker === 'model') {
                    // Append to existing model turn
                    return prev.map((t, i) => i === prev.length - 1 ? { ...t, text: t.text + message.serverContent!.outputTranscription!.text } : t);
                  } else {
                    // Start new model turn
                    return [...prev, { speaker: 'model', text: message.serverContent!.outputTranscription!.text }];
                  }
                });
              }

              // Handle user transcription
              if (message.serverContent?.inputTranscription?.text) {
                setTranscripts(prev => {
                  const last = prev[prev.length - 1];
                  if (last && last.speaker === 'user') {
                    // Append to existing user turn
                    return prev.map((t, i) => i === prev.length - 1 ? { ...t, text: message.serverContent!.inputTranscription!.text } : t);
                  } else {
                    // Start new user turn (this overwrites previous user transcription if not complete)
                    // For live, we usually update the *last* user message or create a new one.
                    // This implementation assumes a full user turn is sent, so the text is the complete turn.
                    return [...prev.filter(t => t.speaker === 'model'), { speaker: 'user', text: message.serverContent!.inputTranscription!.text }];
                  }
                });
              }

              // Handle function calls (feedback)
              if (message.toolCall?.functionCalls) {
                for (const fc of message.toolCall.functionCalls) {
                  if (fc.name === 'getInterviewFeedback' && fc.args) {
                    // FIX: Convert the expression to 'unknown' first to resolve the type conversion error.
                    const feedback: InterviewFeedback = fc.args as unknown as InterviewFeedback;
                    setLatestFeedback(feedback);
                    setCumulativeFeedback(prev => [...prev, feedback]);
                    // Send tool response to update model context
                    connectPromise.then((s) => {
                      s.sendToolResponse({
                        functionResponses: {
                          id: fc.id,
                          name: fc.name,
                          response: { result: "Feedback processed." },
                        }
                      })
                    });
                  }
                }
              }
            },
            onerror: (e: ErrorEvent) => {
              console.error('Live session error:', e);
              setError(e.message || 'Live interview session encountered an error.');
              stopSession();
            },
            onclose: (e: CloseEvent) => {
              console.debug('Live session closed:', e);
              if (e.code === 1006) { // Abnormally closed
                setError('Live session disconnected unexpectedly. Please try again.');
              }
              stopSession();
            },
          },
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
              // FIX: Removed 'speakingRate' as it's not a supported property in the speechConfig based on guidelines.
              // speakingRate: speakingRate, 
            },
            systemInstruction: systemInstruction,
            tools: [{ functionDeclarations: [getInterviewFeedbackFunction] }],
            inputAudioTranscription: {}, // Enable transcription for user input audio.
            outputAudioTranscription: {}, // Enable transcription for model output audio.
          },
        });
        sessionPromiseRef.current = connectPromise; // Store the actual promise

      } catch (e: any) {
        setError(e.message || 'Failed to start live interview session.');
        setIsLoading(false);
        stopSession(); // Clean up if initial setup fails before connectPromise is even assigned
      }
    }, [app, manualJobTitle, selectedVoice, speakingRate, cumulativeFeedback, setError, stopSession]); // Dependencies

    // handleDownloadReport function removed

    const jobTitle = app?.job.title || manualJobTitle;
    const companyName = app?.job.company || '';
    const hasJobContext = !!app || !!manualJobTitle;

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Interview Coach</h2>
                <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
                    Practice your interview skills with AI.
                </p>
            </div>

            {!hasJobContext && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg space-y-4">
                    <p className="text-center text-gray-500 dark:text-gray-400">
                        Select an application from 'My Applications' or enter a job title manually to begin.
                    </p>
                    <div className="flex flex-col gap-3">
                        <label htmlFor="manualJobTitle" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Or Enter Job Title Manually:
                        </label>
                        <input
                            id="manualJobTitle"
                            type="text"
                            value={manualJobTitle}
                            onChange={(e) => setManualJobTitle(e.target.value)}
                            placeholder="e.g., Software Engineer, Product Manager"
                            className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-700"
                            disabled={isSessionActive}
                        />
                        <button
                            onClick={() => setSelectedApplicationForInterview(null)} // Clear app selection if using manual
                            className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg"
                        >
                            Use Manual Job Title
                        </button>
                    </div>
                </div>
            )}

            {hasJobContext && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Controls and Settings */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                            <h3 className="text-xl font-semibold mb-4">
                                Interview for: <br/>
                                <span className="text-blue-600 dark:text-blue-400">{jobTitle}</span>
                                {companyName && <span className="text-gray-500 dark:text-gray-400"> at {companyName}</span>}
                            </h3>

                            <div className="space-y-4">
                                {!isSessionActive ? (
                                    <button
                                        onClick={startSession}
                                        disabled={isLoading || !hasJobContext}
                                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isLoading ? <LoadingSpinner className="w-5 h-5" /> : null}
                                        {isLoading ? 'Starting Session...' : 'Start Interview'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={stopSession}
                                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg"
                                    >
                                        End Interview
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowSettings(!showSettings)}
                                    className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded-lg"
                                >
                                    {showSettings ? 'Hide Settings' : 'Show Settings'}
                                </button>
                                {showSettings && (
                                    <div className="mt-4 p-4 border rounded-lg dark:border-gray-700 animate-fade-in">
                                        <h4 className="font-semibold mb-3">AI Voice Settings</h4>
                                        <div className="mb-3">
                                            <label htmlFor="ai-voice" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Voice:</label>
                                            <select
                                                id="ai-voice"
                                                value={selectedVoice}
                                                onChange={(e) => setSelectedVoice(e.target.value as typeof selectedVoice)}
                                                className="mt-1 w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-700"
                                                disabled={isSessionActive}
                                            >
                                                {AI_VOICES.map(v => (
                                                    <option key={v.value} value={v.value}>{v.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="speaking-rate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Speaking Rate:</label>
                                            <input
                                                type="range"
                                                id="speaking-rate"
                                                min="0.5"
                                                max="1.5"
                                                step="0.1"
                                                value={speakingRate}
                                                onChange={(e) => setSpeakingRate(parseFloat(e.target.value))}
                                                className="mt-1 w-full"
                                                disabled={isSessionActive}
                                            />
                                            <span className="text-sm text-gray-500 dark:text-gray-400">{speakingRate.toFixed(1)}x</span>
                                        </div>
                                    </div>
                                )}
                                {/* New: Suggested Questions & Answers */}
                                <button
                                    onClick={() => setShowSuggestedQA(!showSuggestedQA)}
                                    className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded-lg"
                                    disabled={isSessionActive}
                                >
                                    {showSuggestedQA ? 'Hide Suggested Q&A' : 'Show Suggested Q&A'}
                                </button>
                                {showSuggestedQA && (
                                    <div className="mt-4 p-4 border rounded-lg dark:border-gray-700 animate-fade-in max-h-80 overflow-y-auto">
                                        <h4 className="font-semibold mb-3">Common Interview Questions & Tips</h4>
                                        <div className="space-y-4">
                                            {SUGGESTED_QA.map((qa, index) => (
                                                <div key={index} className="border-b pb-3 last:border-b-0 last:pb-0 dark:border-gray-700">
                                                    <p className="font-bold text-blue-600 dark:text-blue-400 mb-1">Q: {qa.question}</p>
                                                    <p className="text-sm text-gray-700 dark:text-gray-300">A: {qa.answer}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        {isSessionActive && latestFeedback && (
                            <FeedbackDisplay feedback={latestFeedback} isLive={true} />
                        )}
                        {!isSessionActive && finalFeedback && (
                             <div id="interview-report-card" className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                                <FeedbackDisplay feedback={finalFeedback} isLive={false} />
                                {/* Download Full Report (PDF) button removed */}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Transcript */}
                    <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg flex flex-col h-[70vh]">
                        <h3 className="text-xl font-semibold mb-4">Interview Transcript</h3>
                        <div className="flex-1 overflow-y-auto space-y-4 p-2 border rounded-lg dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                            {transcripts.length === 0 && !isSessionActive && (
                                <p className="text-center text-gray-500 dark:text-gray-400">Start the interview to see the transcript.</p>
                            )}
                            {transcripts.map((entry, index) => (
                                <div key={index} className={`flex ${entry.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-3 rounded-lg ${entry.speaker === 'user' ? 'bg-blue-100 dark:bg-blue-900/50 text-gray-800 dark:text-gray-200' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}>
                                        <p className="font-semibold text-sm mb-1">
                                            {entry.speaker === 'user' ? 'You' : 'AI Coach'}
                                        </p>
                                        <p className="text-sm whitespace-pre-wrap">{entry.text}</p>
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-center">
                                    <LoadingSpinner className="w-6 h-6 text-blue-500" />
                                </div>
                            )}
                            <div ref={transcriptEndRef} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};