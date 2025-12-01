import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Import AppProvider from AppContext.tsx
import { AppProvider } from './context/AppContext';
import ErrorBoundary from './components/ErrorBoundary';

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <App />
      </AppProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);