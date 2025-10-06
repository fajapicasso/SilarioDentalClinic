// src/pages/common/Notifications.jsx
import React, { useState, useEffect } from 'react';
import { useNotification } from '../../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { 
  FiBell, 
  FiCheck, 
  FiTrash2, 
  FiFilter, 
  FiSearch,
  FiRefreshCw,
  FiSettings,
  FiClock,
  FiAlertTriangle,
  FiInfo,
  FiCheckCircle,
  FiXCircle,
  FiCheckSquare,
  FiSquare,
  FiArchive
} from 'react-icons/fi';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const NotificationsPage = () => {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    clearAllNotifications,
    fetchNotifications,
    isLoading 
  } = useNotification();

  const navigate = useNavigate();
  
  // State for filtering and selection
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNotifications, setSelectedNotifications] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('newest');

  // Get filtered and sorted notifications
  const filteredNotifications = notifications
    .filter(notification => {
      // Filter by read status
      if (filter === 'unread' && notification.is_read) return false;
      if (filter === 'read' && !notification.is_read) return false;
      
      // Filter by category
      if (categoryFilter !== 'all' && notification.category !== categoryFilter) return false;
      
      // Filter by search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          notification.title.toLowerCase().includes(term) ||
          notification.message.toLowerCase().includes(term)
        );
      }
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'priority':
          const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        case 'unread':
          if (a.is_read === b.is_read) {
            return new Date(b.created_at) - new Date(a.created_at);
          }
          return a.is_read - b.is_read;
        default: // newest
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });

  // Get unique categories for filter
  const categories = [...new Set(notifications.map(n => n.category))];

  // Get notification icon based on type
  const getNotificationIcon = (type, priority) => {
    const iconClass = `h-5 w-5 ${
      priority === 'urgent' ? 'text-red-600' :
      priority === 'high' ? 'text-orange-500' :
      'text-gray-500'
    }`;

    switch (type) {
      case 'success':
        return <FiCheckCircle className={`${iconClass} text-green-500`} />;
      case 'error':
        return <FiXCircle className={`${iconClass} text-red-500`} />;
      case 'warning':
        return <FiAlertTriangle className={`${iconClass} text-yellow-500`} />;
      case 'appointment':
        return <FiClock className={iconClass} />;
      default:
        return <FiInfo className={iconClass} />;
    }
  };

  // Format date and time
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffInDays === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notification) => {
    // Mark as read if unread
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
  };

  // Handle bulk actions
  const handleSelectAll = () => {
    if (selectedNotifications.size === filteredNotifications.length) {
      setSelectedNotifications(new Set());
    } else {
      setSelectedNotifications(new Set(filteredNotifications.map(n => n.id)));
    }
  };

  const handleSelectNotification = (notificationId) => {
    const newSelected = new Set(selectedNotifications);
    if (newSelected.has(notificationId)) {
      newSelected.delete(notificationId);
    } else {
      newSelected.add(notificationId);
    }
    setSelectedNotifications(newSelected);
  };

  const handleBulkMarkAsRead = async () => {
    const promises = Array.from(selectedNotifications).map(id => markAsRead(id));
    await Promise.all(promises);
    setSelectedNotifications(new Set());
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedNotifications.size} notifications?`)) {
      const promises = Array.from(selectedNotifications).map(id => deleteNotification(id));
      await Promise.all(promises);
      setSelectedNotifications(new Set());
    }
  };

  // Clear selection when filter changes
  useEffect(() => {
    setSelectedNotifications(new Set());
  }, [filter, categoryFilter, searchTerm]);

  if (isLoading && notifications.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <FiBell className="mr-3 h-6 w-6" />
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {unreadCount} unread
                  </span>
                )}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage your notifications and preferences
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => fetchNotifications()}
                disabled={isLoading}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
                title="Refresh"
              >
                <FiRefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              
              <button
                onClick={() => navigate('/notifications/settings')}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
                title="Notification Settings"
              >
                <FiSettings className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mt-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiSearch className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search notifications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 border rounded-md flex items-center ${
                  showFilters ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <FiFilter className="h-4 w-4 mr-2" />
                Filters
              </button>
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="all">All</option>
                    <option value="unread">Unread</option>
                    <option value="read">Read</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(category => (
                      <option key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sort By
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="priority">Priority</option>
                    <option value="unread">Unread First</option>
                  </select>
                </div>
              </div>
            )}

            {/* Bulk Actions */}
            {selectedNotifications.size > 0 && (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
                <span className="text-sm text-blue-800 font-medium">
                  {selectedNotifications.size} notifications selected
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleBulkMarkAsRead}
                    className="px-3 py-1 text-sm bg-white border border-blue-300 text-blue-700 rounded hover:bg-blue-50"
                  >
                    Mark as Read
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="px-3 py-1 text-sm bg-white border border-red-300 text-red-700 rounded hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleSelectAll}
                  className="flex items-center text-sm text-gray-600 hover:text-gray-800"
                >
                  {selectedNotifications.size === filteredNotifications.length ? (
                    <FiCheckSquare className="h-4 w-4 mr-1" />
                  ) : (
                    <FiSquare className="h-4 w-4 mr-1" />
                  )}
                  Select All
                </button>
                
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Mark All as Read
                  </button>
                )}
              </div>

              <div className="text-sm text-gray-500">
                {filteredNotifications.length} of {notifications.length} notifications
              </div>
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="divide-y divide-gray-100">
          {filteredNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <FiBell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications found</h3>
              <p className="text-gray-500">
                {searchTerm || filter !== 'all' || categoryFilter !== 'all'
                  ? 'Try adjusting your filters or search terms.'
                  : 'You\'ll see your notifications here when you receive them.'
                }
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-6 hover:bg-gray-50 transition-colors ${
                  !notification.is_read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-start space-x-4">
                  {/* Selection Checkbox */}
                  <button
                    onClick={() => handleSelectNotification(notification.id)}
                    className="mt-1 p-1 rounded hover:bg-gray-200"
                  >
                    {selectedNotifications.has(notification.id) ? (
                      <FiCheckSquare className="h-4 w-4 text-primary-600" />
                    ) : (
                      <FiSquare className="h-4 w-4 text-gray-400" />
                    )}
                  </button>

                  {/* Notification Icon */}
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type, notification.priority)}
                  </div>

                  {/* Notification Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 cursor-pointer min-w-0" onClick={() => handleNotificationClick(notification)}>
                        <div className="flex items-center space-x-2 flex-wrap">
                          <h3 className={`text-sm font-medium ${
                            !notification.is_read ? 'text-gray-900' : 'text-gray-700'
                          }`}>
                            {notification.title}
                          </h3>
                          
                          {notification.priority === 'urgent' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 flex-shrink-0">
                              Urgent
                            </span>
                          )}
                          
                          {notification.priority === 'high' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 flex-shrink-0">
                              High
                            </span>
                          )}
                        </div>
                        
                        <p className={`text-xs sm:text-sm mt-1 ${
                          !notification.is_read ? 'text-gray-700' : 'text-gray-500'
                        }`}>
                          {notification.message}
                        </p>
                        
                        <div className="flex items-center mt-2 space-x-2 sm:space-x-4 text-xs text-gray-500 flex-wrap">
                          <span>{formatDateTime(notification.created_at)}</span>
                          <span className="capitalize">{notification.category}</span>
                          {notification.sender && (
                            <span className="hidden sm:inline">From: {notification.sender.full_name}</span>
                          )}
                        </div>

                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-1 ml-1 sm:ml-4 flex-shrink-0">
                        {!notification.is_read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-1 sm:p-2 text-gray-400 hover:text-green-600 rounded-md"
                            title="Mark as read"
                          >
                            <FiCheck className="h-3 w-3 sm:h-4 sm:w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-1 sm:p-2 text-gray-400 hover:text-red-600 rounded-md"
                          title="Delete notification"
                        >
                          <FiTrash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        {notifications.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to clear all notifications? This cannot be undone.')) {
                    clearAllNotifications();
                  }
                }}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <FiArchive className="mr-2 h-4 w-4" />
                Clear All Notifications
              </button>
              
              <span className="text-sm text-gray-500">
                Total: {notifications.length} notifications
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;