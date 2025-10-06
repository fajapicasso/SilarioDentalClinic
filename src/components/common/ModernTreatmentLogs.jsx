// src/components/common/ModernTreatmentLogs.jsx - Modern Treatment Logs with Search and Collapse
import React, { useState, useEffect, useMemo } from 'react';
import { 
  FiSearch, FiFilter, FiCalendar, FiUser, FiActivity, FiChevronDown, FiChevronRight,
  FiEye, FiEdit, FiTrash2, FiPrinter, FiDownload, FiMapPin, FiClock, FiTooth
} from 'react-icons/fi';
import { toast } from 'react-toastify';

const ModernTreatmentLogs = ({ 
  treatments = [], 
  onEdit, 
  onDelete, 
  onView,
  role = 'patient',
  patientName = '',
  showActions = true 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState('all');
  const [selectedTooth, setSelectedTooth] = useState('all');
  const [collapsedSections, setCollapsedSections] = useState(new Set());
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' or 'list'

  // Extract unique categories and procedures
  const categories = useMemo(() => {
    const procedures = [...new Set(treatments.map(t => t.procedure).filter(Boolean))];
    return ['all', ...procedures.sort()];
  }, [treatments]);

  // Extract unique teeth
  const teeth = useMemo(() => {
    const toothNumbers = [...new Set(treatments.map(t => t.tooth_number).filter(Boolean))];
    return ['all', ...toothNumbers.sort((a, b) => a - b)];
  }, [treatments]);

  // Filter treatments based on search and filters
  const filteredTreatments = useMemo(() => {
    let filtered = treatments;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(treatment => 
        treatment.procedure?.toLowerCase().includes(term) ||
        treatment.diagnosis?.toLowerCase().includes(term) ||
        treatment.notes?.toLowerCase().includes(term) ||
        treatment.doctor?.full_name?.toLowerCase().includes(term) ||
        treatment.tooth_number?.toString().includes(term)
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(treatment => treatment.procedure === selectedCategory);
    }

    // Tooth filter
    if (selectedTooth !== 'all') {
      filtered = filtered.filter(treatment => treatment.tooth_number?.toString() === selectedTooth);
    }

    // Date range filter
    if (selectedDateRange !== 'all') {
      const now = new Date();
      const filterDate = new Date();

      switch (selectedDateRange) {
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          filterDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          filterDate.setTime(0);
      }

      filtered = filtered.filter(treatment => 
        new Date(treatment.treatment_date) >= filterDate
      );
    }

    return filtered;
  }, [treatments, searchTerm, selectedCategory, selectedDateRange, selectedTooth]);

  // Group treatments by procedure for grouped view
  const groupedTreatments = useMemo(() => {
    const groups = {};
    filteredTreatments.forEach(treatment => {
      const procedure = treatment.procedure || 'Other';
      if (!groups[procedure]) {
        groups[procedure] = [];
      }
      groups[procedure].push(treatment);
    });

    // Sort each group by date (most recent first)
    Object.keys(groups).forEach(procedure => {
      groups[procedure].sort((a, b) => new Date(b.treatment_date) - new Date(a.treatment_date));
    });

    return groups;
  }, [filteredTreatments]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const cleanNotesForDisplay = (notes) => {
    if (!notes) return '';
    return notes.replace(/<!--APPOINTMENT_REF:[^>]*-->/g, '').trim();
  };

  const toggleSection = (sectionId) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(sectionId)) {
      newCollapsed.delete(sectionId);
    } else {
      newCollapsed.add(sectionId);
    }
    setCollapsedSections(newCollapsed);
  };

  const exportTreatments = () => {
    const data = filteredTreatments.map(treatment => ({
      Date: formatDate(treatment.treatment_date),
      Procedure: treatment.procedure || '',
      Tooth: treatment.tooth_number || '',
      Diagnosis: treatment.diagnosis || '',
      Notes: cleanNotesForDisplay(treatment.notes) || '',
      Doctor: treatment.doctor?.full_name || ''
    }));

    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `treatment-history-${patientName || 'patient'}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Treatment history exported successfully');
  };

  const renderTreatmentCard = (treatment) => (
    <div
      key={treatment.id}
      className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
    >
      {/* Treatment Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900">{treatment.procedure}</h4>
              <div className="flex items-center space-x-4 mt-1">
                <span className="text-sm text-gray-600 flex items-center">
                  <FiCalendar className="w-4 h-4 mr-1" />
                  {formatDate(treatment.treatment_date)}
                </span>
                {treatment.tooth_number && (
                  <span className="text-sm text-gray-600 flex items-center">
                    <FiTooth className="w-4 h-4 mr-1" />
                    Tooth #{treatment.tooth_number}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          {showActions && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onView && onView(treatment)}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="View Details"
              >
                <FiEye className="w-4 h-4" />
              </button>
              {(role === 'doctor' || role === 'staff') && (
                <>
                  <button
                    onClick={() => onEdit && onEdit(treatment)}
                    className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Edit Treatment"
                  >
                    <FiEdit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete && onDelete(treatment)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Treatment"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Treatment Content */}
      <div className="p-6">
        {/* Metadata Badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          {treatment.appointment_time && (
            <div className="flex items-center space-x-1 px-3 py-1 bg-purple-50 text-purple-700 rounded-lg border border-purple-200">
              <FiClock className="w-3 h-3" />
              <span className="text-sm font-medium">{formatTime(treatment.appointment_time)}</span>
            </div>
          )}
          {treatment.appointment_branch && (
            <div className="flex items-center space-x-1 px-3 py-1 bg-amber-50 text-amber-700 rounded-lg border border-amber-200">
              <FiMapPin className="w-3 h-3" />
              <span className="text-sm font-medium">{treatment.appointment_branch} Branch</span>
            </div>
          )}
          {treatment.doctor?.full_name && (
            <div className="flex items-center space-x-1 px-3 py-1 bg-green-50 text-green-700 rounded-lg border border-green-200">
              <FiUser className="w-3 h-3" />
              <span className="text-sm font-medium">Dr. {treatment.doctor.full_name}</span>
            </div>
          )}
        </div>

        {/* Treatment Details */}
        {treatment.diagnosis && (
          <div className="mb-4">
            <h5 className="text-sm font-semibold text-gray-900 mb-2">Treatment Plan</h5>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 border-l-4 border-blue-500">
              {treatment.diagnosis}
            </p>
          </div>
        )}

        {treatment.notes && cleanNotesForDisplay(treatment.notes) && (
          <div className="mb-4">
            <h5 className="text-sm font-semibold text-gray-900 mb-2">Additional Notes</h5>
            <p className="text-sm text-gray-700 bg-yellow-50 rounded-lg p-3 border-l-4 border-yellow-500">
              {cleanNotesForDisplay(treatment.notes)}
            </p>
          </div>
        )}

        {/* Treatment Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-xs text-gray-500">
          <span>
            Created: {new Date(treatment.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
          <span>ID: {treatment.id}</span>
        </div>
      </div>
    </div>
  );

  const renderGroupedView = () => (
    <div className="space-y-6">
      {Object.entries(groupedTreatments).map(([procedure, procedureTreatments]) => {
        const sectionId = `procedure-${procedure}`;
        const isCollapsed = collapsedSections.has(sectionId);

        return (
          <div key={procedure} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Section Header */}
            <div 
              className="bg-gradient-to-r from-gray-50 to-blue-50 px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => toggleSection(sectionId)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center text-gray-600">
                    {isCollapsed ? <FiChevronRight className="w-5 h-5" /> : <FiChevronDown className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{procedure}</h3>
                    <p className="text-sm text-gray-600">{procedureTreatments.length} treatment{procedureTreatments.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                    {procedureTreatments.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Section Content */}
            {!isCollapsed && (
              <div className="p-6">
                <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
                  {procedureTreatments.map(renderTreatmentCard)}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderListView = () => (
    <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
      {filteredTreatments.map(renderTreatmentCard)}
    </div>
  );

  return (
    <div className="modern-treatment-logs">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
              <FiActivity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Treatment History</h2>
              <p className="text-gray-600">{filteredTreatments.length} treatments found</p>
            </div>
          </div>

          {/* View Controls */}
          <div className="flex items-center space-x-3">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'grouped' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Grouped
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                List
              </button>
            </div>

            <button
              onClick={exportTreatments}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              disabled={filteredTreatments.length === 0}
            >
              <FiDownload className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search treatments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Procedures' : category}
                </option>
              ))}
            </select>
          </div>

          {/* Tooth Filter */}
          <div className="relative">
            <FiTooth className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={selectedTooth}
              onChange={(e) => setSelectedTooth(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
            >
              {teeth.map(tooth => (
                <option key={tooth} value={tooth}>
                  {tooth === 'all' ? 'All Teeth' : `Tooth #${tooth}`}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="relative">
            <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
            >
              <option value="all">All Time</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="year">Last Year</option>
            </select>
          </div>
        </div>

        {/* Active Filters Summary */}
        {(searchTerm || selectedCategory !== 'all' || selectedDateRange !== 'all' || selectedTooth !== 'all') && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">Active filters:</span>
            {searchTerm && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                Search: "{searchTerm}"
              </span>
            )}
            {selectedCategory !== 'all' && (
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                Procedure: {selectedCategory}
              </span>
            )}
            {selectedTooth !== 'all' && (
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                Tooth: #{selectedTooth}
              </span>
            )}
            {selectedDateRange !== 'all' && (
              <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                Time: {selectedDateRange}
              </span>
            )}
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
                setSelectedDateRange('all');
                setSelectedTooth('all');
              }}
              className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full hover:bg-gray-200 transition-colors"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Treatment Content */}
      {filteredTreatments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <FiActivity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No treatments found</h3>
          <p className="text-gray-600">
            {searchTerm || selectedCategory !== 'all' || selectedDateRange !== 'all' || selectedTooth !== 'all'
              ? 'Try adjusting your search filters to find more treatments.'
              : 'No treatment records are available for this patient.'}
          </p>
        </div>
      ) : (
        viewMode === 'grouped' ? renderGroupedView() : renderListView()
      )}
    </div>
  );
};

export default ModernTreatmentLogs;
