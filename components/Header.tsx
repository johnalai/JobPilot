import React from 'react';
import { useAppContext } from '../context/AppContext';
import { BriefcaseIcon, ResumeIcon, BookmarkIcon, ListUlIcon } from './icons';
import { View } from '../types';

type NavItem = {
    name: string;
    view: View;
    icon: React.ElementType;
    dataStep?: string; // New: Optional data-step for intro.js
};

const navItems: NavItem[] = [
    { name: 'Dashboard', view: 'dashboard', icon: BriefcaseIcon },
    { name: 'Resume Hub', view: 'resume-hub', icon: ResumeIcon, dataStep: 'resume-hub-nav' },
    { name: 'Find Jobs', view: 'job-finder', icon: BriefcaseIcon, dataStep: 'job-finder-nav' },
    { name: 'Saved Jobs', view: 'saved-jobs', icon: BookmarkIcon },
    { name: 'My Applications', view: 'applications', icon: BriefcaseIcon, dataStep: 'applications-nav' },
    { name: 'TaskManager', view: 'task-manager', icon: ListUlIcon },
];

interface HeaderProps {
    startTour: () => void; // Function to manually start the tour
}

const Header: React.FC<HeaderProps> = ({ startTour }) => {
    const { view, setView, isNewUser } = useAppContext();

    return (
        <header className="bg-white dark:bg-gray-800 shadow-md">
            <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <h1 className="text-2xl font-bold text-gray-800 dark:text-white" data-step="welcome">JobPilot AI</h1>
                        </div>
                    </div>
                    <div className="hidden md:flex items-center">
                        <div className="ml-10 flex items-baseline space-x-4">
                            {navItems.map((item) => (
                                <button
                                    key={item.name}
                                    onClick={() => setView(item.view)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                        view === item.view
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                                    data-step={item.dataStep ? item.dataStep : undefined}
                                >
                                    <item.icon className="w-5 h-5" />
                                    {item.name}
                                </button>
                            ))}
                        </div>
                        {/* Only show "Take Tour" if the user has completed the onboarding OR if the tour isn't active */}
                        {!isNewUser && (
                            <button
                                onClick={startTour}
                                className="ml-4 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                            >
                                Take Tour
                            </button>
                        )}
                    </div>
                </div>
            </nav>
        </header>
    );
};

export default Header;