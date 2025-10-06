// src/components/common/LoadingSpinner.jsx
import React, { useState, useEffect } from 'react';
import supabase from '../../config/supabaseClient';

const LoadingSpinner = ({ timeout = 10000 }) => {
  const [loadingTooLong, setLoadingTooLong] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    // Set a timeout to show error message if loading takes too long
    const timer = setTimeout(() => {
      setLoadingTooLong(true);
      // Try to get some debug info
      checkConnectionStatus();
    }, timeout);

    return () => clearTimeout(timer);
  }, [timeout]);

  const checkConnectionStatus = async () => {
    try {
      // Check session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      // Check database connectivity
      const { error: dbError } = await supabase
        .from('profiles')
        .select('count', { count: 'exact', head: true })
        .limit(1);

      setDebugInfo({
        sessionPresent: sessionData?.session ? true : false,
        sessionError: sessionError ? sessionError.message : null,
        dbConnected: !dbError,
        dbError: dbError ? dbError.message : null,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      setDebugInfo({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleRetry = () => {
    window.location.reload();
  };

  const handleReturnToLogin = () => {
    // Clear any potentially corrupted state
    localStorage.removeItem('supabase.auth.token');
    // In case the localStorage clear doesn't work with how Supabase is configured
    supabase.auth.signOut().then(() => {
      window.location.href = '/login';
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md max-w-md w-full text-center">
        {!loadingTooLong ? (
          <>
            <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-lg font-medium text-gray-700">Loading...</p>
            <p className="mt-2 text-sm text-gray-500">Please wait while we set things up.</p>
          </>
        ) : (
          <>
            <div className="text-amber-500 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Taking longer than expected...</h3>
            <p className="text-gray-600 mb-4">
              There seems to be an issue loading your data. This could be due to network connectivity or authentication issues.
            </p>
            
            <div className="flex flex-col space-y-3">
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
              >
                Try Again
              </button>
              
              <button
                onClick={handleReturnToLogin}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                Return to Login
              </button>
              
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="text-sm text-primary-600 hover:text-primary-800 underline"
              >
                {showDebug ? 'Hide Debug Info' : 'Show Debug Info'}
              </button>
            </div>

            {showDebug && debugInfo && (
              <div className="mt-4 p-3 bg-gray-100 rounded text-left text-xs text-gray-700 overflow-auto max-h-40">
                <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LoadingSpinner;