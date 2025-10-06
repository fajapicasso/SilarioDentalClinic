// src/pages/patient/Payments.jsx - Fixed Payment Flow
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiDollarSign, FiCreditCard, FiFileText, FiDownload, FiExternalLink, FiInfo, FiUpload, FiCheck, FiClock, FiPrinter, FiEye } from 'react-icons/fi';
import supabase from '../../config/supabaseClient';
// Staff view does not use patient auth; we provide a patient selector
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { toast } from 'react-toastify';
import { usePaymentNotifications } from '../../hooks/useNotificationIntegration';
import InvoicePDF from '../../components/common/InvoicePDF';
import UnifiedInvoicePrinter from '../../components/common/UnifiedInvoicePrinter';
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

// Import GCash QR Code
import gcashQR from '../../assets/clinic.png';

// Component to display rejection message
const RejectionMessage = ({ invoiceId }) => {
  const [rejectionMessage, setRejectionMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRejectionMessage = async () => {
      try {
        const { data: payments, error } = await supabase
          .from('payments')
          .select('notes, approval_status')
          .eq('invoice_id', invoiceId)
          .eq('approval_status', 'rejected')
          .order('created_at', { ascending: false })
          .limit(1);

        if (!error && payments && payments.length > 0) {
          const notes = payments[0].notes || '';
          const rejectionMatch = notes.match(/Dr\. .+ rejected your payment\. You need to pay again and attach valid proof of payment\./);
          setRejectionMessage(rejectionMatch ? rejectionMatch[0] : null);
        }
      } catch (error) {
        console.error('Error fetching rejection message:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRejectionMessage();
  }, [invoiceId]);

  if (loading) {
    return <div className="text-xs text-gray-500 mt-1">Loading...</div>;
  }

  if (!rejectionMessage) {
    return null;
  }

  return (
    <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded-md">
      <div className="flex items-center">
        <svg className="h-3 w-3 text-red-400 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
        <p className="text-xs text-red-700 font-medium">Payment rejected. Pay again with valid proof.</p>
      </div>
    </div>
  );
};

const Payments = () => {
  const { invoiceId } = useParams();
  const { createPayment } = usePaymentNotifications();
  const { logPageView, logBillingView, logPaymentCreate, logPaymentUpdate } = useUniversalAudit();
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showUnifiedPrinter, setShowUnifiedPrinter] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('gcash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentProof, setPaymentProof] = useState(null);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  // Track which invoices have payments in this session
  const [paidInvoicesInSession, setPaidInvoicesInSession] = useState([]);
  // Track if we're showing payment success view
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  // Track current payment info
  const [currentPaymentInfo, setCurrentPaymentInfo] = useState(null);
  // Assigned doctor's QR for GCash
  const [doctorQrUrl, setDoctorQrUrl] = useState(null);
  // Proof gallery modal state
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofGallery, setProofGallery] = useState([]); // [{ url, isPdf }]
  const [proofInvoiceMeta, setProofInvoiceMeta] = useState(null); // { total_amount, amount_paid }
  // Full-size proof modal (per image/pdf)
  const [showFullProofModal, setShowFullProofModal] = useState(false);
  const [fullProofUrl, setFullProofUrl] = useState('');
  const [fullProofRef, setFullProofRef] = useState('');

  // Patient selector for staff
  const [patients, setPatients] = useState([]); // [{ id, full_name }]
  const [selectedPatientId, setSelectedPatientId] = useState('');

  // State to track invoices with rejected payment proofs
  const [invoicesWithRejectedProofs, setInvoicesWithRejectedProofs] = useState(new Set());

  // Helper function to check if an invoice has rejected payment proofs
  const hasRejectedPaymentProofs = async (invoiceId) => {
    try {
      const { data: payments, error } = await supabase
        .from('payments')
        .select('approval_status')
        .eq('invoice_id', invoiceId)
        .eq('approval_status', 'rejected');
      
      return !error && payments && payments.length > 0;
    } catch (error) {
      console.error('Error checking rejected payments:', error);
      return false;
    }
  };

  // Filter invoices when search query changes
  useEffect(() => {
    if (invoices.length === 0) return;
    
    let filtered = [...invoices];
    
    // Apply search query
    if (searchQuery) {
      const lowercasedQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(
        invoice => 
          invoice.invoice_number?.toLowerCase().includes(lowercasedQuery) ||
          invoice.total_amount?.toString().includes(lowercasedQuery) ||
          invoice.invoice_date?.toLowerCase().includes(lowercasedQuery)
      );
    }
    
    setFilteredInvoices(filtered);
  }, [searchQuery, invoices]);

  // Function to check all invoices for rejected payment proofs
  const checkInvoicesForRejectedProofs = async (invoiceList) => {
    const rejectedSet = new Set();
    
    for (const invoice of invoiceList) {
      const hasRejected = await hasRejectedPaymentProofs(invoice.id);
      if (hasRejected) {
        rejectedSet.add(invoice.id);
      }
    }
    
    setInvoicesWithRejectedProofs(rejectedSet);
  };

  // Fetch full invoice by id and then print using doctor-style template
  const handlePrintInvoice = async (invoiceId) => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          invoice_date,
          due_date,
          created_at,
          patient_id,
          total_amount,
          amount_paid,
          status,
          payment_method,
          notes,
          subtotal,
          discount,
          tax,
          profiles:patient_id(full_name, phone, email, address),
          invoice_items(id, service_name, description, quantity, price)
        `)
        .eq('id', invoiceId)
        .single();

      if (error) {
        console.error('Failed to fetch invoice for printing:', error);
        toast.error('Failed to load invoice for printing');
        return;
      }

      const fullInvoice = {
        ...data,
        patientName: data?.profiles?.full_name || '',
      };

      printInvoice(fullInvoice);
    } catch (e) {
      console.error('Unexpected error printing invoice:', e);
      toast.error('Unexpected error while preparing invoice print');
    }
  };

  // Download PDF function
  const handleDownloadPDF = async (invoiceId) => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          invoice_date,
          due_date,
          created_at,
          patient_id,
          total_amount,
          amount_paid,
          status,
          payment_method,
          notes,
          subtotal,
          discount,
          tax,
          profiles:patient_id(full_name, phone, email, address),
          invoice_items(id, service_name, description, quantity, price)
        `)
        .eq('id', invoiceId)
        .single();

      if (error) {
        console.error('Failed to fetch invoice for PDF:', error);
        toast.error('Failed to load invoice for PDF download');
        return;
      }

      const fullInvoice = {
        ...data,
        patientName: data?.profiles?.full_name || '',
      };

      await InvoicePDF.generateInvoicePDF(fullInvoice, toast);
    } catch (e) {
      console.error('Unexpected error downloading invoice PDF:', e);
      toast.error('Unexpected error while preparing invoice PDF');
    }
  };


  // Print invoice helper (doctor-side design)
  const printInvoice = (invoice) => {
    if (!invoice) return;
    const items = invoice.invoice_items || invoice.items || [];
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printStyles = `
      @page { size: A4; margin: 0.3in; }
      body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #333; line-height: 1.3; font-size: 11px; }
      .invoice-container { max-width: 100%; margin: 0; }
      .invoice-header { display: flex; justify-content: space-between; margin-bottom: 15px; border-bottom: 2px solid #2563eb; padding-bottom: 8px; }
      .invoice-title { font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 5px; }
      .clinic-info { margin-bottom: 2px; color: #6b7280; font-size: 10px; }
      .clinic-name { font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 2px; }
      .invoice-info { text-align: right; margin-bottom: 2px; font-size: 10px; }
      .invoice-number { font-size: 14px; font-weight: bold; color: #2563eb; margin-bottom: 5px; }
      .bill-section { display: flex; justify-content: space-between; background-color: #f8fafc; padding: 10px; margin: 10px 0; border-radius: 4px; border: 1px solid #e5e7eb; }
      .bill-to, .payment-info { flex: 1; margin: 0 5px; }
      .bill-to h2, .payment-info h2 { font-size: 11px; font-weight: bold; color: #374151; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.3px; }
      .patient-info, .payment-details { color: #6b7280; line-height: 1.2; font-size: 10px; }
      .patient-name { font-weight: 600; color: #1f2937; font-size: 11px; margin-bottom: 2px; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0; background-color: white; border: 1px solid #e5e7eb; }
      th, td { padding: 6px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
      th { background-color: #f8fafc; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.3px; }
      .amount-right { text-align: right; font-weight: 500; }
      .summary { margin-left: auto; width: 250px; background-color: #f8fafc; padding: 10px; border-radius: 4px; border: 1px solid #e5e7eb; }
      .summary-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 10px; }
      .summary-label { color: #6b7280; font-weight: 500; }
      .summary-value { font-weight: 600; color: #1f2937; }
      .total-row { font-weight: bold; border-top: 2px solid #2563eb; padding-top: 5px; margin-top: 5px; font-size: 12px; }
      .total-row .summary-label, .total-row .summary-value { color: #2563eb; font-weight: bold; }
      .notes { margin-top: 15px; border-top: 1px solid #e5e7eb; padding-top: 8px; }
      .notes h2 { font-size: 11px; font-weight: 600; color: #374151; margin-bottom: 5px; }
      .notes p { color: #6b7280; line-height: 1.3; font-size: 10px; }
      .footer { margin-top: 20px; text-align: center; color: #9ca3af; font-size: 10px; border-top: 1px solid #e5e7eb; padding-top: 8px; }
      .thank-you { font-weight: 600; color: #2563eb; font-size: 11px; }
      .badge { display: inline-block; padding: 2px 6px; border-radius: 10px; font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
      .badge-green { background-color: #d1fae5; color: #065f46; }
      .badge-yellow { background-color: #fef3c7; color: #92400e; }
      .badge-red { background-color: #fee2e2; color: #b91c1c; }
      @media print { body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
    `;

    const getStatusBadgeClass = (status) => {
      switch ((status || '').toLowerCase()) {
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

    const formatCurrency = (amount) => `₱${parseFloat(amount || 0).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;

    const content = `<!DOCTYPE html><html lang='en'><head><meta charset='UTF-8' /><meta name='viewport' content='width=device-width, initial-scale=1.0' /><title>Invoice #${invoice.invoice_number}</title><style>${printStyles}</style></head><body>
      <div class='invoice-container'>
        <div class='invoice-header'>
          <div>
            <div class='invoice-title'>INVOICE</div>
            <div class='clinic-name'>Silario Dental Clinic</div>
            <div class='clinic-info'>Cabugao/San Juan, Ilocos Sur</div>
            <div class='clinic-info'>silaroidentalclinic@gmail.com</div>
          </div>
          <div>
            <div class='invoice-number'>#${invoice.invoice_number}</div>
            <div class='invoice-info'><strong>Date:</strong> ${new Date(invoice.invoice_date || invoice.created_at).toLocaleDateString()}</div>
            <div class='invoice-info'><strong>Due Date:</strong> ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : ''}</div>
          </div>
        </div>
        <div class='bill-section'>
          <div class='bill-to'>
            <h2>Billed To</h2>
            <div class='patient-info'>
              <div class='patient-name'>${invoice.patientName || ''}</div>
              ${invoice.profiles?.address ? `<div>${invoice.profiles.address}</div>` : ''}
              ${invoice.profiles?.phone ? `<div>${invoice.profiles.phone}</div>` : ''}
              ${invoice.profiles?.email ? `<div>${invoice.profiles.email}</div>` : ''}
            </div>
          </div>
          <div class='payment-info'>
            <h2>Payment Information</h2>
            <div class='payment-details'>
              <div><strong>Method:</strong> ${invoice.payment_method || 'Not specified'}</div>
              <div><strong>Status:</strong> <span class='${getStatusBadgeClass(invoice.status)}'>${(invoice.status || '').charAt(0).toUpperCase() + (invoice.status || '').slice(1)}</span></div>
            </div>
          </div>
        </div>
        <table>
          <thead><tr><th style='width:50%'>Description</th><th class='amount-right' style='width:20%'>Unit Price</th><th class='amount-right' style='width:15%'>Quantity</th><th class='amount-right' style='width:15%'>Total</th></tr></thead>
          <tbody>
            ${items.map(item => `<tr><td>${item.service_name || item.description || ''}</td><td class='amount-right'>${formatCurrency(item.price)}</td><td class='amount-right'>${item.quantity || 1}</td><td class='amount-right'>${formatCurrency((item.price || 0) * (item.quantity || 1))}</td></tr>`).join('')}
          </tbody>
        </table>
        <div class='summary'>
          <div class='summary-row'><span class='summary-label'>Subtotal:</span><span class='summary-value'>${formatCurrency(invoice.subtotal || invoice.total_amount)}</span></div>
          ${invoice.discount ? `<div class='summary-row'><span class='summary-label'>Discount:</span><span class='summary-value'>-${formatCurrency(invoice.discount)}</span></div>` : ''}
          ${invoice.tax ? `<div class='summary-row'><span class='summary-label'>Tax:</span><span class='summary-value'>${formatCurrency(invoice.tax)}</span></div>` : ''}
          <div class='summary-row total-row'><span class='summary-label'>Total Amount:</span><span class='summary-value'>${formatCurrency(invoice.total_amount || 0)}</span></div>
          ${invoice.amount_paid ? `<div class='summary-row'><span class='summary-label'>Amount Paid:</span><span class='summary-value'>${formatCurrency(invoice.amount_paid)}</span></div><div class='summary-row'><span class='summary-label'>Balance Due:</span><span class='summary-value'>${formatCurrency((invoice.total_amount || 0) - (invoice.amount_paid || 0))}</span></div>` : ''}
        </div>
        ${invoice.notes ? `<div class='notes'><h2>Notes</h2><p>${invoice.notes}</p></div>` : ''}
        <div class='footer'><p class='thank-you'>Thank you for choosing Silario Dental Clinic</p><p>For any inquiries, please contact us at silaroidentalclinic@gmail.com</p></div>
      </div>
      <script>window.onload=function(){window.print();}</script>
    </body></html>`;

    printWindow.document.open();
    printWindow.document.write(content);
    printWindow.document.close();
  };


  // Load patient options based on invoices available
  useEffect(() => {
    // Log page view
    logPageView('Staff Payments', 'billing', 'management');
    
    const loadPatients = async () => {
      try {
        const { data, error } = await supabase
          .from('invoices')
          .select('patient_id, profiles:patient_id ( id, full_name )')
          .order('invoice_date', { ascending: false });
        if (error) throw error;
        const map = new Map();
        (data || []).forEach(r => {
          if (r.profiles?.id) map.set(r.profiles.id, r.profiles.full_name || 'Unknown');
        });
        const list = Array.from(map.entries()).map(([id, full_name]) => ({ id, full_name }));
        setPatients(list);
        if (list.length > 0) setSelectedPatientId(list[0].id);
      } catch (e) {
        console.error('Failed to load patients:', e);
        toast.error('Failed to load patients');
      }
    };
    loadPatients();
  }, [logPageView]);

  // Fetch data for current patient
  useEffect(() => {
    if (selectedPatientId) {
      fetchInvoices();
      fetchPaymentHistory();
    }
  }, [selectedPatientId]);

  useEffect(() => {
    if (invoiceId && invoices.length > 0) {
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (invoice) {
        setSelectedInvoice(invoice);
      }
    }
  }, [invoiceId, invoices]);

  // When modal opens for a selected invoice, ensure doctor QR is loaded
  useEffect(() => {
    if (showPaymentModal && selectedInvoice) {
      setDoctorQrUrl(null);
      loadDoctorQrForInvoice(selectedInvoice);
    }
  }, [showPaymentModal, selectedInvoice]);

  // Helper function to extract URL properly from notes
  const extractProofUrlFromNotes = (notes) => {
    if (!notes || !notes.includes('Payment proof:')) return null;
    
    console.log('Extracting URL from notes:', notes);
    
    // Get the part after "Payment proof:"
    let url = notes.split('Payment proof: ')[1];
    console.log('Initial URL extraction:', url);
    
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
        console.log(`Found pattern "${pattern}", cleaned URL:`, url);
        break;
        }
      } else {
        // Handle regex patterns
        const match = url.match(pattern);
        if (match) {
          url = url.replace(pattern, '').trim();
          console.log(`Found regex pattern, cleaned URL:`, url);
          break;
        }
      }
    }
    
    console.log('Final extracted URL:', url);
    return url;
  };

  // Load all proofs for a given invoice id
  const openProofGalleryForInvoice = async (invoiceId) => {
    try {
      if (!invoiceId) return;
      setShowProofModal(true);
      setProofGallery([]);
      setProofInvoiceMeta(null);

      // Fetch all payments tied to this invoice (most recent first)
      const { data: paymentsForInvoice, error: payErr } = await supabase
        .from('payments')
        .select('id, notes, created_at, amount, reference_number, approval_status')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: true });
      if (payErr) throw payErr;

      // Extract URLs
      const entries = [];
      (paymentsForInvoice || []).forEach(p => {
        const url = extractProofUrlFromNotes(p.notes);
        if (url) {
          const isWhitePlaceholder = url.includes('data:image/svg+xml;base64,');
          entries.push({ 
            url, 
            isPdf: url.toLowerCase().includes('.pdf'), 
            amount: parseFloat(p.amount || 0), 
            ref: p.reference_number,
            isWhitePlaceholder: isWhitePlaceholder,
            approval_status: p.approval_status || 'pending',
            payment_id: p.id,
            created_at: p.created_at
          });
        }
      });

      // Deduplicate by URL while preserving order, but don't deduplicate white placeholder images
      // since each cash payment should have its own unique placeholder
      const seen = new Set();
      const uniqueEntries = entries.filter(e => {
        const isWhitePlaceholder = e.isWhitePlaceholder;
        if (isWhitePlaceholder) {
          // Don't deduplicate white placeholders - each cash payment should show separately
          return true;
        } else {
          // Deduplicate regular proof images
          if (seen.has(e.url)) return false;
          seen.add(e.url);
          return true;
        }
      });

      setProofGallery(uniqueEntries);

      // Fetch invoice meta for totals and calculate correct amount_paid
      const { data: inv, error: invErr } = await supabase
        .from('invoices')
        .select('id, total_amount, amount_paid')
        .eq('id', invoiceId)
        .single();
      
      if (!invErr && inv) {
        // Calculate correct amount_paid based only on approved payments
        const { data: approvedPayments, error: paymentsErr } = await supabase
          .from('payments')
          .select('amount, approval_status, doctor_approval_status')
          .eq('invoice_id', invoiceId);
        
        let correctAmountPaid = 0;
        if (!paymentsErr && approvedPayments) {
          correctAmountPaid = approvedPayments
            .filter(payment => {
              const paymentStatus = payment.doctor_approval_status || payment.approval_status || 'pending';
              return paymentStatus.toLowerCase() === 'approved';
            })
            .reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
        }
        
        setProofInvoiceMeta({ 
          total_amount: inv.total_amount || 0, 
          amount_paid: correctAmountPaid 
        });
      }
    } catch (e) {
      console.error('Failed to load proofs for invoice:', e);
      toast.error('Could not load payment proofs');
      setShowProofModal(false);
    }
  };

  // Function to calculate correct amount_paid based only on approved payments
  const calculateCorrectAmountPaid = async (invoices) => {
    try {
      const invoiceIds = invoices.map(inv => inv.id);
      
      if (invoiceIds.length === 0) return invoices;
      
      // Fetch all payments for these invoices
      const { data: payments, error } = await supabase
        .from('payments')
        .select('invoice_id, amount, approval_status, doctor_approval_status')
        .in('invoice_id', invoiceIds);
      
      if (error) {
        console.error('Error fetching payments for amount calculation:', error);
        return invoices; // Return original invoices if we can't fetch payments
      }
      
      // Calculate approved amounts for each invoice
      const approvedAmounts = {};
      payments?.forEach(payment => {
        const paymentStatus = payment.doctor_approval_status || payment.approval_status || 'pending';
        if (paymentStatus.toLowerCase() === 'approved') {
          const invoiceId = payment.invoice_id;
          approvedAmounts[invoiceId] = (approvedAmounts[invoiceId] || 0) + parseFloat(payment.amount || 0);
        }
      });
      
      // Update invoices with correct amount_paid
      return invoices.map(invoice => ({
        ...invoice,
        amount_paid: approvedAmounts[invoice.id] || 0
      }));
      
    } catch (error) {
      console.error('Error calculating correct amount paid:', error);
      return invoices; // Return original invoices if calculation fails
    }
  };

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      console.log('Fetching invoices for patient:', selectedPatientId);
      
      // Correct way to use the IN operator with Supabase - ensure array is properly formatted
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          invoice_date,
          due_date,
          total_amount,
          amount_paid,
          status,
          payment_method,
          notes,
          created_by,
          discount,
          tax,
          invoice_items(
            id,
            description,
            service_name,
            price,
            quantity,
            discount
          )
        `)
        .eq('patient_id', selectedPatientId)
        .or('status.eq.pending,status.eq.partial,status.eq.rejected')  // Include rejected invoices
        .order('invoice_date', { ascending: false });
      
      if (error) {
        console.error('Error in invoice query:', error);
        // Try the fallback approach with separate queries if OR fails
        await fetchWithSeparateQueries();
        return;
      }
      
      console.log(`Found ${data?.length || 0} invoices`);
      const invoiceData = data || [];
      
      // Calculate correct amount_paid based only on approved payments
      const invoicesWithCorrectAmounts = await calculateCorrectAmountPaid(invoiceData);
      setInvoices(invoicesWithCorrectAmounts);
      setFilteredInvoices(invoicesWithCorrectAmounts);
      
      // Check for rejected payment proofs
      if (invoicesWithCorrectAmounts.length > 0) {
        checkInvoicesForRejectedProofs(invoicesWithCorrectAmounts);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to load invoice data: ' + error.message);
      // Try fallback approach
      await fetchWithSeparateQueries();
    } finally {
      setIsLoading(false);
    }
  };

  // Fallback approach with separate queries
  const fetchWithSeparateQueries = async () => {
    try {
      console.log('Trying fallback approach with separate queries');
      
      // First query for pending invoices
      const { data: pendingData, error: pendingError } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          invoice_date,
          due_date,
          total_amount,
          amount_paid,
          status,
          payment_method,
          invoice_items(
            id,
            service_name,
            description,
            quantity,
            price,
            discount
          )
        `)
        .eq('patient_id', selectedPatientId)
        .eq('status', 'pending')
        .order('invoice_date', { ascending: false });
      
      if (pendingError) {
        console.error('Error fetching pending invoices:', pendingError);
        toast.error('Error loading pending invoices');
        return;
      }
      
      // Set initial data from pending invoices
      let allInvoices = pendingData || [];
      console.log(`Found ${allInvoices.length} pending invoices`);
      
      // Second query for partial invoices
      const { data: partialData, error: partialError } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          invoice_date,
          due_date,
          total_amount,
          amount_paid,
          status,
          payment_method,
          invoice_items(
            id,
            service_name,
            description,
            quantity,
            price,
            discount
          )
        `)
        .eq('patient_id', selectedPatientId)
        .eq('status', 'partial')
        .order('invoice_date', { ascending: false });
      
      if (!partialError && partialData) {
        console.log(`Found ${partialData.length} partial invoices`);
        // Combine with pending invoices
        allInvoices = [...allInvoices, ...partialData];
      }

      // Third query for rejected invoices
      const { data: rejectedData, error: rejectedError } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          invoice_date,
          due_date,
          total_amount,
          amount_paid,
          status,
          payment_method,
          notes,
          invoice_items(
            id,
            service_name,
            description,
            quantity,
            price,
            discount
          )
        `)
        .eq('patient_id', selectedPatientId)
        .eq('status', 'rejected')
        .order('invoice_date', { ascending: false });
      
      if (!rejectedError && rejectedData) {
        console.log(`Found ${rejectedData.length} rejected invoices`);
        // Combine with other invoices
        allInvoices = [...allInvoices, ...rejectedData];
      }
      
      // Calculate correct amount_paid based only on approved payments
      const invoicesWithCorrectAmounts = await calculateCorrectAmountPaid(allInvoices);
      setInvoices(invoicesWithCorrectAmounts);
      setFilteredInvoices(invoicesWithCorrectAmounts);
      console.log(`Total invoices: ${invoicesWithCorrectAmounts.length}`);
      
      // Check for rejected payment proofs
      if (invoicesWithCorrectAmounts.length > 0) {
        checkInvoicesForRejectedProofs(invoicesWithCorrectAmounts);
        toast.success(`Found ${invoicesWithCorrectAmounts.length} invoice(s) to process`);
      } else {
        console.log('No pending or partial invoices found');
      }
    } catch (error) {
      console.error('Error in fallback approach:', error);
      toast.error('Could not retrieve invoice data');
    }
  };

  // Helper function to extract approval status from notes
  const getApprovalStatusFromNotes = (notes) => {
    if (!notes) {
      console.log('Notes field is empty');
      return 'pending';
    }
    
    console.log('Payment notes (full content):', notes);
    
    // Add a check for space before parenthesis in the pattern
    if (notes.includes('(Approved by doctor)') || 
        notes.includes(' (Approved by doctor)') ||  // Added space before parenthesis
        notes.includes('Approved by doctor') || 
        notes.includes('(Approved)')) {
      console.log('APPROVED status detected in notes!');
      return 'approved';
    }
    
    // Check for various rejection patterns with space variations
    if (notes.includes('(Rejected by doctor)') || 
        notes.includes(' (Rejected by doctor)') ||  // Added space before parenthesis
        notes.includes('Rejected by doctor') || 
        notes.includes('(Rejected)')) {
      console.log('REJECTED status detected in notes!');
      return 'rejected';
    }
    
    console.log('No approval/rejection text found, defaulting to pending');
    return 'pending';
  };

  // Helper function to extract doctor name from invoice notes
  const extractDoctorFromNotes = (notes) => {
    if (!notes) return null;
    const text = String(notes).replace(/\s+/g, ' ');
    // Broadened patterns to handle variations (colon, dash, spaces, with/without "Dr.")
    const patterns = [
      /doctor\s*[:\-]\s*dr\.?\s*([^|\n]+)/i,
      /assigned\s*doctor\s*[:\-]?\s*dr\.?\s*([^|\n]+)/i,
      /\b-\s*doctor\s*[:\-]?\s*dr\.?\s*([^|\n]+)/i,
      /\bdr\.?\s*([^|\n]+)/i
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  };

  // Extract explicit doctor ID tag if present in notes, e.g., "DoctorId: 123e4567-e89b-12d3-a456-426614174000"
  const extractDoctorIdFromNotes = (notes) => {
    if (!notes) return null;
    const match = String(notes).match(/DoctorId\s*[:\-]\s*([0-9a-fA-F-]{32,})/i);
    return match ? match[1] : null;
  };

  // Load assigned doctor's QR (default) for a given invoice
  const loadDoctorQrForInvoice = async (inv) => {
    try {
      if (!inv?.id) return;
      // Prefer using already-fetched notes to avoid timing issues
      let invData = { id: inv.id, created_by: inv.created_by, notes: inv.notes };
      if (invData.created_by === undefined || invData.notes === undefined) {
        const { data, error } = await supabase
          .from('invoices')
          .select('id, created_by, notes')
          .eq('id', inv.id)
          .single();
        if (!error && data) invData = data;
      }

      let doctorProfile = null;
      // 0) DoctorId tag has the highest priority if present
      const taggedDoctorId = extractDoctorIdFromNotes(invData?.notes || inv?.notes || '');
      if (taggedDoctorId) {
        const { data: taggedDoc } = await supabase
          .from('profiles')
          .select('id, role, full_name, gcash_qr_urls, gcash_qr_default_index')
          .eq('id', taggedDoctorId)
          .single();
        if (taggedDoc && taggedDoc.role === 'doctor') {
          doctorProfile = taggedDoc;
        }
      }

      // Try creator first
      if (!doctorProfile && invData?.created_by) {
        const { data: creator, error: creatorErr } = await supabase
          .from('profiles')
          .select('id, role, full_name, gcash_qr_urls, gcash_qr_default_index')
          .eq('id', invData.created_by)
          .single();
        if (!creatorErr && creator?.role === 'doctor') {
          doctorProfile = creator;
        }
      }

      // Fallback: parse from notes then lookup by name
      if (!doctorProfile) {
        const name = extractDoctorFromNotes((inv?.notes || invData?.notes) || '');
        if (name) {
          // Try exact match first
          let byName = null;
          let nameErr = null;
          {
            const { data, error } = await supabase
              .from('profiles')
              .select('id, role, full_name, gcash_qr_urls, gcash_qr_default_index')
              .eq('role', 'doctor')
              .eq('full_name', name)
              .single();
            byName = data; nameErr = error;
          }
          if (nameErr || !byName) {
            // Fallback to ilike partial match and take the first row
            const { data: list, error: listErr } = await supabase
              .from('profiles')
              .select('id, role, full_name, gcash_qr_urls, gcash_qr_default_index')
              .eq('role', 'doctor')
              .ilike('full_name', `%${name}%`)
              .limit(1);
            if (!listErr && Array.isArray(list) && list.length > 0) {
              byName = list[0];
            }
          }
          if (byName) doctorProfile = byName;
          // Last-resort: pick best-match doctor by name overlap who has at least one QR
          if (!doctorProfile) {
            const { data: allDocs, error: allErr } = await supabase
              .from('profiles')
              .select('id, role, full_name, gcash_qr_urls, gcash_qr_default_index')
              .eq('role', 'doctor');
            if (!allErr && Array.isArray(allDocs)) {
              const lowerTarget = name.toLowerCase();
              const scored = allDocs
                .filter(d => Array.isArray(d.gcash_qr_urls) && d.gcash_qr_urls.length > 0)
                .map(d => ({
                  doc: d,
                  score: (d.full_name || '').toLowerCase().split(/\s+/).reduce((acc, w) => acc + (lowerTarget.includes(w) ? 1 : 0), 0)
                }))
                .sort((a, b) => b.score - a.score);
              if (scored.length > 0 && scored[0].score > 0) {
                doctorProfile = scored[0].doc;
              }
            }
          }
        }
      }

      const urls = doctorProfile?.gcash_qr_urls || [];
      const idx = doctorProfile?.gcash_qr_default_index ?? 0;
      const safeIndex = idx >= 0 && idx < urls.length ? idx : 0;
      const url = urls[safeIndex] || null;
      setDoctorQrUrl(url);
    } catch (err) {
      console.error('Failed to load doctor QR:', err);
      setDoctorQrUrl(null);
    }
  };

  // Updated fetchPaymentHistory function
  const fetchPaymentHistory = async () => {
    try {
      console.log('Fetching payment history for staff');
      setIsLoading(true);
      
      const { data, error } = await supabase
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
          doctor_approval_status,
          approval_status
        `)
        .eq('created_by', selectedPatientId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Fetch invoice data separately to avoid relationship issues
      if (data && data.length > 0) {
        const invoiceIds = data.map(payment => payment.invoice_id).filter(id => id);
        
        if (invoiceIds.length > 0) {
          const { data: invoicesData, error: invoicesError } = await supabase
            .from('invoices')
            .select('id, invoice_number, total_amount, notes, created_by')
            .in('id', invoiceIds);
          
          if (!invoicesError && invoicesData) {
            // Get unique creator IDs to fetch their profiles
            const creatorIds = [...new Set(invoicesData.map(inv => inv.created_by).filter(Boolean))];
            let creatorProfiles = {};
            
            if (creatorIds.length > 0) {
              const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, role')
                .in('id', creatorIds);
              
              if (!profilesError && profilesData) {
                profilesData.forEach(profile => {
                  creatorProfiles[profile.id] = profile;
                });
              }
            }
            
            // Safely combine the payment and invoice data
            const paymentsWithInvoices = data.map(payment => {
              const matchingInvoice = invoicesData.find(inv => inv.id === payment.invoice_id) || {
                invoice_number: 'Unknown',
                total_amount: 0,
                notes: '',
                created_by: null
              };
              
              // Extract doctor information from notes
              const doctorName = extractDoctorFromNotes(matchingInvoice.notes);
              let assignedDoctor = 'N/A';
              
              if (doctorName) {
                assignedDoctor = `Dr. ${doctorName}`;
                console.log(`Found doctor in notes: ${assignedDoctor} for invoice ${matchingInvoice.invoice_number}`);
              } else if (matchingInvoice.created_by) {
                // If no doctor in notes, check if the invoice was created by a doctor
                const creator = creatorProfiles[matchingInvoice.created_by];
                if (creator && creator.role === 'doctor') {
                  assignedDoctor = `Dr. ${creator.full_name}`;
                  console.log(`Found doctor from creator: ${assignedDoctor} for invoice ${matchingInvoice.invoice_number}`);
                } else {
                  console.log(`No doctor found for invoice ${matchingInvoice.invoice_number}. Creator:`, creator);
                }
              } else {
                console.log(`No creator found for invoice ${matchingInvoice.invoice_number}`);
              }
              
              return {
                ...payment,
                doctor_approval_status: getApprovalStatusFromNotes(payment.notes),
                invoices: { 
                  invoice_number: matchingInvoice.invoice_number, 
                  total_amount: matchingInvoice.total_amount,
                  assigned_doctor: assignedDoctor
                }
              };
            });
            
            setPaymentHistory(paymentsWithInvoices);
            console.log('Payment history loaded with statuses:', paymentsWithInvoices.map(p => p.doctor_approval_status));
          } else {
            // If there was an error fetching invoices, still show payment data
            console.warn('Could not fetch invoice details:', invoicesError);
            // If no invoices found, create simplified payment objects
            const simplifiedPayments = data.map(payment => ({
              ...payment,
              doctor_approval_status: 
                getApprovalStatusFromNotes(payment.notes) || 
                'pending',
              invoices: { 
                invoice_number: 'Unknown', 
                total_amount: 0, 
                assigned_doctor: 'N/A' 
              }
            }));
            setPaymentHistory(simplifiedPayments);
          }
        } else {
          // Handle case where there are payments without invoice IDs
          const simplifiedPayments = data.map(payment => ({
            ...payment,
            doctor_approval_status: payment.doctor_approval_status || 
                                    payment.approval_status || 
                                    getApprovalStatusFromNotes(payment.notes) || 
                                    'pending',
            invoices: { invoice_number: 'Unknown', total_amount: 0, assigned_doctor: 'Unknown' }
          }));
          setPaymentHistory(simplifiedPayments);
        }
      } else {
        // No payments found, set empty array
        setPaymentHistory([]);
      }
    } catch (error) {
      console.error('Error fetching payment history:', error);
      toast.error('Failed to load payment history: ' + error.message);
      setPaymentHistory([]); // Ensure we always set a valid array even on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please upload an image (JPG, PNG, GIF) or PDF file');
        return;
      }
      
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      
      setPaymentProof(file);
    }
  };

  // Add this function to force refresh payment data
  const forceRefreshPayments = async () => {
    if (!selectedPatientId) return;
    
    console.log('Force refreshing payment history...');
    toast.info('Refreshing payment status...');
    
    try {
      setIsLoading(true);
      await fetchPaymentHistory();
      toast.success('Payment history updated');
    } catch (error) {
      console.error('Error refreshing payments:', error);
      toast.error('Failed to refresh payment data');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedInvoice) return;
    
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    
    const remainingAmount = selectedInvoice.total_amount - selectedInvoice.amount_paid;
    if (amount > remainingAmount) {
      toast.error(`The maximum payment amount is ₱${remainingAmount.toFixed(2)}`);
      return;
    }
    
    // For GCash, require a reference number. Cash does not require it.
    if (paymentMethod === 'gcash' && !referenceNumber.trim()) {
      toast.error('Please enter your GCash reference number');
      return;
    }
    
    // For GCash, require a payment proof file. Cash does not require it.
    if (paymentMethod === 'gcash' && !paymentProof) {
      toast.error('Please upload your GCash payment proof/receipt');
      return;
    }
    
    setIsUploading(true);
    
    try {
      let fileUrl = null;
      
      // Check if file size is too large
      if (paymentProof) {
        try {
          // Upload payment proof to Supabase Storage
          const fileExt = paymentProof.name.split('.').pop();
          const fileName = `${selectedPatientId}/${Date.now()}.${fileExt}`;
          
          console.log('Attempting to upload file:', fileName);
          
          // Check if file size is too large
          if (paymentProof.size > 5 * 1024 * 1024) {
            toast.error('File size must be less than 5MB');
            setIsUploading(false);
            return;
          }
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('payment-proofs')
            .upload(fileName, paymentProof, {
              cacheControl: '3600',
              upsert: false
            });
          
          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            
            if (uploadError.message && uploadError.message.includes('bucket')) {
              console.log('Storage bucket issue, proceeding without file upload');
              toast.warn('File upload not available. Proceeding with payment without receipt.');
            } else if (uploadError.message && uploadError.message.includes('policy')) {
              console.log('Security policy issue, proceeding without file upload');
              toast.warn('File upload restricted. Proceeding with payment without receipt.');
            } else {
              // For other upload errors, we'll still proceed but notify the user
              toast.warn(`File upload issue: ${uploadError.message}. Proceeding with payment.`);
            }
          } else {
            console.log('File uploaded successfully:', uploadData);
            
            // Get public URL for the uploaded file
            const { data: { publicUrl } } = supabase.storage
              .from('payment-proofs')
              .getPublicUrl(fileName);
            
            fileUrl = publicUrl;
          }
        } catch (uploadErr) {
          console.error('Upload attempt failed completely:', uploadErr);
          toast.warn('Could not upload file. Proceeding with payment.');
        }
      }
      
      // Create payment record with or without the file
      const actualReferenceNumber = paymentMethod === 'cash'
        ? (referenceNumber.trim() || `CASH-${Date.now()}`)
        : referenceNumber.trim();
      
      // Create payment record (matches the structure in the SQL)
      const paymentData = {
        invoice_id: selectedInvoice.id,
        amount: amount,
        payment_date: new Date().toISOString(),
        payment_method: paymentMethod,
        reference_number: actualReferenceNumber,
        created_at: new Date().toISOString(),
        created_by: selectedPatientId,
        approval_status: 'pending' // Add this for doctor approval
      };
      
      if (fileUrl) {
        // If we have a file URL, add it to notes
        paymentData.notes = `Payment proof: ${fileUrl}`;
      } else if (paymentMethod === 'cash') {
        // For cash payments without proof, create a unique white placeholder image URL
        // Include amount and reference number to make each image unique
        const amountText = `₱${amount.toFixed(2)}`;
        const refText = actualReferenceNumber ? `Ref: ${actualReferenceNumber}` : 'Cash Payment';
        
        // Create unique SVG with payment details
        const svgContent = `<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white" stroke="#e5e7eb" stroke-width="2"/><text x="50%" y="35%" font-family="Arial" font-size="16" fill="#374151" text-anchor="middle" dy=".3em">Cash Payment</text><text x="50%" y="50%" font-family="Arial" font-size="14" fill="#6b7280" text-anchor="middle" dy=".3em">${amountText}</text><text x="50%" y="65%" font-family="Arial" font-size="12" fill="#9ca3af" text-anchor="middle" dy=".3em">${refText}</text><text x="50%" y="80%" font-family="Arial" font-size="10" fill="#9ca3af" text-anchor="middle" dy=".3em">No Proof Uploaded</text></svg>`;
        
        // Use TextEncoder to properly encode UTF-8 strings for btoa
        const utf8Bytes = new TextEncoder().encode(svgContent);
        const binaryString = String.fromCharCode(...utf8Bytes);
        const base64String = btoa(binaryString);
        const whiteImageUrl = `data:image/svg+xml;base64,${base64String}`;
        paymentData.notes = `Payment proof: ${whiteImageUrl}`;
      }
      
      console.log('Creating payment record:', paymentData);
      
      const { data: paymentRecord, error: paymentError } = await supabase
        .from('payments')
        .insert([paymentData])
        .select();
      
      if (paymentError) {
        console.error('Error creating payment record:', paymentError);
        toast.error(`Database error: ${paymentError.message || 'Could not create payment record'}`);
        setIsUploading(false);
        return;
      }

      // Send notification to doctor about new payment submission
      try {
        if (createPayment && typeof createPayment === 'function') {
          const notificationResult = await createPayment(
            paymentRecord[0].id,
            selectedInvoice.id,
            amount,
            paymentMethod,
            actualReferenceNumber
          );
          
          if (notificationResult.success) {
            console.log('Doctor notified about new payment submission');
          } else {
            console.warn('Failed to notify doctor:', notificationResult.error);
          }
        }
      } catch (notificationError) {
        console.error('Error sending payment notification:', notificationError);
        // Don't fail the payment submission if notification fails
      }
      
      // Update the invoice amount_paid and status based on payment amount
      const newAmountPaid = selectedInvoice.amount_paid + amount;
      const newStatus = newAmountPaid >= selectedInvoice.total_amount ? 'paid' : 'partial';
      
      const { error: invoiceUpdateError } = await supabase
        .from('invoices')
        .update({
          amount_paid: newAmountPaid,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedInvoice.id);
      
      if (invoiceUpdateError) {
        console.error('Error updating invoice:', invoiceUpdateError);
        // Continue anyway since payment was created
      }

      // Store payment information for success view
      const paymentInfo = {
        id: paymentRecord?.[0]?.id || `payment-${Date.now()}`,
        invoiceNumber: selectedInvoice.invoice_number,
        amount: amount,
        date: new Date().toISOString(),
        method: paymentMethod,
        referenceNumber: actualReferenceNumber,
        isPartial: newStatus === 'partial',
        remainingBalance: newStatus === 'partial' ? (selectedInvoice.total_amount - newAmountPaid) : 0
      };
      setCurrentPaymentInfo(paymentInfo);
      
      // Add this invoice ID to paid invoices in session
      setPaidInvoicesInSession(prev => [...prev, selectedInvoice.id]);
      
      // Show payment success view
      setShowPaymentSuccess(true);
      
      // Show appropriate success message based on payment type
      if (newStatus === 'partial') {
        toast.success(`Partial payment of ₱${amount.toFixed(2)} submitted! Remaining balance: ₱${(selectedInvoice.total_amount - newAmountPaid).toFixed(2)}`);
      } else {
        toast.success('Payment submitted successfully! Doctor has been notified.');
      }
      
      // Reset form for next time
      setPaymentProof(null);
      setReferenceNumber('');
      setPaymentAmount('');
      
      // Refresh data (but don't close the modal yet - we'll show success view)
      fetchInvoices();
      fetchPaymentHistory();
      
    } catch (error) {
      console.error('Error submitting payment:', error);
      toast.error(`Failed to submit payment: ${error.message || 'Unknown error'}. Please try again.`);
      setIsUploading(false);
    } finally {
      setIsUploading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', options);
  };

  const calculateRemainingAmount = (invoice) => {
    return invoice.total_amount - invoice.amount_paid;
  };

  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'confirmed':
      case 'payment_confirmed':
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
      case 'pending_confirmation':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handlePaymentSuccessDone = () => {
    // Close the modal and reset everything for next payment
    setShowPaymentSuccess(false);
    setShowPaymentModal(false);
    setSelectedInvoice(null);
    setCurrentPaymentInfo(null);
  };

  // Enhanced renderPaymentStatusBadge function
  const renderPaymentStatusBadge = (payment) => {
    if (!payment) return null;
    
    // Get status from all possible sources and normalize it
    let status = payment.doctor_approval_status || 
                payment.approval_status || 
                getApprovalStatusFromNotes(payment.notes) || 
                'pending';
    
    let statusLabel = '';
    let statusClass = '';

    // Convert status to lowercase for consistent comparison
    switch(status.toLowerCase()) {
      case 'approved':
        statusLabel = 'Approved';
        statusClass = 'bg-green-100 text-green-800';
        break;
      case 'rejected':
        statusLabel = 'Rejected';
        statusClass = 'bg-red-100 text-red-800';
        break;
      case 'pending':
      default:
        statusLabel = 'Pending Approval';
        statusClass = 'bg-yellow-100 text-yellow-800';
        break;
    }

    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}`}>
        {statusLabel}
      </span>
    );
  };

  // Function to check if an invoice has already been paid in this session
  const isInvoicePaidInSession = (invoiceId) => {
    return paidInvoicesInSession.includes(invoiceId);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Manage Payments</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Patient:</span>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search invoices by number, amount, or date..."
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('pending')}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'pending'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pending Payments
            </button>
            <button
              onClick={() => {
                setActiveTab('history');
                fetchPaymentHistory(); // Refresh payment history data
              }}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'history'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Payment History
            </button>
          </nav>
        </div>

        {/* Pending Payments Tab */}
        {activeTab === 'pending' && (
          <div className="bg-white shadow-lg rounded-lg overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
            </div>
                <div className="ml-3">
                  <h3 className="text-lg font-semibold text-gray-900">Pending Invoices</h3>
                  <p className="text-sm text-gray-600">Manage payments for patient bills</p>
                </div>
              </div>
            </div>
            
              {invoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Invoice Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Doctor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredInvoices.map((invoice) => {
                              const doctorName = extractDoctorFromNotes(invoice.notes);
                      const balance = calculateRemainingAmount(invoice);
                      const isOverdue = new Date(invoice.due_date) < new Date();
                      
                      return (
                        <tr key={invoice.id} className="hover:bg-gray-50 transition-colors duration-150">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0">
                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                  <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                        </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  #{invoice.invoice_number || invoice.id.substring(0, 8)}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {formatDate(invoice.invoice_date)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0">
                                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                                  <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">
                                  {doctorName ? `Dr. ${doctorName}` : 'N/A'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              <div className="font-semibold">₱{invoice.total_amount.toFixed(2)}</div>
                          {invoice.amount_paid > 0 && (
                                <div className="text-xs text-green-600">
                                  Paid: ₱{invoice.amount_paid.toFixed(2)}
                            </div>
                          )}
                              <div className="text-xs text-red-600 font-medium">
                                Balance: ₱{balance.toFixed(2)}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                invoice.status === 'paid' 
                                  ? 'bg-green-100 text-green-800' 
                                  : invoice.status === 'partial'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : invoice.status === 'rejected'
                                  ? 'bg-red-100 text-red-800'
                                  : isOverdue
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-orange-100 text-orange-800'
                              }`}>
                                <span className={`w-1.5 h-1.5 mr-1.5 rounded-full ${
                                  invoice.status === 'paid' 
                                    ? 'bg-green-400' 
                                    : invoice.status === 'partial'
                                    ? 'bg-yellow-400'
                                    : invoice.status === 'rejected'
                                    ? 'bg-red-400'
                                    : isOverdue
                                    ? 'bg-red-400'
                                    : 'bg-orange-400'
                                }`}></span>
                                {invoice.status === 'paid' ? 'Paid' : 
                                 invoice.status === 'partial' ? 'Partial' :
                                 invoice.status === 'rejected' ? 'Rejected' :
                                 isOverdue ? 'Overdue' : 'Need to Pay'}
                              </span>
                              {(invoice.status === 'rejected' || invoicesWithRejectedProofs.has(invoice.id)) && (
                                <RejectionMessage invoiceId={invoice.id} />
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className={`${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                              {formatDate(invoice.due_date)}
                              {isOverdue && (
                                <div className="text-xs text-red-500">Overdue</div>
                          )}
                        </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-2">
                        {isInvoicePaidInSession(invoice.id) ? (
                          <span className="inline-flex items-center px-3 py-2 text-sm leading-4 font-medium text-green-700 bg-green-100 rounded-md">
                            <FiCheck className="mr-2" />
                                  Submitted
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowPaymentModal(true);
                              setPaymentAmount(calculateRemainingAmount(invoice).toFixed(2));
                              setShowPaymentSuccess(false);
                              setDoctorQrUrl(null);
                              loadDoctorQrForInvoice(invoice);
                            }}
                                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-150"
                                >
                                  <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                  </svg>
                                  Pay Now
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedInvoice(invoice)}
                                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-150"
                              >
                                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                View
                        </button>
                      </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              ) : (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No pending invoices</h3>
                <p className="mt-1 text-sm text-gray-500">All invoices are paid or waiting for confirmation.</p>
                </div>
              )}
          </div>
        )}

        {/* Payment History Tab */}
        {activeTab === 'history' && (
          <div className="bg-white shadow-lg rounded-lg overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-semibold text-gray-900">Payment History</h3>
                    <p className="text-sm text-gray-600">Track submitted payment confirmations</p>
                  </div>
              </div>
              <button 
                onClick={forceRefreshPayments}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-150"
              >
                  <svg className="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
            <div className="border-t border-gray-200">
              {paymentHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Invoice
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date Submitted
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Method
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Assigned Doctor
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(() => {
                        const grouped = new Map();
                        const totalsByInvoice = new Map();
                        for (const p of paymentHistory) {
                          const key = p.invoice_id;
                          if (!grouped.has(key)) {
                            grouped.set(key, p);
                          } else {
                            const prev = grouped.get(key);
                            const prevDate = new Date(prev.created_at || prev.payment_date || 0);
                            const curDate = new Date(p.created_at || p.payment_date || 0);
                            if (curDate > prevDate) grouped.set(key, p);
                          }
                          // Only include approved payments in the total
                          const paymentStatus = p.doctor_approval_status || p.approval_status || 'pending';
                          if (paymentStatus.toLowerCase() === 'approved') {
                            const acc = totalsByInvoice.get(key) || 0;
                            totalsByInvoice.set(key, acc + (parseFloat(p.amount || 0) || 0));
                          }
                        }
                        return Array.from(grouped.values()).map((payment) => {
                          const status = payment.doctor_approval_status || payment.approval_status || 'pending';
                          const statusLower = status.toLowerCase();
                          
                          return (
                            <tr key={payment.invoice_id} className="hover:bg-gray-50 transition-colors duration-150">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0">
                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                  <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                            #{payment.invoices?.invoice_number || payment.invoice_id.substring(0, 8)}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {formatDate(payment.payment_date || payment.created_at)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">
                            ₱{(totalsByInvoice.get(payment.invoice_id) || 0).toFixed(2)}
                            </div>
                          </td>
                          
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                statusLower === 'approved' ? 'bg-green-100 text-green-800' :
                                statusLower === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                                <span className={`w-1.5 h-1.5 mr-1.5 rounded-full ${
                                  statusLower === 'approved' ? 'bg-green-400' :
                                  statusLower === 'rejected' ? 'bg-red-400' :
                                  'bg-yellow-400'
                                }`}></span>
                                {statusLower === 'approved' ? (
                                  <><svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>Approved</> 
                                ) : statusLower === 'rejected' ? (
                                  <><svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>Rejected</>
                                ) : (
                                  <><svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                  </svg>Pending</>
                                )}
                            </span>
                              {statusLower === 'rejected' && (
                                <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded-md">
                                  <div className="flex items-start">
                                    <svg className="h-3 w-3 text-red-400 mt-0.5 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    <p className="text-xs text-red-700 font-medium">Payment rejected. Pay again with valid proof.</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                            {formatDate(payment.payment_date || payment.created_at)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0">
                                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                                  payment.payment_method === 'GCash' ? 'bg-blue-100' :
                                  payment.payment_method === 'PayMaya' ? 'bg-green-100' :
                                  payment.payment_method === 'Bank Transfer' ? 'bg-purple-100' :
                                  'bg-gray-100'
                                }`}>
                                  <svg className={`h-4 w-4 ${
                                    payment.payment_method === 'GCash' ? 'text-blue-600' :
                                    payment.payment_method === 'PayMaya' ? 'text-green-600' :
                                    payment.payment_method === 'Bank Transfer' ? 'text-purple-600' :
                                    'text-gray-600'
                                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                  </svg>
                                </div>
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">
                              {payment.payment_method}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0">
                                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                                  <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">
                            {payment.invoices?.assigned_doctor || 'N/A'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => openProofGalleryForInvoice(payment.invoice_id)}
                                className="inline-flex items-center justify-center p-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200"
                                title="View Proof"
                              >
                                <FiEye className="h-4 w-4" />
                              </button>
                              {payment.invoices ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadPDF(payment.invoice_id)}
                                    className="inline-flex items-center justify-center p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                                    title="Download PDF"
                                  >
                                    <FiDownload className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const invoice = invoices.find(inv => inv.id === payment.invoice_id);
                                      if (invoice) {
                                        setSelectedInvoice(invoice);
                                        setShowUnifiedPrinter(true);
                                      }
                                    }}
                                    className="inline-flex items-center justify-center p-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200"
                                    title="Print Invoice"
                                  >
                                    <FiPrinter className="h-4 w-4" />
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FiClock className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No payment history</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    You haven't submitted any payment confirmations yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        
      </div>
      )}

      {/* Invoice Details Modal */}
      {selectedInvoice && !showPaymentModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-semibold text-gray-900">
                Invoice #{selectedInvoice.invoice_number || selectedInvoice.id.substring(0, 8)}
              </h3>
              <button
                type="button"
                className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                onClick={() => setSelectedInvoice(null)}
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pb-4 border-b border-gray-200">
                <div>
                  <p className="text-sm text-gray-500">Invoice Date</p>
                  <p className="font-medium">{formatDate(selectedInvoice.invoice_date)}</p>
                </div>
                <div className="mt-2 sm:mt-0">
                  <p className="text-sm text-gray-500">Due Date</p>
                  <p className="font-medium">{formatDate(selectedInvoice.due_date)}</p>
                </div>
                <div className="mt-2 sm:mt-0">
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(selectedInvoice.status)}`}>
                    {selectedInvoice.status}
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-base font-medium text-gray-900">Invoice Items</h4>
                <div className="mt-2 -mx-4 sm:-mx-6 overflow-x-auto">
                  <div className="inline-block min-w-full py-2 align-middle">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Service
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Quantity
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Price
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedInvoice.invoice_items && selectedInvoice.invoice_items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              <div>
                                <div>{item.description || item.service_name}</div>
                                {item.description && (
                                  <div className="text-sm text-gray-500">{item.description}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                              {item.quantity}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                              ₱{item.price.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                              ₱{(item.quantity * item.price).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <div className="w-full sm:w-64">
                  <div className="flex justify-between py-2">
                    <span className="font-medium text-gray-700">Total Amount:</span>
                    <span className="font-medium text-gray-900">₱{selectedInvoice.total_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="font-medium text-gray-700">Amount Paid:</span>
                    <span className="font-medium text-green-600">₱{selectedInvoice.amount_paid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-t pt-2">
                    <span className="font-medium text-gray-700">Balance Due:</span>
                    <span className="font-bold text-red-600">₱{calculateRemainingAmount(selectedInvoice).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end space-x-3">
                <button
                  type="button"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  onClick={() => setSelectedInvoice(null)}
                >
                  Close
                </button>
                {selectedInvoice.status !== 'paid' && !isInvoicePaidInSession(selectedInvoice.id) && (
                  <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    onClick={() => {
                      setShowPaymentModal(true);
                      setPaymentAmount(calculateRemainingAmount(selectedInvoice).toFixed(2));
                      setShowPaymentSuccess(false);
                      setDoctorQrUrl(null);
                      loadDoctorQrForInvoice(selectedInvoice);
                    }}
                  >
                    
                    Pay Now
                  </button>
                )}
                {isInvoicePaidInSession(selectedInvoice.id) && (
                  <span className="inline-flex items-center px-4 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-md">
                    <FiCheck className="mr-2" />
                    Payment Submitted
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4">
            {showPaymentSuccess ? (
              // Payment Success View
              <div className="p-6">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Payment Successful
                  </h3>
                  <button
                    type="button"
                    className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    onClick={handlePaymentSuccessDone}
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="mt-6 text-center">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                    <FiCheck className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="mt-3 text-lg font-medium text-gray-900">Payment Submitted Successfully</h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Your payment is waiting for approval from the doctor. You can view the status in your payment history.
                  </p>
                </div>
                
                <div className="mt-6 bg-gray-50 p-4 rounded-md">
                  <h4 className="font-medium text-gray-700 mb-2">Payment Details</h4>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Invoice</dt>
                      <dd className="mt-1 text-sm text-gray-900">#{currentPaymentInfo?.invoiceNumber}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Amount</dt>
                      <dd className="mt-1 text-sm text-gray-900">₱{parseFloat(currentPaymentInfo?.amount).toFixed(2)}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Date</dt>
                      <dd className="mt-1 text-sm text-gray-900">{formatDate(currentPaymentInfo?.date)}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Reference Number</dt>
                      <dd className="mt-1 text-sm text-gray-900">{currentPaymentInfo?.referenceNumber}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500">Status</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Pending Doctor Approval
                        </span>
                      </dd>
                    </div>
                    {currentPaymentInfo?.isPartial && (
                      <div className="sm:col-span-2">
                        <dt className="text-sm font-medium text-gray-500">Payment Type</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            Partial Payment
                          </span>
                        </dd>
                      </div>
                    )}
                    {currentPaymentInfo?.isPartial && currentPaymentInfo?.remainingBalance > 0 && (
                      <div className="sm:col-span-2">
                        <dt className="text-sm font-medium text-gray-500">Remaining Balance</dt>
                        <dd className="mt-1 text-sm font-semibold text-red-600">
                          ₱{currentPaymentInfo.remainingBalance.toFixed(2)}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
                
                {currentPaymentInfo?.isPartial && currentPaymentInfo?.remainingBalance > 0 && (
                  <div className="mt-4 bg-blue-50 border-l-4 border-blue-400 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <FiInfo className="h-5 w-5 text-blue-400" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-blue-700">
                          <strong>Partial Payment Notice:</strong> You still have a remaining balance of ₱{currentPaymentInfo.remainingBalance.toFixed(2)}. 
                          Once this payment is approved by the doctor, you can make another payment for the remaining amount.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mt-6 flex justify-between">
                 
                  <button
                    type="button"
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none"
                    onClick={handlePaymentSuccessDone}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              // Payment Form View
              <>
                <div className="flex justify-between items-start p-4 border-b">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Make a Payment
                  </h3>
                  <button
                    type="button"
                    className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    onClick={() => setShowPaymentModal(false)}
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handlePaymentSubmit} className="grid grid-cols-1 md:grid-cols-2">
                  {/* Left Column - Payment Details */}
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Invoice
                      </label>
                      <div className="mt-1 text-gray-700 text-right">
                        #{selectedInvoice.invoice_number || selectedInvoice.id.substring(0, 8)} - ₱{selectedInvoice.total_amount.toFixed(2)}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Amount Due
                      </label>
                      <div className="mt-1 text-gray-700 text-right">
                        ₱{calculateRemainingAmount(selectedInvoice).toFixed(2)}
                      </div>
                    </div>

                                         <div>
                       <label htmlFor="paymentAmount" className="block text-sm font-medium text-gray-700">
                         Payment Amount
                       </label>
                       <div className="mt-1 relative rounded-md shadow-sm">
                         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                           <span className="text-gray-500 sm:text-sm">₱</span>
                         </div>
                         <input
                           type="number"
                           id="paymentAmount"
                           name="paymentAmount"
                           value={paymentAmount}
                           onChange={(e) => setPaymentAmount(e.target.value)}
                           min="0.01"
                           max={calculateRemainingAmount(selectedInvoice)}
                           step="0.01"
                           className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-7 pr-3 sm:text-sm border-gray-300 rounded-md py-2 text-right"
                           placeholder="0.00"
                         />
                       </div>
                       <p className="mt-1 text-xs text-gray-500">
                         Enter the amount you want to pay (max: ₱{calculateRemainingAmount(selectedInvoice).toFixed(2)})
                       </p>
                       <p className="mt-1 text-xs text-blue-600">
                         💡 <strong>Tip:</strong> You can pay any amount up to the remaining balance. If you pay less than the full amount, it will be marked as a partial payment and you can pay the remaining balance later.
                       </p>
                     </div>

                    {paymentMethod === 'gcash' && (
                      <div>
                        <label htmlFor="referenceNumber" className="block text-sm font-medium text-gray-700">
                          GCash Reference Number
                        </label>
                        <input
                          type="text"
                          id="referenceNumber"
                          name="referenceNumber"
                          value={referenceNumber}
                          onChange={(e) => setReferenceNumber(e.target.value)}
                          required={paymentMethod === 'gcash'}
                          className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-3 pr-3 sm:text-sm border-gray-300 rounded-md py-2 font-bold"
                          placeholder="Enter GCash transaction reference number"
                        />
                      </div>
                    )}

                    <div>
                      <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700">
                        Payment Method
                      </label>
                      <select
                        id="paymentMethod"
                        name="paymentMethod"
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        required
                      >
                        <option value="gcash">GCash</option>
                        <option value="cash">Cash</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Right Column - QR Code */}
                  <div className="bg-white p-6 flex flex-col items-center text-black">
                    {paymentMethod === 'gcash' && (
                      <>
                        <div className="bg-white p-3 rounded mb-3 w-64">
                          <img 
                            src={doctorQrUrl || gcashQR} 
                            alt="GCash QR Code" 
                            className="w-full h-auto object-contain"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'block';
                            }} 
                          />
                          <div className="hidden text-center">
                            <p className="text-gray-500">QR Code Not Available</p>
                          </div>
                        </div>
                        <p className="text-sm text-center text-gray-800">Transfer fees may apply.</p>
                        
                        <p className="text-xs mt-3 text-center">
                          Scan this QR code using your GCash app and other apps that support QR code payments.
                        </p>
                        <p className="text-xs mt-1 text-center">
                          After payment, upload your invoice/receipt below and click "Make Payment" to confirm
                        </p>

                        {/* Upload Section */}
                        <div className="w-full mt-auto">
                          <div className="mt-4 bg-white rounded p-3">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Upload GCash Invoice/Receipt
                            </label>
                            <div className="flex items-center">
                              <label className="flex-1">
                                <div className="px-3 py-2 border border-gray-300 bg-green-600 text-white rounded text-sm flex items-center justify-center cursor-pointer hover:bg-green-700 focus:bg-green-700">
                                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                  </svg>
                                  Choose File
                                  <input
                                    id="file-upload"
                                    name="file-upload"
                                    type="file"
                                    className="sr-only"
                                    onChange={handleFileUpload}
                                    accept="image/*,.pdf"
                                  />
                                </div>
                              </label>
                              {paymentProof && (
                                <button
                                  type="button"
                                  onClick={() => setPaymentProof(null)}
                                  className="ml-2 text-sm text-gray-800 hover:text-gray-700"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                            {paymentProof && (
                              <div className="mt-2 flex items-center">
                                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded border border-gray-200">
                                  {paymentProof.type.startsWith('image/') ? (
                                    <img
                                      src={URL.createObjectURL(paymentProof)}
                                      alt="Preview"
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="h-full w-full bg-gray-100 flex items-center justify-center">
                                      <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                                <div className="ml-2">
                                  <p className="text-sm text-gray-700">{paymentProof.name}</p>
                                  <p className="text-xs text-gray-500">{(paymentProof.size / 1024).toFixed(1)} KB</p>
                                </div>
                              </div>
                            )}
                            
                            {/* Help text for GCash payment */}
                            {paymentMethod === 'gcash' && !paymentProof && (
                              <div className="mt-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2">
                                <div className="flex items-center">
                                  <svg className="h-4 w-4 mr-2 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                  </svg>
                                  Please upload your GCash payment proof to enable the "Make Payment" button
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {paymentMethod === 'cash' && (
                      <div className="text-center py-8">
                        <p className="text-lg font-bold">Cash Payment</p>
                        <p className="mt-2 text-sm">
                          Please pay at our clinic during office hours<br />
                          <br />

                          <br />
                          <p className="text-small font-bold">San Juan Branch:</p>
                          Monday to Friday:1:00 PM - 5:00 PM<br />
Sunday: 8:00 AM - 5:00 PM
<br />
<br /> <p className="text-small font-bold">Cabugao Branch:</p>
Monday to Friday:8:00 AM - 12:00 PM<br />
Saturday: 8:00 AM - 5:00 PM
                        </p>

                        {/* Optional upload for cash payments */}
                        <div className="w-full mt-6">
                          <div className="mt-4 bg-white rounded p-3">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Upload Payment Proof (optional)
                            </label>
                            <div className="flex items-center justify-center">
                              <label className="flex-1 max-w-xs">
                                <div className="px-3 py-2 border border-gray-300 bg-green-600 text-white rounded text-sm flex items-center justify-center cursor-pointer hover:bg-green-700 focus:bg-green-700">
                                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                  </svg>
                                  Choose File
                                  <input
                                    id="cash-file-upload"
                                    name="cash-file-upload"
                                    type="file"
                                    className="sr-only"
                                    onChange={handleFileUpload}
                                    accept="image/*,.pdf"
                                  />
                                </div>
                              </label>
                              {paymentProof && (
                                <button
                                  type="button"
                                  onClick={() => setPaymentProof(null)}
                                  className="ml-2 text-sm text-gray-800 hover:text-gray-700"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                            {paymentProof && (
                              <div className="mt-2 flex items-center justify-center">
                                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded border border-gray-200">
                                  {paymentProof.type.startsWith('image/') ? (
                                    <img
                                      src={URL.createObjectURL(paymentProof)}
                                      alt="Preview"
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="h-full w-full bg-gray-100 flex items-center justify-center">
                                      <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                                <div className="ml-2">
                                  <p className="text-sm text-gray-700">{paymentProof.name}</p>
                                  <p className="text-xs text-gray-500">{(paymentProof.size / 1024).toFixed(1)} KB</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'bank_transfer' && (
                      <div className="text-center py-8">
                        <p className="text-lg font-medium">Bank Transfer</p>
                        <p className="mt-2 text-sm">
                          Bank: BDO<br />
                          Account Name: Silario Dental Clinic<br />
                          Account Number: 1234-5678-9012
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Footer with buttons */}
                  <div className="col-span-1 md:col-span-2 flex justify-end space-x-3 p-4 border-t">
                    <button
                      type="button"
                      className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      onClick={() => setShowPaymentModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={`px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
                        isUploading || (paymentMethod === 'gcash' && !paymentProof)
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-primary-600 hover:bg-primary-700'
                      }`}
                      disabled={isUploading || (paymentMethod === 'gcash' && !paymentProof)}
                    >
                      {isUploading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        'Make Payment'
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Proof Gallery Modal */}
      {showProofModal && (
        <div className="fixed inset-0 bg-gray-700 bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Payment Proofs</h3>
              <button
                type="button"
                className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                onClick={() => setShowProofModal(false)}
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              {proofInvoiceMeta && (
                <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded border bg-gray-50">
                    <div className="text-xs text-gray-500">Total Amount Due</div>
                    <div className="font-semibold">₱{parseFloat(proofInvoiceMeta.total_amount || 0).toFixed(2)}</div>
                  </div>
                  <div className="p-3 rounded border bg-gray-50">
                    <div className="text-xs text-gray-500">Amount Paid</div>
                    <div className="font-semibold text-green-600">₱{parseFloat(proofInvoiceMeta.amount_paid || 0).toFixed(2)}</div>
                  </div>
                  <div className="p-3 rounded border bg-gray-50">
                    <div className="text-xs text-gray-500">Remaining Balance</div>
                    <div className="font-semibold text-red-600">₱{Math.max((proofInvoiceMeta.total_amount || 0) - (proofInvoiceMeta.amount_paid || 0), 0).toFixed(2)}</div>
                  </div>
                </div>
              )}
              {proofGallery && proofGallery.length > 0 ? (
                <div className="flex gap-3 overflow-x-auto p-1">
                  {proofGallery.map((p, idx) => (
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
                          <span className="font-semibold text-gray-900">₱{parseFloat(p.amount || 0).toFixed(2)}</span>
                        </div>
                        {p.ref && (
                          <div className="flex justify-between text-xs mt-1">
                            <span className="text-gray-600">Reference #:</span>
                            <span className="font-semibold text-gray-800">{p.ref}</span>
                          </div>
                        )}
                        <div className="mt-1 text-right">
                          {p.isWhitePlaceholder ? (
                            <span className="text-blue-600 text-xs">Cash Payment</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setFullProofUrl(p.url); setFullProofRef(p.ref || ''); setShowFullProofModal(true); }}
                              className="text-primary-600 hover:text-primary-800 text-xs"
                            >
                              View Proof
                            </button>
                          )}
                        </div>
                      </div>
                      {proofInvoiceMeta && false && (
                        <div className="px-4 py-3 border-t bg-gray-50">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">Total Amount Due:</span>
                            <span className="font-semibold text-gray-900">₱{parseFloat(proofInvoiceMeta.total_amount || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs mt-1">
                            <span className="text-gray-600">Remaining Amount to Pay:</span>
                            <span className="font-semibold text-red-600">₱{Math.max((proofInvoiceMeta.total_amount || 0) - (proofInvoiceMeta.amount_paid || 0), 0).toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 flex gap-3 overflow-x-auto">
                  {/* Show payment details card when no proof images */}
                  {proofInvoiceMeta && proofInvoiceMeta.amount_paid > 0 && (
                    <div className="min-w-[300px] max-w-[300px] bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="p-6 text-center bg-blue-50">
                        <FiFileText className="mx-auto h-12 w-12 text-blue-500 mb-4" />
                        <h5 className="font-semibold text-blue-900 mb-2">
                          {proofInvoiceMeta.payment_method === 'cash' ? 'Cash Payment' : 'Payment Details'}
                        </h5>
                        <p className="text-sm text-blue-700">No proof uploaded</p>
                      </div>
                      <div className="px-4 py-3 border-t bg-gray-50">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">Amount Paid:</span>
                          <span className="font-semibold text-gray-900">₱{parseFloat(proofInvoiceMeta.amount_paid || 0).toFixed(2)}</span>
                        </div>
                        {proofInvoiceMeta.reference_number && (
                          <div className="flex justify-between text-xs mt-1">
                            <span className="text-gray-600">Reference #:</span>
                            <span className="font-semibold text-gray-800">{proofInvoiceMeta.reference_number}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs mt-1">
                          <span className="text-gray-600">Method:</span>
                          <span className="text-gray-800 capitalize">{proofInvoiceMeta.payment_method || 'Cash'}</span>
                        </div>
                        <div className="mt-2 text-right">
                          <span className="text-blue-600 text-xs">Payment Recorded</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-end">
              <button
                type="button"
                className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                onClick={() => setShowProofModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-size single proof modal */}
      {showFullProofModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 relative flex flex-col items-center">
            <button
              type="button"
              className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700"
              onClick={() => setShowFullProofModal(false)}
            >
              <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="mb-4 text-center w-full">
              {fullProofRef ? (
                <>
                  <span className="font-medium text-gray-700">Reference #:</span>
                  <span className="ml-2 text-blue-700 font-mono tracking-wide">{fullProofRef}</span>
                </>
              ) : null}
            </div>
            {fullProofUrl && (fullProofUrl.toLowerCase().includes('.pdf') ? (
              <a href={fullProofUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-800">Open PDF</a>
            ) : (
              <img src={fullProofUrl} alt="Payment Proof" className="max-w-full max-h-[90vh] object-contain rounded-lg border border-blue-200 shadow-md" />
            ))}
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
          userRole="staff"
          showPreview={true}
          showDownload={true}
          showPrint={true}
        />
      )}
      </div>
    </div>
  );
};

export default Payments;