
import React, { useState, useEffect } from 'react';
// Import useAppContext from AppContext.tsx
import { useAppContext } from '../context/AppContext';
import { TailoredDocument, Resume, Job } from '../types';
import { ArrowDownTrayIcon, DocumentTextIcon, PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { downloadDocxFile } from '../utils/fileUtils';
import MarkdownRenderer from './MarkdownRenderer';

// Helper to safely format dates and prevent crashes from invalid date strings
const isValidDate = (date: any): boolean => {
  return date && !isNaN(new Date(date).getTime());
};

function TailoredDocuments() {
  const { tailoredDocuments, resumes, savedJobs, removeTailoredDocument, setCurrentView } = useAppContext();

  const [selectedDocument, setSelectedDocument] = useState<TailoredDocument | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'resume' | 'coverLetter'>('all');
  const [filterJobTitle, setFilterJobTitle] = useState('');

  const filteredDocuments = (tailoredDocuments || []).filter(doc => {
    // Defensive check for corrupted doc data
    if (!doc || !doc.type || !doc.jobTitle) return false;
    const matchesType = filterType === 'all' || doc.type === filterType;
    const matchesJobTitle = filterJobTitle ? doc.jobTitle?.toLowerCase().includes(filterJobTitle.toLowerCase()) : true;
    return matchesType && matchesJobTitle;
  });

  useEffect(() => {
    // Select the first doc if docs change and no doc is selected or selected doc is gone
    if ((tailoredDocuments?.length || 0) > 0 && (!selectedDocument || !tailoredDocuments?.some(d => d.id === selectedDocument.id))) {
      setSelectedDocument(filteredDocuments[0] || null);
    }
    if ((tailoredDocuments?.length || 0) === 0) {
      setSelectedDocument(null);
    }
  }, [tailoredDocuments, selectedDocument, filterType, filterJobTitle, filteredDocuments]); // Added filteredDocuments to dependencies

  const getJobTitle = (jobId: string) => {
    const job = (savedJobs || []).find(j => j.id === jobId);
    return job ? `${job.title} at ${job.company}` : 'Unknown Job';
  };

  const getResumeName = (resumeId: string) => {
    const resume = (resumes || []).find(r => r.id === resumeId);
    return resume ? resume.name : 'Unknown Resume';
  };

  return (
    <div className="tailored-documents-section bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 min-h-[70vh]">
      <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 text-center">Your Tailored Documents ({(tailoredDocuments?.length || 0)})</h2>

      {(tailoredDocuments?.length || 0) === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 text-lg mt-8">
          No tailored documents generated yet. Go to "Application Generator" to create some!
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Filters and Document List */}
          <div className="lg:col-span-1">
            <div className="mb-4 space-y-3">
              <input
                type="text"
                placeholder="Filter by Job Title"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 dark:text-white"
                value={filterJobTitle}
                onChange={(e) => setFilterJobTitle(e.target.value)}
              />
              <select
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 dark:text-white"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | 'resume' | 'coverLetter')}
              >
                <option value="all">All Types</option>
                <option value="resume">Resumes</option>
                <option value="coverLetter">Cover Letters</option>
              </select>
            </div>

            <ul className="space-y-3">
              {filteredDocuments.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 italic">No documents match your filters.</p>
              ) : (
                filteredDocuments.map(doc => (
                  <li
                    key={doc?.id}
                    className={`bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow hover:shadow-md transition-shadow duration-200 cursor-pointer border
                    ${selectedDocument?.id === doc?.id ? 'border-blue-500 dark:border-blue-400 shadow-xl' : 'border-gray-200 dark:border-gray-700'}`}
                    onClick={() => setSelectedDocument(doc)}
                  >
                    <p className="font-semibold text-gray-900 dark:text-white">{doc?.type === 'resume' ? 'Resume' : 'Cover Letter'} for {doc?.jobTitle}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Job: {getJobTitle(doc?.jobId)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Based on: {getResumeName(doc?.resumeId)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Generated: {isValidDate(doc?.generationDate) ? new Date(doc.generationDate).toLocaleDateString() : 'N/A'}</p>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Document Preview */}
          <div className="lg:col-span-2 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 min-h-[500px]">
            {selectedDocument ? (
              <>
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedDocument.type === 'resume' ? 'Tailored Resume' : 'Tailored Cover Letter'}</h3>
                    <p className="text-lg text-blue-600 dark:text-blue-400">{selectedDocument.jobTitle} at {selectedDocument.jobCompany}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => downloadDocxFile(selectedDocument.content, `${selectedDocument.jobCompany}-${selectedDocument.jobTitle}-${selectedDocument.type}.docx`)}
                      className="p-2 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-gray-700 dark:text-blue-300 dark:hover:bg-gray-600 transition-colors duration-200"
                      title="Download as DOCX"
                    >
                      <ArrowDownTrayIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => removeTailoredDocument && removeTailoredDocument(selectedDocument.id)}
                      className="p-2 rounded-full bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800 transition-colors duration-200"
                      title="Delete Document"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div className="prose dark:prose-invert max-w-none text-gray-800 dark:text-gray-200">
                  <MarkdownRenderer>{selectedDocument.content}</MarkdownRenderer>
                </div>
              </>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 mt-20 text-lg">Select a document from the left to preview.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TailoredDocuments;
