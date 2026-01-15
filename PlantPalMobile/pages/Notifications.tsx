import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { RootStackParamList } from "../App";
import { useAuth } from "../src/contexts/AuthContext";

type NotificationsScreenNavigationProp = StackNavigationProp<

  RootStackParamList,
  "Notifications"
>;

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  metadata?: {
    version?: string;
    effective_date?: string;
  };
}

export default function Notifications() {
  const navigation = useNavigation<NotificationsScreenNavigationProp>();
  const { user } = useAuth();

  // Match the same URL pattern as JournalPage
  const API_BASE = "http://127.0.0.1:8000/api/";

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [showClearedMessage, setShowClearedMessage] = useState(false); // Show success message
  const isMounted = useRef(true);

  const [fontsLoaded] = useFonts({
    Poppins: require("../assets/fonts/Poppins-Regular.ttf"),
    "Poppins-Bold": require("../assets/fonts/Poppins-Bold.ttf"),
    "Poppins-Medium": require("../assets/fonts/Poppins-Medium.ttf"),
    "Poppins-SemiBold": require("../assets/fonts/Poppins-SemiBold.ttf"),
  });

  useEffect(() => {
    isMounted.current = true;
    
    if (user?.email) {
      console.log("📧 User email from AuthContext:", user.email);
      fetchNotifications(user.email);
    }
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      if (user?.email && isMounted.current) {
        console.log("🔄 Auto-refreshing notifications...");
        fetchNotifications(user.email, true); // Silent refresh
      }
    }, 10000);

    return () => {
      isMounted.current = false;
      clearInterval(interval);
      console.log("🧹 Notifications: Cleaned up interval");
    };
  }, [user]);

  
const fetchNotifications = async (email: string, silent = false) => {
    if (!email || !isMounted.current) {
      if (!email) {
        console.log("❌ No user email available");
        setError("No user email found. Please log in.");
      }
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // Only show loading spinner if not silent refresh
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      
      const url = `${API_BASE}get_user_notifications/?user_email=${encodeURIComponent(
        email
      )}`;
      
      if (!silent) {
        console.log("🔍 Fetching from:", url);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log("⏱️ Request timeout - aborting");
        controller.abort();
      }, 10000);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Server error:", errorText);
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (!silent) {
        console.log("📊 Status:", response.status);
        console.log(`✅ Loaded ${data.length} notifications`);
      }

      // Only update state if component is still mounted
      if (isMounted.current) {
        setNotifications(data);
        setError(null);
        
        // Hide cleared message if new notifications arrive
        if (data.length > 0) {
          setShowClearedMessage(false);
        }
      }
    } catch (error: any) {
      // Only show errors if not a silent refresh and component is mounted
      if (!silent && isMounted.current) {
        console.error("❌ Error:", error);
        
        let errorMessage = "Failed to load notifications";
        
        if (error?.name === "AbortError") {
          errorMessage = "Request timeout - server not responding";
        } else if (error?.message?.includes("Network request failed")) {
          errorMessage = "Cannot connect to server";
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        
        setError(errorMessage);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

 const onRefresh = () => {
  setRefreshing(true);
  if (user?.email) {
    fetchNotifications(user.email);
  }
};

 const handleNotificationPress = async (notification: NotificationItem) => {
  if (!user?.email) return;

  // Mark as read safely
  if (!notification.is_read) {
    try {
      await fetch(`${API_BASE}mark_notification_read/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_id: notification.id }),
      });

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, is_read: true } : n
        )
      );
    } catch (err) {
      console.log("ℹ️ Ignore if already read:", err);
    }
  }

  // Navigate based on notification type
  if (notification.type === "terms_update") {
    console.log("Navigate to T&C");
    navigation.navigate("TermsAndConditions", {
      version: notification.metadata?.version,
    });
  }
};


 const handleClearAll = async () => {
    if (!user?.email || clearingAll) return;

    try {
      setClearingAll(true);
      const response = await fetch(`${API_BASE}clear_all_notifications/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_email: user.email }),
      });

      if (response.ok) {
        // Clear all notifications from local state immediately
        setNotifications([]);
        
        // Show success message
        setShowClearedMessage(true);
        
        console.log("✅ All notifications cleared");
        
        // Keep showing success message and don't auto-hide
        // New notifications will still appear via auto-refresh
      }
    } catch (error) {
      console.error("Error clearing:", error);
    } finally {
      setClearingAll(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "terms_update":
        return { name: "document-text", color: "#FF6B6B" };
      case "entry":
        return { name: "leaf", color: "#8BC34A" };
      case "comment":
        return { name: "chatbubble", color: "#719862" };
      case "reminder":
        return { name: "notifications", color: "#FFA726" };
      default:
        return { name: "information-circle", color: "#64B5F6" };
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!fontsLoaded) return null;

  return (
    <ImageBackground
      source={require("../assets/background.png")}
      style={styles.bg}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={{ width: 24 }} />
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#719862" />
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={60} color="#FF6B6B" />
            <Text style={styles.errorTitle}>Unable to Load</Text>
            <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity
  style={styles.retryButton}
  onPress={() => user?.email && fetchNotifications(user.email)}
>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#719862"
              />
            }
          >
            {notifications.length === 0 || showClearedMessage ? (
              // Empty state or cleared message
              <View style={styles.emptyState}>
                <Image
                  source={require("../assets/noitification-bg.png")}
                  style={styles.emptyStateImage}
                />
                <Text style={styles.emptyStateTitle}>It's all clear</Text>
                <Text style={styles.emptyStateMessage}>
                  You're all caught up! No new notifications.
                </Text>
              </View>
            ) : (
              <>
                {notifications.map((notification) => {
                  const icon = getNotificationIcon(notification.type);
                  return (
                    <TouchableOpacity
                      key={notification.id}
                      style={[
                        styles.notificationCard,
                        !notification.is_read && styles.unreadCard,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => handleNotificationPress(notification)}
                    >
                      <View
                        style={[
                          styles.iconContainer,
                          { backgroundColor: icon.color + "20" },
                        ]}
                      >
                        <Ionicons
                          name={icon.name as any}
                          size={28}
                          color={icon.color}
                        />
                        {!notification.is_read && (
                          <View style={styles.unreadDot} />
                        )}
                      </View>

                      <View style={styles.notificationContent}>
                        <View style={styles.notificationHeader}>
                          <View style={styles.titleRow}>
                            <Text style={styles.notificationTitle}>
                              {notification.title}
                            </Text>
                            {!notification.is_read && (
                              <View style={styles.newBadge}>
                                <Text style={styles.newBadgeText}>NEW</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.notificationTime}>
                            {formatTimeAgo(notification.created_at)}
                          </Text>
                        </View>
                        <Text style={styles.notificationMessage}>
                          {notification.message}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {/* Only show Clear All if there are unread notifications */}
                {notifications.some((n) => !n.is_read) && (
                  <TouchableOpacity
                    style={[
                      styles.clearButton,
                      clearingAll && styles.clearButtonDisabled,
                    ]}
                    onPress={handleClearAll}
                    disabled={clearingAll}
                  >
                    {clearingAll ? (
                      <ActivityIndicator size="small" color="#666" />
                    ) : (
                      <Text style={styles.clearButtonText}>Clear All</Text>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  container: { flex: 1, paddingTop: 40 },
  header: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerTitle: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 20,
    color: "#000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  notificationCard: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  unreadCard: {
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderLeftWidth: 4,
    borderLeftColor: "#719862",
    shadowOpacity: 0.12,
    elevation: 3,
  },
  iconContainer: {
    position: "relative",
    marginRight: 14,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
  },
  unreadDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF4B4B",
    borderWidth: 2,
    borderColor: "#fff",
  },
  notificationContent: { flex: 1 },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  notificationTitle: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 15,
    color: "#2C2C2C",
    flexShrink: 1,
  },
  newBadge: {
    backgroundColor: "#FF4B4B",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    fontFamily: "Poppins-Bold",
    fontSize: 9,
    color: "#fff",
    letterSpacing: 0.5,
  },
  notificationTime: {
    fontFamily: "Poppins",
    fontSize: 12,
    color: "#666",
    marginLeft: 8,
  },
  notificationMessage: {
    fontFamily: "Poppins",
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  clearButton: {
    backgroundColor: "rgba(155, 184, 146, 0.3)",
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: "center",
    marginTop: 20,
    minWidth: 120,
    alignItems: "center",
  },
  clearButtonDisabled: {
    opacity: 0.5,
  },
  clearButtonText: {
    fontFamily: "Poppins-Medium",
    fontSize: 14,
    color: "#666",
  },
  emptyState: {
  alignItems: "center",
  justifyContent: "flex-start",
  paddingTop: 200, 
},
  emptyStateImage: {
    width: 190,
    height: 150,
    marginBottom: 0,
    resizeMode: "contain",
  },
  emptyStateTitle: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 20,
    color: "#668958ff",
    marginBottom: 0
  },
  emptyStateMessage: {
    fontFamily: "Poppins",
    fontSize: 13,
    color: "#666",
    textAlign: "center",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  errorTitle: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 20,
    color: "#FF6B6B",
    marginTop: 20,
    marginBottom: 10,
  },
  errorMessage: {
    fontFamily: "Poppins",
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#719862",
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 30,
  },
  retryButtonText: {
    fontFamily: "Poppins-Medium",
    fontSize: 14,
    color: "#fff",
  },
});