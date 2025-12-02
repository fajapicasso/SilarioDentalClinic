// src/pages/admin/AuditLogs.jsx - Admin Audit Logs Interface
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import auditLogService from '../../services/auditLogService';
import { toast } from 'react-toastify';
import { useUniversalAudit } from '../../hooks/useUniversalAudit';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { 
  FiEye, 
  FiDownload, 
  FiPrinter, 
  FiFilter, 
  FiSearch, 
  FiCalendar,
  FiUser,
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiFileText,
  FiUsers,
  FiCreditCard,
  FiSettings,
  FiShield,
  FiDatabase
} from 'react-icons/fi';

const AuditLogs = () => {
  const { user } = useAuth();
  const { logPageView } = useUniversalAudit();
  const [auditLogs, setAuditLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage] = useState(50);

  // Filter states
  const [filters, setFilters] = useState({
    userId: '',
    userRole: '', // Add user role filter
    action: '',
    module: '',
    resourceType: '',
    dateFrom: null,
    dateTo: null,
    success: '',
    searchTerm: ''
  });

  // Report generation states
  const [reportData, setReportData] = useState({
    reportName: '',
    reportType: 'custom',
    dateFrom: '',
    dateTo: '',
    format: 'pdf'
  });

  // Module icons mapping
  const moduleIcons = {
    'user_management': FiUsers,
    'appointments': FiCalendar,
    'payments': FiCreditCard,
    'services': FiSettings,
    'queue': FiUsers,
    'medical_records': FiFileText,
    'system': FiDatabase,
    'security': FiShield,
    'billing': FiCreditCard,
    'inventory': FiSettings
  };

  // Action colors mapping
  const actionColors = {
    'create': 'text-green-600 bg-green-100',
    'update': 'text-blue-600 bg-blue-100',
    'delete': 'text-red-600 bg-red-100',
    'approve': 'text-green-600 bg-green-100',
    'reject': 'text-red-600 bg-red-100',
    'cancel': 'text-orange-600 bg-orange-100',
    'login': 'text-purple-600 bg-purple-100',
    'logout': 'text-gray-600 bg-gray-100'
  };

  // Load audit logs
  const loadAuditLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      // Prepare query filters - format dates and convert success string to boolean
      const queryFilters = {};

      // Apply filters only if they have values
      if (filters.userId) {
        queryFilters.userId = filters.userId;
      }
      if (filters.userRole) {
        queryFilters.userRole = filters.userRole;
      }
      if (filters.action) {
        queryFilters.action = filters.action;
      }
      if (filters.module) {
        queryFilters.module = filters.module;
      }
      if (filters.resourceType) {
        queryFilters.resourceType = filters.resourceType;
      }
      if (filters.dateFrom) {
        // Format date to ISO string with time set to start of day
        const dateFrom = filters.dateFrom instanceof Date ? filters.dateFrom : new Date(filters.dateFrom);
        dateFrom.setHours(0, 0, 0, 0);
        queryFilters.dateFrom = dateFrom.toISOString();
      }
      if (filters.dateTo) {
        // Format date to ISO string with time set to end of day
        const dateTo = filters.dateTo instanceof Date ? filters.dateTo : new Date(filters.dateTo);
        dateTo.setHours(23, 59, 59, 999);
        queryFilters.dateTo = dateTo.toISOString();
      }
      if (filters.success !== '') {
        queryFilters.success = filters.success === 'true';
      }

      // For pagination, we'll fetch more records and paginate client-side
      // This is because Supabase doesn't easily return total count with filters
      // In production, you'd want a separate count query or use RPC function
      queryFilters.limit = 1000; // Fetch more records to allow client-side pagination
      
      const result = await auditLogService.getAuditLogs(queryFilters);
      
      if (result.success) {
        let logs = result.data || [];
        
        // Apply client-side search filter if searchTerm exists
        if (filters.searchTerm) {
          const searchLower = filters.searchTerm.toLowerCase();
          logs = logs.filter(log => 
            (log.user_name?.toLowerCase().includes(searchLower)) ||
            (log.action?.toLowerCase().includes(searchLower)) ||
            (log.module?.toLowerCase().includes(searchLower)) ||
            (log.resource_name?.toLowerCase().includes(searchLower)) ||
            (log.resource_type?.toLowerCase().includes(searchLower)) ||
            (log.user_role?.toLowerCase().includes(searchLower)) ||
            (log.ip_address?.toLowerCase().includes(searchLower))
          );
        }
        
        setAuditLogs(logs);
        
        // Apply pagination
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedLogs = logs.slice(startIndex, endIndex);
        setFilteredLogs(paginatedLogs);
        
        // Calculate total pages based on filtered results
        setTotalPages(Math.max(1, Math.ceil(logs.length / itemsPerPage)));
      } else {
        toast.error('Failed to load audit logs');
        setAuditLogs([]);
        setFilteredLogs([]);
      }
    } catch (error) {
      console.error('Error loading audit logs:', error);
      toast.error('Error loading audit logs');
      setAuditLogs([]);
      setFilteredLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters, currentPage, itemsPerPage]);

  // Load statistics
  const loadStats = useCallback(async () => {
    try {
      const result = await auditLogService.getAuditLogStats(filters);
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [filters]);

  // Load data on component mount and when filters change
  useEffect(() => {
    // Log page view
    logPageView('Admin Audit Logs', 'audit_logs', 'management');
    
    loadAuditLogs();
    loadStats();
  }, [loadAuditLogs, loadStats, logPageView]);

  // Note: Search filtering is now handled in loadAuditLogs to work with server-side filters

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      userId: '',
      userRole: '',
      action: '',
      module: '',
      resourceType: '',
      dateFrom: null,
      dateTo: null,
      success: '',
      searchTerm: ''
    });
    setCurrentPage(1);
  };

  // Handle log selection
  const handleLogSelect = (log) => {
    setSelectedLog(log);
  };

  // Test audit log system
  const testAuditLog = async () => {
    try {
      console.log('🧪 Testing audit log system...');
      const result = await auditLogService.testAuditLog();
      
      if (result.success) {
        toast.success('Audit log test successful! Check console for details.');
        // Refresh the audit logs to show the new test entry
        setTimeout(() => {
          loadAuditLogs();
        }, 1000);
      } else {
        toast.error(`Audit log test failed: ${result.error}`);
        console.error('❌ Audit log test failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Error testing audit log:', error);
      toast.error('Error testing audit log system');
    }
  };

  // Generate report
  const generateReport = async () => {
    try {
      // Prepare filters for report - use report modal dates if provided, otherwise use filter dates
      let reportDateFrom = reportData.dateFrom || filters.dateFrom;
      let reportDateTo = reportData.dateTo || filters.dateTo;

      // Format dates properly for the report
      let formattedDateFrom = null;
      let formattedDateTo = null;

      if (reportDateFrom) {
        const dateFrom = reportDateFrom instanceof Date ? reportDateFrom : new Date(reportDateFrom);
        dateFrom.setHours(0, 0, 0, 0);
        formattedDateFrom = dateFrom.toISOString();
      }
      if (reportDateTo) {
        const dateTo = reportDateTo instanceof Date ? reportDateTo : new Date(reportDateTo);
        dateTo.setHours(23, 59, 59, 999);
        formattedDateTo = dateTo.toISOString();
      }

      // Prepare all filters for the report
      const reportFilters = {
        ...filters,
        dateFrom: formattedDateFrom,
        dateTo: formattedDateTo
      };

      const result = await auditLogService.generateAuditReport({
        reportName: reportData.reportName || `Audit Report - ${new Date().toLocaleDateString()}`,
        reportType: reportData.reportType,
        generatedBy: user.id,
        dateFrom: formattedDateFrom,
        dateTo: formattedDateTo,
        filters: reportFilters
      });

      if (result.success) {
        toast.success('Report generation started');
        setShowReportModal(false);
        // Reset report data
        setReportData({
          reportName: '',
          reportType: 'custom',
          dateFrom: null,
          dateTo: null,
          format: 'pdf'
        });
      } else {
        toast.error('Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Error generating report');
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const csvContent = [
      ['Timestamp', 'User', 'Role', 'Action', 'Module', 'Resource', 'Success', 'IP Address'],
      ...filteredLogs.map(log => [
        new Date(log.timestamp).toLocaleString(),
        log.user_name,
        log.user_role,
        log.action,
        log.module,
        log.resource_name || '',
        log.success ? 'Yes' : 'No',
        log.ip_address || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Print logs
  const printLogs = () => {
    if (filteredLogs.length === 0) {
      toast.info('No logs to print');
      return;
    }

    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Build filter summary
    const activeFilters = [];
    if (filters.userRole) activeFilters.push(`User Role: ${filters.userRole}`);
    if (filters.action) activeFilters.push(`Action: ${filters.action}`);
    if (filters.module) activeFilters.push(`Module: ${filters.module}`);
    if (filters.resourceType) activeFilters.push(`Resource Type: ${filters.resourceType}`);
    if (filters.dateFrom) {
      const dateFrom = filters.dateFrom instanceof Date ? filters.dateFrom : new Date(filters.dateFrom);
      activeFilters.push(`From: ${dateFrom.toLocaleDateString()}`);
    }
    if (filters.dateTo) {
      const dateTo = filters.dateTo instanceof Date ? filters.dateTo : new Date(filters.dateTo);
      activeFilters.push(`To: ${dateTo.toLocaleDateString()}`);
    }
    if (filters.success !== '') activeFilters.push(`Status: ${filters.success === 'true' ? 'Successful' : 'Failed'}`);
    if (filters.searchTerm) activeFilters.push(`Search: ${filters.searchTerm}`);

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Audit Logs Report - Silario Dental Clinic</title>
          <meta charset="UTF-8">
          <style>
            @media print {
              @page {
                size: A4 landscape;
                margin: 1cm;
              }
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Arial', sans-serif;
              font-size: 10px;
              color: #333;
              line-height: 1.4;
              padding: 20px;
              background: #fff;
            }
            .header {
              margin-bottom: 20px;
              border-bottom: 3px solid #2563eb;
              padding-bottom: 15px;
            }
            .header-content {
              display: flex;
              align-items: center;
              gap: 20px;
              margin-bottom: 15px;
            }
            .clinic-name {
              font-size: 24px;
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 5px;
              text-transform: uppercase;
            }
            .report-title {
              font-size: 20px;
              font-weight: bold;
              color: #1e40af;
              text-transform: uppercase;
              margin-top: 10px;
            }
            .report-info {
              margin: 15px 0;
              padding: 10px;
              background: #f3f4f6;
              border-radius: 5px;
            }
            .report-info p {
              margin: 3px 0;
              font-size: 9px;
            }
            .filters {
              margin: 10px 0;
              padding: 8px;
              background: #eff6ff;
              border-left: 4px solid #2563eb;
              font-size: 9px;
            }
            .filters strong {
              color: #1e40af;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 15px;
              font-size: 9px;
            }
            thead {
              background: #2563eb;
              color: white;
            }
            th {
              padding: 8px 5px;
              text-align: left;
              font-weight: bold;
              border: 1px solid #1e40af;
              font-size: 9px;
            }
            td {
              padding: 6px 5px;
              border: 1px solid #d1d5db;
              vertical-align: top;
            }
            tbody tr:nth-child(even) {
              background: #f9fafb;
            }
            tbody tr:hover {
              background: #f3f4f6;
            }
            .status-success {
              color: #059669;
              font-weight: bold;
            }
            .status-failed {
              color: #dc2626;
              font-weight: bold;
            }
            .badge {
              display: inline-block;
              padding: 2px 6px;
              border-radius: 3px;
              font-size: 8px;
              font-weight: bold;
            }
            .badge-success {
              background: #d1fae5;
              color: #065f46;
            }
            .badge-failed {
              background: #fee2e2;
              color: #991b1b;
            }
            .footer {
              margin-top: 20px;
              padding-top: 10px;
              border-top: 2px solid #e5e7eb;
              text-align: center;
              font-size: 8px;
              color: #6b7280;
            }
            .summary {
              margin: 15px 0;
              padding: 10px;
              background: #f0fdf4;
              border: 1px solid #86efac;
              border-radius: 5px;
            }
            .summary p {
              margin: 3px 0;
              font-size: 9px;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-content">
              <img src="${window.location.origin}/src/assets/Logo.png" alt="Silario Dental Clinic Logo" style="width: 100px; height: 80px; object-fit: contain;" />
              <div style="flex: 1;">
                <div class="clinic-name">Silario Dental Clinic</div>
                <div style="font-size: 10px; color: #6b7280; margin-top: 2px;">Cabugao/San Juan, Ilocos Sur</div>
                <div class="report-title">AUDIT LOGS REPORT</div>
              </div>
            </div>
          </div>
          
          <div class="report-info">
            <p><strong>Generated On:</strong> ${currentDate}</p>
            <p><strong>Generated By:</strong> ${user?.full_name || user?.email || 'System'}</p>
            <p><strong>Total Records:</strong> ${filteredLogs.length}</p>
          </div>

          ${activeFilters.length > 0 ? `
            <div class="filters">
              <strong>Active Filters:</strong> ${activeFilters.join(' | ')}
            </div>
          ` : ''}

          <div class="summary">
            <p>Report Summary: This audit log report contains all system activities and security events tracked by the system.</p>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 12%;">Timestamp</th>
                <th style="width: 12%;">User</th>
                <th style="width: 8%;">Role</th>
                <th style="width: 10%;">Action</th>
                <th style="width: 10%;">Module</th>
                <th style="width: 12%;">Resource</th>
                <th style="width: 8%;">Status</th>
                <th style="width: 10%;">IP Address</th>
                <th style="width: 8%;">Details</th>
              </tr>
            </thead>
            <tbody>
              ${filteredLogs.map(log => {
                const timestamp = new Date(log.timestamp).toLocaleString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });
                const hasDetails = log.old_values || log.new_values || log.error_message || log.metadata;
                return `
                  <tr>
                    <td>${timestamp}</td>
                    <td>${log.user_name || 'System'}</td>
                    <td>${log.user_role || 'N/A'}</td>
                    <td>${log.action?.replace(/_/g, ' ') || 'N/A'}</td>
                    <td>${log.module?.replace(/_/g, ' ') || 'N/A'}</td>
                    <td>${log.resource_name || log.resource_type || 'N/A'}</td>
                    <td>
                      <span class="badge ${log.success ? 'badge-success' : 'badge-failed'}">
                        ${log.success ? '✓ Success' : '✗ Failed'}
                      </span>
                    </td>
                    <td>${log.ip_address || 'N/A'}</td>
                    <td>${hasDetails ? 'Yes' : 'No'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="footer">
            <p>This is a system-generated audit log report. All activities are logged for security and compliance purposes.</p>
            <p>For inquiries, contact: silariodentalclinic@gmail.com</p>
            <p>Generated by Silario Dental Clinic Management System</p>
          </div>

          <script>
            window.onload = function() {
              try {
                window.print();
                window.onafterprint = function() {
                  setTimeout(function() {
                    window.close();
                  }, 1000);
                };
              } catch (error) {
                console.error('Print error:', error);
                setTimeout(function() {
                  window.close();
                }, 2000);
              }
            };
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups for this site.');
      return;
    }
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Fallback timeout
    setTimeout(() => {
      if (printWindow && !printWindow.closed) {
        printWindow.focus();
      }
    }, 500);
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  // Get action color class
  const getActionColorClass = (action) => {
    const baseAction = action.split('_')[0];
    return actionColors[baseAction] || 'text-gray-600 bg-gray-100';
  };

  // Get module icon
  const getModuleIcon = (module) => {
    const IconComponent = moduleIcons[module] || FiActivity;
    return <IconComponent className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ minWidth: '1024px' }}>
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
              <p className="mt-2 text-gray-600">
                Comprehensive audit trail of all system activities
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <FiFilter className="w-4 h-4 mr-2" />
                Filters
              </button>
              <button
                onClick={exportToCSV}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <FiDownload className="w-4 h-4 mr-2" />
                Export CSV
              </button>
              <button
                onClick={printLogs}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <FiPrinter className="w-4 h-4 mr-2" />
                Print
              </button>
              <button
                onClick={testAuditLog}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <FiActivity className="w-4 h-4 mr-2" />
                Test Audit Log
              </button>
              <button
                onClick={() => setShowReportModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <FiFileText className="w-4 h-4 mr-2" />
                Generate Report
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <FiActivity className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Activities
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.total_logs?.toLocaleString() || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <FiCheckCircle className="h-6 w-6 text-green-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Successful
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.successful_logs?.toLocaleString() || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <FiXCircle className="h-6 w-6 text-red-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Failed
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.failed_logs?.toLocaleString() || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <FiUsers className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Active Users
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.unique_users?.toLocaleString() || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        {showFilters && (
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={filters.searchTerm}
                    onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                    placeholder="Search logs..."
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User Role
                </label>
                <select
                  value={filters.userRole}
                  onChange={(e) => handleFilterChange('userRole', e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="">All User Types</option>
                  <option value="admin">Admin</option>
                  <option value="doctor">Doctor</option>
                  <option value="staff">Staff</option>
                  <option value="patient">Patient</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action
                </label>
                <select
                  value={filters.action}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="">All Actions</option>
                  <option value="create">Create</option>
                  <option value="update">Update</option>
                  <option value="delete">Delete</option>
                  <option value="approve">Approve</option>
                  <option value="reject">Reject</option>
                  <option value="login">Login</option>
                  <option value="logout">Logout</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Module
                </label>
                <select
                  value={filters.module}
                  onChange={(e) => handleFilterChange('module', e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="">All Modules</option>
                  <option value="user_management">User Management</option>
                  <option value="appointments">Appointments</option>
                  <option value="payments">Payments</option>
                  <option value="services">Services</option>
                  <option value="queue">Queue</option>
                  <option value="medical_records">Medical Records</option>
                  <option value="system">System</option>
                  <option value="security">Security</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Success
                </label>
                <select
                  value={filters.success}
                  onChange={(e) => handleFilterChange('success', e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="">All</option>
                  <option value="true">Successful</option>
                  <option value="false">Failed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date From
                </label>
                <DatePicker
                  selected={filters.dateFrom}
                  onChange={(date) => handleFilterChange('dateFrom', date)}
                  selectsStart
                  startDate={filters.dateFrom}
                  endDate={filters.dateTo}
                  maxDate={filters.dateTo || new Date()}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 px-3 py-2 text-sm"
                  dateFormat="yyyy-MM-dd"
                  placeholderText="Select start date"
                  isClearable
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date To
                </label>
                <DatePicker
                  selected={filters.dateTo}
                  onChange={(date) => handleFilterChange('dateTo', date)}
                  selectsEnd
                  startDate={filters.dateFrom}
                  endDate={filters.dateTo}
                  minDate={filters.dateFrom}
                  maxDate={new Date()}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 px-3 py-2 text-sm"
                  dateFormat="yyyy-MM-dd"
                  placeholderText="Select end date"
                  isClearable
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Audit Logs Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md" style={{ minWidth: '800px' }}>
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Audit Logs ({filteredLogs.length} records)
            </h3>
            
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : (
              <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full divide-y divide-gray-200" style={{ minWidth: '800px' }}>
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                        Timestamp
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                        User
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                        Action
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                        Module
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                        Resource
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                        Status
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3 text-sm text-gray-900 w-40">
                          <div className="flex items-center">
                            <FiClock className="w-3 h-3 text-gray-400 mr-1 flex-shrink-0" />
                            <span className="truncate">{formatTimestamp(log.timestamp)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-900 w-48">
                          <div className="flex items-center">
                            <FiUser className="w-3 h-3 text-gray-400 mr-1 flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="font-medium truncate">{log.user_name}</div>
                              <div className="text-gray-500 text-xs truncate">{log.user_role}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 w-32">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getActionColorClass(log.action)} truncate`}>
                            {log.action.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-900 w-24">
                          <div className="flex items-center">
                            {getModuleIcon(log.module)}
                            <span className="ml-1 truncate">{log.module.replace('_', ' ')}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-900 w-40">
                          <span className="truncate block">{log.resource_name || '-'}</span>
                        </td>
                        <td className="px-3 py-3 w-20">
                          {log.success ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              <FiCheckCircle className="w-3 h-3 mr-1" />
                              <span className="hidden sm:inline">Success</span>
                              <span className="sm:hidden">✓</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              <FiXCircle className="w-3 h-3 mr-1" />
                              <span className="hidden sm:inline">Failed</span>
                              <span className="sm:hidden">✗</span>
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm font-medium w-20">
                          <button
                            onClick={() => handleLogSelect(log)}
                            className="text-primary-600 hover:text-primary-900 p-1 rounded"
                          >
                            <FiEye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
                <div className="flex flex-1 justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing page <span className="font-medium">{currentPage}</span> of{' '}
                      <span className="font-medium">{totalPages}</span>
                    </p>
                  </div>
                  <div>
                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Log Detail Modal */}
        {selectedLog && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Audit Log Details</h3>
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FiXCircle className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Timestamp</label>
                      <p className="mt-1 text-sm text-gray-900">{formatTimestamp(selectedLog.timestamp)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">User</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedLog.user_name} ({selectedLog.user_role})</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Action</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedLog.action}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Module</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedLog.module}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Resource</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedLog.resource_name || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {selectedLog.success ? (
                          <span className="text-green-600">Success</span>
                        ) : (
                          <span className="text-red-600">Failed</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {selectedLog.old_values && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Old Values</label>
                      <pre className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-md overflow-auto">
                        {JSON.stringify(JSON.parse(selectedLog.old_values), null, 2)}
                      </pre>
                    </div>
                  )}

                  {selectedLog.new_values && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">New Values</label>
                      <pre className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-md overflow-auto">
                        {JSON.stringify(JSON.parse(selectedLog.new_values), null, 2)}
                      </pre>
                    </div>
                  )}

                  {selectedLog.error_message && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Error Message</label>
                      <p className="mt-1 text-sm text-red-600">{selectedLog.error_message}</p>
                    </div>
                  )}

                  {selectedLog.metadata && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Metadata</label>
                      <pre className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-md overflow-auto">
                        {JSON.stringify(JSON.parse(selectedLog.metadata), null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">IP Address</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedLog.ip_address || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Session ID</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedLog.session_id || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Report Generation Modal */}
        {showReportModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Generate Audit Report</h3>
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FiXCircle className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Report Name</label>
                    <input
                      type="text"
                      value={reportData.reportName}
                      onChange={(e) => setReportData(prev => ({ ...prev, reportName: e.target.value }))}
                      placeholder="Enter report name"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Report Type</label>
                    <select
                      value={reportData.reportType}
                      onChange={(e) => setReportData(prev => ({ ...prev, reportType: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    >
                      <option value="custom">Custom</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Date From</label>
                      <DatePicker
                        selected={reportData.dateFrom}
                        onChange={(date) => setReportData(prev => ({ ...prev, dateFrom: date }))}
                        selectsStart
                        startDate={reportData.dateFrom}
                        endDate={reportData.dateTo}
                        maxDate={reportData.dateTo || new Date()}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 px-3 py-2 text-sm"
                        dateFormat="yyyy-MM-dd"
                        placeholderText="Select start date"
                        isClearable
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Date To</label>
                      <DatePicker
                        selected={reportData.dateTo}
                        onChange={(date) => setReportData(prev => ({ ...prev, dateTo: date }))}
                        selectsEnd
                        startDate={reportData.dateFrom}
                        endDate={reportData.dateTo}
                        minDate={reportData.dateFrom}
                        maxDate={new Date()}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 px-3 py-2 text-sm"
                        dateFormat="yyyy-MM-dd"
                        placeholderText="Select end date"
                        isClearable
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Export Format</label>
                    <select
                      value={reportData.format}
                      onChange={(e) => setReportData(prev => ({ ...prev, format: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    >
                      <option value="pdf">PDF</option>
                      <option value="excel">Excel</option>
                      <option value="csv">CSV</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={generateReport}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Generate Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
