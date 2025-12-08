// src/components/patient/PatientAnalytics.jsx
import { useState, useEffect, useRef } from 'react';
import { FiBarChart2, FiPieChart, FiTrendingUp, FiRefreshCw, FiMapPin, FiUser, FiCalendar, FiFilter, FiPrinter, FiDownload } from 'react-icons/fi';
import { Chart } from 'chart.js/auto';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import supabase from '../../config/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../common/LoadingSpinner';
import { getLogoBase64DataURL } from '../../utils/logoBase64';

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
        console.log('Filter changed, fetching all analytics with filter:', timeFilter);
        fetchAllAnalytics();
      }
    }
  }, [user, timeFilter]);

  // Resize and re-render charts when tab becomes active
  useEffect(() => {
    const handleTabChange = async () => {
      // Wait for DOM to update
      await new Promise(resolve => setTimeout(resolve, 150));

      // Resize existing charts
      if (activeTab === 'appointments') {
        if (window.appointmentTrend && typeof window.appointmentTrend.resize === 'function') {
          window.appointmentTrend.resize();
        }
        if (window.appointmentComparison && typeof window.appointmentComparison.resize === 'function') {
          window.appointmentComparison.resize();
        }
        // Re-render if charts don't exist
        if (!window.appointmentTrend && (appointmentMetrics.trend.length > 0 || appointmentMetrics.total > 0)) {
          renderAppointmentCharts();
        }
      } else if (activeTab === 'treatments') {
        if (window.treatmentCount && typeof window.treatmentCount.resize === 'function') {
          window.treatmentCount.resize();
        }
        if (window.treatmentPie && typeof window.treatmentPie.resize === 'function') {
          window.treatmentPie.resize();
        }
        // Re-render if charts don't exist
        if (!window.treatmentCount && (treatmentMetrics.countByTimeframe.length > 0 || treatmentMetrics.mostCommon.length > 0)) {
          renderTreatmentCharts();
        }
      } else if (activeTab === 'branch') {
        if (window.branchUsage && typeof window.branchUsage.resize === 'function') {
          window.branchUsage.resize();
        }
        if (window.branchTrend && typeof window.branchTrend.resize === 'function') {
          window.branchTrend.resize();
        }
        // Re-render if charts don't exist
        if (!window.branchTrend && (branchMetrics.branchTrend.length > 0 || Object.keys(branchMetrics.visitsPerBranch).length > 0)) {
          renderBranchCharts();
        }
      }
    };

    handleTabChange();
  }, [activeTab, appointmentMetrics, treatmentMetrics, branchMetrics]);

  useEffect(() => {
    // Don't render charts while loading - wait for data to be ready
    if (loading) {
      console.log('Still loading, skipping chart rendering');
      return;
    }

    // Render all charts when data is available
    // Since all sections are now always in DOM (using visibility instead of display:none),
    // we can directly render charts without needing to show/hide sections
    const renderAllCharts = async () => {
      // Wait for DOM to be ready - use polling to wait for canvas elements
      const waitForCanvasElements = async (maxAttempts = 10) => {
        const canvasIds = [
          'chart-appointmentTrend',
          'chart-appointmentComparison',
          'chart-treatmentCount',
          'chart-treatmentPie',
          'chart-branchUsage',
          'chart-branchTrend'
        ];

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          let foundCount = 0;
          canvasIds.forEach(id => {
            if (document.getElementById(id)) {
              foundCount++;
            }
          });

          if (foundCount === canvasIds.length) {
            console.log(`✓ All ${canvasIds.length} canvas elements found on attempt ${attempt + 1}`);
            return true;
          }

          if (attempt < maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }

        // Final check
        let foundCount = 0;
        canvasIds.forEach(id => {
          const canvas = document.getElementById(id);
          if (canvas) {
            foundCount++;
            console.log(`✓ Found canvas: ${id}`);
          } else {
            console.warn(`✗ Canvas ${id} not found`);
          }
        });

        console.log(`Found ${foundCount} of ${canvasIds.length} canvas elements after ${maxAttempts} attempts`);
        return foundCount > 0;
      };

      // Check if we have any data to render
      const hasAppointmentData = appointmentMetrics.trend.length > 0 || appointmentMetrics.total > 0;
      const hasTreatmentData = treatmentMetrics.countByTimeframe.length > 0 || treatmentMetrics.mostCommon.length > 0;
      const hasBranchData = branchMetrics.branchTrend.length > 0 || Object.keys(branchMetrics.visitsPerBranch).length > 0;

      if (!hasAppointmentData && !hasTreatmentData && !hasBranchData) {
        console.log('No analytics data available yet, skipping chart rendering');
        return;
      }

      console.log('Starting chart rendering process...');

      // Wait for canvas elements to appear in DOM
      const canvasIds = [
        'chart-appointmentTrend',
        'chart-appointmentComparison',
        'chart-treatmentCount',
        'chart-treatmentPie',
        'chart-branchUsage',
        'chart-branchTrend'
      ];

      const elementsReady = await waitForCanvasElements(15); // Try for up to 3 seconds

      if (!elementsReady) {
        console.error('Canvas elements not found after waiting. Charts cannot be rendered.');
        return;
      }

      // Ensure canvas parent containers have dimensions
      canvasIds.forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas) {
          const canvasParent = canvas.parentElement;
          if (canvasParent) {
            const rect = canvasParent.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
              // Set minimum dimensions
              canvasParent.style.minWidth = '400px';
              canvasParent.style.minHeight = '300px';
              console.log(`Set min dimensions for ${id} parent`);
            }
          }
        }
      });

      // Wait a bit more for layout to settle
      await new Promise(resolve => setTimeout(resolve, 300));

      // Render all charts
      console.log('Rendering all charts...');
      if (hasAppointmentData) {
        renderAppointmentCharts();
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      
      if (hasTreatmentData) {
        renderTreatmentCharts();
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      
      if (hasBranchData) {
        renderBranchCharts();
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      // Wait for charts to fully render
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('All charts rendered successfully!');
    };

    // Wait a bit longer to ensure DOM is fully ready
    const timeoutId = setTimeout(() => {
      renderAllCharts();
    }, 500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [appointmentMetrics, treatmentMetrics, branchMetrics, loading]);

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

  // Fetch all analytics data (like printing function does)
  const fetchAllAnalytics = async () => {
    setLoading(true);
    try {
      console.log('Fetching all analytics data with filter:', timeFilter);
      // Fetch all analytics data in parallel
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
      
      // Update state with fetched data
      setAppointmentMetrics(apptMetrics);
      setTreatmentMetrics(treatMetrics);
      setBranchMetrics(branchMetricsData);
      
      console.log('All analytics data fetched successfully');
    } catch (error) {
      console.error('Error fetching all analytics:', error);
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
    
    // If still not found, search more broadly
    if (!trendCanvas) {
      const contentContainer = document.getElementById('patient-analytics-content');
      if (contentContainer) {
        trendCanvas = contentContainer.querySelector('#chart-appointmentTrend');
      }
    }
    
    if (trendCanvas && metrics.trend && metrics.trend.length > 0) {
      // Ensure canvas has dimensions before rendering
      if (trendCanvas.width === 0 || trendCanvas.height === 0) {
        const parent = trendCanvas.parentElement;
        if (parent) {
          const computedStyle = window.getComputedStyle(parent);
          const width = parseInt(computedStyle.width) || 400;
          const height = parseInt(computedStyle.height) || 200;
          const dpr = window.devicePixelRatio || 1;
          trendCanvas.width = width * dpr;
          trendCanvas.height = height * dpr;
          trendCanvas.style.width = width + 'px';
          trendCanvas.style.height = height + 'px';
        }
      }
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
    
    // If still not found, search more broadly
    if (!comparisonCanvas) {
      const contentContainer = document.getElementById('patient-analytics-content');
      if (contentContainer) {
        comparisonCanvas = contentContainer.querySelector('#chart-appointmentComparison');
      }
    }
    
    if (comparisonCanvas && metrics.total >= 0) {
      // Ensure canvas has dimensions before rendering
      if (comparisonCanvas.width === 0 || comparisonCanvas.height === 0) {
        const parent = comparisonCanvas.parentElement;
        if (parent) {
          const computedStyle = window.getComputedStyle(parent);
          const width = parseInt(computedStyle.width) || 400;
          const height = parseInt(computedStyle.height) || 200;
          const dpr = window.devicePixelRatio || 1;
          comparisonCanvas.width = width * dpr;
          comparisonCanvas.height = height * dpr;
          comparisonCanvas.style.width = width + 'px';
          comparisonCanvas.style.height = height + 'px';
        }
      }
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
    
    // If still not found, search more broadly
    if (!treatmentCountCanvas) {
      const contentContainer = document.getElementById('patient-analytics-content');
      if (contentContainer) {
        treatmentCountCanvas = contentContainer.querySelector('#chart-treatmentCount');
      }
    }
    
    if (treatmentCountCanvas && metrics.countByTimeframe && metrics.countByTimeframe.length > 0) {
      // Ensure canvas has dimensions before rendering
      if (treatmentCountCanvas.width === 0 || treatmentCountCanvas.height === 0) {
        const parent = treatmentCountCanvas.parentElement;
        if (parent) {
          const computedStyle = window.getComputedStyle(parent);
          const width = parseInt(computedStyle.width) || 400;
          const height = parseInt(computedStyle.height) || 200;
          const dpr = window.devicePixelRatio || 1;
          treatmentCountCanvas.width = width * dpr;
          treatmentCountCanvas.height = height * dpr;
          treatmentCountCanvas.style.width = width + 'px';
          treatmentCountCanvas.style.height = height + 'px';
        }
      }
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
    
    // If still not found, search more broadly
    if (!treatmentPieCanvas) {
      const contentContainer = document.getElementById('patient-analytics-content');
      if (contentContainer) {
        treatmentPieCanvas = contentContainer.querySelector('#chart-treatmentPie');
      }
    }
    
    if (treatmentPieCanvas && metrics.mostCommon && metrics.mostCommon.length > 0) {
      // Ensure canvas has dimensions before rendering
      if (treatmentPieCanvas.width === 0 || treatmentPieCanvas.height === 0) {
        const parent = treatmentPieCanvas.parentElement;
        if (parent) {
          const computedStyle = window.getComputedStyle(parent);
          const width = parseInt(computedStyle.width) || 400;
          const height = parseInt(computedStyle.height) || 200;
          const dpr = window.devicePixelRatio || 1;
          treatmentPieCanvas.width = width * dpr;
          treatmentPieCanvas.height = height * dpr;
          treatmentPieCanvas.style.width = width + 'px';
          treatmentPieCanvas.style.height = height + 'px';
        }
      }
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
    
    // If still not found, search more broadly
    if (!branchUsageCanvas) {
      const contentContainer = document.getElementById('patient-analytics-content');
      if (contentContainer) {
        branchUsageCanvas = contentContainer.querySelector('#chart-branchUsage');
      }
    }
    
    if (branchUsageCanvas && metrics.visitsPerBranch && Object.keys(metrics.visitsPerBranch).length > 0) {
      // Ensure canvas has dimensions before rendering
      if (branchUsageCanvas.width === 0 || branchUsageCanvas.height === 0) {
        const parent = branchUsageCanvas.parentElement;
        if (parent) {
          const computedStyle = window.getComputedStyle(parent);
          const width = parseInt(computedStyle.width) || 400;
          const height = parseInt(computedStyle.height) || 200;
          const dpr = window.devicePixelRatio || 1;
          branchUsageCanvas.width = width * dpr;
          branchUsageCanvas.height = height * dpr;
          branchUsageCanvas.style.width = width + 'px';
          branchUsageCanvas.style.height = height + 'px';
        }
      }
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
    
    // If still not found, search more broadly
    if (!branchTrendCanvas) {
      const contentContainer = document.getElementById('patient-analytics-content');
      if (contentContainer) {
        branchTrendCanvas = contentContainer.querySelector('#chart-branchTrend');
      }
    }
    
    if (branchTrendCanvas && metrics.branchTrend && metrics.branchTrend.length > 0) {
      // Ensure canvas has dimensions before rendering
      if (branchTrendCanvas.width === 0 || branchTrendCanvas.height === 0) {
        const parent = branchTrendCanvas.parentElement;
        if (parent) {
          const computedStyle = window.getComputedStyle(parent);
          const width = parseInt(computedStyle.width) || 400;
          const height = parseInt(computedStyle.height) || 200;
          const dpr = window.devicePixelRatio || 1;
          branchTrendCanvas.width = width * dpr;
          branchTrendCanvas.height = height * dpr;
          branchTrendCanvas.style.width = width + 'px';
          branchTrendCanvas.style.height = height + 'px';
        }
      }
      const ctx = branchTrendCanvas.getContext('2d');
      if (window.branchTrend) {
        window.branchTrend.destroy();
      }

      const branches = [...new Set(metrics.branchTrend.map(t => t.branch))];
      const dates = [...new Set(metrics.branchTrend.map(t => t.date))].sort();

      const datasets = branches.map((branch, index) => {
        const colors = ['#3b82f6', '#10b981', '#f59e0b'];
        return {
          label: branch,
          data: dates.map(date => {
            const item = metrics.branchTrend.find(t => t.date === date && t.branch === branch);
            return item ? item.count : 0;
          }),
          borderColor: colors[index % colors.length],
          backgroundColor: colors[index % colors.length] + '40',
          tension: 0.3
        };
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
  const buildReportHTML = (chartImages, apptMetrics, treatMetrics, branchMetricsData, printDate, logoDataURL = '') => {
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
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .print-header .logo {
              height: 40px;
              width: auto;
              flex-shrink: 0;
            }
            .print-header .header-content {
              flex: 1;
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
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .print-header .logo {
            height: 50px;
            width: auto;
            flex-shrink: 0;
          }
          .print-header .header-content {
            flex: 1;
          }
          .print-header h1 {
            margin: 0;
            font-size: 18pt;
          }
        </style>
      </head>
        <body>
          <div class="print-header">
            ${logoDataURL && logoDataURL !== 'data:,' ? `<img src="${logoDataURL}" alt="Silario Clinic Logo" class="logo" />` : ''}
            <div class="header-content">
              <h1>Patient Analytics Report</h1>
              <div class="filter-info">
                <strong>Filter:</strong> ${getFilterDisplayText()}
              </div>
              <div class="print-date">
                <strong>Generated:</strong> ${printDate}
              </div>
            </div>
          </div>
        ${buildAppointmentSection()}
        ${buildTreatmentSection()}
        ${buildBranchSection()}
      </body>
    </html>
  `;
  };

  const handlePrint = async () => {
    try {
      console.log('Starting print process...');
      // Don't set loading to true - it will hide the content sections and canvas elements!
      // We need the canvas elements to remain in the DOM for printing

      // Fetch all analytics data for all tabs
      console.log('Fetching analytics data...');
      const [apptMetrics, treatMetrics, branchMetricsData] = await Promise.all([
        fetchAppointmentAnalytics().catch(e => { console.error('Appointment fetch error:', e); return { total: 0, completed: 0, cancelled: 0, trend: [], avgTimeBetween: 0 }; }),
        fetchTreatmentAnalytics().catch(e => { console.error('Treatment fetch error:', e); return { mostCommon: [], countByTimeframe: [], dentistFrequency: [] }; }),
        fetchBranchAnalytics().catch(e => { console.error('Branch fetch error:', e); return { visitsPerBranch: {}, branchTrend: [] }; })
      ]);
      
      // Update state with fetched data and wait for React to process
      setAppointmentMetrics(apptMetrics);
      setTreatmentMetrics(treatMetrics);
      setBranchMetrics(branchMetricsData);
      
      // Wait for React state to update and component to re-render
      await new Promise(resolve => setTimeout(resolve, 300));
      
      console.log('Analytics data fetched and ready');

      // FIRST: Make all tab sections visible so canvas elements exist in DOM
      const contentContainer = document.getElementById('patient-analytics-content');
      if (!contentContainer) {
        throw new Error('Analytics content container not found');
      }
      
      // Find all sections that have inline display styles (the tab content divs)
      // They are direct children of a div inside #patient-analytics-content
      const wrapperDiv = contentContainer.querySelector('div:not(.border-b)'); // Get the content wrapper, not the tabs nav
      console.log('Wrapper div found:', !!wrapperDiv);
      
      // Try multiple ways to find sections
      let allSections = [];
      if (wrapperDiv) {
        // Method 1: Direct children with style attribute
        allSections = Array.from(wrapperDiv.children).filter(child => {
          const hasStyle = child.hasAttribute('style');
          const styleAttr = hasStyle ? child.getAttribute('style') : '';
          return hasStyle && styleAttr.includes('display');
        });
      }
      
      // Method 2: If not found, try querySelector for divs with inline styles
      if (allSections.length === 0) {
        const sectionsWithStyle = contentContainer.querySelectorAll('div[style*="display"]');
        allSections = Array.from(sectionsWithStyle);
      }
      
      // Method 3: Find all divs that might be sections (children of wrapper)
      if (allSections.length === 0 && wrapperDiv) {
        allSections = Array.from(wrapperDiv.children);
      }
      
      console.log(`Found ${allSections.length} tab sections in DOM`);
      
      // Store original styles for restoration
      const sectionStyles = new Map();
      
      // Make ALL sections visible (but off-screen) so canvas elements are rendered
      allSections.forEach((section, index) => {
        const computed = getComputedStyle(section);
        sectionStyles.set(section, {
          display: section.style.display || computed.display,
          visibility: section.style.visibility || computed.visibility,
          position: section.style.position || computed.position,
          left: section.style.left || computed.left,
          top: section.style.top || computed.top,
          width: section.style.width || computed.width,
          height: section.style.height || computed.height,
          zIndex: section.style.zIndex || computed.zIndex,
          opacity: section.style.opacity || computed.opacity,
          pointerEvents: section.style.pointerEvents || computed.pointerEvents,
          transform: section.style.transform || computed.transform
        });
        
        // Make visible but off-screen
        section.style.display = 'block';
        section.style.visibility = 'visible';
        section.style.position = 'absolute';
        section.style.left = '-9999px';
        section.style.top = '0';
        section.style.width = '800px';
        section.style.minHeight = '600px';
        section.style.opacity = '1';
        section.style.zIndex = '0';
        section.style.pointerEvents = 'none';
      });
      
      // Force layout recalculation so DOM updates
      void document.body.offsetHeight;
      
      // Wait a bit for React to process the style changes
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if any canvas elements exist at all in the content area
      const allCanvasesInContent = contentContainer.querySelectorAll('canvas');
      console.log(`Total canvas elements found in content area: ${allCanvasesInContent.length}`);
      
      // List all canvas IDs found
      allCanvasesInContent.forEach(canvas => {
        console.log(`  - Canvas ID: ${canvas.id || '(no id)'}, tagName: ${canvas.tagName}`);
      });
      
      // NOW find all canvas elements - they should exist now
      const canvasIds = [
        'chart-appointmentTrend',
        'chart-appointmentComparison',
        'chart-treatmentCount',
        'chart-treatmentPie',
        'chart-branchUsage',
        'chart-branchTrend'
      ];
      
      // Ensure all canvas parent containers have dimensions
      let foundCanvasCount = 0;
      canvasIds.forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas) {
          foundCanvasCount++;
          console.log(`✓ Found canvas: ${id}`);
          const canvasParent = canvas.parentElement;
          if (canvasParent) {
            const rect = canvasParent.getBoundingClientRect();
            console.log(`  Canvas ${id} parent dimensions: ${rect.width}x${rect.height}`);
            if (rect.width === 0 || rect.height === 0) {
              canvasParent.style.minWidth = '400px';
              canvasParent.style.minHeight = '300px';
              console.log(`  Set min dimensions for ${id} parent`);
            }
          }
        } else {
          console.warn(`✗ Canvas ${id} still not found after making sections visible`);
        }
      });
      
      console.log(`Found ${foundCanvasCount} of ${canvasIds.length} canvas elements`);
      
      // Force another layout recalculation
      void document.body.offsetHeight;
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Now render all charts with the fetched data
      console.log('Rendering all charts...');
      renderAppointmentCharts(apptMetrics);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      renderTreatmentCharts(treatMetrics);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      renderBranchCharts(branchMetricsData);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Wait for all charts to fully render and update
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('All charts should be rendered now');

      // Get current date and time
      const now = new Date();
      const printDate = now.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Convert charts to images - use both refs and direct DOM queries as fallback
      const chartImages = {};
      const chartConfigs = [
        { name: 'appointmentTrend', ref: appointmentTrendRef, id: 'chart-appointmentTrend' },
        { name: 'appointmentComparison', ref: appointmentComparisonRef, id: 'chart-appointmentComparison' },
        { name: 'treatmentCount', ref: treatmentCountRef, id: 'chart-treatmentCount' },
        { name: 'treatmentPie', ref: treatmentPieRef, id: 'chart-treatmentPie' },
        { name: 'branchUsage', ref: branchUsageRef, id: 'chart-branchUsage' },
        { name: 'branchTrend', ref: branchTrendRef, id: 'chart-branchTrend' }
      ];

      console.log('Converting charts to images...');
      
      for (const config of chartConfigs) {
        try {
          let canvas = null;
          
          // Try to get canvas from ref first
          if (config.ref && config.ref.current) {
            canvas = config.ref.current;
            console.log(`Found ${config.name} via ref`);
          } else {
            // Fallback: try to find canvas by ID
            const canvasElement = document.getElementById(config.id);
            if (canvasElement) {
              canvas = canvasElement;
              console.log(`Found ${config.name} via DOM query`);
            }
          }
          
          if (!canvas) {
            console.warn(`Chart ${config.name} canvas not found (ref or DOM)`);
            continue;
          }
          
          // Check if we have a Chart.js instance
          const chartInstance = window[config.name];
          if (chartInstance) {
            console.log(`Found chart instance for ${config.name}`);
            // Force chart to update and render
            try {
              if (typeof chartInstance.resize === 'function') {
                chartInstance.resize();
              }
              if (typeof chartInstance.update === 'function') {
                chartInstance.update('none');
              }
              await new Promise(resolve => setTimeout(resolve, 200));
            } catch (updateError) {
              console.warn(`Error updating chart ${config.name}:`, updateError);
            }
          } else {
            // Chart instance not found, but we have canvas - try to render it
            console.warn(`No chart instance found for ${config.name}, but canvas exists`);
          }
          
          // Get canvas dimensions from parent if needed
          if (canvas.width === 0 || canvas.height === 0) {
            const parent = canvas.parentElement;
            if (parent) {
              const rect = parent.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                const dpr = window.devicePixelRatio || 1;
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.scale(dpr, dpr);
                }
                // Try to resize chart instance if it exists
                if (chartInstance && typeof chartInstance.resize === 'function') {
                  chartInstance.resize();
                  await new Promise(resolve => setTimeout(resolve, 200));
                }
              }
            }
          }
          
          // Convert canvas to image
          if (canvas.width > 0 && canvas.height > 0) {
            try {
              const dataUrl = canvas.toDataURL('image/png', 1.0);
              if (dataUrl && dataUrl !== 'data:,') {
                chartImages[config.name] = dataUrl;
                console.log(`✓ Successfully converted ${config.name} (${canvas.width}x${canvas.height})`);
              } else {
                console.warn(`Chart ${config.name} produced empty data URL`);
              }
            } catch (conversionError) {
              console.error(`Error converting ${config.name} to image:`, conversionError);
            }
          } else {
            console.warn(`Chart ${config.name} has invalid dimensions: ${canvas.width}x${canvas.height}`);
          }
        } catch (error) {
          console.error(`Error processing ${config.name}:`, error);
        }
      }
      
      console.log(`Chart images converted: ${Object.keys(chartImages).length} of ${chartConfigs.length}`);
      console.log('Successfully converted charts:', Object.keys(chartImages));
      
      // Restore original tab visibility
      sectionStyles.forEach((style, section) => {
        section.style.display = style.display || '';
        section.style.visibility = style.visibility || '';
        section.style.position = style.position || '';
        section.style.left = style.left || '';
        section.style.top = style.top || '';
        section.style.width = style.width || '';
        section.style.height = style.height || '';
        section.style.zIndex = style.zIndex || '';
        section.style.opacity = style.opacity || '';
        section.style.pointerEvents = style.pointerEvents || '';
        section.style.transform = style.transform || '';
      });
      
      // Also restore any temporary parent container styles
      canvasIds.forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas && canvas.parentElement) {
          canvas.parentElement.style.minWidth = '';
          canvas.parentElement.style.minHeight = '';
        }
      });

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

      // Get logo as base64 for print
      console.log('Getting logo...');
      const logoDataURL = await getLogoBase64DataURL();

      // Create print HTML with all sections
      console.log('Building print HTML...');
      const printHTML = `
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
                display: flex;
                align-items: center;
                gap: 10px;
              }
              .print-header .logo {
                height: 40px;
                width: auto;
                flex-shrink: 0;
              }
              .print-header .header-content {
                flex: 1;
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
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .print-header .logo {
              height: 50px;
              width: auto;
              flex-shrink: 0;
            }
            .print-header .header-content {
              flex: 1;
            }
            .print-header h1 {
              margin: 0;
              font-size: 18pt;
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            ${logoDataURL && logoDataURL !== 'data:,' ? `<img src="${logoDataURL}" alt="Silario Clinic Logo" class="logo" />` : ''}
            <div class="header-content">
              <h1>Patient Analytics Report</h1>
              <div class="filter-info">
                <strong>Filter:</strong> ${getFilterDisplayText()}
              </div>
              <div class="print-date">
                <strong>Generated:</strong> ${printDate}
              </div>
            </div>
          </div>
          ${buildAppointmentSection()}
          ${buildTreatmentSection()}
          ${buildBranchSection()}
        </body>
      </html>
    `;

      // Create blob URL and open in new window/tab
      console.log('Creating print document...');
      const blob = new Blob([printHTML], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      
      // Iframe fallback method (defined first so it's in scope)
      const useIframeMethod = () => {
        console.log('Using iframe method...');
        const existingIframe = document.getElementById('print-iframe');
        if (existingIframe) {
          existingIframe.remove();
        }
        
        const iframe = document.createElement('iframe');
        iframe.id = 'print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        iframe.style.opacity = '0';
        iframe.style.pointerEvents = 'none';
        document.body.appendChild(iframe);
        
        iframe.onload = () => {
          setTimeout(() => {
            try {
              iframe.contentWindow.focus();
              iframe.contentWindow.print();
              console.log('Print triggered via iframe');
              setTimeout(() => {
                if (iframe && iframe.parentNode) {
                  iframe.remove();
                }
                setLoading(false);
                URL.revokeObjectURL(blobUrl);
              }, 1000);
            } catch (e) {
              console.error('Iframe print error:', e);
              if (iframe && iframe.parentNode) {
                iframe.remove();
              }
              setLoading(false);
              URL.revokeObjectURL(blobUrl);
            }
          }, 500);
        };
        
        // Write content
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(printHTML);
        iframeDoc.close();
        
        // Fallback timeout
        setTimeout(() => {
          try {
            if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
              iframe.contentWindow.focus();
              iframe.contentWindow.print();
              setTimeout(() => {
                if (iframe && iframe.parentNode) {
                  iframe.remove();
                }
                setLoading(false);
                URL.revokeObjectURL(blobUrl);
              }, 1000);
            } else {
              throw new Error('Iframe not ready');
            }
          } catch (e) {
            console.error('Iframe print failed:', e);
            alert('Unable to open print dialog automatically. The report has been prepared. Please check if a new tab opened, or use your browser\'s print function (Ctrl+P / Cmd+P).');
            if (iframe && iframe.parentNode) {
              iframe.remove();
            }
            setLoading(false);
            URL.revokeObjectURL(blobUrl);
          }
        }, 2000);
      };
      
      // Try to open in new window - if blocked, use iframe fallback
      let printWindow = null;
      let printTriggered = false;
      
      const triggerPrint = () => {
        if (printTriggered) return; // Prevent multiple print calls
        printTriggered = true;
        try {
          if (printWindow && !printWindow.closed) {
            printWindow.focus();
            printWindow.print();
            setLoading(false);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
          }
        } catch (e) {
          console.error('Print error:', e);
          setLoading(false);
          URL.revokeObjectURL(blobUrl);
        }
      };
      
      try {
        printWindow = window.open(blobUrl, '_blank');
        if (printWindow && !printWindow.closed) {
          console.log('Print window opened successfully');
          
          // Wait for window to load and then print
          const printWhenReady = () => {
            try {
              if (printWindow && printWindow.document && printWindow.document.readyState === 'complete') {
                triggerPrint();
              } else {
                // If not ready yet, wait a bit more (max 10 attempts = 2 seconds)
                const attempts = printWhenReady.attempts || 0;
                if (attempts < 10) {
                  printWhenReady.attempts = attempts + 1;
                  setTimeout(printWhenReady, 200);
                } else {
                  // Timeout - try to print anyway
                  triggerPrint();
                }
              }
            } catch (e) {
              console.error('Error checking print window readiness:', e);
              triggerPrint();
            }
          };
          
          // Start checking after a short delay
          setTimeout(printWhenReady, 500);
          
          // Fallback timeout in case window doesn't load properly
          setTimeout(() => {
            if (!printTriggered) {
              triggerPrint();
            }
          }, 2500);
        } else {
          // Pop-up blocked, use iframe
          console.warn('Pop-up blocked, using iframe method');
          useIframeMethod();
        }
      } catch (e) {
        console.warn('Window.open failed, using iframe:', e);
        useIframeMethod();
      }
    } catch (error) {
      console.error('Error printing analytics:', error);
      console.error('Error stack:', error.stack);
      alert(`Failed to print analytics: ${error.message}. Please try again.`);
      setLoading(false);
    }
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
      
      // Step 2: Update state and wait for React to render ALL sections
      const originalActiveTab = activeTab;
      
      // Update metrics
      setAppointmentMetrics(apptMetrics);
      setTreatmentMetrics(treatMetrics);
      setBranchMetrics(branchMetricsData);
      
      // CRITICAL: Force React to render all sections by temporarily showing all tabs
      // We need to manipulate the DOM directly to show all sections
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Step 3: Make all tab sections visible temporarily
      const contentContainer = document.getElementById('patient-analytics-content');
      if (!contentContainer) {
        throw new Error('Analytics content container not found');
      }
      
      const wrapperDiv = contentContainer.querySelector('div:not(.border-b)');
      if (!wrapperDiv) {
        throw new Error('Content wrapper not found');
      }
      
      // Find ALL sections - they are direct children divs with inline styles
      // React renders them all but hides inactive ones with display: none
      let allSections = Array.from(wrapperDiv.children).filter(child => 
        child.tagName === 'DIV'
      );
      
      // If no direct children, try querySelectorAll
      if (allSections.length === 0) {
        allSections = Array.from(wrapperDiv.querySelectorAll('div[style]'));
      }
      
      // Also search more broadly
      if (allSections.length === 0) {
        allSections = Array.from(contentContainer.querySelectorAll('div[style*="display"]'));
      }
      
      console.log(`Found ${allSections.length} sections to make visible`);
      
      // Log section details
      allSections.forEach((section, idx) => {
        const canvases = section.querySelectorAll('canvas');
        console.log(`Section ${idx}: ${canvases.length} canvases, display: ${section.style.display || 'not set'}`);
      });
      
      const originalStyles = new Map();
      allSections.forEach((section, idx) => {
        // Save original style
        const originalStyle = section.getAttribute('style') || '';
        originalStyles.set(section, originalStyle);
        
        // Remove any display:none and make visible with proper dimensions
        // Use fixed positioning off-screen but with proper dimensions
        section.style.cssText = 'display: block !important; visibility: visible !important; position: fixed !important; left: -10000px !important; top: 0 !important; width: 800px !important; min-height: 600px !important; opacity: 1 !important; z-index: -1 !important; height: auto !important;';
        
        // Find and ensure all canvas containers have dimensions
        const canvasContainers = section.querySelectorAll('div');
        canvasContainers.forEach(div => {
          const hasCanvas = div.querySelector('canvas');
          if (hasCanvas) {
            // Ensure container has dimensions
            const computedStyle = window.getComputedStyle(div);
            const currentHeight = parseInt(computedStyle.height);
            const currentWidth = parseInt(computedStyle.width);
            
            if (currentHeight === 0 || isNaN(currentHeight)) {
              div.style.height = '200px';
              div.style.minHeight = '200px';
            }
            if (currentWidth === 0 || isNaN(currentWidth)) {
              div.style.width = '100%';
              div.style.minWidth = '400px';
            }
            
            // Also ensure canvas elements themselves are visible
            const canvases = div.querySelectorAll('canvas');
            canvases.forEach(canvas => {
              canvas.style.display = 'block';
              canvas.style.visibility = 'visible';
              // Set initial dimensions
              if (canvas.width === 0 || canvas.height === 0) {
                canvas.width = 400;
                canvas.height = 200;
                canvas.style.width = '400px';
                canvas.style.height = '200px';
              }
            });
          }
        });
      });
      
      // Force multiple reflows to ensure styles are applied
      void contentContainer.offsetHeight;
      void wrapperDiv.offsetHeight;
      allSections.forEach(section => {
        void section.offsetHeight;
        // Force reflow on all child elements
        section.querySelectorAll('*').forEach(el => void el.offsetHeight);
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Now find and set dimensions on all canvas elements
      // Search in multiple ways to ensure we find them
      let initialCanvases = document.querySelectorAll('canvas');
      
      // Also search specifically in our sections
      allSections.forEach(section => {
        const sectionCanvases = section.querySelectorAll('canvas');
        console.log(`Section has ${sectionCanvases.length} canvases`);
      });
      
      // If no canvases found, they might not be rendered yet - wait and try again
      if (initialCanvases.length === 0) {
        console.warn('No canvases found initially, waiting for React to render...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        initialCanvases = document.querySelectorAll('canvas');
        console.log(`After wait: Found ${initialCanvases.length} canvas elements`);
      }
      
      console.log(`Found ${initialCanvases.length} canvas elements in document`);
      
      // Create a map of canvas IDs to canvases for easy lookup
      const canvasMap = new Map();
      initialCanvases.forEach((canvas) => {
        if (canvas.id) {
          canvasMap.set(canvas.id, canvas);
        }
      });
      
      // Ensure all required canvases exist and have dimensions
      // Use the requiredCanvasIds array defined earlier
      const canvasIdsList = [
        'chart-appointmentTrend',
        'chart-appointmentComparison',
        'chart-treatmentCount',
        'chart-treatmentPie',
        'chart-branchUsage',
        'chart-branchTrend'
      ];
      
      canvasIdsList.forEach(id => {
        let canvas = canvasMap.get(id) || document.getElementById(id);
        
        if (!canvas) {
          // Try to find in sections
          for (const section of allSections) {
            canvas = section.querySelector(`#${id}`);
            if (canvas) break;
          }
        }
        
        if (canvas) {
          // Get dimensions from parent
          let width = 400;
          let height = 200;
          
          let parent = canvas.parentElement;
          let attempts = 0;
          while (parent && attempts < 5) {
            const computedStyle = window.getComputedStyle(parent);
            const parentWidth = parseInt(computedStyle.width);
            const parentHeight = parseInt(computedStyle.height);
            
            if (parentWidth > 0 && parentHeight > 0) {
              width = parentWidth;
              height = parentHeight;
              break;
            }
            parent = parent.parentElement;
            attempts++;
          }
          
          // Set canvas dimensions explicitly with device pixel ratio
          const dpr = window.devicePixelRatio || 1;
          canvas.width = width * dpr;
          canvas.height = height * dpr;
          canvas.style.width = width + 'px';
          canvas.style.height = height + 'px';
          canvas.style.display = 'block';
          canvas.style.visibility = 'visible';
          
          console.log(`  Set ${id} dimensions to: ${canvas.width}x${canvas.height} (dpr: ${dpr})`);
        } else {
          console.warn(`  Canvas ${id} not found in DOM`);
        }
      });
      
      // Force another reflow after setting dimensions
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Step 4: Verify all canvas elements exist before rendering
      console.log('Checking for required canvas elements...');
      const missingCanvases = [];
      canvasIdsList.forEach(id => {
        const canvas = document.getElementById(id);
        if (!canvas) {
          missingCanvases.push(id);
          console.warn(`Missing canvas: ${id}`);
        } else {
          console.log(`✓ Found canvas: ${id} (${canvas.width}x${canvas.height})`);
        }
      });
      
      if (missingCanvases.length > 0) {
        console.warn(`Missing ${missingCanvases.length} canvas elements. Attempting to find them...`);
        // Try to find them in all sections
        allSections.forEach((section, idx) => {
          const sectionCanvases = section.querySelectorAll('canvas');
          console.log(`Section ${idx} canvases:`, Array.from(sectionCanvases).map(c => c.id || '(no id)'));
        });
      }
      
      // Step 5: Ensure all canvas elements have proper dimensions BEFORE rendering charts
      console.log('Setting dimensions on all canvas elements before rendering...');
      
      canvasIdsList.forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas) {
          // Get dimensions from parent or set defaults
          let width = 400;
          let height = 200;
          
          let parent = canvas.parentElement;
          let attempts = 0;
          while (parent && attempts < 5) {
            const computedStyle = window.getComputedStyle(parent);
            const parentWidth = parseInt(computedStyle.width);
            const parentHeight = parseInt(computedStyle.height);
            
            if (parentWidth > 0 && parentHeight > 0) {
              width = parentWidth;
              height = parentHeight;
              break;
            }
            parent = parent.parentElement;
            attempts++;
          }
          
          // Set canvas dimensions
          const dpr = window.devicePixelRatio || 1;
          canvas.width = width * dpr;
          canvas.height = height * dpr;
          canvas.style.width = width + 'px';
          canvas.style.height = height + 'px';
          
          console.log(`Set ${id} dimensions to: ${canvas.width}x${canvas.height}`);
        } else {
          console.warn(`Canvas ${id} not found when setting dimensions`);
        }
      });
      
      // Wait for dimensions to be applied
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 6: Render all charts
      console.log('Rendering all charts...');
      console.log('Chart instances before rendering:', {
        appointmentTrend: !!window.appointmentTrend,
        appointmentComparison: !!window.appointmentComparison,
        treatmentCount: !!window.treatmentCount,
        treatmentPie: !!window.treatmentPie,
        branchUsage: !!window.branchUsage,
        branchTrend: !!window.branchTrend
      });
      
      // Render charts with error handling
      try {
        renderAppointmentCharts(apptMetrics);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.error('Error rendering appointment charts:', e);
      }
      
      try {
        renderTreatmentCharts(treatMetrics);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.error('Error rendering treatment charts:', e);
      }
      
      try {
        renderBranchCharts(branchMetricsData);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.error('Error rendering branch charts:', e);
      }
      
      // Verify canvas dimensions after rendering
      console.log('Canvas dimensions after chart rendering:');
      canvasIdsList.forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas) {
          console.log(`  ${id}: ${canvas.width}x${canvas.height}`);
          // Fix dimensions if still 0x0
          if (canvas.width === 0 || canvas.height === 0) {
            console.warn(`  Fixing ${id} dimensions (was 0x0)`);
            canvas.width = 400;
            canvas.height = 200;
            const chartName = id.replace('chart-', '');
            const chartInstance = window[chartName];
            if (chartInstance && typeof chartInstance.resize === 'function') {
              chartInstance.resize();
            }
          }
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify charts were created
      console.log('Chart instances after rendering:', {
        appointmentTrend: !!window.appointmentTrend,
        appointmentComparison: !!window.appointmentComparison,
        treatmentCount: !!window.treatmentCount,
        treatmentPie: !!window.treatmentPie,
        branchUsage: !!window.branchUsage,
        branchTrend: !!window.branchTrend
      });
      
      // Verify canvas elements again after rendering
      console.log('Canvas elements after chart rendering:');
      canvasIdsList.forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas) {
          console.log(`  ${id}: ${canvas.width}x${canvas.height}, Chart instance: ${!!window[id.replace('chart-', '')]}`);
        } else {
          console.warn(`  ${id}: NOT FOUND`);
        }
      });
      
      // Additional wait to ensure all charts are fully rendered
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Force another reflow after chart rendering
      void contentContainer.offsetHeight;
      
      // Step 6: Convert charts to images (SIMPLE - directly from Chart.js instances)
      console.log('Converting charts to images...');
      const chartImages = {};
      
      // Simple function to convert chart to image
      const convertChartToImage = async (chartName, chartInstance) => {
        try {
          if (!chartInstance) {
            console.warn(`Chart instance ${chartName} not found`);
            return null;
          }
          
          // Get canvas from chart instance
          const canvas = chartInstance.canvas;
          if (!canvas) {
            console.warn(`Canvas not found for ${chartName}`);
            return null;
          }
          
          // Ensure canvas has valid dimensions
          if (canvas.width === 0 || canvas.height === 0) {
            // Set default dimensions based on chart type
            let width = 500;
            let height = 250;
            
            if (chartName.includes('Pie') || chartName.includes('Usage')) {
              width = 400;
              height = 400;
            }
            
            const dpr = window.devicePixelRatio || 1;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';
            
            // Update chart to render with new dimensions
            if (typeof chartInstance.resize === 'function') {
              chartInstance.resize();
            }
            if (typeof chartInstance.update === 'function') {
              chartInstance.update('none');
            }
            await new Promise(resolve => setTimeout(resolve, 400));
          }
          
          // Convert canvas to image
          if (canvas.width > 0 && canvas.height > 0) {
            const dataUrl = canvas.toDataURL('image/png', 1.0);
            if (dataUrl && dataUrl !== 'data:,' && dataUrl.length > 100) {
              console.log(`✓ Converted ${chartName} to image (${canvas.width}x${canvas.height})`);
              return dataUrl;
            } else {
              console.warn(`Chart ${chartName} produced invalid data URL`);
            }
          }
          
          return null;
        } catch (error) {
          console.error(`Error converting ${chartName}:`, error);
          return null;
        }
      };
      
      // Convert all charts directly from Chart.js instances
      chartImages.appointmentTrend = await convertChartToImage('appointmentTrend', window.appointmentTrend);
      chartImages.appointmentComparison = await convertChartToImage('appointmentComparison', window.appointmentComparison);
      chartImages.treatmentCount = await convertChartToImage('treatmentCount', window.treatmentCount);
      chartImages.treatmentPie = await convertChartToImage('treatmentPie', window.treatmentPie);
      chartImages.branchUsage = await convertChartToImage('branchUsage', window.branchUsage);
      chartImages.branchTrend = await convertChartToImage('branchTrend', window.branchTrend);
      
      const convertedCount = Object.values(chartImages).filter(img => img !== null).length;
      console.log(`Chart conversion complete. Successfully converted: ${convertedCount} of 6 charts`);
      
      // Step 7: Restore original styles
      originalStyles.forEach((style, section) => {
        section.style.cssText = style || '';
      });
      
      // Restore original active tab if we changed it
      if (originalActiveTab !== activeTab) {
        setActiveTab(originalActiveTab);
      }
      
      // Step 7: Get logo and build print HTML for PDF
      console.log('Getting logo for PDF...');
      const logoDataURL = await getLogoBase64DataURL();
      
      // Helper function to get image dimensions from base64
      const getImageDimensions = (dataUrl) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            resolve({ width: img.width, height: img.height });
          };
          img.onerror = () => {
            resolve({ width: 350, height: 200 }); // Default dimensions
          };
          img.src = dataUrl;
        });
      };
      
      // Get dimensions for all chart images
      const chartDimensions = {};
      for (const [key, dataUrl] of Object.entries(chartImages)) {
        if (dataUrl && dataUrl.startsWith('data:')) {
          const dims = await getImageDimensions(dataUrl);
          chartDimensions[key] = dims;
          console.log(`Chart ${key} dimensions: ${dims.width}x${dims.height}`);
        }
      }
      
      // Log chart images status
      console.log('Chart images status:', {
        appointmentTrend: !!chartImages.appointmentTrend,
        appointmentComparison: !!chartImages.appointmentComparison,
        treatmentCount: !!chartImages.treatmentCount,
        treatmentPie: !!chartImages.treatmentPie,
        branchUsage: !!chartImages.branchUsage,
        branchTrend: !!chartImages.branchTrend
      });
      
      const now = new Date();
      const printDate = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Build the same print HTML that's used for printing
      const buildAppointmentSection = () => {
        const metrics = apptMetrics || appointmentMetrics;
        if (metrics.total === 0 && (!metrics.trend || metrics.trend.length === 0)) {
          return '<div class="print-section"><h2>Appointment Analytics</h2><p>No appointment data available.</p></div>';
        }

        const trendDims = chartDimensions.appointmentTrend || { width: 350, height: 200 };
        const comparisonDims = chartDimensions.appointmentComparison || { width: 350, height: 200 };
        const trendChartImg = chartImages.appointmentTrend ? `<img src="${chartImages.appointmentTrend}" width="${trendDims.width}" height="${trendDims.height}" style="max-width: 100%; height: auto; display: block; max-height: 140px;" alt="Appointment Trend Chart" />` : '<div style="padding: 10px; text-align: center; color: #999; font-size: 8pt;">Chart not available</div>';
        const comparisonChartImg = chartImages.appointmentComparison ? `<img src="${chartImages.appointmentComparison}" width="${comparisonDims.width}" height="${comparisonDims.height}" style="max-width: 100%; height: auto; display: block; max-height: 140px;" alt="Completed vs Cancelled Chart" />` : '<div style="padding: 10px; text-align: center; color: #999; font-size: 8pt;">Chart not available</div>';

        return `
          <div class="print-section">
            <h2>Appointment Analytics</h2>
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
        const treatmentCountDims = chartDimensions.treatmentCount || { width: 350, height: 200 };
        const treatmentPieDims = chartDimensions.treatmentPie || { width: 350, height: 200 };
        const treatmentCountImg = chartImages.treatmentCount ? `<img src="${chartImages.treatmentCount}" width="${treatmentCountDims.width}" height="${treatmentCountDims.height}" style="max-width: 100%; height: auto; display: block; max-height: 140px;" alt="Treatment Count Chart" />` : '<div style="padding: 10px; text-align: center; color: #999; font-size: 8pt;">Chart not available</div>';
        const treatmentPieImg = chartImages.treatmentPie ? `<img src="${chartImages.treatmentPie}" width="${treatmentPieDims.width}" height="${treatmentPieDims.height}" style="max-width: 100%; height: auto; display: block; max-height: 140px;" alt="Treatment Distribution Chart" />` : '<div style="padding: 10px; text-align: center; color: #999; font-size: 8pt;">Chart not available</div>';
        
        const mostCommonList = metrics.mostCommon && metrics.mostCommon.length > 0
          ? metrics.mostCommon.map(t => `<li>${t.name}: ${t.count} time(s)</li>`).join('')
          : '<li>No data available</li>';
        
        const dentistList = metrics.dentistFrequency && metrics.dentistFrequency.length > 0
          ? metrics.dentistFrequency.map(d => `<li>${d.name}: ${d.count} visit(s)</li>`).join('')
          : '<li>No data available</li>';

        return `
          <div class="print-section">
            <h2>Treatment Analytics</h2>
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
        const branchUsageDims = chartDimensions.branchUsage || { width: 350, height: 200 };
        const branchTrendDims = chartDimensions.branchTrend || { width: 350, height: 200 };
        const branchUsageImg = chartImages.branchUsage ? `<img src="${chartImages.branchUsage}" width="${branchUsageDims.width}" height="${branchUsageDims.height}" style="max-width: 100%; height: auto; display: block; max-height: 140px;" alt="Branch Preference Chart" />` : '<div style="padding: 10px; text-align: center; color: #999; font-size: 8pt;">Chart not available</div>';
        const branchTrendImg = chartImages.branchTrend ? `<img src="${chartImages.branchTrend}" width="${branchTrendDims.width}" height="${branchTrendDims.height}" style="max-width: 100%; height: auto; display: block; max-height: 140px;" alt="Branch Visit Trend Chart" />` : '<div style="padding: 10px; text-align: center; color: #999; font-size: 8pt;">Chart not available</div>';
        
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
            <h2>Branch Usage Analytics</h2>
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

      // Create print HTML (same as print version)
      const printHTML = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Patient Analytics Report</title>
          <style>
            * {
              box-sizing: border-box;
            }
            body {
              font-family: Arial, sans-serif;
              font-size: 9pt;
              color: #000;
              background: #fff;
              margin: 0;
              padding: 10px;
              line-height: 1.2;
            }
            .print-header {
              border-bottom: 2px solid #000;
              padding-bottom: 8px;
              margin-bottom: 12px;
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .print-header .logo {
              height: 50px;
              width: auto;
              flex-shrink: 0;
            }
            .print-header .header-content {
              flex: 1;
            }
            .print-header h1 {
              margin: 0;
              font-size: 18pt;
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
          </style>
        </head>
        <body>
          <div class="print-header">
            ${logoDataURL && logoDataURL !== 'data:,' ? `<img src="${logoDataURL}" alt="Silario Clinic Logo" class="logo" />` : ''}
            <div class="header-content">
              <h1>Patient Analytics Report</h1>
              <div class="filter-info">
                <strong>Filter:</strong> ${getFilterDisplayText()}
              </div>
              <div class="print-date">
                <strong>Generated:</strong> ${printDate}
              </div>
            </div>
          </div>
          ${buildAppointmentSection()}
          ${buildTreatmentSection()}
          ${buildBranchSection()}
        </body>
      </html>
      `;

      // Step 8: Convert HTML to canvas using html2canvas
      console.log('Converting HTML to canvas...');
      const parser = new DOMParser();
      const parsed = parser.parseFromString(printHTML, 'text/html');

      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-10000px';
      container.style.top = '0';
      container.style.width = '794px'; // A4 width in pixels at 96 DPI
      container.style.background = '#fff';

      // Copy styles from the template
      const styleEl = parsed.querySelector('style');
      if (styleEl) {
        const cloneStyle = document.createElement('style');
        cloneStyle.textContent = styleEl.textContent || '';
        container.appendChild(cloneStyle);
      }
      
      // Move all body children
      Array.from(parsed.body.childNodes).forEach((n) => container.appendChild(n.cloneNode(true)));
      document.body.appendChild(container);

      // Wait for images to load with timeout and validation
      const images = Array.from(container.querySelectorAll('img'));
      console.log(`Waiting for ${images.length} images to load...`);
      
      // Set explicit dimensions for chart images to help html2canvas
      images.forEach((img, index) => {
        if (img.src && img.src.startsWith('data:')) {
          // For base64 images, we need to load them first to get dimensions
          const tempImg = new Image();
          tempImg.onload = () => {
            if (!img.width || !img.height) {
              img.width = tempImg.width;
              img.height = tempImg.height;
              // Maintain aspect ratio but limit max height
              if (img.height > 140) {
                const ratio = 140 / img.height;
                img.width = img.width * ratio;
                img.height = 140;
              }
            }
          };
          tempImg.src = img.src;
        }
      });
      
      await Promise.all(images.map((img, index) => new Promise((res) => { 
        const timeout = setTimeout(() => {
          console.warn(`Image ${index} load timeout, src: ${img.src ? img.src.substring(0, 50) : 'no src'}...`);
          res();
        }, 10000);
        
        if (img.complete && img.naturalWidth > 0) {
          clearTimeout(timeout);
          console.log(`Image ${index} already loaded (${img.naturalWidth}x${img.naturalHeight})`);
          res();
        } else if (img.src && img.src.startsWith('data:')) {
          // For base64 images, create a new image to ensure it loads
          const tempImg = new Image();
          tempImg.onload = () => {
            clearTimeout(timeout);
            console.log(`Image ${index} (base64) loaded successfully (${tempImg.width}x${tempImg.height})`);
            // Ensure the original img has the same dimensions
            if (!img.width || !img.height) {
              img.width = tempImg.width;
              img.height = tempImg.height;
            }
            res();
          };
          tempImg.onerror = (err) => {
            clearTimeout(timeout);
            console.error(`Image ${index} (base64) failed to load:`, err);
            res();
          };
          tempImg.src = img.src;
        } else {
          img.onload = () => {
            clearTimeout(timeout);
            console.log(`Image ${index} loaded successfully (${img.naturalWidth}x${img.naturalHeight})`);
            res();
          };
          img.onerror = (err) => {
            clearTimeout(timeout);
            console.error(`Image ${index} failed to load:`, err, img.src);
            res();
          };
        }
      })));
      
      // Additional wait to ensure all images are rendered
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('All images loaded, rendering to canvas...');
      console.log('Chart images available:', Object.keys(chartImages).length);
      
      // Verify images are still in the container
      const finalImages = Array.from(container.querySelectorAll('img'));
      console.log(`Final image count: ${finalImages.length}`);
      finalImages.forEach((img, index) => {
        console.log(`Image ${index}: src length=${img.src ? img.src.length : 0}, width=${img.width || img.naturalWidth}, height=${img.height || img.naturalHeight}`);
      });

      // Render container to canvas with better configuration
      const canvas = await html2canvas(container, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#ffffff',
        allowTaint: true,
        logging: false,
        imageTimeout: 15000,
        removeContainer: false,
        onclone: (clonedDoc) => {
          // Ensure all images in cloned document are loaded
          const clonedImages = clonedDoc.querySelectorAll('img');
          clonedImages.forEach((img, index) => {
            if (img.src && img.src.startsWith('data:')) {
              console.log(`Cloned image ${index} has data URL: ${img.src.substring(0, 50)}...`);
            }
          });
        }
      });
      
      if (!canvas) {
        throw new Error('Failed to render canvas');
      }
      
      console.log('Canvas rendered successfully, dimensions:', canvas.width, 'x', canvas.height);
      
      // Clean up container
      document.body.removeChild(container);

      // Step 9: Generate PDF from canvas
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginPt = 43; // ~1.5 cm
      const sideMargin = marginPt;
      const topMarginFirst = marginPt;
      const topMarginNext = marginPt;
      const bottomMargin = marginPt;
      const contentWidthPt = pageWidth - sideMargin * 2;
      const contentHeightPt = pageHeight - topMarginFirst - bottomMargin;
      const pxPerPt = canvas.width / contentWidthPt;

      // Helper to add a vertical slice of the canvas at a target Y in PDF
      const addSlice = (startPx, heightPx, destYpt) => {
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = heightPx;
        const ctx = sliceCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, startPx, canvas.width, heightPx, 0, 0, canvas.width, heightPx);
        const imgData = sliceCanvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', sideMargin, destYpt, contentWidthPt, heightPx / pxPerPt);
      };

      // First page
      const firstHeightPx = Math.min(canvas.height, Math.floor(contentHeightPt * pxPerPt));
      addSlice(0, firstHeightPx, topMarginFirst);
      let cursorPx = firstHeightPx;

      // Subsequent pages
      while (cursorPx < canvas.height) {
        pdf.addPage();
        const remainingPx = canvas.height - cursorPx;
        const sliceHeightPx = Math.min(remainingPx, Math.floor(contentHeightPt * pxPerPt));
        addSlice(cursorPx, sliceHeightPx, topMarginNext);
        cursorPx += sliceHeightPx;
      }
      
      // Save PDF
      const fileName = `Patient_Analytics_Report_${now.toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      console.log('PDF generated and saved successfully');
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
        <div className="flex items-center gap-4">
          <button
            onClick={handlePrint}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <FiPrinter className="h-4 w-4 mr-2" />
            Print
          </button>
          <button
            onClick={fetchAllAnalytics}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            <FiRefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
          >
            <FiDownload className="h-4 w-4 mr-2" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 no-print">
        <div className="flex items-center mb-3">
          <FiFilter className="h-5 w-5 text-primary-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-700">Report Filters</h2>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Time Period:</label>
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                dateFormat="yyyy-MM-dd"
                placeholderText="End Date"
              />
              <button
                onClick={() => {
                  if (customStartDate && customEndDate) {
                    fetchAllAnalytics();
                  }
                }}
                disabled={!customStartDate || !customEndDate || loading}
                className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply
              </button>
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
      <div id="patient-analytics-content" className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-50">
            <LoadingSpinner />
          </div>
        )}
        <div style={{ opacity: loading ? 0.3 : 1 }}>
          {/* Always render all sections for printing, but hide inactive ones */}
          {/* Use visibility and position instead of display:none to keep canvas elements in DOM */}
          <div 
            style={{ 
              display: 'block',
              visibility: activeTab === 'appointments' ? 'visible' : 'hidden',
              position: activeTab === 'appointments' ? 'static' : 'absolute',
              left: activeTab === 'appointments' ? 'auto' : '-9999px',
              width: activeTab === 'appointments' ? 'auto' : '800px',
              minHeight: activeTab === 'appointments' ? 'auto' : '600px',
              opacity: activeTab === 'appointments' ? 1 : 0,
              pointerEvents: activeTab === 'appointments' ? 'auto' : 'none'
            }}
          >
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
                  <div className="h-48" style={{ minWidth: '300px', minHeight: '192px' }}>
                    <canvas ref={appointmentTrendRef} id="chart-appointmentTrend"></canvas>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-700">Completed vs Cancelled</h3>
                  <div className="h-48" style={{ minWidth: '300px', minHeight: '192px' }}>
                    <canvas ref={appointmentComparisonRef} id="chart-appointmentComparison"></canvas>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div 
            style={{ 
              display: 'block',
              visibility: activeTab === 'treatments' ? 'visible' : 'hidden',
              position: activeTab === 'treatments' ? 'static' : 'absolute',
              left: activeTab === 'treatments' ? 'auto' : '-9999px',
              width: activeTab === 'treatments' ? 'auto' : '800px',
              minHeight: activeTab === 'treatments' ? 'auto' : '600px',
              opacity: activeTab === 'treatments' ? 1 : 0,
              pointerEvents: activeTab === 'treatments' ? 'auto' : 'none'
            }}
          >
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
                  <div className="h-64" style={{ minWidth: '300px', minHeight: '256px' }}>
                    <canvas ref={treatmentCountRef} id="chart-treatmentCount"></canvas>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-700">Treatment Distribution</h3>
                  <div className="h-64" style={{ minWidth: '300px', minHeight: '256px' }}>
                    <canvas ref={treatmentPieRef} id="chart-treatmentPie"></canvas>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div 
            style={{ 
              display: 'block',
              visibility: activeTab === 'branch' ? 'visible' : 'hidden',
              position: activeTab === 'branch' ? 'static' : 'absolute',
              left: activeTab === 'branch' ? 'auto' : '-9999px',
              width: activeTab === 'branch' ? 'auto' : '800px',
              minHeight: activeTab === 'branch' ? 'auto' : '600px',
              opacity: activeTab === 'branch' ? 1 : 0,
              pointerEvents: activeTab === 'branch' ? 'auto' : 'none'
            }}
          >
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
                  <div className="h-64" style={{ minWidth: '300px', minHeight: '256px' }}>
                    <canvas ref={branchUsageRef} id="chart-branchUsage"></canvas>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-700">Branch Visit Trend</h3>
                  <div className="h-64" style={{ minWidth: '300px', minHeight: '256px' }}>
                    <canvas ref={branchTrendRef} id="chart-branchTrend"></canvas>
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

