// src/components/ArchiveErrorBoundary.jsx
import React from 'react';
import { toast } from 'react-toastify';

class ArchiveErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Check if the error is related to an archived account
    if (error.message && error.message.includes('archived')) {
      return { hasError: true, error };
    }
    return { hasError: false, error: null };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to an error reporting service
    console.error('Archive Error Boundary caught an error:', error, errorInfo);
    
    // Check if it's an archive-related error
    if (error.message && error.message.includes('archived')) {
      toast.error('Your account has been archived. Please contact an administrator.');
      // Redirect to login page
      window.location.href = '/login';
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
          <div className="p-8 bg-white rounded-lg shadow-md max-w-md w-full">
            <h2 className="text-xl font-bold text-red-600 mb-4">Account Archived</h2>
            <p className="text-gray-700 mb-4">
              Your account has been archived and you no longer have access to the system.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Please contact an administrator to restore your account access.
            </p>
            <button
              onClick={() => window.location.href = '/login'}
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              Return to Login
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ArchiveErrorBoundary;