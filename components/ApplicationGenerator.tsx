
import React, { useState, useEffect } from 'react';
// Import useAppContext from AppContext.tsx
import { useAppContext } from '../context/AppContext';
import { Job, Resume, TailoredDocument, Application } from '../types';
import { generateTailoredResume, analyzeATSCompliance, generateCoverLetterForJob, autoFixResume } from '../services/geminiService';
import { PlusIcon, DocumentTextIcon, ArrowDownTrayIcon, ArrowPathIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid'; // Added import
import { generateId, downloadDocxFile } from '../utils/fileUtils';
import MarkdownRenderer from './MarkdownRenderer';

function ApplicationGenerator() {
  const {
    savedJobs,
    resumes,
    currentResume,
    setCurrentResume,
    addTailoredDocument,
    applications,
    addApplication,
    updateApplication,
    setCurrentView,
    tailoredDocuments, // Added for existingApplication check
  } = useAppContext();

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedResumeId, setSelectedResumeId] = useState<string>(currentResume?.id || '');
  const [generateResumeLoading, setGenerateResumeLoading] = useState(false);
  const [generateCoverLetterLoading, setGenerateCoverLetterLoading] = useState(false);
  const [analyzeATSLoading, setAnalyzeATSLoading] = useState(false);
  const [autoFixLoading, setAutoFixLoading] = useState(false);
  const [resumeOutput, setResumeOutput] = useState<string | null>(null);
  const [coverLetterOutput, setCoverLetterOutput] = useState<string | null>(null);
  const [atsScore, setAtsScore] = useState<number | null>(null);
  const [atsFeedback, setAtsFeedback] = useState<string | null>(null);
  const [isApplicationApplied, setIsApplicationApplied] = useState(false); // Track if application has been 'applied'
  const [error, setError] = useState<string | null>(null);

  const selectedJob = savedJobs.find(job => job.id === selectedJobId);
  const baseResume = resumes.find(resume => resume.id === selectedResumeId);
  const existingApplication = applications.find(app => app.jobId === selectedJobId && app.appliedResumeId === selectedResumeId);

  useEffect(() => {
    // Set default resume if currentResume exists and no resume is selected
    if (currentResume && !selectedResumeId) {
      setSelectedResumeId(currentResume.id);
    } else if (!currentResume && resumes.length > 0) {
      // If no current resume, but some exist, make the first one current
      setCurrentResume(resumes[0]);
      setSelectedResumeId(resumes[0].id);
    }
  }, [currentResume, resumes, selectedResumeId, setCurrentResume]);

  useEffect(() => {
    // Reset outputs and ATS data when job or resume changes
    setResumeOutput(null);
    setCoverLetterOutput(null);
    setAtsScore(null);
    setAtsFeedback(null);
    setError(null);
    setIsApplicationApplied(false);

    // If an existing application is found for the selected job/resume, reflect its status
    if (existingApplication) {
      setIsApplicationApplied(true);
      // Optionally load generated docs if they exist in the application
      const genResume = existingApplication.generatedResumeId ? tailoredDocuments.find(d => d.id === existingApplication.generatedResumeId) : null;
      const genCoverLetter = existingApplication.generatedCoverLetterId ? tailoredDocuments.find(d => d.id === existingApplication.generatedCoverLetterId) : null;
      if (genResume) setResumeOutput(genResume.content);
      if (genCoverLetter) setCoverLetterOutput(genCoverLetter.content);
      if (existingApplication.atsScore) setAtsScore(existingApplication.atsScore);
      if (existingApplication.atsFeedback) setAtsFeedback(existingApplication.atsFeedback);
    }
  }, [selectedJobId, selectedResumeId, existingApplication, tailoredDocuments]);


  const handleGenerateResume = async () => {
    if (!selectedJob || !baseResume) {
      setError('Please select both a job and a base resume.');
      return;
    }
    setGenerateResumeLoading(true);
    setError(null);
    try {
      // Custom header example: contact info from normalized resume or a default
      const resumeContact = baseResume.normalizedContent?.contactInfo || { name: 'Your Name', email: 'your.email@example.com' };
      const customHeader = `# ${resumeContact.name}\n**Email**: ${resumeContact.email} ${resumeContact.phone ? `| **Phone**: ${resumeContact.phone}` : ''} ${resumeContact.linkedin ? `| **LinkedIn**: ${resumeContact.linkedin}` : ''}\n`;

      const generatedContent = await generateTailoredResume(
        baseResume.content,
        selectedJob.description,
        selectedJob.title,
        selectedJob.company,
        customHeader
      );
      if (generatedContent) {
        setResumeOutput(generatedContent);
        const newDoc: TailoredDocument = {
          id: generateId(),
          jobId: selectedJob.id,
          resumeId: baseResume.id,
          jobTitle: selectedJob.title,
          jobCompany: selectedJob.company,
          type: 'resume',
          content: generatedContent,
          generationDate: new Date().toISOString(),
        };
        addTailoredDocument(newDoc);
        // Link to existing or new application
        if (existingApplication) {
          updateApplication(existingApplication.id, { generatedResumeId: newDoc.id });
        }
      } else {
        setError('Failed to generate tailored resume.');
      }
    } catch (err) {
      console.error('Error generating resume:', err);
      setError('An error occurred while generating the resume. Please try again.');
    } finally {
      setGenerateResumeLoading(false);
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!selectedJob || !baseResume) {
      setError('Please select both a job and a base resume.');
      return;
    }
    setGenerateCoverLetterLoading(true);
    setError(null);
    try {
      const applicantName = baseResume.normalizedContent?.contactInfo?.name || 'Applicant Name';
      const applicantEmail = baseResume.normalizedContent?.contactInfo?.email || 'applicant@example.com';
      // Simple cover letter header
      const customHeader = `## ${applicantName}\n${applicantEmail}\n\n`;

      const generatedContent = await generateCoverLetterForJob(
        baseResume.content,
        selectedJob.description,
        selectedJob.title,
        selectedJob.company,
        applicantName,
        applicantEmail,
        customHeader
      );
      if (generatedContent) {
        setCoverLetterOutput(generatedContent);
        const newDoc: TailoredDocument = {
          id: generateId(),
          jobId: selectedJob.id,
          resumeId: baseResume.id,
          jobTitle: selectedJob.title,
          jobCompany: selectedJob.company,
          type: 'coverLetter',
          content: generatedContent,
          generationDate: new Date().toISOString(),
        };
        addTailoredDocument(newDoc);
        // Link to existing or new application
        if (existingApplication) {
          updateApplication(existingApplication.id, { generatedCoverLetterId: newDoc.id });
        }
      } else {
        setError('Failed to generate cover letter.');
      }
    } catch (err) {
      console.error('Error generating cover letter:', err);
      setError('An error occurred while generating the cover letter. Please try again.');
    } finally {
      setGenerateCoverLetterLoading(false);
    }
  };

  const handleAnalyzeATS = async () => {
    if (!selectedJob || !resumeOutput) {
      setError('Please generate a tailored resume first.');
      return;
    }
    setAnalyzeATSLoading(true);
    setError(null);
    try {
      const result = await analyzeATSCompliance(resumeOutput, selectedJob.description);
      if (result) {
        setAtsScore(result.score);
        setAtsFeedback(result.feedback);
        // Link to existing or new application
        if (existingApplication) {
          updateApplication(existingApplication.id, { atsScore: result.score, atsFeedback: result.feedback });
        }
      } else {
        setError('Failed to analyze ATS compliance.');
      }
    } catch (err) {
      console.error('Error analyzing ATS:', err);
      setError('An error occurred during ATS analysis.');
    } finally {
      setAnalyzeATSLoading(false);
    }
  };

  const handleAutoFix = async () => {
    if (!selectedJob || !resumeOutput || !atsFeedback) {
      setError('Need generated resume and ATS feedback to auto-fix.');
      return;
    }
    setAutoFixLoading(true);
    setError(null);
    try {
      const improvedContent = await autoFixResume(resumeOutput, selectedJob.description, atsFeedback);
      if (improvedContent) {
        setResumeOutput(improvedContent);
        alert('Resume auto-optimized based on feedback! Review the changes below.');
      } else {
        setError('Failed to auto-fix resume.');
      }
    } catch (err) {
      console.error('Auto-fix error:', err);
      setError('An error occurred during auto-fix.');
    } finally {
      setAutoFixLoading(false);
    }
  };

  const handleCreateApplication = () => {
    if (!selectedJob || !baseResume) return;
    
    const newApp: Application = {
      id: generateId(),
      jobId: selectedJob.id,
      jobTitle: selectedJob.title,
      companyName: selectedJob.company,
      applicationDate: new Date().toISOString(),
      status: 'Applied',
      appliedResumeId: baseResume.id,
      generatedResumeId: tailoredDocuments.find(d => d.jobId === selectedJob.id && d.type === 'resume')?.id,
      generatedCoverLetterId: tailoredDocuments.find(d => d.jobId === selectedJob.id && d.type === 'coverLetter')?.id,
      atsScore: atsScore || undefined,
      atsFeedback: atsFeedback || undefined,
    };

    addApplication(newApp);
    setIsApplicationApplied(true);
    setCurrentView('My Applications');
  };

  return (
    <div className="application-generator-section bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 min-h-[70vh]">
      <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 text-center">Generate Application Assets</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Select Job */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Select Target Job</label>
          <select
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 dark:text-white"
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
          >
            <option value="">-- Select a Saved Job --</option>
            {savedJobs.map(job => (
              <option key={job.id} value={job.id}>{job.title} at {job.company}</option>
            ))}
          </select>
        </div>

        {/* Select Resume */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Select Base Resume</label>
          <select
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 dark:text-white"
            value={selectedResumeId}
            onChange={(e) => setSelectedResumeId(e.target.value)}
          >
            <option value="">-- Select a Resume --</option>
            {resumes.map(resume => (
              <option key={resume.id} value={resume.id}>{resume.name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded-md relative mb-6">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap justify-center gap-4 mb-8">
        <button
          onClick={handleGenerateResume}
          disabled={generateResumeLoading || !selectedJobId || !selectedResumeId}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generateResumeLoading ? <ArrowPathIcon className="h-5 w-5 animate-spin mr-2" /> : <DocumentTextIcon className="h-5 w-5 mr-2" />}
          Generate Tailored Resume
        </button>
        <button
          onClick={handleGenerateCoverLetter}
          disabled={generateCoverLetterLoading || !selectedJobId || !selectedResumeId}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generateCoverLetterLoading ? <ArrowPathIcon className="h-5 w-5 animate-spin mr-2" /> : <DocumentTextIcon className="h-5 w-5 mr-2" />}
          Generate Cover Letter
        </button>
        <button
          onClick={handleAnalyzeATS}
          disabled={analyzeATSLoading || !resumeOutput}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg shadow flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {analyzeATSLoading ? <ArrowPathIcon className="h-5 w-5 animate-spin mr-2" /> : <SparklesIcon className="h-5 w-5 mr-2" />}
          Analyze ATS Score
        </button>
         {atsFeedback && (
          <button
            onClick={handleAutoFix}
            disabled={autoFixLoading}
            className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-6 rounded-lg shadow flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {autoFixLoading ? <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" /> : <SparklesIcon className="h-5 w-5 mr-2" />}
            Auto-Fix Resume
          </button>
        )}
      </div>

      {/* Results Display */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Tailored Resume */}
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Tailored Resume</h3>
            {resumeOutput && (
              <button
                onClick={() => downloadDocxFile(resumeOutput, `Tailored_Resume_${selectedJob?.company || 'Job'}.docx`)}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                title="Download DOCX"
              >
                <ArrowDownTrayIcon className="h-6 w-6" />
              </button>
            )}
          </div>
          {resumeOutput ? (
             <div className="prose dark:prose-invert max-w-none h-96 overflow-y-auto bg-white dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-700 text-sm">
                <MarkdownRenderer>{resumeOutput}</MarkdownRenderer>
             </div>
          ) : (
            <div className="h-96 flex items-center justify-center text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded">
              <p>Generated resume will appear here.</p>
            </div>
          )}
        </div>

        {/* Cover Letter */}
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Cover Letter</h3>
            {coverLetterOutput && (
              <button
                onClick={() => downloadDocxFile(coverLetterOutput, `Cover_Letter_${selectedJob?.company || 'Job'}.docx`)}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                title="Download DOCX"
              >
                <ArrowDownTrayIcon className="h-6 w-6" />
              </button>
            )}
          </div>
          {coverLetterOutput ? (
             <div className="prose dark:prose-invert max-w-none h-96 overflow-y-auto bg-white dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-700 text-sm">
                <MarkdownRenderer>{coverLetterOutput}</MarkdownRenderer>
             </div>
          ) : (
            <div className="h-96 flex items-center justify-center text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded">
               <p>Generated cover letter will appear here.</p>
            </div>
          )}
        </div>
      </div>

      {/* ATS Results Section */}
      {atsScore !== null && (
        <div className="mt-8 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg border-l-4 border-purple-600">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">ATS Compliance Analysis</h3>
          <div className="flex items-center mb-4">
            <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700 mr-4">
              <div className="bg-purple-600 h-4 rounded-full" style={{ width: `${atsScore}%` }}></div>
            </div>
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{atsScore}/100</span>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Feedback & Suggestions:</h4>
            <div className="text-gray-700 dark:text-gray-300 text-sm">
              <MarkdownRenderer>{atsFeedback || ''}</MarkdownRenderer>
            </div>
          </div>
        </div>
      )}

      {/* Final Action: Apply / Track */}
      <div className="mt-8 text-center">
         {!isApplicationApplied ? (
           <button
             onClick={handleCreateApplication}
             disabled={!resumeOutput}
             className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-lg shadow-xl text-lg flex items-center justify-center mx-auto transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
           >
             <CheckIcon className="h-6 w-6 mr-2" />
             Mark as Applied & Track Application
           </button>
         ) : (
           <div className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 p-4 rounded-lg inline-flex items-center">
             <CheckIcon className="h-6 w-6 mr-2" />
             Application Tracked Successfully!
           </div>
         )}
      </div>
    </div>
  );
}

export default ApplicationGenerator;
