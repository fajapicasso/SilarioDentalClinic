import React from 'react';

const PublicLayout = ({ children }) => (
  <div className="min-h-screen bg-gradient-to-br from-green-400 via-blue-300 to-blue-600">
    {children}
  </div>
);

export default PublicLayout; 