// src/components/TextFileViewer.jsx - Create this new component
import React, { useState, useEffect } from 'react';

const TextFileViewer = ({ blob }) => {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTextContent = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(blob);
        if (!response.ok) {
          throw new Error(`Failed to fetch content: ${response.status}`);
        }
        const text = await response.text();
        setContent(text);
      } catch (err) {
        console.error('Error reading text file:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (blob) {
      fetchTextContent();
    }
  }, [blob]);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="mt-2 text-sm text-gray-600">Loading content...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        <p>Error loading file content: {error}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-4 rounded-md overflow-auto">
      <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800">{content}</pre>
    </div>
  );
};

export default TextFileViewer;