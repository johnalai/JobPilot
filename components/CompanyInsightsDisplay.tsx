
import React from 'react';
import { CompanyInsights } from '../types';
import { LinkIcon, BuildingOfficeIcon, GlobeAltIcon, UserGroupIcon, AcademicCapIcon, PlusCircleIcon, MinusCircleIcon } from '@heroicons/react/24/outline';

interface CompanyInsightsDisplayProps {
  companyInsights: CompanyInsights | null;
}

function CompanyInsightsDisplay({ companyInsights }: CompanyInsightsDisplayProps) {
  if (!companyInsights) {
    return (
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Company Insights</h4>
        <p className="text-gray-500 dark:text-gray-400">Could not extract complete company insights. Please provide more context or try another input.</p>
      </div>
    );
  }

  const isValidUrl = (url: string | undefined): boolean => {
    if (!url) return false;
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  };

  const renderLink = (url: string | undefined, IconComponent: React.ElementType, text: string) => {
    if (!isValidUrl(url)) return null;
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center text-sm mr-4">
        <IconComponent className="h-4 w-4 mr-1" />
        {text}
      </a>
    );
  };

  return (
    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
      <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
        <BuildingOfficeIcon className="h-6 w-6 mr-2 text-blue-600 dark:text-blue-400" />
        Company Insights: {companyInsights.companyName}
      </h4>

      <div className="mb-4 flex flex-wrap items-center">
        {renderLink(companyInsights.website, GlobeAltIcon, 'Website')}
        {renderLink(companyInsights.linkedinProfile, LinkIcon, 'LinkedIn')}
        {renderLink(companyInsights.crunchbaseProfile, LinkIcon, 'Crunchbase')}
        {companyInsights.glassdoorRating && (
          <span className="text-gray-700 dark:text-gray-300 text-sm flex items-center">
            <UserGroupIcon className="h-4 w-4 mr-1" />
            Glassdoor: {companyInsights.glassdoorRating} / 5
          </span>
        )}
      </div>

      {companyInsights.overview && (
        <div className="mb-4">
          <h5 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center mb-1">
            <AcademicCapIcon className="h-5 w-5 mr-2" />
            Overview
          </h5>
          <p className="text-gray-700 dark:text-gray-300">{companyInsights.overview}</p>
        </div>
      )}

      {companyInsights.culture && (
        <div className="mb-4">
          <h5 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center mb-1">
            <UserGroupIcon className="h-5 w-5 mr-2" />
            Culture
          </h5>
          <p className="text-gray-700 dark:text-gray-300">{companyInsights.culture}</p>
        </div>
      )}

      {companyInsights.productsAndServices && (
        <div className="mb-4">
          <h5 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center mb-1">
            <BuildingOfficeIcon className="h-5 w-5 mr-2" />
            Products & Services
          </h5>
          <p className="text-gray-700 dark:text-gray-300">{companyInsights.productsAndServices}</p>
        </div>
      )}

      {companyInsights.pros && companyInsights.pros.length > 0 && (
        <div className="mb-4">
          <h5 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center mb-1">
            <PlusCircleIcon className="h-5 w-5 mr-2 text-green-500" />
            Pros
          </h5>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300">
            {companyInsights.pros.map((pro, index) => (
              <li key={index}>{pro}</li>
            ))}
          </ul>
        </div>
      )}

      {companyInsights.cons && companyInsights.cons.length > 0 && (
        <div className="mb-4">
          <h5 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center mb-1">
            <MinusCircleIcon className="h-5 w-5 mr-2 text-red-500" />
            Cons
          </h5>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300">
            {companyInsights.cons.map((con, index) => (
              <li key={index}>{con}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default CompanyInsightsDisplay;
