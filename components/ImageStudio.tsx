import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { SparklesIcon, PhotoIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

function ImageStudio() {
  const [prompt, setPrompt] = useState('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateImage = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt to generate an image.');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedImageUrl(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '1:1', // Default aspect ratio
        },
      });

      const base64ImageBytes: string | undefined = response.generatedImages?.[0]?.image?.imageBytes;
      if (base64ImageBytes) {
        setGeneratedImageUrl(`data:image/jpeg;base64,${base64ImageBytes}`);
      } else {
        setError('No image was generated. Please try a different prompt.');
      }
    } catch (err: any) {
      console.error('Error generating image:', err);
      setError(`Failed to generate image: ${err.message || 'Unknown error.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="image-studio-section bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 min-h-[70vh]">
      <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 text-center flex items-center justify-center">
        <PhotoIcon className="h-8 w-8 mr-3 text-blue-600 dark:text-blue-400" /> Image Studio
      </h2>
      <p className="text-center text-gray-600 dark:text-gray-400 text-lg mb-8">
        Generate stunning images from text prompts using AI.
      </p>

      <div className="flex flex-col md:flex-row gap-6 mb-8">
        {/* Input & Controls */}
        <div className="md:w-1/2 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Image Prompt</h3>
          <textarea
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white resize-y min-h-[150px]"
            placeholder="Describe the image you want to generate (e.g., 'A robot holding a red skateboard in a futuristic city')."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={6}
            disabled={loading}
          />
          {error && (
            <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded-md relative mt-4 flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          <button
            onClick={handleGenerateImage}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg flex items-center justify-center transition-colors duration-200"
            disabled={loading}
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <SparklesIcon className="h-5 w-5 mr-3" />
            )}
            Generate Image
          </button>
        </div>

        {/* Output Area */}
        <div className="md:w-1/2 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex items-center justify-center min-h-[300px]">
          {loading ? (
            <div className="text-center text-blue-600 dark:text-blue-400">
              <svg className="animate-spin h-10 w-10 mx-auto mb-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-lg">Generating your image...</p>
            </div>
          ) : generatedImageUrl ? (
            <img src={generatedImageUrl} alt="Generated AI Image" className="max-w-full h-auto rounded-lg shadow-lg" />
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400">
              <PhotoIcon className="h-20 w-20 mx-auto mb-4" />
              <p className="text-lg">Your generated image will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImageStudio;