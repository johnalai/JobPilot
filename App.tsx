
import React from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import ResumeHub from './components/ResumeHub';
import JobFinder from './components/JobFinder';
import ApplicationGenerator from './components/ApplicationGenerator';
import MyApplications from './components/MyApplications';
import InterviewCoach from './components/InterviewCoach';
import ChatBot from './components/ChatBot';
import SavedJobs from './components/SavedJobs';
import { useAppContext } from './context/AppContext';

const App: React.FC = () => {
  const { view } = useAppContext();

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return <Dashboard />;
      case 'resume-hub':
        return <ResumeHub />;
      case 'job-finder':
        return <JobFinder />;
      case 'application-generator':
        return <ApplicationGenerator />;
      case 'applications':
        return <MyApplications />;
      case 'interview-coach':
        return <InterviewCoach />;
      case 'saved-jobs':
        return <SavedJobs />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      <Header />
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {renderView()}
      </main>
      <ChatBot />
    </div>
  );
};

export default App;
