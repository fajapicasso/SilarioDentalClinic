import React, { useState, useRef, useEffect } from 'react';
import { FiCalendar, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const DatePicker = ({ value, onChange, placeholder = "Select date", className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const datePickerRef = useRef(null);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  useEffect(() => {
    if (value) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          setSelectedDate(date);
          setCurrentMonth(date);
        }
      } catch (error) {
        console.error('Invalid date value:', value);
      }
    } else {
      setSelectedDate(null);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getDaysInMonth = (date) => {
    try {
      const year = date.getFullYear();
      const month = date.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startingDayOfWeek = firstDay.getDay();

      const days = [];
      
      // Add empty cells for days before the first day of the month
      for (let i = 0; i < startingDayOfWeek; i++) {
        days.push(null);
      }
      
      // Add days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        days.push(day);
      }
      
      return days;
    } catch (error) {
      console.error('Error generating days:', error);
      return [];
    }
  };

  const handleDateSelect = (day) => {
    if (day) {
      try {
        const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        setSelectedDate(newDate);
        if (onChange) {
          onChange(newDate.toISOString().split('T')[0]);
        }
        setIsOpen(false);
      } catch (error) {
        console.error('Error selecting date:', error);
      }
    }
  };

  const handleMonthChange = (direction) => {
    setCurrentMonth(prev => {
      try {
        const newMonth = new Date(prev);
        newMonth.setMonth(prev.getMonth() + direction);
        return newMonth;
      } catch (error) {
        console.error('Error changing month:', error);
        return prev;
      }
    });
  };

  const handleMonthSelect = (monthIndex) => {
    setCurrentMonth(prev => {
      try {
        const newMonth = new Date(prev);
        newMonth.setMonth(monthIndex);
        return newMonth;
      } catch (error) {
        console.error('Error selecting month:', error);
        return prev;
      }
    });
  };

  const handleYearSelect = (year) => {
    setCurrentMonth(prev => {
      try {
        const newMonth = new Date(prev);
        newMonth.setFullYear(year);
        return newMonth;
      } catch (error) {
        console.error('Error selecting year:', error);
        return prev;
      }
    });
  };

  const formatDisplayDate = (date) => {
    if (!date) return '';
    try {
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };

  const isToday = (day) => {
    if (!day) return false;
    try {
      const today = new Date();
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      return date.toDateString() === today.toDateString();
    } catch (error) {
      return false;
    }
  };

  const isSelected = (day) => {
    if (!day || !selectedDate) return false;
    try {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      return date.toDateString() === selectedDate.toDateString();
    } catch (error) {
      return false;
    }
  };

  const generateYearOptions = () => {
    try {
      const currentYear = new Date().getFullYear();
      const years = [];
      for (let year = currentYear - 100; year <= currentYear + 10; year++) {
        years.push(year);
      }
      return years;
    } catch (error) {
      console.error('Error generating years:', error);
      return [];
    }
  };

  return (
    <div className="relative" ref={datePickerRef}>
      <div
        className={`w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500 cursor-pointer flex items-center justify-between ${className}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedDate ? 'text-gray-900' : 'text-gray-500'}>
          {selectedDate ? formatDisplayDate(selectedDate) : placeholder}
        </span>
        <FiCalendar className="h-4 w-4 text-gray-400" />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 min-w-[280px]">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => handleMonthChange(-1)}
                className="p-1 hover:bg-gray-100 rounded"
                type="button"
              >
                <FiChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center space-x-2">
                <select
                  value={currentMonth.getMonth()}
                  onChange={(e) => handleMonthSelect(parseInt(e.target.value))}
                  className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-primary-500 focus:border-primary-500"
                >
                  {months.map((month, index) => (
                    <option key={index} value={index}>{month}</option>
                  ))}
                </select>
                <select
                  value={currentMonth.getFullYear()}
                  onChange={(e) => handleYearSelect(parseInt(e.target.value))}
                  className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-primary-500 focus:border-primary-500"
                >
                  {generateYearOptions().map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => handleMonthChange(1)}
                className="p-1 hover:bg-gray-100 rounded"
                type="button"
              >
                <FiChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="p-4">
            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {daysOfWeek.map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
              {getDaysInMonth(currentMonth).map((day, index) => (
                <button
                  key={index}
                  onClick={() => handleDateSelect(day)}
                  className={`
                    w-8 h-8 text-sm rounded-full flex items-center justify-center
                    ${day ? 'hover:bg-gray-100' : ''}
                    ${isToday(day) ? 'bg-blue-100 text-blue-600 font-medium' : ''}
                    ${isSelected(day) ? 'bg-purple-600 text-white font-medium' : ''}
                    ${!day ? 'cursor-default' : 'cursor-pointer'}
                  `}
                  disabled={!day}
                  type="button"
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
