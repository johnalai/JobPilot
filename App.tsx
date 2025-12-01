import React, { useEffect, useRef, useState, useCallback } from 'react';
// Import useAppContext and AppContextType from AppContext.tsx
import { useAppContext } from './context/AppContext';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import ResumeHub from './components/ResumeHub';
import JobFinder from './components/JobFinder';
import MyApplications from './components/MyApplications';
import ApplicationGenerator from './components/ApplicationGenerator';
import InterviewCoach from './components/InterviewCoach';
import SavedJobs from './components/SavedJobs';
import ChatBot from './components/ChatBot';
// Replaced intro.js-react with direct usage for better stability
import introJs from 'intro.js';
import TailoredDocuments from './components/TailoredDocuments';
// Fix: Change named import to default import for TaskManager
import TaskManager from './components/TaskManager';
import ImageStudio from './components/ImageStudio';
import VideoStudio from './components/VideoStudio';

function App() {
  const {
    currentView,
    setCurrentView,
    introEnabled,
    setIntroEnabled,
    loadingState, // Consume the loading state from context
  } = useAppContext();

  const [tourEnabled, setTourEnabled] = useState(false);

  useEffect(() => {
    // Only enable tour if introEnabled is true
    if (introEnabled) {
      setTourEnabled(true);
    }
  }, [introEnabled]);

  const steps = [
    {
      element: '.header-nav-links',
      intro: 'Welcome to JobPilot AI! This is your main navigation. Click on any item to explore different features.',
      position: 'right',
    },
    {
      element: '.dashboard-welcome',
      intro: 'Your dashboard provides a quick overview of your job application process.',
      position: 'bottom',
    },
    {
      element: '.resume-upload-section',
      intro: 'In Resume Hub, you can upload and manage your resumes. Our AI can help you optimize them!',
      position: 'bottom',
    },
    {
      element: '.job-search-filters',
      intro: 'Find your dream job here! Use these filters to narrow down your search.',
      position: 'right',
    },
    {
      element: '.job-list-section',
      intro: 'Browse through job listings. Click on a job to see more details.',
      position: 'left',
    },
    {
      element: '.saved-jobs-section',
      intro: 'Keep track of jobs you\'re interested in. You can apply for them later or tailor your documents.',
      position: 'bottom',
    },
    {
      element: '.applications-section',
      intro: 'Manage all your job applications in one place. Update their status and track your progress.',
      position: 'bottom',
    },
    {
      element: '.tailored-documents-section',
      intro: 'Generate AI-powered tailored resumes and cover letters for specific jobs.',
      position: 'bottom',
    },
    {
      element: '.task-manager-section',
      intro: 'Organize your application tasks and deadlines effectively.',
      position: 'bottom',
    },
    {
      element: '.interview-coach-section',
      intro: 'Practice your interview skills with our AI coach and get personalized feedback.',
      position: 'bottom',
    },
    {
      element: '.chatbot-section',
      intro: 'Need help or have questions? Our AI chatbot is here to assist you with anything job-related!',
      position: 'left',
    },
    {
      element: '.image-studio-section',
      intro: 'Experiment with AI image generation and editing in the Image Studio.',
      position: 'bottom',
    },
    {
      element: '.video-studio-section',
      intro: 'Generate and edit videos with AI in the Video Studio.',
      position: 'bottom',
    },
    {
      element: '.header-user-menu',
      intro: 'Access user settings or logout from here.',
      position: 'left',
    },
    {
      element: 'body',
      intro: 'That\'s the quick tour! You can always restart it from the settings. Good luck with your job search!',
      position: 'center',
    },
  ];

  // Initialize and start tour when tourEnabled becomes true
  useEffect(() => {
    if (tourEnabled) {
      const intro = introJs();
      intro.setOptions({
        steps: steps,
        exitOnOverlayClick: false,
        disableInteraction: false,
        showStepNumbers: true,
        showBullets: false,
        nextLabel: 'Next >',
        prevLabel: '< Back',
        doneLabel: 'Finish',
      });

      const handleExit = () => {
        setTourEnabled(false);
        setIntroEnabled(false);
      };

      intro.onexit(handleExit);
      intro.oncomplete(handleExit);

      // Small timeout to ensure elements are rendered
      const timer = setTimeout(() => {
        try {
          intro.start();
        } catch (e) {
          console.warn('Intro.js failed to start:', e);
          handleExit();
        }
      }, 100);

      return () => {
        clearTimeout(timer);
        intro.exit(true); // Ensure tour is cleaned up
      };
    }
  }, [tourEnabled, steps, setIntroEnabled]);

  const renderView = useCallback(() => {
    switch (currentView) {
      case 'Dashboard':
        return <Dashboard />;
      case 'Resume Hub':
        return <ResumeHub />;
      case 'Find Jobs':
        return <JobFinder />;
      case 'Saved Jobs':
        return <SavedJobs />;
      case 'My Applications':
        return <MyApplications />;
      case 'Tailored Docs':
        return <TailoredDocuments />;
      case 'Application Generator': // This view is typically accessed via "My Applications"
        return <ApplicationGenerator />;
      case 'TaskManager':
        return <TaskManager />;
      case 'Interview Coach':
        return <InterviewCoach />;
      case 'ChatBot':
        return <ChatBot />;
      case 'Image Studio':
        return <ImageStudio />;
      case 'Video Studio':
        return <VideoStudio />;
      default:
        return <Dashboard />;
    }
  }, [currentView]);

  // CRITICAL FIX: Do not render the main app UI until the loading state is 'loaded'.
  // This prevents any component from accessing context data before it's ready.
  if (loadingState !== 'loaded') {
    // The loading/error UI is handled by AppProvider, so we render nothing here
    // to prevent any component from attempting to render and crash.
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white text-gray-900 dark:from-gray-900 dark:to-black dark:text-white transition-colors duration-300">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {renderView()}
      </main>
    </div>
  );
}

export default App;