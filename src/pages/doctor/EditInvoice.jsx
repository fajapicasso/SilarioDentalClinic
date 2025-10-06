import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import supabase from '../../config/supabaseClient';
import { toast } from 'react-toastify';
import { FiPlus, FiCheck, FiFileText, FiUser, FiActivity, FiCreditCard, FiX } from 'react-icons/fi';

const EditInvoice = () => {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [tempItem, setTempItem] = useState({ description: '', unit_price: '', quantity: 1 });
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [subtotal, setSubtotal] = useState(0);
  const [discountType, setDiscountType] = useState('percentage');
  const [invoiceData, setInvoiceData] = useState(null);
  const [allServices, setAllServices] = useState([]);

  useEffect(() => {
    const fetchInvoice = async () => {
      setIsLoading(true);
      try {
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
          .eq('id', invoiceId);
        if (invoiceFetchError) throw invoiceFetchError;
        if (invoiceArr && invoiceArr[0]) {
          setInvoiceData(invoiceArr[0]);
          setPatient({
            id: invoiceArr[0].patient_id,
            full_name: invoiceArr[0].profiles?.full_name || '',
            phone: invoiceArr[0].profiles?.phone || '',
            email: invoiceArr[0].profiles?.email || '',
            address: invoiceArr[0].profiles?.address || ''
          });
          setPaymentMethod(invoiceArr[0].payment_method || '');
          setPaymentStatus(invoiceArr[0].status || 'pending');
          setNotes(invoiceArr[0].notes || '');
          setDiscount(invoiceArr[0].discount || 0);
          setTax(invoiceArr[0].tax || 0);
        }
        // Fetch invoice items
        const { data: items, error: itemsError } = await supabase
          .from('invoice_items')
          .select('id, description, service_name, price, quantity, discount')
          .eq('invoice_id', invoiceId);
        if (itemsError) throw itemsError;
        setLineItems((items || []).map(item => ({
          id: item.id,
          description: item.service_name || item.description,
          unit_price: item.price,
          quantity: item.quantity,
          total: item.price * item.quantity,
          discount: item.discount || 0
        })));
      } catch (error) {
        toast.error('Failed to load invoice for editing: ' + error.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInvoice();
  }, [invoiceId]);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const { data, error } = await supabase
          .from('services')
          .select('id, name, price, duration');
        if (!error && data) setAllServices(data);
      } catch (e) {
        // ignore
      }
    };
    fetchServices();
  }, []);

  const handleAddService = (service) => {
    if (!service) return;
    const newItem = {
      id: Date.now(),
      description: service.name,
      unit_price: parseFloat(service.price) || 0,
      quantity: 1,
      total: parseFloat(service.price) || 0,
    };
    setLineItems([...lineItems, newItem]);
  };

  useEffect(() => {
    // Calculate subtotal
    const calculatedSubtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    setSubtotal(calculatedSubtotal);
  }, [lineItems]);

  const handleAddLineItem = () => {
    if (!tempItem.description || !tempItem.unit_price) {
      toast.error('Please enter item description and price');
      return;
    }
    const unitPrice = parseFloat(tempItem.unit_price);
    if (isNaN(unitPrice) || unitPrice < 0) {
      toast.error('Please enter a valid price');
      return;
    }
    const quantity = parseInt(tempItem.quantity, 10) || 1;
    if (isNaN(quantity) || quantity < 1) {
      toast.error('Please enter a valid quantity');
      return;
    }
    const newItem = {
      id: Date.now(),
      description: tempItem.description,
      unit_price: unitPrice,
      quantity: quantity,
      total: unitPrice * quantity
    };
    setLineItems([...lineItems, newItem]);
    setTempItem({ description: '', unit_price: '', quantity: 1 });
  };

  const handleRemoveLineItem = (itemId) => {
    setLineItems(lineItems.filter(item => item.id !== itemId));
  };

  const handleSave = async () => {
    if (!patient) {
      toast.error('Please select a patient');
      return;
    }
    if (lineItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    // Calculate totals
    let discountAmount = 0;
    if (discount > 0) {
      if (discountType === 'percentage') {
        discountAmount = (subtotal * discount) / 100;
      } else {
        discountAmount = discount;
      }
    }
    const taxAmount = ((subtotal - discountAmount) * tax) / 100;
    const total = subtotal - discountAmount + taxAmount;
    setIsLoading(true);
    try {
      // Update invoice
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          payment_method: paymentMethod,
          status: paymentStatus,
          notes: notes,
          total_amount: total,
          amount_paid: paymentStatus === 'paid' ? total : (paymentStatus === 'partial' ? total / 2 : 0),
          discount: discount,
          tax: tax,
          updated_at: new Date().toISOString()
        })
        .eq('id', invoiceId);
      if (invoiceError) throw invoiceError;
      // Fetch existing items
      const { data: existingItems } = await supabase
        .from('invoice_items')
        .select('id')
        .eq('invoice_id', invoiceId);
      const existingIds = new Set((existingItems || []).map(item => item.id));
      const currentIds = new Set(lineItems.map(item => item.id));
      // Update existing items
      for (const item of lineItems) {
        if (item.id && existingIds.has(item.id)) {
          await supabase.from('invoice_items').update({
            description: item.description,
            service_name: item.description,
            price: item.unit_price,
            quantity: item.quantity,
            discount: item.discount || 0
          }).eq('id', item.id);
        }
      }
      // Insert new items
      for (const item of lineItems) {
        if (!item.id || !existingIds.has(item.id)) {
          await supabase.from('invoice_items').insert({
            invoice_id: invoiceId,
            description: item.description,
            service_name: item.description,
            price: item.unit_price,
            quantity: item.quantity,
            discount: item.discount || 0
          });
        }
      }
      // Delete removed items
      for (const origId of existingIds) {
        if (!currentIds.has(origId)) {
          await supabase.from('invoice_items').delete().eq('id', origId);
        }
      }
      toast.success('Invoice updated successfully');
      navigate('/doctor/billing');
    } catch (error) {
      toast.error('Failed to update invoice: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
  };

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="w-full min-h-screen bg-gray-50 p-0 m-0">
      <h1 className="text-2xl font-bold mb-6 px-8 pt-8">Edit Invoice #{invoiceData?.invoice_number}</h1>
      {/* Patient Info */}
      {patient && (
        <div className="mb-6 bg-blue-50 rounded-none p-6 border-b border-blue-200 w-full">
          <div className="font-semibold text-blue-700 mb-2">Patient:</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div><span className="font-medium">Name:</span> {patient.full_name}</div>
            {patient.phone && <div><span className="font-medium">Phone:</span> {patient.phone}</div>}
            {patient.email && <div><span className="font-medium">Email:</span> {patient.email}</div>}
            {patient.address && <div className="md:col-span-2"><span className="font-medium">Address:</span> {patient.address}</div>}
          </div>
        </div>
      )}
      {/* Services & Products */}
      <div className="bg-white rounded-none shadow-none border-b border-gray-200 overflow-x-auto mb-6 w-full">
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-8 py-4 border-b border-gray-200 w-full">
          <div className="flex items-center">
            <FiActivity className="h-5 w-5 text-purple-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Services & Products</h3>
          </div>
        </div>
        <div className="p-8 w-full">
          {allServices.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Quick Add Services</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {allServices.map((svc) => (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => handleAddService(svc)}
                    className="px-4 py-3 border border-gray-300 text-sm rounded-lg hover:bg-blue-50 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 flex justify-between items-center transition-all duration-150"
                  >
                    <span className="truncate pr-2">{svc.name}</span>
                    <span className="text-gray-600 font-medium">{formatCurrency(svc.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-12 gap-4 mb-6 p-4 bg-gray-50 rounded-lg w-full">
            <div className="col-span-12 md:col-span-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Service/Product Description</label>
              <input
                type="text"
                placeholder="Enter description..."
                className="block w-full border border-gray-300 rounded-lg shadow-sm py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={tempItem.description}
                onChange={(e) => setTempItem({ ...tempItem, description: e.target.value })}
              />
            </div>
            <div className="col-span-12 md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">Unit Price (₱)</label>
              <input
                type="number"
                placeholder="0.00"
                className="block w-full border border-gray-300 rounded-lg shadow-sm py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-right"
                value={tempItem.unit_price}
                onChange={(e) => setTempItem({ ...tempItem, unit_price: e.target.value })}
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
                onChange={(e) => setTempItem({ ...tempItem, quantity: e.target.value })}
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
          {lineItems.length > 0 ? (
            <div className="overflow-x-auto w-full">
              <table className="min-w-full divide-y divide-gray-200 w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Unit Price</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {lineItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-6 py-4 text-sm text-gray-900"><div className="font-medium">{item.description}</div></td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">{formatCurrency(item.unit_price)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{item.quantity}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-semibold">{formatCurrency(item.total)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <button onClick={() => handleRemoveLineItem(item.id)} className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50 transition-colors duration-150" title="Remove item"><FiX className="h-4 w-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
      {/* Payment & Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full px-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <FiCreditCard className="h-5 w-5 text-green-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Payment Details</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
              <select className="block w-full pl-3 pr-10 py-2.5 border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm rounded-lg" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                <option value="">Select Payment Method</option>
                <option value="gcash">GCash</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Status</label>
              <select className="block w-full pl-3 pr-10 py-2.5 border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm rounded-lg" value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="partial">Partially Paid</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Discount Type</label>
              <select
                className="block w-full pl-3 pr-10 py-2.5 border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm rounded-lg"
                value={discountType}
                onChange={(e) => {
                  const val = e.target.value;
                  setDiscountType(val);
                  if (val === 'pwd' || val === 'senior' || val === 'veteran') setDiscount(20);
                  else if (val === 'student') setDiscount(10);
                  else setDiscount(0);
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
                  onChange={(e) => setDiscount(e.target.value)}
                  min="0"
                  max={discountType === 'percentage' ? 100 : undefined}
                  disabled={["pwd","senior","student","veteran"].includes(discountType)}
                />
                <span className="inline-flex items-center px-3 border border-l-0 border-gray-300 rounded-r-lg text-sm text-gray-500">
                  {discountType === 'amount' || discountType === 'amount' ? '₱' : '%'}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
            <textarea rows="4" className="block w-full border border-gray-300 rounded-lg shadow-sm py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Add any additional notes or appointment details..." value={notes} onChange={e => setNotes(e.target.value)}></textarea>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium text-gray-900">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Discount:</span>
                <span className="font-medium text-gray-900">-{formatCurrency(discountType === 'percentage' ? (subtotal * discount) / 100 : discount)}{discountType === 'percentage' && discount > 0 && ` (${discount}%)`}</span>
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
                  <span className="text-blue-700">{formatCurrency(subtotal - (discountType === 'percentage' ? (subtotal * discount) / 100 : discount) + ((subtotal - (discountType === 'percentage' ? (subtotal * discount) / 100 : discount)) * tax / 100))}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end pt-6 border-t border-gray-200 px-8 pb-8">
        <button type="button" className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleSave} disabled={isLoading}>
          <FiCheck className="mr-2 h-5 w-5" /> Save Changes
        </button>
        <button type="button" className="ml-4 inline-flex items-center px-8 py-3 border border-gray-300 text-base font-medium rounded-lg shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-150" onClick={() => navigate('/doctor/billing')}>
          <FiX className="mr-2 h-5 w-5" /> Cancel
        </button>
      </div>
    </div>
  );
};

export default EditInvoice; 