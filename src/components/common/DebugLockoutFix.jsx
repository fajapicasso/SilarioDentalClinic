// Save this as DebugLockoutFix.jsx in your src/components/common directory
// This is a utility component to help you recover from authentication lockouts

import React, { useState, useEffect } from 'react';
import supabase from '../../config/supabaseClient';

/**
 * This component can be accessed by adding ?debug=unlock to any URL in your app
 * It will show a simple screen that lets you force clear auth state and
 * helps diagnose connection issues
 */
const DebugLockoutFix = () => {
  const [status, setStatus] = useState('checking');
  const [authInfo, setAuthInfo] = useState(null);
  const [dbInfo, setDbInfo] = useState(null);
  const [localStorageInfo, setLocalStorageInfo] = useState({});
  
  useEffect(() => {
    // Check if we're in debug mode
    const urlParams = new URLSearchParams(window.location.search);
    const isDebugMode = urlParams.get('debug') === 'unlock';
    
    if (!isDebugMode) {
      setStatus('not-debug-mode');
      return;
    }
    
    checkStatus();
  }, []);
  
  const checkStatus = async () => {
    try {
      // Check Supabase auth state
      const authResponse = await supabase.auth.getSession();
      setAuthInfo({
        hasSession: !!authResponse.data?.session,
        user: authResponse.data?.session?.user?.email || 'None',
        error: authResponse.error ? authResponse.error.message : null
      });
      
      // Check database connectivity
      try {
        const dbResponse = await supabase.from('profiles').select('count', { count: 'exact', head: true });
        setDbInfo({
          connected: !dbResponse.error,
          error: dbResponse.error ? dbResponse.error.message : null,
          count: dbResponse.count
        });
      } catch (dbError) {
        setDbInfo({
          connected: false,
          error: dbError.message
        });
      }
      
      // Check localStorage
      try {
        const items = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key.includes('supabase')) {
            try {
              const value = localStorage.getItem(key);
              items[key] = value ? 'Present (length: ' + value.length + ')' : 'Empty';
            } catch (e) {
              items[key] = 'Error reading: ' + e.message;
            }
          }
        }
        setLocalStorageInfo(items);
      } catch (e) {
        setLocalStorageInfo({ error: e.message });
      }
      
      setStatus('checked');
    } catch (e) {
      setStatus('error');
      console.error('Debug check error:', e);
    }
  };
  
  const clearAuthState = async () => {
    try {
      setStatus('clearing');
      
      // First try signing out
      await supabase.auth.signOut();
      
      // Clear localStorage items related to Supabase
      for (const key in localStorageInfo) {
        if (key.includes('supabase')) {
          localStorage.removeItem(key);
        }
      }
      
      // Clear IndexedDB store (if accessible)
      try {
        const dbs = await window.indexedDB.databases();
        for (const db of dbs) {
          if (db.name.includes('supabase')) {
            window.indexedDB.deleteDatabase(db.name);
          }
        }
      } catch (e) {
        console.warn('Could not clear IndexedDB:', e);
      }
      
      setStatus('cleared');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (e) {
      setStatus('clear-error');
      console.error('Error clearing auth state:', e);
    }
  };
  
  if (status === 'not-debug-mode') {
    return null;
  }
  
  return (
    <div className="fixed inset-0 bg-gray-50 flex items-center justify-center z-50">
      <div className="max-w-lg w-full bg-white p-6 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Auth Debug & Recovery</h1>
        
        {status === 'checking' && (
          <div className="text-center py-4">
            <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto"></div>
            <p className="mt-2 text-gray-600">Checking system status...</p>
          </div>
        )}
        
        {status === 'checked' && (
          <>
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h2 className="text-lg font-medium text-gray-700 mb-2">Authentication Status</h2>
                <div className="bg-gray-50 p-3 rounded text-sm">
                  <p>Session: {authInfo?.hasSession ? '✅ Present' : '❌ Missing'}</p>
                  {authInfo?.user && <p>User: {authInfo.user}</p>}
                  {authInfo?.error && <p className="text-red-600">Error: {authInfo.error}</p>}
                </div>
              </div>
              
              <div className="border-b pb-4">
                <h2 className="text-lg font-medium text-gray-700 mb-2">Database Connection</h2>
                <div className="bg-gray-50 p-3 rounded text-sm">
                  <p>Connected: {dbInfo?.connected ? '✅ Yes' : '❌ No'}</p>
                  {dbInfo?.error && <p className="text-red-600">Error: {dbInfo.error}</p>}
                </div>
              </div>
              
              <div className="border-b pb-4">
                <h2 className="text-lg font-medium text-gray-700 mb-2">Local Storage</h2>
                <div className="bg-gray-50 p-3 rounded text-sm max-h-40 overflow-y-auto">
                  {Object.keys(localStorageInfo).length === 0 ? (
                    <p>No Supabase items found in localStorage</p>
                  ) : (
                    Object.entries(localStorageInfo).map(([key, value]) => (
                      <p key={key}>
                        <span className="font-mono text-xs">{key}:</span> {value}
                      </p>
                    ))
                  )}
                </div>
              </div>
              
              <div className="space-y-3">
                <h2 className="text-lg font-medium text-gray-700">Actions</h2>
                <p className="text-sm text-gray-600">
                  If you're stuck in an authentication loop or can't access your account, 
                  you can clear your authentication state and start fresh.
                </p>
                <div className="flex justify-between">
                  <button
                    onClick={clearAuthState}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Clear Auth State & Return to Login
                  </button>
                  
                  <button
                    onClick={() => window.location.href = '/'}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  >
                    Return to App
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
        
        {status === 'clearing' && (
          <div className="text-center py-4">
            <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto"></div>
            <p className="mt-2 text-gray-600">Clearing authentication state...</p>
          </div>
        )}
        
        {status === 'cleared' && (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="mt-2 text-gray-600">Authentication state cleared successfully! Redirecting to login...</p>
          </div>
        )}
        
        {status === 'error' || status === 'clear-error' && (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="mt-2 text-red-600">
              {status === 'error' ? 'Error checking system status' : 'Error clearing authentication state'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugLockoutFix;