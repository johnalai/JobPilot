import React, { useState, useRef, useEffect } from 'react';
import { ChatIcon, CloseIcon, SendIcon, LoadingSpinner } from './icons';
// FIX: Use relative path for local module import.
import { getChatStream } from '../services/geminiService';
import { GenerateContentResponse } from '@google/genai';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
}

const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (input.trim() === '') return;
    const userInput: Message = { id: Date.now(), text: input, sender: 'user' };
    
    // FIX: Pass chat history to the `getChatStream` function.
    const history = messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : ('model' as 'user' | 'model'),
      parts: [{ text: msg.text }]
    }));

    setMessages(prev => [...prev, userInput]);
    setInput('');
    setIsLoading(true);

    try {
      const stream = await getChatStream(input, history);
      let botResponse = '';
      const botMessageId = Date.now() + 1;

      // Add a placeholder for the bot message
      setMessages(prev => [...prev, { id: botMessageId, text: '', sender: 'bot' }]);
      
      // FIX: Cast stream to `AsyncGenerator<GenerateContentResponse>` to resolve type error.
      for await (const chunk of (stream as AsyncGenerator<GenerateContentResponse>)) {
        botResponse += chunk.text;
        setMessages(prev => prev.map(msg => 
          msg.id === botMessageId ? { ...msg, text: botResponse } : msg
        ));
      }

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { id: Date.now() + 1, text: 'Sorry, I encountered an error.', sender: 'bot' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-transform transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-label="Toggle Chat"
      >
        {isOpen ? <CloseIcon className="w-6 h-6" /> : <ChatIcon className="w-6 h-6" />}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-80 h-[28rem] bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col transition-all duration-300 ease-in-out">
          <header className="bg-blue-600 text-white p-4 rounded-t-lg">
            <h3 className="font-bold text-lg">JobBot Assistant</h3>
          </header>

          <div className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-xs p-3 rounded-lg ${
                      msg.sender === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {msg.text || <LoadingSpinner className="w-4 h-4" />}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length-1]?.sender !== 'bot' && (
                 <div className="flex justify-start">
                     <div className="max-w-xs p-3 rounded-lg bg-gray-200 dark:bg-gray-700">
                        <LoadingSpinner className="w-5 h-5" />
                     </div>
                 </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
                placeholder="Ask me anything..."
                className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <button onClick={handleSend} disabled={isLoading} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                <SendIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatBot;
