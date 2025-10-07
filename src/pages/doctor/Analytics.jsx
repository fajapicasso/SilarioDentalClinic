import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import supabase from '../../config/supabaseClient';
import { FiUsers, FiCalendar, FiBarChart2, FiPrinter, FiRefreshCw } from 'react-icons/fi';
import { Chart, registerables } from 'chart.js';
import { useUniversalAudit } from '../../hooks/useUniversalAudit';
Chart.register(...registerables);

const DoctorAnalytics = () => {
  const { user } = useAuth();
  const { logPageView } = useUniversalAudit();
  const [totalPatients, setTotalPatients] = useState(0);
  const [appointmentsToday, setAppointmentsToday] = useState(0);
  const [appointmentsWeek, setAppointmentsWeek] = useState(0);
  const [mostCommonProcedure, setMostCommonProcedure] = useState('');
  const [patientsPerDay, setPatientsPerDay] = useState([]);
  const [procedureBreakdown, setProcedureBreakdown] = useState([]);
  const [efficiency, setEfficiency] = useState(0);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState('');
  const chartRef = useRef(null);
  const pieRef = useRef(null);
  const gaugeRef = useRef(null);
  const printRef = useRef(null);

  useEffect(() => {
    // Log page view
    logPageView('Doctor Analytics', 'analytics', 'reports');
    
    if (user && user.id) {
      fetchAnalytics();
    } else {
      console.log('⚠️ User not available yet');
      setLoading(false);
    }
  }, [user, logPageView]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!user) return;
    const intervalId = setInterval(() => {
      fetchAnalytics();
    }, 60000);
    return () => clearInterval(intervalId);
  }, [user]);

  useEffect(() => {
    console.log('📊 Doctor Line Chart useEffect triggered:', { 
      patientsPerDayLength: patientsPerDay.length,
      chartRefCurrent: !!chartRef.current,
      loading 
    });
    
    const renderLineChart = () => {
      if (patientsPerDay.length > 0 && chartRef.current) {
        console.log('📊 Rendering line chart with data:', patientsPerDay);
        
        try {
          const ctx = chartRef.current.getContext('2d');
          if (window.doctorLineChart) {
            console.log('📊 Destroying existing line chart');
            window.doctorLineChart.destroy();
          }
          
          window.doctorLineChart = new Chart(ctx, {
            type: 'line',
            data: {
              labels: patientsPerDay.map(a => a.date),
              datasets: [{
                label: 'Patients',
                data: patientsPerDay.map(a => a.count),
                backgroundColor: '#6366f1',
                borderColor: '#6366f1',
                fill: false,
                tension: 0.3
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: true,
              aspectRatio: 2.2,
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
            }
          });
          console.log('📊 Line chart created successfully');
        } catch (error) {
          console.error('📊 Error creating line chart:', error);
        }
      } else {
        console.log('📊 Line chart conditions not met:', { 
          hasData: patientsPerDay.length > 0, 
          hasCanvas: !!chartRef.current 
        });
      }
    };

    // Add delay to ensure DOM is ready
    if (patientsPerDay.length > 0) {
      const timeoutId = setTimeout(() => {
        console.log('📊 Attempting to render line chart after timeout');
        renderLineChart();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      renderLineChart();
    }
  }, [patientsPerDay, loading]);

  useEffect(() => {
    console.log('📊 Doctor Pie Chart useEffect triggered:', { 
      procedureBreakdownLength: procedureBreakdown.length,
      pieRefCurrent: !!pieRef.current,
      loading 
    });
    
    const renderPieChart = () => {
      if (procedureBreakdown.length > 0 && pieRef.current) {
        console.log('📊 Rendering pie chart with data:', procedureBreakdown);
        
        try {
          const ctx = pieRef.current.getContext('2d');
          if (window.doctorPieChart) {
            console.log('📊 Destroying existing pie chart');
            window.doctorPieChart.destroy();
          }
          
          window.doctorPieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
              labels: procedureBreakdown.map(p => p.name),
              datasets: [{
                data: procedureBreakdown.map(p => p.count),
                backgroundColor: ['#6366f1', '#22c55e', '#f59e42', '#f43f5e', '#a21caf', '#0ea5e9'],
                borderWidth: 0
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: true,
              aspectRatio: 1.3,
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
          hasData: procedureBreakdown.length > 0, 
          hasCanvas: !!pieRef.current 
        });
      }
    };

    // Add delay to ensure DOM is ready
    if (procedureBreakdown.length > 0) {
      const timeoutId = setTimeout(() => {
        console.log('📊 Attempting to render pie chart after timeout');
        renderPieChart();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      renderPieChart();
    }
  }, [procedureBreakdown, loading]);

  useEffect(() => {
    if (gaugeRef.current) {
      if (window.doctorGaugeChart) window.doctorGaugeChart.destroy();
      const ctx = gaugeRef.current.getContext('2d');
      window.doctorGaugeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Completed', 'Other'],
          datasets: [{
            data: [efficiency, 100 - efficiency],
            backgroundColor: ['#22c55e', '#e5e7eb'],
            borderWidth: 0
          }]
        },
        options: {
          cutout: '80%',
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
            title: { display: false }
          }
        }
      });
    }
  }, [efficiency]);

  const fetchAnalytics = async () => {
    setLoading(true);
    console.log('🚀 Starting doctor analytics fetch...');
    
    // Clear existing data to force re-render
    setPatientsPerDay([]);
    setProcedureBreakdown([]);
    setEfficiency(0);
    
    let debugLog = `\n=== Doctor Analytics Fetch Started at ${new Date().toLocaleTimeString()} ===`;
    debugLog += `\nUser ID: ${user?.id}`;
    
    try {
      if (!user || !user.id) {
        debugLog += '\nERROR: No user ID available';
        setDebugInfo(debugLog);
        setLoading(false);
        return;
      }

      console.log('🚀 Fetching doctor analytics for user:', user.id);

      // 1. APPOINTMENTS FOR THIS DOCTOR
      debugLog += '\n\n1. FETCHING DOCTOR APPOINTMENTS...';
      console.log('📅 Fetching appointments for doctor:', user.id);
      
      const { data: appointments, error: appointmentError } = await supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', user.id);

      if (appointmentError) {
        console.error('❌ Appointment fetch error:', appointmentError);
        debugLog += `\nAppointment Error: ${appointmentError.message}`;
      } else {
        console.log(`✅ Found ${appointments?.length || 0} appointments for doctor`);
        console.log('📅 Sample appointment data:', appointments?.slice(0, 2));
        debugLog += `\nDoctor appointments found: ${appointments?.length || 0}`;

        if (appointments && appointments.length > 0) {
          // Total unique patients
          const uniquePatients = new Set(appointments.map(a => a.patient_id));
          const totalPatientsCount = uniquePatients.size;
          setTotalPatients(totalPatientsCount);
          console.log('👥 Total unique patients seen:', totalPatientsCount);
          debugLog += `\nUnique patients: ${totalPatientsCount}`;

          // Today's date calculation
          const today = new Date();
          const todayStr = today.toISOString().split('T')[0];
          console.log('📅 Today is:', todayStr);
          
          // Week calculation (last 7 days)
          const weekAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
          const weekStr = weekAgo.toISOString().split('T')[0];
          console.log('📅 Week ago:', weekStr);

          // Filter appointments for today and this week
          const todayAppointments = appointments.filter(a => a.appointment_date === todayStr);
          const weekAppointments = appointments.filter(a => a.appointment_date >= weekStr);
          
          setAppointmentsToday(todayAppointments.length);
          setAppointmentsWeek(weekAppointments.length);
          
          console.log(`📊 Today: ${todayAppointments.length}, This week: ${weekAppointments.length}`);
          debugLog += `\nToday: ${todayAppointments.length}, Week: ${weekAppointments.length}`;

          // Efficiency calculation
          const completed = appointments.filter(a => a.status === 'completed');
          const efficiencyRate = appointments.length > 0 ? Math.round((completed.length / appointments.length) * 100) : 0;
          setEfficiency(efficiencyRate);
          console.log(`📈 Efficiency: ${efficiencyRate}% (${completed.length}/${appointments.length})`);
          debugLog += `\nEfficiency: ${efficiencyRate}% (${completed.length}/${appointments.length})`;

          // Patients per day (last 7 days)
          const byDay = {};
          appointments.forEach(a => {
            if (a.appointment_date) {
              const date = new Date(a.appointment_date);
              const dayKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              byDay[dayKey] = (byDay[dayKey] || 0) + 1;
            }
          });

          const sortedDays = Object.entries(byDay)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => {
              // Simple sort by date string - might need improvement for proper date ordering
              return a.date.localeCompare(b.date);
            })
            .slice(-7); // Last 7 entries

          setPatientsPerDay(sortedDays);
          console.log('📊 Patients per day:', sortedDays);
          debugLog += `\nPatients per day data points: ${sortedDays.length}`;
        } else {
          // No appointments found for this doctor
          setTotalPatients(0);
          setAppointmentsToday(0);
          setAppointmentsWeek(0);
          setEfficiency(0);
          setPatientsPerDay([]);
          console.log('⚠️ No appointments found for this doctor');
          debugLog += '\nNo appointments found for this doctor';
        }
      }

      // 2. MOST COMMON SERVICES/PROCEDURES FOR THIS DOCTOR (with categories)
      debugLog += '\n\n2. FETCHING DOCTOR SERVICES (via appointment_services)...';
      // Use the same appointment list we already fetched above
      const appointmentIds = (Array.isArray(appointments) ? appointments : []).map(a => a.id);
      if (appointmentIds.length > 0) {
        const { data: appServices, error: servicesError } = await supabase
          .from('appointment_services')
          .select(`
            appointment_id,
            service_id,
            services(id, name, category)
          `)
          .in('appointment_id', appointmentIds);

        if (servicesError) {
          console.error('❌ appointment_services fetch error:', servicesError);
          debugLog += `\nServices Error: ${servicesError.message}`;
        } else if (appServices && appServices.length > 0) {
          const serviceCounts = {};
          const categoryCounts = {};
          appServices.forEach(row => {
            const svc = row.services;
            if (!svc) return;
            serviceCounts[svc.name] = (serviceCounts[svc.name] || 0) + 1;
            if (svc.category) {
              categoryCounts[svc.category] = (categoryCounts[svc.category] || 0) + 1;
            }
          });

          // Determine most common service and category
          const topServiceEntry = Object.entries(serviceCounts).sort((a,b) => b[1]-a[1])[0];
          const topCategoryEntry = Object.entries(categoryCounts).sort((a,b) => b[1]-a[1])[0];
          let display = 'No procedures yet';
          if (topServiceEntry) {
            const svcName = topServiceEntry[0];
            const cat = topCategoryEntry ? topCategoryEntry[0] : undefined;
            display = `${svcName}${cat ? ` (${cat})` : ''}`;
          }
          setMostCommonProcedure(display);
          debugLog += `\nMost common service: ${display}`;

          const breakdown = Object.entries(serviceCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
          setProcedureBreakdown(breakdown);
          console.log('📊 Service breakdown:', breakdown);
          debugLog += `\nService breakdown items: ${breakdown.length}`;
        } else {
          setMostCommonProcedure('No procedures yet');
          setProcedureBreakdown([]);
          debugLog += '\nNo appointment services found for this doctor';
        }
      } else {
        setMostCommonProcedure('No procedures yet');
        setProcedureBreakdown([]);
        debugLog += '\nNo appointments -> cannot compute services';
      }

    } catch (error) {
      console.error('💥 Exception in fetchAnalytics:', error);
      debugLog += `\nEXCEPTION: ${error.message}`;
    } finally {
      setLoading(false);
      debugLog += `\n\n=== Doctor Fetch completed at ${new Date().toLocaleTimeString()} ===`;
      setDebugInfo(debugLog);
      console.log('🏁 Doctor analytics fetch completed');
    }
  };

  const handlePrint = () => {
    if (printRef.current) {
      const printContents = printRef.current.innerHTML;
      const win = window.open('', '', 'width=1200,height=800');
      win.document.write(`
        <html>
          <head>
            <title>Doctor Analytics Report - ${new Date().toLocaleDateString()}</title>
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
                  border-bottom: 3px solid #6366f1;
                  padding-bottom: 20px;
                }
                .print-header h1 {
                  color: #6366f1;
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
              <h1>👨‍⚕️ Doctor Analytics Report</h1>
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

  if (!user) {
    return (
      <div className="min-h-screen p-4 bg-gradient-to-br from-blue-50 via-white to-blue-100">
        <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-8 border border-blue-100">
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-600">Please log in to view analytics</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen p-4 bg-gradient-to-br from-blue-50 via-white to-blue-100">
        <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-8 border border-blue-100">
          <div className="flex flex-col items-center justify-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-gray-600">Loading your analytics data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-gradient-to-br from-blue-50 via-white to-blue-100">
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-8 border border-blue-100">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-700">Doctor Analytics</h1>
          <div className="flex space-x-3">
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-indigo-50 rounded-lg p-6 flex flex-col items-center justify-center">
              <FiUsers className="h-8 w-8 text-indigo-600 mb-2" />
              <div className="text-gray-500 text-sm">Total Patients Seen</div>
              <div className="text-2xl font-bold text-indigo-700">{totalPatients}</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-6 flex flex-col items-center justify-center">
              <FiCalendar className="h-8 w-8 text-blue-600 mb-2" />
              <div className="text-gray-500 text-sm">Appointments Today</div>
              <div className="text-2xl font-bold text-blue-700">{appointmentsToday}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-6 flex flex-col items-center justify-center">
              <FiCalendar className="h-8 w-8 text-green-600 mb-2" />
              <div className="text-gray-500 text-sm">Appointments This Week</div>
              <div className="text-2xl font-bold text-green-700">{appointmentsWeek}</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-6 flex flex-col items-center justify-center">
              <FiBarChart2 className="h-8 w-8 text-yellow-600 mb-2" />
              <div className="text-gray-500 text-sm">Most Common Procedure</div>
              <div className="text-lg font-semibold text-yellow-700 text-center break-words">{mostCommonProcedure}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-700 mb-4">Patients Per Day</h2>
              {patientsPerDay.length > 0 ? (
                <div className="h-64">
                  <canvas ref={chartRef}></canvas>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-500">
                  No patient activity data available
                </div>
              )}
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-700 mb-4">Procedures Breakdown</h2>
              {procedureBreakdown.length > 0 ? (
                <div className="h-64">
                  <canvas ref={pieRef}></canvas>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-500">
                  No procedure data available
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-lg font-bold text-gray-700 mb-4 text-center">Treatment Completion Rate</h2>
            <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
              <div className="h-64 flex items-center justify-center">
                <canvas ref={gaugeRef} width={180} height={180}></canvas>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl font-bold text-green-600">{efficiency}%</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-4 text-center">
              This metric shows the percentage of appointments that were successfully completed.
            </p>
          </div>

          {/* Data Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-bold text-gray-700 mb-3">Recent Activity</h3>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patients</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {patientsPerDay.slice(-5).map((day, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{day.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{day.count}</td>
                      </tr>
                    ))}
                    {patientsPerDay.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-6 py-4 text-center text-sm text-gray-500">No activity data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-bold text-gray-700 mb-3">Top Procedures</h3>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Procedure</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Count</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {procedureBreakdown.map((procedure, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{procedure.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{procedure.count}</td>
                      </tr>
                    ))}
                    {procedureBreakdown.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-6 py-4 text-center text-sm text-gray-500">No procedure data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorAnalytics;