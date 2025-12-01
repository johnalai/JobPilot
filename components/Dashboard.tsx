

import React from 'react';
// Import useAppContext from AppContext.tsx
import { useAppContext } from '../context/AppContext';
import { BriefcaseIcon, DocumentIcon, AcademicCapIcon, CalendarDaysIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { ClockIcon, CheckCircleIcon } from '@heroicons/react/24/solid';

// Helper to safely format dates and prevent crashes from invalid date strings
const isValidDate = (date: any): boolean => {
  return date && !isNaN(new Date(date).getTime());
};

function Dashboard() {
  const { savedJobs, applications, resumes, tasks, frequentlySearchedKeywords, setCurrentView } = useAppContext();

  // Dashboard stats
  const totalSavedJobs = savedJobs?.length || 0;
  const totalApplications = applications?.length || 0;
  const totalResumes = resumes?.length || 0;
  const pendingTasks = tasks?.filter(task => task?.status !== 'Completed').length || 0;
  const interviewCount = applications?.filter(app => app?.status === 'Interviewing').length || 0;

  // Basic "recent activity" - could be more sophisticated
  const recentApplications = [...(applications || [])]
    .filter(app => app && app.applicationDate) // Filter out corrupted entries
    .sort((a, b) => new Date(b?.applicationDate || 0).getTime() - new Date(a?.applicationDate || 0).getTime())
    .slice(0, 3);

  const topKeywords = [...(frequentlySearchedKeywords || [])]
    .sort((a, b) => (b?.count || 0) - (a?.count || 0))
    .slice(0, 5);

  return (
    <div className="dashboard-welcome bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 min-h-[70vh]">
      <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-8 text-center">Welcome to Your JobPilot AI Dashboard!</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Card 1: Saved Jobs */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-lg shadow-sm flex items-center justify-between border border-blue-200 dark:border-blue-800">
          <div>
            <p className="text-sm font-medium text-blue-600 dark:text-blue-300">Saved Jobs</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalSavedJobs}</p>
          </div>
          <BriefcaseIcon className="h-10 w-10 text-blue-400 dark:text-blue-600" />
        </div>

        {/* Card 2: Total Applications */}
        <div className="bg-green-50 dark:bg-green-900/20 p-5 rounded-lg shadow-sm flex items-center justify-between border border-green-200 dark:border-green-800">
          <div>
            <p className="text-sm font-medium text-green-600 dark:text-green-300">Total Applications</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalApplications}</p>
          </div>
          <DocumentIcon className="h-10 w-10 text-green-400 dark:text-green-600" />
        </div>

        {/* Card 3: Resumes Managed */}
        <div className="bg-purple-50 dark:bg-purple-900/20 p-5 rounded-lg shadow-sm flex items-center justify-between border border-purple-200 dark:border-purple-800">
          <div>
            <p className="text-sm font-medium text-purple-600 dark:text-purple-300">Resumes Managed</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalResumes}</p>
          </div>
          <AcademicCapIcon className="h-10 w-10 text-purple-400 dark:text-purple-600" />
        </div>

        {/* Card 4: Pending Tasks */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-5 rounded-lg shadow-sm flex items-center justify-between border border-yellow-200 dark:border-yellow-800">
          <div>
            <p className="text-sm font-medium text-yellow-600 dark:text-yellow-300">Pending Tasks</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{pendingTasks}</p>
          </div>
          <CalendarDaysIcon className="h-10 w-10 text-yellow-400 dark:text-yellow-600" />
        </div>

        {/* Card 5: Interviewing Status */}
        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-lg shadow-sm flex items-center justify-between border border-indigo-200 dark:border-indigo-800">
          <div>
            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-300">Interviews Scheduled</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{interviewCount}</p>
          </div>
          <ClockIcon className="h-10 w-10 text-indigo-400 dark:text-indigo-600" />
        </div>

        {/* Card 6: ATS Score Average (Placeholder) */}
        <div className="bg-red-50 dark:bg-red-900/20 p-5 rounded-lg shadow-sm flex items-center justify-between border border-red-200 dark:border-red-800">
          <div>
            <p className="text-sm font-medium text-red-600 dark:text-red-300">Average ATS Score</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">N/A</p> {/* Implement calculation */}
          </div>
          <ChartBarIcon className="h-10 w-10 text-red-400 dark:text-red-600" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Applications */}
        <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Recent Applications</h3>
          {recentApplications.length > 0 ? (
            <ul className="space-y-3">
              {recentApplications.map(app => (
                <li key={app?.id} className="flex items-center space-x-3 bg-white dark:bg-gray-700 p-3 rounded-md shadow-xs">
                  <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-100">{app?.jobTitle} at {app?.companyName}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Applied on {isValidDate(app?.applicationDate) ? new Date(app.applicationDate).toLocaleDateString() : 'N/A'} - Status: {app?.status}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">No recent applications. Start applying for jobs!</p>
          )}
          <button
            onClick={() => setCurrentView('My Applications')}
            className="mt-5 text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
          >
            View all applications &rarr;
          </button>
        </div>

        {/* Top Search Keywords */}
        <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Top Search Keywords</h3>
          {topKeywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {topKeywords.map(keyword => (
                <span
                  key={keyword?.id}
                  className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm font-medium"
                >
                  {keyword?.term} ({keyword?.count})
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">No keywords tracked yet. Start searching for jobs!</p>
          )}
          <button
            onClick={() => setCurrentView('Find Jobs')}
            className="mt-5 text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
          >
            Go to Job Finder &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;