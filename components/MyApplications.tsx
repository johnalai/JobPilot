
import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Application, ApplicationStatus } from '../types';
import { TrashIcon } from './icons';

const MyApplications: React.FC = () => {
  const { applications, setApplications, setView, setSelectedApplicationForInterview } = useAppContext();
  const [selectedApp, setSelectedApp] = useState<Application | null>(applications.length > 0 ? applications[0] : null);

  const handleDelete = (id: string) => {
    setApplications(prev => prev.filter(app => app.id !== id));
    if (selectedApp?.id === id) {
        setSelectedApp(null);
    }
  };
  
  const handleStatusChange = (id: string, newStatus: ApplicationStatus) => {
      setApplications(prev => prev.map(app => app.id === id ? { ...app, status: newStatus } : app));
      if (selectedApp?.id === id) {
          setSelectedApp(prev => prev ? { ...prev, status: newStatus } : null);
      }
  };

  const handlePractice = (app: Application) => {
      setSelectedApplicationForInterview(app);
      setView('interview-coach');
  };
  
  const renderAppDetails = (app: Application) => (
      <div className="p-6 h-full flex flex-col">
          <h3 className="text-2xl font-bold">{app.job.title}</h3>
          <p className="text-lg text-blue-600 dark:text-blue-400">{app.job.company}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{app.job.location}</p>
          <div className="mt-4">
              <label htmlFor="status" className="block text-sm font-medium">Status:</label>
              <select 
                id="status"
                value={app.status} 
                onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                  <option>Draft</option>
                  <option>Submitted</option>
                  <option>Interviewing</option>
                  <option>Offer</option>
                  <option>Rejected</option>
              </select>
          </div>
          <div className="mt-4">
            <h4 className="font-semibold">Generated Assets</h4>
            <div className="flex gap-4 mt-2">
                <button disabled={!app.generatedResume} className="text-sm font-semibold bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 py-2 px-4 rounded-lg disabled:opacity-50">View Resume</button>
                <button disabled={!app.generatedCoverLetter} className="text-sm font-semibold bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 py-2 px-4 rounded-lg disabled:opacity-50">View Cover Letter</button>
            </div>
          </div>
          <div className="mt-auto pt-4 border-t dark:border-gray-700">
              <button onClick={() => handlePractice(app)} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg">
                  Practice Interview
              </button>
          </div>
      </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-white">My Applications</h2>
      <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">Track the status of all your job applications.</p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8" style={{ minHeight: '60vh' }}>
        <div className="md:col-span-1 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg h-full overflow-y-auto">
          {applications.length === 0 ? (
            <p className="text-center text-gray-500 pt-4">No applications tracked yet.</p>
          ) : (
            <ul className="space-y-2">
              {applications.map(app => (
                <li key={app.id} onClick={() => setSelectedApp(app)}
                  className={`p-4 rounded-lg cursor-pointer transition-colors border-2 ${selectedApp?.id === app.id ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-500' : 'bg-gray-50 dark:bg-gray-700/50 border-transparent hover:border-blue-400'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold">{app.job.title}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{app.job.company}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(app.id); }} className="text-gray-500 hover:text-red-600 p-1 rounded-full">
                        <TrashIcon className="w-4 h-4"/>
                    </button>
                  </div>
                  <span className={`mt-2 inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                      app.status === 'Submitted' ? 'bg-green-200 text-green-800' :
                      app.status === 'Interviewing' ? 'bg-yellow-200 text-yellow-800' :
                      app.status === 'Offer' ? 'bg-blue-200 text-blue-800' :
                      app.status === 'Rejected' ? 'bg-red-200 text-red-800' :
                      'bg-gray-200 text-gray-800'
                  }`}>{app.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
          {selectedApp ? renderAppDetails(selectedApp) : (
            <div className="flex justify-center items-center h-full">
              <p className="text-gray-500 dark:text-gray-400">Select an application to see details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyApplications;
