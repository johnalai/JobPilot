
import React from 'react';
// FIX: Use relative paths for imports from other directories.
import { useAppContext } from '../context/AppContext';
import { BriefcaseIcon, ResumeIcon, BookmarkIcon } from './icons';
import { View } from '../types';

type NavItem = {
    name: string;
    view: View;
    icon: React.ElementType;
};

const navItems: NavItem[] = [
    { name: 'Dashboard', view: 'dashboard', icon: BriefcaseIcon },
    { name: 'Resume Hub', view: 'resume-hub', icon: ResumeIcon },
    { name: 'Find Jobs', view: 'job-finder', icon: BriefcaseIcon },
    { name: 'Saved Jobs', view: 'saved-jobs', icon: BookmarkIcon },
    { name: 'My Applications', view: 'applications', icon: BriefcaseIcon },
];

const Header: React.FC = () => {
    const { view, setView } = useAppContext();

    return (
        <header className="bg-white dark:bg-gray-800 shadow-md">
            <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">JobPilot AI</h1>
                        </div>
                    </div>
                    <div className="hidden md:block">
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
                                >
                                    <item.icon className="w-5 h-5" />
                                    {item.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </nav>
        </header>
    );
};

export default Header;
