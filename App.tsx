import React, { useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import ResumeHub from './components/ResumeHub';
import JobFinder from './components/JobFinder';
import ApplicationGenerator from './components/ApplicationGenerator';
import MyApplications from './components/MyApplications';
// FIX: Changed import to named export for InterviewCoach as it is reported to have no default export.
import { InterviewCoach } from './components/InterviewCoach';
import ChatBot from './components/ChatBot';
import SavedJobs from './components/SavedJobs';
import TaskManager from './components/TaskManager';
import TailoredDocuments from './components/TailoredDocuments'; // New: Import TailoredDocuments
import { useAppContext } from './context/AppContext';
import introJs from 'intro.js';

const App: React.FC = () => {
  const { view, isNewUser, setIsNewUser, setView, error } = useAppContext(); // Get global error
  const introRef = useRef<introJs.IntroJs | null>(null);

  const startTour = useCallback(() => {
    // If a tour is already active, do nothing to avoid multiple instances
    if (introRef.current && introRef.current.isActive()) {
      return;
    }

    const intro = introJs();
    introRef.current = intro; // Store intro.js instance

    intro.setOptions({
      steps: [
        {
          element: document.querySelector('[data-step="welcome"]') || undefined,
          intro: "Welcome to JobPilot AI! Let's take a quick tour to show you around.",
          position: 'bottom',
        },
        {
          element: document.querySelector('[data-step="resume-hub-nav"]') || undefined,
          intro: "The Resume Hub is where you manage all your resumes and their versions. You can upload, parse, edit, and set a default resume here.",
          position: 'bottom',
        },
        {
          element: document.querySelector('[data-step="job-finder-nav"]') || undefined,
          intro: "Discover new opportunities! Use the Job Finder to search for jobs and apply filters tailored to your preferences.",
          position: 'bottom',
        },
        {
          element: document.querySelector('[data-step="applications-nav"]') || undefined,
          intro: "Keep track of all your applications here, from draft to offer. You can update statuses and review generated documents.",
          position: 'bottom',
        },
        {
          element: document.querySelector('[data-step="tailored-docs-nav"]') || undefined, // New: Tailored Docs step
          intro: "All your generated, tailored resumes and cover letters are saved and editable here.",
          position: 'bottom',
        },
        {
          element: document.querySelector('[data-step="dashboard-resumes"]') || undefined,
          intro: "Your dashboard provides a quick overview. This card shows your resume status and links to the Resume Hub.",
          position: 'top', // Adjust position for better visibility on dashboard cards
        },
        {
          element: document.querySelector('[data-step="dashboard-applications"]') || undefined,
          intro: "See your recent application activities and their statuses at a glance.",
          position: 'top', // Adjust position for better visibility on dashboard cards
        },
        {
          element: document.getElementById('chat-toggle-button') || undefined, // Target the chat button directly
          intro: "Need help? Our JobBot Assistant is always here to answer your career-related questions.",
          position: 'left',
        },
        {
          title: "That's it!",
          intro: "You're ready to supercharge your job search with JobPilot AI. Good luck!",
        },
      ],
      showButtons: true,
      showStepNumbers: false,
      exitOnOverlayClick: false,
      hidePrev: false, // Changed from true to false
      hideNext: false, // Changed from true to false
      nextLabel: 'Next &rarr;',
      prevLabel: '&larr; Back',
      doneLabel: 'Done',
      tooltipClass: 'jobpilot-intro-tooltip', // Add custom class for styling
    });

    intro.oncomplete(() => {
      setIsNewUser(false);
      introRef.current = null; // Clear instance on completion
    });

    intro.onexit(() => {
      setIsNewUser(false); // Mark as completed even if exited early
      introRef.current = null; // Clear instance on exit
    });

    intro.start();
  }, [setIsNewUser]); // Dependencies for useCallback

  useEffect(() => {
    // Only run tour if it's a new user and not already in progress
    if (isNewUser && !introRef.current) {
      // Add a small delay to ensure elements are rendered before starting the tour
      const timeoutId = setTimeout(() => {
        startTour();
      }, 500); // 500ms delay

      return () => clearTimeout(timeoutId); // Cleanup timeout on unmount
    }
  }, [isNewUser, startTour]); // Dependencies for useEffect

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
      case 'task-manager':
        return <TaskManager />;
      case 'tailored-docs': // New view for tailored documents
        return <TailoredDocuments />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      <Header startTour={startTour} />
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {renderView()}
      </main>
      <ChatBot />
      {error && (
        <p className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white py-2 px-4 rounded-lg shadow-lg z-50 animate-fade-in-up">
          {error}
        </p>
      )}
    </div>
  );
};

export default App;