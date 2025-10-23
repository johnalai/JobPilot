
import React from 'react';
import { BriefcaseIcon, ResumeIcon } from './icons';
// FIX: Use relative path for AppContext import.
import { useAppContext } from '../context/AppContext';

const Dashboard: React.FC = () => {
  const { resumes, applications } = useAppContext();
  const recentApplications = applications.slice(0, 3);

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Welcome to your JobPilot AI Dashboard</h2>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">Manage your career journey from a single command center.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Resume Status Card */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
              <ResumeIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Resume Hub</h3>
              <p className="text-gray-500 dark:text-gray-400">You have {resumes.length} resume(s) saved.</p>
            </div>
          </div>
          <div className="mt-4">
            {resumes.length > 0 ? (
              <div className="p-4 bg-green-100 dark:bg-green-900/50 rounded-lg text-green-800 dark:text-green-300">
                <p className="font-medium">You're all set! Your resumes are ready to be tailored for jobs.</p>
              </div>
            ) : (
              <div className="p-4 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg text-yellow-800 dark:text-yellow-300">
                <p className="font-medium">No resumes found. Please visit the 'Resume Hub' to get started.</p>
              </div>
            )}
          </div>
        </div>

        {/* Applications Overview Card */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900 rounded-full">
              <BriefcaseIcon className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">My Applications</h3>
              <p className="text-gray-500 dark:text-gray-400">You have {applications.length} tracked application(s).</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {recentApplications.length > 0 ? (
              recentApplications.map((app, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                  <div>
                    <p className="font-semibold">{app.job.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{app.job.company}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      app.status === 'Submitted' ? 'bg-green-200 text-green-800' :
                      app.status === 'Draft' ? 'bg-yellow-200 text-yellow-800' :
                      'bg-gray-200 text-gray-800'
                  }`}>{app.status}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center p-4">No recent applications. Go to 'Find Jobs' to start applying!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
