// src/components/patient/PatientAnalytics.jsx
import { useState, useEffect, useRef } from 'react';
import { FiBarChart2, FiPieChart, FiTrendingUp, FiRefreshCw, FiMapPin, FiUser, FiCalendar, FiFilter, FiPrinter, FiDownload } from 'react-icons/fi';
import { Chart } from 'chart.js/auto';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import jsPDF from 'jspdf';
import supabase from '../../config/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../common/LoadingSpinner';

const PatientAnalytics = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('appointments');
  const [timeFilter, setTimeFilter] = useState('all'); // all, daily, weekly, monthly, yearly, custom
  const [loading, setLoading] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);

  // Chart refs
  const appointmentTrendRef = useRef(null);
  const appointmentComparisonRef = useRef(null);
  const treatmentCountRef = useRef(null);
  const treatmentPieRef = useRef(null);
  const branchUsageRef = useRef(null);
  const branchTrendRef = useRef(null);

  // Analytics data
  const [appointmentMetrics, setAppointmentMetrics] = useState({
    total: 0,
    completed: 0,
    cancelled: 0,
    trend: [],
    avgTimeBetween: 0
  });

  const [treatmentMetrics, setTreatmentMetrics] = useState({
    mostCommon: [],
    countByTimeframe: [],
    dentistFrequency: []
  });

  const [branchMetrics, setBranchMetrics] = useState({
    visitsPerBranch: {},
    branchTrend: []
  });

  useEffect(() => {
    if (user) {
      // Only auto-fetch if not custom date range (custom requires manual Apply)
      if (timeFilter !== 'custom') {
        console.log('Filter changed, fetching analytics for tab:', activeTab, 'with filter:', timeFilter);
        fetchAnalytics();
      }
    }
  }, [user, timeFilter, activeTab]);

  useEffect(() => {
    // Add delay to ensure DOM is ready before rendering charts
    const timeoutId = setTimeout(() => {
      // Always render all charts when data is available (not just for active tab)
      // This ensures charts are ready for printing even if their tab isn't active
      if (appointmentMetrics.trend.length > 0) {
        renderAppointmentCharts();
      }
      if (treatmentMetrics.countByTimeframe.length > 0) {
        renderTreatmentCharts();
      }
      if (branchMetrics.branchTrend.length > 0) {
        renderBranchCharts();
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      // Only cleanup charts when component unmounts, not on tab change
      // This allows all charts to remain rendered for printing
    };
  }, [appointmentMetrics, treatmentMetrics, branchMetrics]);

  const getDateRange = () => {
    const now = new Date();
    // Create date in local timezone to avoid timezone issues
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Helper function to format date as YYYY-MM-DD
    const formatDate = (date) => {
      if (!date) return null;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    switch (timeFilter) {
      case 'daily':
        // Today only - return single date for .eq() query
        const todayFormatted = formatDate(today);
        console.log('Daily filter - Today:', todayFormatted);
        return {
          date: todayFormatted,
          isDaily: true // Flag to use .eq() instead of range
        };
      case 'weekly':
        // Week starting from Sunday to Saturday
        const weekStart = new Date(today);
        const dayOfWeek = weekStart.getDay(); // 0 = Sunday, 1 = Monday, etc.
        weekStart.setDate(weekStart.getDate() - dayOfWeek); // Go to Sunday
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6); // 6 days later (Sunday to Saturday inclusive)
        const weekStartFormatted = formatDate(weekStart);
        const weekEndFormatted = formatDate(weekEnd);
        console.log('Weekly filter - Week:', weekStartFormatted, 'to', weekEndFormatted);
        return {
          start: weekStartFormatted,
          end: weekEndFormatted
        };
      case 'monthly':
        // Current month - include all days of the month
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of current month (day 0 of next month)
        const monthStartFormatted = formatDate(monthStart);
        const monthEndFormatted = formatDate(monthEnd);
        console.log('Monthly filter - Month:', monthStartFormatted, 'to', monthEndFormatted);
        return {
          start: monthStartFormatted,
          end: monthEndFormatted
        };
      case 'yearly':
        // Current year
        const yearStart = new Date(today.getFullYear(), 0, 1);
        const yearEnd = new Date(today.getFullYear(), 11, 31); // December 31 of current year
        return {
          start: formatDate(yearStart),
          end: formatDate(yearEnd)
        };
      case 'custom':
        // Custom date range
        if (customStartDate && customEndDate) {
          return {
            start: formatDate(customStartDate),
            end: formatDate(customEndDate)
          };
        }
        return null;
      case 'all':
        // Return null to fetch all data without date filtering
        return null;
      default:
        return null;
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      console.log('fetchAnalytics called for tab:', activeTab, 'with filter:', timeFilter);
      if (activeTab === 'appointments') {
        await fetchAppointmentAnalytics();
      } else if (activeTab === 'treatments') {
        await fetchTreatmentAnalytics();
      } else if (activeTab === 'branch') {
        await fetchBranchAnalytics();
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointmentAnalytics = async () => {
    try {
      const dateRange = getDateRange();
      console.log('Fetching appointment analytics with date range:', dateRange, 'timeFilter:', timeFilter);
      
      let query = supabase
        .from('appointments')
        .select('id, appointment_date, status, created_at')
        .eq('patient_id', user.id);

      if (dateRange) {
        if (dateRange.isDaily) {
          // For daily, use .eq() to match exactly today
          console.log('Appointment daily filter applied (exact match):', dateRange.date);
          query = query.eq('appointment_date', dateRange.date);
        } else if (dateRange.start && dateRange.end) {
          console.log('Appointment date range filter applied:', { start: dateRange.start, end: dateRange.end });
          query = query
            .gte('appointment_date', dateRange.start)
            .lte('appointment_date', dateRange.end); // Use lte to include end date
        }
      }

      const { data, error } = await query;
      console.log('Appointment query executed. Records found:', data?.length || 0);
      if (error) {
        console.error('Appointment analytics query error:', error);
        throw error;
      }
      
      console.log('Appointment analytics data fetched:', data?.length || 0, 'records');

      if (!data || data.length === 0) {
        setAppointmentMetrics({
          total: 0,
          completed: 0,
          cancelled: 0,
          trend: [],
          avgTimeBetween: 0
        });
        return;
      }

      const total = data.length;
      const completed = data.filter(a => a.status === 'completed').length;
      const cancelled = data.filter(a => a.status === 'cancelled').length;

      // Calculate trend
      const trendMap = new Map();
      data.forEach(apt => {
        const date = apt.appointment_date;
        const count = trendMap.get(date) || 0;
        trendMap.set(date, count + 1);
      });

      const trend = Array.from(trendMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Calculate average time between visits
      const completedAppointments = data
        .filter(a => a.status === 'completed')
        .map(a => new Date(a.appointment_date))
        .sort((a, b) => a - b);

      let avgTimeBetween = 0;
      if (completedAppointments.length > 1) {
        const intervals = [];
        for (let i = 1; i < completedAppointments.length; i++) {
          const diff = completedAppointments[i] - completedAppointments[i - 1];
          intervals.push(diff / (1000 * 60 * 60 * 24)); // Convert to days
        }
        avgTimeBetween = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      }

      console.log('Appointment metrics calculated:', {
        total,
        completed,
        cancelled,
        trendLength: trend.length,
        avgTimeBetween
      });

      const metrics = {
        total,
        completed,
        cancelled,
        trend,
        avgTimeBetween: Math.round(avgTimeBetween * 10) / 10
      };
      setAppointmentMetrics(metrics);
      return metrics; // Return the data for use in print function
    } catch (error) {
      console.error('Error fetching appointment analytics:', error);
      // Set empty state on error
      const emptyMetrics = {
        total: 0,
        completed: 0,
        cancelled: 0,
        trend: [],
        avgTimeBetween: 0
      };
      setAppointmentMetrics(emptyMetrics);
      return emptyMetrics;
    }
  };

  const fetchTreatmentAnalytics = async () => {
    try {
      const dateRange = getDateRange();
      console.log('Fetching treatment analytics with date range:', dateRange, 'timeFilter:', timeFilter);
      
      let query = supabase
        .from('treatments')
        .select('id, treatment_date, procedure, doctor_id, doctor:doctor_id(id, full_name)')
        .eq('patient_id', user.id);

      if (dateRange) {
        if (dateRange.isDaily) {
          // For daily, use .eq() to match exactly today
          console.log('Treatment daily filter applied (exact match):', dateRange.date);
          query = query.eq('treatment_date', dateRange.date);
        } else if (dateRange.start && dateRange.end) {
          console.log('Treatment date range filter:', dateRange);
          query = query
            .gte('treatment_date', dateRange.start)
            .lte('treatment_date', dateRange.end); // Use lte to include end date
        }
      }

      const { data, error } = await query;
      console.log('Treatment query executed. Records found:', data?.length || 0);
      if (error) {
        console.error('Treatment analytics query error:', error);
        throw error;
      }
      
      console.log('Treatment analytics data fetched:', data?.length || 0, 'records');

      if (!data || data.length === 0) {
        const emptyMetrics = {
          mostCommon: [],
          countByTimeframe: [],
          dentistFrequency: []
        };
        setTreatmentMetrics(emptyMetrics);
        return emptyMetrics;
      }

      // Most common treatments
      const treatmentCount = new Map();
      data.forEach(t => {
        const procedures = (t.procedure || '').split(',').map(p => p.trim());
        procedures.forEach(proc => {
          if (proc) {
            const count = treatmentCount.get(proc) || 0;
            treatmentCount.set(proc, count + 1);
          }
        });
      });

      const mostCommon = Array.from(treatmentCount.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Count by timeframe
      const timeframeMap = new Map();
      data.forEach(t => {
        const date = t.treatment_date;
        const count = timeframeMap.get(date) || 0;
        timeframeMap.set(date, count + 1);
      });

      const countByTimeframe = Array.from(timeframeMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Dentist frequency
      const dentistCount = new Map();
      data.forEach(t => {
        const dentistName = t.doctor?.full_name || 'Unknown';
        const count = dentistCount.get(dentistName) || 0;
        dentistCount.set(dentistName, count + 1);
      });

      const dentistFrequency = Array.from(dentistCount.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      console.log('Treatment metrics calculated:', {
        mostCommon: mostCommon.length,
        countByTimeframe: countByTimeframe.length,
        dentistFrequency: dentistFrequency.length
      });

      const metrics = {
        mostCommon,
        countByTimeframe,
        dentistFrequency
      };
      setTreatmentMetrics(metrics);
      return metrics; // Return the data for use in print function
    } catch (error) {
      console.error('Error fetching treatment analytics:', error);
      // Set empty state on error
      const emptyMetrics = {
        mostCommon: [],
        countByTimeframe: [],
        dentistFrequency: []
      };
      setTreatmentMetrics(emptyMetrics);
      return emptyMetrics;
    }
  };

  const fetchBranchAnalytics = async () => {
    try {
      const dateRange = getDateRange();
      console.log('Fetching branch analytics with date range:', dateRange, 'timeFilter:', timeFilter);
      
      // Get all appointments (not just completed) for branch analytics
      let query = supabase
        .from('appointments')
        .select('id, appointment_date, branch, status')
        .eq('patient_id', user.id);

      if (dateRange) {
        if (dateRange.isDaily) {
          // For daily, use .eq() to match exactly today
          console.log('Branch appointment daily filter applied (exact match):', dateRange.date);
          query = query.eq('appointment_date', dateRange.date);
        } else if (dateRange.start && dateRange.end) {
          console.log('Branch appointment date range filter applied:', { start: dateRange.start, end: dateRange.end });
          query = query
            .gte('appointment_date', dateRange.start)
            .lte('appointment_date', dateRange.end); // Use lte to include end date
        }
      }

      const { data, error } = await query;
      console.log('Branch query executed. Records found:', data?.length || 0);
      if (error) {
        console.error('Branch analytics query error:', error);
        throw error;
      }
      
      console.log('Branch analytics data fetched:', data?.length || 0, 'records');

      if (!data || data.length === 0) {
        const emptyMetrics = {
          visitsPerBranch: {},
          branchTrend: []
        };
        setBranchMetrics(emptyMetrics);
        return emptyMetrics;
      }

      // Visits per branch
      const branchCount = new Map();
      data.forEach(apt => {
        const branch = apt.branch || 'Unknown';
        const count = branchCount.get(branch) || 0;
        branchCount.set(branch, count + 1);
      });

      const visitsPerBranch = Object.fromEntries(branchCount);

      // Branch trend
      const branchTrendMap = new Map();
      data.forEach(apt => {
        const date = apt.appointment_date;
        const branch = apt.branch || 'Unknown';
        const key = `${date}_${branch}`;
        const count = branchTrendMap.get(key) || { date, branch, count: 0 };
        count.count++;
        branchTrendMap.set(key, count);
      });

      const branchTrend = Array.from(branchTrendMap.values())
        .sort((a, b) => a.date.localeCompare(b.date));

      console.log('Branch metrics calculated:', {
        visitsPerBranch: Object.keys(visitsPerBranch).length,
        branchTrendLength: branchTrend.length
      });

      const metrics = {
        visitsPerBranch,
        branchTrend
      };
      setBranchMetrics(metrics);
      return metrics; // Return the data for use in print function
    } catch (error) {
      console.error('Error fetching branch analytics:', error);
      // Set empty state on error
      const emptyMetrics = {
        visitsPerBranch: {},
        branchTrend: []
      };
      setBranchMetrics(emptyMetrics);
      return emptyMetrics;
    }
  };

  const renderAppointmentCharts = (metricsData = null) => {
    const metrics = metricsData || appointmentMetrics;
    // Appointment Trend Chart - render if we have trend data
    // Try ref first, then fallback to DOM query
    let trendCanvas = appointmentTrendRef.current;
    if (!trendCanvas) {
      trendCanvas = document.getElementById('chart-appointmentTrend');
    }
    
    if (trendCanvas && metrics.trend && metrics.trend.length > 0) {
      const ctx = trendCanvas.getContext('2d');
      if (window.appointmentTrend) {
        window.appointmentTrend.destroy();
      }

      window.appointmentTrend = new Chart(ctx, {
        type: 'line',
        data: {
          labels: metrics.trend.map(t => {
            const date = new Date(t.date);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          }),
          datasets: [{
            label: 'Appointments',
            data: metrics.trend.map(t => t.count),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            tension: 0.3,
            fill: true
          }]
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
              ticks: { stepSize: 1, font: { size: 10 } }
            },
            x: {
              ticks: { font: { size: 10 } }
            }
          }
        }
      });
    }

    // Appointment Comparison Chart - always render if we have metrics
    let comparisonCanvas = appointmentComparisonRef.current;
    if (!comparisonCanvas) {
      comparisonCanvas = document.getElementById('chart-appointmentComparison');
    }
    
    if (comparisonCanvas && metrics.total >= 0) {
      const ctx = comparisonCanvas.getContext('2d');
      if (window.appointmentComparison) {
        window.appointmentComparison.destroy();
      }

      window.appointmentComparison = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Completed', 'Cancelled'],
          datasets: [{
            label: 'Appointments',
            data: [metrics.completed, metrics.cancelled],
            backgroundColor: ['#10b981', '#ef4444'],
            borderColor: ['#059669', '#dc2626'],
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
              ticks: { stepSize: 1, font: { size: 10 } }
            },
            x: {
              ticks: { font: { size: 10 } }
            }
          }
        }
      });
    }
  };

  const renderTreatmentCharts = (metricsData = null) => {
    const metrics = metricsData || treatmentMetrics;
    // Treatment Count Chart - render if we have data
    let treatmentCountCanvas = treatmentCountRef.current;
    if (!treatmentCountCanvas) {
      treatmentCountCanvas = document.getElementById('chart-treatmentCount');
    }
    
    if (treatmentCountCanvas && metrics.countByTimeframe && metrics.countByTimeframe.length > 0) {
      const ctx = treatmentCountCanvas.getContext('2d');
      if (window.treatmentCount) {
        window.treatmentCount.destroy();
      }

      window.treatmentCount = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: metrics.countByTimeframe.map(t => {
            const date = new Date(t.date);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          }),
          datasets: [{
            label: 'Treatments',
            data: metrics.countByTimeframe.map(t => t.count),
            backgroundColor: '#8b5cf6',
            borderColor: '#7c3aed',
            borderWidth: 1
          }]
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
              ticks: { stepSize: 1, font: { size: 10 } }
            },
            x: {
              ticks: { font: { size: 10 } }
            }
          }
        }
      });
    }

    // Treatment Pie Chart - render if we have data
    let treatmentPieCanvas = treatmentPieRef.current;
    if (!treatmentPieCanvas) {
      treatmentPieCanvas = document.getElementById('chart-treatmentPie');
    }
    
    if (treatmentPieCanvas && metrics.mostCommon && metrics.mostCommon.length > 0) {
      const ctx = treatmentPieCanvas.getContext('2d');
      if (window.treatmentPie) {
        window.treatmentPie.destroy();
      }

      const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
      
      window.treatmentPie = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: metrics.mostCommon.map(t => t.name),
          datasets: [{
            data: metrics.mostCommon.map(t => t.count),
            backgroundColor: colors.slice(0, metrics.mostCommon.length),
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 1.5,
          plugins: {
            legend: {
              position: 'right',
              labels: { font: { size: 10 } }
            }
          }
        }
      });
    }
  };

  const renderBranchCharts = (metricsData = null) => {
    const metrics = metricsData || branchMetrics;
    // Branch Usage Chart - render if we have branch data
    let branchUsageCanvas = branchUsageRef.current;
    if (!branchUsageCanvas) {
      branchUsageCanvas = document.getElementById('chart-branchUsage');
    }
    
    if (branchUsageCanvas && metrics.visitsPerBranch && Object.keys(metrics.visitsPerBranch).length > 0) {
      const ctx = branchUsageCanvas.getContext('2d');
      if (window.branchUsage) {
        window.branchUsage.destroy();
      }

      const branches = Object.keys(metrics.visitsPerBranch);
      const visits = branches.map(b => metrics.visitsPerBranch[b]);
      const total = visits.reduce((a, b) => a + b, 0);
      const percentages = visits.map(v => Math.round((v / total) * 100));

      window.branchUsage = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: branches.map((b, i) => `${b} (${percentages[i]}%)`),
          datasets: [{
            data: visits,
            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'],
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 1.5,
          plugins: {
            legend: {
              position: 'right',
              labels: { font: { size: 10 } }
            }
          }
        }
      });
    }

    // Branch Trend Chart - render if we have trend data
    let branchTrendCanvas = branchTrendRef.current;
    if (!branchTrendCanvas) {
      branchTrendCanvas = document.getElementById('chart-branchTrend');
    }
    
    if (branchTrendCanvas && metrics.branchTrend && metrics.branchTrend.length > 0) {
      const ctx = branchTrendCanvas.getContext('2d');
      if (window.branchTrend) {
        window.branchTrend.destroy();
      }

      // Get unique branches from data
      const uniqueBranches = [...new Set(metrics.branchTrend.map(t => t.branch))];
      
      // Find the exact branch names (handle any case/spacing variations)
      let sanJuanBranch = null;
      let cabugaoBranch = null;
      
      uniqueBranches.forEach(branch => {
        const branchLower = branch.trim().toLowerCase();
        if ((branchLower.includes('san juan') || branchLower === 'sanjuan') && !sanJuanBranch) {
          sanJuanBranch = branch; // Keep original case
        }
        if (branchLower.includes('cabugao') && !cabugaoBranch) {
          cabugaoBranch = branch; // Keep original case
        }
      });
      
      // Create datasets in EXPLICIT order: Cabugao first (GREEN), then San Juan (BLUE)
      const dates = [...new Set(metrics.branchTrend.map(t => t.date))].sort();
      const datasets = [];
      
      // 1. Add Cabugao dataset FIRST with GREEN color
      if (cabugaoBranch) {
        const cabugaoData = dates.map(date => {
          const item = metrics.branchTrend.find(t => t.date === date && t.branch === cabugaoBranch);
          return item ? item.count : 0;
        });
        
        datasets.push({
          label: cabugaoBranch,
          data: cabugaoData,
          borderColor: '#10b981', // GREEN for Cabugao
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          pointBackgroundColor: '#10b981', // GREEN point fill
          pointBorderColor: '#10b981', // GREEN point border
          pointHoverBackgroundColor: '#059669', // Darker green on hover
          pointHoverBorderColor: '#059669',
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6
        });
      }
      
      // 2. Add San Juan dataset SECOND with BLUE color
      if (sanJuanBranch) {
        const sanJuanData = dates.map(date => {
          const item = metrics.branchTrend.find(t => t.date === date && t.branch === sanJuanBranch);
          return item ? item.count : 0;
        });
        
        datasets.push({
          label: sanJuanBranch,
          data: sanJuanData,
          borderColor: '#3b82f6', // BLUE for San Juan
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          pointBackgroundColor: '#3b82f6', // BLUE point fill
          pointBorderColor: '#3b82f6', // BLUE point border
          pointHoverBackgroundColor: '#2563eb', // Darker blue on hover
          pointHoverBorderColor: '#2563eb',
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6
        });
      }
      
      // 3. Add any other branches (shouldn't happen, but just in case)
      uniqueBranches.forEach(branch => {
        const branchLower = branch.trim().toLowerCase();
        const isSanJuan = branchLower.includes('san juan') || branchLower === 'sanjuan';
        const isCabugao = branchLower.includes('cabugao');
        
        if (!isSanJuan && !isCabugao) {
          const otherData = dates.map(date => {
            const item = metrics.branchTrend.find(t => t.date === date && t.branch === branch);
            return item ? item.count : 0;
          });
          
          datasets.push({
            label: branch,
            data: otherData,
            borderColor: '#f59e0b', // Orange for other branches
            backgroundColor: '#f59e0b40',
            tension: 0.3
          });
        }
      });

      window.branchTrend = new Chart(ctx, {
        type: 'line',
        data: {
          labels: dates.map(d => {
            const date = new Date(d);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          }),
          datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 2.5,
          plugins: {
            legend: {
              position: 'top',
              labels: { font: { size: 10 } }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1, font: { size: 10 } }
            },
            x: {
              ticks: { font: { size: 10 } }
            }
          }
        }
      });
    }
  };


  const getBranchPercentage = (branchName) => {
    const total = Object.values(branchMetrics.visitsPerBranch).reduce((a, b) => a + b, 0);
    if (total === 0) return 0;
    const visits = branchMetrics.visitsPerBranch[branchName] || 0;
    return Math.round((visits / total) * 100);
  };

  const getFilterDisplayText = () => {
    const dateRange = getDateRange();
    const now = new Date();
    const formatDate = (date) => {
      if (!date) return '';
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    switch (timeFilter) {
      case 'daily':
        return `Daily - ${formatDate(now)}`;
      case 'weekly':
        if (dateRange?.start && dateRange?.end) {
          const start = new Date(dateRange.start);
          const end = new Date(dateRange.end);
          return `Weekly - ${formatDate(start)} to ${formatDate(end)}`;
        }
        return 'Weekly';
      case 'monthly':
        if (dateRange?.start && dateRange?.end) {
          const start = new Date(dateRange.start);
          const end = new Date(dateRange.end);
          return `Monthly - ${start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
        }
        return 'Monthly';
      case 'yearly':
        return `Yearly - ${now.getFullYear()}`;
      case 'custom':
        if (customStartDate && customEndDate) {
          return `Custom Range - ${formatDate(customStartDate)} to ${formatDate(customEndDate)}`;
        }
        return 'Custom Date Range';
      default:
        return 'All Time';
    }
  };

  // Shared helper function to build report HTML (used by both print and PDF)
  const buildReportHTML = (chartImages, apptMetrics, treatMetrics, branchMetricsData, printDate) => {
    // Helper function to format date
    const formatDate = (dateStr) => {
      if (!dateStr) return 'N/A';
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Build all sections HTML using the fetched data directly
    const buildAppointmentSection = () => {
      const metrics = apptMetrics || appointmentMetrics;
      if (metrics.total === 0 && (!metrics.trend || metrics.trend.length === 0)) {
        return '<div class="print-section"><h2>&#128197; Appointment Analytics</h2><p>No appointment data available.</p></div>';
      }

      const trendChartImg = chartImages.appointmentTrend ? `<img src="${chartImages.appointmentTrend}" style="max-width: 100%; height: auto; display: block; max-height: 140px;" alt="Appointment Trend Chart" />` : '<div style="padding: 10px; text-align: center; color: #999; font-size: 8pt;">Chart not available</div>';
      const comparisonChartImg = chartImages.appointmentComparison ? `<img src="${chartImages.appointmentComparison}" style="max-width: 100%; height: auto; display: block; max-height: 140px;" alt="Completed vs Cancelled Chart" />` : '<div style="padding: 10px; text-align: center; color: #999; font-size: 8pt;">Chart not available</div>';

      return `
        <div class="print-section">
          <h2>&#128197; Appointment Analytics</h2>
          <div class="metrics-row">
            <div class="metric-box">
              <div class="metric-label">Total Appointments</div>
              <div class="metric-value">${metrics.total}</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Completed</div>
              <div class="metric-value">${metrics.completed}</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Cancelled</div>
              <div class="metric-value">${metrics.cancelled}</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Avg. Days Between Visits</div>
              <div class="metric-value">${metrics.avgTimeBetween}</div>
            </div>
          </div>
          <div class="charts-row">
            <div class="chart-box">
              <h3>Appointment Trend</h3>
              ${trendChartImg}
            </div>
            <div class="chart-box">
              <h3>Completed vs Cancelled</h3>
              ${comparisonChartImg}
            </div>
          </div>
        </div>
      `;
    };

    const buildTreatmentSection = () => {
      const metrics = treatMetrics || treatmentMetrics;
      const treatmentCountImg = chartImages.treatmentCount ? `<img src="${chartImages.treatmentCount}" style="max-width: 100%; height: auto; display: block; max-height: 140px;" alt="Treatment Count Chart" />` : '<div style="padding: 10px; text-align: center; color: #999; font-size: 8pt;">Chart not available</div>';
      const treatmentPieImg = chartImages.treatmentPie ? `<img src="${chartImages.treatmentPie}" style="max-width: 100%; height: auto; display: block; max-height: 140px;" alt="Treatment Distribution Chart" />` : '<div style="padding: 10px; text-align: center; color: #999; font-size: 8pt;">Chart not available</div>';
      
      const mostCommonList = metrics.mostCommon && metrics.mostCommon.length > 0
        ? metrics.mostCommon.map(t => `<li>${t.name}: ${t.count} time(s)</li>`).join('')
        : '<li>No data available</li>';
      
      const dentistList = metrics.dentistFrequency && metrics.dentistFrequency.length > 0
        ? metrics.dentistFrequency.map(d => `<li>${d.name}: ${d.count} visit(s)</li>`).join('')
        : '<li>No data available</li>';

      return `
        <div class="print-section">
          <h2>&#128138; Treatment Analytics</h2>
          <div class="info-grid">
            <div class="info-box">
              <h3>Most Common Treatments</h3>
              <ul>${mostCommonList}</ul>
            </div>
            <div class="info-box">
              <h3>Dentists Most Frequently Visited</h3>
              <ul>${dentistList}</ul>
            </div>
          </div>
          <div class="charts-row">
            <div class="chart-box">
              <h3>Treatment Count Over Time</h3>
              ${treatmentCountImg}
            </div>
            <div class="chart-box">
              <h3>Treatment Distribution</h3>
              ${treatmentPieImg}
            </div>
          </div>
        </div>
      `;
    };

    const buildBranchSection = () => {
      const metrics = branchMetricsData || branchMetrics;
      const branchUsageImg = chartImages.branchUsage ? `<img src="${chartImages.branchUsage}" style="max-width: 100%; height: auto; display: block; max-height: 140px;" alt="Branch Preference Chart" />` : '<div style="padding: 10px; text-align: center; color: #999; font-size: 8pt;">Chart not available</div>';
      const branchTrendImg = chartImages.branchTrend ? `<img src="${chartImages.branchTrend}" style="max-width: 100%; height: auto; display: block; max-height: 140px;" alt="Branch Visit Trend Chart" />` : '<div style="padding: 10px; text-align: center; color: #999; font-size: 8pt;">Chart not available</div>';
      
      // Calculate branch percentage
      const visitsPerBranch = metrics.visitsPerBranch || {};
      const totalVisits = Object.values(visitsPerBranch).reduce((sum, visits) => sum + visits, 0);
      const calculateBranchPercentage = (branchName) => {
        const visits = visitsPerBranch[branchName] || 0;
        return totalVisits > 0 ? ((visits / totalVisits) * 100).toFixed(1) : 0;
      };
      
      const branchStats = Object.keys(visitsPerBranch).length > 0
        ? Object.entries(visitsPerBranch).map(([branch, visits]) => 
            `<div class="branch-stat"><strong>${branch}:</strong> ${visits} visits (${calculateBranchPercentage(branch)}%)</div>`
          ).join('')
        : '<div>No branch data available</div>';

      return `
        <div class="print-section">
          <h2>&#128205; Branch Usage Analytics</h2>
          <div class="branch-stats">${branchStats}</div>
          <div class="charts-row">
            <div class="chart-box">
              <h3>Branch Preference</h3>
              ${branchUsageImg}
            </div>
            <div class="chart-box">
              <h3>Branch Visit Trend</h3>
              ${branchTrendImg}
            </div>
          </div>
        </div>
      `;
    };

    // Create print HTML with all sections
    return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Patient Analytics Report</title>
        <style>
          @media print {
            @page {
              margin: 0.5cm;
              size: A4;
            }
            * {
              box-sizing: border-box;
            }
            body {
              font-family: Arial, sans-serif;
              font-size: 9pt;
              color: #000;
              background: #fff;
              margin: 0;
              padding: 5px;
              line-height: 1.2;
            }
            .print-header {
              border-bottom: 2px solid #000;
              padding-bottom: 4px;
              margin-bottom: 6px;
            }
            .print-header h1 {
              margin: 0;
              font-size: 14pt;
              color: #000;
              line-height: 1.2;
            }
            .print-header .filter-info {
              margin-top: 2px;
              font-size: 8pt;
              color: #333;
              line-height: 1.2;
            }
            .print-header .print-date {
              margin-top: 2px;
              font-size: 7pt;
              color: #666;
              line-height: 1.2;
            }
            .print-section {
              margin-bottom: 8px;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .print-section:last-child {
              margin-bottom: 0;
            }
            .print-section h2 {
              font-size: 11pt;
              border-bottom: 1px solid #ccc;
              padding-bottom: 2px;
              margin-bottom: 5px;
              margin-top: 5px;
              color: #000;
              line-height: 1.2;
            }
            .print-section h3 {
              font-size: 9pt;
              margin-top: 4px;
              margin-bottom: 3px;
              color: #000;
              line-height: 1.2;
            }
            .metrics-row {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 5px;
              margin-bottom: 6px;
            }
            .metric-box {
              background: #f9f9f9;
              border: 1px solid #ddd;
              padding: 6px;
              text-align: center;
              border-radius: 2px;
            }
            .metric-label {
              font-size: 8pt;
              color: #666;
              margin-bottom: 2px;
              line-height: 1.2;
            }
            .metric-value {
              font-size: 16pt;
              font-weight: bold;
              color: #000;
              line-height: 1.2;
            }
            .charts-row {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 6px;
              margin-bottom: 6px;
            }
            .chart-box {
              background: #f9f9f9;
              border: 1px solid #ddd;
              padding: 6px;
              border-radius: 2px;
            }
            .chart-box h3 {
              font-size: 9pt;
              margin: 0 0 4px 0;
              line-height: 1.2;
            }
            .chart-box img {
              max-width: 100%;
              height: auto;
              max-height: 140px;
              display: block;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 6px;
              margin-bottom: 6px;
            }
            .info-box {
              background: #f9f9f9;
              border: 1px solid #ddd;
              padding: 6px;
              border-radius: 2px;
            }
            .info-box ul {
              margin: 3px 0;
              padding-left: 18px;
              font-size: 8pt;
              line-height: 1.3;
            }
            .info-box li {
              margin: 2px 0;
            }
            .branch-stats {
              background: #f9f9f9;
              border: 1px solid #ddd;
              padding: 6px;
              margin-bottom: 6px;
              border-radius: 2px;
              font-size: 8pt;
              line-height: 1.3;
            }
            .branch-stat {
              margin: 2px 0;
            }
            .no-print {
              display: none !important;
            }
          }
          body {
            font-family: Arial, sans-serif;
            padding: 10px;
            font-size: 9pt;
          }
          .print-header {
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }
          .print-header h1 {
            margin: 0;
            font-size: 18pt;
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <h1>&#128202; Patient Analytics Report</h1>
          <div class="filter-info">
            <strong>Filter:</strong> ${getFilterDisplayText()}
          </div>
          <div class="print-date">
            <strong>Generated:</strong> ${printDate}
          </div>
        </div>
        ${buildAppointmentSection()}
        ${buildTreatmentSection()}
        ${buildBranchSection()}
      </body>
    </html>
  `;
  };

  const handleDownloadPDF = async () => {
    setLoading(true);
    
    try {
      console.log('Starting PDF generation...');
      
      // Step 1: Fetch all analytics data
      console.log('Fetching all analytics data...');
      const [apptMetrics, treatMetrics, branchMetricsData] = await Promise.all([
        fetchAppointmentAnalytics().catch(e => {
          console.error('Appointment fetch error:', e);
          return { total: 0, completed: 0, cancelled: 0, trend: [], avgTimeBetween: 0 };
        }),
        fetchTreatmentAnalytics().catch(e => {
          console.error('Treatment fetch error:', e);
          return { mostCommon: [], countByTimeframe: [], dentistFrequency: [] };
        }),
        fetchBranchAnalytics().catch(e => {
          console.error('Branch fetch error:', e);
          return { visitsPerBranch: {}, branchTrend: [] };
        })
      ]);
      
      // Step 2: Update state and wait for React to render
      setAppointmentMetrics(apptMetrics);
      setTreatmentMetrics(treatMetrics);
      setBranchMetrics(branchMetricsData);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 3: Make all tab sections visible temporarily
      const contentContainer = document.getElementById('patient-analytics-content');
      if (!contentContainer) {
        throw new Error('Analytics content container not found');
      }
      
      const wrapperDiv = contentContainer.querySelector('div:not(.border-b)');
      if (!wrapperDiv) {
        throw new Error('Content wrapper not found');
      }
      
      const allSections = Array.from(wrapperDiv.children).filter(child => 
        child.hasAttribute('style') && child.getAttribute('style').includes('display')
      );
      
      const originalStyles = new Map();
      allSections.forEach(section => {
        originalStyles.set(section, section.style.cssText);
        section.style.cssText = 'display: block !important; position: absolute; left: -9999px; width: 800px; min-height: 600px;';
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Step 4: Render all charts
      console.log('Rendering all charts...');
      renderAppointmentCharts(apptMetrics);
      await new Promise(resolve => setTimeout(resolve, 400));
      renderTreatmentCharts(treatMetrics);
      await new Promise(resolve => setTimeout(resolve, 400));
      renderBranchCharts(branchMetricsData);
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Step 5: Convert charts to images
      const chartImages = {};
      const chartConfigs = [
        { name: 'appointmentTrend', ref: appointmentTrendRef, id: 'chart-appointmentTrend' },
        { name: 'appointmentComparison', ref: appointmentComparisonRef, id: 'chart-appointmentComparison' },
        { name: 'treatmentCount', ref: treatmentCountRef, id: 'chart-treatmentCount' },
        { name: 'treatmentPie', ref: treatmentPieRef, id: 'chart-treatmentPie' },
        { name: 'branchUsage', ref: branchUsageRef, id: 'chart-branchUsage' },
        { name: 'branchTrend', ref: branchTrendRef, id: 'chart-branchTrend' }
      ];
      
      for (const config of chartConfigs) {
        try {
          const canvas = config.ref?.current || document.getElementById(config.id);
          if (!canvas) {
            console.warn(`Canvas not found: ${config.name}`);
            continue;
          }
          
          // Update chart instance if exists
          const chartInstance = window[config.name];
          if (chartInstance) {
            if (typeof chartInstance.resize === 'function') chartInstance.resize();
            if (typeof chartInstance.update === 'function') chartInstance.update('none');
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          // Ensure canvas has valid dimensions
          if (canvas.width === 0 || canvas.height === 0) {
            const parent = canvas.parentElement;
            if (parent) {
              const rect = parent.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                const dpr = window.devicePixelRatio || 1;
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                if (chartInstance && typeof chartInstance.resize === 'function') {
                  chartInstance.resize();
                  await new Promise(resolve => setTimeout(resolve, 100));
                }
              }
            }
          }
          
          // Convert to image
          if (canvas.width > 0 && canvas.height > 0) {
            const dataUrl = canvas.toDataURL('image/png', 1.0);
            if (dataUrl && dataUrl !== 'data:,') {
              chartImages[config.name] = dataUrl;
              console.log(`✓ Converted ${config.name}`);
            }
          }
        } catch (error) {
          console.error(`Error converting ${config.name}:`, error);
        }
      }
      
      // Step 6: Restore original styles
      originalStyles.forEach((style, section) => {
        section.style.cssText = style;
      });
      
      // Step 7: Generate PDF using jsPDF directly
      const now = new Date();
      const printDate = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pdfWidth - (margin * 2);
      let yPosition = margin;
      
      // Helper to add new page if needed
      const checkNewPage = (requiredHeight) => {
        if (yPosition + requiredHeight > pdfHeight - margin) {
          pdf.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };
      
      // Header
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('📊 Patient Analytics Report', margin, yPosition);
      yPosition += 8;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Filter: ${getFilterDisplayText()}`, margin, yPosition);
      yPosition += 5;
      pdf.text(`Generated: ${printDate}`, margin, yPosition);
      yPosition += 8;
      
      // Draw line
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPosition, pdfWidth - margin, yPosition);
      yPosition += 8;
      
      // Appointment Analytics Section
      if (apptMetrics.total > 0 || (apptMetrics.trend && apptMetrics.trend.length > 0)) {
        checkNewPage(40);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('📅 Appointment Analytics', margin, yPosition);
        yPosition += 8;
        
        // Metrics
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        const metrics = [
          { label: 'Total Appointments', value: apptMetrics.total },
          { label: 'Completed', value: apptMetrics.completed },
          { label: 'Cancelled', value: apptMetrics.cancelled },
          { label: 'Avg. Days Between Visits', value: apptMetrics.avgTimeBetween }
        ];
        
        const boxWidth = contentWidth / 4;
        metrics.forEach((metric, index) => {
          const xPos = margin + (index * boxWidth);
          pdf.setFillColor(245, 245, 245);
          pdf.rect(xPos, yPosition, boxWidth - 2, 15, 'F');
          pdf.setFontSize(7);
          pdf.text(metric.label, xPos + 2, yPosition + 5);
          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          pdf.text(String(metric.value), xPos + 2, yPosition + 12);
          pdf.setFont('helvetica', 'normal');
        });
        yPosition += 20;
        
        // Charts
        const chartStartY = yPosition;
        if (chartImages.appointmentTrend) {
          checkNewPage(50);
          pdf.setFontSize(10);
          pdf.text('Appointment Trend', margin, yPosition);
          yPosition += 5;
          try {
            const img = new Image();
            img.src = chartImages.appointmentTrend;
            await new Promise((resolve) => {
              img.onload = () => {
                const imgWidth = 90;
                const imgHeight = (img.height / img.width) * imgWidth;
                pdf.addImage(chartImages.appointmentTrend, 'PNG', margin, yPosition, imgWidth, imgHeight);
                resolve();
              };
              img.onerror = () => {
                console.error('Failed to load appointment trend image');
                resolve();
              };
              setTimeout(resolve, 2000);
            });
          } catch (e) {
            console.error('Error adding appointment trend chart:', e);
          }
        }
        
        if (chartImages.appointmentComparison) {
          const comparisonY = chartStartY + 5;
          pdf.setFontSize(10);
          pdf.text('Completed vs Cancelled', margin + 95, comparisonY);
          try {
            const img = new Image();
            img.src = chartImages.appointmentComparison;
            await new Promise((resolve) => {
              img.onload = () => {
                const imgWidth = 90;
                const imgHeight = (img.height / img.width) * imgWidth;
                pdf.addImage(chartImages.appointmentComparison, 'PNG', margin + 95, comparisonY + 5, imgWidth, imgHeight);
                resolve();
              };
              img.onerror = () => {
                console.error('Failed to load appointment comparison image');
                resolve();
              };
              setTimeout(resolve, 2000);
            });
          } catch (e) {
            console.error('Error adding appointment comparison chart:', e);
          }
        }
        yPosition += 55;
      }
      
      // Treatment Analytics Section
      if (treatMetrics.mostCommon?.length > 0 || treatMetrics.countByTimeframe?.length > 0) {
        checkNewPage(40);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('🦷 Treatment Analytics', margin, yPosition);
        yPosition += 8;
        
        // Most Common Treatments
        if (treatMetrics.mostCommon?.length > 0) {
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.text('Most Common Treatments:', margin, yPosition);
          yPosition += 6;
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          treatMetrics.mostCommon.forEach(treatment => {
            checkNewPage(6);
            pdf.text(`• ${treatment.name}: ${treatment.count} time(s)`, margin + 5, yPosition);
            yPosition += 5;
          });
          yPosition += 3;
        }
        
        // Dentist Frequency
        if (treatMetrics.dentistFrequency?.length > 0) {
          checkNewPage(30);
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.text('Dentists Most Frequently Visited:', margin + 95, yPosition - (treatMetrics.mostCommon?.length * 5 || 0) - 6);
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          let dentistY = yPosition - (treatMetrics.mostCommon?.length * 5 || 0);
          treatMetrics.dentistFrequency.forEach(dentist => {
            checkNewPage(6);
            pdf.text(`• ${dentist.name}: ${dentist.count} visit(s)`, margin + 100, dentistY);
            dentistY += 5;
          });
          yPosition = Math.max(yPosition, dentistY) + 3;
        }
        
        // Treatment Charts
        const treatmentChartStartY = yPosition;
        if (chartImages.treatmentCount) {
          checkNewPage(50);
          pdf.setFontSize(10);
          pdf.text('Treatment Count Over Time', margin, yPosition);
          yPosition += 5;
          try {
            const img = new Image();
            img.src = chartImages.treatmentCount;
            await new Promise((resolve) => {
              img.onload = () => {
                const imgWidth = 90;
                const imgHeight = (img.height / img.width) * imgWidth;
                pdf.addImage(chartImages.treatmentCount, 'PNG', margin, yPosition, imgWidth, imgHeight);
                resolve();
              };
              img.onerror = () => {
                console.error('Failed to load treatment count image');
                resolve();
              };
              setTimeout(resolve, 2000);
            });
          } catch (e) {
            console.error('Error adding treatment count chart:', e);
          }
        }
        
        if (chartImages.treatmentPie) {
          const pieY = treatmentChartStartY + 5;
          pdf.setFontSize(10);
          pdf.text('Treatment Distribution', margin + 95, pieY);
          try {
            const img = new Image();
            img.src = chartImages.treatmentPie;
            await new Promise((resolve) => {
              img.onload = () => {
                const imgWidth = 90;
                const imgHeight = (img.height / img.width) * imgWidth;
                pdf.addImage(chartImages.treatmentPie, 'PNG', margin + 95, pieY + 5, imgWidth, imgHeight);
                resolve();
              };
              img.onerror = () => {
                console.error('Failed to load treatment pie image');
                resolve();
              };
              setTimeout(resolve, 2000);
            });
          } catch (e) {
            console.error('Error adding treatment pie chart:', e);
          }
        }
        yPosition += 55;
      }
      
      // Branch Analytics Section
      const branchKeys = Object.keys(branchMetricsData.visitsPerBranch || {});
      if (branchKeys.length > 0 || branchMetricsData.branchTrend?.length > 0) {
        checkNewPage(40);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('📍 Branch Usage Analytics', margin, yPosition);
        yPosition += 8;
        
        // Branch Stats
        if (branchKeys.length > 0) {
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          const totalVisits = Object.values(branchMetricsData.visitsPerBranch).reduce((a, b) => a + b, 0);
          branchKeys.forEach(branch => {
            checkNewPage(6);
            const visits = branchMetricsData.visitsPerBranch[branch];
            const percentage = totalVisits > 0 ? ((visits / totalVisits) * 100).toFixed(1) : 0;
            pdf.text(`${branch}: ${visits} visits (${percentage}%)`, margin + 5, yPosition);
            yPosition += 5;
          });
          yPosition += 3;
        }
        
        // Branch Charts
        const branchChartStartY = yPosition;
        if (chartImages.branchUsage) {
          checkNewPage(50);
          pdf.setFontSize(10);
          pdf.text('Branch Preference', margin, yPosition);
          yPosition += 5;
          try {
            const img = new Image();
            img.src = chartImages.branchUsage;
            await new Promise((resolve) => {
              img.onload = () => {
                const imgWidth = 90;
                const imgHeight = (img.height / img.width) * imgWidth;
                pdf.addImage(chartImages.branchUsage, 'PNG', margin, yPosition, imgWidth, imgHeight);
                resolve();
              };
              img.onerror = () => {
                console.error('Failed to load branch usage image');
                resolve();
              };
              setTimeout(resolve, 2000);
            });
          } catch (e) {
            console.error('Error adding branch usage chart:', e);
          }
        }
        
        if (chartImages.branchTrend) {
          const trendY = branchChartStartY + 5;
          pdf.setFontSize(10);
          pdf.text('Branch Visit Trend', margin + 95, trendY);
          try {
            const img = new Image();
            img.src = chartImages.branchTrend;
            await new Promise((resolve) => {
              img.onload = () => {
                const imgWidth = 90;
                const imgHeight = (img.height / img.width) * imgWidth;
                pdf.addImage(chartImages.branchTrend, 'PNG', margin + 95, trendY + 5, imgWidth, imgHeight);
                resolve();
              };
              img.onerror = () => {
                console.error('Failed to load branch trend image');
                resolve();
              };
              setTimeout(resolve, 2000);
            });
          } catch (e) {
            console.error('Error adding branch trend chart:', e);
          }
        }
        yPosition += 55;
      }
      
      // Save PDF
      const fileName = `Patient_Analytics_Report_${now.toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      console.log('PDF generated successfully');
      setLoading(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert(`Failed to generate PDF: ${error.message}. Please try again.`);
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6">
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-section {
            page-break-inside: avoid;
          }
        }
      `}</style>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 no-print">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2 sm:mb-0">
          📊 Patient Analytics
        </h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex flex-wrap gap-2">
            <select
              value={timeFilter}
              onChange={(e) => {
                setTimeFilter(e.target.value);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Time</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom Date Range</option>
            </select>
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm disabled:opacity-50"
            >
              <FiRefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              disabled
              className="inline-flex items-center px-3 py-2 bg-gray-400 text-white rounded-md cursor-not-allowed opacity-50 text-sm"
              title="Print feature is currently disabled"
            >
              <FiPrinter className="mr-2 h-4 w-4" />
              Print
            </button>
            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              <FiDownload className="mr-2 h-4 w-4" />
              Download PDF
            </button>
          </div>
          
          {/* Custom Date Range Picker */}
          {timeFilter === 'custom' && (
            <div className="flex flex-wrap gap-2 items-center bg-gray-50 p-3 rounded-lg border border-gray-200 no-print">
              <div className="flex items-center gap-2">
                <FiCalendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">From:</span>
                <DatePicker
                  selected={customStartDate}
                  onChange={(date) => setCustomStartDate(date)}
                  selectsStart
                  startDate={customStartDate}
                  endDate={customEndDate}
                  maxDate={customEndDate || new Date()}
                  placeholderText="Start Date"
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  dateFormat="MMM d, yyyy"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">To:</span>
                <DatePicker
                  selected={customEndDate}
                  onChange={(date) => setCustomEndDate(date)}
                  selectsEnd
                  startDate={customStartDate}
                  endDate={customEndDate}
                  minDate={customStartDate}
                  maxDate={new Date()}
                  placeholderText="End Date"
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  dateFormat="MMM d, yyyy"
                />
              </div>
              <button
                onClick={() => {
                  if (customStartDate && customEndDate) {
                    fetchAnalytics();
                  }
                }}
                disabled={!customStartDate || !customEndDate || loading}
                className="inline-flex items-center px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiFilter className="mr-2 h-4 w-4" />
                Apply
              </button>
              {(customStartDate || customEndDate) && (
                <button
                  onClick={() => {
                    setCustomStartDate(null);
                    setCustomEndDate(null);
                    setTimeFilter('all');
                  }}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4 no-print">
        <nav className="-mb-px flex space-x-2 sm:space-x-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('appointments')}
            className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'appointments'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FiCalendar className="inline mr-2 h-4 w-4" />
            Appointment Analytics
          </button>
          <button
            onClick={() => setActiveTab('treatments')}
            className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'treatments'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FiBarChart2 className="inline mr-2 h-4 w-4" />
            Treatment Analytics
          </button>
          <button
            onClick={() => setActiveTab('branch')}
            className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'branch'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FiMapPin className="inline mr-2 h-4 w-4" />
            Branch Usage
          </button>
        </nav>
      </div>

      {/* Content */}
      <div id="patient-analytics-content">
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div>
          {/* Always render all sections for printing, but hide inactive ones */}
          <div style={{ display: activeTab === 'appointments' ? 'block' : 'none' }}>
            <div className="space-y-6">
              {/* Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Total Appointments</div>
                  <div className="text-2xl font-bold text-blue-600">{appointmentMetrics.total}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Completed</div>
                  <div className="text-2xl font-bold text-green-600">{appointmentMetrics.completed}</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Cancelled</div>
                  <div className="text-2xl font-bold text-red-600">{appointmentMetrics.cancelled}</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Avg. Days Between Visits</div>
                  <div className="text-2xl font-bold text-purple-600">{appointmentMetrics.avgTimeBetween}</div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-700">Appointment Trend</h3>
                  <div className="h-48">
                    <canvas ref={appointmentTrendRef} id="chart-appointmentTrend"></canvas>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-700">Completed vs Cancelled</h3>
                  <div className="h-48">
                    <canvas ref={appointmentComparisonRef} id="chart-appointmentComparison"></canvas>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: activeTab === 'treatments' ? 'block' : 'none' }}>
            <div className="space-y-6">
              {/* Most Common Treatments */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3 text-gray-700">Most Common Treatments</h3>
                <div className="space-y-2">
                  {treatmentMetrics.mostCommon.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">No treatment data available</div>
                  ) : (
                    treatmentMetrics.mostCommon.map((treatment, index) => (
                      <div key={index} className="flex items-center justify-between bg-white p-3 rounded">
                        <span className="text-sm font-medium text-gray-700">{treatment.name}</span>
                        <span className="text-sm text-gray-500">{treatment.count} time(s)</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Dentist Frequency */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3 text-gray-700">Dentists Most Frequently Visited</h3>
                <div className="space-y-2">
                  {treatmentMetrics.dentistFrequency.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">No data available</div>
                  ) : (
                    treatmentMetrics.dentistFrequency.map((dentist, index) => (
                      <div key={index} className="flex items-center justify-between bg-white p-3 rounded">
                        <div className="flex items-center">
                          <FiUser className="mr-2 h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">{dentist.name}</span>
                        </div>
                        <span className="text-sm text-gray-500">{dentist.count} visit(s)</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-700">Treatment Count Over Time</h3>
                  <div className="h-64">
                    <canvas ref={treatmentCountRef} id="chart-treatmentCount"></canvas>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-700">Treatment Distribution</h3>
                  <div className="h-64">
                    <canvas ref={treatmentPieRef} id="chart-treatmentPie"></canvas>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: activeTab === 'branch' ? 'block' : 'none' }}>
            <div className="space-y-6">
              {/* Branch Statistics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(branchMetrics.visitsPerBranch).map(([branch, visits]) => (
                  <div key={branch} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <FiMapPin className="mr-2 h-5 w-5 text-primary-600" />
                        <span className="text-lg font-semibold text-gray-700">{branch}</span>
                      </div>
                      <span className="text-2xl font-bold text-primary-600">{visits}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {getBranchPercentage(branch)}% of total visits
                    </div>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full"
                        style={{ width: `${getBranchPercentage(branch)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-700">Branch Preference</h3>
                  <div className="h-64">
                    <canvas ref={branchUsageRef} id="chart-branchUsage"></canvas>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-700">Branch Visit Trend</h3>
                  <div className="h-64">
                    <canvas ref={branchTrendRef} id="chart-branchTrend"></canvas>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default PatientAnalytics;

