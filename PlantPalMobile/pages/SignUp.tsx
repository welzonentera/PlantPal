import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ImageBackground,
  Modal,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Checkbox from "expo-checkbox";
import { RootStackParamList } from "../App";

// Determine backend base URL dynamically
const BASE_URL =
  Platform.OS === "android"
    ? "http://10.0.2.2:8000"
    : "http://localhost:8000";

type SignUpScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "SignUp"
>;

export default function SignUp() {
  const navigation = useNavigation<SignUpScreenNavigationProp>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Terms modal states
  const [termsVisible, setTermsVisible] = useState(false);
  const [termsLoading, setTermsLoading] = useState(false);
  const [termsContent, setTermsContent] = useState("");

  // Email exists modal
  const [emailExistsVisible, setEmailExistsVisible] = useState(false);

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

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      alert("Please fill all fields");
      return;
    }
    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }
    if (!agreedToTerms) {
      alert("You must agree to the Terms and Conditions");
      return;
    }

    // Password strength check
    const hasMinLength = password.length >= 8;
    const hasNumber = /\d/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    if (!hasMinLength || !hasNumber || !hasUppercase || !hasSpecialChar) {
      alert("Password is too weak");
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/api/signup/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        // If email already exists, show modal
        if (data.error && data.error.includes("already exists")) {
          setEmailExistsVisible(true);
          return;
        }
        alert(data.error || "Signup failed");
        return;
      }
      await AsyncStorage.setItem("userEmail", data.user.email);
      await AsyncStorage.setItem("username", data.user.username);

      alert(`Signed up successfully!\n\nWelcome ${data.user.username} 🌱`);
      navigation.navigate("Login");
    } catch (err) {
      console.error(err);
      alert("Network error. Please try again.");
    }
  };

  const strengthCount =
    (password.length >= 8 ? 1 : 0) +
    (/\d/.test(password) ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/[!@#$%^&*(),.?":{}|<>]/.test(password) ? 1 : 0);

  let passwordHint = "";
  if (strengthCount < 4) {
    if (password.length < 8) passwordHint = "At least 8 characters required";
    else if (!/\d/.test(password)) passwordHint = "Add a number";
    else if (!/[A-Z]/.test(password)) passwordHint = "Add an uppercase letter";
    else if (!/[!@#$%^&*(),.?\":{}|<>]/.test(password))
      passwordHint = "Add a special character";
  } else passwordHint = "Strong password ✔";

  return (
    <ImageBackground
      source={require("../assets/background.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate("Login")}
        >
          <Ionicons name="arrow-back-outline" size={24} color="#3B6E3B" />
        </TouchableOpacity>

        <Image
          source={require("../assets/plantpal-logo.png")}
          style={styles.logo}
        />
        <Text style={styles.title}>Sign Up</Text>
        <Text style={styles.subtitle}>
          Create your PlantPal+ account and stay{"\n"}rooted in wellness.
        </Text>

        {/* Email */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Username or Email"
            placeholderTextColor="#5c7255ff"
            value={email}
            onChangeText={setEmail}
          />
          <View style={styles.iconCircle}>
            <Ionicons name="mail-outline" size={20} color="#5c7255ff" />
          </View>
        </View>

        {/* Password */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#5c7255ff"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <View style={styles.iconCircle}>
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#5c7255ff"
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Strength bar */}
        <View style={styles.strengthContainer}>
          {[...Array(4)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.strengthBar,
                { backgroundColor: i < strengthCount ? "#3B6E3B" : "#ccc" },
              ]}
            />
          ))}
        </View>

        {password.length > 0 && (
          <Text style={[styles.passwordHint, { color: "#D9534F" }]}>
            {passwordHint}
          </Text>
        )}

        {/* Confirm Password */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#5c7255ff"
            secureTextEntry={!showConfirmPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          <TouchableOpacity
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            <View style={styles.iconCircle}>
              <Ionicons
                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#5c7255ff"
              />
            </View>
          </TouchableOpacity>
        </View>

        {confirmPassword.length > 0 && confirmPassword !== password && (
          <Text style={styles.errorText}>✖ Passwords do not match</Text>
        )}

        {/* Terms and Conditions */}
        <View style={styles.termsContainer}>
          <Checkbox
            value={agreedToTerms}
            onValueChange={setAgreedToTerms}
            color={agreedToTerms ? "#3B6E3B" : undefined}
          />
          <TouchableOpacity onPress={openTermsModal}>
            <Text style={styles.termsText}>I agree to the Terms and Conditions</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.signupButton,
            { backgroundColor: agreedToTerms ? "#3B6E3B" : "#a0bfa0" },
          ]}
          onPress={handleSignUp}
          disabled={!agreedToTerms}
        >
          <Text style={styles.signupTextButton}>Sign Up</Text>
        </TouchableOpacity>
      </View>

      {/* TERMS MODAL */}
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

      {/* EMAIL EXISTS MODAL */}
      <Modal visible={emailExistsVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Email Already Exists</Text>
            <Text style={[styles.modalText, { marginBottom: 20 }]}>
              The email you entered is already registered. Please use a different email or login.
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setEmailExistsVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  background: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: {
    width: "90%",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
  },
  backButton: {
    position: "absolute",
    top: 15,
    left: 15,
    zIndex: 10,
    padding: 5,
    backgroundColor: "#FAFFEF",
    borderRadius: 20,
  },
  logo: {
    width: 80,
    height: 80,
    resizeMode: "contain",
    marginBottom: 2,
  },
  title: {
    fontSize: 28,
    alignSelf: "flex-start",
    fontFamily: "Poppins-SemiBold",
    color: "#2F4F2F",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Poppins",
    letterSpacing: 0.8,
    fontWeight: "600",
    color: "#555",
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e1e9d7ff",
    borderRadius: 25,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 20,
    width: "100%",
  },
  input: { flex: 1, padding: 10, color: "#333", fontFamily: "Poppins" },
  iconCircle: {
    width: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: "#FAFFEF",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  strengthContainer: {
    flexDirection: "row",
    marginVertical: 5,
    marginBottom: 8,
    alignSelf: "flex-start",
    width: "100%",
  },
  strengthBar: {
    flex: 1,
    height: 4,
    marginHorizontal: 2,
    borderRadius: 2,
  },
  passwordHint: {
    fontSize: 12,
    fontFamily: "Poppins",
    marginBottom: 10,
    alignSelf: "flex-start",
  },
  signupButton: {
    borderRadius: 20,
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 15,
  },
  signupTextButton: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Poppins-Medium",
  },
  errorText: {
    color: "#D9534F",
    fontSize: 12,
    alignSelf: "flex-start",
    marginBottom: 10,
    fontFamily: "Poppins",
  },
  termsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    alignSelf: "flex-start",
  },
  termsText: {
    fontFamily: "Poppins",
    fontSize: 12,
    color: "#4A7C59",
    textDecorationLine: "underline",
    marginLeft: 8,
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


