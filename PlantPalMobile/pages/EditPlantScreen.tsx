import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ImageBackground,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface EditPlantScreenProps {
  visible: boolean;
  onClose: () => void;
  onSave: (newNickname: string, species: string) => void;
  onDelete: () => void;
  currentNickname: string;
  currentSpecies: string;
  plantImage: any;
}

export default function EditPlantScreen({
  visible,
  onClose,
  onSave,
  onDelete,
  currentNickname,
  currentSpecies,
  plantImage,
}: EditPlantScreenProps) {
  const [nickname, setNickname] = useState(currentNickname);
  const [species, setSpecies] = useState(currentSpecies);

  // Update local state when props change
  useEffect(() => {
    setNickname(currentNickname);
    setSpecies(currentSpecies);
  }, [currentNickname, currentSpecies, visible]);

  const handleSave = () => {
    if (!nickname.trim()) {
      Alert.alert("Error", "Please enter a nickname");
      return;
    }

    onSave(nickname.trim(), species.trim());
    onClose();
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Plant",
      "Are you sure you want to remove this plant from your journal?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onDelete();
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Plant</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Plant Image Preview */}
          <View style={styles.imagePreviewContainer}>
            <ImageBackground
              source={plantImage}
              style={styles.imagePreview}
              imageStyle={styles.imagePreviewStyle}
            >
              <View style={styles.imageOverlay}>
                <Ionicons name="leaf" size={32} color="rgba(255,255,255,0.8)" />
              </View>
            </ImageBackground>
          </View>

          {/* Nickname Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nickname</Text>
            <TextInput
              style={styles.input}
              placeholder="Give your plant a nickname"
              value={nickname}
              onChangeText={setNickname}
              placeholderTextColor="#999"
            />
          </View>

          {/* Species Input (Read-only) */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Species</Text>
            <View style={styles.readOnlyInput}>
              <Text style={styles.readOnlyText}>{species}</Text>
            </View>
            <Text style={styles.helperText}>Species cannot be changed</Text>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color="#dc2626" />
            <Text style={styles.deleteButtonText}>Remove from Journal</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: "Poppins-Bold",
    color: "#2D5016",
  },
  imagePreviewContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    backgroundColor: "#e0e0e0",
  },
  imagePreviewStyle: {
    borderRadius: 60,
  },
  imageOverlay: {
    flex: 1,
    backgroundColor: "rgba(90, 140, 74, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontFamily: "Poppins-Bold",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontFamily: "Poppins",
    backgroundColor: "#f9f9f9",
  },
  readOnlyInput: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#f5f5f5",
  },
  readOnlyText: {
    fontSize: 15,
    fontFamily: "Poppins",
    color: "#666",
  },
  helperText: {
    fontSize: 12,
    fontFamily: "Poppins",
    color: "#999",
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: "#5a8c4a",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: "Poppins-Bold",
    color: "#fff",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fee",
    borderWidth: 1,
    borderColor: "#fcc",
  },
  deleteButtonText: {
    fontSize: 15,
    fontFamily: "Poppins-SemiBold",
    color: "#dc2626",
    marginLeft: 8,
  },
});