import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false
  };

  static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  handleClearDataAndReload = () => {
    console.warn("Clearing application data due to a critical error.");
    try {
      const keysToRemove = [
        'currentView',
        'introEnabled',
        'savedJobs',
        'resumes',
        'currentResume',
        'applications',
        'tailoredDocuments',
        'tasks',
        'frequentlySearchedKeywords',
      ];
      keysToRemove.forEach(key => localStorage.removeItem(key));
      window.location.reload();
    } catch (e) {
      console.error("Failed to clear data:", e);
      alert("Could not clear data automatically. Please clear your browser's local storage for this site and refresh the page.");
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 text-gray-800">
          <div className="bg-white shadow-2xl rounded-lg p-8 max-w-lg text-center border-t-4 border-red-500">
            <h1 className="text-3xl font-bold text-red-600 mb-4">Application Error</h1>
            <p className="text-lg text-gray-700 mb-6">
              We are very sorry, but the application has encountered a critical error.
            </p>
            <button
              onClick={this.handleClearDataAndReload}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105"
            >
              Clear Data and Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;