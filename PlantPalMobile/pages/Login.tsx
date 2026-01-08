// Login.tsx
import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ImageBackground,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Checkbox from "expo-checkbox";
import { useFonts } from "expo-font";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useAuth } from "../src/contexts/AuthContext";
import GoogleLogin from "../src/components/GoogleLogin";
import * as SecureStore from 'expo-secure-store';

const BASE_URL =
  Platform.OS === "android"
    ? "http://127.0.0.1:8000"
    : "http://localhost:8000";

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, "Login">;

export default function Login() {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { setUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secureText, setSecureText] = useState(true);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  const [termsVisible, setTermsVisible] = useState(false);
  const [termsLoading, setTermsLoading] = useState(false);
  const [termsContent, setTermsContent] = useState("");

  // Load saved credentials on mount
  useEffect(() => {
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = async () => {
    try {
      const savedEmail = await SecureStore.getItemAsync('savedEmail');
      const savedPassword = await SecureStore.getItemAsync('savedPassword');
      const savedRemember = await SecureStore.getItemAsync('rememberMe');
      
      if (savedRemember === 'true' && savedEmail && savedPassword) {
        setEmail(savedEmail);
        setPassword(savedPassword);
        setRemember(true);
      }
    } catch (error) {
      console.log('Error loading credentials:', error);
    }
  };

  const [fontsLoaded] = useFonts({
    Poppins: require("../assets/fonts/Poppins-Regular.ttf"),
    "Poppins-Bold": require("../assets/fonts/Poppins-Bold.ttf"),
    "Poppins-Medium": require("../assets/fonts/Poppins-Medium.ttf"),
    "Poppins-SemiBold": require("../assets/fonts/Poppins-SemiBold.ttf"),
    "Poppins-Italic": require("../assets/fonts/Poppins-Italic.ttf"),
  });

  if (!fontsLoaded) return null;

  const openTermsModal = async () => {
    setTermsVisible(true);
    setTermsLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api/get_latest_terms_conditions/`);
      if (!response.ok) throw new Error("Failed to fetch Terms");
      const result = await response.json();
      setTermsContent(result.content || "No Terms and Conditions found.");
    } catch (err) {
      console.log(err);
      setTermsContent("Failed to load Terms and Conditions.");
    } finally {
      setTermsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Missing fields", "Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        Alert.alert("Login failed", result.error || "Invalid email or password.");
        return;
      }

      await setUser(
        { email: result.user.email }, 
        result.tokens.access,
        result.tokens.refresh
      );
      
      // Save or clear credentials based on Remember Me
      if (remember) {
        await SecureStore.setItemAsync('savedEmail', email);
        await SecureStore.setItemAsync('savedPassword', password);
        await SecureStore.setItemAsync('rememberMe', 'true');
      } else {
        await SecureStore.deleteItemAsync('savedEmail');
        await SecureStore.deleteItemAsync('savedPassword');
        await SecureStore.deleteItemAsync('rememberMe');
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      Alert.alert("Success", "Login successful!");
      
      // ✅ Navigate to Main (Tab Navigator)
      navigation.navigate("Main");
      
    } catch (err) {
      console.log(err);
      Alert.alert("Error", "Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require("../assets/background.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <Text style={styles.title}>Login</Text>
        <Text style={styles.subtitle}>
          Log in to PlantPal+ and keep growing{"\n"}your herbal knowledge and
          wellness{"\n"}journey.
        </Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Username or Email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            importantForAutofill="no"
          />
          <View style={styles.iconCircle}>
            <Ionicons name="mail-outline" size={20} color="#5c7255ff" />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#999"
            secureTextEntry={secureText}
            value={password}
            onChangeText={setPassword}
            autoComplete="password"
            importantForAutofill="no"
          />
          <TouchableOpacity onPress={() => setSecureText(!secureText)}>
            <View style={styles.iconCircle}>
              <Ionicons
                name={secureText ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#5c7255ff"
              />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <View style={styles.rememberContainer}>
            <Checkbox
              value={remember}
              onValueChange={setRemember}
              color={remember ? "#4A7C59" : undefined}
              style={{
                width: 15,
                height: 15,
                borderWidth: 1,
                borderColor: "black",
                borderRadius: 4,
              }}
            />
            <Text style={styles.remember}>Remember Me</Text>
          </View>
          <TouchableOpacity>
            <Text style={styles.forgot}>Forgot Password</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginText}>Login</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.orText}>Or</Text>
        <GoogleLogin />

        <Text style={styles.signupText}>
          Do not have an account yet?{" "}
          <Text
            style={styles.signupLink}
            onPress={() => navigation.navigate("SignUp")}
          >
            Sign Up
          </Text>
        </Text>

        <TouchableOpacity onPress={openTermsModal}>
          <Text style={styles.terms}>Terms and Conditions</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={termsVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Terms and Conditions</Text>
            {termsLoading ? (
              <ActivityIndicator size="large" />
            ) : (
              <ScrollView style={styles.modalContent}>
                <Text style={styles.modalText}>{termsContent}</Text>
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setTermsVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: {
    width: "90%",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
  },
  iconCircle: {
    width: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: "#FAFFEF",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  title: {
    fontSize: 28,
    alignSelf: "flex-start",
    fontFamily: "Poppins-SemiBold",
    color: "#2F4F2F",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Poppins",
    letterSpacing: 0.8,
    fontWeight: "600",
    color: "#555",
    alignSelf: "flex-start",
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e1e9d7ff",
    borderRadius: 25,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 15,
    width: "100%",
  },
  input: { flex: 1, padding: 10, color: "#333", fontFamily: "Poppins" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 25,
    alignItems: "center",
  },
  rememberContainer: { flexDirection: "row", alignItems: "center" },
  remember: {
    fontSize: 13,
    fontFamily: "Poppins",
    color: "#333",
    marginLeft: 8,
  },
  forgot: {
    fontSize: 12,
    fontFamily: "Poppins-Italic",
    color: "#579755ff",
    textDecorationLine: "underline",
  },
  loginButton: {
    backgroundColor: "#3B6E3B",
    borderRadius: 20,
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 15,
  },
  loginText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Poppins-Medium",
  },
  orText: {
    fontSize: 14,
    fontFamily: "Poppins-Medium",
    color: "#555",
    marginBottom: 15,
  },
  signupText: {
    fontSize: 14,
    fontFamily: "Poppins",
    color: "#333",
    marginBottom: 10,
  },
  signupLink: {
    color: "#4A7C59",
    fontFamily: "Poppins",
    textDecorationLine: "underline",
  },
  terms: {
    fontSize: 12,
    fontFamily: "Poppins",
    color: "#4A7C59",
    textDecorationLine: "underline",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Poppins-Bold",
    marginBottom: 10,
    textAlign: "center",
  },
  modalContent: { marginBottom: 20 },
  modalText: {
    fontSize: 14,
    fontFamily: "Poppins",
    lineHeight: 20,
  },
  closeButton: {
    backgroundColor: "#4A7C59",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#fff",
    fontFamily: "Poppins-Medium",
    fontSize: 15,
  },
});