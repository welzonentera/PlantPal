import { useState, useEffect } from 'react';
import { Users, Crown, Leaf, RefreshCw, Clock, AlertCircle, Info, AlertTriangle, CheckCircle, Bell, BellOff } from "lucide-react";
import BackgroundImage from "../assets/background.png";

interface DashboardStats {
  total_users: number;
  subscribed_users: number;
  total_scans: number;
  loading: boolean;
  error: string | null;
}

interface SystemLog {
  id: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  message: string;
  user_id?: string;
  timestamp: string;
  details?: any;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  user_id?: string;
  is_read: boolean;
  created_at: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    total_users: 0,
    subscribed_users: 0,
    total_scans: 0,
    loading: true,
    error: null
  });

  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [logsLoading, setLogsLoading] = useState(true);
  const [notificationsLoading, setNotificationsLoading] = useState(true);

  const API_BASE_URL = 'http://127.0.0.1:8000';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('accessToken');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const fetchStats = async () => {
    try {
      setStats((prev) => ({ ...prev, loading: true, error: null }));
      
      const response = await fetch(`${API_BASE_URL}/api/dashboard/stats/`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats({
        total_users: data.total_users || 0,
        subscribed_users: data.subscribed_users || 0,
        total_scans: data.total_scans || 0,
        loading: false,
        error: null
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setStats((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load stats'
      }));
    }
  };

  const fetchSystemLogs = async () => {
    try {
      setLogsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/admin/logs/?limit=10`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }

      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Error fetching system logs:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/admin/notifications/?limit=10`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/notifications/${notificationId}/read/`,
        {
          method: 'PATCH',
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        // Update local state
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === notificationId ? { ...notif, is_read: true } : notif
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/notifications/read-all/`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(notif => ({ ...notif, is_read: true }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const refreshAll = () => {
    fetchStats();
    fetchSystemLogs();
    fetchNotifications();
  };

  useEffect(() => {
    fetchStats();
    fetchSystemLogs();
    fetchNotifications();

    // Auto-refresh every 30 seconds
    const statsInterval = setInterval(fetchStats, 30000);
    const logsInterval = setInterval(fetchSystemLogs, 30000);
    const notificationsInterval = setInterval(fetchNotifications, 30000);

    return () => {
      clearInterval(statsInterval);
      clearInterval(logsInterval);
      clearInterval(notificationsInterval);
    };
  }, []);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'ERROR':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'WARNING':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'SUCCESS':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getLogColor = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'text-red-600';
      case 'WARNING':
        return 'text-yellow-600';
      case 'SUCCESS':
        return 'text-green-600';
      default:
        return 'text-blue-600';
    }
  };

  return (
    <div
      className="min-h-screen p-6 bg-cover bg-center"
      style={{
        backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.85)), url(${BackgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Header with Refresh Button */}
      <div className="max-w-7xl mx-auto mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-green-800">Admin Dashboard</h1>
        <button
          onClick={refreshAll}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh All
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto mb-8">
        {/* Total Users */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Users className="w-8 h-8 text-green-600" />
            </div>
            <span className="text-sm font-semibold text-gray-500">TOTAL USERS</span>
          </div>
          {stats.loading ? (
            <div className="text-center text-gray-500">Loading...</div>
          ) : (
            <div className="text-4xl font-bold text-gray-800">{stats.total_users}</div>
          )}
        </div>

        {/* Subscribed Users */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Crown className="w-8 h-8 text-yellow-600" />
            </div>
            <span className="text-sm font-semibold text-gray-500">SUBSCRIBED USERS</span>
          </div>
          {stats.loading ? (
            <div className="text-center text-gray-500">Loading...</div>
          ) : (
            <div className="text-4xl font-bold text-gray-800">{stats.subscribed_users}</div>
          )}
        </div>

        {/* Total Plant Scans */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Leaf className="w-8 h-8 text-blue-600" />
            </div>
            <span className="text-sm font-semibold text-gray-500">TOTAL PLANTS SCAN</span>
          </div>
          {stats.loading ? (
            <div className="text-center text-gray-500">Loading...</div>
          ) : (
            <div className="text-4xl font-bold text-gray-800">{stats.total_scans}</div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {stats.error && (
        <div className="max-w-7xl mx-auto mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span>{stats.error}</span>
          </div>
          <button
            onClick={fetchStats}
            className="text-red-700 hover:text-red-900 font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* System Logs & Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
        {/* System Logs */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-green-600" />
              SYSTEM LOGS
            </h2>
            <button
              onClick={fetchSystemLogs}
              className="text-green-600 hover:text-green-700"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logsLoading ? (
              <div className="text-center text-gray-500 py-8">Loading logs...</div>
            ) : logs.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No logs available</div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
                >
                  <div className="flex items-start gap-2">
                    {getLogIcon(log.level)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-semibold text-xs ${getLogColor(log.level)}`}>
                          [{log.level}]
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 break-words">{log.message}</p>
                      {log.user_id && (
                        <span className="text-xs text-gray-500">User ID: {log.user_id}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Bell className="w-5 h-5 text-green-600" />
              NOTIFICATIONS
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {unreadCount}
                </span>
              )}
            </h2>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-green-600 hover:text-green-700 font-semibold"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={fetchNotifications}
                className="text-green-600 hover:text-green-700"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {notificationsLoading ? (
              <div className="text-center text-gray-500 py-8">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No notifications</div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border transition cursor-pointer ${
                    notification.is_read
                      ? 'bg-gray-50 border-gray-200'
                      : 'bg-green-50 border-green-200'
                  } hover:bg-gray-100`}
                  onClick={() => !notification.is_read && markNotificationAsRead(notification.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {notification.is_read ? (
                          <BellOff className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Bell className="w-4 h-4 text-green-600" />
                        )}
                        <h3 className="font-semibold text-sm text-gray-800">
                          {notification.title}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{notification.message}</p>
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(notification.created_at)}
                      </span>
                    </div>
                    {!notification.is_read && (
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-1 flex-shrink-0"></div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}