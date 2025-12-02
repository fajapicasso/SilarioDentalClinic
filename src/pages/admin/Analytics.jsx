import { useEffect, useState, useRef } from 'react';
import supabase from '../../config/supabaseClient';
import { FiUsers, FiCalendar, FiBarChart2, FiPrinter, FiCreditCard, FiRefreshCw, FiFilter } from 'react-icons/fi';
import { Chart, registerables } from 'chart.js';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
Chart.register(...registerables);

const AdminAnalytics = () => {
  const [branches, setBranches] = useState([]);
  const [metricsByBranch, setMetricsByBranch] = useState({});
  const [statusByBranch, setStatusByBranch] = useState({});
  const [revenueByMonthByBranch, setRevenueByMonthByBranch] = useState({});
  const [topServices, setTopServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState('');
  const [timeFilter, setTimeFilter] = useState('all'); // all, daily, weekly, monthly, yearly, custom
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [filterPeriod, setFilterPeriod] = useState('');
  // New analytics data
  const [activeDaysByBranch, setActiveDaysByBranch] = useState({}); // Day of week per branch
  const [activeTimesByBranch, setActiveTimesByBranch] = useState({}); // Time slots per branch
  const [genderDistribution, setGenderDistribution] = useState([]); // Overall gender distribution
  const [ageDistribution, setAgeDistribution] = useState([]); // Overall age distribution (minors vs adults)
  const [statusBreakdownByBranch, setStatusBreakdownByBranch] = useState({}); // Status breakdown per branch
  const revenueChartRefs = useRef({});
  const statusChartRefs = useRef({});
  const statusBreakdownChartRefs = useRef({}); // Status breakdown charts per branch
  const dayChartRefs = useRef({});
  const timeChartRefs = useRef({});
  const genderChartRef = useRef(null);
  const ageChartRef = useRef(null);
  const pieRef = useRef(null);
  const printRef = useRef(null);

  useEffect(() => {
    fetchBranches();
    fetchAnalytics();
  }, []);

  // Fetch analytics when filter changes
  useEffect(() => {
    if (timeFilter !== 'custom') {
      fetchAnalytics();
    }
  }, [timeFilter]);

  // Auto-refresh analytics periodically (only if not custom filter)
  useEffect(() => {
    if (timeFilter === 'custom') return;
    const intervalId = setInterval(() => {
      fetchAnalytics();
    }, 60000); // refresh every 60s
    return () => clearInterval(intervalId);
  }, [timeFilter]);

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
            type: 'line',
            data: {
              labels: series.map((a) => a.month),
              datasets: [{
                label: 'Revenue (₱)',
                data: series.map((a) => a.amount),
                borderColor: '#059669',
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#059669',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
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
          // Map status to colors (matching doctor side)
          const statusColors = {
            'Completed': '#22c55e',
            'Upcoming': '#3b82f6',
            'Cancelled': '#f59e0b',
            'Rejected': '#ef4444',
            'Pending': '#8b5cf6',
            'In Progress': '#06b6d4'
          };
          
          // Calculate total for percentage calculation
          const total = series.reduce((sum, item) => sum + item.count, 0);
          
          window[key] = new Chart(ctx, {
            type: 'doughnut',
            data: {
              labels: series.map((a) => {
                const percentage = total > 0 ? Math.round((a.count / total) * 100) : 0;
                return `${a.status} (${percentage}%)`;
              }),
              datasets: [{
                data: series.map((a) => a.count),
                backgroundColor: series.map((a) => statusColors[a.status] || '#94a3b8'),
                borderWidth: 0
              }],
            },
            options: {
              responsive: true,
              maintainAspectRatio: true,
              aspectRatio: 1.8,
              cutout: '70%',
              plugins: { 
                legend: { 
                  display: true,
                  position: 'right',
                  labels: { 
                    font: { size: 10 },
                    padding: 8,
                    usePointStyle: true
                  }
                },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      const label = context.label || '';
                      const value = context.parsed || 0;
                      const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                      return `${label}: ${value} (${percentage}%)`;
                    }
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

  // Render Active Days Charts per Branch
  useEffect(() => {
    const renderDayCharts = () => {
      Object.keys(activeDaysByBranch || {}).forEach((branch) => {
        const canvas = dayChartRefs.current[branch];
        const dayData = activeDaysByBranch[branch] || [];
        
        if (!canvas || dayData.length === 0 || loading) return;
        
        try {
          const key = `adminDayChart_${branch}`;
          if (window[key]) window[key].destroy();
          
          const ctx = canvas.getContext('2d');
          window[key] = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: dayData.map(d => d.day.substring(0, 3)),
              datasets: [{
                label: 'Appointments',
                data: dayData.map(d => d.count),
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
        } catch (error) {
          console.error(`📊 Error creating day chart for ${branch}:`, error);
        }
      });
    };

    if (Object.keys(activeDaysByBranch || {}).length > 0) {
      const timeoutId = setTimeout(() => {
        renderDayCharts();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      renderDayCharts();
    }
  }, [activeDaysByBranch, loading]);

  // Render Active Times Charts per Branch
  useEffect(() => {
    const renderTimeCharts = () => {
      Object.keys(activeTimesByBranch || {}).forEach((branch) => {
        const canvas = timeChartRefs.current[branch];
        const timeData = activeTimesByBranch[branch] || [];
        
        if (!canvas || timeData.length === 0 || loading) return;
        
        try {
          const key = `adminTimeChart_${branch}`;
          if (window[key]) window[key].destroy();
          
          const colors = [
            '#3b82f6', '#60a5fa', '#93c5fd', '#6366f1', '#818cf8',
            '#a78bfa', '#c084fc', '#d946ef', '#ec4899', '#f43f5e'
          ];
          
          const ctx = canvas.getContext('2d');
          window[key] = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: timeData.map(t => t.time),
              datasets: [{
                label: 'Appointments',
                data: timeData.map(t => t.count),
                backgroundColor: timeData.map((_, index) => colors[index % colors.length]),
                borderColor: timeData.map((_, index) => colors[index % colors.length]),
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
        } catch (error) {
          console.error(`📊 Error creating time chart for ${branch}:`, error);
        }
      });
    };

    if (Object.keys(activeTimesByBranch || {}).length > 0) {
      const timeoutId = setTimeout(() => {
        renderTimeCharts();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      renderTimeCharts();
    }
  }, [activeTimesByBranch, loading]);

  // Render Status Breakdown Charts per Branch
  useEffect(() => {
    const renderStatusBreakdownCharts = () => {
      Object.keys(statusBreakdownByBranch || {}).forEach((branch) => {
        const canvas = statusBreakdownChartRefs.current[branch];
        const statusData = statusBreakdownByBranch[branch] || [];
        
        if (!canvas || statusData.length === 0 || loading) return;
        
        try {
          const key = `adminStatusBreakdownChart_${branch}`;
          if (window[key]) window[key].destroy();
          
          // Calculate total for percentage calculation
          const total = statusData.reduce((sum, item) => sum + item.count, 0);
          
          const ctx = canvas.getContext('2d');
          window[key] = new Chart(ctx, {
            type: 'doughnut',
            data: {
              labels: statusData.map(s => {
                const percentage = total > 0 ? Math.round((s.count / total) * 100) : 0;
                return `${s.label} (${percentage}%)`;
              }),
              datasets: [{
                data: statusData.map(s => s.count),
                backgroundColor: statusData.map(s => s.color),
                borderWidth: 0
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: true,
              aspectRatio: 1.8,
              cutout: '70%',
              plugins: { 
                legend: { 
                  display: true, 
                  position: 'right',
                  labels: { 
                    font: { size: 10 },
                    padding: 8,
                    usePointStyle: true
                  }
                },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      const label = context.label || '';
                      const value = context.parsed || 0;
                      const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                      return `${label}: ${value} (${percentage}%)`;
                    }
                  }
                }
              }
            }
          });
          console.log(`📊 Status breakdown chart for ${branch} created successfully`);
        } catch (error) {
          console.error(`📊 Error creating status breakdown chart for ${branch}:`, error);
        }
      });
    };

    if (Object.keys(statusBreakdownByBranch || {}).length > 0) {
      const timeoutId = setTimeout(() => {
        renderStatusBreakdownCharts();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      renderStatusBreakdownCharts();
    }
  }, [statusBreakdownByBranch, loading]);

  // Render Gender Distribution Chart
  useEffect(() => {
    const renderGenderChart = () => {
      if (genderChartRef.current && genderDistribution.length > 0 && !loading) {
        try {
          const ctx = genderChartRef.current.getContext('2d');
          if (window.adminGenderChart) window.adminGenderChart.destroy();
          
          window.adminGenderChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
              labels: genderDistribution.map(g => g.label),
              datasets: [{
                data: genderDistribution.map(g => g.count),
                backgroundColor: genderDistribution.map(g => g.color),
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
          console.log('📊 Gender chart created successfully');
        } catch (error) {
          console.error('📊 Error creating gender chart:', error);
        }
      }
    };

    if (genderDistribution.length > 0) {
      const timeoutId = setTimeout(() => {
        renderGenderChart();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      renderGenderChart();
    }
  }, [genderDistribution, loading]);

  // Render Age Distribution Chart
  useEffect(() => {
    const renderAgeChart = () => {
      if (ageChartRef.current && ageDistribution.length > 0 && !loading) {
        try {
          const ctx = ageChartRef.current.getContext('2d');
          if (window.adminAgeChart) window.adminAgeChart.destroy();
          
          window.adminAgeChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
              labels: ageDistribution.map(a => a.label),
              datasets: [{
                data: ageDistribution.map(a => a.count),
                backgroundColor: ageDistribution.map(a => a.color),
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
          console.log('📊 Age chart created successfully');
        } catch (error) {
          console.error('📊 Error creating age chart:', error);
        }
      }
    };

    if (ageDistribution.length > 0) {
      const timeoutId = setTimeout(() => {
        renderAgeChart();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      renderAgeChart();
    }
  }, [ageDistribution, loading]);

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
    console.log('🚀 Starting admin analytics fetch...');
    
    // Clear existing data to force re-render
    setRevenueByMonthByBranch({});
    setStatusByBranch({});
    setTopServices([]);
    setActiveDaysByBranch({});
    setActiveTimesByBranch({});
    setStatusBreakdownByBranch({});
    setGenderDistribution([]);
    setAgeDistribution([]);
    
    let debugLog = `\n=== Analytics Fetch Started at ${new Date().toLocaleTimeString()} ===`;
    
    try {
      console.log('🚀 Starting analytics fetch for all branches');

      const dateRange = getDateRange();
      console.log('📅 Date range filter:', dateRange, 'timeFilter:', timeFilter);

      // 1. APPOINTMENTS DATA
      debugLog += '\n\n1. FETCHING APPOINTMENTS...';
      let appointmentQuery = supabase
        .from('appointments')
        .select('id, patient_id, status, appointment_date, appointment_time, branch');

      if (dateRange) {
        if (dateRange.isDaily) {
          appointmentQuery = appointmentQuery.eq('appointment_date', dateRange.date);
        } else if (dateRange.start && dateRange.end) {
          appointmentQuery = appointmentQuery
            .gte('appointment_date', dateRange.start)
            .lte('appointment_date', dateRange.end);
        }
      }
      
      const { data: appointmentData, error: appointmentError } = await appointmentQuery;
      
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
        
        // Calculate status breakdown per branch (like doctor side)
        const statusBreakdownMap = {};
        Object.keys(statusMap).forEach(b => {
          const statusCounts = {
            'completed': 0,
            'confirmed': 0,
            'cancelled': 0,
            'rejected': 0,
            'pending': 0
          };
          Object.entries(statusMap[b]).forEach(([status, count]) => {
            const statusLower = status.toLowerCase();
            if (statusCounts.hasOwnProperty(statusLower)) {
              statusCounts[statusLower] = count;
            } else {
              statusCounts['pending'] += count;
            }
          });
          statusBreakdownMap[b] = [
            { label: 'Completed', count: statusCounts.completed, color: '#22c55e' },
            { label: 'Upcoming', count: statusCounts.confirmed, color: '#3b82f6' },
            { label: 'Cancelled', count: statusCounts.cancelled, color: '#f59e0b' },
            { label: 'Rejected', count: statusCounts.rejected, color: '#ef4444' }
          ];
        });
        setStatusBreakdownByBranch(statusBreakdownMap);
        
        window.__apptsByPatientDate = apptsByPatientDate;

        // NEW ANALYTICS: Most Active Day of Week and Time Slots per Branch
        const activeDaysMap = {};
        const activeTimesMap = {};
        
        (appointmentData || []).forEach(a => {
          const b = a.branch || 'Unknown';
          
          // Most Active Day of Week
          if (a.appointment_date) {
            if (!activeDaysMap[b]) {
              activeDaysMap[b] = {
                'Sunday': 0, 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0,
                'Thursday': 0, 'Friday': 0, 'Saturday': 0
              };
            }
            const date = new Date(a.appointment_date);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
            activeDaysMap[b][dayName] = (activeDaysMap[b][dayName] || 0) + 1;
          }
          
          // Most Active Time Slots (8AM-5PM only)
          if (a.appointment_time) {
            if (!activeTimesMap[b]) {
              activeTimesMap[b] = {};
              for (let hour = 8; hour <= 17; hour++) {
                const hourLabel = hour < 12 ? `${hour}AM` : hour === 12 ? '12PM' : `${hour - 12}PM`;
                activeTimesMap[b][hourLabel] = 0;
              }
            }
            const timeParts = a.appointment_time.split(':');
            const hour = parseInt(timeParts[0]);
            if (hour >= 8 && hour <= 17) {
              const hourLabel = hour < 12 ? `${hour}AM` : hour === 12 ? '12PM' : `${hour - 12}PM`;
              if (activeTimesMap[b].hasOwnProperty(hourLabel)) {
                activeTimesMap[b][hourLabel]++;
              }
            }
          }
        });
        
        // Convert to arrays and sort
        const activeDaysByBranchFormatted = {};
        const activeTimesByBranchFormatted = {};
        
        Object.keys(activeDaysMap).forEach(branch => {
          const dayData = Object.entries(activeDaysMap[branch])
            .map(([day, count]) => ({ day, count }))
            .sort((a, b) => {
              const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
              return dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
            });
          activeDaysByBranchFormatted[branch] = dayData;
        });
        
        Object.keys(activeTimesMap).forEach(branch => {
          const timeData = Object.entries(activeTimesMap[branch])
            .filter(([_, count]) => count > 0)
            .map(([time, count]) => {
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
          activeTimesByBranchFormatted[branch] = timeData;
        });
        
        setActiveDaysByBranch(activeDaysByBranchFormatted);
        setActiveTimesByBranch(activeTimesByBranchFormatted);
        console.log('📊 Active days by branch:', activeDaysByBranchFormatted);
        console.log('📊 Active times by branch:', activeTimesByBranchFormatted);
      }
      
      // NEW ANALYTICS: Overall Gender Distribution and Age Distribution (All Branches)
      // Fetch ALL patients (not just those with appointments in filtered period) for demographics
      console.log('🔍 Fetching ALL patients for demographics...');
      const { data: allPatientData, error: patientError } = await supabase
        .from('profiles')
        .select('id, gender, guardian_id, age, birthday')
        .eq('role', 'patient')
        .neq('disabled', true);
      
      if (patientError) {
        console.error('❌ Error fetching patients:', patientError);
      } else {
        console.log('✅ Fetched', allPatientData?.length || 0, 'total patients');
        
        // Use Map to ensure each patient is counted only once
        const patientMap = new Map();
        if (allPatientData) {
          allPatientData.forEach(patient => {
            // Only add if not already in map (handles duplicates)
            if (!patientMap.has(patient.id)) {
              patientMap.set(patient.id, patient);
            }
          });
        }
        
        // Debug: Log all patient genders to see what we're working with
        console.log('🔍 Total unique patients:', patientMap.size);
        console.log('🔍 All patient genders:', Array.from(patientMap.values()).map(p => ({ 
          id: p.id, 
          gender: p.gender, 
          age: p.age,
          birthday: p.birthday,
          guardian_id: p.guardian_id,
          normalized: p.gender ? String(p.gender).toLowerCase().trim() : 'empty'
        })));
        
        // Count gender distribution (each patient counted once) - Only Male and Female
        const genderCounts = { male: 0, female: 0 };
        const ageCounts = { minors: 0, adults: 0 };
        
        patientMap.forEach(patient => {
          // Gender distribution - only count Male and Female
          // Handle various gender value formats (case-insensitive, with/without whitespace)
          const rawGender = patient.gender;
          const gender = rawGender ? String(rawGender).toLowerCase().trim() : '';
          
          // More flexible matching to catch variations - check if contains 'male' or 'female'
          const genderLower = gender.toLowerCase();
          if (genderLower.includes('male') && !genderLower.includes('female')) {
            genderCounts.male++;
            console.log('✅ Counted as Male:', rawGender, 'for patient:', patient.id);
          } else if (genderLower.includes('female') || genderLower === 'f' || genderLower === 'fem') {
            genderCounts.female++;
            console.log('✅ Counted as Female:', rawGender, 'for patient:', patient.id);
          } else if (gender) {
            // Log any unhandled gender values for debugging
            console.log('⚠️ Unhandled gender value:', rawGender, '(normalized:', gender, ') for patient:', patient.id);
          } else {
            console.log('⚠️ Empty/null gender for patient:', patient.id);
          }
          // Ignore any other gender values
          
          // Age distribution - check if minor (has guardian_id OR age < 18 OR calculated age < 18)
          let calculatedAge = null;
          if (patient.birthday) {
            const today = new Date();
            const birthDate = new Date(patient.birthday);
            calculatedAge = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
              calculatedAge--;
            }
          }
          
          // Determine if minor: has guardian OR age field < 18 OR calculated age < 18
          const isMinor = patient.guardian_id !== null || 
                         (patient.age !== null && patient.age < 18) ||
                         (calculatedAge !== null && calculatedAge < 18);
          
          if (isMinor) {
            ageCounts.minors++;
            console.log('✅ Counted as Minor - age:', patient.age, 'calculated:', calculatedAge, 'guardian_id:', patient.guardian_id, 'patient:', patient.id);
          } else {
            ageCounts.adults++;
            console.log('✅ Counted as Adult - age:', patient.age, 'calculated:', calculatedAge, 'guardian_id:', patient.guardian_id, 'patient:', patient.id);
          }
        });
        
        const genderData = [
          { label: 'Male', count: genderCounts.male, color: '#3b82f6' },
          { label: 'Female', count: genderCounts.female, color: '#ec4899' }
        ];
        setGenderDistribution(genderData);
        console.log('📊 Overall gender distribution:', genderData);
        
        const ageData = [
          { label: 'Minors', count: ageCounts.minors, color: '#f59e0b' },
          { label: 'Adults', count: ageCounts.adults, color: '#10b981' }
        ];
        setAgeDistribution(ageData);
        console.log('📊 Overall age distribution:', ageData);
      }

      // 2. REVENUE DATA (map to branch)
      debugLog += '\n\n2. FETCHING PAYMENTS...';
      let paymentQuery = supabase
        .from('payments')
        .select('id, invoice_id, amount, approval_status, payment_date, created_at');

      // Note: Payment filtering is done after fetch since we need to check both payment_date and created_at
      const { data: paymentData, error: paymentError } = await paymentQuery;
      
      // Filter payments by date range if specified
      let filteredPaymentData = paymentData;
      if (dateRange && paymentData) {
        if (dateRange.isDaily) {
          filteredPaymentData = paymentData.filter(p => {
            const paymentDate = p.payment_date || p.created_at;
            if (!paymentDate) return false;
            const dateStr = new Date(paymentDate).toISOString().split('T')[0];
            return dateStr === dateRange.date;
          });
        } else if (dateRange.start && dateRange.end) {
          filteredPaymentData = paymentData.filter(p => {
            const paymentDate = p.payment_date || p.created_at;
            if (!paymentDate) return false;
            const dateStr = new Date(paymentDate).toISOString().split('T')[0];
            return dateStr >= dateRange.start && dateStr <= dateRange.end;
          });
        }
      }

      if (paymentError) {
        console.error('❌ Payment fetch error:', paymentError);
        debugLog += `\nPayment Error: ${paymentError.message}`;
      } else {
        if (filteredPaymentData && filteredPaymentData.length > 0) {
          const approved = filteredPaymentData.filter(p => p.approval_status === 'approved');
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
      const appointmentIds = (appointmentData || []).map(a => a.id);
      let appointmentServicesQuery = supabase
        .from('appointment_services')
        .select(`
          appointment_id,
          service_id,
          services (id, name, category),
          appointments:appointment_id (branch)
        `);

      if (appointmentIds.length > 0) {
        appointmentServicesQuery = appointmentServicesQuery.in('appointment_id', appointmentIds);
      } else {
        // If no appointments match the filter, set empty services
        setTopServices([]);
        debugLog += '\nNo appointments match filter, skipping services fetch';
      }
      
      const { data: appointmentServices, error: servicesError } = appointmentIds.length > 0 
        ? await appointmentServicesQuery 
        : { data: [], error: null };
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

  const handlePrint = async () => {
    if (!printRef.current) return;

    // Convert all charts to images
    const chartImages = {};
    
    // Convert revenue charts for each branch
    Object.keys(revenueByMonthByBranch || {}).forEach((branch) => {
      const chartKey = `adminRevenueChart_${branch}`;
      if (window[chartKey]) {
        chartImages[`revenue_${branch}`] = window[chartKey].toBase64Image();
      }
    });
    
    // Convert status charts for each branch
    Object.keys(statusByBranch || {}).forEach((branch) => {
      const chartKey = `adminStatusChart_${branch}`;
      if (window[chartKey]) {
        chartImages[`status_${branch}`] = window[chartKey].toBase64Image();
      }
    });
    
    // Convert status breakdown charts for each branch
    Object.keys(statusBreakdownByBranch || {}).forEach((branch) => {
      const chartKey = `adminStatusBreakdownChart_${branch}`;
      if (window[chartKey]) {
        chartImages[`statusBreakdown_${branch}`] = window[chartKey].toBase64Image();
      }
    });
    
    // Convert day charts for each branch
    Object.keys(activeDaysByBranch || {}).forEach((branch) => {
      const chartKey = `adminDayChart_${branch}`;
      if (window[chartKey]) {
        chartImages[`day_${branch}`] = window[chartKey].toBase64Image();
      }
    });
    
    // Convert time charts for each branch
    Object.keys(activeTimesByBranch || {}).forEach((branch) => {
      const chartKey = `adminTimeChart_${branch}`;
      if (window[chartKey]) {
        chartImages[`time_${branch}`] = window[chartKey].toBase64Image();
      }
    });
    
    // Convert pie chart
    if (window.adminPieChart) {
      chartImages.pieChart = window.adminPieChart.toBase64Image();
    }
    
    // Convert gender chart
    if (window.adminGenderChart) {
      chartImages.genderChart = window.adminGenderChart.toBase64Image();
    }
    
    // Convert age chart
    if (window.adminAgeChart) {
      chartImages.ageChart = window.adminAgeChart.toBase64Image();
    }

    // Use logo path
    const logoPath = `${window.location.origin}/src/assets/Logo.png`;
    const periodInfo = filterPeriod || 'All Time Report';

    // Build print HTML with all branch data
    let printHTML = '';
    
    // Check if we have San Juan or Cabuyao branches for compact layout
    const compactBranches = ['San Juan', 'Cabuyao', 'Cabuigao', 'Cabugao'];
    const hasCompactBranch = branches.some(b => compactBranches.includes(b));
    
    branches.forEach((branch) => {
      const m = metricsByBranch[branch] || { patients: 0, appointments: 0, revenue: 0, efficiency: 0 };
      const statusRows = statusByBranch[branch] || [];
      const revSeries = revenueByMonthByBranch[branch] || [];
      const revenueChartImg = chartImages[`revenue_${branch}`];
      const statusChartImg = chartImages[`status_${branch}`];
      const statusBreakdownChartImg = chartImages[`statusBreakdown_${branch}`];
      const dayChartImg = chartImages[`day_${branch}`];
      const timeChartImg = chartImages[`time_${branch}`];
      const activeDays = activeDaysByBranch[branch] || [];
      const activeTimes = activeTimesByBranch[branch] || [];
      const statusBreakdown = statusBreakdownByBranch[branch] || [];
      
      const totalStatusCount = statusRows.reduce((sum, s) => sum + s.count, 0);
      const isCompact = compactBranches.includes(branch);
      
      // Use optimized single-page styles for San Juan and Cabuyao
      const sectionClass = isCompact ? 'branch-section compact-branch' : 'branch-section';
      const pageBreakStyle = isCompact ? '' : 'page-break-before: always;';
      const marginTop = isCompact ? '10px' : '20px';
      const chartMaxHeight = isCompact ? '140px' : '160px';
      const statusBreakdownMaxWidth = isCompact ? '220px' : '300px';
      
      printHTML += `
        <div class="${sectionClass}">
          <h2 class="branch-title">Branch: ${branch}</h2>
          <div class="metrics-grid ${isCompact ? 'compact-metrics' : ''}">
            <div class="metric-card">
              <div class="metric-label">Total Patients</div>
              <div class="metric-value">${m.patients}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Total Appointments</div>
              <div class="metric-value">${m.appointments}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Total Revenue</div>
              <div class="metric-value">₱${m.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Completion Rate</div>
              <div class="metric-value">${m.efficiency}%</div>
            </div>
          </div>
          
          <div class="charts-grid ${isCompact ? 'compact-charts' : ''}">
            <div class="chart-container">
              <h3>Revenue by Month</h3>
              ${revenueChartImg ? `<img src="${revenueChartImg}" alt="Revenue Chart - ${branch}" style="max-height: ${chartMaxHeight};" />` : '<p style="font-size: 9px; color: #999; text-align: center; padding: 10px;">No revenue data available</p>'}
            </div>
            <div class="chart-container">
              <h3>Appointments by Status</h3>
              ${statusChartImg ? `<img src="${statusChartImg}" alt="Status Chart - ${branch}" style="max-height: ${chartMaxHeight};" />` : '<p style="font-size: 9px; color: #999; text-align: center; padding: 10px;">No status data available</p>'}
            </div>
          </div>
          
          <div class="charts-grid ${isCompact ? 'compact-charts' : ''}">
            <div class="chart-container">
              <h3>Most Active Day of Week</h3>
              ${dayChartImg ? `<img src="${dayChartImg}" alt="Active Days Chart - ${branch}" style="max-height: ${chartMaxHeight};" />` : '<p style="font-size: 9px; color: #999; text-align: center; padding: 10px;">No day data available</p>'}
            </div>
            <div class="chart-container">
              <h3>Most Active Time Slots</h3>
              ${timeChartImg ? `<img src="${timeChartImg}" alt="Active Times Chart - ${branch}" style="max-height: ${chartMaxHeight};" />` : '<p style="font-size: 9px; color: #999; text-align: center; padding: 10px;">No time data available</p>'}
            </div>
          </div>
          
          <div class="status-breakdown-section" style="${pageBreakStyle} margin-top: ${marginTop};">
            <h3>Appointment Status Breakdown</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: ${isCompact ? '10px' : '10px'};">
              <div class="status-chart-wrapper">
                ${statusBreakdownChartImg ? `<img src="${statusBreakdownChartImg}" alt="Status Breakdown Chart - ${branch}" style="width: 100%; height: auto; max-width: ${statusBreakdownMaxWidth};" />` : '<p style="font-size: 9px; color: #999; text-align: center; padding: 10px;">No data available</p>'}
              </div>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: ${isCompact ? '8px' : '6px'}; font-size: ${isCompact ? '9px' : '9px'};">
                ${statusBreakdown.map(item => `
                  <div style="text-align: center; padding: ${isCompact ? '8px' : '6px'}; background: #f9fafb; border-radius: 4px;">
                    <div style="font-weight: bold; color: ${item.color}; font-size: ${isCompact ? '16px' : '14px'};">
                      ${item.count}
                    </div>
                    <div style="color: #666; font-weight: 600; font-size: ${isCompact ? '9px' : '8px'};">
                      ${item.label}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
          
          <div class="status-table-container" style="margin-top: ${isCompact ? '10px' : '15px'};">
            <h3>Appointment Status Details</h3>
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Count</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                ${statusRows.map(row => {
                  const percentage = totalStatusCount > 0 ? Math.round((row.count / totalStatusCount) * 100) : 0;
                  return `
                    <tr>
                      <td>${row.status}</td>
                      <td>${row.count}</td>
                      <td>${percentage}%</td>
                    </tr>
                  `;
                }).join('')}
                ${statusRows.length === 0 ? '<tr><td colspan="3" style="text-align: center; color: #999;">No status data available</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>
      `;
    });
    
    // Add All Branches Overview section (Gender Distribution + Age Distribution + Top Services)
    printHTML += `
      <div class="services-section">
        <h2 class="section-title">All Branches Overview</h2>
        <div class="services-grid" style="grid-template-columns: repeat(3, 1fr);">
          <div class="chart-container">
            <h3>Gender Distribution (All Branches)</h3>
            ${chartImages.genderChart ? `<img src="${chartImages.genderChart}" alt="Gender Distribution Chart" />` : '<p style="font-size: 9px; color: #999; text-align: center; padding: 20px;">No gender data available</p>'}
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 10px; font-size: 9px;">
              ${genderDistribution.map(item => `
                <div style="text-align: center; padding: 5px; background: #f9fafb; border-radius: 4px;">
                  <div style="font-weight: bold; color: ${item.color}; font-size: 14px;">${item.count}</div>
                  <div style="color: #666;">${item.label}</div>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="chart-container">
            <h3>Age Distribution (All Branches)</h3>
            ${chartImages.ageChart ? `<img src="${chartImages.ageChart}" alt="Age Distribution Chart" />` : '<p style="font-size: 9px; color: #999; text-align: center; padding: 20px;">No age data available</p>'}
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 10px; font-size: 9px;">
              ${ageDistribution.map(item => `
                <div style="text-align: center; padding: 5px; background: #f9fafb; border-radius: 4px;">
                  <div style="font-weight: bold; color: ${item.color}; font-size: 14px;">${item.count}</div>
                  <div style="color: #666;">${item.label}</div>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="chart-container">
            <h3>Top Services Distribution</h3>
            ${chartImages.pieChart ? `<img src="${chartImages.pieChart}" alt="Top Services Chart" />` : '<p style="font-size: 9px; color: #999; text-align: center; padding: 20px;">No services data available</p>'}
          </div>
        </div>
        <div class="table-container" style="margin-top: 15px;">
          <h3>Top Services List</h3>
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              ${topServices.map(service => `
                <tr>
                  <td>${service.name}</td>
                  <td>${service.count}</td>
                </tr>
              `).join('')}
              ${topServices.length === 0 ? '<tr><td colspan="2" style="text-align: center; color: #999;">No services data available</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const win = window.open('', '', 'width=1200,height=800');
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Admin Analytics Report - ${new Date().toLocaleDateString()}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { 
              font-family: 'Arial', sans-serif; 
              padding: 20px;
              font-size: 11px;
              line-height: 1.4;
              color: #333;
            }
            body.compact-print {
              padding: 12px;
              font-size: 10px;
              line-height: 1.3;
            }
            .no-print { display: none !important; }
            
            .print-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 20px;
              border-bottom: 3px solid #059669;
              padding-bottom: 15px;
            }
            body.compact-print .print-header {
              margin-bottom: 8px;
              padding-bottom: 8px;
              border-bottom-width: 2px;
            }
            body.compact-print .print-header-left {
              gap: 10px;
            }
            body.compact-print .print-header-logo {
              width: 50px;
              height: 50px;
            }
            body.compact-print .print-header-clinic-name {
              font-size: 16px;
              margin-bottom: 2px;
            }
            body.compact-print .print-header-clinic-subtitle {
              font-size: 10px;
            }
            body.compact-print .print-header-right h1 {
              font-size: 18px;
              margin-bottom: 4px;
            }
            body.compact-print .print-header-right .period {
              font-size: 10px;
              margin-top: 2px;
            }
            body.compact-print .print-header-right .date {
              font-size: 9px;
              margin-top: 2px;
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
              color: #059669;
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
            
            .branch-section {
              margin-bottom: 30px;
              page-break-inside: avoid;
            }
            .branch-section.compact-branch {
              margin-bottom: 8px;
            }
            .branch-title {
              font-size: 20px;
              font-weight: bold;
              color: #333;
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 2px solid #e5e7eb;
            }
            .compact-branch .branch-title {
              font-size: 16px;
              margin-bottom: 8px;
              padding-bottom: 6px;
              border-bottom-width: 2px;
            }
            
            .metrics-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
              margin-bottom: 20px;
            }
            .metrics-grid.compact-metrics {
              gap: 8px;
              margin-bottom: 10px;
            }
            .metric-card {
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              padding: 12px;
              text-align: center;
              background: #f8fafc;
            }
            .compact-branch .metric-card {
              padding: 10px;
              border-width: 2px;
              border-radius: 6px;
            }
            .metric-value {
              font-size: 22px;
              font-weight: bold;
              margin: 8px 0;
              color: #1f2937;
            }
            .compact-branch .metric-value {
              font-size: 20px;
              margin: 6px 0;
            }
            .metric-label {
              font-size: 10px;
              color: #6b7280;
              text-transform: uppercase;
              font-weight: 600;
              letter-spacing: 0.5px;
            }
            .compact-branch .metric-label {
              font-size: 9px;
              letter-spacing: 0.3px;
            }
            
            .charts-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
              margin-bottom: 20px;
            }
            .charts-grid.compact-charts {
              gap: 10px;
              margin-bottom: 10px;
            }
            .chart-container {
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              padding: 12px;
              background: white;
            }
            .compact-branch .chart-container {
              padding: 8px;
              border-width: 2px;
              border-radius: 6px;
            }
            .chart-container h3 {
              font-size: 12px;
              font-weight: bold;
              margin-bottom: 8px;
              color: #333;
              text-align: center;
            }
            .compact-branch .chart-container h3 {
              font-size: 11px;
              margin-bottom: 6px;
            }
            .chart-container img {
              width: 100%;
              height: auto;
              max-height: 160px;
              display: block;
              margin: 0 auto;
            }
            .compact-branch .chart-container img {
              max-height: 140px;
            }
            
            .status-table-container {
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              overflow: hidden;
              background: white;
              margin-bottom: 20px;
            }
            .compact-branch .status-table-container {
              border-width: 2px;
              margin-bottom: 8px;
              border-radius: 6px;
            }
            .status-table-container h3 {
              font-size: 12px;
              font-weight: bold;
              padding: 10px 12px;
              background: #f3f4f6;
              border-bottom: 2px solid #e5e7eb;
              color: #333;
            }
            .compact-branch .status-table-container h3 {
              font-size: 11px;
              padding: 8px 10px;
              border-bottom-width: 2px;
            }
            .status-table-container table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10px;
            }
            .compact-branch .status-table-container table {
              font-size: 10px;
            }
            .status-table-container th {
              background: #f9fafb;
              padding: 8px 12px;
              text-align: left;
              font-weight: 600;
              color: #374151;
              border-bottom: 2px solid #e5e7eb;
              font-size: 10px;
            }
            .compact-branch .status-table-container th {
              padding: 6px 10px;
              font-size: 10px;
              border-bottom-width: 2px;
            }
            .status-table-container td {
              padding: 8px 12px;
              border-bottom: 1px solid #f3f4f6;
              font-size: 10px;
            }
            .compact-branch .status-table-container td {
              padding: 6px 10px;
              font-size: 10px;
            }
            .status-table-container tr:last-child td {
              border-bottom: none;
            }
            .status-breakdown-section h3 {
              font-size: 12px;
              font-weight: bold;
              margin-bottom: 8px;
              color: #333;
            }
            .compact-branch .status-breakdown-section h3 {
              font-size: 11px;
              margin-bottom: 6px;
            }
            
            .services-section {
              margin-top: 30px;
              page-break-inside: avoid;
            }
            .section-title {
              font-size: 18px;
              font-weight: bold;
              color: #333;
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 2px solid #e5e7eb;
            }
            .services-grid {
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
            .table-container table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10px;
            }
            .table-container th {
              background: #f9fafb;
              padding: 8px 12px;
              text-align: left;
              font-weight: 600;
              color: #374151;
              border-bottom: 2px solid #e5e7eb;
              font-size: 10px;
            }
            .table-container td {
              padding: 8px 12px;
              border-bottom: 1px solid #f3f4f6;
              font-size: 10px;
            }
            .table-container tr:last-child td {
              border-bottom: none;
            }
            
            @media print {
              @page { 
                margin: 0.4in; 
                size: A4;
              }
              body.compact-print {
                padding: 0;
                font-size: 10px;
              }
              body {
                padding: 0;
                font-size: 10px;
              }
              .print-header {
                page-break-after: avoid;
                margin-bottom: 18px;
              }
              body.compact-print .print-header {
                margin-bottom: 6px;
                padding-bottom: 6px;
              }
              .branch-section {
                page-break-inside: avoid;
                margin-bottom: 25px;
              }
              body.compact-print .branch-section.compact-branch {
                page-break-inside: avoid;
                page-break-after: auto;
                margin-bottom: 0;
              }
              .status-breakdown-section {
                page-break-inside: avoid;
              }
              body.compact-print .status-breakdown-section {
                margin-top: 8px !important;
              }
              .services-section {
                page-break-inside: avoid;
              }
              .metrics-grid {
                page-break-inside: avoid;
                margin-bottom: 18px;
              }
              body.compact-print .metrics-grid.compact-metrics {
                margin-bottom: 8px;
              }
              .charts-grid {
                page-break-inside: avoid;
                margin-bottom: 18px;
              }
              body.compact-print .charts-grid.compact-charts {
                margin-bottom: 8px;
              }
              body.compact-print .status-table-container {
                margin-bottom: 0 !important;
              }
            }
          </style>
        </head>
        <body class="${hasCompactBranch ? 'compact-print' : ''}">
          <div class="print-header">
            <div class="print-header-left">
              <img src="${logoPath}" alt="Silario Dental Clinic Logo" class="print-header-logo" />
              <div class="print-header-clinic">
                <div class="print-header-clinic-name">SILARIO DENTAL CLINIC</div>
                <div class="print-header-clinic-subtitle">Elaine Mae Frando Silario D.M.D</div>
              </div>
            </div>
            <div class="print-header-right">
              <h1>Admin Analytics Report</h1>
              <div class="period">${periodInfo}</div>
              <div class="date">Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</div>
            </div>
          </div>
          ${printHTML}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-green-700">Admin Analytics</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={handlePrint}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
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
            <FiFilter className="h-5 w-5 text-green-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-700">Report Filters</h2>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Time Period:</label>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  dateFormat="yyyy-MM-dd"
                  placeholderText="End Date"
                />
                <button
                  onClick={fetchAnalytics}
                  disabled={!customStartDate || !customEndDate || loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
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

                    {/* Most Active Day/Time Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-lg font-bold text-gray-700 mb-4">Most Active Day of Week</h2>
                        {activeDaysByBranch[b] && activeDaysByBranch[b].length > 0 ? (
                          <div className="h-64">
                            <canvas ref={(el) => (dayChartRefs.current[b] = el)}></canvas>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-48 text-gray-500">
                            {loading ? 'Loading...' : 'No day data available'}
                          </div>
                        )}
                      </div>
                      <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-lg font-bold text-gray-700 mb-4">Most Active Time Slots</h2>
                        {activeTimesByBranch[b] && activeTimesByBranch[b].length > 0 ? (
                          <div className="h-64">
                            <canvas ref={(el) => (timeChartRefs.current[b] = el)}></canvas>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-48 text-gray-500">
                            {loading ? 'Loading...' : 'No time data available'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Appointment Status Breakdown Section */}
                    <div className="bg-white rounded-lg shadow-md p-4 mb-8">
                      <h2 className="text-lg font-bold text-gray-700 mb-3 text-center">Appointment Status Breakdown</h2>
                      {statusBreakdownByBranch[b] && statusBreakdownByBranch[b].length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="h-48">
                            <canvas ref={(el) => (statusBreakdownChartRefs.current[b] = el)}></canvas>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {statusBreakdownByBranch[b].map((item, index) => (
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
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">All Branches Overview</h2>
                
                {/* Gender and Age Distribution Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-lg font-bold text-gray-700 mb-4">Gender Distribution (All Branches)</h2>
                    {genderDistribution.length > 0 ? (
                      <>
                        <div className="h-64 mb-4">
                          <canvas ref={genderChartRef}></canvas>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-center">
                          {genderDistribution.map((item, index) => (
                            <div key={index} className="p-3 bg-gray-50 rounded-lg">
                              <div className="text-2xl font-bold" style={{ color: item.color }}>
                                {item.count}
                              </div>
                              <div className="text-sm text-gray-600">{item.label}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-48 text-gray-500">
                        {loading ? 'Loading...' : 'No gender data available'}
                      </div>
                    )}
                  </div>
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-lg font-bold text-gray-700 mb-4">Age Distribution (All Branches)</h2>
                    {ageDistribution.length > 0 ? (
                      <>
                        <div className="h-64 mb-4">
                          <canvas ref={ageChartRef}></canvas>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-center">
                          {ageDistribution.map((item, index) => (
                            <div key={index} className="p-3 bg-gray-50 rounded-lg">
                              <div className="text-2xl font-bold" style={{ color: item.color }}>
                                {item.count}
                              </div>
                              <div className="text-sm text-gray-600">{item.label}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-48 text-gray-500">
                        {loading ? 'Loading...' : 'No age data available'}
                      </div>
                    )}
                  </div>
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-lg font-bold text-gray-700 mb-4">Top Services</h2>
                    {topServices.length > 0 ? (
                      <div className="h-64">
                        <canvas ref={pieRef}></canvas>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-48 text-gray-500">No service data available</div>
                    )}
                  </div>
                </div>
                
                {/* Top Services Table */}
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
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;