import React, { useState, useEffect, useCallback } from 'react';
import { CompanyInsights, Job } from '../types';
import { getCompanyInsights } from '../services/geminiService';
import { LoadingSpinner } from './icons';
import { useAppContext } from '../context/AppContext';

interface CompanyInsightsDisplayProps {
  companyName: string;
  jobId: string; // Unique identifier for the job
  currentInsights?: CompanyInsights; // Existing insights from the job object
  onInsightsFetched: (insights: CompanyInsights) => void; // Callback to update the parent Job state
}

const CompanyInsightsDisplay: React.FC<CompanyInsightsDisplayProps> = ({
  companyName,
  jobId,
  currentInsights,
  onInsightsFetched,
}) => {
  const { setError: setGlobalError } = useAppContext();
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  
  // Use a local state for insights to manage immediate display,
  // but rely on `currentInsights` prop for the authoritative source after parent update.
  const [localInsights, setLocalInsights] = useState<CompanyInsights | undefined>(currentInsights);


  const fetchInsights = useCallback(async () => {
    // Only fetch if no insights are currently available for this job
    if (companyName && !localInsights) {
      setIsLoadingInsights(true);
      setInsightsError(null);
      try {
        const fetched = await getCompanyInsights(companyName);
        if (fetched) {
          setLocalInsights(fetched); // Update local state for immediate display
          onInsightsFetched(fetched); // Pass to parent to update the Job object
        } else {
          setInsightsError('No insights found for this company.');
          setLocalInsights(undefined);
        }
      } catch (e: any) {
        setInsightsError(e.message || 'Failed to load company insights.');
        setLocalInsights(undefined);
        setGlobalError('Company insights fetching failed: ' + (e.message || 'Unknown error.'));
      } finally {
        setIsLoadingInsights(false);
      }
    }
  }, [companyName, jobId, localInsights, onInsightsFetched, setGlobalError]); // Added jobId to dependencies for memoization, though it's technically not used in the body, it ensures useCallback updates if job changes.

  useEffect(() => {
    // Sync local state with prop, and trigger fetch if needed.
    // This handles cases where job changes, or if currentInsights initially empty.
    if (currentInsights !== localInsights) {
        setLocalInsights(currentInsights);
    }
    if (!currentInsights) { // Only fetch if the parent hasn't provided insights yet
      fetchInsights();
    }
  }, [companyName, jobId, currentInsights, localInsights, fetchInsights]);

  if (!companyName) {
    return null;
  }

  return (
    <div className="mt-8 pt-6 border-t dark:border-gray-700">
      <h4 className="font-bold text-lg mb-4">Company Insights for {companyName}</h4>
      {isLoadingInsights ? (
        <div className="flex justify-center items-center h-24">
          <LoadingSpinner className="w-6 h-6 text-blue-500" />
          <p className="ml-2 text-gray-600 dark:text-gray-400">Loading insights...</p>
        </div>
      ) : insightsError ? (
        <p className="text-red-500 text-sm">{insightsError}</p>
      ) : localInsights ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700 dark:text-gray-300">
          {localInsights.industry && (
            <p><span className="font-semibold">Industry:</span> {localInsights.industry}</p>
          )}
          {localInsights.size && (
            <p><span className="font-semibold">Size:</span> {localInsights.size}</p>
          )}
          {localInsights.headquarters && (
            <p><span className="font-semibold">Headquarters:</span> {localInsights.headquarters}</p>
          )}
          {localInsights.website && (
            <p>
              <span className="font-semibold">Website:</span>{' '}
              <a href={localInsights.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
                {new URL(localInsights.website).hostname}
              </a>
            </p>
          )}
          {localInsights.glassdoorRating && (
            <p>
              <span className="font-semibold">Glassdoor Rating:</span> {localInsights.glassdoorRating}{' '}
              {localInsights.glassdoorUrl && (
                <a href={localInsights.glassdoorUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
                  (View on Glassdoor)
                </a>
              )}
            </p>
          )}
          {localInsights.recentNews && localInsights.recentNews.length > 0 && (
            <div className="md:col-span-2">
              <p className="font-semibold mb-1">Recent News:</p>
              <ul className="list-disc list-inside space-y-1">
                {localInsights.recentNews.map((news, index) => (
                  <li key={index}>{news}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-gray-500 text-sm">No insights available.</p>
      )}
    </div>
  );
};

export default CompanyInsightsDisplay;