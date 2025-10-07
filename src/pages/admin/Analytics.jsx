import { useEffect, useState, useRef } from 'react';
import supabase from '../../config/supabaseClient';
import { FiUsers, FiCalendar, FiBarChart2, FiPrinter, FiCreditCard, FiRefreshCw } from 'react-icons/fi';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

const AdminAnalytics = () => {
  const [branches, setBranches] = useState([]);
  const [metricsByBranch, setMetricsByBranch] = useState({});
  const [statusByBranch, setStatusByBranch] = useState({});
  const [revenueByMonthByBranch, setRevenueByMonthByBranch] = useState({});
  const [topServices, setTopServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState('');
  const revenueChartRefs = useRef({});
  const statusChartRefs = useRef({});
  const pieRef = useRef(null);
  const printRef = useRef(null);

  useEffect(() => {
    fetchBranches();
    fetchAnalytics();
  }, []);

  // Auto-refresh analytics periodically
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchAnalytics();
    }, 60000); // refresh every 60s
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    console.log('📊 Admin Revenue Chart useEffect triggered:', { 
      revenueByMonthByBranchKeys: Object.keys(revenueByMonthByBranch || {}),
      loading 
    });
    
    const renderRevenueCharts = () => {
      Object.keys(revenueByMonthByBranch || {}).forEach((b) => {
        const canvas = revenueChartRefs.current[b];
        const series = revenueByMonthByBranch[b] || [];
        
        if (!canvas || series.length === 0) {
          console.log(`📊 Revenue chart for ${b}: Canvas or data not available`);
          return;
        }
        
        console.log(`📊 Rendering revenue chart for branch ${b}:`, series);
        
        const key = `adminRevenueChart_${b}`;
        if (window[key]) {
          console.log(`📊 Destroying existing chart for ${b}`);
          window[key].destroy();
        }
        
        try {
          const ctx = canvas.getContext('2d');
          window[key] = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: series.map((a) => a.month),
              datasets: [{
                label: 'Revenue (₱)',
                data: series.map((a) => a.amount),
                backgroundColor: '#059669',
              }],
            },
            options: {
              responsive: true,
              maintainAspectRatio: true,
              aspectRatio: 2.5,
              plugins: { 
                legend: { display: false } 
              },
              scales: { 
                y: { 
                  beginAtZero: true,
                  ticks: {
                    font: { size: 10 }
                  }
                },
                x: {
                  ticks: {
                    font: { size: 10 }
                  }
                }
              }
            },
          });
          console.log(`📊 Revenue chart for ${b} created successfully`);
        } catch (error) {
          console.error(`📊 Error creating revenue chart for ${b}:`, error);
        }
      });
    };

    // Add delay to ensure DOM is ready
    if (Object.keys(revenueByMonthByBranch || {}).length > 0) {
      const timeoutId = setTimeout(() => {
        console.log('📊 Attempting to render revenue charts after timeout');
        renderRevenueCharts();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      renderRevenueCharts();
    }
  }, [revenueByMonthByBranch, loading]);

  useEffect(() => {
    console.log('📊 Admin Status Chart useEffect triggered:', { 
      statusByBranchKeys: Object.keys(statusByBranch || {}),
      loading 
    });
    
    const renderStatusCharts = () => {
      Object.keys(statusByBranch || {}).forEach((b) => {
        const canvas = statusChartRefs.current[b];
        const series = statusByBranch[b] || [];
        
        if (!canvas || series.length === 0) {
          console.log(`📊 Status chart for ${b}: Canvas or data not available`);
          return;
        }
        
        console.log(`📊 Rendering status chart for branch ${b}:`, series);
        
        const key = `adminStatusChart_${b}`;
        if (window[key]) {
          console.log(`📊 Destroying existing status chart for ${b}`);
          window[key].destroy();
        }
        
        try {
          const ctx = canvas.getContext('2d');
          window[key] = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: series.map((a) => a.status),
              datasets: [{
                label: 'Appointments',
                data: series.map((a) => a.count),
                backgroundColor: '#2563eb',
              }],
            },
            options: {
              responsive: true,
              maintainAspectRatio: true,
              aspectRatio: 2.5,
              plugins: { 
                legend: { display: false } 
              },
              scales: { 
                y: { 
                  beginAtZero: true,
                  ticks: {
                    font: { size: 10 }
                  }
                },
                x: {
                  ticks: {
                    font: { size: 10 }
                  }
                }
              }
            },
          });
          console.log(`📊 Status chart for ${b} created successfully`);
        } catch (error) {
          console.error(`📊 Error creating status chart for ${b}:`, error);
        }
      });
    };

    // Add delay to ensure DOM is ready
    if (Object.keys(statusByBranch || {}).length > 0) {
      const timeoutId = setTimeout(() => {
        console.log('📊 Attempting to render status charts after timeout');
        renderStatusCharts();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      renderStatusCharts();
    }
  }, [statusByBranch, loading]);

  useEffect(() => {
    console.log('📊 Admin Pie Chart useEffect triggered:', { 
      topServicesLength: topServices.length,
      pieRefCurrent: !!pieRef.current,
      loading 
    });
    
    const renderPieChart = () => {
      if (topServices.length > 0 && pieRef.current) {
        console.log('📊 Rendering pie chart with data:', topServices);
        
        try {
          const ctx = pieRef.current.getContext('2d');
          if (window.adminPieChart) {
            console.log('📊 Destroying existing pie chart');
            window.adminPieChart.destroy();
          }
          
          window.adminPieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
              labels: topServices.map((s) => s.name),
              datasets: [{
                data: topServices.map((s) => s.count),
                backgroundColor: ['#6366f1', '#22c55e', '#f59e42', '#f43f5e', '#a21caf', '#0ea5e9'],
                borderWidth: 0
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: true,
              aspectRatio: 1.5,
              cutout: '70%',
              plugins: { 
                legend: { 
                  display: true, 
                  position: 'bottom',
                  labels: {
                    font: { size: 10 }
                  }
                } 
              }
            }
          });
          console.log('📊 Pie chart created successfully');
        } catch (error) {
          console.error('📊 Error creating pie chart:', error);
        }
      } else {
        console.log('📊 Pie chart conditions not met:', { 
          hasData: topServices.length > 0, 
          hasCanvas: !!pieRef.current 
        });
      }
    };

    // Add delay to ensure DOM is ready
    if (topServices.length > 0) {
      const timeoutId = setTimeout(() => {
        console.log('📊 Attempting to render pie chart after timeout');
        renderPieChart();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      renderPieChart();
    }
  }, [topServices, loading]);

  // Removed gauge chart; we'll show efficiency per-branch as a number

  const fetchBranches = async () => {
    try {
      console.log('🔍 Fetching branches...');
      
      const { data, error } = await supabase
        .from('appointments')
        .select('branch');
      
      if (error) {
        console.error('❌ Error fetching branches:', error);
        setDebugInfo(prev => prev + `\nBranch Error: ${error.message}`);
        return;
      }
      
      console.log('📊 Raw branch data:', data);
      
      if (data && data.length > 0) {
        const uniqueBranches = [...new Set(data.map(item => item.branch).filter(Boolean))];
        setBranches(uniqueBranches);
        console.log('✅ Unique branches found:', uniqueBranches);
        setDebugInfo(prev => prev + `\nBranches: ${uniqueBranches.join(', ')}`);
      } else {
        console.log('⚠️ No branch data found');
        setDebugInfo(prev => prev + '\nNo branches found in database');
      }
    } catch (error) {
      console.error('💥 Exception in fetchBranches:', error);
      setDebugInfo(prev => prev + `\nBranch Exception: ${error.message}`);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    console.log('🚀 Starting admin analytics fetch...');
    
    // Clear existing data to force re-render
    setRevenueByMonthByBranch({});
    setStatusByBranch({});
    setTopServices([]);
    
    let debugLog = `\n=== Analytics Fetch Started at ${new Date().toLocaleTimeString()} ===`;
    
    try {
      console.log('🚀 Starting analytics fetch for all branches');

      // 1. APPOINTMENTS DATA
      debugLog += '\n\n1. FETCHING APPOINTMENTS...';
      const { data: appointmentData, error: appointmentError } = await supabase
        .from('appointments')
        .select('id, patient_id, status, appointment_date, appointment_time, branch');
      
      if (appointmentError) {
        console.error('❌ Appointment fetch error:', appointmentError);
        debugLog += `\nAppointment Error: ${appointmentError.message}`;
      } else {
        const branchesFound = [...new Set((appointmentData || []).map(a => a.branch).filter(Boolean))];
        setBranches(branchesFound);
        const metricsMap = {};
        const statusMap = {};
        const apptsByPatientDate = new Map();
        (appointmentData || []).forEach(a => {
          const b = a.branch || 'Unknown';
          if (!metricsMap[b]) metricsMap[b] = { patientsSet: new Set(), appointments: 0, completed: 0 };
          metricsMap[b].appointments += 1;
          if (a.status === 'completed') metricsMap[b].completed += 1;
          if (a.patient_id) metricsMap[b].patientsSet.add(a.patient_id);
          const dateKey = `${a.patient_id}-${a.appointment_date}`;
          if (!apptsByPatientDate.has(dateKey)) apptsByPatientDate.set(dateKey, a);
          if (!statusMap[b]) statusMap[b] = {};
          const st = a.status || 'unknown';
          statusMap[b][st] = (statusMap[b][st] || 0) + 1;
        });
        const finalizedMetrics = {};
        Object.keys(metricsMap).forEach(b => {
          const m = metricsMap[b];
          const efficiency = m.appointments > 0 ? Math.round((m.completed / m.appointments) * 100) : 0;
          finalizedMetrics[b] = { patients: m.patientsSet.size, appointments: m.appointments, revenue: 0, efficiency };
        });
        setMetricsByBranch(finalizedMetrics);
        const finalizedStatus = {};
        Object.keys(statusMap).forEach(b => {
          finalizedStatus[b] = Object.entries(statusMap[b]).map(([status, count]) => ({
            status: status.charAt(0).toUpperCase() + status.slice(1),
            count
          }));
        });
        setStatusByBranch(finalizedStatus);
        window.__apptsByPatientDate = apptsByPatientDate;
      }

      // 2. REVENUE DATA (map to branch)
      debugLog += '\n\n2. FETCHING PAYMENTS...';
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .select('id, invoice_id, amount, approval_status, payment_date, created_at');

      if (paymentError) {
        console.error('❌ Payment fetch error:', paymentError);
        debugLog += `\nPayment Error: ${paymentError.message}`;
      } else {
        if (paymentData && paymentData.length > 0) {
          const approved = paymentData.filter(p => p.approval_status === 'approved');
          const invoiceIds = [...new Set(approved.map(p => p.invoice_id).filter(Boolean))];
          let invoiceToPatient = {};
          if (invoiceIds.length > 0) {
            const { data: invData } = await supabase
              .from('invoices')
              .select('id, patient_id')
              .in('id', invoiceIds);
            invData?.forEach(i => { invoiceToPatient[i.id] = i.patient_id; });
          }
          const apptMap = window.__apptsByPatientDate || new Map();
          const branchRevenue = {};
          const branchRevByMonth = {};
          approved.forEach(p => {
            const amount = parseFloat(p.amount) || 0;
            const pid = invoiceToPatient[p.invoice_id];
            const when = new Date(p.payment_date || p.created_at);
            const dateStr = when.toISOString().split('T')[0];
            let b = 'Unknown';
            if (pid) {
              const appt = apptMap.get(`${pid}-${dateStr}`);
              if (appt && appt.branch) b = appt.branch;
            }
            branchRevenue[b] = (branchRevenue[b] || 0) + amount;
            const monthYear = when.toLocaleString('default', { month: 'short', year: 'numeric' });
            if (!branchRevByMonth[b]) branchRevByMonth[b] = {};
            branchRevByMonth[b][monthYear] = (branchRevByMonth[b][monthYear] || 0) + amount;
          });

          setMetricsByBranch(prev => {
            const next = { ...prev };
            Object.keys(branchRevenue).forEach(b => {
              if (!next[b]) next[b] = { patients: 0, appointments: 0, revenue: 0, efficiency: 0 };
              next[b].revenue = branchRevenue[b];
            });
            return next;
          });

          const seriesByBranch = {};
          Object.keys(branchRevByMonth).forEach(b => {
            const series = Object.entries(branchRevByMonth[b])
              .map(([month, amount]) => ({ month, amount }))
              .sort((a, b2) => new Date(a.month + ' 1') - new Date(b2.month + ' 1'))
              .slice(-6);
            seriesByBranch[b] = series;
          });
          setRevenueByMonthByBranch(seriesByBranch);
        } else {
          debugLog += '\nNo payment data found';
        }
      }

      // 3. TOP SERVICES via appointment_services -> services with category
      debugLog += '\n\n3. FETCHING TOP SERVICES...';
      const { data: appointmentServices, error: servicesError } = await supabase
        .from('appointment_services')
        .select(`
          appointment_id,
          service_id,
          services (id, name, category),
          appointments:appointment_id (branch)
        `);
      if (servicesError) {
        console.error('❌ appointment_services fetch error:', servicesError);
        debugLog += `\nServices Error: ${servicesError.message}`;
      } else if (appointmentServices && appointmentServices.length > 0) {
        const counts = {};
        appointmentServices.forEach(row => {
          const svc = row.services;
          if (!svc) return;
          const label = `${svc.name}${svc.category ? ` (${svc.category})` : ''}`;
          counts[label] = (counts[label] || 0) + 1;
        });
        const top = Object.entries(counts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        setTopServices(top);
      }

    } catch (error) {
      console.error('💥 Exception in fetchAnalytics:', error);
      debugLog += `\nEXCEPTION: ${error.message}`;
    } finally {
      setLoading(false);
      debugLog += `\n\n=== Fetch completed at ${new Date().toLocaleTimeString()} ===`;
      setDebugInfo(debugLog);
      console.log('🏁 Analytics fetch completed');
    }
  };

  const handlePrint = () => {
    if (printRef.current) {
      const printContents = printRef.current.innerHTML;
      const win = window.open('', '', 'width=1200,height=800');
      win.document.write(`
        <html>
          <head>
            <title>Admin Analytics Report - ${new Date().toLocaleDateString()}</title>
            <style>
              @media print {
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { 
                  font-family: 'Arial', sans-serif; 
                  padding: 20px;
                  font-size: 12px;
                  line-height: 1.4;
                  color: #333;
                }
                .no-print { display: none !important; }
                
                .print-header {
                  text-align: center;
                  margin-bottom: 40px;
                  border-bottom: 3px solid #059669;
                  padding-bottom: 20px;
                }
                .print-header h1 {
                  color: #059669;
                  font-size: 28px;
                  margin-bottom: 10px;
                  font-weight: bold;
                }
                
                .metrics-grid {
                  display: grid;
                  grid-template-columns: repeat(4, 1fr);
                  gap: 20px;
                  margin-bottom: 40px;
                }
                .metric-card {
                  border: 2px solid #e5e7eb;
                  border-radius: 10px;
                  padding: 20px;
                  text-align: center;
                  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                }
                
                .metric-value {
                  font-size: 24px;
                  font-weight: bold;
                  margin: 10px 0;
                  color: #1f2937;
                }
                .metric-label {
                  font-size: 12px;
                  color: #6b7280;
                  text-transform: uppercase;
                  font-weight: 600;
                }
                
                canvas { 
                  max-width: 100% !important; 
                  height: 200px !important; 
                }
                
                @page { 
                  margin: 0.75in; 
                  size: A4;
                }
              }
            </style>
          </head>
          <body>
            <div class="print-header">
              <h1>📊 Admin Analytics Report</h1>
              <div>Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</div>
            </div>
            ${printContents}
          </body>
        </html>
      `);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-4 bg-gradient-to-br from-blue-50 via-white to-blue-100">
        <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-8 border border-blue-100">
          <div className="flex flex-col items-center justify-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600 mb-4"></div>
            <p className="text-gray-600">Loading analytics data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-gradient-to-br from-blue-50 via-white to-blue-100">
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-8 border border-blue-100">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-green-700">Admin Analytics</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              <FiRefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div ref={printRef}>
          {branches.length === 0 ? (
            <div className="text-gray-500">No branch data available</div>
          ) : (
            <div className="space-y-12">
              {branches.map((b) => {
                const m = metricsByBranch[b] || { patients: 0, appointments: 0, revenue: 0, efficiency: 0 };
                const statusRows = statusByBranch[b] || [];
                const revSeries = revenueByMonthByBranch[b] || [];
                return (
                  <div key={b}>
                    <h2 className="text-2xl font-semibold text-gray-800 mb-4">Branch: {b}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                      <div className="bg-green-50 rounded-lg p-6 flex flex-col items-center justify-center">
                        <FiUsers className="h-8 w-8 text-green-600 mb-2" />
                        <div className="text-gray-500 text-sm">Total Patients</div>
                        <div className="text-2xl font-bold text-green-700">{m.patients}</div>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-6 flex flex-col items-center justify-center">
                        <FiCalendar className="h-8 w-8 text-blue-600 mb-2" />
                        <div className="text-gray-500 text-sm">Total Appointments</div>
                        <div className="text-2xl font-bold text-blue-700">{m.appointments}</div>
                      </div>
                      <div className="bg-yellow-50 rounded-lg p-6 flex flex-col items-center justify-center">
                        <FiCreditCard className="h-8 w-8 text-yellow-600 mb-2" />
                        <div className="text-gray-500 text-sm">Total Revenue</div>
                        <div className="text-2xl font-bold text-yellow-700">₱{(m.revenue || 0).toLocaleString()}</div>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-6 flex flex-col items-center justify-center">
                        <FiBarChart2 className="h-8 w-8 text-purple-600 mb-2" />
                        <div className="text-gray-500 text-sm">Completion Rate</div>
                        <div className="text-2xl font-bold text-purple-700">{m.efficiency}%</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-lg font-bold text-gray-700 mb-4">Revenue by Month</h2>
                        {revSeries.length > 0 ? (
                          <div className="h-48">
                            <canvas ref={(el) => (revenueChartRefs.current[b] = el)}></canvas>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-32 text-gray-500">No revenue data available</div>
                        )}
                      </div>
                      <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-lg font-bold text-gray-700 mb-4">Appointments by Status</h2>
                        {statusRows.length > 0 ? (
                          <div className="h-48">
                            <canvas ref={(el) => (statusChartRefs.current[b] = el)}></canvas>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-32 text-gray-500">No appointment data available</div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-lg font-bold text-gray-700 mb-3">Appointment Status</h3>
                        <div className="bg-white rounded-lg shadow overflow-hidden">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Count</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">%</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {statusRows.map((item) => (
                                <tr key={item.status}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.status}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.count}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{m.appointments > 0 ? Math.round((item.count / m.appointments) * 100) : 0}%</td>
                                </tr>
                              ))}
                              {statusRows.length === 0 && (
                                <tr>
                                  <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">No data available</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Top Services (All Branches)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-lg font-bold text-gray-700 mb-4">Top Services</h2>
                    {topServices.length > 0 ? (
                      <div className="h-48">
                        <canvas ref={pieRef}></canvas>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-48 text-gray-500">No service data available</div>
                    )}
                  </div>
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Count</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {topServices.map((service) => (
                          <tr key={service.name}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{service.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{service.count}</td>
                          </tr>
                        ))}
                        {topServices.length === 0 && (
                          <tr>
                            <td colSpan={2} className="px-6 py-4 text-center text-sm text-gray-500">No data available</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;