// src/pages/admin/Reports.jsx
import React, { useState, useEffect } from 'react';
import { FiBarChart2, FiDownload, FiCalendar, FiPieChart, FiTrendingUp, FiUsers } from 'react-icons/fi';
import { format, subDays, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell 
} from 'recharts';
import { useClinic } from '../../contexts/ClinicContext';

const Reports = () => {
  const { clinicInfo } = useClinic();
  const [dateRange, setDateRange] = useState('month');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [reportData, setReportData] = useState({
    totalAppointments: 0,
    monthlyRevenue: 0,
    popularService: ''
  });

  const colors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28BFF'];
  
  // Mock appointment data based on provided SQL
  const appointmentData = [
    { id: '0e254a9b-88ee-433e-9f9e-b1bd5e7fb54c', date: '2025-05-19', status: 'completed', service: 'Teeth Whitening' },
    { id: '200da22f-281a-4d6c-a6c8-5b60ec76cccf', date: '2025-05-08', status: 'completed', service: 'Dental Cleaning' },
    { id: '2ac88680-6ecf-474e-b502-56d733fd23fa', date: '2025-05-12', status: 'completed', service: 'Dental Cleaning' },
    { id: '31dd4870-d80d-421f-a7fa-03da2e75efc7', date: '2025-05-14', status: 'confirmed', service: 'Teeth Whitening' },
    { id: '43311632-8729-4184-a9ca-2ee89a383f8d', date: '2025-05-08', status: 'completed', service: 'Dental Cleaning' },
    { id: '4af9158d-2ffd-44fd-b3e3-699f54506c3c', date: '2025-05-07', status: 'completed', service: 'Dental Cleaning' },
    { id: '57c1ab5c-8fb8-4f80-a477-03247f67dce8', date: '2025-05-11', status: 'completed', service: 'Dental Cleaning' },
    { id: '6c8874a4-2acc-46b8-b800-8f101ef96ff2', date: '2025-05-14', status: 'confirmed', service: 'Dental Exam' },
    { id: '8af69ae7-4a6b-44e7-be67-d46e4611410b', date: '2025-05-15', status: 'completed', service: 'Dental Cleaning' },
    { id: '9b87d78e-0883-46ea-93c9-b8b78302aab7', date: '2025-05-04', status: 'confirmed', service: 'Dental Cleaning' },
    { id: 'afc5ae3b-a039-4f72-8566-97e330635752', date: '2025-05-15', status: 'confirmed', service: 'Dental Cleaning' },
    { id: 'e0766bce-a0c2-4da4-9c8d-edc9000723e7', date: '2025-05-21', status: 'cancelled', service: 'Dental Exam' }
  ];
  
  // Mock payment data based on provided SQL
  const paymentData = [
    { id: '0c3871d0-2870-4e22-ab05-e4ccd8a1521e', date: '2025-05-13', amount: 0.10 },
    { id: '2cd03a49-72d6-40dc-af5e-83214cb0fbbc', date: '2025-05-12', amount: 1500.00 },
    { id: '345bb3d5-a28e-4310-89a5-7e42eaafd018', date: '2025-05-13', amount: 0.10 },
    { id: '70fd36a5-a623-4234-b6ee-170415c65a66', date: '2025-05-13', amount: 0.10 },
    { id: '9ed6081a-84bd-4f80-afab-69fa848c0406', date: '2025-05-13', amount: 0.10 },
    { id: 'a30d9816-e78c-4b8f-8ba3-eeeb5ef3a22d', date: '2025-05-13', amount: 0.10 },
    { id: 'c2aacb81-896e-42df-a09b-5a4c25fed258', date: '2025-05-12', amount: 0.10 },
    { id: 'd08e9b60-0e62-403c-9c80-cc14ffb6497e', date: '2025-05-13', amount: 0.10 },
    { id: 'd8c32b9c-7d5f-46cd-8465-653cdd7ac78c', date: '2025-05-12', amount: 0.10 },
    { id: 'e23bbca5-96a2-44bc-8219-b687d8327458', date: '2025-05-12', amount: 0.10 }
  ];

  const serviceData = [
    { id: '948b470b-cf81-4d87-af65-563b0fd85253', name: 'Dental Cleaning', price: 800.00 },
    { id: '65d7d59d-dd4b-4952-9e22-50ca5529bf48', name: 'Teeth Whitening', price: 400.00 },
    { id: '46942adc-5e5c-4b71-8090-d72b1212d2fa', name: 'Dental Exam', price: 500.00 }
  ];

  // Function to handle date range change
  const handleDateRangeChange = (range) => {
    setDateRange(range);
    let start, end;
    
    const today = new Date();
    
    switch (range) {
      case 'week':
        start = subDays(today, 7);
        end = today;
        break;
      case 'month':
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case 'quarter':
        start = subDays(today, 90);
        end = today;
        break;
      case 'year':
        start = subDays(today, 365);
        end = today;
        break;
      default:
        start = startOfMonth(today);
        end = endOfMonth(today);
    }
    
    setStartDate(format(start, 'yyyy-MM-dd'));
    setEndDate(format(end, 'yyyy-MM-dd'));
    setIsDatePickerOpen(false);
  };

  // Function to handle custom date range
  const handleCustomDateChange = (e) => {
    const { name, value } = e.target;
    if (name === 'startDate') {
      setStartDate(value);
    } else {
      setEndDate(value);
    }
  };

  // Function to apply custom date range
  const applyCustomDateRange = () => {
    setDateRange('custom');
    setIsDatePickerOpen(false);
    // Here you would normally fetch data for the custom date range
  };

  // Function to handle report download
  const handleDownload = () => {
    const fileName = `${clinicInfo.clinicName}_Report_${startDate}_to_${endDate}.csv`;
    
    // Create CSV content
    const headers = 'Date,Appointments,Revenue\n';
    const revenueData = getRevenueData();
    
    let csvContent = headers;
    revenueData.forEach(item => {
      csvContent += `${item.date},${item.appointments},${item.revenue}\n`;
    });
    
    // Create a blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Function to filter data by date range
  const filterByDateRange = (data) => {
    return data.filter(item => {
      const itemDate = item.date;
      return itemDate >= startDate && itemDate <= endDate;
    });
  };

  // Calculate report data
  useEffect(() => {
    const filteredAppointments = filterByDateRange(appointmentData);
    const filteredPayments = filterByDateRange(paymentData);
    
    // Count total appointments
    const totalAppts = filteredAppointments.length;
    
    // Sum monthly revenue
    const revenue = filteredPayments.reduce((sum, payment) => sum + payment.amount, 0);
    
    // Find most popular service
    const serviceCounts = {};
    filteredAppointments.forEach(appt => {
      if (serviceCounts[appt.service]) {
        serviceCounts[appt.service]++;
      } else {
        serviceCounts[appt.service] = 1;
      }
    });
    
    let popularService = '';
    let maxCount = 0;
    
    Object.keys(serviceCounts).forEach(service => {
      if (serviceCounts[service] > maxCount) {
        maxCount = serviceCounts[service];
        popularService = service;
      }
    });
    
    setReportData({
      totalAppointments: totalAppts,
      monthlyRevenue: revenue,
      popularService: popularService,
      popularServiceCount: maxCount
    });
  }, [startDate, endDate]);

  // Prepare data for charts
  const getRevenueData = () => {
    // Group payments by date
    const revenueByDate = {};
    
    // First, initialize with all dates in range having 0 revenue
    let currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    while (currentDate <= endDateObj) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      revenueByDate[dateStr] = { 
        date: dateStr, 
        revenue: 0,
        appointments: 0 
      };
      currentDate.setHours(0, 0, 0, 0); // Set to start of the date
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Add payment data
    filterByDateRange(paymentData).forEach(payment => {
      if (revenueByDate[payment.date]) {
        revenueByDate[payment.date].revenue += payment.amount;
      }
    });
    
    // Add appointment counts
    filterByDateRange(appointmentData).forEach(appt => {
      if (revenueByDate[appt.date]) {
        revenueByDate[appt.date].appointments += 1;
      }
    });
    
    return Object.values(revenueByDate);
  };

  const getAppointmentStats = () => {
    const filteredAppointments = filterByDateRange(appointmentData);
    const statusCounts = {
      completed: 0,
      confirmed: 0,
      cancelled: 0
    };
    
    filteredAppointments.forEach(appt => {
      if (statusCounts[appt.status] !== undefined) {
        statusCounts[appt.status]++;
      }
    });
    
    return [
      { name: 'Completed', value: statusCounts.completed },
      { name: 'Confirmed', value: statusCounts.confirmed },
      { name: 'Cancelled', value: statusCounts.cancelled }
    ];
  };

  const getServicePopularity = () => {
    const filteredAppointments = filterByDateRange(appointmentData);
    const serviceCounts = {};
    
    filteredAppointments.forEach(appt => {
      if (serviceCounts[appt.service]) {
        serviceCounts[appt.service]++;
      } else {
        serviceCounts[appt.service] = 1;
      }
    });
    
    return Object.keys(serviceCounts).map(service => ({
      name: service,
      value: serviceCounts[service]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 space-y-4 md:space-y-0">
          <h1 className="text-2xl font-bold text-gray-800">Reports & Analytics</h1>
          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2">
            <div className="relative">
              <button 
                className="flex items-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              >
                <FiCalendar className="mr-2" />
                <span>
                  {dateRange === 'custom' 
                    ? `${startDate} to ${endDate}` 
                    : `${dateRange.charAt(0).toUpperCase() + dateRange.slice(1)} View`}
                </span>
              </button>
              
              {isDatePickerOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  <div className="p-3 border-b border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700">Select Date Range</h4>
                  </div>
                  <div className="p-3 space-y-2">
                    <button 
                      onClick={() => handleDateRangeChange('week')}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md ${dateRange === 'week' ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-100'}`}
                    >
                      This Week
                    </button>
                    <button 
                      onClick={() => handleDateRangeChange('month')}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md ${dateRange === 'month' ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-100'}`}
                    >
                      This Month
                    </button>
                    <button 
                      onClick={() => handleDateRangeChange('quarter')}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md ${dateRange === 'quarter' ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-100'}`}
                    >
                      This Quarter
                    </button>
                    <button 
                      onClick={() => handleDateRangeChange('year')}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md ${dateRange === 'year' ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-100'}`}
                    >
                      This Year
                    </button>
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <h5 className="text-xs font-medium text-gray-500 mb-2">Custom Range</h5>
                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                          <input 
                            type="date" 
                            name="startDate"
                            value={startDate}
                            onChange={handleCustomDateChange}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">End Date</label>
                          <input 
                            type="date" 
                            name="endDate"
                            value={endDate}
                            onChange={handleCustomDateChange}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                          />
                        </div>
                        <button
                          onClick={applyCustomDateRange}
                          className="w-full py-2 px-3 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button 
              onClick={handleDownload}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 flex items-center justify-center"
            >
              <FiDownload className="mr-2 h-5 w-5 text-gray-500" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Report Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                <FiBarChart2 className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Total Appointments</h3>
                <p className="text-2xl font-semibold text-gray-900">{reportData.totalAppointments}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 text-green-600">
                <FiTrendingUp className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Revenue</h3>
                <p className="text-2xl font-semibold text-gray-900">₱{reportData.monthlyRevenue.toFixed(2)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                <FiPieChart className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Popular Service</h3>
                <p className="text-2xl font-semibold text-gray-900">
                  {reportData.popularService ? 
                    `${reportData.popularService} (${reportData.popularServiceCount})` : 
                    'No data'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Report Sections */}
        <div className="space-y-6">
          <div className="bg-white overflow-hidden border border-gray-200 rounded-lg">
            <div className="px-4 py-5 sm:px-6 bg-gray-50">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Revenue Analysis</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">Revenue and appointment trends.</p>
            </div>
            <div className="border-t border-gray-200">
              <div className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getRevenueData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#8884d8" activeDot={{ r: 8 }} name="Revenue (₱)" />
                    <Line yAxisId="right" type="monotone" dataKey="appointments" stroke="#82ca9d" name="Appointments" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          <div className="bg-white overflow-hidden border border-gray-200 rounded-lg">
            <div className="px-4 py-5 sm:px-6 bg-gray-50">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Appointment Statistics</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">Appointment status breakdown.</p>
            </div>
            <div className="border-t border-gray-200">
              <div className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getAppointmentStats()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#8884d8" name="Appointments">
                      {getAppointmentStats().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          <div className="bg-white overflow-hidden border border-gray-200 rounded-lg">
            <div className="px-4 py-5 sm:px-6 bg-gray-50">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Service Popularity</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">Most requested dental services.</p>
            </div>
            <div className="border-t border-gray-200">
              <div className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={getServicePopularity()}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {getServicePopularity().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;