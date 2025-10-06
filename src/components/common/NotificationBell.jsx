// src/components/common/NotificationBell.jsx - Improved version
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  FiBell, 
  FiCheck, 
  FiX, 
  FiTrash2, 
  FiSettings, 
  FiClock,
  FiAlertTriangle,
  FiInfo,
  FiCheckCircle,
  FiXCircle,
  FiWifi,
  FiWifiOff,
  FiRefreshCw
} from 'react-icons/fi';

const NotificationBell = () => {
  const { user } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Use notification context with proper error handling
  let notificationContext = null;
  try {
    const { useNotification } = require('../../contexts/NotificationContext');
    notificationContext = useNotification();
  } catch (err) {
    console.warn('NotificationContext not available:', err);
  }

  const {
    notifications: contextNotifications = [],
    unreadCount: contextUnreadCount = 0,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    isLoading: contextLoading = false,
    fetchNotifications,
    connectionStatus: contextConnectionStatus = 'disconnected'
  } = notificationContext || {};

  // Update local state from context
  useEffect(() => {
    if (notificationContext) {
      setNotifications(contextNotifications);
      setUnreadCount(contextUnreadCount);
      setIsLoading(contextLoading);
      setConnectionStatus(contextConnectionStatus);
      setError(null);
    }
  }, [contextNotifications, contextUnreadCount, contextLoading, contextConnectionStatus, notificationContext]);

  // Fallback notification fetch if context is not available
  const fallbackFetchNotifications = async () => {
    if (!user || notificationContext) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { default: supabase } = await import('../../config/supabaseClient');
      
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select(`
          *,
          sender:profiles!sender_id(id, full_name, role)
        `)
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (fetchError) throw fetchError;

      setNotifications(data || []);
      const unread = data?.filter(n => !n.is_read).length || 0;
      setUnreadCount(unread);
      setConnectionStatus('connected');
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Failed to load notifications');
      setConnectionStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Fallback mark as read
  const fallbackMarkAsRead = async (notificationId) => {
    if (markAsRead) {
      return await markAsRead(notificationId);
    }
    
    try {
      const { default: supabase } = await import('../../config/supabaseClient');
      
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('recipient_id', user.id);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, is_read: true }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Fallback delete notification
  const fallbackDeleteNotification = async (notificationId) => {
    if (deleteNotification) {
      return await deleteNotification(notificationId);
    }
    
    try {
      const { default: supabase } = await import('../../config/supabaseClient');
      
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('recipient_id', user.id);

      if (error) throw error;

      const deletedNotification = notifications.find(n => n.id === notificationId);
      
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      if (deletedNotification && !deletedNotification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Initialize notifications on mount
  useEffect(() => {
    if (user) {
      if (notificationContext && fetchNotifications) {
        fetchNotifications();
      } else {
        fallbackFetchNotifications();
      }
    }
  }, [user, notificationContext, fetchNotifications]);

  // Set up real-time subscription for fallback mode
  useEffect(() => {
    if (!user || notificationContext) return;

    let channel;
    
    const setupRealtimeSubscription = async () => {
      try {
        const { default: supabase } = await import('../../config/supabaseClient');
        
        channel = supabase
          .channel('notifications')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `recipient_id=eq.${user.id}`
            },
            async (payload) => {
              try {
                const { data, error } = await supabase
                  .from('notifications')
                  .select(`
                    *,
                    sender:profiles!sender_id(id, full_name, role)
                  `)
                  .eq('id', payload.new.id)
                  .single();

                if (!error && data) {
                  setNotifications(prev => [data, ...prev.slice(0, 9)]);
                  setUnreadCount(prev => prev + 1);
                }
              } catch (err) {
                console.error('Error handling real-time notification:', err);
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.error('Error setting up real-time subscription:', err);
      }
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        const cleanup = async () => {
          const { default: supabase } = await import('../../config/supabaseClient');
          supabase.removeChannel(channel);
        };
        cleanup();
      }
    };
  }, [user, notificationContext]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // If user is not available, don't render
  if (!user) {
    return null;
  }

  // Filter notifications based on current filter
  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return !notification.is_read;
    if (filter === 'read') return notification.is_read;
    return true;
  }).slice(0, 10);

  // Get notification icon based on type
  const getNotificationIcon = (type, priority) => {
    const iconClass = `h-4 w-4 ${
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

  // Format relative time
  const formatRelativeTime = (dateString) => {
    try {
      const now = new Date();
      const date = new Date(dateString);
      const diffInMilliseconds = now - date;
      const diffInMinutes = Math.floor(diffInMilliseconds / (1000 * 60));
      const diffInHours = Math.floor(diffInMinutes / 60);
      const diffInDays = Math.floor(diffInHours / 24);

      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      if (diffInHours < 24) return `${diffInHours}h ago`;
      if (diffInDays < 7) return `${diffInDays}d ago`;
      
      return date.toLocaleDateString();
    } catch (err) {
      console.error('Error formatting date:', err);
      return 'Recently';
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notification) => {
    try {
      if (!notification.is_read) {
        await fallbackMarkAsRead(notification.id);
      }
    } catch (err) {
      console.error('Error handling notification click:', err);
    }
  };

  // Handle mark as read
  const handleMarkAsRead = async (e, notificationId) => {
    e.stopPropagation();
    await fallbackMarkAsRead(notificationId);
  };

  // Handle delete
  const handleDelete = async (e, notificationId) => {
    e.stopPropagation();
    await fallbackDeleteNotification(notificationId);
  };

  // Handle mark all as read
  const handleMarkAllAsRead = async () => {
    if (markAllAsRead) {
      await markAllAsRead();
    } else {
      // Fallback implementation
      const unreadNotifications = notifications.filter(n => !n.is_read);
      for (const notification of unreadNotifications) {
        await fallbackMarkAsRead(notification.id);
      }
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    if (fetchNotifications) {
      await fetchNotifications();
    } else {
      await fallbackFetchNotifications();
    }
  };

  const isConnected = connectionStatus === 'connected';
  const hasError = connectionStatus === 'error' || error;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-black hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-full transition-colors"
        aria-label="Notifications"
        title={hasError ? 'Notifications (Connection Issue)' : 'Notifications'}
      >
        <FiBell className="h-6 w-6" />
        
        {/* Connection Status Indicator */}
        {hasError && (
          <FiWifiOff className="absolute -top-0.5 -left-0.5 h-3 w-3 text-red-500" />
        )}
        
        {/* Unread Count Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full min-w-[1.25rem] h-5 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[32rem] overflow-hidden">
          {/* Header */}
          <div className="px-3 sm:px-4 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-medium text-gray-900 flex items-center">
                Notifications
                {hasError && (
                  <span className="ml-1 sm:ml-2 text-xs text-red-500" title="Connection Issue">
                    <FiWifiOff className="h-3 w-3 sm:h-4 sm:w-4" />
                  </span>
                )}
                {isConnected && !hasError && (
                  <span className="ml-1 sm:ml-2 text-xs text-green-500" title="Connected">
                    <FiWifi className="h-3 w-3 sm:h-4 sm:w-4" />
                  </span>
                )}
              </h3>
              <div className="flex items-center space-x-1 sm:space-x-2">
                <button
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  title="Refresh"
                >
                  <FiRefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs sm:text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    <span className="hidden sm:inline">Mark all read</span>
                    <span className="sm:hidden">Mark all</span>
                  </button>
                )}
                
                <button
                  onClick={() => {
                    navigate('/notifications/settings');
                    setShowDropdown(false);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  title="Notification Settings"
                >
                  <FiSettings className="h-3 w-3 sm:h-4 sm:w-4" />
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                {error}
                <button
                  onClick={handleRefresh}
                  className="ml-2 underline hover:no-underline"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Filter Tabs */}
            <div className="flex mt-3 space-x-1">
              {['all', 'unread', 'read'].map((filterType) => (
                <button
                  key={filterType}
                  onClick={() => setFilter(filterType)}
                  className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-md transition-colors ${
                    filter === filterType
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <span className="hidden sm:inline">
                    {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                  </span>
                  <span className="sm:hidden">
                    {filterType.charAt(0).toUpperCase()}
                  </span>
                  {filterType === 'unread' && unreadCount > 0 && (
                    <span className="ml-1 text-xs">({unreadCount})</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading notifications...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-6 text-center">
                <FiBell className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  {filter === 'unread' ? 'No unread notifications' : 
                   filter === 'read' ? 'No read notifications' : 
                   'No notifications yet'}
                </p>
                {!isConnected && (
                  <button
                    onClick={handleRefresh}
                    className="mt-2 px-3 py-1 text-xs bg-primary-100 text-primary-600 rounded hover:bg-primary-200"
                  >
                    Try Loading
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 sm:p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                      !notification.is_read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start space-x-2 sm:space-x-3">
                      {/* Notification Icon */}
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type, notification.priority)}
                      </div>

                      {/* Notification Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${
                              !notification.is_read ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                              {notification.title}
                            </p>
                            <p className={`text-xs sm:text-sm mt-1 ${
                              !notification.is_read ? 'text-gray-700' : 'text-gray-500'
                            }`}>
                              {notification.message}
                            </p>
                            
                            {/* Metadata */}
                            <div className="flex items-center mt-2 space-x-1 sm:space-x-2 flex-wrap">
                              <span className="text-xs text-gray-400">
                                {formatRelativeTime(notification.created_at)}
                              </span>
                              
                              {notification.category && (
                                <>
                                  <span className="text-xs text-gray-300">•</span>
                                  <span className="text-xs text-gray-400 capitalize">
                                    {notification.category}
                                  </span>
                                </>
                              )}
                              
                              {notification.priority === 'urgent' && (
                                <>
                                  <span className="text-xs text-gray-300">•</span>
                                  <span className="text-xs text-red-500 font-medium">
                                    Urgent
                                  </span>
                                </>
                              )}
                            </div>

                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center space-x-1 ml-1 sm:ml-2 flex-shrink-0">
                            {!notification.is_read && (
                              <button
                                onClick={(e) => handleMarkAsRead(e, notification.id)}
                                className="p-1 text-gray-400 hover:text-green-600 rounded"
                                title="Mark as read"
                              >
                                <FiCheck className="h-3 w-3 sm:h-4 sm:w-4" />
                              </button>
                            )}
                            <button
                              onClick={(e) => handleDelete(e, notification.id)}
                              className="p-1 text-gray-400 hover:text-red-600 rounded"
                              title="Delete notification"
                            >
                              <FiTrash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 10 && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => {
                  navigate('/notifications');
                  setShowDropdown(false);
                }}
                className="w-full text-sm text-primary-600 hover:text-primary-700 font-medium text-center"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;