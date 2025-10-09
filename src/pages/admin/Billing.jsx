// src/pages/doctor/Billing.jsx -  design with improved UI
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import supabase from '../../config/supabaseClient';
import { toast } from 'react-toastify';
import { FiDollarSign, FiPlus, FiSearch, FiFilter, FiFileText, FiTrash2, FiDownload, FiPrinter, FiX, FiCheck, FiEye, FiCreditCard, FiCalendar, FiClock, FiUser, FiActivity } from 'react-icons/fi';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useNavigate } from 'react-router-dom';
import { usePaymentNotifications } from '../../hooks/useNotificationIntegration';
import { useUniversalAudit } from '../../hooks/useUniversalAudit';
import InvoicePDF from '../../components/common/InvoicePDF';
import UnifiedInvoicePrinter from '../../components/common/UnifiedInvoicePrinter';

// IMPORTANT: To enable the Edit Invoice page, add the following route to your router:
// <Route path="/doctor/billing/edit/:invoiceId" element={<EditInvoice />} />
// Make sure to import EditInvoice from './EditInvoice';

const Billing = () => {
  const { user } = useAuth();
  
  // Get notification functions from the hook
  const { approvePayment, rejectPayment } = usePaymentNotifications();
  
  // Get audit log functions
  const { logPageView, logBillingView, logPaymentCreate, logPaymentUpdate } = useUniversalAudit();
  
  const [activeTab, setActiveTab] = useState('history');
  const [isLoading, setIsLoading] = useState(false);
  
  // Invoice creation states
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  
  // Selected services/products
  const [lineItems, setLineItems] = useState([]);
  const [tempItem, setTempItem] = useState({
    description: '',
    unit_price: '',
    quantity: 1
  });
  
  // Patient appointment history and services
  const [patientAppointments, setPatientAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [appointmentServices, setAppointmentServices] = useState([]);
  const [showAppointmentDropdown, setShowAppointmentDropdown] = useState(false);
  const [allServices, setAllServices] = useState([]);
  
  // Payment details
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [notes, setNotes] = useState('');
  
  // Invoice history states
  const [invoices, setInvoices] = useState([]);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [invoiceFilter, setInvoiceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // New filter for status buttons
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showUnifiedPrinter, setShowUnifiedPrinter] = useState(false);

  // Payment approval states
  const [payments, setPayments] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('pending');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [historyView, setHistoryView] = useState('invoices'); // 'invoices' or 'payments'
  
  // Totals
  const [subtotal, setSubtotal] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState('percentage');
  const [tax, setTax] = useState(0);
  
  // Add state for full-size image modal
  const [showFullSizeImage, setShowFullSizeImage] = useState(false);
  const [fullSizeImageUrl, setFullSizeImageUrl] = useState('');
  const [fullSizeReferenceNumber, setFullSizeReferenceNumber] = useState('');
  
  // Edit Invoice states
  const [showEditInvoiceModal, setShowEditInvoiceModal] = useState(false);
  const [editInvoiceData, setEditInvoiceData] = useState(null);
  const [originalEditInvoiceItems, setOriginalEditInvoiceItems] = useState([]);
  
  // Add tempEditItem state for editing
  const [tempEditItem, setTempEditItem] = useState({ description: '', price: '', quantity: 1, discount: 0 });
  
  const navigate = useNavigate();
  
  // Helper functions for rejection indicators
  const hasRejectedPayments = (invoiceId) => {
    // Find the invoice to check its status
    const invoice = invoices.find(inv => inv.id === invoiceId);
    
    // If invoice is fully paid, don't show rejected payment indicators
    if (invoice && invoice.status === 'paid') {
      return false;
    }
    
    // Otherwise, check if there are rejected payments
    return allPayments.some(payment => 
      payment.invoice_id === invoiceId && 
      (payment.approval_status === 'rejected' || 
       (payment.notes && payment.notes.includes('Dr. ') && payment.notes.includes('rejected your payment')))
    );
  };

  const getRejectionMessage = (invoiceId) => {
    const rejectedPayment = allPayments.find(payment => 
      payment.invoice_id === invoiceId && 
      (payment.approval_status === 'rejected' || 
       (payment.notes && payment.notes.includes('Dr. ') && payment.notes.includes('rejected your payment')))
    );
    
    if (rejectedPayment && rejectedPayment.notes) {
      const match = rejectedPayment.notes.match(/Dr\. .+ rejected your payment\. You need to pay again and attach valid proof of payment\./);
      return match ? match[0] : 'This invoice has rejected payments that need to be resubmitted.';
    }
    
    return null;
  };

  
  // FETCH DATA
  useEffect(() => {
    // Log page view
    logPageView('Doctor Billing', 'billing', 'management');
    
    fetchPatients();
    fetchInvoices();
    fetchPayments();
    fetchAllServices();
  }, [user, logPageView]);
  
  // Update subtotal when line items change
  useEffect(() => {
    calculateTotals();
  }, [lineItems, discount, discountType, tax]);
  
  // Filter patients when search query changes
  useEffect(() => {
    if (searchQuery) {
      const lowercasedQuery = searchQuery.toLowerCase();
      const filtered = patients.filter(
        patient => patient.full_name.toLowerCase().includes(lowercasedQuery) ||
                  (patient.phone && patient.phone.includes(lowercasedQuery))
      );
      setFilteredPatients(filtered);
    } else {
      setFilteredPatients(patients);
    }
  }, [searchQuery, patients]);
  
  // Filter invoices when search query changes
  useEffect(() => {
    if (invoices.length === 0) return;
    
    let filtered = [...invoices];
    
    // Apply status filter
    if (invoiceFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.status === invoiceFilter);
    }
    
    // Apply search query
    if (invoiceSearchQuery) {
      const lowercasedQuery = invoiceSearchQuery.toLowerCase();
      filtered = filtered.filter(
        invoice => invoice.invoice_number.toLowerCase().includes(lowercasedQuery) ||
                  invoice.patientName.toLowerCase().includes(lowercasedQuery)
      );
    }
    
    // Apply status button filter
    if (statusFilter !== 'all') {
      const today = new Date().toISOString().split('T')[0];
      const isToday = (d) => {
        try { return new Date(d).toISOString().split('T')[0] === today; } catch { return false; }
      };
      
      switch (statusFilter) {
        case 'partial':
          filtered = filtered.filter(invoice => invoice.status === 'partial');
          break;
        case 'today-pending':
          filtered = filtered.filter(invoice => invoice.status === 'pending' && isToday(invoice.invoice_date));
          break;
        case 'other-pending':
          filtered = filtered.filter(invoice => invoice.status === 'pending' && !isToday(invoice.invoice_date));
          break;
        case 'paid':
          filtered = filtered.filter(invoice => invoice.status === 'paid');
          break;
      }
    }
    
    setFilteredInvoices(filtered);
  }, [invoiceSearchQuery, invoiceFilter, statusFilter, invoices]);

  // Filter payments when search query or status filter changes
  useEffect(() => {
    if (payments.length === 0) return;
    
    let filtered = [...payments];
    
    // Apply status filter
    if (paymentStatusFilter !== 'all') {
      filtered = filtered.filter(payment => 
        payment.approval_status === paymentStatusFilter
      );
    }
    
    // Apply search query
    if (paymentSearchQuery) {
      const lowercasedQuery = paymentSearchQuery.toLowerCase();
      filtered = filtered.filter(
        payment => payment.patientName?.toLowerCase().includes(lowercasedQuery) ||
                  payment.invoiceNumber?.toLowerCase().includes(lowercasedQuery) ||
                  payment.reference_number?.toLowerCase().includes(lowercasedQuery)
      );
    }
    
    setFilteredPayments(filtered);
  }, [paymentSearchQuery, paymentStatusFilter, payments]);
  
  // Direct Print function for invoices
  const printInvoice = (invoice) => {
    // Use invoice.invoice_items if available, fallback to invoice.items for backward compatibility
    const items = invoice.invoice_items || invoice.items || [];
    if (!invoice) return;
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Popup blocked. Please allow popups for printing.");
      return;
    }
    
    // Define print styles
    const printStyles = `
      body {
        font-family: Arial, sans-serif;
        margin: 20px;
        color: #333;
        line-height: 1.6;
      }
      .invoice-container {
        max-width: 800px;
        margin: 0 auto;
      }
      .invoice-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 30px;
        border-bottom: 2px solid #2563eb;
        padding-bottom: 20px;
      }
      .invoice-title {
        font-size: 32px;
        font-weight: bold;
        color: #2563eb;
        margin-bottom: 10px;
      }
      .clinic-info {
        margin-bottom: 5px;
        color: #6b7280;
      }
      .clinic-name {
        font-size: 18px;
        font-weight: 600;
        color: #1f2937;
        margin-bottom: 5px;
      }
      .invoice-info {
        text-align: right;
        margin-bottom: 5px;
      }
      .invoice-number {
        font-size: 20px;
        font-weight: bold;
        color: #2563eb;
        margin-bottom: 10px;
      }
      .bill-section {
        display: flex;
        justify-content: space-between;
        background-color: #f8fafc;
        padding: 25px;
        margin: 25px 0;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
      }
      .bill-to, .payment-info {
        flex: 1;
      }
      .bill-to h2, .payment-info h2 {
        font-size: 16px;
        font-weight: bold;
        color: #374151;
        margin-bottom: 15px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .patient-info, .payment-details {
        color: #6b7280;
        line-height: 1.5;
      }
      .patient-name {
        font-weight: 600;
        color: #1f2937;
        font-size: 16px;
        margin-bottom: 5px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 25px 0;
        background-color: white;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        overflow: hidden;
      }
      th, td {
        padding: 15px;
        text-align: left;
        border-bottom: 1px solid #e5e7eb;
      }
      th {
        background-color: #f8fafc;
        font-weight: 600;
        color: #374151;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-size: 12px;
      }
      .amount-right {
        text-align: right;
        font-weight: 500;
      }
      .summary {
        margin-left: auto;
        width: 350px;
        background-color: #f8fafc;
        padding: 25px;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
      }
      .summary-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
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
      .total-row {
        font-weight: bold;
        border-top: 2px solid #2563eb;
        padding-top: 15px;
        margin-top: 10px;
        font-size: 18px;
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
        margin-top: 30px;
        border-top: 1px solid #e5e7eb;
        padding-top: 20px;
      }
      .notes h2 {
        font-size: 16px;
        font-weight: 600;
        color: #374151;
        margin-bottom: 10px;
      }
      .notes p {
        color: #6b7280;
        line-height: 1.6;
      }
      .footer {
        margin-top: 50px;
        text-align: center;
        color: #9ca3af;
        font-size: 14px;
        border-top: 1px solid #e5e7eb;
        padding-top: 25px;
      }
      .footer p {
        margin: 5px 0;
      }
      .thank-you {
        font-weight: 600;
        color: #2563eb;
        font-size: 16px;
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

    // Generate HTML for the invoice
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

    // Generate HTML content for the print window
    const content = `
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
            <div>
              <div class="invoice-title">INVOICE</div>
              <div class="clinic-name">Silario Dental Clinic</div>
              <div class="clinic-info">Cabugao/San Juan, Ilocos Sur</div>
              <div class="clinic-info">silaroidentalclinic@gmail.com</div>
            </div>
            <div>
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
                ${invoice.profiles?.address ? `<div>${invoice.profiles.address}</div>` : ''}
                ${invoice.profiles?.phone ? `<div>${invoice.profiles.phone}</div>` : ''}
                ${invoice.profiles?.email ? `<div>${invoice.profiles.email}</div>` : ''}
              </div>
            </div>
            
            <div class="payment-info">
              <h2>Payment Information</h2>
              <div class="payment-details">
                <div><strong>Method:</strong> ${invoice.payment_method || 'Not specified'}</div>
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
              <p>${invoice.notes}</p>
            </div>
          ` : ''}
          
          <div class="footer">
            <p class="thank-you">Thank you for choosing Silario Dental Clinic</p>
            <p>For any inquiries, please contact us at silaroidentalclinic@gmail.com</p>
          </div>
        </div>
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
    
    // Write to the new window and print
    printWindow.document.open();
    printWindow.document.write(content);
    printWindow.document.close();
  };
  
  // HELPER FUNCTIONS
  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, email, address, disabled')
        .eq('role', 'patient')
        .neq('disabled', true)
        .order('full_name');
      
      if (error) throw error;
      setPatients(data || []);
      setFilteredPatients(data || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast.error('Failed to load patients');
    }
  };

  const fetchAllServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('name');
        
      if (error) throw error;
      setAllServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };
  
  const fetchPatientAppointments = async (patientId) => {
    if (!patientId) return;
    
    setIsLoading(true);
    try {
      // Get completed appointments for the patient
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id, 
          appointment_date, 
          appointment_time, 
          notes, 
          branch, 
          teeth_involved,
          status,
          doctor_id
        `)
        .eq('patient_id', patientId)
        .eq('doctor_id', user.id)
        .eq('status', 'completed')
        .order('appointment_date', { ascending: false });
      
      if (error) throw error;
      
      // Helper to format 24h time string to 12h with AM/PM
      const to12Hour = (timeStr) => {
        if (!timeStr) return '';
        const raw = timeStr.substring(0, 5); // HH:MM
        const [hStr, mStr] = raw.split(':');
        let hours = parseInt(hStr, 10);
        if (Number.isNaN(hours)) return raw;
        const period = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        if (hours === 0) hours = 12;
        return `${hours}:${mStr} ${period}`;
      };

      // Format appointment data
      const formattedAppointments = data.map(appointment => ({
        ...appointment,
        formattedDate: new Date(appointment.appointment_date).toLocaleDateString(),
        formattedTime: to12Hour(appointment.appointment_time),
        displayName: `${new Date(appointment.appointment_date).toLocaleDateString()} at ${appointment.appointment_time ? to12Hour(appointment.appointment_time) : 'N/A'}`
      }));
      
      setPatientAppointments(formattedAppointments);
    } catch (error) {
      console.error('Error fetching patient appointments:', error);
      toast.error('Failed to load patient appointments');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAppointmentServices = async (appointmentId) => {
    if (!appointmentId) return;
    
    setIsLoading(true);
    try {
      // Get services for the appointment
      const { data, error } = await supabase
        .from('appointment_services')
        .select(`
          service_id,
          services(id, name, description, price, duration, category)
        `)
        .eq('appointment_id', appointmentId);
      
      if (error) throw error;

      // Format service data and update line items
      const servicesData = data.map(item => item.services);
      setAppointmentServices(servicesData);
      
      // Convert to line items format
      const newLineItems = servicesData.map(service => ({
        id: Date.now() + Math.random(), // Unique temporary ID
        description: service.name,
        unit_price: parseFloat(service.price),
        quantity: 1,
        total: parseFloat(service.price),
        service_id: service.id
      }));
      
      // Update line items
      setLineItems(prevItems => [...prevItems, ...newLineItems]);
      
    } catch (error) {
      console.error('Error fetching appointment services:', error);
      toast.error('Failed to load appointment services');
    } finally {
      setIsLoading(false);
    }
  };
  
  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      console.log('Fetching all invoices for admin access');
      
      // Fetch ALL invoices for admin access (no doctor filtering)
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          invoice_date,
          due_date,
          patient_id,
          total_amount,
          amount_paid,
          status,
          payment_method,
          notes,
          discount,
          tax,
          created_at,
          created_by,
          profiles:patient_id(full_name, phone, email, address),
          invoice_items(
            id,
            service_name,
            description,
            quantity,
            price,
            discount
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching invoices:', error);
        throw error;
      }
      
      console.log('Raw invoice data:', data);
      
      const formattedInvoices = data.map(invoice => {
        // Extract doctor information from notes if available
        let assignedDoctor = null;
        if (invoice.notes) {
          const doctorMatch = invoice.notes.match(/Doctor: Dr\. ([^|\n]+)/);
          if (doctorMatch) {
            assignedDoctor = doctorMatch[1].trim();
          }
        }
        
        const formatted = {
          ...invoice,
          patientName: invoice.profiles?.full_name || 'Unknown Patient',
          formattedDate: new Date(invoice.invoice_date).toLocaleDateString(),
          formattedTotal: formatCurrency(invoice.total_amount),
          invoice_items: invoice.invoice_items || [],
          assignedDoctor: assignedDoctor
        };
        console.log('Fetched invoice in history:', { id: invoice.id, items: formatted.invoice_items, doctor: assignedDoctor });
        return formatted;
      });
      
      console.log('Formatted invoices:', formattedInvoices);
      
      // Separate groups: partial payments first, then pending, then paid
      const isToday = (d) => {
        try { return new Date(d).toISOString().split('T')[0] === today; } catch { return false; }
      };
      const partialPayments = formattedInvoices.filter(inv => inv.status === 'partial');
      const allPending = formattedInvoices.filter(inv => inv.status === 'pending');
      const paidInvoices = formattedInvoices.filter(inv => inv.status === 'paid');
      const prioritized = [...partialPayments, ...allPending, ...paidInvoices];

      setInvoices(prioritized);
      setFilteredInvoices(prioritized);
      
      console.log('Final prioritized invoices:', prioritized);
      
    } catch (error) {
      console.error('Error in fetchInvoices:', error);
      toast.error('Failed to load invoices: ' + (error.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      console.log('Fetching all payments for admin access');
      
      // Fetch ALL payments for admin access (no doctor filtering)
      const { data: payments, error: paymentError } = await supabase
        .from('payments')
        .select(`
          id,
          invoice_id,
          amount,
          payment_method,
          reference_number,
          payment_date,
          notes,
          created_at,
          created_by,
          approval_status
        `)
        .order('created_at', { ascending: false });

      if (paymentError) throw paymentError;
      
      console.log('All payments for admin:', payments?.length || 0);
      
      if (payments && payments.length > 0) {
        // Store all payments (including rejected ones) for rejection indicators
        setAllPayments(payments);
        
        // For admin access, show ALL payments (pending, approved, rejected)
        // This gives complete oversight of all payment activities
        const allPaymentsForDisplay = payments;
        // Get patient information for all payments
        const patientIds = [...new Set(allPaymentsForDisplay.map(p => p.created_by).filter(Boolean))];
        let patientData = {};
        
        if (patientIds.length > 0) {
          const { data: patientProfiles, error: patientError } = await supabase
            .from('profiles')
            .select('id, full_name, phone, email')
            .in('id', patientIds);
            
          if (!patientError && patientProfiles) {
            patientProfiles.forEach(profile => {
              patientData[profile.id] = profile;
            });
          }
        }
        
        // Get all invoices for payment formatting
        const { data: allInvoices, error: allInvoicesError } = await supabase
          .from('invoices')
          .select('id, invoice_number, patient_id, notes, total_amount, amount_paid, status, profiles:patient_id(full_name, phone, email)');
        
        if (allInvoicesError) {
          console.error('Error fetching all invoices:', allInvoicesError);
        }
        
        // Combine all data safely - format ALL payments for admin display
        const formattedAllPayments = allPaymentsForDisplay.map(payment => {
          const invoice = allInvoices?.find(inv => inv.id === payment.invoice_id) || {};
          const patient = patientData[payment.created_by] || invoice.profiles || {};
          
          // Extract doctor information from invoice notes
          let assignedDoctor = null;
          if (invoice.notes) {
            const doctorMatch = invoice.notes.match(/Doctor: Dr\. ([^|\n]+)/);
            if (doctorMatch) {
              assignedDoctor = doctorMatch[1].trim();
            }
          }
          
          return {
            ...payment,
            approval_status: payment.approval_status || 'pending',
            patientName: patient.full_name || 'Unknown Patient',
            invoiceNumber: invoice.invoice_number || 'Unknown',
            formattedAmount: formatCurrency(payment.amount || 0),
            formattedDate: new Date(payment.payment_date || payment.created_at).toLocaleDateString(),
            proofUrl: payment.notes?.includes('Payment proof:') 
              ? payment.notes.split('Payment proof: ')[1] 
              : null,
            invoices: invoice,
            assignedDoctor: assignedDoctor
          };
        });

        // For admin access, show all payments without grouping
        // This gives complete visibility of all payment activities
        const formattedPayments = formattedAllPayments;

        console.log('=== ADMIN PAYMENT ACCESS DEBUG ===');
        console.log('Total payments fetched:', payments.length);
        console.log('All payments for admin display:', formattedAllPayments.length);
        console.log('Payment details:', formattedAllPayments.map(p => ({
          id: p.id,
          patientName: p.patientName,
          invoiceNumber: p.invoiceNumber,
          amount: p.formattedAmount,
          status: p.approval_status,
          doctor: p.assignedDoctor || 'Not assigned',
          invoiceNotes: p.invoices?.notes || 'No notes'
        })));
        console.log('=== END PAYMENT DEBUG ===');

        setPayments(formattedPayments);
        setFilteredPayments(formattedPayments);
      } else {
        // No payments found in the system
        setPayments([]);
        setAllPayments([]);
        setFilteredPayments([]);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('Failed to load payments: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
    setShowPatientDropdown(false);
    setSearchQuery(patient.full_name);
    setLineItems([]); // Clear existing line items
    
    // Fetch patient appointments when patient is selected
    fetchPatientAppointments(patient.id);
    setShowAppointmentDropdown(true);
  };

  const handleAppointmentSelect = (appointment) => {
    setSelectedAppointment(appointment);
    setShowAppointmentDropdown(false);
    
    // Add appointment details to notes
    const appointmentDetails = 
      `Appointment on ${appointment.formattedDate} at ${appointment.formattedTime}` + 
      (appointment.teeth_involved ? ` - Teeth involved: ${appointment.teeth_involved}` : '') +
      (appointment.branch ? ` - Branch: ${appointment.branch}` : '');
    
    setNotes(appointmentDetails);
    
    // Fetch services for the selected appointment
    fetchAppointmentServices(appointment.id);
  };
  
  const handleAddLineItem = () => {
    // Validate
    if (!tempItem.description || !tempItem.unit_price) {
      toast.error('Please enter item description and price');
      return;
    }
    
    // Parse unit price as a number
    const unitPrice = parseFloat(tempItem.unit_price);
    if (isNaN(unitPrice) || unitPrice < 0) {
      toast.error('Please enter a valid price');
      return;
    }
    
    // Parse quantity as a number
    const quantity = parseInt(tempItem.quantity, 10) || 1;
    if (isNaN(quantity) || quantity < 1) {
      toast.error('Please enter a valid quantity');
      return;
    }
    
    // Create new line item
    const newItem = {
      id: Date.now(), // Temporary ID
      description: tempItem.description,
      unit_price: unitPrice,
      quantity: quantity,
      total: unitPrice * quantity
    };
    
    // Add to line items
    setLineItems([...lineItems, newItem]);
    
    // Reset temp item
    setTempItem({
      description: '',
      unit_price: '',
      quantity: 1
    });
  };

  // Handle adding a service from available services list
  const handleAddService = (service) => {
    // Check if service is already added
    const existingItem = lineItems.find(item => 
      item.description === service.name || (item.service_id && item.service_id === service.id)
    );
    
    if (existingItem) {
      // Increment quantity if already exists
      const updatedItems = lineItems.map(item => {
        if (item.id === existingItem.id) {
          const newQuantity = item.quantity + 1;
          return {
            ...item,
            quantity: newQuantity,
            total: item.unit_price * newQuantity
          };
        }
        return item;
      });
      
      setLineItems(updatedItems);
      toast.info(`Increased quantity for "${service.name}"`);
    } else {
      // Add as new item
      const newItem = {
        id: Date.now() + Math.random(),
        description: service.name,
        unit_price: parseFloat(service.price),
        quantity: 1,
        total: parseFloat(service.price),
        service_id: service.id
      };
      
      setLineItems([...lineItems, newItem]);
      toast.success(`Added service: ${service.name}`);
    }
  };
  
  const handleRemoveLineItem = (itemId) => {
    setLineItems(lineItems.filter(item => item.id !== itemId));
  };
  
  const handleDiscountChange = (value) => {
    // Parse as a number
    const discountValue = parseFloat(value);
    
    // Validate
    if (isNaN(discountValue) || discountValue < 0) {
      setDiscount(0);
      return;
    }
    
    // If percentage, cap at 100%
    if (discountType === 'percentage' && discountValue > 100) {
      setDiscount(100);
      return;
    }
    
    setDiscount(discountValue);
  };
  
  const calculateTotals = () => {
    // Calculate subtotal
    const calculatedSubtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    
    // Calculate discount
    let discountAmount = 0;
    if (discount > 0) {
      // Handle different discount types
      if (['pwd', 'senior', 'student', 'veteran', 'percentage'].includes(discountType)) {
        discountAmount = (calculatedSubtotal * discount) / 100;
      } else if (discountType === 'amount') {
        discountAmount = discount;
      }
    }
    
    // Calculate tax
    const taxAmount = ((calculatedSubtotal - discountAmount) * tax) / 100;
    
    // Set values
    setSubtotal(calculatedSubtotal);
    
    return {
      subtotal: calculatedSubtotal,
      discount: discountAmount,
      tax: taxAmount,
      total: calculatedSubtotal - discountAmount + taxAmount
    };
  };
  
  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
  };
  
  const generateInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return `INV-${year}${month}${day}-${random}`;
  };
  
  const handleGenerateInvoice = async () => {
    // Validate
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }
    
    if (lineItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    
    // Calculate totals
    const totals = calculateTotals();

    // Fetch doctor's name and compose enriched notes including DoctorId tag
    let doctorName = '';
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      doctorName = profileData?.full_name || '';
    } catch {}

    const updatedNotes = [
      notes && notes.trim().length > 0 ? notes.trim() : null,
      doctorName ? `Doctor: Dr. ${doctorName}` : null,
      user?.id ? `DoctorId: ${user.id}` : null
    ].filter(Boolean).join(' | ');

    // Generate invoice - without appointment_id field since it doesn't exist in the schema
    const invoiceData = {
      invoice_number: generateInvoiceNumber(),
      invoice_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Default due date: 30 days from now
      patient_id: selectedPatient.id,
      total_amount: totals.total,
      amount_paid: paymentStatus === 'paid' ? totals.total : (paymentStatus === 'partial' ? totals.total / 2 : 0),
      status: paymentStatus,
      payment_method: paymentMethod,
      notes: updatedNotes, // Include appointment info + doctor name + DoctorId
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      created_at: new Date().toISOString(),
      created_by: user.id
      // Removed appointment_id field as it doesn't exist in the schema
    };
    
    setIsLoading(true);
    
    try {
      // Insert invoice
      const { data: invoiceResult, error: invoiceError } = await supabase
        .from('invoices')
        .insert([invoiceData])
        .select('id');
      
      if (invoiceError) throw invoiceError;
      
      // Get invoice ID
      const invoiceId = invoiceResult[0].id;
      
      // Insert invoice items
      const invoiceItems = lineItems.map(item => ({
        invoice_id: invoiceId,
        service_name: item.description,
        description: item.description,
        quantity: item.quantity,
        price: item.unit_price,
        discount: 0,
        created_at: new Date().toISOString()
        // Remove service_id field as it doesn't exist in the schema
      }));
      
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItems);
      
      if (itemsError) throw itemsError;
      
      // Log audit event for invoice creation
      try {
        await logInvoiceCreate({
          id: invoiceId,
          invoice_number: invoiceData.invoice_number,
          patient_id: selectedPatient.id,
          patient_name: selectedPatient.full_name,
          total_amount: totals.total,
          status: paymentStatus,
          payment_method: paymentMethod,
          line_items: lineItems,
          notes: updatedNotes,
          doctor_id: user.id,
          doctor_name: doctorName
        });
      } catch (auditError) {
        console.error('Error logging invoice creation audit event:', auditError);
        // Continue even if audit logging fails
      }
      
      // Reset form
      setSelectedPatient(null);
      setSearchQuery('');
      setLineItems([]);
      setPaymentMethod('');
      setPaymentStatus('pending');
      setNotes('');
      setDiscount(0);
      setTax(0);
      setSelectedAppointment(null);
      setPatientAppointments([]);
      
      toast.success('Invoice generated successfully');
      
      // Reload invoices
      fetchInvoices();
      
      // Switch to history tab
      setActiveTab('history');
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast.error('Failed to generate invoice: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleViewInvoice = async (invoice) => {
    setIsLoading(true);
    try {
      // Always fetch latest items from Supabase
      const { data: items, error: itemsError } = await supabase
        .from('invoice_items')
        .select('id, description, service_name, price, quantity, discount')
        .eq('invoice_id', invoice.id);
      console.log('Fetched invoice items:', { invoiceId: invoice.id, items, itemsError });
      if (itemsError) throw itemsError;
      // Fetch payments for this invoice
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoice.id);
      if (paymentError) throw paymentError;
      // Set selected invoice with latest items and payments
      setSelectedInvoice({
        ...invoice,
        invoice_items: items || [],
        payments: paymentData || []
      });
      setShowInvoicePreview(true);
    } catch (error) {
      console.error('Error fetching invoice details:', error);
      toast.error('Failed to fetch invoice details');
    } finally {
      setIsLoading(false);
    }
  };

  const [relatedProofs, setRelatedProofs] = useState([]); // [{url,isPdf,amount,ref,created_at}]
  const [relatedRefDetails, setRelatedRefDetails] = useState([]); // [{ref, created_at}]
  const [isViewingInvoiceProofs, setIsViewingInvoiceProofs] = useState(false);
  const extractProofUrl = (notes) => {
    if (!notes || !notes.includes('Payment proof:')) return null;
    
    // Get the part after "Payment proof:"
    let url = notes.split('Payment proof: ')[1];
    
    // Handle all possible approval/rejection patterns by removing them
    const patterns = [
      '(Approved by doctor)',
      ' (Approved by doctor)',
      '(Approved)',
      ' (Approved)',
      'Approved by doctor',
      '(Rejected by doctor)',
      ' (Rejected by doctor)',
      '(Rejected)',
      ' (Rejected)',
      'Rejected by doctor',
      /Dr\. .+ rejected your payment\. You need to pay again and attach valid proof of payment\./
    ];
    
    // Remove any matching pattern from the URL
    for (const pattern of patterns) {
      if (typeof pattern === 'string') {
        if (url.includes(pattern)) {
          url = url.split(pattern)[0].trim();
          break;
        }
      } else {
        // Handle regex patterns
        const match = url.match(pattern);
        if (match) {
          url = url.replace(pattern, '').trim();
          break;
        }
      }
    }
    
    return url;
  };
  const loadRelatedProofs = async (payment) => {
    try {
      const invoiceId = payment?.invoice_id;
      if (!invoiceId) { setRelatedProofs([]); return; }
      const { data, error } = await supabase
        .from('payments')
        .select('id, notes, created_at, amount, reference_number, approval_status')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: true });
      if (error) { setRelatedProofs([]); setRelatedRefDetails([]); return; }
      const entries = (data || [])
        .map(p => {
          const url = extractProofUrl(p.notes);
          if (url) {
            const isWhitePlaceholder = url.includes('data:image/svg+xml;base64,');
            return { 
              url, 
              isPdf: url.toLowerCase().includes('.pdf'), 
              amount: parseFloat(p.amount || 0), 
              ref: p.reference_number, 
              created_at: p.created_at,
              isWhitePlaceholder: isWhitePlaceholder,
              approval_status: p.approval_status || 'pending',
              payment_id: p.id
            };
          }
          return null;
        })
        .filter(Boolean);
      
      // Don't deduplicate white placeholder images since each cash payment should show separately
      const seen = new Set();
      const unique = entries.filter(e => {
        if (e.isWhitePlaceholder) {
          // Don't deduplicate white placeholders - each cash payment should show separately
          return true;
        } else {
          // Deduplicate regular proof images
          if (seen.has(e.url)) return false;
          seen.add(e.url);
          return true;
        }
      });
      setRelatedProofs(unique);
      setRelatedRefDetails(unique
        .filter(e => !!e.ref)
        .map(e => ({ ref: e.ref, created_at: e.created_at }))
      );
    } catch {
      setRelatedProofs([]);
      setRelatedRefDetails([]);
    }
  };
  const handleViewPayment = (payment) => {
    setSelectedPayment(payment);
    setIsViewingInvoiceProofs(false); // Reset flag when viewing from payment approvals
    setShowPaymentModal(true);
    loadRelatedProofs(payment);
  };

  const handleApprovePayment = async (paymentId) => {
    try {
      setIsLoading(true);
      const payment = payments.find(p => p.id === paymentId);
      
      if (!payment) {
        toast.error('Payment not found');
        return;
      }

      // Check if payment is already rejected
      if (payment.approval_status === 'rejected') {
        toast.error('Cannot approve a payment that has already been rejected. Patient needs to submit a new payment.');
        return;
      }

      // Try to use the notification hook if available
      let notificationResult = null;
      try {
        if (approvePayment && typeof approvePayment === 'function') {
          notificationResult = await approvePayment(paymentId);
        }
      } catch (notificationError) {
        console.error('Error sending notification:', notificationError);
        // Continue with status update even if notification fails
      }

      // Use this specific format for approval status
      const notes = payment.notes || '';
      let updatedNotes = notes;
      
      // Remove any existing approval/rejection text
      if (updatedNotes.includes('(Approved by doctor)') || updatedNotes.includes('(Rejected by doctor)')) {
        updatedNotes = updatedNotes
          .replace('(Approved by doctor)', '')
          .replace('(Rejected by doctor)', '')
          .trim();
      }
      
      // Add approval text
      updatedNotes = updatedNotes ? `${updatedNotes} (Approved by doctor)` : '(Approved by doctor)';
      
      // Update this payment record
      let { error } = await supabase
        .from('payments')
        .update({ 
          notes: updatedNotes,
          approval_status: 'approved'
        })
        .eq('id', paymentId);
      
      if (error) {
        console.error('Error updating payment:', error);
        toast.error('Failed to approve payment. Please try again.');
        return;
      }

      // Calculate correct amount_paid based only on approved payments (including this newly approved one)
      const invoice = payment.invoices;
      if (invoice) {
        // Fetch all payments for this invoice to calculate correct amount
        const { data: allInvoicePayments, error: paymentsError } = await supabase
          .from('payments')
          .select('amount, approval_status')
          .eq('invoice_id', invoice.id);
        
        if (paymentsError) {
          console.error('Error fetching invoice payments:', paymentsError);
        } else {
          // Calculate amount paid from approved payments only (including the one we just approved)
          const approvedAmount = allInvoicePayments
            .filter(p => p.approval_status === 'approved')
            .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
          
          const totalAmount = parseFloat(invoice.total_amount);
          const newStatus = approvedAmount >= totalAmount ? 'paid' : 'partial';

          const { error: invoiceError } = await supabase
            .from('invoices')
            .update({
              amount_paid: approvedAmount, // Use calculated approved amount
              status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', invoice.id);
          if (invoiceError) throw invoiceError;

          // Note: We don't auto-approve all payments anymore since some might be rejected
        }
      }

      if (notificationResult?.success) {
        toast.success('Payment approved successfully - Patient notified');
      } else {
        toast.success('Payment approved successfully');
      }
      
      // Refresh data
      fetchPayments();
      fetchInvoices();

      // Close payment modal if open
      if (showPaymentModal) {
        setShowPaymentModal(false);
      }
    } catch (error) {
      console.error('Error approving payment:', error);
      toast.error('Failed to approve payment: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRejectPayment = async (paymentId) => {
    try {
      setIsLoading(true);
      const payment = payments.find(p => p.id === paymentId);
      
      if (!payment) {
        toast.error('Payment not found');
        return;
      }

      // Get the doctor's name for the rejection message
      const { data: doctorProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      
      const doctorName = doctorProfile?.full_name || 'Doctor';

      // Try to use the notification hook if available
      let notificationResult = null;
      try {
        if (rejectPayment && typeof rejectPayment === 'function') {
          notificationResult = await rejectPayment(paymentId);
        }
      } catch (notificationError) {
        console.error('Error sending notification:', notificationError);
        // Continue with status update even if notification fails
      }

      // Update payment with rejection status and doctor's name in notes
      const notes = payment.notes || '';
      let updatedNotes = notes;
      
      // Remove any existing approval/rejection text
      if (updatedNotes.includes('(Approved by doctor)') || updatedNotes.includes('(Rejected by doctor)')) {
        updatedNotes = updatedNotes
          .replace(/\(Approved by doctor\)/g, '')
          .replace(/\(Rejected by doctor\)/g, '')
          .replace(/Dr\. .+ rejected your payment\. You need to pay again and attach valid proof of payment\./g, '')
          .trim();
      }
      
      // Add rejection message with doctor's name
      const rejectionMessage = `Dr. ${doctorName} rejected your payment. You need to pay again and attach valid proof of payment.`;
      updatedNotes = updatedNotes ? `${updatedNotes} ${rejectionMessage}` : rejectionMessage;

      // Update payment record with rejection status and notes
      const { error: paymentError } = await supabase
        .from('payments')
        .update({ 
          approval_status: 'rejected',
          notes: updatedNotes
        })
        .eq('id', paymentId);
      
      if (paymentError) {
        console.error('Error updating payment:', paymentError);
        toast.error('Failed to reject payment. Please try again.');
        return;
      }

      // Recalculate invoice amount_paid based only on approved payments (excluding this rejected one)
      const invoice = payment.invoices;
      if (invoice) {
        // Fetch all payments for this invoice to calculate correct amount
        const { data: allInvoicePayments, error: paymentsError } = await supabase
          .from('payments')
          .select('amount, approval_status')
          .eq('invoice_id', invoice.id);
        
        if (paymentsError) {
          console.error('Error fetching invoice payments:', paymentsError);
        } else {
          // Calculate amount paid from approved payments only (excluding the one we just rejected)
          const approvedAmount = allInvoicePayments
            .filter(p => p.approval_status === 'approved')
            .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
          
          const totalAmount = parseFloat(invoice.total_amount);
          let newStatus;
          if (approvedAmount === 0) {
            newStatus = 'pending'; // No approved payments left
          } else if (approvedAmount < totalAmount) {
            newStatus = 'partial'; // Still has some approved payments, but not fully paid
          } else {
            newStatus = 'paid'; // Fully paid with approved payments
          }
          
          const { error: invoiceError } = await supabase
            .from('invoices')
            .update({
              amount_paid: approvedAmount, // Use calculated approved amount
              status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', invoice.id);
          
          if (invoiceError) {
            console.error('Error updating invoice after payment rejection:', invoiceError);
            // Continue anyway since payment rejection succeeded
          }
        }
      }

      if (notificationResult?.success) {
        toast.success('Payment rejected - Patient notified');
      } else {
        toast.success('Payment rejected');
      }
      
      // Refresh data
      fetchPayments();
      fetchInvoices();

      // Close payment modal if open
      if (showPaymentModal) {
        setShowPaymentModal(false);
      }
    } catch (error) {
      console.error('Error rejecting payment:', error);
      toast.error('Failed to reject payment: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'approved':
        return 'bg-green-200 text-green-900 border border-green-300';
      case 'partial':
      case 'pending':
        return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border border-red-200';
      case 'overdue':
        return 'bg-red-100 text-red-800 border border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const getMethodBadgeClass = (method) => {
    switch (method?.toLowerCase()) {
      case 'gcash':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'cash':
        return 'bg-green-100 text-green-800 border border-green-200';
      case 'bank_transfer':
        return 'bg-purple-100 text-purple-800 border border-purple-200';
      case 'other':
        return 'bg-gray-100 text-gray-800 border border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };
  
  const handleEditInvoice = async (invoice) => {
    setIsLoading(true);
    try {
      // Fetch the latest invoice and its items exactly like in create invoice
      const { data: invoiceArr, error: invoiceFetchError } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          invoice_date,
          due_date,
          patient_id,
          total_amount,
          amount_paid,
          status,
          payment_method,
          notes,
          discount,
          tax,
          created_at,
          profiles:patient_id(full_name, phone, email, address)
        `)
        .eq('id', invoice.id);
      if (invoiceFetchError) throw invoiceFetchError;
      if (invoiceArr && invoiceArr[0]) {
        // Fetch all invoice_items for this invoice
        const { data: items, error: itemsError } = await supabase
          .from('invoice_items')
          .select('id, description, service_name, price, quantity, discount')
          .eq('invoice_id', invoice.id);
        if (itemsError) throw itemsError;
        setEditInvoiceData({ ...invoiceArr[0], items: items || [] });
        setOriginalEditInvoiceItems(items || []); // Save original items for diff
        setShowEditInvoiceModal(true);
      }
    } catch (error) {
      toast.error('Failed to load invoice for editing: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewInvoiceProofs = async (invoice) => {
    try {
      setIsLoading(true);
      
      // Fetch all payments for this invoice
      const { data: payments, error } = await supabase
        .from('payments')
        .select('id, amount, reference_number, notes, created_at, approval_status')
        .eq('invoice_id', invoice.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const proofs = [];
      const refDetails = [];

      payments.forEach(payment => {
        const proofUrl = extractProofUrl(payment.notes);
        
        // Check if this is a white placeholder image (for cash payments without proof)
        const isWhitePlaceholder = proofUrl && proofUrl.includes('data:image/svg+xml;base64,');
        
        // Check if this payment is a cash payment
        const isCashPayment = (!proofUrl || 
                              proofUrl.includes('CASH-') || 
                              proofUrl.includes('cash-') ||
                              payment.reference_number?.includes('CASH-') || 
                              payment.reference_number?.includes('cash-') || 
                              payment.notes?.toLowerCase().includes('cash') ||
                              invoice.payment_method === 'cash');
        
        console.log('Proof filtering:', {
          payment_id: payment.id,
          proofUrl,
          isWhitePlaceholder,
          isCashPayment,
          reference_number: payment.reference_number,
          invoice_payment_method: invoice.payment_method
        });
        
        // Add as proof if:
        // 1. It's a valid proof URL (including white placeholders), OR
        // 2. It's a cash payment with white placeholder
        const isValidProof = proofUrl && (isWhitePlaceholder || !isCashPayment);
        
        if (isValidProof) {
          const isPdf = proofUrl.toLowerCase().includes('.pdf');

          proofs.push({
            url: proofUrl,
            isPdf: isPdf,
            amount: payment.amount,
            ref: payment.reference_number,
            created_at: payment.created_at,
            isWhitePlaceholder: isWhitePlaceholder,
            approval_status: payment.approval_status || 'pending',
            payment_id: payment.id
          });
        }

        if (payment.reference_number) {
          refDetails.push({
            ref: payment.reference_number,
            created_at: payment.created_at
          });
        }
      });

      // Don't return early - we want to show cash payments even without proof images
      // if (proofs.length === 0) {
      //   toast.info('No payment proofs found for this invoice');
      //   return;
      // }

      // Set the proofs data and show modal
      setRelatedProofs(proofs);
      setRelatedRefDetails(refDetails);
      setIsViewingInvoiceProofs(true); // Set flag to indicate we're viewing from invoice
      
      console.log('Related proofs length:', proofs.length);
      console.log('Payments data:', payments);
      
      setSelectedPayment({
        id: 'multiple',
        invoice_id: invoice.id,
        invoices: invoice,
        payment_method: 'multiple',
        amount: payments.reduce((sum, p) => sum + (p.amount || 0), 0),
        payment_date: payments[0]?.created_at || new Date().toISOString(),
        reference_number: refDetails.map(r => r.ref).join(', '),
        approval_status: 'pending',
        patientName: invoice.patientName || invoice.profiles?.full_name || 'Unknown Patient',
        invoiceNumber: invoice.invoice_number || 'Unknown'
      });
      setShowPaymentModal(true);
      
    } catch (error) {
      console.error('Error loading invoice proofs:', error);
      toast.error('Failed to load payment proofs: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEditInvoice = async () => {
    if (!editInvoiceData) return;
    setIsLoading(true);
    try {
      const totals = calculateEditInvoiceTotals(editInvoiceData);
      // Update invoice
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          payment_method: editInvoiceData.payment_method,
          status: editInvoiceData.status,
          notes: editInvoiceData.notes,
          total_amount: totals.total,
          amount_paid: editInvoiceData.amount_paid,
          discount: editInvoiceData.discount,
          tax: editInvoiceData.tax,
          updated_at: new Date().toISOString()
        })
        .eq('id', editInvoiceData.id);
      if (invoiceError) throw invoiceError;
      // Prepare sets for diff
      const originalItemIds = new Set(originalEditInvoiceItems.map(item => item.id));
      const currentItemIds = new Set(editInvoiceData.items.map(item => item.id));
      // 1. Update existing items
      for (const item of editInvoiceData.items) {
        if (item.id && originalItemIds.has(item.id)) {
          await supabase.from('invoice_items').update({
            description: item.description,
            service_name: item.description,
            price: item.price,
            quantity: item.quantity,
            discount: item.discount || 0
          }).eq('id', item.id);
        }
      }
      // 2. Insert new items and update their IDs in local state
      for (const item of editInvoiceData.items) {
        if (!item.id) {
          const { data: inserted, error: insertError } = await supabase.from('invoice_items').insert({
            invoice_id: editInvoiceData.id,
            description: item.description,
            service_name: item.description,
            price: item.price,
            quantity: item.quantity,
            discount: item.discount || 0
          }).select('id');
          console.log('Insert result:', { insertError, inserted, item });
          if (insertError) throw insertError;
          if (inserted && inserted[0]) item.id = inserted[0].id;
        }
      }
      // 3. Delete removed items
      for (const origItem of originalEditInvoiceItems) {
        if (!currentItemIds.has(origItem.id)) {
          await supabase.from('invoice_items').delete().eq('id', origItem.id);
        }
      }
      // Always re-fetch the latest invoice and its items after save
      await fetchInvoices();
      // Fetch the latest invoice and its items exactly like in create invoice
      const { data: invoiceArr, error: invoiceFetchError } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          invoice_date,
          due_date,
          patient_id,
          total_amount,
          amount_paid,
          status,
          payment_method,
          notes,
          discount,
          tax,
          created_at,
          profiles:patient_id(full_name, phone, email, address)
        `)
        .eq('id', editInvoiceData.id);
      if (invoiceFetchError) throw invoiceFetchError;
      if (invoiceArr && invoiceArr[0]) {
        // Fetch all invoice_items for this invoice
        const { data: items, error: itemsError } = await supabase
          .from('invoice_items')
          .select('id, description, service_name, price, quantity, discount')
          .eq('invoice_id', editInvoiceData.id);
        if (itemsError) throw itemsError;
        setSelectedInvoice({
          ...invoiceArr[0],
          invoice_items: items || []
        });
        setShowInvoicePreview(true);
      }
      toast.success('Invoice updated successfully');
      setShowEditInvoiceModal(false);
    } catch (error) {
      toast.error('Failed to update invoice: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Add a helper to calculate totals for editInvoiceData
  const calculateEditInvoiceTotals = (editData) => {
    const subtotal = editData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = editData.discount || 0;
    const tax = editData.tax || 0;
    const afterDiscount = subtotal - discount;
    const taxAmount = afterDiscount * (tax / 100);
    const total = afterDiscount + taxAmount;
    return { subtotal, discount, tax, taxAmount, total };
  };
  
  // Function to check for orphaned payments and help debug the issue
  const checkPaymentAssignments = async () => {
    try {
      console.log('=== CHECKING PAYMENT ASSIGNMENTS ===');
      
      // Get all payments
      const { data: allPayments, error: paymentError } = await supabase
        .from('payments')
        .select('id, invoice_id, amount, approval_status, created_at')
        .order('created_at', { ascending: false });
      
      if (paymentError) {
        console.error('Error fetching payments:', paymentError);
        return;
      }
      
      // Get all invoices
      const { data: allInvoices, error: invoiceError } = await supabase
        .from('invoices')
        .select('id, invoice_number, notes, created_by, patient_id, created_at')
        .order('created_at', { ascending: false });
      
      if (invoiceError) {
        console.error('Error fetching invoices:', invoiceError);
        return;
      }
      
      console.log('Total payments in database:', allPayments.length);
      console.log('Total invoices in database:', allInvoices.length);
      
      // Check which payments have invoices with doctor assignments
      const paymentsWithDoctorAssignments = allPayments.filter(payment => {
        const invoice = allInvoices.find(inv => inv.id === payment.invoice_id);
        if (!invoice) return false;
        
        // Check if invoice has doctor assignment
        return invoice.notes && (
          invoice.notes.includes('Doctor: Dr.') ||
          invoice.notes.includes('Assigned Doctor: Dr.') ||
          invoice.notes.includes(' - Doctor: Dr.')
        );
      });
      
      console.log('Payments with doctor assignments:', paymentsWithDoctorAssignments.length);
      
      // Check which payments have invoices without doctor assignments
      const paymentsWithoutDoctorAssignments = allPayments.filter(payment => {
        const invoice = allInvoices.find(inv => inv.id === payment.invoice_id);
        if (!invoice) return false;
        
        // Check if invoice has no doctor assignment
        return !invoice.notes || !(
          invoice.notes.includes('Doctor: Dr.') ||
          invoice.notes.includes('Assigned Doctor: Dr.') ||
          invoice.notes.includes(' - Doctor: Dr.')
        );
      });
      
      console.log('Payments WITHOUT doctor assignments:', paymentsWithoutDoctorAssignments.length);
      
      // Show examples of payments without doctor assignments
      if (paymentsWithoutDoctorAssignments.length > 0) {
        console.log('Examples of payments without doctor assignments:');
        paymentsWithoutDoctorAssignments.slice(0, 5).forEach(payment => {
          const invoice = allInvoices.find(inv => inv.id === payment.invoice_id);
          console.log({
            paymentId: payment.id,
            amount: payment.amount,
            invoiceId: payment.invoice_id,
            invoiceNotes: invoice?.notes || 'No notes',
            invoiceCreatedBy: invoice?.created_by || 'Unknown'
          });
        });
      }
      
      // Check current doctor's specific payments
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      
      const doctorName = profileData?.full_name || '';
      console.log('Current doctor name:', doctorName);
      
      // Check which payments should be shown for this doctor
      const paymentsForThisDoctor = allPayments.filter(payment => {
        const invoice = allInvoices.find(inv => inv.id === payment.invoice_id);
        if (!invoice) return false;
        
        // If created by this doctor, include it
        if (invoice.created_by === user.id) return true;
        
        // If notes contain this doctor's name, include it
        if (invoice.notes && doctorName) {
          const doctorPatterns = [
            `Doctor: Dr. ${doctorName}`,
            `Assigned Doctor: Dr. ${doctorName}`,
            `Dr. ${doctorName}`,
            `- Doctor: Dr. ${doctorName}`,
            ` - Doctor: Dr. ${doctorName}`
          ];
          
          return doctorPatterns.some(pattern => 
            invoice.notes.includes(pattern)
          );
        }
        
        return false;
      });
      
      console.log('Payments that should be shown for this doctor:', paymentsForThisDoctor.length);
      console.log('Payment details for this doctor:', paymentsForThisDoctor.map(p => ({
        id: p.id,
        amount: p.amount,
        invoiceId: p.invoice_id
      })));
      
      console.log('=== END PAYMENT ASSIGNMENT CHECK ===');
      
    } catch (error) {
      console.error('Error checking payment assignments:', error);
    }
  };
  
  if (isLoading && invoices.length === 0 && payments.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-2 sm:p-4 lg:p-6">
      <div className="w-full max-w-none mx-auto h-full">
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden min-h-[calc(100vh-2rem)] sm:min-h-[calc(100vh-2rem)] lg:min-h-[calc(100vh-3rem)]">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Billing Management</h1>
                <p className="text-blue-100 mt-1 text-sm sm:text-base">Create invoices and manage payments efficiently</p>
              </div>
              <div className="flex space-x-3 w-full sm:w-auto">
                <button
                  onClick={checkPaymentAssignments}
                  className="px-3 sm:px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 text-xs sm:text-sm font-medium flex-1 sm:flex-none"
                >
                  Check Payments
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-auto">
            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6 lg:mb-8">
              <nav className="flex flex-wrap gap-2 sm:gap-4 lg:space-x-8 lg:gap-0">
                <button
                  onClick={() => {
                    setActiveTab('history');
                    fetchInvoices();
                    fetchPayments();
                  }}
                  className={`py-3 px-4 sm:py-4 sm:px-6 border-b-3 font-semibold text-xs sm:text-sm transition-all duration-200 ${
                    activeTab === 'history'
                      ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } rounded-t-lg flex-shrink-0`}
                >
                  <div className="flex items-center space-x-2">
                    <FiFileText className="h-4 w-4" />
                    <span>Billing History</span>
                    {payments.filter(p => p.approval_status === 'pending').length > 0 && (
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {payments.filter(p => p.approval_status === 'pending').length}
                      </span>
                    )}
                  </div>
                </button>
              </nav>
            </div>

            {/* Content */}
            <div>
              {false && (
                <div className="space-y-8">
                  {/* Patient Selection */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                    <div className="flex items-center mb-4">
                      <FiUser className="h-5 w-5 text-blue-600 mr-2" />
                      <h3 className="text-lg font-semibold text-gray-900">Patient Information</h3>
                    </div>
                    
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiSearch className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        placeholder="Search patient by name or phone..."
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setShowPatientDropdown(true);
                          if (!e.target.value) {
                            setSelectedPatient(null);
                          }
                        }}
                        onFocus={() => setShowPatientDropdown(true)}
                      />
                      {showPatientDropdown && filteredPatients.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full bg-white shadow-xl rounded-lg max-h-60 overflow-y-auto border border-gray-200">
                          <ul className="py-1">
                            {filteredPatients.map((patient) => (
                              <li
                                key={patient.id}
                                className="px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors duration-150 border-b border-gray-100 last:border-b-0"
                                onClick={() => handlePatientSelect(patient)}
                              >
                                <div className="font-medium text-gray-900">{patient.full_name}</div>
                                {patient.phone && (
                                  <div className="text-sm text-gray-500">{patient.phone}</div>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    
                    {selectedPatient && (
                      <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200 shadow-sm">
                        <div className="text-sm">
                          <div className="font-semibold text-blue-700 mb-2">Selected Patient:</div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div><span className="font-medium">Name:</span> {selectedPatient.full_name}</div>
                            {selectedPatient.phone && <div><span className="font-medium">Phone:</span> {selectedPatient.phone}</div>}
                            {selectedPatient.email && <div><span className="font-medium">Email:</span> {selectedPatient.email}</div>}
                            {selectedPatient.address && <div className="md:col-span-2"><span className="font-medium">Address:</span> {selectedPatient.address}</div>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Appointment Selection */}
                  {selectedPatient && patientAppointments.length > 0 && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                      <div className="flex items-center mb-4">
                        <FiCalendar className="h-5 w-5 text-green-600 mr-2" />
                        <h3 className="text-lg font-semibold text-gray-900">Appointment Selection</h3>
                        <span className="ml-2 text-sm text-gray-500">(Optional)</span>
                      </div>
                      
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiClock className="h-5 w-5 text-gray-400" />
                        </div>
                        <button
                          type="button"
                          className="block w-full pl-10 pr-3 py-3 text-left border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm bg-white hover:bg-gray-50 transition-colors duration-150"
                          onClick={() => setShowAppointmentDropdown(!showAppointmentDropdown)}
                        >
                          {selectedAppointment 
                            ? `${selectedAppointment.formattedDate} at ${selectedAppointment.formattedTime}` 
                            : 'Select a completed appointment...'}
                        </button>
                        {showAppointmentDropdown && (
                          <div className="absolute z-10 mt-1 w-full bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200">
                            <ul className="max-h-60 overflow-y-auto py-1">
                              {patientAppointments.map((appointment) => (
                                <li
                                  key={appointment.id}
                                  className="px-4 py-3 hover:bg-green-50 cursor-pointer transition-colors duration-150 border-b border-gray-100 last:border-b-0"
                                  onClick={() => handleAppointmentSelect(appointment)}
                                >
                                  <div className="font-medium text-gray-900">
                                    {appointment.formattedDate} at {appointment.formattedTime}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {appointment.branch} {appointment.teeth_involved && `- Teeth: ${appointment.teeth_involved}`}
                                  </div>
                                  {appointment.notes && (
                                    <div className="text-xs text-gray-500 mt-1 truncate">
                                      {appointment.notes}
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      {selectedAppointment && (
                        <div className="mt-3 p-3 bg-white rounded-lg border border-green-200">
                          <p className="text-sm text-green-700 font-medium">
                            ✓ Services from this appointment will be added to the invoice
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Services Section */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-gray-200">
                      <div className="flex items-center">
                        <FiActivity className="h-5 w-5 text-purple-600 mr-2" />
                        <h3 className="text-lg font-semibold text-gray-900">Services & Products</h3>
                      </div>
                    </div>
                    
                    <div className="p-6">
                      {/* Available Services */}
                      {selectedPatient && allServices.length > 0 && (
                        <div className="mb-6">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">Quick Add Services:</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {allServices.map(service => (
                              <button
                                key={service.id}
                                type="button"
                                onClick={() => handleAddService(service)}
                                className="px-4 py-3 border border-gray-300 text-sm rounded-lg hover:bg-blue-50 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 flex justify-between items-center transition-all duration-150 group"
                              >
                                <span className="truncate pr-2 group-hover:text-blue-700">{service.name}</span>
                                <span className="text-gray-600 font-medium group-hover:text-blue-600">{formatCurrency(service.price)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Add Custom Item */}
                      <div className="grid grid-cols-12 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                        <div className="col-span-12 md:col-span-5">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Service/Product Description</label>
                          <input 
                            type="text" 
                            placeholder="Enter description..."
                            className="block w-full border border-gray-300 rounded-lg shadow-sm py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            value={tempItem.description}
                            onChange={(e) => setTempItem({...tempItem, description: e.target.value})}
                          />
                        </div>
                        <div className="col-span-12 md:col-span-3">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Unit Price (₱)</label>
                          <input 
                            type="number" 
                            placeholder="0.00"
                            className="block w-full border border-gray-300 rounded-lg shadow-sm py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-right"
                            value={tempItem.unit_price}
                            onChange={(e) => setTempItem({...tempItem, unit_price: e.target.value})}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="col-span-12 md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                          <input 
                            type="number" 
                            placeholder="1"
                            className="block w-full border border-gray-300 rounded-lg shadow-sm py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            value={tempItem.quantity}
                            onChange={(e) => setTempItem({...tempItem, quantity: e.target.value})}
                            min="1"
                          />
                        </div>
                        <div className="col-span-12 md:col-span-2 flex items-end">
                          <button
                            type="button"
                            className="w-full inline-flex justify-center items-center px-4 py-2.5 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-150"
                            onClick={handleAddLineItem}
                          >
                            <FiPlus className="mr-2" />
                            Add
                          </button>
                        </div>
                      </div>
                      
                      {/*Line Items Table */}
                      {lineItems.length > 0 ? (
                        <div className="overflow-hidden border border-gray-200 rounded-lg">
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Description
                                  </th>
                                  <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Unit Price
                                  </th>
                                  <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Qty
                                  </th>
                                  <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Total
                                  </th>
                                  <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Action
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {lineItems.map((item) => (
                                  <tr key={item.id} className="hover:bg-gray-50 transition-colors duration-150">
                                    <td className="px-6 py-4 text-sm text-gray-900">
                                      <div className="font-medium">{item.description}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                                      {formatCurrency(item.unit_price)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                      {item.quantity}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-semibold">
                                      {formatCurrency(item.total)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                      <button
                                        onClick={() => handleRemoveLineItem(item.id)}
                                        className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50 transition-colors duration-150"
                                        title="Remove item"
                                      >
                                        <FiTrash2 className="h-4 w-4" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                          <FiFileText className="mx-auto h-12 w-12 text-gray-400" />
                          <p className="mt-2 text-gray-500">No items added yet</p>
                          <p className="text-sm text-gray-400">Add services or products using the form above</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/*Payment & Settings */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
                    {/* Payment Details */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6">
                  <div className="flex items-center mb-4">
                    <FiCreditCard className="h-5 w-5 text-green-600 mr-2" />
                    <h3 className="text-lg font-semibold text-gray-900">Payment Discount</h3>
                  </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Discount Type</label>
                                                  <select
                          className="block w-full pl-3 pr-10 py-2.5 border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm rounded-lg"
                          value={discountType}
                          onChange={(e) => {
                              setDiscountType(e.target.value);
                              // Set default discount values based on type
                              if (e.target.value === 'pwd') {
                                setDiscount(20);
                              } else if (e.target.value === 'senior') {
                                setDiscount(20);
                              } else if (e.target.value === 'student') {
                                setDiscount(10);
                              } else if (e.target.value === 'veteran') {
                                setDiscount(20);
                              } else if (e.target.value === 'percentage') {
                                setDiscount(0);
                              } else if (e.target.value === 'amount') {
                                setDiscount(0);
                              }
                            }}
                          >
                            <option value="">Select Discount Type</option>
                            <option value="pwd">PWD (20%)</option>
                            <option value="senior">Senior Citizen (20%)</option>
                            <option value="student">Student (10%)</option>
                            <option value="veteran">Veteran (20%)</option>
                            <option value="percentage">Custom Percentage (%)</option>
                            <option value="amount">Custom Amount (₱)</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Discount Value</label>
                          <div className="flex rounded-lg shadow-sm">
                            <input
                              type="number"
                              className="flex-1 border border-gray-300 rounded-l-lg shadow-sm py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="0"
                              value={discount}
                              onChange={(e) => handleDiscountChange(e.target.value)}
                              min="0"
                              max={discountType === 'percentage' ? 100 : undefined}
                              disabled={['pwd', 'senior', 'student', 'veteran'].includes(discountType)}
                            />
                            <div className="border-l-0 border-gray-300 rounded-r-lg shadow-sm py-2.5 px-3 text-sm bg-gray-50 flex items-center">
                              {discountType === 'percentage' || ['pwd', 'senior', 'student', 'veteran'].includes(discountType) ? '%' : '₱'}
                          </div>
                          </div>
                          {['pwd', 'senior', 'student', 'veteran'].includes(discountType) && (
                            <p className="text-xs text-gray-500 mt-1">
                              {discountType === 'pwd' && 'PWD discount is mandated by Philippine law'}
                              {discountType === 'senior' && 'Senior Citizen discount is mandated by Philippine law'}
                              {discountType === 'student' && 'Student discount for valid student ID holders'}
                              {discountType === 'veteran' && 'Veteran discount for military veterans'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Notes & Summary */}
                    <div className="space-y-6">
                      {/* Notes */}
                      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
                        <textarea
                          rows="4"
                          className="block w-full border border-gray-300 rounded-lg shadow-sm py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Add any additional notes or appointment details..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        ></textarea>
                      </div>

                      {/* Totals */}
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4 sm:p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Summary</h3>
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Subtotal:</span>
                            <span className="font-medium text-gray-900">{formatCurrency(subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">
                              Discount {discountType && discount > 0 && (
                                discountType === 'pwd' ? '(PWD)' :
                                discountType === 'senior' ? '(Senior Citizen)' :
                                discountType === 'student' ? '(Student)' :
                                discountType === 'veteran' ? '(Veteran)' :
                                discountType === 'percentage' ? '(Custom %)' :
                                discountType === 'amount' ? '(Custom Amount)' : ''
                              )}:
                            </span>
                            <span className="font-medium text-gray-900">
                              -{formatCurrency(discountType === 'percentage' || ['pwd', 'senior', 'student', 'veteran'].includes(discountType) ? (subtotal * discount) / 100 : discount)}
                              {['pwd', 'senior', 'student', 'veteran', 'percentage'].includes(discountType) && discount > 0 && ` (${discount}%)`}
                            </span>
                          </div>
                          {tax > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Tax ({tax}%):</span>
                              <span className="font-medium text-gray-900">{formatCurrency((subtotal - (discountType === 'percentage' ? (subtotal * discount) / 100 : discount)) * tax / 100)}</span>
                            </div>
                          )}
                          <div className="border-t border-blue-200 pt-3">
                            <div className="flex justify-between text-lg font-bold">
                              <span className="text-blue-700">Total Amount:</span>
                              <span className="text-blue-700">
                                {formatCurrency(
                                  subtotal - 
                                  (discountType === 'percentage' ? (subtotal * discount) / 100 : discount) + 
                                  ((subtotal - (discountType === 'percentage' ? (subtotal * discount) / 100 : discount)) * tax / 100)
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Generate Button */}
                  <div className="flex justify-end pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleGenerateInvoice}
                      disabled={!selectedPatient || lineItems.length === 0}
                    >
                      <FiFileText className="mr-2 h-5 w-5" />
                      Generate Invoice
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div>
                  {/* History View Selector */}
                  <div className="border-b border-gray-200 mb-6">
                    <nav className="flex space-x-8">
                      <button
                        onClick={() => setHistoryView('invoices')}
                        className={`py-4 px-6 border-b-3 font-semibold text-sm transition-all duration-200 ${
                          historyView === 'invoices'
                            ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } rounded-t-lg`}
                      >
                        <div className="flex items-center space-x-2">
                          <FiFileText className="h-4 w-4" />
                          <span>Invoices</span>
                          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-medium">
                            {filteredInvoices.length}
                          </span>
                        </div>
                      </button>
                      <button
                        onClick={() => setHistoryView('payments')}
                        className={`py-4 px-6 border-b-3 font-semibold text-sm transition-all duration-200 ${
                          historyView === 'payments'
                            ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } rounded-t-lg`}
                      >
                        <div className="flex items-center space-x-2">
                          <FiCreditCard className="h-4 w-4" />
                          <span>Payment Approvals</span>
                          {payments.filter(p => p.approval_status === 'pending').length > 0 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 animate-pulse">
                              {payments.filter(p => p.approval_status === 'pending').length}
                            </span>
                          )}
                        </div>
                      </button>
                    </nav>
                  </div>

                  {/* Content for Invoices View */}
                  {historyView === 'invoices' && (
                    <>
                      <div className="flex flex-col gap-4 mb-6">
                        <div className="relative w-full">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FiSearch className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            type="text"
                            placeholder="Search invoices by number or patient..."
                            className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            value={invoiceSearchQuery}
                            onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                          />
                        </div>
                      </div>

                      <div id="invoice-history" className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                          <h3 className="text-lg font-semibold text-gray-900">Invoice History</h3>
                          <p className="mt-1 text-sm text-gray-600">Manage and track all patient invoices</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            <button 
                              onClick={() => setStatusFilter('all')}
                              className={`inline-flex items-center px-2 py-1 rounded-full font-medium cursor-pointer transition-colors ${
                                statusFilter === 'all' 
                                  ? 'bg-green-200 text-green-900 ring-2 ring-green-300' 
                                  : 'bg-green-100 text-green-800 hover:bg-green-200'
                              }`}
                            >
                              All Invoices
                            </button>
                            <button 
                              onClick={() => setStatusFilter(statusFilter === 'partial' ? 'all' : 'partial')}
                              className={`inline-flex items-center px-2 py-1 rounded-full font-medium cursor-pointer transition-colors ${
                                statusFilter === 'partial' 
                                  ? 'bg-blue-200 text-blue-900 ring-2 ring-blue-300' 
                                  : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                              }`}
                            >
                              Partial Payments
                            </button>
                            <button 
                              onClick={() => setStatusFilter(statusFilter === 'today-pending' ? 'all' : 'today-pending')}
                              className={`inline-flex items-center px-2 py-1 rounded-full font-medium cursor-pointer transition-colors ${
                                statusFilter === 'today-pending' 
                                  ? 'bg-amber-300 text-amber-900 ring-2 ring-amber-400' 
                                  : 'bg-amber-200 text-amber-900 hover:bg-amber-300'
                              }`}
                            >
                              Today Pending
                            </button>
                            <button 
                              onClick={() => setStatusFilter(statusFilter === 'other-pending' ? 'all' : 'other-pending')}
                              className={`inline-flex items-center px-2 py-1 rounded-full font-medium cursor-pointer transition-colors ${
                                statusFilter === 'other-pending' 
                                  ? 'bg-orange-200 text-orange-900 ring-2 ring-orange-300' 
                                  : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                              }`}
                            >
                              Pending (Others)
                            </button>
                            <button 
                              onClick={() => setStatusFilter(statusFilter === 'paid' ? 'all' : 'paid')}
                              className={`inline-flex items-center px-2 py-1 rounded-full font-medium cursor-pointer transition-colors ${
                                statusFilter === 'paid' 
                                  ? 'bg-gray-200 text-gray-900 ring-2 ring-gray-300' 
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              Paid
                            </button>
                          </div>
                        </div>
                        </div>
                        
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                          {filteredInvoices.length > 0 ? (
                            <table className="min-w-full divide-y divide-gray-200 table-auto w-full">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th scope="col" className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Invoice #
                                  </th>
                                  <th scope="col" className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Patient
                                  </th>
                                  <th scope="col" className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                                    Doctor
                                  </th>
                                  <th scope="col" className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                                    Date
                                  </th>
                                  <th scope="col" className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Amount
                                  </th>
                                  <th scope="col" className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Status
                                  </th>
                                  <th scope="col" className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {filteredInvoices.map((invoice) => (
                                  <tr key={invoice.id} className={`transition-colors duration-150 ${
                                    hasRejectedPayments(invoice.id)
                                      ? 'bg-red-50 hover:bg-red-50/90 border-l-4 border-red-500 ring-1 ring-red-200'
                                      : invoice.status === 'pending' && new Date(invoice.invoice_date).toDateString() === new Date().toDateString()
                                      ? 'bg-amber-100 hover:bg-amber-100/90 border-l-4 border-amber-500 ring-1 ring-amber-200'
                                      : invoice.status === 'pending'
                                      ? 'bg-orange-50 hover:bg-orange-50/90'
                                      : 'hover:bg-gray-50'
                                  }`}>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                      <div className="text-sm font-semibold text-blue-600">#{invoice.invoice_number}</div>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                      <div className="text-sm font-medium text-gray-900">{invoice.patientName}</div>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">
                                      {invoice.assignedDoctor ? (
                                        <div className="text-sm text-primary-600 font-medium">
                                          Dr. {invoice.assignedDoctor}
                                        </div>
                                      ) : (
                                        <div className="text-sm text-gray-400 italic">
                                          Not assigned
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">
                                      {invoice.formattedDate}
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                                      {invoice.formattedTotal}
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                                      <div className="flex flex-col items-center space-y-1">
                                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                                          ${getStatusBadgeClass(invoice.status)}`}>
                                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                                        </span>
                                        {hasRejectedPayments(invoice.id) && (
                                          <div className="flex items-center justify-center px-2 py-1 bg-red-100 border border-red-300 rounded-md">
                                            <svg className="h-3 w-3 mr-1 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                            </svg>
                                            <span className="text-xs text-red-700 font-semibold">Rejected Payments</span>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
                                      <div className="flex justify-end space-x-1 sm:space-x-2">
                                        <button
                                          onClick={() => handleViewInvoice(invoice)}
                                          className="p-1 sm:p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors duration-150"
                                          title="View invoice"
                                        >
                                          <FiEye className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            setSelectedInvoice(invoice);
                                            setShowUnifiedPrinter(true);
                                          }}
                                          className="p-1 sm:p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors duration-150 hidden sm:inline-flex"
                                          title="Print invoice"
                                        >
                                          <FiPrinter className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() => handleViewInvoiceProofs(invoice)}
                                          className="p-1 sm:p-2 text-purple-600 hover:text-purple-900 hover:bg-purple-50 rounded-lg transition-colors duration-150 hidden md:inline-flex"
                                          title="View payment proofs"
                                        >
                                          <FiFileText className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="p-12 text-center">
                              <FiFileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                              <p className="text-gray-500 text-lg font-medium">No invoices found</p>
                              <p className="text-gray-400 text-sm">No invoices match your current search criteria</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Content for Payment Approvals View */}
                  {historyView === 'payments' && (
                    <>
                      <div className="flex flex-col gap-4 mb-6">
                        <div className="relative w-full">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FiSearch className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            type="text"
                            placeholder="Search payments by patient or reference..."
                            className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            value={paymentSearchQuery}
                            onChange={(e) => setPaymentSearchQuery(e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <select
                            className="flex-1 block pl-3 pr-10 py-2.5 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm rounded-lg"
                            value={paymentStatusFilter}
                            onChange={(e) => setPaymentStatusFilter(e.target.value)}
                          >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending Approval</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                          <button 
                            className="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-150 sm:flex-shrink-0"
                            onClick={fetchPayments}
                            title="Refresh Payments"
                          >
                            <FiFilter className="h-5 w-5 text-gray-500" />
                          </button>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4 border-b border-gray-200">
                          <h3 className="text-lg font-semibold text-gray-900">Payment Approvals</h3>
                          <p className="mt-1 text-sm text-gray-600">Review and approve patient payment submissions</p>
                        </div>
                        
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                          {filteredPayments.length > 0 ? (
                            <table className="min-w-full divide-y divide-gray-200 table-auto w-full">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th scope="col" className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Patient
                                  </th>
                                  <th scope="col" className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                                    Doctor
                                  </th>
                                  <th scope="col" className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Invoice
                                  </th>
                                  <th scope="col" className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Amount
                                  </th>
                                  <th scope="col" className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                                    Date
                                  </th>
                                  <th scope="col" className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                                    Method
                                  </th>
                                  <th scope="col" className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                                    Payment Type
                                  </th>
                                  <th scope="col" className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Status
                                  </th>
                                  <th scope="col" className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {filteredPayments.map((payment) => (
                                  <tr key={payment.id} className="hover:bg-gray-50 transition-colors duration-150">
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                      <div className="text-sm font-medium text-gray-900">{payment.patientName}</div>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">
                                      {payment.assignedDoctor ? (
                                        <div className="text-sm text-primary-600 font-medium">
                                          Dr. {payment.assignedDoctor}
                                        </div>
                                      ) : (
                                        <div className="text-sm text-gray-400 italic">
                                          Not assigned
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                      <div className="text-sm font-semibold text-blue-600">#{payment.invoiceNumber}</div>
                                      {payment.invoices && (
                                        <div className="text-xs text-gray-500 mt-1">
                                          Invoice Status: 
                                          <span className={`ml-1 px-2 py-0.5 text-xs font-semibold rounded-full ${
                                            payment.invoices.status === 'paid' ? 'bg-green-100 text-green-800' :
                                            payment.invoices.status === 'partial' ? 'bg-blue-100 text-blue-800' :
                                            'bg-gray-100 text-gray-800'
                                          }`}>
                                            {payment.invoices.status === 'paid' ? 'Paid' :
                                             payment.invoices.status === 'partial' ? 'Partial' :
                                             payment.invoices.status || 'Pending'}
                                          </span>
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
                                      {payment.invoices ? (
                                        <>
                                          <div className="text-xs text-gray-500">Remaining:</div>
                                          <div className="text-sm text-gray-900">{formatCurrency(Math.max((parseFloat(payment.invoices.total_amount || 0)) - (parseFloat(payment.invoices.amount_paid || 0)), 0))}</div>
                                          <div className="text-xs text-gray-500 mt-1">Paid: ₱{parseFloat(payment.invoices.amount_paid || 0).toFixed(2)}</div>
                                          <div className="text-xs text-gray-500">Total: ₱{parseFloat(payment.invoices.total_amount || 0).toFixed(2)}</div>
                                        </>
                                      ) : (
                                        <div className="text-sm text-gray-900">{payment.formattedAmount}</div>
                                      )}
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">
                                      {payment.formattedDate}
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden md:table-cell">
                                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getMethodBadgeClass(payment.payment_method)}`}>
                                        {payment.payment_method}
                                      </span>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center hidden lg:table-cell">
                                      {(() => {
                                        if (!payment.invoices) return '-';
                                        const currentPaid = parseFloat(payment.invoices.amount_paid || 0);
                                        const totalAmount = parseFloat(payment.invoices.total_amount || 0);
                                        const paymentAmount = parseFloat(payment.amount || 0);
                                        const projected = currentPaid + paymentAmount;
                                        const isPartial = projected < totalAmount;
                                        
                                        return (
                                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            isPartial ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                          }`}>
                                            {isPartial ? 'Partial Payment' : 'Full Payment'}
                                          </span>
                                        );
                                      })()}
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(payment.approval_status)}`}>
                                        {payment.approval_status === 'approved' ? 'Approved' : 
                                        payment.approval_status === 'rejected' ? 'Rejected' : 'Pending'}
                                      </span>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
                                      <div className="flex justify-end space-x-1 sm:space-x-2">
                                        <button
                                          onClick={() => handleViewPayment(payment)}
                                          className="p-1 sm:p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors duration-150"
                                          title="View details"
                                        >
                                          <FiEye className="h-4 w-4" />
                                        </button>
                                        
                                        {payment.approval_status === 'pending' && (
                                          <>
                                            <button
                                              onClick={() => handleApprovePayment(payment.id)}
                                              className="p-1 sm:p-2 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-lg transition-colors duration-150"
                                              title="Approve payment"
                                            >
                                              <FiCheck className="h-4 w-4" />
                                            </button>
                                            <button
                                              onClick={() => handleRejectPayment(payment.id)}
                                              className="p-1 sm:p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors duration-150"
                                              title="Reject Pending Last Payment"
                                            >
                                              <FiX className="h-4 w-4" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="p-12 text-center">
                              <FiCreditCard className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                              <p className="text-gray-500 text-lg font-medium">No payments found</p>
                              <p className="text-gray-400 text-sm">No payments match your current search criteria</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/*Invoice Preview Modal */}
      {showInvoicePreview && selectedInvoice && (
        <div className="fixed inset-0 overflow-y-auto z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-white">
                Invoice #{selectedInvoice.invoice_number}
              </h3>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => InvoicePDF.generateInvoicePDF(selectedInvoice, toast)}
                  className="inline-flex items-center px-4 py-2 border border-white/20 text-sm font-medium rounded-lg text-white bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white transition-all duration-150"
                >
                  <FiDownload className="mr-2 h-4 w-4" />
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInvoicePreview(false);
                    setShowUnifiedPrinter(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-white/20 text-sm font-medium rounded-lg text-white bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white transition-all duration-150"
                >
                  <FiPrinter className="mr-2 h-4 w-4" />
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => setShowInvoicePreview(false)}
                  className="inline-flex items-center p-2 border border-white/20 rounded-lg text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white transition-all duration-150"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {/* Invoice Preview Content */}
            <div className="p-6 max-h-[80vh] overflow-y-auto">
              <div className="max-w-4xl mx-auto bg-white">
                {/* Invoice Header */}
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h1 className="text-4xl font-bold text-gray-800 mb-3">INVOICE</h1>
                    <div className="text-gray-600 space-y-1">
                      <p className="text-lg font-semibold text-blue-600">Silario Dental Clinic</p>
                      <p>Cabugao/San Juan, Ilocos Sur</p>
                      <p>silaroidentalclinic@gmail.com</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600 mb-3">#{selectedInvoice.invoice_number}</p>
                    <div className="text-gray-600 space-y-1">
                      <p><span className="font-medium">Date:</span> {new Date(selectedInvoice.invoice_date).toLocaleDateString()}</p>
                      <p><span className="font-medium">Due Date:</span> {new Date(selectedInvoice.due_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {/* Rejection Warning */}
                {hasRejectedPayments(selectedInvoice.id) && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-start">
                      <svg className="h-5 w-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <h4 className="text-sm font-medium text-red-800">Payment Rejected</h4>
                        <p className="text-sm text-red-700 mt-1">
                          {getRejectionMessage(selectedInvoice.id) || 'This invoice has rejected payments that need to be resubmitted.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Bill To Section */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-8 border border-blue-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
                        <FiUser className="mr-2 h-5 w-5 text-blue-600" />
                        Billed To
                      </h2>
                      <div className="text-gray-700 space-y-1">
                        <p className="font-semibold text-lg">{selectedInvoice.patientName}</p>
                        {selectedInvoice.profiles?.address && (
                          <p>{selectedInvoice.profiles.address}</p>
                        )}
                        {selectedInvoice.profiles?.phone && (
                          <p>{selectedInvoice.profiles.phone}</p>
                        )}
                        {selectedInvoice.profiles?.email && (
                          <p>{selectedInvoice.profiles.email}</p>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
                        <FiCreditCard className="mr-2 h-5 w-5 text-green-600" />
                        Payment Information
                      </h2>
                      <div className="text-gray-700 space-y-1">
                        <p><span className="font-medium">Method:</span> {selectedInvoice.payment_method || 'Not specified'}</p>
                        <p><span className="font-medium">Status:</span> 
                          <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(selectedInvoice.status)}`}>
                            {selectedInvoice.status.charAt(0).toUpperCase() + selectedInvoice.status.slice(1)}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Invoice Items Table */}
                <div className="mb-8 overflow-hidden rounded-lg border border-gray-200 shadow-sm">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                      <tr>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Unit Price
                        </th>
                        <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Quantity
                        </th>
                        <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedInvoice.invoice_items && selectedInvoice.invoice_items.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50 transition-colors duration-150">
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="font-medium">{item.service_name || item.description}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                            {formatCurrency(item.price)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {item.quantity}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-semibold">
                            {formatCurrency(item.price * item.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Invoice Summary */}
                <div className="flex justify-end mb-8">
                  <div className="w-full md:w-80">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Summary</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Subtotal:</span>
                          <span className="font-medium text-gray-900">{formatCurrency(selectedInvoice.subtotal || selectedInvoice.total_amount)}</span>
                        </div>
                        
                        {selectedInvoice.discount > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Discount:</span>
                            <span className="font-medium text-gray-900">-{formatCurrency(selectedInvoice.discount)}</span>
                          </div>
                        )}
                        
                        {selectedInvoice.tax > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Tax:</span>
                            <span className="font-medium text-gray-900">{formatCurrency(selectedInvoice.tax)}</span>
                          </div>
                        )}
                        
                        <div className="border-t border-blue-200 pt-3">
                          <div className="flex justify-between text-lg font-bold">
                            <span className="text-blue-700">Total Amount:</span>
                            <span className="text-blue-700">{formatCurrency(selectedInvoice.total_amount)}</span>
                          </div>
                        </div>
                        
                        {selectedInvoice.amount_paid > 0 && (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Amount Paid:</span>
                              <span className="font-medium text-green-600">{formatCurrency(selectedInvoice.amount_paid)}</span>
                            </div>
                            <div className="flex justify-between text-sm border-t border-blue-200 pt-2">
                              <span className="text-gray-600 font-medium">Balance Due:</span>
                              <span className="font-semibold text-red-600">{formatCurrency(selectedInvoice.total_amount - selectedInvoice.amount_paid)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Notes Section */}
                {selectedInvoice.notes && (
                  <div className="mb-8 bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <h2 className="font-bold text-gray-700 mb-3 flex items-center">
                      <FiFileText className="mr-2 h-5 w-5 text-gray-600" />
                      Notes
                    </h2>
                    <p className="text-gray-600 leading-relaxed">{selectedInvoice.notes}</p>
                  </div>
                )}
                
                {/* Payment History Section */}
                {selectedInvoice.payments && selectedInvoice.payments.length > 0 && (
                  <div className="mb-8">
                    <h2 className="font-bold text-gray-700 mb-4 flex items-center">
                      <FiCreditCard className="mr-2 h-5 w-5 text-green-600" />
                      Payment History
                    </h2>
                    <div className="overflow-hidden rounded-lg border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              Date
                            </th>
                            <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              Amount
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              Method
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              Reference
                            </th>
                            <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {selectedInvoice.payments.map((payment, index) => (
                            <tr key={index} className="hover:bg-gray-50 transition-colors duration-150">
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {new Date(payment.payment_date || payment.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                                {formatCurrency(payment.amount)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getMethodBadgeClass(payment.payment_method)}`}>
                                  {payment.payment_method}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {payment.reference_number}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-center">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(payment.approval_status || 'pending')}`}>
                                  {payment.approval_status === 'approved' ? 'Approved' : 
                                   payment.approval_status === 'rejected' ? 'Rejected' : 'Pending'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                {/* Footer */}
                <div className="text-center pt-8 border-t border-gray-200">
                  <p className="text-lg font-semibold text-blue-600 mb-2">Thank you for choosing Silario Dental Clinic</p>
                  <p className="text-sm text-gray-500">For any inquiries, please contact us at silaroidentalclinic@gmail.com</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Detail Modal */}
      {showPaymentModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-white">
                Payment Review
              </h3>
              <button
                type="button"
                className="p-2 rounded-lg text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white transition-all duration-150"
                onClick={() => setShowPaymentModal(false)}
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Payment Information */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                    <FiCreditCard className="mr-2 h-5 w-5 text-blue-600" />
                    Payment Information
                  </h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Patient</dt>
                        <dd className="mt-1 text-sm font-semibold text-gray-900">{selectedPayment.patientName}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Invoice Number</dt>
                        <dd className="mt-1 text-sm font-semibold text-blue-600">#{selectedPayment.invoiceNumber}</dd>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Amount Paid</dt>
                        <dd className="mt-1 text-lg font-bold text-green-600">{selectedPayment.formattedAmount}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Date</dt>
                        <dd className="mt-1 text-sm text-gray-900">{selectedPayment.formattedDate}</dd>
                      </div>
                    </div>

                    
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Method</dt>
                        <dd className="mt-1">
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getMethodBadgeClass(selectedPayment.payment_method)}`}>
                            {selectedPayment.payment_method}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">{selectedPayment.payment_method === 'cash' ? 'Date & Time' : 'Reference Number(s)'}</dt>
                        <dd className="mt-1 text-sm font-mono text-gray-900">
                          {selectedPayment.payment_method === 'cash' ? (
                            new Date(selectedPayment.payment_date || selectedPayment.created_at).toLocaleString(undefined, { hour12: true })
                          ) : (
                            <div className="space-y-1 max-h-24 overflow-auto pr-1">
                              {relatedRefDetails && relatedRefDetails.length > 0 ? (
                                relatedRefDetails.map((r, idx) => (
                                  <div key={idx} className="flex items-center justify-between">
                                    <span className="text-blue-700">{r.ref}</span>
                                    <span className="text-xs text-gray-500 ml-2">{new Date(r.created_at).toLocaleString(undefined, { hour12: true })}</span>
                                  </div>
                                ))
                              ) : (
                                <span className="text-gray-500">{selectedPayment.reference_number || '—'}</span>
                              )}
                            </div>
                          )}
                        </dd>
                      </div>
                    </div>
                    
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Status</dt>
                      <dd className="mt-1">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(selectedPayment.approval_status)}`}>
                          {selectedPayment.approval_status === 'approved' ? 'Approved' : 
                           selectedPayment.approval_status === 'rejected' ? 'Rejected' : 'Pending Approval'}
                        </span>
                      </dd>
                    </div>

                    {/* Invoice Summary (Amount Due / Paid / Remaining) */}
                    {selectedPayment?.invoices && (
                      <div className="mt-4 border-t pt-4">
                        <h5 className="text-sm font-semibold text-gray-800 mb-2">Invoice Summary</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="rounded-lg bg-white border border-gray-200 p-3">
                            <div className="text-xs text-gray-500">Amount Due</div>
                            <div className="mt-1 text-base font-bold text-gray-900">{formatCurrency(selectedPayment.invoices.total_amount || 0)}</div>
                          </div>
                          <div className="rounded-lg bg-white border border-gray-200 p-3">
                            <div className="text-xs text-gray-500">Amount Paid</div>
                            <div className="mt-1 text-base font-bold text-green-600">{formatCurrency(selectedPayment.invoices.amount_paid || 0)}</div>
                          </div>
                          <div className="rounded-lg bg-white border border-gray-200 p-3">
                            <div className="text-xs text-gray-500">Remaining Balance</div>
                            <div className="mt-1 text-base font-bold text-red-600">{formatCurrency(Math.max((selectedPayment.invoices.total_amount || 0) - (selectedPayment.invoices.amount_paid || 0), 0))}</div>
                          </div>
                        </div>

                        {/* If this payment makes it partial, show projected remaining */}
                        
                      </div>
                    )}
                  </div>

                  {/* Action Buttons - Only show when viewing from payment approvals, not from invoice */}
                  {selectedPayment.approval_status === 'pending' && !isViewingInvoiceProofs && (
                    <div className="mt-8 flex space-x-3">
                      <button
                        type="button"
                        onClick={() => {
                          handleApprovePayment(selectedPayment.id);
                          setShowPaymentModal(false);
                        }}
                        className="flex-1 inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-150"
                      >
                        <FiCheck className="mr-2 h-4 w-4" />
                        Approve Payment
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleRejectPayment(selectedPayment.id);
                          setShowPaymentModal(false);
                        }}
                        className="flex-1 inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-150"
                      >
                        <FiX className="mr-2 h-4 w-4" />
                        Decline Last Payment
                      </button>
                    </div>
                  )}
                </div>

                {/* Payment Proof */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                    <FiFileText className="mr-2 h-5 w-5 text-gray-600" />
                    Payment Proof
                  </h4>
                 
                  <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <div className="p-4 flex gap-3 overflow-x-auto">
                      {/* Show all proof images (including white placeholders for cash payments) */}
                      {relatedProofs && relatedProofs.map((p, idx) => (
                        <div key={idx} className={`min-w-[300px] max-w-[300px] bg-white rounded-lg border-2 overflow-hidden ${
                          p.approval_status === 'rejected' ? 'border-red-300 bg-red-50' : 
                          p.approval_status === 'approved' ? 'border-green-300 bg-green-50' : 
                          'border-gray-200'
                        }`}>
                          {/* Status Badge */}
                          <div className={`px-3 py-2 text-center text-xs font-semibold ${
                            p.approval_status === 'rejected' ? 'bg-red-100 text-red-800' :
                            p.approval_status === 'approved' ? 'bg-green-100 text-green-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            <div className="flex items-center justify-center">
                              {p.approval_status === 'rejected' ? (
                                <>
                                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                  REJECTED
                                </>
                              ) : p.approval_status === 'approved' ? (
                                <>
                                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  APPROVED
                                </>
                              ) : (
                                <>
                                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                  </svg>
                                  PENDING APPROVAL
                                </>
                              )}
                            </div>
                          </div>
                          {p.isPdf ? (
                            <div className="p-6 text-center">
                              <FiFileText className="mx-auto h-12 w-12 text-red-500" />
                              <p className="mt-2 text-sm text-gray-600 font-medium">PDF Document</p>
                              <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center mt-3 px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">View PDF</a>
                            </div>
                          ) : (
                            <div className="p-3">
                              <div className="flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden" style={{height:'360px'}}>
                                <img src={p.url} alt={`Payment Proof ${idx+1}`} className="w-full h-full object-contain" />
                              </div>
                            </div>
                          )}
                          <div className="px-4 py-3 border-t bg-gray-50">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-600">Amount Paid:</span>
                              <span className="font-semibold text-gray-900">{formatCurrency(p.amount || 0)}</span>
                            </div>
                            {p.ref && (
                              <div className="flex justify-between text-xs mt-1">
                                <span className="text-gray-600">Reference #:</span>
                                <span className="font-semibold text-gray-800">{p.ref}</span>
                              </div>
                            )}
                            <div className="mt-2 text-right">
                              {p.isWhitePlaceholder ? (
                                <span className="text-blue-600 text-xs">Cash Payment</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => { setFullSizeImageUrl(p.url); setFullSizeReferenceNumber(p.ref || ''); setShowFullSizeImage(true); }}
                                  className="text-primary-600 hover:text-primary-800 text-xs"
                                >
                                  View Proof
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                className="inline-flex justify-center py-2 px-6 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-150"
                onClick={() => setShowPaymentModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showFullSizeImage && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 relative flex flex-col items-center">
            <button
              type="button"
              className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700"
              onClick={() => setShowFullSizeImage(false)}
            >
              <FiX className="h-6 w-6" />
            </button>
            <div className="mb-4 text-center w-full">
              {selectedPayment?.payment_method === 'cash' ? (
                <>
                  <span className="font-medium text-gray-700">Date & Time:</span>
                  <span className="ml-2 text-blue-700 font-mono tracking-wide">{new Date(selectedPayment.payment_date || selectedPayment.created_at).toLocaleString(undefined, { hour12: true })}</span>
                </>
              ) : (
                <>
                  <span className="font-medium text-gray-700">Reference Number:</span>
                  <span className="ml-2 text-blue-700 font-mono tracking-wide">{fullSizeReferenceNumber}</span>
                </>
              )}
            </div>
            <img
              src={fullSizeImageUrl}
              alt="Payment Proof Full Size"
              className="max-w-full max-h-[90vh] object-contain rounded-lg border border-blue-200 shadow-md"
              onError={e => { e.target.src = 'https://via.placeholder.com/600x400?text=Image+Not+Available'; }}
            />
          </div>
        </div>
      )}

      {/* Edit Invoice Modal */}
      {showEditInvoiceModal && editInvoiceData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-blue-700">Edit Invoice #{editInvoiceData.invoice_number}</h2>
              <button
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                onClick={() => setShowEditInvoiceModal(false)}
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>
            {/* Patient Info (read-only) */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100 mb-6">
              <div className="flex items-center mb-4">
                <FiUser className="h-5 w-5 text-blue-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Patient Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div><span className="font-medium">Name:</span> {editInvoiceData.patientName}</div>
                {editInvoiceData.profiles?.phone && <div><span className="font-medium">Phone:</span> {editInvoiceData.profiles.phone}</div>}
                {editInvoiceData.profiles?.email && <div><span className="font-medium">Email:</span> {editInvoiceData.profiles.email}</div>}
                {editInvoiceData.profiles?.address && <div className="md:col-span-2"><span className="font-medium">Address:</span> {editInvoiceData.profiles.address}</div>}
              </div>
            </div>
            {/* Editable Line Items (like create) */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-6">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center">
                  <FiActivity className="h-5 w-5 text-purple-600 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900">Services & Products</h3>
                </div>
              </div>
              <div className="p-6">
                {/* Editable Line Items Table */}
                {editInvoiceData.items.map((item, idx) => (
                  <div key={item.id || idx} className="grid grid-cols-12 gap-3 mb-3 items-center">
                    <input
                      className="col-span-4 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={item.description}
                      onChange={e => {
                        const newItems = [...editInvoiceData.items];
                        newItems[idx].description = e.target.value;
                        setEditInvoiceData({ ...editInvoiceData, items: newItems });
                      }}
                    />
                    <input
                      type="number"
                      className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={item.price}
                      onChange={e => {
                        const newItems = [...editInvoiceData.items];
                        newItems[idx].price = parseFloat(e.target.value) || 0;
                        setEditInvoiceData({ ...editInvoiceData, items: newItems });
                      }}
                      min="0"
                      step="0.01"
                    />
                    <input
                      type="number"
                      className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={item.quantity}
                      onChange={e => {
                        const newItems = [...editInvoiceData.items];
                        newItems[idx].quantity = parseInt(e.target.value, 10) || 1;
                        setEditInvoiceData({ ...editInvoiceData, items: newItems });
                      }}
                      min="1"
                    />
                    <input
                      type="number"
                      className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={item.discount || 0}
                      onChange={e => {
                        const newItems = [...editInvoiceData.items];
                        newItems[idx].discount = parseFloat(e.target.value) || 0;
                        setEditInvoiceData({ ...editInvoiceData, items: newItems });
                      }}
                      min="0"
                      step="0.01"
                      placeholder="Discount"
                    />
                    <div className="col-span-1 text-right font-semibold text-gray-700">
                      ₱{(item.price * item.quantity - (item.discount || 0)).toFixed(2)}
                    </div>
                    <button
                      className="col-span-1 text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50 transition-colors duration-150"
                      title="Remove item"
                      onClick={() => {
                        const newItems = editInvoiceData.items.filter((_, i) => i !== idx);
                        setEditInvoiceData({ ...editInvoiceData, items: newItems });
                      }}
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {/* Add new line item (like create) */}
                <div className="grid grid-cols-12 gap-3 mb-3 items-center">
                  <input
                    className="col-span-4 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Description"
                    value={tempEditItem.description}
                    onChange={e => setTempEditItem({ ...tempEditItem, description: e.target.value })}
                  />
                  <input
                    type="number"
                    className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Unit Price"
                    value={tempEditItem.price}
                    onChange={e => setTempEditItem({ ...tempEditItem, price: e.target.value })}
                    min="0"
                    step="0.01"
                  />
                  <input
                    type="number"
                    className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Qty"
                    value={tempEditItem.quantity}
                    onChange={e => setTempEditItem({ ...tempEditItem, quantity: e.target.value })}
                    min="1"
                  />
                  <input
                    type="number"
                    className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Discount"
                    value={tempEditItem.discount}
                    onChange={e => setTempEditItem({ ...tempEditItem, discount: e.target.value })}
                    min="0"
                    step="0.01"
                  />
                  <div className="col-span-1"></div>
                  <button
                    className="col-span-1 text-green-600 hover:text-green-900 p-1 rounded-full hover:bg-green-50 transition-colors duration-150"
                    title="Add item"
                    onClick={() => {
                      if (!tempEditItem.description || !tempEditItem.price) return;
                      const newItem = {
                        id: Date.now(),
                        description: tempEditItem.description,
                        price: parseFloat(tempEditItem.price),
                        quantity: parseInt(tempEditItem.quantity, 10) || 1,
                        discount: parseFloat(tempEditItem.discount) || 0
                      };
                      setEditInvoiceData({
                        ...editInvoiceData,
                        items: [...editInvoiceData.items, newItem]
                      });
                      setTempEditItem({ description: '', price: '', quantity: 1, discount: 0 });
                    }}
                  >
                    <FiPlus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            {/* Payment, Discount, Tax, Notes, Save (like create) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                <div className="flex items-center mb-4">
                  <FiCreditCard className="h-5 w-5 text-green-600 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900">Payment Discount</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Discount</label>
                    <input
                      type="number"
                      className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={editInvoiceData.discount || 0}
                      onChange={e => setEditInvoiceData({ ...editInvoiceData, discount: parseFloat(e.target.value) || 0 })}
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tax (%)</label>
                    <input
                      type="number"
                      className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={editInvoiceData.tax || 0}
                      onChange={e => setEditInvoiceData({ ...editInvoiceData, tax: parseFloat(e.target.value) || 0 })}
                      min="0"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
                  <textarea
                    rows="4"
                    className="block w-full border border-gray-300 rounded-lg shadow-sm py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Add any additional notes or appointment details..."
                    value={editInvoiceData.notes || ''}
                    onChange={e => setEditInvoiceData({ ...editInvoiceData, notes: e.target.value })}
                  ></textarea>
                </div>
                {/* Totals */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Summary</h3>
                  {(() => {
                    const { subtotal, discount, tax, taxAmount, total } = calculateEditInvoiceTotals(editInvoiceData);
                    return (
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Subtotal:</span>
                          <span className="font-medium text-gray-900">₱{subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Discount:</span>
                          <span className="font-medium text-gray-900">-₱{discount.toFixed(2)}</span>
                        </div>
                        {tax > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Tax ({tax}%):</span>
                            <span className="font-medium text-gray-900">₱{taxAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="border-t border-blue-200 pt-3">
                          <div className="flex justify-between text-lg font-bold">
                            <span className="text-blue-700">Total Amount:</span>
                            <span className="text-blue-700">₱{total.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
            {/* Save Button */}
            <div className="flex justify-end mt-8">
              <button
                className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-150"
                onClick={handleSaveEditInvoice}
                disabled={isLoading}
              >
                <FiCheck className="mr-2 h-5 w-5" /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Invoice Printer */}
      {showUnifiedPrinter && selectedInvoice && (
        <UnifiedInvoicePrinter
          invoice={selectedInvoice}
          onClose={() => {
            setShowUnifiedPrinter(false);
            setSelectedInvoice(null);
          }}
          userRole="doctor"
          showPreview={true}
          showDownload={true}
          showPrint={true}
        />
      )}
    </div>
  );
};

export default Billing;