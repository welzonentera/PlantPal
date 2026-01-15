import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useAuth } from "../src/contexts/AuthContext";

type TermsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "TermsAndConditions"
>;

type TermsScreenRouteProp = RouteProp<RootStackParamList, "TermsAndConditions">;

interface TermsData {
  id: string;
  version: string;
  content: string;
  effective_date: string;
  summary?: string;
}

export default function TermsAndConditions() {
  const navigation = useNavigation<TermsScreenNavigationProp>();
  const route = useRoute<TermsScreenRouteProp>();
  const { user } = useAuth(); // <-- get user from auth context

  const API_BASE = "http://127.0.0.1:8000/api/";

  const [termsData, setTermsData] = useState<TermsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  const [fontsLoaded] = useFonts({
    Poppins: require("../assets/fonts/Poppins-Regular.ttf"),
    "Poppins-Bold": require("../assets/fonts/Poppins-Bold.ttf"),
    "Poppins-Medium": require("../assets/fonts/Poppins-Medium.ttf"),
    "Poppins-SemiBold": require("../assets/fonts/Poppins-SemiBold.ttf"),
  });

  useEffect(() => {
    fetchLatestTerms();
  }, []);

  const fetchLatestTerms = async () => {
    try {
      setLoading(true);
      setError(null);

      const version = route.params?.version;
      const url = `${API_BASE}get_terms_conditions/`;

      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error(`Server returned ${response.status}`);

      const data = await response.json();

      if (data && data.length > 0) {
        const terms = version
          ? data.find((t: TermsData) => t.version === version) || data[0]
          : data[0];
        setTermsData(terms);
      } else {
        setError("No terms and conditions found");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load terms");
    } finally {
      setLoading(false);
    }
  };
const handleAccept = async () => {
  if (!user?.email || !termsData || accepting) return;

  try {
    setAccepting(true);

    const response = await fetch(`${API_BASE}accept_terms_conditions/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_email: user.email,
        terms_id: termsData.id,
      }),
    });

    const result = await response.json();

    if (response.status === 201) {
      console.log("✅ Terms accepted:", result.message);
      Alert.alert("Success", "You have accepted the latest terms.");
      navigation.goBack();
    } else if (
      response.status === 200 &&
      result.message.includes("already accepted")
    ) {
      console.log("ℹ️ Already accepted");
      Alert.alert("Info", "You have already accepted this version.");
      navigation.goBack();
    } else {
      throw new Error(result.error || "Failed to accept terms");
    }
  } catch (error: any) {
    Alert.alert("Error", error.message || "Failed to accept terms.");
  } finally {
    setAccepting(false);
  }
};



  const handleDecline = () => {
    setDeclining(true);
    setTimeout(() => {
      setDeclining(false);
      navigation.goBack();
    }, 300);
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  if (!fontsLoaded || !user) return null; // <-- wait for auth context

  return (
    <ImageBackground
      source={require("../assets/background.png")}
      style={styles.bg}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Terms of Service</Text>
          <View style={{ width: 24 }} />
        </View>

        {loading ? (
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
              onPress={fetchLatestTerms}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          termsData && (
            <>
              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
              >
                <View style={styles.contentCard}>
                  <Text style={styles.lastUpdated}>
                    Last updated on {formatDate(termsData.effective_date)}
                  </Text>

                  {termsData.summary && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Summary</Text>
                      <Text style={styles.sectionText}>{termsData.summary}</Text>
                    </View>
                  )}

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Terms</Text>
                    <Text style={styles.sectionText}>{termsData.content}</Text>
                  </View>
                </View>
              </ScrollView>

              {/* Buttons
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.declineButton,
                    declining && styles.buttonDisabled,
                  ]}
                  onPress={handleDecline}
                  disabled={declining || accepting}
                >
                  {declining ? (
                    <ActivityIndicator size="small" color="#666" />
                  ) : (
                    <>
                      <Ionicons name="close" size={20} color="#666" />
                      <Text style={styles.declineButtonText}>Decline</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.acceptButton,
                    accepting && styles.buttonDisabled,
                  ]}
                  onPress={handleAccept}
                  disabled={accepting || declining}
                >
                  {accepting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color="#fff" />
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View> */}
            </>
          )
        )}
      </View>
    </ImageBackground>
  );
}

// Styles remain same as before
const styles = StyleSheet.create({
  bg: { flex: 1 },
  container: { flex: 1, paddingTop: 40 },
  header: { width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 20 },
  headerTitle: { fontFamily: "Poppins-SemiBold", fontSize: 20, color: "#000" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  errorTitle: { fontFamily: "Poppins-SemiBold", fontSize: 20, color: "#FF6B6B", marginTop: 20, marginBottom: 10 },
  errorMessage: { fontFamily: "Poppins", fontSize: 14, color: "#666", textAlign: "center", marginBottom: 20 },
  retryButton: { backgroundColor: "#719862", borderRadius: 20, paddingVertical: 12, paddingHorizontal: 30 },
  retryButtonText: { fontFamily: "Poppins-Medium", fontSize: 14, color: "#fff" },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20 },
  contentCard: { backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 16, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  lastUpdated: { fontFamily: "Poppins", fontSize: 13, color: "#999", marginBottom: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontFamily: "Poppins-SemiBold", fontSize: 18, color: "#2C2C2C", marginBottom: 12 },
  sectionText: { fontFamily: "Poppins", fontSize: 14, color: "#666", lineHeight: 22 },
  buttonContainer: { flexDirection: "row", paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 30, gap: 12, backgroundColor: "transparent" },
  button: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 15, gap: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  declineButton: { backgroundColor: "rgba(255,255,255,0.9)", borderWidth: 1.5, borderColor: "#E0E0E0" },
  acceptButton: { backgroundColor: "#719862" },
  buttonDisabled: { opacity: 0.5 },
  declineButtonText: { fontFamily: "Poppins-Medium", fontSize: 15, color: "#666" },
  acceptButtonText: { fontFamily: "Poppins-Medium", fontSize: 15, color: "#fff" },
});
