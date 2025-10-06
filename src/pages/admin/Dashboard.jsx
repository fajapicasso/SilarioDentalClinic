// src/pages/admin/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { FiUsers, FiCalendar, FiCreditCard, FiClipboard, FiBarChart2 } from 'react-icons/fi';
import supabase from '../../config/supabaseClient';
import { toast } from 'react-toastify';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const AdminDashboard = () => {
  const { logPageView } = useUniversalAudit();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPatients: 0,
    todayAppointments: 0,
    monthlyRevenue: 0,
    pendingAppointments: 0
  });
  const [recentAppointments, setRecentAppointments] = useState([]);

  useEffect(() => {
    fetchDashboardData();
    // Log page view
    logPageView('Admin Dashboard', 'admin', 'dashboard');
  }, [logPageView]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchTotalPatients(),
        fetchTodayAppointments(),
        fetchMonthlyRevenue(),
        fetchPendingAppointments(),
        fetchRecentAppointments()
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTotalPatients = async () => {
    try {
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'patient');
      
      if (error) throw error;
      setStats(prev => ({ ...prev, totalPatients: count || 0 }));
    } catch (error) {
      console.error('Error fetching patient count:', error);
    }
  };

  const fetchTodayAppointments = async () => {
    try {
      // Get today's date in YYYY-MM-DD format in local timezone
      const today = new Date();
      const todayFormatted = today.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('appointment_date', todayFormatted);
      
      if (error) throw error;
      setStats(prev => ({ ...prev, todayAppointments: data?.length || 0 }));
    } catch (error) {
      console.error('Error fetching today appointments:', error);
    }
  };

  const fetchMonthlyRevenue = async () => {
    try {
      // Get first day of current month in YYYY-MM-DD format
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const firstDayFormatted = firstDay.toISOString().split('T')[0];
      
      // Get first day of next month
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const nextMonthFormatted = nextMonth.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('invoices')
        .select('total_amount')
        .gte('created_at', firstDayFormatted)
        .lt('created_at', nextMonthFormatted)
        .in('status', ['paid', 'partial']);
      
      if (error) throw error;
      
      const totalRevenue = data?.reduce((sum, invoice) => sum + (parseFloat(invoice.total_amount) || 0), 0) || 0;
      setStats(prev => ({ ...prev, monthlyRevenue: totalRevenue }));
    } catch (error) {
      console.error('Error fetching monthly revenue:', error);
    }
  };

  const fetchPendingAppointments = async () => {
    try {
      const { count, error } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      if (error) throw error;
      setStats(prev => ({ ...prev, pendingAppointments: count || 0 }));
    } catch (error) {
      console.error('Error fetching pending appointments:', error);
    }
  };

  const fetchRecentAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          appointment_time,
          status,
          branch,
          profiles:patient_id(id, full_name, phone)
        `)
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      setRecentAppointments(data || []);
    } catch (error) {
      console.error('Error fetching recent appointments:', error);
    }
  };

  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString(undefined, options);
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return 'N/A';
    
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours, 10));
    date.setMinutes(parseInt(minutes, 10));
    
    return date.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="space-y-6 p-6">
      {/* Welcome Section */}
      <div className="bg-blue-50 rounded-lg shadow-md p-6 border border-blue-200">
        <h1 className="text-2xl font-bold text-gray-800">
          Welcome, Admin!
        </h1>
        <p className="text-gray-600 mt-2">
          Here's an overview of Silario Dental Clinic.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg shadow-md p-6 border border-blue-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-primary-100 text-primary-800">
              <FiUsers className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Total Patients</h3>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalPatients}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-blue-50 rounded-lg shadow-md p-6 border border-blue-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-800">
              <FiCalendar className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Today's Appointments</h3>
              <p className="text-2xl font-semibold text-gray-900">{stats.todayAppointments}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-blue-50 rounded-lg shadow-md p-6 border border-blue-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-800">
              <FiCreditCard className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Monthly Revenue</h3>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(stats.monthlyRevenue)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-blue-50 rounded-lg shadow-md p-6 border border-blue-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-800">
              <FiClipboard className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Pending Appointments</h3>
              <p className="text-2xl font-semibold text-gray-900">{stats.pendingAppointments}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Appointment Overview */}
      <div className="bg-blue-50 rounded-lg shadow-md overflow-hidden border border-blue-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Recent Appointments</h2>
        </div>
        <div className="p-6">
          {recentAppointments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Branch
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentAppointments.map((appointment) => (
                    <tr key={appointment.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {appointment.profiles?.full_name || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {appointment.profiles?.phone || 'No phone'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(appointment.appointment_date)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatTime(appointment.appointment_time)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {appointment.branch}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(appointment.status)}`}>
                          {appointment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No recent appointments found.</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default AdminDashboard;