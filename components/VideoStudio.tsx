import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { SparklesIcon, VideoCameraIcon, ArrowDownTrayIcon, ExclamationTriangleIcon, LinkIcon } from '@heroicons/react/24/outline';

function VideoStudio() {
  const [prompt, setPrompt] = useState('');
  const [generatedVideoLink, setGeneratedVideoLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeySelected, setApiKeySelected] = useState(false);
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [operationMessages, setOperationMessages] = useState<string[]>([]);
  const apiCheckIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Check API key selection status on component mount
    checkApiKeySelection();
  }, []);

  const checkApiKeySelection = async () => {
    try {
      // @ts-ignore - window.aistudio is defined globally by external script
      if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
        setApiKeySelected(true);
      } else {
        setApiKeySelected(false);
      }
    } catch (err) {
      console.error('Error checking API key selection:', err);
      setApiKeySelected(false);
      setError('Could not verify API key selection. Please try selecting it again, or ensure the environment supports window.aistudio.');
    }
  };

  const handleSelectApiKey = async () => {
    // @ts-ignore - window.aistudio is defined globally by external script
    if (!window.aistudio) {
      setError('window.aistudio is not available in this environment. Cannot select API key.');
      return;
    }
    try {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      // Assume success and update state immediately to prevent race condition
      setApiKeySelected(true);
      setError(null);
    } catch (err) {
      console.error('Error opening API key selection dialog:', err);
      setError('Failed to open API key selection dialog. Ensure the environment supports window.aistudio.');
      setApiKeySelected(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt to generate a video.');
      return;
    }
    if (!apiKeySelected) {
      setError('Please select an API key before generating videos. Video generation is a paid service.');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedVideoLink(null);
    setOperationMessages(['Initiating video generation...', 'This may take a few minutes.']);

    // Create a new GoogleGenAI instance right before the API call to ensure it uses the most up-to-date API key
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          resolution: resolution,
          aspectRatio: aspectRatio,
        },
      });

      let iteration = 0;
      while (!operation.done) {
        setOperationMessages(prev => {
          const newMessages = [...prev];
          newMessages[1] = `Processing... (approx. ${Math.min(30, iteration * 10)} seconds elapsed)`; // Update elapsed time
          if (iteration % 6 === 0 && iteration > 0) { // Add a reassuring message every minute (10s interval * 6)
            newMessages.push(`Still working on it! Video generation can be complex. Your video should be ready soon.`);
          }
          return newMessages;
        });

        await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
        operation = await ai.operations.getVideosOperation({ operation: operation });
        iteration++;
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        setGeneratedVideoLink(`${downloadLink}&key=${process.env.API_KEY}`);
        setOperationMessages(prev => [...prev, 'Video generation complete!']);
      } else {
        setError('Video generation completed, but no download link was returned.');
        setOperationMessages(prev => [...prev, 'Error: No video link available.']);
      }
    } catch (err: any) {
      console.error('Error generating video:', err);
      let errorMessage = `Failed to generate video: ${err.message || 'Unknown error.'}`;
      if (err.message && err.message.includes("Requested entity was not found.")) {
        errorMessage += " This might indicate an issue with your API key. Please re-select your API key.";
        setApiKeySelected(false); // Reset key selection state
      }
      setError(errorMessage);
      setOperationMessages(prev => [...prev, `Error: ${errorMessage}`]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="video-studio-section bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 min-h-[70vh]">
      <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 text-center flex items-center justify-center">
        <VideoCameraIcon className="h-8 w-8 mr-3 text-blue-600 dark:text-blue-400" /> Video Studio
      </h2>
      <p className="text-center text-gray-600 dark:text-gray-400 text-lg mb-8">
        Craft short videos from text prompts using advanced AI models.
      </p>

      {!apiKeySelected && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg flex flex-col items-center space-y-3 mb-6 border border-yellow-200 dark:border-yellow-800">
          <ExclamationTriangleIcon className="h-8 w-8 text-yellow-500" />
          <p className="text-yellow-800 dark:text-yellow-200 text-center">
            To use the Video Studio, you must select an API key. Video generation may incur costs.
          </p>
          <a
            href="https://ai.google.dev/gemini-api/docs/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-yellow-800 dark:text-yellow-200 hover:underline text-sm flex items-center"
          >
            <LinkIcon className="h-4 w-4 mr-1" /> Learn more about billing
          </a>
          <button
            onClick={handleSelectApiKey}
            className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg shadow transition-colors duration-200"
          >
            Select API Key
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6 mb-8">
        {/* Input & Controls */}
        <div className="md:w-1/2 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Video Prompt</h3>
          <textarea
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white resize-y min-h-[150px]"
            placeholder="Describe the video you want to generate (e.g., 'A neon hologram of a cat driving at top speed')."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={6}
            disabled={loading || !apiKeySelected}
          />

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="resolution" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Resolution</label>
              <select
                id="resolution"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 dark:text-white"
                value={resolution}
                onChange={(e) => setResolution(e.target.value as '720p' | '1080p')}
                disabled={loading || !apiKeySelected}
              >
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
              </select>
            </div>
            <div>
              <label htmlFor="aspectRatio" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Aspect Ratio</label>
              <select
                id="aspectRatio"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 dark:text-white"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as '16:9' | '9:16')}
                disabled={loading || !apiKeySelected}
              >
                <option value="16:9">16:9 (Landscape)</option>
                <option value="9:16">9:16 (Portrait)</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded-md relative mt-4 flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          <button
            onClick={handleGenerateVideo}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg flex items-center justify-center transition-colors duration-200"
            disabled={loading || !apiKeySelected}
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <SparklesIcon className="h-5 w-5 mr-3" />
            )}
            Generate Video
          </button>
        </div>

        {/* Output Area */}
        <div className="md:w-1/2 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center min-h-[300px]">
          {loading ? (
            <div className="text-center text-blue-600 dark:text-blue-400">
              <svg className="animate-spin h-10 w-10 mx-auto mb-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {operationMessages.map((msg, index) => (
                <p key={index} className="text-sm mt-1">{msg}</p>
              ))}
            </div>
          ) : generatedVideoLink ? (
            <div className="text-center">
              <VideoCameraIcon className="h-20 w-20 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-bold text-gray-900 dark:text-white mb-4">Video Generated Successfully!</p>
              <a
                href={generatedVideoLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-colors duration-200"
              >
                <ArrowDownTrayIcon className="h-5 w-5 mr-3" /> Download Video
              </a>
            </div>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400">
              <VideoCameraIcon className="h-20 w-20 mx-auto mb-4" />
              <p className="text-lg">Your generated video will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VideoStudio;