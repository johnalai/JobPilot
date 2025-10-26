import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateResumeForJob, generateCoverLetterForJob, analyzeSkillGap, analyzeATSCompliance } from '../services/geminiService';
import { SkillGapAnalysis, Application, TailoredDocument, TailoredDocumentType } from '../types';
import { LoadingSpinner } from './icons';
import { downloadDocxFile } from '../utils/fileUtils';

const ApplicationGenerator: React.FC = () => {
  const { generationContext, setGenerationContext, setApplications, setView, setError, setTailoredDocuments } = useAppContext(); // Get global setError and setTailoredDocuments
  
  const [generatedResume, setGeneratedResume] = useState<string>('');
  const [generatedCoverLetter, setGeneratedCoverLetter] = useState<string>('');
  const [skillAnalysis, setSkillAnalysis] = useState<SkillGapAnalysis | null>(null);
  const [atsScore, setAtsScore] = useState<Application['atsScore'] | undefined>(undefined);
  const [coverLetterTone, setCoverLetterTone] = useState('Professional and enthusiastic');
  const [customHeader, setCustomHeader] = useState('');

  const [loading, setLoading] = useState({
    analysis: false,
    resume: false,
    coverLetter: false,
    ats: false,
  });
  const [isSavingGenerated, setIsSavingGenerated] = useState(false); // New state for saving generated documents

  const { job, baseResume } = generationContext || {};
  const atsReportRef = useRef<HTMLDivElement>(null);


  const runSkillAnalysis = useCallback(async () => {
    if (!job || !baseResume) return;
    setLoading(prev => ({ ...prev, analysis: true }));
    setError(null); // Clear global error
    try {
      const result = await analyzeSkillGap(job, baseResume.activeContent);
      setSkillAnalysis(result);
    } catch (e: any) {
      setError(e.message || 'Failed to analyze skill gap.'); // Set global error
    } finally {
      setLoading(prev => ({ ...prev, analysis: false }));
    }
  }, [job, baseResume, skillAnalysis, setError]);

  const runATSAnalysis = useCallback(async (resumeText: string) => {
    if (!job) return;
    setLoading(prev => ({ ...prev, ats: true }));
    setError(null); // Clear global error
    try {
        const result = await analyzeATSCompliance(job, resumeText);
        setAtsScore(result);
    } catch (e: any) {
        setError(e.message || 'Failed to analyze ATS score.'); // Set global error
    } finally {
        setLoading(prev => ({ ...prev, ats: false }));
    }
  }, [job, setError]);

  const runResumeGeneration = useCallback(async () => {
    if (!job || !baseResume) return;
    setLoading(prev => ({ ...prev, resume: true }));
    setError(null); // Clear global error
    setAtsScore(undefined); // Reset ATS score when regenerating
    try {
      const result = await generateResumeForJob(job, baseResume.activeContent, customHeader);
      setGeneratedResume(result);
      await runATSAnalysis(result); // Run ATS analysis after resume is generated
    } catch (e: any) {
      setError(e.message || 'Failed to generate resume.'); // Set global error
    } finally {
      setLoading(prev => ({ ...prev, resume: false }));
    }
  }, [job, baseResume, customHeader, runATSAnalysis, setError]);

  const runCoverLetterGeneration = useCallback(async () => {
    if (!job || !baseResume) return;
    setLoading(prev => ({ ...prev, coverLetter: true }));
    setError(null); // Clear global error
    try {
      const result = await generateCoverLetterForJob(job, baseResume.activeContent, coverLetterTone, customHeader);
      setGeneratedCoverLetter(result);
    } catch (e: any) {
      setError(e.message || 'Failed to generate cover letter.'); // Set global error
    } finally {
      setLoading(prev => ({ ...prev, coverLetter: false }));
    }
  }, [job, baseResume, coverLetterTone, customHeader, setError]);

  // Updated: Function to save generated documents to tailoredDocuments
  const handleSaveGeneratedDocument = async (documentContent: string, documentType: TailoredDocumentType) => {
    if (!documentContent.trim()) {
      setError(`No ${documentType} content to save.`);
      console.log(`Attempted to save empty ${documentType}. Content was: "${documentContent}"`);
      return;
    }
    if (!job) {
      setError(`Cannot save ${documentType}: job context is missing.`);
      return;
    }

    setIsSavingGenerated(true);
    setError(null);

    try {
      const newTailoredDocument: TailoredDocument = {
        id: `tailored-${documentType}-${Date.now()}`,
        name: `${documentType === 'resume' ? 'Tailored Resume' : 'Cover Letter'} for ${job.title} at ${job.company}`,
        type: documentType,
        content: documentContent,
        jobId: job.id,
        jobTitle: job.title,
        jobCompany: job.company,
        generationDate: Date.now(),
      };

      setTailoredDocuments(prev => [...prev, newTailoredDocument]);
      setError(`Successfully saved new ${documentType} to Tailored Documents!`);
      console.log(`Saved new ${documentType}. Content preview: "${documentContent.substring(0, 100)}..."`);
      // Optionally, navigate to Tailored Docs after saving
      setView('tailored-docs');

    } catch (e: any) {
      setError(`Failed to save ${documentType}: ${e.message || 'Unknown error.'}`);
      console.error(`Error saving ${documentType}:`, e);
    } finally {
      setIsSavingGenerated(false);
    }
  };


  useEffect(() => {
    // Automatically run skill analysis when component loads with context
    if (job && baseResume && !skillAnalysis) {
      runSkillAnalysis();
    }
  }, [job, baseResume, skillAnalysis, runSkillAnalysis]);

  if (!generationContext || !job || !baseResume) {
    return (
      <div className="text-center">
        <p>No job selected. Please go to 'Find Jobs' to start an application.</p>
        <button onClick={() => setView('job-finder')} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
          Find Jobs
        </button>
      </div>
    );
  }

  const handleSaveApplication = () => {
    // Create new TailoredDocuments for the generated resume/cover letter if they exist
    const newTailoredDocs: TailoredDocument[] = [];
    let generatedResumeDocId: string | undefined;
    let generatedCoverLetterDocId: string | undefined;

    if (generatedResume.trim()) {
      const resumeDoc: TailoredDocument = {
        id: `tailored-resume-${Date.now()}-app`,
        name: `Resume for ${job.title} at ${job.company} (Application)`,
        type: 'resume',
        content: generatedResume,
        jobId: job.id,
        jobTitle: job.title,
        jobCompany: job.company,
        generationDate: Date.now(),
      };
      newTailoredDocs.push(resumeDoc);
      generatedResumeDocId = resumeDoc.id;
    }

    if (generatedCoverLetter.trim()) {
      const coverLetterDoc: TailoredDocument = {
        id: `tailored-coverletter-${Date.now()}-app`,
        name: `Cover Letter for ${job.title} at ${job.company} (Application)`,
        type: 'coverLetter',
        content: generatedCoverLetter,
        jobId: job.id,
        jobTitle: job.title,
        jobCompany: job.company,
        generationDate: Date.now(),
      };
      newTailoredDocs.push(coverLetterDoc);
      generatedCoverLetterDocId = coverLetterDoc.id;
    }

    // Add new tailored docs to global state
    if (newTailoredDocs.length > 0) {
      setTailoredDocuments(prev => [...prev, ...newTailoredDocs]);
    }

    const newApplication: Application = {
      id: `app-${Date.now()}`,
      job: job,
      baseResumeId: baseResume.id,
      status: 'Draft',
      applicationDate: new Date().toISOString(),
      generatedResumeId: generatedResumeDocId, // Store ID instead of content
      generatedCoverLetterId: generatedCoverLetterDocId, // Store ID instead of content
      atsScore: atsScore,
    };
    setApplications(prev => [newApplication, ...prev]);
    setGenerationContext(null);
    setView('applications');
    setError('Application saved successfully with generated documents!');
  };
  
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-500';
    if (score >= 70) return 'text-yellow-500';
    return 'text-red-500';
  };


  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold">Application Generator</h2>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
          Tailoring application for <strong>{job.title}</strong> at <strong>{job.company}</strong>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Skill Analysis & Actions */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Skill Gap Analysis</h3>
            {loading.analysis ? <LoadingSpinner className="w-8 h-8 mx-auto" /> :
              skillAnalysis ? (
                <div className="space-y-4 text-sm">
                  <div>
                    <h4 className="font-bold text-green-600 dark:text-green-400">Matching Skills</h4>
                    <ul className="list-disc list-inside">{skillAnalysis.matchingSkills.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                   <div>
                    <h4 className="font-bold text-yellow-600 dark:text-yellow-400">Missing Skills</h4>
                    <ul className="list-disc list-inside">{skillAnalysis.missingSkills.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                   <div>
                    <h4 className="font-bold text-blue-600 dark:text-blue-400">Suggestions</h4>
                    <ul className="list-disc list-inside">{skillAnalysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                </div>
              ) : <p>Analysis could not be performed.</p>
            }
          </div>

          <div id="ats-report-card" className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-semibold mb-4">ATS Compliance Report</h3>
            {loading.ats ? <LoadingSpinner className="w-8 h-8 mx-auto" /> :
              atsScore ? (
                <div className="text-center">
                    <div className="relative w-32 h-32 mx-auto mb-4" aria-label={`ATS Score: ${atsScore.score} percent`}>
                        <svg className="w-full h-full" viewBox="0 0 100 100">
                            {/* Background circle */}
                            <circle className="text-gray-200 dark:text-gray-700" strokeWidth="10" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" />
                            {/* Progress circle */}
                            <circle className={`${getScoreColor(atsScore.score)} transition-all duration-1000 ease-out`} strokeWidth="10" strokeDasharray={2 * Math.PI * 45} strokeDashoffset={(2 * Math.PI * 45) - (atsScore.score / 100) * (2 * Math.PI * 45)} strokeLinecap="round" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" transform="rotate(-90 50 50)" />
                        </svg>
                        <div className={`absolute inset-0 flex items-center justify-center text-3xl font-bold ${getScoreColor(atsScore.score)}`}>{atsScore.score}</div>
                    </div>
                    <p className="font-semibold">Match Score</p>
                    <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">{atsScore.feedback}</p>

                    {atsScore.missingKeywords && atsScore.missingKeywords.length > 0 && (
                        <div className="mt-4 text-left border-t pt-4 dark:border-gray-700">
                            <h4 className="font-bold text-red-600 dark:text-red-400">Missing Keywords from Job Description:</h4>
                            <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300">
                                {atsScore.missingKeywords.map((keyword, i) => (
                                    <li key={i}>{keyword}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {atsScore.integrationSuggestions && atsScore.integrationSuggestions.length > 0 && (
                        <div className="mt-4 text-left">
                            <h4 className="font-bold text-blue-600 dark:text-blue-400">Suggestions for Integration:</h4>
                            <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300">
                                {atsScore.integrationSuggestions.map((suggestion, i) => (
                                    <li key={i}>{suggestion}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {atsScore.jargonCheck && (
                        <div className="mt-4 text-left">
                            <h4 className="font-bold text-purple-600 dark:text-purple-400">Industry Jargon Assessment:</h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{atsScore.jargonCheck}</p>
                        </div>
                    )}

                     <button onClick={() => downloadDocxFile(`${job.company}-${job.title}-ATS-Report.docx`, atsReportRef.current?.innerText || '')} className="mt-4 w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 font-bold py-2 px-4 rounded-lg text-sm">
                        Download Report (DOCX)
                    </button>
                </div>
              ) : <p className="text-sm text-gray-500 text-center">Generate a resume to see the ATS report.</p>
            }
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Actions</h3>
            <div className="space-y-4">
              <button onClick={handleSaveApplication} disabled={!generatedResume && !generatedCoverLetter} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50">
                Save Application
              </button>
              <button onClick={() => setView('job-finder')} className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg">
                Back to Jobs
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Resume & Cover Letter */}
        <div className="lg:col-span-2 space-y-8">
           <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
              <label htmlFor="customHeader" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Custom Document Header (Optional)
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">This header will be applied to both the resume and cover letter.</p>
              <textarea
                id="customHeader"
                value={customHeader}
                onChange={(e) => setCustomHeader(e.target.value)}
                placeholder={"Your Name\n123 Main St, Anytown, USA\n(123) 456-7890 | your.email@example.com"}
                className="w-full h-24 p-3 border rounded-lg bg-gray-50 dark:bg-gray-700/50 font-mono text-sm"
              />
            </div>
          {/* Tailored Resume */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Tailored Resume</h3>
                <div className="flex gap-2">
                    <button onClick={runResumeGeneration} disabled={loading.resume || loading.ats} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50">
                        {loading.resume ? <LoadingSpinner className="w-5 h-5" /> : 'Generate'}
                    </button>
                    <button onClick={() => downloadDocxFile(`${job.company}-${job.title}-Resume.docx`, generatedResume)} disabled={!generatedResume} className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50">
                        Download DOCX
                    </button>
                    <button onClick={() => handleSaveGeneratedDocument(generatedResume, 'resume')} disabled={!generatedResume || isSavingGenerated} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50">
                        {isSavingGenerated ? <LoadingSpinner className="w-5 h-5" /> : 'Save to Tailored Docs'}
                    </button>
                </div>
            </div>
            <textarea readOnly value={generatedResume || 'Enter a custom header (optional) and click "Generate" to create a resume tailored for this job.'} className="w-full h-96 p-3 border rounded-lg bg-gray-50 dark:bg-gray-700/50 font-mono text-sm" />
          </div>

          {/* Cover Letter */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Cover Letter</h3>
                <div className="flex gap-2 items-center">
                    <select value={coverLetterTone} onChange={e => setCoverLetterTone(e.target.value)} className="text-sm rounded-lg bg-gray-50 dark:bg-gray-700/50 p-2 border">
                        <option>Professional and enthusiastic</option>
                        <option>Formal and direct</option>
                        <option>Creative and passionate</option>
                    </select>
                    <button onClick={runCoverLetterGeneration} disabled={loading.coverLetter} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50">
                        {loading.coverLetter ? <LoadingSpinner className="w-5 h-5" /> : 'Generate'}
                    </button>
                    <button onClick={() => downloadDocxFile(`${job.company}-${job.title}-CoverLetter.docx`, generatedCoverLetter)} disabled={!generatedCoverLetter} className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50">
                        Download DOCX
                    </button>
                    <button onClick={() => handleSaveGeneratedDocument(generatedCoverLetter, 'coverLetter')} disabled={!generatedCoverLetter || isSavingGenerated} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50">
                        {isSavingGenerated ? <LoadingSpinner className="w-5 h-5" /> : 'Save to Tailored Docs'}
                    </button>
                </div>
            </div>
            <textarea readOnly value={generatedCoverLetter || 'Enter a custom header (optional), select a tone, and click "Generate" to create a cover letter.'} className="w-full h-96 p-3 border rounded-lg bg-gray-50 dark:bg-gray-700/50 font-mono text-sm" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplicationGenerator;