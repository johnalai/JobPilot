
import React, { useState } from 'react';
// Import useAppContext from AppContext.tsx
import { useAppContext } from '../context/AppContext';
import { Cog6ToothIcon, CommandLineIcon, BuildingOffice2Icon, DocumentIcon, BriefcaseIcon, UserGroupIcon, HomeIcon, ArrowPathIcon, PhotoIcon, VideoCameraIcon } from '@heroicons/react/24/outline';
import { AppView } from '../types'; // Import AppView type

interface NavItem {
  name: string;
  icon: React.ElementType;
  view: AppView; // Explicitly type view as AppView
}

function Header() {
  const { currentView, setCurrentView, setIntroEnabled } = useAppContext();

  const navItems: NavItem[] = [ // Fix: Explicitly type navItems
    { name: 'Dashboard', icon: HomeIcon, view: 'Dashboard' },
    { name: 'Resume Hub', icon: DocumentIcon, view: 'Resume Hub' },
    { name: 'Find Jobs', icon: BriefcaseIcon, view: 'Find Jobs' },
    { name: 'Saved Jobs', icon: UserGroupIcon, view: 'Saved Jobs' },
    { name: 'My Applications', icon: BuildingOffice2Icon, view: 'My Applications' },
    { name: 'Tailored Docs', icon: DocumentIcon, view: 'Tailored Docs' },
    { name: 'TaskManager', icon: CommandLineIcon, view: 'TaskManager' },
    { name: 'Interview Coach', icon: CommandLineIcon, view: 'Interview Coach' },
    { name: 'ChatBot', icon: CommandLineIcon, view: 'ChatBot' },
    { name: 'Image Studio', icon: PhotoIcon, view: 'Image Studio' },
    { name: 'Video Studio', icon: VideoCameraIcon, view: 'Video Studio' },
  ];

  const handleRestartTour = () => {
    setIntroEnabled(true);
    setCurrentView('Dashboard'); // Optionally go to dashboard to start tour from a known point
  };

  return (
    <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg dark:from-gray-800 dark:to-gray-900 transition-colors duration-300">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo and Title */}
        <div className="flex items-center">
          <img src="/vite.svg" alt="JobPilot AI Logo" className="h-8 w-8 mr-3" />
          <h1 className="text-2xl font-bold tracking-wide">JobPilot AI</h1>
        </div>

        {/* Primary Navigation - Always Visible */}
        <nav className="header-nav-links flex flex-wrap justify-center flex-grow mx-4 gap-x-6 gap-y-2">
          {navItems.map((item) => (
            <a
              key={item.name}
              href="#"
              onClick={() => setCurrentView(item.view)}
              className={`flex items-center text-sm font-medium py-2 px-3 rounded-full transition-all duration-200
                          ${currentView === item.view
                  ? 'bg-white text-blue-700 shadow-md'
                  : 'text-white hover:bg-blue-500 hover:bg-opacity-75 dark:hover:bg-gray-700'
                }`}
              title={item.name}
            >
              <item.icon className="h-5 w-5 mr-2" />
              <span className="whitespace-nowrap">{item.name}</span>
            </a>
          ))}
        </nav>

        {/* Right side icons - Settings/User & Tour */}
        <div className="flex items-center space-x-4">
          <button
            onClick={handleRestartTour}
            className="p-2 rounded-full hover:bg-blue-500 hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-white dark:hover:bg-gray-700"
            title="Start Interactive Tour"
          >
            <ArrowPathIcon className="h-6 w-6" />
          </button>

          {/* Settings/User Icon */}
          <button
            className="p-2 rounded-full hover:bg-blue-500 hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-white dark:hover:bg-gray-700"
            title="Settings / User"
          >
            <Cog6ToothIcon className="h-6 w-6" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
