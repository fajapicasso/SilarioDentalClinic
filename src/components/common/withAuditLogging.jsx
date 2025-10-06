// src/components/common/withAuditLogging.jsx - Higher-Order Component for Automatic Audit Logging
import React, { useEffect } from 'react';
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const withAuditLogging = (WrappedComponent, pageConfig) => {
  const WithAuditLoggingComponent = (props) => {
    const { logPageView } = useUniversalAudit();

    useEffect(() => {
      // Log page view when component mounts
      if (pageConfig) {
        logPageView(
          pageConfig.pageName,
          pageConfig.module,
          pageConfig.section,
          {
            userRole: pageConfig.userRole,
            pageType: pageConfig.pageType,
            timestamp: new Date().toISOString()
          }
        );
      }
    }, [logPageView]);

    return <WrappedComponent {...props} />;
  };

  WithAuditLoggingComponent.displayName = `withAuditLogging(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithAuditLoggingComponent;
};

export default withAuditLogging;
