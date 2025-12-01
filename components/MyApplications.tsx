
import React, { useState, useEffect } from 'react';
// Import useAppContext from AppContext.tsx
import { useAppContext } from '../context/AppContext';
import { Application, Job, Resume, TailoredDocument } from '../types';
import { PencilSquareIcon, TrashIcon, EyeIcon, DocumentTextIcon, FolderOpenIcon } from '@heroicons/react/24/outline';


// Helper to safely format dates and prevent crashes from invalid date strings
const isValidDate = (date: any): boolean => {
  return date && !isNaN(new Date(date).getTime());
};


function MyApplications() {
  const {
    applications,
    updateApplication,
    removeApplication,
    savedJobs, // For linking to job details
    resumes, // For linking to resume details
    tailoredDocuments, // For linking to tailored documents
    setCurrentView, // For navigation
    // Fix: Destructure setCurrentResume here
    setCurrentResume,
  } = useAppContext();

  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [filterStatus, setFilterStatus] = useState<'All' | Application['status']>('All');
  const [filterJobTitle, setFilterJobTitle] = useState('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // --- Robust Job & Document Lookups ---
  // Create a comprehensive list of all known jobs from saved jobs and applications
  const allKnownJobs = [...(savedJobs || [])];
  (applications || []).forEach(app => {
    if (app && app.jobId && !allKnownJobs.some(j => j.id === app.jobId)) {
      // Create a placeholder job from the application data if it's not in savedJobs
      allKnownJobs.push({
        id: app.jobId,
        title: app.jobTitle,
        company: app.companyName,
        location: 'N/A',
        description: 'Full job details are not available for this job as it is not in your "Saved Jobs" list.',
        isSaved: false,
      } as Job); // Type assertion for placeholder
    }
  });

  const getJobDetails = (jobId: string) => allKnownJobs.find(job => job.id === jobId);
  const getResumeDetails = (resumeId: string) => (resumes || []).find(resume => resume.id === resumeId);
  const getTailoredDocumentDetails = (docId: string) => (tailoredDocuments || []).find(doc => doc.id === docId);
  // --- End Robust Lookups ---


  useEffect(() => {
    // Select the first application if applications array changes and no app is selected
    if (applications?.length > 0 && (!selectedApplication || !applications.some(app => app.id === selectedApplication.id))) {
      const sortedApps = [...applications].sort((a, b) => new Date(b?.applicationDate || 0).getTime() - new Date(a?.applicationDate || 0).getTime());
      setSelectedApplication(sortedApps[0]);
    } else if (applications?.length === 0) {
      setSelectedApplication(null);
    }
  }, [applications, selectedApplication]);

  useEffect(() => {
    if (selectedApplication) {
      setEditNotes(selectedApplication.notes || '');
    }
  }, [selectedApplication]);


  const filteredApplications = (applications || []).filter(app => {
    // Defensive check for corrupted app data
    if (!app || !app.status || !app.jobTitle) return false;
    const matchesStatus = filterStatus === 'All' || app.status === filterStatus;
    const matchesJobTitle = filterJobTitle ? app.jobTitle?.toLowerCase().includes(filterJobTitle.toLowerCase()) : true;
    return matchesStatus && matchesJobTitle;
  }).sort((a, b) => new Date(b?.applicationDate || 0).getTime() - new Date(a?.applicationDate || 0).getTime()); // Sort by most recent

  const handleUpdateStatus = (appId: string, newStatus: Application['status']) => {
    updateApplication(appId, { status: newStatus });
    if (selectedApplication && selectedApplication.id === appId) {
      setSelectedApplication(prev => prev ? { ...prev, status: newStatus } : null);
    }
  };

  const handleDeleteApplication = (appId: string) => {
    if (window.confirm('Are you sure you want to delete this application?')) {
      removeApplication(appId);
    }
  };

  const handleSaveNotes = () => {
    if (selectedApplication) {
      updateApplication(selectedApplication.id, { notes: editNotes });
      setSelectedApplication(prev => prev ? { ...prev, notes: editNotes } : null);
      setIsEditingNotes(false);
    }
  };

  const renderStatusBadge = (status: Application['status']) => {
    let colorClass = '';
    switch (status) {
      case 'Applied': colorClass = 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'; break;
      case 'Interviewing': colorClass = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'; break;
      case 'Offer': colorClass = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'; break;
      case 'Rejected': colorClass = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'; break;
      case 'Withdrawn': colorClass = 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'; break;
      default: colorClass = 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>{status}</span>;
  };

  return (
    <div className="applications-section bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 min-h-[70vh]">
      <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 text-center">Your Applications ({applications?.length || 0})</h2>

      {(applications?.length || 0) === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 text-lg mt-8">
          No applications tracked yet. Mark a job as applied in the "Application Generator" or "Saved Jobs"!
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Filters and Application List */}
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
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'All' | Application['status'])}
              >
                <option value="All">All Statuses</option>
                <option value="Applied">Applied</option>
                <option value="Interviewing">Interviewing</option>
                <option value="Offer">Offer</option>
                <option value="Rejected">Rejected</option>
                <option value="Withdrawn">Withdrawn</option>
              </select>
            </div>

            <ul className="space-y-3">
              {filteredApplications.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 italic">No applications match your filters.</p>
              ) : (
                filteredApplications.map(app => (
                  <li
                    key={app?.id}
                    className={`bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow hover:shadow-md transition-shadow duration-200 cursor-pointer border
                    ${selectedApplication?.id === app?.id ? 'border-blue-500 dark:border-blue-400 shadow-xl' : 'border-gray-200 dark:border-gray-700'}`}
                    onClick={() => setSelectedApplication(app)}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <p className="font-semibold text-gray-900 dark:text-white">{app?.jobTitle}</p>
                      {app?.status && renderStatusBadge(app.status)}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{app?.companyName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Applied: {isValidDate(app?.applicationDate) ? new Date(app.applicationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}</p>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Application Details Panel */}
          <div className="lg:col-span-2 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 min-h-[500px]">
            {selectedApplication ? (
              <>
                <div className="flex justify-between items-start mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedApplication.jobTitle}</h3>
                    <p className="text-lg text-blue-600 dark:text-blue-400">{selectedApplication.companyName}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Applied on: {isValidDate(selectedApplication.applicationDate) ? new Date(selectedApplication.applicationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</p>
                  </div>
                  <div className="flex space-x-2 items-center">
                    <select
                      value={selectedApplication.status}
                      onChange={(e) => handleUpdateStatus(selectedApplication.id, e.target.value as Application['status'])}
                      className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="Applied">Applied</option>
                      <option value="Interviewing">Interviewing</option>
                      <option value="Offer">Offer</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Withdrawn">Withdrawn</option>
                    </select>
                    <button
                      onClick={() => handleDeleteApplication(selectedApplication.id)}
                      className="p-2 rounded-full bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800 transition-colors duration-200"
                      title="Delete Application"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Notes Section */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">Notes</p>
                      <button
                        onClick={() => setIsEditingNotes(!isEditingNotes)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm flex items-center"
                      >
                        <PencilSquareIcon className="h-4 w-4 mr-1" /> {isEditingNotes ? 'Cancel' : 'Edit'}
                      </button>
                    </div>
                    {isEditingNotes ? (
                      <>
                        <textarea
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          rows={4}
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                        />
                        <button
                          onClick={handleSaveNotes}
                          className="mt-2 bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-3 rounded-md text-sm transition-colors duration-200"
                        >
                          Save Notes
                        </button>
                      </>
                    ) : (
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedApplication.notes || 'No notes yet.'}</p>
                    )}
                  </div>

                  {/* Related Documents */}
                  <div>
                    <p className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Documents</p>
                    <ul className="space-y-2">
                      {selectedApplication.appliedResumeId && (
                        <li>
                          <button
                            onClick={() => {
                              setCurrentResume(getResumeDetails(selectedApplication.appliedResumeId) || null);
                              setCurrentView('Resume Hub');
                            }}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center text-sm"
                          >
                            <FolderOpenIcon className="h-4 w-4 mr-1" /> Base Resume: {getResumeDetails(selectedApplication.appliedResumeId)?.name || 'N/A'}
                          </button>
                        </li>
                      )}
                      {selectedApplication.generatedResumeId && (
                        <li>
                          <button
                            onClick={() => setCurrentView('Tailored Docs')} // Navigate to Tailored Docs
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center text-sm"
                          >
                            <DocumentTextIcon className="h-4 w-4 mr-1" /> Tailored Resume: {getTailoredDocumentDetails(selectedApplication.generatedResumeId)?.jobTitle || 'N/A'}
                          </button>
                        </li>
                      )}
                      {selectedApplication.generatedCoverLetterId && (
                        <li>
                          <button
                            onClick={() => setCurrentView('Tailored Docs')} // Navigate to Tailored Docs
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center text-sm"
                          >
                            <DocumentTextIcon className="h-4 w-4 mr-1" /> Tailored Cover Letter: {getTailoredDocumentDetails(selectedApplication.generatedCoverLetterId)?.jobTitle || 'N/A'}
                          </button>
                        </li>
                      )}
                      <li>
                        <button
                            onClick={() => {
                              const job = getJobDetails(selectedApplication.jobId);
                              if (job) {
                                // For now, JobFinder doesn't have a direct "view job" mode,
                                // but we can simulate navigating there with the job URL or by setting a search.
                                // A more robust solution would be to enhance JobFinder to display a specific job.
                                alert(`Viewing job post for: ${job.title} at ${job.company}. (In a real app, this would navigate to JobFinder with the job selected)`);
                                // Or navigate to saved jobs and open it
                                setCurrentView('Saved Jobs');
                              }
                            }}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center text-sm"
                          >
                            <EyeIcon className="h-4 w-4 mr-1" /> View Original Job Post
                          </button>
                      </li>
                    </ul>
                  </div>

                  {/* ATS Feedback */}
                  {selectedApplication.atsScore !== undefined && selectedApplication.atsFeedback && (
                    <div>
                      <p className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">ATS Analysis</p>
                      <p className="text-blue-600 dark:text-blue-400 font-bold mb-1">Score: {selectedApplication.atsScore}/100</p>
                      <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md text-gray-700 dark:text-gray-300 text-sm">
                        <p className="font-medium">Feedback:</p>
                        <p className="whitespace-pre-wrap">{selectedApplication.atsFeedback}</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 mt-20 text-lg">
                Select an application from the left to view details.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MyApplications;