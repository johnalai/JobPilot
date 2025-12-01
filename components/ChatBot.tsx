
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getChatResponse } from '../services/geminiService';
import { PaperAirplaneIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline';
import MarkdownRenderer from './MarkdownRenderer';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;

    const newMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: input,
      timestamp: new Date().toISOString(),
    };

    setMessages((prevMessages) => [...prevMessages, newMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      // In a real chat, you'd maintain conversation history to send with each prompt.
      // For this simple chatbot, we send only the latest message.
      // For more advanced context, you'd send `messages.map(m => ({ role: m.role, parts: [{text: m.text}] }))`
      // with a `history` config or using `ai.chats.create()`.
      const responseText = await getChatResponse(input);
      const modelMessage: Message = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: responseText,
        timestamp: new Date().toISOString(),
      };
      setMessages((prevMessages) => [...prevMessages, modelMessage]);
    } catch (err) {
      console.error('Chatbot error:', err);
      setError('Failed to get a response from the AI. Please try again.');
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          id: `error-${Date.now()}`,
          role: 'model',
          text: 'Error: Could not retrieve a response.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chatbot-section bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 min-h-[70vh] flex flex-col">
      <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 text-center">JobPilot AI Chatbot</h2>

      {error && (
        <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded-md relative mb-6 flex items-center">
          <XMarkIcon className="h-5 w-5 mr-2" />
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Chat Messages Area */}
      <div className="flex-grow overflow-y-auto p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4 shadow-inner border border-gray-200 dark:border-gray-700">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <SparklesIcon className="h-12 w-12 mb-4 text-blue-400" />
            <p className="text-lg">Ask me anything about your job search!</p>
            <p className="text-sm">e.g., "What are common interview questions for a Software Engineer?"</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] p-3 rounded-lg shadow-sm text-sm
                    ${msg.role === 'user'
                      ? 'bg-blue-500 text-white rounded-br-none'
                      : 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100 rounded-bl-none'
                    }`}
                >
                  <p className="font-semibold mb-1">{msg.role === 'user' ? 'You' : 'JobPilot AI'}</p>
                  <MarkdownRenderer>{msg.text}</MarkdownRenderer>
                  <span className="block text-right text-xs opacity-75 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[75%] p-3 rounded-lg shadow-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-none flex items-center">
                  <SparklesIcon className="h-5 w-5 mr-2 animate-pulse" />
                  <span>JobPilot AI is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSendMessage} className="flex space-x-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-grow p-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white"
          disabled={loading}
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg flex items-center transition-colors duration-200"
          disabled={loading}
        >
          {loading ? (
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <PaperAirplaneIcon className="h-5 w-5" />
          )}
        </button>
      </form>
    </div>
  );
}

export default ChatBot;
