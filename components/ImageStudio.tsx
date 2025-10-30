import React from 'react';

const ImageStudio: React.FC = () => {
  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Image Studio (Coming Soon!)</h2>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        This feature will allow you to generate and edit images for your professional branding, such as profile pictures or portfolio visuals.
      </p>
      <p className="mt-4 text-gray-500 dark:text-gray-400">Stay tuned for updates!</p>
    </div>
  );
};

export default ImageStudio;