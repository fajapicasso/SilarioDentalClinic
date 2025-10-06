// src/services/auditReportService.js - Audit Report Generation Service
import auditLogService from './auditLogService';
import supabase from '../config/supabaseClient';

class AuditReportService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('AuditReportService: Initializing...');
      this.initialized = true;
      console.log('AuditReportService: Initialized successfully');
    } catch (error) {
      console.error('AuditReportService: Initialization failed', error);
    }
  }

  /**
   * Generate comprehensive audit report
   */
  async generateReport(reportConfig) {
    try {
      await this.initialize();

      const {
        reportName,
        reportType,
        dateFrom,
        dateTo,
        filters = {},
        format = 'pdf',
        generatedBy
      } = reportConfig;

      // Create report entry
      const reportEntry = await auditLogService.generateAuditReport({
        reportName,
        reportType,
        generatedBy,
        dateFrom,
        dateTo,
        filters
      });

      if (!reportEntry.success) {
        throw new Error(reportEntry.error);
      }

      const reportId = reportEntry.data.id;

      // Get audit logs based on filters
      const logsResult = await auditLogService.getAuditLogs({
        ...filters,
        dateFrom,
        dateTo,
        limit: 10000 // Maximum records per report
      });

      if (!logsResult.success) {
        throw new Error(logsResult.error);
      }

      const auditLogs = logsResult.data;

      // Get statistics
      const statsResult = await auditLogService.getAuditLogStats({
        ...filters,
        dateFrom,
        dateTo
      });

      if (!statsResult.success) {
        throw new Error(statsResult.error);
      }

      const stats = statsResult.data;

      // Generate report based on format
      let reportData;
      let filePath;
      let fileSize;

      switch (format.toLowerCase()) {
        case 'pdf':
          const pdfResult = await this.generatePDFReport({
            reportName,
            reportType,
            dateFrom,
            dateTo,
            auditLogs,
            stats,
            filters
          });
          reportData = pdfResult.data;
          filePath = pdfResult.filePath;
          fileSize = pdfResult.fileSize;
          break;

        case 'excel':
          const excelResult = await this.generateExcelReport({
            reportName,
            reportType,
            dateFrom,
            dateTo,
            auditLogs,
            stats,
            filters
          });
          reportData = excelResult.data;
          filePath = excelResult.filePath;
          fileSize = excelResult.fileSize;
          break;

        case 'csv':
          const csvResult = await this.generateCSVReport({
            reportName,
            reportType,
            dateFrom,
            dateTo,
            auditLogs,
            stats,
            filters
          });
          reportData = csvResult.data;
          filePath = csvResult.filePath;
          fileSize = csvResult.fileSize;
          break;

        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      // Update report entry with file information
      const { error: updateError } = await supabase
        .from('audit_log_reports')
        .update({
          file_path: filePath,
          file_size: fileSize,
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (updateError) {
        console.error('Error updating report entry:', updateError);
      }

      return {
        success: true,
        data: {
          reportId,
          reportData,
          filePath,
          fileSize,
          recordCount: auditLogs.length
        }
      };

    } catch (error) {
      console.error('Error generating audit report:', error);
      
      // Update report status to failed
      if (reportConfig.reportId) {
        await supabase
          .from('audit_log_reports')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString()
          })
          .eq('id', reportConfig.reportId);
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate PDF Report
   */
  async generatePDFReport({ reportName, reportType, dateFrom, dateTo, auditLogs, stats, filters }) {
    try {
      // Create HTML content for PDF
      const htmlContent = this.generateHTMLReport({
        reportName,
        reportType,
        dateFrom,
        dateTo,
        auditLogs,
        stats,
        filters
      });

      // For now, return the HTML content
      // In a real implementation, you would use a library like Puppeteer or jsPDF
      const fileName = `audit_report_${reportName}_${new Date().toISOString().split('T')[0]}.html`;
      
      return {
        data: htmlContent,
        filePath: fileName,
        fileSize: new Blob([htmlContent]).size
      };

    } catch (error) {
      throw new Error(`PDF generation failed: ${error.message}`);
    }
  }

  /**
   * Generate Excel Report
   */
  async generateExcelReport({ reportName, reportType, dateFrom, dateTo, auditLogs, stats, filters }) {
    try {
      // Create Excel content
      const excelData = this.generateExcelData({
        reportName,
        reportType,
        dateFrom,
        dateTo,
        auditLogs,
        stats,
        filters
      });

      const fileName = `audit_report_${reportName}_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      return {
        data: excelData,
        filePath: fileName,
        fileSize: new Blob([excelData]).size
      };

    } catch (error) {
      throw new Error(`Excel generation failed: ${error.message}`);
    }
  }

  /**
   * Generate CSV Report
   */
  async generateCSVReport({ reportName, reportType, dateFrom, dateTo, auditLogs, stats, filters }) {
    try {
      // Create CSV content
      const csvContent = this.generateCSVData({
        reportName,
        reportType,
        dateFrom,
        dateTo,
        auditLogs,
        stats,
        filters
      });

      const fileName = `audit_report_${reportName}_${new Date().toISOString().split('T')[0]}.csv`;
      
      return {
        data: csvContent,
        filePath: fileName,
        fileSize: new Blob([csvContent]).size
      };

    } catch (error) {
      throw new Error(`CSV generation failed: ${error.message}`);
    }
  }

  /**
   * Generate HTML content for reports
   */
  generateHTMLReport({ reportName, reportType, dateFrom, dateTo, auditLogs, stats, filters }) {
    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const formatDateTime = (date) => {
      return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${reportName}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #e5e5e5;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #333;
            margin: 0;
            font-size: 28px;
          }
          .header p {
            color: #666;
            margin: 10px 0 0 0;
            font-size: 14px;
          }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
          }
          .stat-card {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            text-align: center;
            border-left: 4px solid #007bff;
          }
          .stat-card h3 {
            margin: 0 0 10px 0;
            color: #333;
            font-size: 24px;
          }
          .stat-card p {
            margin: 0;
            color: #666;
            font-size: 14px;
          }
          .filters-section {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 30px;
          }
          .filters-section h3 {
            margin: 0 0 15px 0;
            color: #333;
          }
          .filter-item {
            display: inline-block;
            margin-right: 20px;
            margin-bottom: 10px;
          }
          .filter-item strong {
            color: #333;
          }
          .filter-item span {
            color: #666;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          th {
            background-color: #f8f9fa;
            font-weight: bold;
            color: #333;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          .success {
            color: #28a745;
            font-weight: bold;
          }
          .error {
            color: #dc3545;
            font-weight: bold;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e5e5;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${reportName}</h1>
            <p>Generated on ${formatDateTime(new Date())}</p>
            <p>Report Type: ${reportType} | Period: ${formatDate(dateFrom)} - ${formatDate(dateTo)}</p>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <h3>${stats.total_logs || 0}</h3>
              <p>Total Activities</p>
            </div>
            <div class="stat-card">
              <h3>${stats.successful_logs || 0}</h3>
              <p>Successful</p>
            </div>
            <div class="stat-card">
              <h3>${stats.failed_logs || 0}</h3>
              <p>Failed</p>
            </div>
            <div class="stat-card">
              <h3>${stats.unique_users || 0}</h3>
              <p>Active Users</p>
            </div>
          </div>

          <div class="filters-section">
            <h3>Applied Filters</h3>
            ${Object.entries(filters).map(([key, value]) => 
              value ? `<div class="filter-item"><strong>${key}:</strong> <span>${value}</span></div>` : ''
            ).join('')}
          </div>

          <h3>Audit Log Details</h3>
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Module</th>
                <th>Resource</th>
                <th>Status</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              ${auditLogs.map(log => `
                <tr>
                  <td>${formatDateTime(log.timestamp)}</td>
                  <td>${log.user_name}</td>
                  <td>${log.user_role}</td>
                  <td>${log.action.replace('_', ' ')}</td>
                  <td>${log.module.replace('_', ' ')}</td>
                  <td>${log.resource_name || '-'}</td>
                  <td class="${log.success ? 'success' : 'error'}">
                    ${log.success ? 'Success' : 'Failed'}
                  </td>
                  <td>${log.ip_address || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            <p>This report was generated automatically by the Silario Dental Clinic Audit System.</p>
            <p>For questions or concerns, please contact the system administrator.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate Excel data
   */
  generateExcelData({ reportName, reportType, dateFrom, dateTo, auditLogs, stats, filters }) {
    // Create Excel-like CSV format with multiple sheets
    const formatDateTime = (date) => {
      return new Date(date).toLocaleString('en-US');
    };

    let excelContent = '';

    // Summary sheet
    excelContent += 'SUMMARY\n';
    excelContent += 'Report Name,' + reportName + '\n';
    excelContent += 'Report Type,' + reportType + '\n';
    excelContent += 'Generated On,' + formatDateTime(new Date()) + '\n';
    excelContent += 'Period From,' + formatDateTime(dateFrom) + '\n';
    excelContent += 'Period To,' + formatDateTime(dateTo) + '\n';
    excelContent += 'Total Activities,' + (stats.total_logs || 0) + '\n';
    excelContent += 'Successful,' + (stats.successful_logs || 0) + '\n';
    excelContent += 'Failed,' + (stats.failed_logs || 0) + '\n';
    excelContent += 'Active Users,' + (stats.unique_users || 0) + '\n';
    excelContent += '\n\n';

    // Filters sheet
    excelContent += 'FILTERS\n';
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        excelContent += key + ',' + value + '\n';
      }
    });
    excelContent += '\n\n';

    // Audit logs sheet
    excelContent += 'AUDIT LOGS\n';
    excelContent += 'Timestamp,User,Role,Action,Module,Resource,Status,IP Address,Error Message\n';
    auditLogs.forEach(log => {
      excelContent += [
        formatDateTime(log.timestamp),
        log.user_name,
        log.user_role,
        log.action.replace('_', ' '),
        log.module.replace('_', ' '),
        log.resource_name || '',
        log.success ? 'Success' : 'Failed',
        log.ip_address || '',
        log.error_message || ''
      ].join(',') + '\n';
    });

    return excelContent;
  }

  /**
   * Generate CSV data
   */
  generateCSVData({ reportName, reportType, dateFrom, dateTo, auditLogs, stats, filters }) {
    const formatDateTime = (date) => {
      return new Date(date).toLocaleString('en-US');
    };

    let csvContent = '';

    // Header information
    csvContent += `# ${reportName}\n`;
    csvContent += `# Generated on: ${formatDateTime(new Date())}\n`;
    csvContent += `# Report Type: ${reportType}\n`;
    csvContent += `# Period: ${formatDateTime(dateFrom)} - ${formatDateTime(dateTo)}\n`;
    csvContent += `# Total Activities: ${stats.total_logs || 0}\n`;
    csvContent += `# Successful: ${stats.successful_logs || 0}\n`;
    csvContent += `# Failed: ${stats.failed_logs || 0}\n`;
    csvContent += `# Active Users: ${stats.unique_users || 0}\n`;
    csvContent += '\n';

    // CSV headers
    csvContent += 'Timestamp,User,Role,Action,Module,Resource,Status,IP Address,Error Message\n';

    // CSV data
    auditLogs.forEach(log => {
      csvContent += [
        formatDateTime(log.timestamp),
        `"${log.user_name}"`,
        log.user_role,
        log.action.replace('_', ' '),
        log.module.replace('_', ' '),
        `"${log.resource_name || ''}"`,
        log.success ? 'Success' : 'Failed',
        log.ip_address || '',
        `"${log.error_message || ''}"`
      ].join(',') + '\n';
    });

    return csvContent;
  }

  /**
   * Get available report templates
   */
  async getReportTemplates() {
    try {
      await this.initialize();

      const templates = [
        {
          id: 'daily_summary',
          name: 'Daily Summary Report',
          description: 'Summary of all activities for a specific day',
          defaultFilters: {
            dateFrom: new Date().toISOString().split('T')[0],
            dateTo: new Date().toISOString().split('T')[0]
          }
        },
        {
          id: 'weekly_summary',
          name: 'Weekly Summary Report',
          description: 'Summary of all activities for the past week',
          defaultFilters: {
            dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            dateTo: new Date().toISOString().split('T')[0]
          }
        },
        {
          id: 'monthly_summary',
          name: 'Monthly Summary Report',
          description: 'Summary of all activities for the past month',
          defaultFilters: {
            dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            dateTo: new Date().toISOString().split('T')[0]
          }
        },
        {
          id: 'user_activity',
          name: 'User Activity Report',
          description: 'Detailed report of user activities',
          defaultFilters: {}
        },
        {
          id: 'security_events',
          name: 'Security Events Report',
          description: 'Report of all security-related events',
          defaultFilters: {
            module: 'security'
          }
        },
        {
          id: 'failed_activities',
          name: 'Failed Activities Report',
          description: 'Report of all failed activities',
          defaultFilters: {
            success: false
          }
        }
      ];

      return { success: true, data: templates };
    } catch (error) {
      console.error('Error getting report templates:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get report history
   */
  async getReportHistory(limit = 50) {
    try {
      await this.initialize();

      const { data, error } = await supabase
        .from('audit_log_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error getting report history:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Download report file
   */
  async downloadReport(reportId) {
    try {
      await this.initialize();

      const { data: report, error } = await supabase
        .from('audit_log_reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (error) throw error;
      if (!report) {
        throw new Error('Report not found');
      }

      if (report.status !== 'completed') {
        throw new Error('Report is not ready for download');
      }

      return { success: true, data: report };
    } catch (error) {
      console.error('Error downloading report:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const auditReportService = new AuditReportService();

export default auditReportService;
