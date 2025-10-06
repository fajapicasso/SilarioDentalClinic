// src/components/common/InvoicePDF.jsx - Invoice PDF Generator
import React from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const InvoicePDF = {
  // Generate invoice PDF HTML template matching the UnifiedInvoicePrinter design
  generateInvoiceHTML: (invoice) => {
    if (!invoice) return '';

    const items = invoice.invoice_items || invoice.items || [];
    const subtotal = invoice.subtotal || 0;
    const totalAmount = invoice.total_amount || 0;
    const amountPaid = invoice.amount_paid || 0;
    const balanceDue = totalAmount - amountPaid;

    // Get current date and time for print timestamp
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('en-US', { 
      month: '2-digit', 
      day: '2-digit', 
      year: '2-digit' 
    });
    const formattedTime = currentDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });

    // Determine payment status
    let paymentStatus = 'PENDING';
    let statusColor = '#f59e0b';
    if (amountPaid >= totalAmount) {
      paymentStatus = 'PAID';
      statusColor = '#10b981';
    } else if (amountPaid > 0) {
      paymentStatus = 'PARTIAL';
      statusColor = '#f59e0b';
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${invoice.invoice_number}</title>
        <style>
          @page {
            size: A4;
            margin: 0.5in;
          }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            margin: 0;
            padding: 0;
            font-size: 14px;
            color: #1f2937;
            background: #ffffff;
            line-height: 1.6;
            width: 100%;
          }
          
          .invoice-container {
            width: 100%;
            max-width: 100%;
            margin: 0 auto;
            padding: 0;
          }
          
          .invoice-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #2563eb;
          }
          
          .invoice-title {
            font-size: 40px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 15px;
            margin-top: 0;
            text-transform: uppercase;
          }
          
          .clinic-info {
            margin-top: 0;
          }
          
          .clinic-name {
            font-size: 20px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 8px;
          }
          
          .clinic-details {
            color: #6b7280;
            font-size: 14px;
            line-height: 1.5;
            margin: 0;
          }
          
          .invoice-number-section {
            text-align: right;
            margin-top: 0;
          }
          
          .invoice-number {
            font-size: 24px;
            color: #2563eb;
            font-weight: bold;
            margin-bottom: 10px;
          }
          
          .invoice-dates {
            color: #6b7280;
            font-size: 14px;
            line-height: 1.5;
          }
          
          .billing-info-section {
            display: flex;
            justify-content: space-between;
            margin: 30px 0;
            gap: 30px;
          }
          
          .billed-to, .payment-info {
            flex: 1;
            background: #f8fafc;
            padding: 25px;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
          }
          
          .section-title {
            font-weight: 600;
            color: #374151;
            margin-bottom: 15px;
            font-size: 16px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .patient-info {
            color: #6b7280;
            line-height: 1.5;
            font-size: 14px;
          }
          
          .patient-name {
            font-weight: 600;
            margin-bottom: 8px;
            font-size: 16px;
            color: #1f2937;
          }
          
          .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            color: white;
            background-color: ${statusColor};
            margin-left: 5px;
          }
          
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 30px 0;
            background: white;
            font-size: 14px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            border-radius: 8px;
            overflow: hidden;
          }
          
          .items-table th {
            background: #f8fafc;
            color: #374151;
            font-weight: 600;
            padding: 15px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .items-table td {
            padding: 15px;
            border-bottom: 1px solid #e5e7eb;
            color: #1f2937;
            font-size: 14px;
          }
          
          .items-table tr:nth-child(even) {
            background: #f8fafc;
          }
          
          .text-right {
            text-align: right;
          }
          
          .summary-section {
            display: flex;
            justify-content: flex-end;
            margin-top: 30px;
          }
          
          .summary-box {
            background: #f8fafc;
            padding: 25px;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
            width: 350px;
          }
          
          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            color: #1f2937;
            font-size: 14px;
          }
          
          .summary-label {
            color: #6b7280;
            font-weight: 500;
          }
          
          .summary-value {
            font-weight: 600;
            color: #1f2937;
          }
          
          .summary-total {
            font-weight: bold;
            color: #2563eb;
            font-size: 18px;
            border-top: 2px solid #2563eb;
            padding-top: 15px;
            margin-top: 10px;
          }
          
          .notes-section {
            margin-top: 30px;
            padding: 20px;
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
          }
          
          .notes-title {
            font-weight: 600;
            color: #374151;
            margin-bottom: 10px;
            font-size: 16px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .notes-content {
            color: #6b7280;
            line-height: 1.5;
            font-size: 14px;
          }
          
          .footer {
            margin-top: 40px;
            text-align: center;
            color: #2563eb;
            font-size: 16px;
            font-weight: 600;
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
          }
          
          .footer-contact {
            margin-top: 10px;
            color: #6b7280;
            font-size: 14px;
            font-weight: normal;
          }
          
          .page-info {
            position: absolute;
            bottom: 10px;
            left: 0;
            right: 0;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="print-time">${formattedDate}, ${formattedTime}</div>
        
        <div class="invoice-container">
          <div class="invoice-header">
            <div class="clinic-info">
              <div class="invoice-title">INVOICE</div>
              <div class="clinic-name">Silario Dental Clinic</div>
              <div class="clinic-details">
                Cabugao/San Juan, Ilocos Sur<br>
                silaroidentalclinic@gmail.com
              </div>
            </div>
            <div class="invoice-number-section">
              <div class="invoice-number">#${invoice.invoice_number}</div>
              <div class="invoice-dates">
                <strong>Date:</strong> ${new Date(invoice.invoice_date).toLocaleDateString()}<br>
                <strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div class="billing-info-section">
            <div class="billed-to">
              <div class="section-title">BILLED TO</div>
              <div class="patient-info">
                <div class="patient-name">${invoice.patientName || invoice.profiles?.full_name || 'N/A'}</div>
                <div>${invoice.profiles?.address || 'N/A'}</div>
                <div>${invoice.profiles?.phone || 'N/A'}</div>
                <div>${invoice.profiles?.email || 'N/A'}</div>
              </div>
            </div>
            <div class="payment-info">
              <div class="section-title">PAYMENT INFORMATION</div>
              
              <div style="font-size: 12px;">
                <strong>Status:</strong> 
                <span class="status-badge">${paymentStatus}</span>
              </div>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>DESCRIPTION</th>
                <th>UNIT PRICE</th>
                <th>QUANTITY</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr>
                  <td>${item.service_name || item.description || 'Service'}</td>
                  <td class="text-right">₱${parseFloat(item.price || 0).toFixed(2)}</td>
                  <td class="text-right">${item.quantity || 1}</td>
                  <td class="text-right">₱${(parseFloat(item.price || 0) * (item.quantity || 1)).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="summary-section">
            <div class="summary-box">
              <div class="summary-row">
                <span class="summary-label">Subtotal:</span>
                <span class="summary-value">₱${subtotal.toFixed(2)}</span>
              </div>
              ${invoice.discount > 0 ? `
                <div class="summary-row">
                  <span class="summary-label">Discount:</span>
                  <span class="summary-value">-₱${invoice.discount.toFixed(2)}</span>
                </div>
              ` : ''}
              ${invoice.tax > 0 ? `
                <div class="summary-row">
                  <span class="summary-label">Tax:</span>
                  <span class="summary-value">₱${invoice.tax.toFixed(2)}</span>
                </div>
              ` : ''}
              <div class="summary-row summary-total">
                <span class="summary-label">Total Amount:</span>
                <span class="summary-value">₱${totalAmount.toFixed(2)}</span>
              </div>
              ${amountPaid > 0 ? `
                <div class="summary-row">
                  <span class="summary-label">Amount Paid:</span>
                  <span class="summary-value">₱${amountPaid.toFixed(2)}</span>
                </div>
                <div class="summary-row">
                  <span class="summary-label">Balance Due:</span>
                  <span class="summary-value">₱${balanceDue.toFixed(2)}</span>
                </div>
              ` : ''}
            </div>
          </div>

          ${invoice.notes ? `
            <div class="notes-section">
              <div class="notes-title">Notes</div>
              <div class="notes-content">${invoice.notes}</div>
            </div>
          ` : ''}
 
          
          
         
        </div>
      </body>
      </html>
    `;
  },

  // Generate PDF from invoice data
  generateInvoicePDF: async (invoice, toast) => {
    try {
      if (!invoice) {
        toast.error('Invoice data not available. Please refresh the page and try again.');
        return;
      }

      console.log('Generating PDF for invoice:', invoice);
      const printHTML = InvoicePDF.generateInvoiceHTML(invoice);
      
      if (!printHTML) {
        toast.error('Failed to generate invoice HTML. Please try again.');
        return;
      }

      const parser = new DOMParser();
      const parsed = parser.parseFromString(printHTML, 'text/html');

      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-10000px';
      container.style.top = '0';
      container.style.width = '794px';
      container.style.background = '#fff';

      // Copy styles from the template
      const styleEl = parsed.querySelector('style');
      if (styleEl) {
        const cloneStyle = document.createElement('style');
        cloneStyle.textContent = styleEl.textContent || '';
        container.appendChild(cloneStyle);
      }

      // Move all body children
      Array.from(parsed.body.childNodes).forEach((n) => container.appendChild(n.cloneNode(true)));
      document.body.appendChild(container);

      // Wait for images to load
      const images = Array.from(container.querySelectorAll('img'));
      await Promise.all(images.map(img => new Promise(res => { 
        if (img.complete) res(); 
        else { img.onload = img.onerror = () => res(); } 
      })));

      // Render container to canvas
      console.log('Rendering container to canvas...');
      const canvas = await html2canvas(container, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#ffffff',
        allowTaint: true,
        logging: false
      });
      
      if (!canvas) {
        throw new Error('Failed to render canvas');
      }
      
      console.log('Canvas rendered successfully, dimensions:', canvas.width, 'x', canvas.height);

      const pdf = new jsPDF('p', 'pt', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginPt = 43;
      const sideMargin = marginPt;
      const topMarginFirst = marginPt;
      const topMarginNext = marginPt;
      const bottomMargin = marginPt;
      const contentWidthPt = pageWidth - sideMargin * 2;
      const contentHeightPt = pageHeight - topMarginFirst - bottomMargin;
      const pxPerPt = canvas.width / (pageWidth - sideMargin * 2);

      const addSlice = (startPx, heightPx, yPt) => {
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = heightPx;
        const ctx = sliceCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, startPx, canvas.width, heightPx, 0, 0, canvas.width, heightPx);
        const imgData = sliceCanvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', sideMargin, yPt, contentWidthPt, heightPx / pxPerPt);
      };

      // First page
      const firstHeightPx = Math.min(canvas.height, Math.floor(contentHeightPt * pxPerPt));
      addSlice(0, firstHeightPx, topMarginFirst);
      let cursorPx = firstHeightPx;

      // Subsequent pages
      while (cursorPx < canvas.height) {
        pdf.addPage('a4', 'p');
        const remainingCapacityPx = Math.max(0, Math.floor((pageHeight - topMarginNext - bottomMargin) * pxPerPt));
        const sliceHeightPx = Math.min(canvas.height - cursorPx, remainingCapacityPx);
        if (sliceHeightPx <= 0) break;
        addSlice(cursorPx, sliceHeightPx, topMarginNext);
        cursorPx += sliceHeightPx;
      }

      const safeName = (invoice.invoice_number || 'invoice').replace(/[^a-z0-9\-\s]/gi, ' ').trim();
      console.log('Saving PDF with filename:', `Invoice - ${safeName}.pdf`);
      
      pdf.save(`Invoice - ${safeName}.pdf`);
      
      // Clean up
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
      
      toast.success('Invoice downloaded successfully!');
    } catch (error) {
      console.error('Error downloading invoice:', error);
      console.error('Error details:', error.message, error.stack);
      
      // Clean up on error
      const container = document.querySelector('div[style*="position: fixed"]');
      if (container && document.body.contains(container)) {
        document.body.removeChild(container);
      }
      
      toast.error(`Failed to download invoice: ${error.message}`);
    }
  }
};

export default InvoicePDF;
