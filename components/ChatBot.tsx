import React, { useState, useRef, useEffect } from 'react';
import { ChatIcon, CloseIcon, SendIcon, LoadingSpinner, TrashIcon, SpeakerIcon } from './icons';
import { getChatStream } from '../services/geminiService';
import { GoogleGenAI, GenerateContentResponse, Modality } from '@google/genai';
import { useAppContext } from '../context/AppContext';
import { Message } from '../types';
import { decode, decodeAudioData } from '../utils/audioUtils';

const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { chatHistory, setChatHistory } = useAppContext();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [chatHistory]);

  useEffect(() => {
    if (isTtsEnabled && !audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (!isTtsEnabled && audioContextRef.current) {
        audioContextRef.current.close().then(() => {
            audioContextRef.current = null;
            nextStartTimeRef.current = 0;
            setIsSpeaking(false);
        });
    }
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [isTtsEnabled]);


  const handleSend = async () => {
    if (input.trim() === '') return;
    const userInput: Message = { id: Date.now(), text: input, sender: 'user' };
    
    const history = chatHistory.map(msg => ({
      role: msg.sender === 'user' ? 'user' : ('model' as 'user' | 'model'),
      parts: [{ text: msg.text }]
    }));

    setChatHistory(prev => [...prev, userInput]);
    setInput('');
    setIsLoading(true);

    let botResponse = '';
    const botMessageId = Date.now() + 1;

    try {
      setChatHistory(prev => [...prev, { id: botMessageId, text: '', sender: 'bot' }]);
      const stream = await getChatStream(input, history);
      
      for await (const chunk of (stream as AsyncGenerator<GenerateContentResponse>)) {
        botResponse += chunk.text;
        setChatHistory(prev => prev.map(msg => 
          msg.id === botMessageId ? { ...msg, text: botResponse } : msg
        ));
      }

      if (isTtsEnabled && botResponse.trim()) {
        setIsSpeaking(true);
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            nextStartTimeRef.current = audioContextRef.current.currentTime;
        }

        const aiTTS = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const ttsResponse = await aiTTS.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: botResponse }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
        });

        const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio && audioContextRef.current) {
          const audioBuffer = await decodeAudioData(
            decode(base64Audio),
            audioContextRef.current,
            24000,
            1,
          );
          
          const source = audioContextRef.current.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContextRef.current.destination);

          const currentTime = audioContextRef.current.currentTime;
          nextStartTimeRef.current = Math.max(nextStartTimeRef.current, currentTime);
          source.start(nextStartTimeRef.current);
          nextStartTimeRef.current += audioBuffer.duration;

          source.onended = () => {
            if (audioContextRef.current && audioContextRef.current.currentTime >= nextStartTimeRef.current - 0.1) {
                setIsSpeaking(false);
            }
          };

        } else {
            console.error("No audio data received for TTS.");
            setIsSpeaking(false);
        }
      }

    } catch (error) {
      console.error('Chat error:', error);
      setChatHistory(prev => [...prev, { id: Date.now() + 1, text: 'Sorry, I encountered an error.', sender: 'bot' }]);
    } finally {
      setIsLoading(false);
      if (!isTtsEnabled) {
        setIsSpeaking(false);
      }
    }
  };

  const handleClearHistory = () => {
    setChatHistory([]);
    setShowClearConfirmation(false);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().then(() => {
        audioContextRef.current = null;
        nextStartTimeRef.current = 0;
        setIsSpeaking(false);
      });
    }
  };

  return (
    <>
      <button
        id="chat-toggle-button" // Added ID for intro.js targeting
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-transform transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-label="Toggle Chat"
      >
        {isOpen ? <CloseIcon className="w-6 h-6" /> : <ChatIcon className="w-6 h-6" />}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-80 h-[28rem] bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col transition-all duration-300 ease-in-out">
          <header className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center">
            <h3 className="font-bold text-lg">JobBot Assistant</h3>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setIsTtsEnabled(prev => !prev)}
                    className={`p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400 ${isTtsEnabled ? 'bg-blue-500' : 'hover:bg-blue-500'}`}
                    aria-label={isTtsEnabled ? "Turn off Text-to-Speech" : "Turn on Text-to-Speech"}
                    title={isTtsEnabled ? "Text-to-Speech On" : "Text-to-Speech Off"}
                >
                    <SpeakerIcon className={`w-5 h-5 ${isTtsEnabled ? 'text-white' : 'text-blue-200'}`} filled={isTtsEnabled} />
                </button>
                <button
                    onClick={() => setShowClearConfirmation(true)}
                    className="p-1 rounded-full hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    aria-label="Clear Chat History"
                    title="Clear Chat History"
                >
                    <TrashIcon className="w-5 h-5" />
                </button>
            </div>
          </header>

          <div className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4">
              {chatHistory.map((msg, index) => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] p-3 rounded-lg flex flex-col ${
                      msg.sender === 'user'
                        ? 'bg-blue-500 text-white items-end'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 items-start'
                    }`}
                  >
                    {msg.text ? (
                      <p className="mb-1 text-left whitespace-pre-wrap">{msg.text}</p>
                    ) : (
                      msg.sender === 'bot' && isLoading && (index === chatHistory.length - 1) ? (
                        <LoadingSpinner className="w-4 h-4 my-1" />
                      ) : null
                    )}
                    <span className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                        {new Date(msg.id).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isLoading && !isSpeaking && handleSend()}
                placeholder="Ask me anything..."
                className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
                disabled={isLoading || isSpeaking}
              />
              <button onClick={handleSend} disabled={isLoading || isSpeaking} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {isLoading || isSpeaking ? <LoadingSpinner className="w-5 h-5" /> : <SendIcon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {showClearConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" role="dialog" aria-modal="true" aria-labelledby="clear-chat-title">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 id="clear-chat-title" className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Clear Chat History?</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">Are you sure you want to clear all messages from your chat history? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowClearConfirmation(false)}
                className="bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleClearHistory}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatBot;