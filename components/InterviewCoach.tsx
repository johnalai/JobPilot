
import React, { useState, useEffect, useRef, useCallback } from 'react';
// Import useAppContext from AppContext.tsx
import { useAppContext } from '../context/AppContext';
import { startLiveSession, stopLiveSession, LiveSessionInstance } from '../services/geminiService';
import { MicrophoneIcon, StopCircleIcon, PlayIcon, AcademicCapIcon, UserIcon, LightBulbIcon } from '@heroicons/react/24/solid';
import { ChatBubbleLeftRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import MarkdownRenderer from './MarkdownRenderer';
import { decode, decodeAudioData, encode, createBlob } from '../utils/audioUtils';

interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: string;
}

function InterviewCoach() {
  const { currentResume } = useAppContext();

  const [isLiveSessionActive, setIsLiveSessionActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [voiceName, setVoiceName] = useState('Zephyr'); // Default voice
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const feedbackEndRef = useRef<HTMLDivElement>(null);

  // --- Web Audio API resources ---
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputNodeRef = useRef<GainNode | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  // This now holds the Promise<LiveSessionInstance>
  const liveSessionPromiseRef = useRef<Promise<LiveSessionInstance> | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null); // To keep track of the script processor

  const currentInputTranscription = useRef<string>('');
  const currentOutputTranscription = useRef<string>('');


  const SYSTEM_INSTRUCTION = `You are an AI interview coach. Your goal is to conduct a mock interview, ask behavioral and technical questions relevant to a software engineering role (or general if no resume is provided). After each of my answers, provide constructive feedback on my response (e.g., clarity, conciseness, relevance, areas for improvement). Keep your questions concise. Use the provided resume content to tailor questions if available. After a few questions, you can offer to summarize the interview or ask if I'm ready for a new set of questions.`;

  // Initialize and clean up Web Audio API resources
  useEffect(() => {
    // Initialization
    inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    // Setup output path
    outputNodeRef.current = outputAudioContextRef.current.createGain();
    outputNodeRef.current.connect(outputAudioContextRef.current.destination);

    // Setup input path
    inputNodeRef.current = inputAudioContextRef.current.createGain();
    // CRITICAL FIX: Set gain to 0 to prevent microphone feedback
    inputNodeRef.current.gain.setValueAtTime(0, inputAudioContextRef.current.currentTime);
    // Connect to destination to keep the audio graph active for the script processor
    inputNodeRef.current.connect(inputAudioContextRef.current.destination);

    if (inputAudioContextRef.current) {
      scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
    }

    // Cleanup
    return () => {
      inputAudioContextRef.current?.close();
      outputAudioContextRef.current?.close();
      mediaStreamRef.current?.getTracks().forEach(track => track.stop());
      scriptProcessorRef.current?.disconnect();
      sourcesRef.current.forEach(source => source.stop());
    };
  }, []);

  useEffect(() => {
    // Scroll to bottom of messages and feedback on update
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    feedbackEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, feedback]);

  // Callback to handle transcription messages from the Live API
  const handleLiveTranscription = useCallback((userInput: string, modelOutput: string) => {
    if (userInput === 'TURN_COMPLETE' && modelOutput === 'TURN_COMPLETE') {
      const fullInput = currentInputTranscription.current;
      const fullOutput = currentOutputTranscription.current;

      setMessages((prev) => [
        ...prev,
        { id: `user-${Date.now()}-final`, role: 'user', text: fullInput, timestamp: new Date().toISOString() },
        { id: `model-${Date.now()}-final`, role: 'model', text: fullOutput, timestamp: new Date().toISOString() },
      ]);
      setLoadingFeedback(false); // Model response received, stop loading indicator
      currentInputTranscription.current = '';
      currentOutputTranscription.current = '';
    } else {
      if (userInput) {
        currentInputTranscription.current += userInput;
        setLoadingFeedback(true); // User is speaking, AI is listening/processing
      }
      if (modelOutput) {
        currentOutputTranscription.current += modelOutput;
        setCurrentQuestion(modelOutput); // Update current question with streaming model output
      }
    }
  }, []);

  // Callback to handle function calls from the Live API
  const handleLiveFunctionCall = useCallback(async (name: string, args: Record<string, any>, id: string) => {
    // Function calls are not expected for a simple interview coach,
    // but if they were, this is where they'd be handled.
    console.warn('Unexpected function call from model:', name, args);
    return 'No action taken for this function call.';
  }, []);

  // Callback to send tool responses via the live session instance
  const sendToolResponse = useCallback(async (response: any) => {
    if (liveSessionPromiseRef.current) {
      liveSessionPromiseRef.current.then((session) => {
        session.sendToolResponse(response);
      }).catch(e => {
        console.error("Error sending tool response after session resolution:", e);
      });
    } else {
      console.error("Attempted to send tool response, but live session instance promise is not available.");
    }
  }, []);


  const handleStartSession = async () => {
    if (!currentResume) {
      setError('Please select or create a resume in the "Resume Hub" to start an interview session.');
      return;
    }

    setMessages([]);
    setFeedback('');
    setCurrentQuestion('');
    setError(null);
    setIsLiveSessionActive(true);
    currentInputTranscription.current = '';
    currentOutputTranscription.current = '';

    const initialMessage: Message = {
      id: `system-${Date.now()}`,
      role: 'system',
      text: 'Starting mock interview session...',
      timestamp: new Date().toISOString(),
    };
    setMessages([initialMessage]);

    const instructionWithResume = currentResume
      ? `${SYSTEM_INSTRUCTION}\n\nUser's Resume Content:\n\`\`\`\n${currentResume.content}\n\`\`\`\n\nBegin by asking an introductory question, e.g., "Tell me about yourself."`
      : `${SYSTEM_INSTRUCTION}\n\nBegin by asking an introductory question, e.g., "Tell me about yourself."`;

    if (!inputAudioContextRef.current || !outputAudioContextRef.current || !inputNodeRef.current || !outputNodeRef.current || !scriptProcessorRef.current) {
      setError("Audio system not initialized correctly. Please reload.");
      setIsLiveSessionActive(false);
      return;
    }

    try {
      if (micEnabled) {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      // Ensure contexts are running (sometimes they start suspended)
      if (inputAudioContextRef.current.state === 'suspended') {
        await inputAudioContextRef.current.resume();
      }
      if (outputAudioContextRef.current.state === 'suspended') {
        await outputAudioContextRef.current.resume();
      }

      // Store the promise directly, do not await it here.
      liveSessionPromiseRef.current = startLiveSession(
        handleLiveTranscription,
        handleLiveFunctionCall,
        instructionWithResume,
        micEnabled,
        voiceName,
        // Pass Web Audio API objects and state setters
        inputAudioContextRef.current,
        outputAudioContextRef.current,
        inputNodeRef.current,
        outputNodeRef.current,
        sourcesRef.current,
        mediaStreamRef.current, // Pass the stream without non-null assertion
        (val) => (nextStartTimeRef.current = val), // Setter for nextStartTimeRef
        () => nextStartTimeRef.current, // Getter for nextStartTimeRef
        sendToolResponse, // Callback for sending tool responses (now handles its own .then())
        scriptProcessorRef // Pass the scriptProcessor ref
      );

      // Optionally await here if you need to ensure the connection is established before interacting further
      // However, the `sessionPromise.then()` in geminiService handles data streaming correctly.
      await liveSessionPromiseRef.current; // Wait for the connection to be fully established

    } catch (e: any) {
      console.error('Error starting live session:', e);
      setError(`Failed to start live session: ${e.message || 'Unknown error'}. Please check microphone access and try again.`);
      setIsLiveSessionActive(false);
      handleStopSession(); // Attempt to clean up
    }
  };

  const handleStopSession = () => {
    stopLiveSession(liveSessionPromiseRef.current);
    setIsLiveSessionActive(false);
    setLoadingFeedback(false);
    setCurrentQuestion('');
    setFeedback('');
    setError(null);
    setMessages((prev) => [
      ...prev,
      { id: `system-${Date.now()}`, role: 'system', text: 'Interview session ended.', timestamp: new Date().toISOString() },
    ]);

    // Clean up local audio resources
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (scriptProcessorRef.current) {
      // Disconnect the script processor from its source in geminiService's onopen
      // and ensure it's disconnected from destination here
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current.onaudioprocess = null; // Clear handler
    }
    liveSessionPromiseRef.current = null;
  };

  return (
    <div className="interview-coach-section bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 min-h-[70vh]">
      <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 text-center">AI Interview Coach</h2>

      {error && (
        <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded-md relative mb-6 flex items-center">
          <XMarkIcon className="h-5 w-5 mr-2" />
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {!currentResume && !isLiveSessionActive && (
         <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg flex items-center space-x-3 mb-6">
            <LightBulbIcon className="h-6 w-6 text-yellow-500" />
            <p className="text-yellow-800 dark:text-yellow-200">
              Tip: Upload or select a resume in the "Resume Hub" to enable personalized interview questions!
            </p>
         </div>
      )}

      <div className="flex justify-center items-center space-x-4 mb-8">
        {!isLiveSessionActive ? (
          <button
            onClick={handleStartSession}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg flex items-center transition-colors duration-200"
          >
            <MicrophoneIcon className="h-6 w-6 mr-3" /> Start Mock Interview
          </button>
        ) : (
          <button
            onClick={handleStopSession}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg flex items-center transition-colors duration-200"
          >
            <StopCircleIcon className="h-6 w-6 mr-3" /> Stop Interview
          </button>
        )}
        <label className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={micEnabled}
            onChange={(e) => setMicEnabled(e.target.checked)}
            className="form-checkbox h-5 w-5 text-blue-600 dark:bg-gray-700 rounded"
            disabled={isLiveSessionActive}
          />
          <span>Enable Microphone</span>
        </label>
        <select
          value={voiceName}
          onChange={(e) => setVoiceName(e.target.value)}
          className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 dark:text-white text-sm"
          disabled={isLiveSessionActive}
        >
          <option value="Zephyr">Zephyr</option>
          <option value="Kore">Kore</option>
          <option value="Puck">Puck</option>
          <option value="Charon">Charon</option>
          <option value="Fenrir">Fenrir</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Interview Conversation */}
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 h-[60vh] flex flex-col">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 pb-3 border-b border-gray-200 dark:border-gray-700 flex items-center">
            <ChatBubbleLeftRightIcon className="h-6 w-6 mr-2 text-blue-600 dark:text-blue-400" /> Conversation
          </h3>
          <div className="flex-grow overflow-y-auto space-y-4 pr-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] p-3 rounded-lg shadow-sm
                    ${msg.role === 'user'
                      ? 'bg-blue-500 text-white rounded-br-none'
                      : msg.role === 'model'
                        ? 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100 rounded-bl-none'
                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-sm italic'
                    }`}
                >
                  <p className="font-semibold mb-1 flex items-center">
                    {msg.role === 'user' ? <UserIcon className="h-4 w-4 mr-1" /> : msg.role === 'model' ? <AcademicCapIcon className="h-4 w-4 mr-1" /> : null}
                    {msg.role === 'user' ? 'You' : msg.role === 'model' ? 'Coach' : 'System'}
                  </p>
                  <MarkdownRenderer>{msg.text}</MarkdownRenderer>
                  <span className="block text-right text-xs opacity-75 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
            {loadingFeedback && (
              <div className="flex justify-start">
                <div className="max-w-[70%] p-3 rounded-lg shadow-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-none">
                  <p className="font-semibold mb-1 flex items-center">
                    <AcademicCapIcon className="h-4 w-4 mr-1" /> Coach
                  </p>
                  <p className="animate-pulse">Coach is thinking...</p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Feedback Panel */}
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 h-[60vh] flex flex-col">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 pb-3 border-b border-gray-200 dark:border-gray-700 flex items-center">
            <LightBulbIcon className="h-6 w-6 mr-2 text-yellow-600 dark:text-yellow-400" /> Feedback
          </h3>
          <div className="flex-grow overflow-y-auto pr-2 text-gray-700 dark:text-gray-300 prose dark:prose-invert max-w-none">
            {feedback ? (
              <MarkdownRenderer>{feedback}</MarkdownRenderer>
            ) : (
              <p className="italic text-gray-500 dark:text-gray-400">Feedback will appear here after your responses.</p>
            )}
            <div ref={feedbackEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default InterviewCoach;
