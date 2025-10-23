import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateResumeForJob, generateCoverLetterForJob, analyzeSkillGap, analyzeATSCompliance } from '../services/geminiService';
import { SkillGapAnalysis, Application } from '../types';
import { LoadingSpinner } from './icons';
import { downloadDocxFile, downloadElementAsPdf } from '../utils/fileUtils';

const ApplicationGenerator: React.FC = () => {
  const { generationContext, setGenerationContext, setApplications, setView } = useAppContext();
  
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
  const [error, setError] = useState<string | null>(null);

  const { job, baseResume } = generationContext || {};
  const atsReportRef = useRef<HTMLDivElement>(null);


  const runSkillAnalysis = useCallback(async () => {
    if (!job || !baseResume) return;
    setLoading(prev => ({ ...prev, analysis: true }));
    setError(null);
    try {
      const result = await analyzeSkillGap(job, baseResume);
      setSkillAnalysis(result);
    } catch (e: any) {
      setError(e.message || 'Failed to analyze skill gap.');
    } finally {
      setLoading(prev => ({ ...prev, analysis: false }));
    }
  }, [job, baseResume]);

  const runATSAnalysis = useCallback(async (resumeText: string) => {
    if (!job) return;
    setLoading(prev => ({ ...prev, ats: true }));
    try {
        const result = await analyzeATSCompliance(job, resumeText);
        setAtsScore(result);
    } catch (e: any) {
        setError(e.message || 'Failed to analyze ATS score.');
    } finally {
        setLoading(prev => ({ ...prev, ats: false }));
    }
  }, [job]);

  const runResumeGeneration = useCallback(async () => {
    if (!job || !baseResume) return;
    setLoading(prev => ({ ...prev, resume: true }));
    setError(null);
    setAtsScore(undefined); // Reset ATS score when regenerating
    try {
      const result = await generateResumeForJob(job, baseResume, customHeader);
      setGeneratedResume(result);
      await runATSAnalysis(result); // Run ATS analysis after resume is generated
    } catch (e: any) {
      setError(e.message || 'Failed to generate resume.');
    } finally {
      setLoading(prev => ({ ...prev, resume: false }));
    }
  }, [job, baseResume, customHeader, runATSAnalysis]);

  const runCoverLetterGeneration = useCallback(async () => {
    if (!job || !baseResume) return;
    setLoading(prev => ({ ...prev, coverLetter: true }));
    setError(null);
    try {
      const result = await generateCoverLetterForJob(job, baseResume, coverLetterTone, customHeader);
      setGeneratedCoverLetter(result);
    } catch (e: any) {
      setError(e.message || 'Failed to generate cover letter.');
    } finally {
      setLoading(prev => ({ ...prev, coverLetter: false }));
    }
  }, [job, baseResume, coverLetterTone, customHeader]);

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
    const newApplication: Application = {
      id: `app-${Date.now()}`,
      job: job,
      baseResumeId: baseResume.id,
      status: 'Draft',
      applicationDate: new Date().toISOString(),
      generatedResume: generatedResume,
      generatedCoverLetter: generatedCoverLetter,
      atsScore: atsScore,
    };
    setApplications(prev => [newApplication, ...prev]);
    setGenerationContext(null);
    setView('applications');
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
                    <div className={`text-5xl font-bold ${getScoreColor(atsScore.score)}`}>{atsScore.score}</div>
                    <p className="font-semibold">Match Score</p>
                    <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">{atsScore.feedback}</p>
                     <button onClick={() => downloadElementAsPdf('ats-report-card', `${job.company}-ATS-Report.pdf`)} className="mt-4 w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 font-bold py-2 px-4 rounded-lg text-sm">
                        Download Report
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
                </div>
            </div>
            <textarea readOnly value={generatedCoverLetter || 'Enter a custom header (optional), select a tone, and click "Generate" to create a cover letter.'} className="w-full h-96 p-3 border rounded-lg bg-gray-50 dark:bg-gray-700/50 font-mono text-sm" />
          </div>
        </div>
      </div>
      {error && <p className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-500 text-white py-2 px-4 rounded-lg shadow-lg">{error}</p>}
    </div>
  );
};

export default ApplicationGenerator;