// src/components/common/UnifiedInvoicePrinter.jsx - Unified Invoice Printing Component
import React from 'react';
import { FiPrinter, FiDownload, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import logo from '../../assets/Logo.png';

const UnifiedInvoicePrinter = ({ 
  invoice, 
  onClose, 
  userRole = 'admin',
  showPreview = true,
  showDownload = true,
  showPrint = true 
}) => {
  if (!invoice) return null;

  // Use invoice.invoice_items if available, fallback to invoice.items for backward compatibility
  const items = invoice.invoice_items || invoice.items || [];

  // Define print styles
  const printStyles = `
    @page {
      size: A4;
      margin: 1cm;
    }
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      color: #333;
      line-height: 1.5;
      font-size: 14px;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
    }
    .invoice-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 25px;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 15px;
    }
    .invoice-header-left {
      flex: 1;
    }
    .title-with-logo {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 10px;
      margin-top: 0;
    }
    .logo-container {
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }
    .logo-img {
      width: 100px;
      height: 80px;
      object-fit: contain;
      background: #fff;
      border: none;
      display: block;
    }
    .invoice-title {
      font-size: 48px;
      font-weight: bold;
      color: #1f2937;
      margin: 0;
      text-transform: uppercase;
      line-height: 1;
    }
    .clinic-info {
      margin-bottom: 5px;
      color: #6b7280;
      font-size: 12px;
      line-height: 1.4;
    }
    .clinic-name {
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 5px;
    }
    .invoice-number-section {
      text-align: right;
    }
    .invoice-info {
      text-align: right;
      margin-bottom: 5px;
      color: #6b7280;
      font-size: 12px;
      line-height: 1.4;
    }
    .invoice-number {
      font-size: 24px;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 8px;
    }
    .bill-section {
      display: flex;
      justify-content: space-between;
      background-color: #f8fafc;
      padding: 20px;
      margin: 25px 0;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      gap: 30px;
    }
    .bill-to, .payment-info {
      flex: 1;
    }
    .bill-to h2, .payment-info h2 {
      font-size: 14px;
      font-weight: bold;
      color: #374151;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .patient-info, .payment-details {
      color: #6b7280;
      line-height: 1.6;
      font-size: 12px;
    }
    .patient-name {
      font-weight: 600;
      color: #1f2937;
      font-size: 14px;
      margin-bottom: 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 25px 0;
      background-color: white;
      font-size: 12px;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background-color: #f8fafc;
      font-weight: 600;
      color: #374151;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-size: 11px;
    }
    .amount-right {
      text-align: right;
      font-weight: 500;
    }
    .summary {
      margin-left: auto;
      width: 300px;
      background-color: #f8fafc;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 12px;
    }
    .summary-label {
      color: #6b7280;
      font-weight: 500;
    }
    .summary-value {
      font-weight: 600;
      color: #1f2937;
    }
    .total-row {
      font-weight: bold;
      border-top: 2px solid #2563eb;
      padding-top: 12px;
      margin-top: 8px;
      font-size: 14px;
    }
    .total-row .summary-label {
      color: #2563eb;
      font-weight: bold;
    }
    .total-row .summary-value {
      color: #2563eb;
      font-weight: bold;
    }
    .notes {
      margin-top: 25px;
      border-top: 1px solid #e5e7eb;
      padding-top: 15px;
    }
    .notes h2 {
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 8px;
    }
    .notes p {
      color: #6b7280;
      line-height: 1.6;
      font-size: 12px;
      margin: 0;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
      border-top: 1px solid #e5e7eb;
      padding-top: 20px;
    }
    .footer p {
      margin: 5px 0;
    }
    .thank-you {
      font-weight: 600;
      color: #2563eb;
      font-size: 14px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-green {
      background-color: #d1fae5;
      color: #065f46;
    }
    .badge-yellow {
      background-color: #fef3c7;
      color: #92400e;
    }
    .badge-red {
      background-color: #fee2e2;
      color: #b91c1c;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  `;

  // Get status badge class
  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'approved':
        return 'badge badge-green';
      case 'partial':
      case 'pending':
        return 'badge badge-yellow';
      case 'rejected':
      case 'overdue':
        return 'badge badge-red';
      default:
        return 'badge';
    }
  };

  // Format currency function
  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
  };

  // Clean notes to remove DoctorId
  const cleanNotes = (notes) => {
    if (!notes) return '';
    return notes.replace(/\s*\|\s*DoctorId:\s*[\w-]+/gi, '').trim();
  };

  // Generate HTML content for printing
  const generateInvoiceHTML = () => {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Invoice #${invoice.invoice_number}</title>
        <style>${printStyles}</style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="invoice-header">
            <div class="invoice-header-left">
              <div class="title-with-logo">
                <div class="logo-container">
                  <img src="${logo}" alt="Silario Dental Clinic Logo" class="logo-img" />
                </div>
                <div class="invoice-title">INVOICE</div>
              </div>
              <div class="clinic-info">
                <div class="clinic-name">Silario Dental Clinic</div>
                <div class="clinic-info">Cabugao/San Juan, Ilocos Sur</div>
                <div class="clinic-info">silaroidentalclinic@gmail.com</div>
              </div>
            </div>
            <div class="invoice-number-section">
              <div class="invoice-number">#${invoice.invoice_number}</div>
              <div class="invoice-info"><strong>Date:</strong> ${new Date(invoice.invoice_date).toLocaleDateString()}</div>
              <div class="invoice-info"><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</div>
            </div>
          </div>
          
          <div class="bill-section">
            <div class="bill-to">
              <h2>Billed To</h2>
              <div class="patient-info">
                <div class="patient-name">${invoice.patientName}</div>
                ${invoice.isMinor && invoice.guardianName ? `<div style="font-weight: 500; color: #6b7280; margin-top: 4px; font-size: 12px;">Guardian: ${invoice.guardianName}</div>` : ''}
                ${invoice.isMinor && invoice.guardianPhone ? `<div style="color: #6b7280; margin-top: 2px; font-size: 12px;">Guardian Phone: ${invoice.guardianPhone}</div>` : ''}
                ${invoice.profiles?.address ? `<div>${invoice.profiles.address}</div>` : ''}
                ${invoice.profiles?.phone ? `<div>${invoice.profiles.phone}</div>` : ''}
                ${invoice.profiles?.email ? `<div>${invoice.profiles.email}</div>` : ''}
              </div>
            </div>
            
            <div class="payment-info">
              <h2>Payment Information</h2>
              <div class="payment-details">
                <div><strong>Status:</strong> <span class="${getStatusBadgeClass(invoice.status)}">${invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}</span></div>
              </div>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 50%;">Description</th>
                <th class="amount-right" style="width: 20%;">Unit Price</th>
                <th class="amount-right" style="width: 15%;">Quantity</th>
                <th class="amount-right" style="width: 15%;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item) => `
                <tr>
                  <td>${item.service_name || item.description}</td>
                  <td class="amount-right">${formatCurrency(item.price)}</td>
                  <td class="amount-right">${item.quantity}</td>
                  <td class="amount-right">${formatCurrency(item.price * item.quantity)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="summary">
            <div class="summary-row">
              <span class="summary-label">Subtotal:</span>
              <span class="summary-value">${formatCurrency(invoice.subtotal || invoice.total_amount)}</span>
            </div>
            
            ${invoice.discount > 0 ? `
              <div class="summary-row">
                <span class="summary-label">Discount:</span>
                <span class="summary-value">-${formatCurrency(invoice.discount)}</span>
              </div>
            ` : ''}
            
            ${invoice.tax > 0 ? `
              <div class="summary-row">
                <span class="summary-label">Tax:</span>
                <span class="summary-value">${formatCurrency(invoice.tax)}</span>
              </div>
            ` : ''}
            
            <div class="summary-row total-row">
              <span class="summary-label">Total Amount:</span>
              <span class="summary-value">${formatCurrency(invoice.total_amount)}</span>
            </div>
            
            ${invoice.amount_paid > 0 ? `
              <div class="summary-row">
                <span class="summary-label">Amount Paid:</span>
                <span class="summary-value">${formatCurrency(invoice.amount_paid)}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Balance Due:</span>
                <span class="summary-value">${formatCurrency(invoice.total_amount - invoice.amount_paid)}</span>
              </div>
            ` : ''}
          </div>
          
          ${invoice.notes ? `
            <div class="notes">
              <h2>Notes</h2>
              <p>${cleanNotes(invoice.notes)}</p>
            </div>
          ` : ''}
          
          
        <script>
          // Auto print when loaded
          window.onload = function() {
            window.print();
            // Optional: Close after printing
            // setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
      </html>
    `;
  };

  // Print function
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Popup blocked. Please allow popups for printing.");
      return;
    }
    
    const content = generateInvoiceHTML();
    printWindow.document.open();
    printWindow.document.write(content);
    printWindow.document.close();
  };

  // Download function
  const handleDownload = () => {
    const content = generateInvoiceHTML();
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoice-${invoice.invoice_number}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Invoice downloaded successfully');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">
              Invoice #{invoice.invoice_number}
            </h3>
            <div className="flex space-x-3">
              
              {showPrint && (
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center px-4 py-2 border border-white/20 text-sm font-medium rounded-lg text-white bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white transition-all duration-150"
                >
                  <FiPrinter className="mr-2 h-4 w-4" />
                  Print
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center p-2 border border-white/20 rounded-lg text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white transition-all duration-150"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Invoice Preview Content */}
        {showPreview && (
          <div className="p-6 max-h-[80vh] overflow-y-auto">
            <div className="max-w-4xl mx-auto bg-white">
              {/* Invoice Header */}
              <div className="flex justify-between items-start mb-6 border-b-2 border-blue-600 pb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-3">
                    <img 
                      src={logo} 
                      alt="Silario Dental Clinic Logo" 
                      className="w-[100px] h-[80px] object-contain"
                    />
                    <h1 className="text-5xl font-bold text-gray-800">INVOICE</h1>
                  </div>
                  <div className="text-gray-600 space-y-1 text-sm">
                    <div className="text-base font-semibold text-gray-900">Silario Dental Clinic</div>
                    <div>Cabugao/San Juan, Ilocos Sur</div>
                    <div>silaroidentalclinic@gmail.com</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600 mb-2">#{invoice.invoice_number}</div>
                  <div className="text-gray-600 space-y-1 text-sm">
                    <div><strong>Date:</strong> {new Date(invoice.invoice_date).toLocaleDateString()}</div>
                    <div><strong>Due Date:</strong> {new Date(invoice.due_date).toLocaleDateString()}</div>
                  </div>
                </div>
              </div>

              {/* Bill To Section */}
              <div className="bg-gray-50 p-5 rounded-lg mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h2 className="text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">Billed To</h2>
                    <div className="text-gray-600 text-xs leading-relaxed">
                      <div className="font-semibold text-gray-900 text-sm mb-1">{invoice.patientName}</div>
                      {invoice.isMinor && invoice.guardianName && (
                        <div className="font-medium text-gray-500 mt-1 mb-1">Guardian: {invoice.guardianName}</div>
                      )}
                      {invoice.isMinor && invoice.guardianPhone && (
                        <div className="text-gray-500 mt-1 mb-1">Guardian Phone: {invoice.guardianPhone}</div>
                      )}
                      {invoice.profiles?.address && <div>{invoice.profiles.address}</div>}
                      {invoice.profiles?.phone && <div>{invoice.profiles.phone}</div>}
                      {invoice.profiles?.email && <div>{invoice.profiles.email}</div>}
                    </div>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">Payment Information</h2>
                    <div className="text-gray-600 text-xs">
                      <div>
                        <strong>Status:</strong> 
                        <span className={`ml-2 px-3 py-1 rounded-full text-xs font-semibold ${
                          invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                          invoice.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                          invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-6">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-300">Description</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-300">Unit Price</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-300">Quantity</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-300">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-3 text-sm border-b border-gray-200">{item.service_name || item.description}</td>
                        <td className="px-3 py-3 text-sm text-right border-b border-gray-200">{formatCurrency(item.price)}</td>
                        <td className="px-3 py-3 text-sm text-right border-b border-gray-200">{item.quantity}</td>
                        <td className="px-3 py-3 text-sm text-right font-semibold border-b border-gray-200">{formatCurrency(item.price * item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="flex justify-end mb-6">
                <div className="w-72 bg-gray-50 p-5 rounded-lg">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm py-2">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(invoice.subtotal || invoice.total_amount)}</span>
                    </div>
                    
                    {invoice.discount > 0 && (
                      <div className="flex justify-between text-sm py-2">
                        <span className="text-gray-600">Discount:</span>
                        <span className="font-semibold text-gray-900">-{formatCurrency(invoice.discount)}</span>
                      </div>
                    )}
                    
                    {invoice.tax > 0 && (
                      <div className="flex justify-between text-sm py-2">
                        <span className="text-gray-600">Tax:</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(invoice.tax)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-sm font-bold text-blue-600 border-t-2 border-blue-600 pt-3 mt-2">
                      <span>Total Amount:</span>
                      <span>{formatCurrency(invoice.total_amount)}</span>
                    </div>
                    
                    {invoice.amount_paid > 0 && (
                      <>
                        <div className="flex justify-between text-sm py-2">
                          <span className="text-gray-600">Amount Paid:</span>
                          <span className="font-semibold text-gray-900">{formatCurrency(invoice.amount_paid)}</span>
                        </div>
                        <div className="flex justify-between text-sm py-2">
                          <span className="text-gray-600">Balance Due:</span>
                          <span className="font-semibold text-gray-900">{formatCurrency(invoice.total_amount - invoice.amount_paid)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {invoice.notes && (
                <div className="mb-6 border-t border-gray-200 pt-4">
                  <h2 className="text-sm font-semibold text-gray-800 mb-2">Notes</h2>
                  <p className="text-gray-600 text-xs leading-relaxed">{cleanNotes(invoice.notes)}</p>
                </div>
              )}

              {/* Footer */}
              <div className="text-center text-gray-500 border-t border-gray-200 pt-5 mt-8">
                <p className="font-semibold text-blue-600 mb-1 text-sm">Thank you for choosing Silario Dental Clinic</p>
                <p className="text-xs">For any inquiries, please contact us at silaroidentalclinic@gmail.com</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UnifiedInvoicePrinter;
