import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import supabase from '../../config/supabaseClient';
import { FiUsers, FiCalendar, FiBarChart2, FiPrinter, FiRefreshCw, FiFilter } from 'react-icons/fi';
import { Chart, registerables } from 'chart.js';
import { useUniversalAudit } from '../../hooks/useUniversalAudit';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
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
  const [timeFilter, setTimeFilter] = useState('all'); // all, daily, weekly, monthly, yearly, custom
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [filterPeriod, setFilterPeriod] = useState('');
  const [doctorName, setDoctorName] = useState('');
  // New analytics data
  const [activeDays, setActiveDays] = useState([]); // Day of week distribution
  const [activeTimes, setActiveTimes] = useState([]); // Time slot distribution
  const [statusBreakdown, setStatusBreakdown] = useState([]); // Appointment status breakdown
  const chartRef = useRef(null);
  const pieRef = useRef(null);
  const gaugeRef = useRef(null);
  const dayChartRef = useRef(null);
  const timeChartRef = useRef(null);
  const statusChartRef = useRef(null);
  const printRef = useRef(null);

  useEffect(() => {
    // Log page view
    logPageView('Doctor Analytics', 'analytics', 'reports');
    
    if (user && user.id) {
      fetchDoctorName();
      fetchAnalytics();
    } else {
      console.log('⚠️ User not available yet');
      setLoading(false);
    }
  }, [user, logPageView]);

  const fetchDoctorName = async () => {
    if (!user || !user.id) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      setDoctorName(data?.full_name || '');
    } catch (error) {
      console.error('Error fetching doctor name:', error);
      setDoctorName('');
    }
  };

  // Fetch analytics when filter changes
  useEffect(() => {
    if (user && user.id && timeFilter !== 'custom') {
      fetchAnalytics();
    }
  }, [timeFilter, user]);

  // Auto-refresh every 60 seconds (only if not custom filter)
  useEffect(() => {
    if (!user || timeFilter === 'custom') return;
    const intervalId = setInterval(() => {
      fetchAnalytics();
    }, 60000);
    return () => clearInterval(intervalId);
  }, [user, timeFilter]);

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

  // Render Active Days Chart
  useEffect(() => {
    const renderDayChart = () => {
      if (dayChartRef.current && activeDays.length > 0 && !loading) {
        try {
          const ctx = dayChartRef.current.getContext('2d');
          if (window.doctorDayChart) window.doctorDayChart.destroy();
          window.doctorDayChart = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: activeDays.map(d => d.day.substring(0, 3)),
              datasets: [{
                label: 'Appointments',
                data: activeDays.map(d => d.count),
                backgroundColor: '#6366f1',
                borderColor: '#6366f1',
                borderWidth: 1
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: true,
              aspectRatio: 2,
              plugins: { 
                legend: { display: false } 
              },
              scales: { 
                y: { 
                  beginAtZero: true,
                  ticks: { font: { size: 10 } }
                },
                x: {
                  ticks: { font: { size: 10 } }
                }
              }
            }
          });
          console.log('📊 Day chart created successfully');
        } catch (error) {
          console.error('📊 Error creating day chart:', error);
        }
      }
    };

    if (activeDays.length > 0) {
      const timeoutId = setTimeout(() => {
        renderDayChart();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      renderDayChart();
    }
  }, [activeDays, loading]);

  // Render Active Times Chart
  useEffect(() => {
    const renderTimeChart = () => {
      if (timeChartRef.current && activeTimes.length > 0 && !loading) {
        try {
          const ctx = timeChartRef.current.getContext('2d');
          if (window.doctorTimeChart) window.doctorTimeChart.destroy();
          
          // Generate colors for each hour
          const colors = [
            '#3b82f6', '#60a5fa', '#93c5fd', '#6366f1', '#818cf8',
            '#a78bfa', '#c084fc', '#d946ef', '#ec4899', '#f43f5e'
          ];
          
          window.doctorTimeChart = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: activeTimes.map(t => t.time),
              datasets: [{
                label: 'Appointments',
                data: activeTimes.map(t => t.count),
                backgroundColor: activeTimes.map((_, index) => colors[index % colors.length]),
                borderColor: activeTimes.map((_, index) => colors[index % colors.length]),
                borderWidth: 1
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: true,
              aspectRatio: 2,
              plugins: { 
                legend: { 
                  display: false 
                } 
              },
              scales: { 
                y: { 
                  beginAtZero: true,
                  ticks: { 
                    font: { size: 10 },
                    stepSize: 1
                  }
                },
                x: {
                  ticks: { font: { size: 10 } }
                }
              }
            }
          });
          console.log('📊 Time chart created successfully');
        } catch (error) {
          console.error('📊 Error creating time chart:', error);
        }
      }
    };

    if (activeTimes.length > 0) {
      const timeoutId = setTimeout(() => {
        renderTimeChart();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      renderTimeChart();
    }
  }, [activeTimes, loading]);


  // Render Status Breakdown Chart
  useEffect(() => {
    const renderStatusChart = () => {
      if (statusChartRef.current && statusBreakdown.length > 0 && !loading) {
        try {
          const ctx = statusChartRef.current.getContext('2d');
          if (window.doctorStatusChart) window.doctorStatusChart.destroy();
          window.doctorStatusChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
              labels: statusBreakdown.map(s => s.label),
              datasets: [{
                data: statusBreakdown.map(s => s.count),
                backgroundColor: statusBreakdown.map(s => s.color),
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
                  labels: { font: { size: 10 } }
                } 
              }
            }
          });
          console.log('📊 Status chart created successfully');
        } catch (error) {
          console.error('📊 Error creating status chart:', error);
        }
      }
    };

    if (statusBreakdown.length > 0) {
      const timeoutId = setTimeout(() => {
        renderStatusChart();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      renderStatusChart();
    }
  }, [statusBreakdown, loading]);

  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const formatDate = (date) => {
      if (!date) return null;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    let periodLabel = '';
    let dateRange = null;
    
    switch (timeFilter) {
      case 'daily':
        const todayFormatted = formatDate(today);
        periodLabel = `Daily Report - ${todayFormatted}`;
        dateRange = { date: todayFormatted, isDaily: true };
        break;
      case 'weekly':
        const weekStart = new Date(today);
        const dayOfWeek = weekStart.getDay();
        weekStart.setDate(weekStart.getDate() - dayOfWeek);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const weekStartFormatted = formatDate(weekStart);
        const weekEndFormatted = formatDate(weekEnd);
        periodLabel = `Weekly Report - ${weekStartFormatted} to ${weekEndFormatted}`;
        dateRange = { start: weekStartFormatted, end: weekEndFormatted };
        break;
      case 'monthly':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const monthStartFormatted = formatDate(monthStart);
        const monthEndFormatted = formatDate(monthEnd);
        periodLabel = `Monthly Report - ${monthStartFormatted} to ${monthEndFormatted}`;
        dateRange = { start: monthStartFormatted, end: monthEndFormatted };
        break;
      case 'yearly':
        const yearStart = new Date(today.getFullYear(), 0, 1);
        const yearEnd = new Date(today.getFullYear(), 11, 31);
        const yearStartFormatted = formatDate(yearStart);
        const yearEndFormatted = formatDate(yearEnd);
        periodLabel = `Yearly Report - ${yearStartFormatted} to ${yearEndFormatted}`;
        dateRange = { start: yearStartFormatted, end: yearEndFormatted };
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          const customStartFormatted = formatDate(customStartDate);
          const customEndFormatted = formatDate(customEndDate);
          periodLabel = `Custom Report - ${customStartFormatted} to ${customEndFormatted}`;
          dateRange = { start: customStartFormatted, end: customEndFormatted };
        }
        break;
      case 'all':
      default:
        periodLabel = 'All Time Report';
        dateRange = null;
        break;
    }
    
    setFilterPeriod(periodLabel);
    return dateRange;
  };

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
      
      const dateRange = getDateRange();
      console.log('📅 Date range filter:', dateRange, 'timeFilter:', timeFilter);
      
      let appointmentQuery = supabase
        .from('appointments')
        .select(`
          *,
          patients:patient_id (
            id,
            gender,
            birthday,
            age
          )
        `)
        .eq('doctor_id', user.id);

      if (dateRange) {
        if (dateRange.isDaily) {
          appointmentQuery = appointmentQuery.eq('appointment_date', dateRange.date);
        } else if (dateRange.start && dateRange.end) {
          appointmentQuery = appointmentQuery
            .gte('appointment_date', dateRange.start)
            .lte('appointment_date', dateRange.end);
        }
      }
      
      const { data: appointments, error: appointmentError } = await appointmentQuery;

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

          // NEW ANALYTICS: Most Active Day of Week
          const dayOfWeekCounts = {
            'Sunday': 0, 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0,
            'Thursday': 0, 'Friday': 0, 'Saturday': 0
          };
          appointments.forEach(a => {
            if (a.appointment_date) {
              const date = new Date(a.appointment_date);
              const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
              dayOfWeekCounts[dayName] = (dayOfWeekCounts[dayName] || 0) + 1;
            }
          });
          const activeDaysData = Object.entries(dayOfWeekCounts)
            .map(([day, count]) => ({ day, count }))
            .sort((a, b) => {
              const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
              return dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
            });
          setActiveDays(activeDaysData);
          console.log('📊 Active days:', activeDaysData);
          debugLog += `\nActive days data points: ${activeDaysData.length}`;

          // NEW ANALYTICS: Most Active Time Slots (Hourly from 8AM to 5PM)
          const timeSlots = {};
          // Initialize all hours from 8AM to 5PM
          for (let hour = 8; hour <= 17; hour++) {
            const hourLabel = hour < 12 ? `${hour}AM` : hour === 12 ? '12PM' : `${hour - 12}PM`;
            timeSlots[hourLabel] = 0;
          }
          
          appointments.forEach(a => {
            if (a.appointment_time) {
              const timeParts = a.appointment_time.split(':');
              const hour = parseInt(timeParts[0]);
              // Only count hours between 8AM (8) and 5PM (17)
              if (hour >= 8 && hour <= 17) {
                const hourLabel = hour < 12 ? `${hour}AM` : hour === 12 ? '12PM' : `${hour - 12}PM`;
                if (timeSlots.hasOwnProperty(hourLabel)) {
                  timeSlots[hourLabel]++;
                }
              }
            }
          });
          
          // Convert to array and filter out hours with no appointments, sort by hour
          const activeTimesData = Object.entries(timeSlots)
            .filter(([_, count]) => count > 0)
            .map(([time, count]) => {
              // Extract hour number for sorting
              const hourMatch = time.match(/(\d+)(AM|PM)/);
              let sortHour = 0;
              if (hourMatch) {
                const hourNum = parseInt(hourMatch[1]);
                const period = hourMatch[2];
                sortHour = period === 'AM' ? hourNum : (hourNum === 12 ? 12 : hourNum + 12);
              }
              return { time, count, sortHour };
            })
            .sort((a, b) => a.sortHour - b.sortHour)
            .map(({ time, count }) => ({ time, count }));
          
          setActiveTimes(activeTimesData);
          console.log('📊 Active times:', activeTimesData);
          debugLog += `\nActive times data points: ${activeTimesData.length}`;


          // NEW ANALYTICS: Status Breakdown
          const statusCounts = {
            'completed': 0,
            'confirmed': 0,
            'cancelled': 0,
            'rejected': 0,
            'pending': 0
          };
          appointments.forEach(a => {
            const status = a.status?.toLowerCase() || 'pending';
            if (statusCounts.hasOwnProperty(status)) {
              statusCounts[status]++;
            } else {
              statusCounts['pending']++;
            }
          });
          const statusData = [
            { label: 'Completed', count: statusCounts.completed, color: '#22c55e' },
            { label: 'Upcoming', count: statusCounts.confirmed, color: '#3b82f6' },
            { label: 'Cancelled', count: statusCounts.cancelled, color: '#f59e0b' },
            { label: 'Rejected', count: statusCounts.rejected, color: '#ef4444' }
          ];
          setStatusBreakdown(statusData);
          console.log('📊 Status breakdown:', statusData);
          debugLog += `\nStatus: Completed=${statusCounts.completed}, Upcoming=${statusCounts.confirmed}, Cancelled=${statusCounts.cancelled}, Rejected=${statusCounts.rejected}`;
        } else {
          // No appointments found for this doctor
          setTotalPatients(0);
          setAppointmentsToday(0);
          setAppointmentsWeek(0);
          setEfficiency(0);
          setPatientsPerDay([]);
          setActiveDays([]);
          setActiveTimes([]);
          setStatusBreakdown([]);
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

  const handlePrint = async () => {
    if (!printRef.current) return;

    // Convert charts to images
    const chartImages = {};
    if (chartRef.current && window.doctorLineChart) {
      chartImages.lineChart = window.doctorLineChart.toBase64Image();
    }
    if (pieRef.current && window.doctorPieChart) {
      chartImages.pieChart = window.doctorPieChart.toBase64Image();
    }
    if (gaugeRef.current && window.doctorGaugeChart) {
      chartImages.gaugeChart = window.doctorGaugeChart.toBase64Image();
    }
    if (dayChartRef.current && window.doctorDayChart) {
      chartImages.dayChart = window.doctorDayChart.toBase64Image();
    }
    if (timeChartRef.current && window.doctorTimeChart) {
      chartImages.timeChart = window.doctorTimeChart.toBase64Image();
    }
    if (statusChartRef.current && window.doctorStatusChart) {
      chartImages.statusChart = window.doctorStatusChart.toBase64Image();
    }

    // Use logo path - same approach as other print components
    const logoPath = `${window.location.origin}/src/assets/Logo.png`;

    const printContents = printRef.current.innerHTML;
    const periodInfo = filterPeriod || 'All Time Report';
    
    const win = window.open('', '', 'width=1200,height=800');
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Doctor Analytics Report - ${new Date().toLocaleDateString()}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { 
              font-family: 'Arial', sans-serif; 
              padding: 20px;
              font-size: 11px;
              line-height: 1.4;
              color: #333;
            }
            .no-print { display: none !important; }
            
            .print-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 20px;
              border-bottom: 3px solid #6366f1;
              padding-bottom: 15px;
            }
            .print-header-left {
              display: flex;
              align-items: center;
              gap: 15px;
            }
            .print-header-logo {
              width: 60px;
              height: 60px;
              object-fit: contain;
            }
            .print-header-clinic {
              display: flex;
              flex-direction: column;
            }
            .print-header-clinic-name {
              font-size: 18px;
              font-weight: bold;
              color: #2563eb;
              letter-spacing: 1px;
              margin-bottom: 2px;
            }
            .print-header-clinic-subtitle {
              font-size: 11px;
              color: #666;
              font-style: italic;
            }
            .print-header-right {
              text-align: right;
              display: flex;
              flex-direction: column;
              align-items: flex-end;
            }
            .print-header-right h1 {
              color: #6366f1;
              font-size: 22px;
              margin-bottom: 6px;
              font-weight: bold;
            }
            .print-header-right .period {
              font-size: 11px;
              color: #555;
              margin-top: 3px;
              font-weight: 500;
            }
            .print-header-right .date {
              font-size: 10px;
              color: #777;
              margin-top: 3px;
            }
            
            .metrics-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
              margin-bottom: 20px;
            }
            .metric-card {
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              padding: 12px;
              text-align: center;
              background: #f8fafc;
            }
            .metric-value {
              font-size: 22px;
              font-weight: bold;
              margin: 8px 0;
              color: #1f2937;
            }
            .metric-label {
              font-size: 10px;
              color: #6b7280;
              text-transform: uppercase;
              font-weight: 600;
              letter-spacing: 0.5px;
            }
            
            .charts-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
              margin-bottom: 20px;
            }
            .chart-container {
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              padding: 12px;
              background: white;
            }
            .chart-container h3 {
              font-size: 12px;
              font-weight: bold;
              margin-bottom: 8px;
              color: #333;
              text-align: center;
            }
            .chart-container img {
              width: 100%;
              height: auto;
              max-height: 160px;
              display: block;
              margin: 0 auto;
            }
            .status-chart-wrapper {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 100%;
            }
            .status-chart-wrapper img {
              width: 140px !important;
              height: 140px !important;
              object-fit: contain;
              display: block;
              margin: 0 auto;
            }
            
            .gauge-container {
              text-align: center;
              margin-bottom: 20px;
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              padding: 15px;
              background: white;
            }
            .gauge-container h3 {
              font-size: 12px;
              font-weight: bold;
              margin-bottom: 10px;
              color: #333;
            }
            .gauge-wrapper {
              position: relative;
              display: inline-block;
              width: 180px;
              height: 180px;
            }
            .gauge-container img {
              width: 180px;
              height: 180px;
              display: block;
            }
            .gauge-value {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              font-size: 32px;
              font-weight: bold;
              color: #22c55e;
              z-index: 10;
            }
            
            .tables-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
            }
            .table-container {
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              overflow: hidden;
              background: white;
            }
            .table-container h3 {
              font-size: 12px;
              font-weight: bold;
              padding: 10px 12px;
              background: #f3f4f6;
              border-bottom: 2px solid #e5e7eb;
              color: #333;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10px;
            }
            th {
              background: #f9fafb;
              padding: 8px 12px;
              text-align: left;
              font-weight: 600;
              color: #374151;
              border-bottom: 2px solid #e5e7eb;
              font-size: 10px;
            }
            td {
              padding: 8px 12px;
              border-bottom: 1px solid #f3f4f6;
              font-size: 10px;
            }
            tr:last-child td {
              border-bottom: none;
            }
            tr:hover {
              background: #f9fafb;
            }
            
            @media print {
              @page { 
                margin: 0.4in; 
                size: A4;
              }
              body {
                padding: 0;
                font-size: 10px;
              }
              .print-header {
                page-break-after: avoid;
                margin-bottom: 18px;
              }
              .metrics-grid {
                page-break-inside: avoid;
                margin-bottom: 18px;
              }
              .charts-grid {
                page-break-inside: avoid;
                margin-bottom: 18px;
              }
              .gauge-container {
                page-break-inside: avoid;
                margin-bottom: 18px;
              }
              .tables-grid {
                page-break-inside: avoid;
              }
              .status-breakdown-section {
                page-break-before: always;
                margin-top: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <div class="print-header-left">
              <img src="${logoPath}" alt="Silario Dental Clinic Logo" class="print-header-logo" />
              <div class="print-header-clinic">
                <div class="print-header-clinic-name">SILARIO DENTAL CLINIC</div>
                <div class="print-header-clinic-subtitle">${doctorName || 'Doctor'}</div>
              </div>
            </div>
            <div class="print-header-right">
              <h1>Doctor Analytics Report</h1>
              <div class="period">${periodInfo}</div>
              <div class="date">Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</div>
            </div>
          </div>
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-label">Total Patients</div>
              <div class="metric-value">${totalPatients}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Today</div>
              <div class="metric-value">${appointmentsToday}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">This Week</div>
              <div class="metric-value">${appointmentsWeek}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Top Procedure</div>
              <div class="metric-value" style="font-size: 11px; line-height: 1.3; word-wrap: break-word;">${mostCommonProcedure || 'N/A'}</div>
            </div>
          </div>
          <div class="charts-grid">
            <div class="chart-container">
              <h3>Patients Per Day</h3>
              ${chartImages.lineChart ? `<img src="${chartImages.lineChart}" alt="Patients Per Day Chart" />` : '<p style="font-size: 9px; color: #999; text-align: center; padding: 20px;">No chart data available</p>'}
            </div>
            <div class="chart-container">
              <h3>Procedures Breakdown</h3>
              ${chartImages.pieChart ? `<img src="${chartImages.pieChart}" alt="Procedures Breakdown Chart" />` : '<p style="font-size: 9px; color: #999; text-align: center; padding: 20px;">No chart data available</p>'}
            </div>
          </div>
          <div class="gauge-container">
            <h3>Treatment Completion Rate</h3>
            <div class="gauge-wrapper">
              ${chartImages.gaugeChart ? `<img src="${chartImages.gaugeChart}" alt="Efficiency Gauge" />` : '<div style="width: 180px; height: 180px; background: #e5e7eb; border-radius: 50%; border: 8px solid #22c55e;"></div>'}
              <div class="gauge-value">${efficiency}%</div>
            </div>
          </div>
          <div class="charts-grid">
            <div class="chart-container">
              <h3>Most Active Day of Week</h3>
              ${chartImages.dayChart ? `<img src="${chartImages.dayChart}" alt="Active Days Chart" />` : '<p style="font-size: 9px; color: #999; text-align: center; padding: 20px;">No data available</p>'}
            </div>
            <div class="chart-container">
              <h3>Most Active Time Slots</h3>
              ${chartImages.timeChart ? `<img src="${chartImages.timeChart}" alt="Active Times Chart" />` : '<p style="font-size: 9px; color: #999; text-align: center; padding: 20px;">No data available</p>'}
            </div>
          </div>
          <div class="chart-container status-breakdown-section" style="margin-bottom: 15px;">
            <h3>Appointment Status Breakdown</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="status-chart-wrapper">
                ${chartImages.statusChart ? `<img src="${chartImages.statusChart}" alt="Status Chart" />` : '<p style="font-size: 9px; color: #999; text-align: center; padding: 20px;">No data available</p>'}
              </div>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; font-size: 9px;">
                ${statusBreakdown.map(item => `
                  <div style="text-align: center; padding: 6px; background: #f9fafb; border-radius: 4px;">
                    <div style="font-weight: bold; color: ${item.color}; font-size: 14px;">${item.count}</div>
                    <div style="color: #666; font-weight: 600; font-size: 8px;">${item.label}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
          <div class="tables-grid">
            <div class="table-container">
              <h3>Recent Activity</h3>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Patients</th>
                  </tr>
                </thead>
                <tbody>
                  ${patientsPerDay.slice(-5).map(day => `
                    <tr>
                      <td>${day.date}</td>
                      <td>${day.count}</td>
                    </tr>
                  `).join('')}
                  ${patientsPerDay.length === 0 ? '<tr><td colspan="2" style="text-align: center; color: #999;">No data available</td></tr>' : ''}
                </tbody>
              </table>
            </div>
            <div class="table-container">
              <h3>Top Procedures</h3>
              <table>
                <thead>
                  <tr>
                    <th>Procedure</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  ${procedureBreakdown.map(proc => `
                    <tr>
                      <td>${proc.name}</td>
                      <td>${proc.count}</td>
                    </tr>
                  `).join('')}
                  ${procedureBreakdown.length === 0 ? '<tr><td colspan="2" style="text-align: center; color: #999;">No data available</td></tr>' : ''}
                </tbody>
              </table>
            </div>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-indigo-700">Doctor Analytics</h1>
          <div className="flex space-x-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <FiPrinter className="h-4 w-4 mr-2" />
              Print Report
            </button>
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

        {/* Filter Section */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 no-print">
          <div className="flex items-center mb-3">
            <FiFilter className="h-5 w-5 text-indigo-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-700">Report Filters</h2>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Time Period:</label>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {timeFilter === 'custom' && (
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">From:</label>
                <DatePicker
                  selected={customStartDate}
                  onChange={(date) => setCustomStartDate(date)}
                  selectsStart
                  startDate={customStartDate}
                  endDate={customEndDate}
                  maxDate={customEndDate || new Date()}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  dateFormat="yyyy-MM-dd"
                  placeholderText="Start Date"
                />
                <label className="text-sm font-medium text-gray-700">To:</label>
                <DatePicker
                  selected={customEndDate}
                  onChange={(date) => setCustomEndDate(date)}
                  selectsEnd
                  startDate={customStartDate}
                  endDate={customEndDate}
                  minDate={customStartDate}
                  maxDate={new Date()}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  dateFormat="yyyy-MM-dd"
                  placeholderText="End Date"
                />
                <button
                  onClick={fetchAnalytics}
                  disabled={!customStartDate || !customEndDate || loading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              </div>
            )}

            {filterPeriod && (
              <div className="ml-auto">
                <span className="text-sm text-gray-600 font-medium">{filterPeriod}</span>
              </div>
            )}
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

          {/* Most Active Day/Time Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-700 mb-4">Most Active Day of Week</h2>
              {activeDays.length > 0 ? (
                <div className="h-64">
                  <canvas ref={dayChartRef}></canvas>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-500">
                  {loading ? 'Loading...' : 'No day data available'}
                </div>
              )}
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-700 mb-4">Most Active Time Slots</h2>
              {activeTimes.length > 0 ? (
                <div className="h-64">
                  <canvas ref={timeChartRef}></canvas>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-500">
                  {loading ? 'Loading...' : 'No time data available'}
                </div>
              )}
            </div>
          </div>

          {/* Appointment Status Breakdown */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-8">
            <h2 className="text-lg font-bold text-gray-700 mb-3 text-center">Appointment Status Breakdown</h2>
            {statusBreakdown.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-48">
                  <canvas ref={statusChartRef}></canvas>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {statusBreakdown.map((item, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg text-center">
                      <div className="text-2xl font-bold mb-1" style={{ color: item.color }}>
                        {item.count}
                      </div>
                      <div className="text-xs text-gray-600 font-semibold">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-gray-500">
                {loading ? 'Loading...' : 'No status data available'}
              </div>
            )}
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