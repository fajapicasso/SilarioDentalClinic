import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import supabase from '../../config/supabaseClient';
import { FiCalendar, FiCreditCard, FiBarChart2, FiPrinter } from 'react-icons/fi';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

const PatientAnalytics = () => {
  const { user } = useAuth();
  const [totalAppointments, setTotalAppointments] = useState(0);
  const [totalPayments, setTotalPayments] = useState(0);
  const [mostCommonService, setMostCommonService] = useState('');
  const [lastVisit, setLastVisit] = useState('');
  const [appointmentsOverTime, setAppointmentsOverTime] = useState([]);
  const [attendanceRate, setAttendanceRate] = useState(0);
  const [upcomingAppointments, setUpcomingAppointments] = useState(0);
  const [pendingPayments, setPendingPayments] = useState(0);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState('');
  const chartRef = useRef(null);
  const gaugeRef = useRef(null);
  const printRef = useRef(null);

  useEffect(() => {
    if (user && user.id) {
      fetchAnalytics();
    } else {
      console.log('⚠️ User not available yet');
      setLoading(false);
    }
  }, [user]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!user) return;
    const intervalId = setInterval(() => {
      fetchAnalytics();
    }, 60000);
    return () => clearInterval(intervalId);
  }, [user]);

  // Cleanup charts on unmount
  useEffect(() => {
    return () => {
      if (window.patientBarChart) {
        window.patientBarChart.destroy();
      }
      if (window.patientGaugeChart) {
        window.patientGaugeChart.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if (appointmentsOverTime.length > 0 && chartRef.current) {
      console.log('📊 Rendering appointments chart with data:', appointmentsOverTime);
      const ctx = chartRef.current.getContext('2d');
      
      // Destroy existing chart if it exists
      if (window.patientBarChart) {
        window.patientBarChart.destroy();
      }
      
      // Create new chart
      window.patientBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: appointmentsOverTime.map(a => a.date),
          datasets: [{
            label: 'Appointments',
            data: appointmentsOverTime.map(a => a.count),
            backgroundColor: '#2563eb',
            borderColor: '#1d4ed8',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { 
            legend: { display: false } 
          },
          scales: { 
            y: { 
              beginAtZero: true,
              ticks: {
                stepSize: 1
              }
            },
            x: {
              ticks: {
                maxRotation: 45
              }
            }
          }
        }
      });
    } else if (chartRef.current) {
      console.log('📊 No appointments data to render chart');
    }
  }, [appointmentsOverTime]);

  useEffect(() => {
    if (gaugeRef.current) {
      if (window.patientGaugeChart) window.patientGaugeChart.destroy();
      const ctx = gaugeRef.current.getContext('2d');
      window.patientGaugeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Attended', 'Missed'],
          datasets: [{
            data: [attendanceRate, 100 - attendanceRate],
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
  }, [attendanceRate]);

  const fetchAnalytics = async () => {
    setLoading(true);
    let debugLog = `\n=== Patient Analytics Fetch Started at ${new Date().toLocaleTimeString()} ===`;
    debugLog += `\nUser ID: ${user?.id}`;
    
    try {
      if (!user || !user.id) {
        debugLog += '\nERROR: No user ID available';
        setDebugInfo(debugLog);
        setLoading(false);
        return;
      }

      console.log('🚀 Fetching patient analytics for user:', user.id);

      // 1. APPOINTMENTS FOR THIS PATIENT
      debugLog += '\n\n1. FETCHING PATIENT APPOINTMENTS...';
      console.log('📅 Fetching appointments for patient:', user.id);
      
      const { data: appointments, count: appointmentCount, error: appointmentError } = await supabase
        .from('appointments')
        .select('*', { count: 'exact' })
        .eq('patient_id', user.id);

      if (appointmentError) {
        console.error('❌ Appointment fetch error:', appointmentError);
        debugLog += `\nAppointment Error: ${appointmentError.message}`;
      } else {
        console.log(`✅ Found ${appointmentCount || 0} appointments for patient`);
        console.log('📅 Sample appointment data:', appointments?.slice(0, 2));
        setTotalAppointments(appointmentCount || 0);
        debugLog += `\nTotal appointments: ${appointmentCount || 0}`;

        if (appointments && appointments.length > 0) {
          // Last visit (most recent completed appointment)
          const completedAppointments = appointments
            .filter(a => a.status === 'completed')
            .sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date));
          
          if (completedAppointments.length > 0) {
            const lastVisitDate = new Date(completedAppointments[0].appointment_date).toLocaleDateString();
            setLastVisit(lastVisitDate);
            console.log('📅 Last visit:', lastVisitDate);
            debugLog += `\nLast visit: ${lastVisitDate}`;
          } else {
            setLastVisit('No visits yet');
            console.log('⚠️ No completed visits found');
            debugLog += '\nNo completed visits found';
          }

          // Upcoming appointments
          const today = new Date().toISOString().split('T')[0];
          const upcoming = appointments.filter(a => 
            a.appointment_date >= today && 
            (a.status === 'confirmed' || a.status === 'pending')
          );
          setUpcomingAppointments(upcoming.length);
          console.log(`📊 Upcoming appointments: ${upcoming.length}`);
          debugLog += `\nUpcoming appointments: ${upcoming.length}`;

          // Attendance rate calculation
          const completed = appointments.filter(a => a.status === 'completed');
          const totalEligible = appointments.filter(a => {
            const appointmentDate = new Date(a.appointment_date);
            const todayDate = new Date(today);
            return appointmentDate <= todayDate && 
                   a.status !== 'pending'; // Exclude pending (future or unconfirmed)
          });
          
          const rate = totalEligible.length > 0 ? Math.round((completed.length / totalEligible.length) * 100) : 0;
          setAttendanceRate(rate);
          console.log(`📊 Attendance rate: ${rate}% (${completed.length}/${totalEligible.length})`);
          debugLog += `\nAttendance rate: ${rate}% (${completed.length}/${totalEligible.length})`;

          // Appointments over time (by month)
          const byMonth = {};
          appointments.forEach(a => {
            if (a.appointment_date) {
              const date = new Date(a.appointment_date);
              const monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' });
              byMonth[monthYear] = (byMonth[monthYear] || 0) + 1;
            }
          });

          const sortedMonths = Object.entries(byMonth)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => {
              const dateA = new Date(a.date + ' 1');
              const dateB = new Date(b.date + ' 1');
              return dateA - dateB;
            })
            .slice(-6); // Last 6 months

          setAppointmentsOverTime(sortedMonths);
          console.log('📊 Appointments over time:', sortedMonths);
          debugLog += `\nAppointments timeline data points: ${sortedMonths.length}`;
        } else {
          // No appointments found
          setLastVisit('No visits yet');
          setUpcomingAppointments(0);
          setAttendanceRate(0);
          setAppointmentsOverTime([]);
          console.log('⚠️ No appointments found for this patient');
          debugLog += '\nNo appointments found for this patient';
        }
      }

      // 2. PAYMENTS FOR THIS PATIENT  
      debugLog += '\n\n2. FETCHING PATIENT PAYMENTS...';
      console.log('💰 Fetching payments for patient:', user.id);
      
      const { data: payments, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('created_by', user.id);

      if (paymentError) {
        console.error('❌ Payment fetch error:', paymentError);
        debugLog += `\nPayment Error: ${paymentError.message}`;
      } else {
        console.log(`✅ Found ${payments?.length || 0} payments for patient`);
        console.log('💰 Sample payment data:', payments?.slice(0, 2));
        debugLog += `\nTotal payment records: ${payments?.length || 0}`;

        if (payments && payments.length > 0) {
          // Calculate total approved payments
          const approvedPayments = payments.filter(p => p.approval_status === 'approved');
          const totalPaid = approvedPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
          setTotalPayments(totalPaid);
          console.log(`💰 Total approved payments: ₱${totalPaid}`);
          debugLog += `\nApproved payments: ${approvedPayments.length}, Total: ₱${totalPaid}`;

          // Count pending payments
          const pending = payments.filter(p => p.approval_status === 'pending');
          setPendingPayments(pending.length);
          console.log(`⏳ Pending payments: ${pending.length}`);
          debugLog += `\nPending payments: ${pending.length}`;
        } else {
          setTotalPayments(0);
          setPendingPayments(0);
          console.log('⚠️ No payment records found');
          debugLog += '\nNo payment records found';
        }
      }

      // 3. APPOINTMENT SERVICES FOR THIS PATIENT (to find most common service)
      debugLog += '\n\n3. FETCHING PATIENT APPOINTMENT SERVICES...';
      console.log('🦷 Fetching appointment services for patient:', user.id);
      
      // First get all appointments for this patient
      const { data: patientAppointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select('id')
        .eq('patient_id', user.id);

      if (appointmentsError) {
        console.error('❌ Appointments fetch error:', appointmentsError);
        debugLog += `\nAppointments Error: ${appointmentsError.message}`;
      } else {
        console.log(`✅ Found ${patientAppointments?.length || 0} appointments for patient`);
        
        if (patientAppointments && patientAppointments.length > 0) {
          // Get appointment IDs
          const appointmentIds = patientAppointments.map(a => a.id);
          
          // Fetch appointment services with service details
          const { data: appointmentServices, error: servicesError } = await supabase
            .from('appointment_services')
            .select(`
              service_id,
              services (
                id,
                name,
                category,
                description
              )
            `)
            .in('appointment_id', appointmentIds);

          if (servicesError) {
            console.error('❌ Appointment services fetch error:', servicesError);
            debugLog += `\nAppointment Services Error: ${servicesError.message}`;
          } else {
            console.log(`✅ Found ${appointmentServices?.length || 0} appointment services`);
            console.log('🦷 Sample appointment services data:', appointmentServices?.slice(0, 2));
            debugLog += `\nAppointment services records: ${appointmentServices?.length || 0}`;

            if (appointmentServices && appointmentServices.length > 0) {
              // Count services by name and category
              const serviceCounts = {};
              const categoryCounts = {};
              
              appointmentServices.forEach(as => {
                if (as.services) {
                  const serviceName = as.services.name;
                  const serviceCategory = as.services.category;
                  
                  // Count by service name
                  serviceCounts[serviceName] = (serviceCounts[serviceName] || 0) + 1;
                  
                  // Count by category
                  if (serviceCategory) {
                    categoryCounts[serviceCategory] = (categoryCounts[serviceCategory] || 0) + 1;
                  }
                }
              });

              // Find most common service name
              const mostCommonService = Object.entries(serviceCounts)
                .sort((a, b) => b[1] - a[1])[0];
              
              // Find most common category
              const mostCommonCategory = Object.entries(categoryCounts)
                .sort((a, b) => b[1] - a[1])[0];
              
              // Display service name with category in parentheses
              let displayService = 'No services yet';
              if (mostCommonService) {
                const serviceName = mostCommonService[0];
                const serviceCount = mostCommonService[1];
                const category = mostCommonCategory ? mostCommonCategory[0] : 'General';
                displayService = `${serviceName} (${category})`;
              }
              
              setMostCommonService(displayService);
              console.log('🏆 Most common service:', displayService);
              debugLog += `\nMost common service: ${displayService}`;
            } else {
              setMostCommonService('No services yet');
              console.log('⚠️ No appointment services found');
              debugLog += '\nNo appointment services found';
            }
          }
        } else {
          setMostCommonService('No services yet');
          console.log('⚠️ No appointments found');
          debugLog += '\nNo appointments found';
        }
      }

    } catch (error) {
      console.error('💥 Exception in fetchAnalytics:', error);
      debugLog += `\nEXCEPTION: ${error.message}`;
    } finally {
      setLoading(false);
      debugLog += `\n\n=== Patient Fetch completed at ${new Date().toLocaleTimeString()} ===`;
      setDebugInfo(debugLog);
      console.log('🏁 Patient analytics fetch completed');
    }
  };

  const handlePrint = () => {
    if (printRef.current) {
      const printContents = printRef.current.innerHTML;
      const win = window.open('', '', 'width=1200,height=800');
      win.document.write(`
        <html>
          <head>
            <title>Patient Analytics Report - ${new Date().toLocaleDateString()}</title>
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
                  border-bottom: 3px solid #2563eb;
                  padding-bottom: 20px;
                }
                .print-header h1 {
                  color: #2563eb;
                  font-size: 28px;
                  margin-bottom: 10px;
                  font-weight: bold;
                }
                
                .metrics-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
                  font-size: 20px;
                  font-weight: bold;
                  margin: 10px 0;
                  color: #1f2937;
                  word-wrap: break-word;
                }
                .metric-label {
                  font-size: 11px;
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
              <h1>🏥 Patient Health Summary</h1>
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
            <p className="text-gray-600">Please log in to view your analytics</p>
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
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading your health analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-gradient-to-br from-blue-50 via-white to-blue-100">
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-8 border border-blue-100">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-blue-700">My Dental Analytics</h1>
         
        </div>

        
        
        <div ref={printRef}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-blue-50 rounded-lg p-6 flex flex-col items-center justify-center">
              <FiCalendar className="h-8 w-8 text-blue-600 mb-2" />
              <div className="text-gray-500 text-sm">Total Appointments</div>
              <div className="text-2xl font-bold text-blue-700">{totalAppointments}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-6 flex flex-col items-center justify-center">
              <FiCreditCard className="h-8 w-8 text-green-600 mb-2" />
              <div className="text-gray-500 text-sm">Total Payments</div>
              <div className="text-2xl font-bold text-green-700">₱{totalPayments.toLocaleString()}</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-6 flex flex-col items-center justify-center">
              <FiBarChart2 className="h-8 w-8 text-yellow-600 mb-2" />
              <div className="text-gray-500 text-sm">Most Common Service</div>
              <div className="text-lg font-semibold text-yellow-700 text-center break-words">{mostCommonService}</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-6 flex flex-col items-center justify-center">
              <FiCalendar className="h-8 w-8 text-purple-600 mb-2" />
              <div className="text-gray-500 text-sm">Last Visit</div>
              <div className="text-lg font-semibold text-purple-700 text-center">{lastVisit}</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-6 flex flex-col items-center justify-center">
              <FiCalendar className="h-8 w-8 text-orange-600 mb-2" />
              <div className="text-gray-500 text-sm">Upcoming Appointments</div>
              <div className="text-2xl font-bold text-orange-700">{upcomingAppointments}</div>
            </div>
            <div className="bg-red-50 rounded-lg p-6 flex flex-col items-center justify-center">
              <FiCreditCard className="h-8 w-8 text-red-600 mb-2" />
              <div className="text-gray-500 text-sm">Pending Payments</div>
              <div className="text-2xl font-bold text-red-700">{pendingPayments}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-700 mb-4">Appointments Over Time</h2>
              {appointmentsOverTime.length > 0 ? (
                <div className="h-64 w-full">
                  <canvas ref={chartRef}></canvas>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-500">
                  No appointment history available
                </div>
              )}
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-700 mb-4">Attendance Rate</h2>
              <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
                <canvas ref={gaugeRef} width={192} height={192}></canvas>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl font-bold text-green-600">{attendanceRate}%</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-4 text-center">
                Shows how often you attend scheduled appointments
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-bold text-gray-700 mb-4 text-center">Healthcare Summary</h3>
            <div className="text-gray-700 text-center">
              <p>You have completed <strong>{totalAppointments}</strong> appointments with an attendance rate of <strong>{attendanceRate}%</strong>. 
              Your most frequently received service is <strong>{mostCommonService}</strong>.</p>
              
              <p className="mt-3">
                {upcomingAppointments > 0 ? 
                  `You have ${upcomingAppointments} upcoming appointment${upcomingAppointments > 1 ? 's' : ''}.` : 
                  'No upcoming appointments scheduled.'}
              </p>
              
              {pendingPayments > 0 && (
                <p className="mt-3 text-red-600">
                  <strong>Note:</strong> You have {pendingPayments} pending payment{pendingPayments > 1 ? 's' : ''} that require attention.
                </p>
              )}
              
              {lastVisit !== 'No visits yet' && (
                <p className="mt-3 text-blue-600">
                  Your last visit was on <strong>{lastVisit}</strong>.
                </p>
              )}
            </div>
          </div>

          {/* Data Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-bold text-gray-700 mb-3">Appointment History</h3>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Appointments</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {appointmentsOverTime.slice(-5).map((month, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{month.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{month.count}</td>
                      </tr>
                    ))}
                    {appointmentsOverTime.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-6 py-4 text-center text-sm text-gray-500">No appointment history</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-bold text-gray-700 mb-3">Quick Stats</h3>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Total Appointments:</span>
                    <span className="text-sm text-gray-900">{totalAppointments}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Attendance Rate:</span>
                    <span className="text-sm text-gray-900">{attendanceRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Total Paid:</span>
                    <span className="text-sm text-gray-900">₱{totalPayments.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Upcoming:</span>
                    <span className="text-sm text-gray-900">{upcomingAppointments} appointment{upcomingAppointments !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Pending Payments:</span>
                    <span className="text-sm text-gray-900">{pendingPayments}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientAnalytics;