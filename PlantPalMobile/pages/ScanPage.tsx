import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  Image,
  Dimensions,
  PanResponder,
  Animated,
  Easing,
  ScrollView,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useFonts } from "expo-font";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import { useAuth } from "../src/contexts/AuthContext";
import Toast from 'react-native-toast-message';

type ScanPageNavigationProp = NativeStackNavigationProp<RootStackParamList>;
type CameraFacing = "front" | "back";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ScanPage() {
  const navigation = useNavigation<ScanPageNavigationProp>();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraFacing>("back");
  const [flashMode, setFlashMode] = useState<"off" | "on" | "auto">("off");
  const cameraRef = useRef<CameraView>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const scanAnim = useRef(new Animated.Value(0)).current;
  const [scanComplete, setScanComplete] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoPage, setInfoPage] = useState(0);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [plantResult, setPlantResult] = useState<{ plant_name: string; confidence: number; confidence_level: string; warning?: string; } | null>(null);
  const [topPredictions, setTopPredictions] = useState<PlantPrediction[]>([]);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [imageRotation, setImageRotation] = useState(0);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [cropFrame, setCropFrame] = useState({ x: 40, y: 120, width: 300, height: 300 });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showNoPlantModal, setShowNoPlantModal] = useState(false);
  const [showThanksMessage, setShowThanksMessage] = useState(false);
  const [visibleResultsCount, setVisibleResultsCount] = useState(2);
  const [currentScanId, setCurrentScanId] = useState<string | null>(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0); 

  const dragStartPos = useRef({ x: 0, y: 0, frameX: 0, frameY: 0, frameWidth: 0, frameHeight: 0 });
  const { signOut, accessToken, user } = useAuth();

  const [fontsLoaded] = useFonts({
    Poppins: require("../assets/fonts/Poppins-Regular.ttf"),
    "Poppins-Bold": require("../assets/fonts/Poppins-Bold.ttf"),
    "Poppins-Medium": require("../assets/fonts/Poppins-Medium.ttf"),
    "Poppins-SemiBold": require("../assets/fonts/Poppins-SemiBold.ttf"),
  });

  useEffect(() => {
    const loadUserAvatar = async () => {
      if (!user || !user.email) return;
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/profile/?email=${encodeURIComponent(user.email)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.profile?.avatar_url) {
            setAvatarUrl(data.profile.avatar_url);
          }
        }
      } catch (error) {
        console.error("Failed to load avatar:", error);
      }
    };
    loadUserAvatar();
  }, [user]);

  // ← ADD THIS ENTIRE useEffect BLOCK
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!user?.email) return;
      
      try {
        const response = await fetch(
          `http://127.0.0.1:8000/api/get_user_notifications/?user_email=${encodeURIComponent(user.email)}`
        );
        
        if (response.ok) {
          const data = await response.json();
          const unreadCount = data.filter((notif: any) => !notif.is_read).length;
          setUnreadNotificationsCount(unreadCount);
        }
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      }
    };

    fetchUnreadCount();
    
    // Poll every 10 seconds for new notifications
    const interval = setInterval(fetchUnreadCount, 10000);
    
    return () => clearInterval(interval);
  }, [user?.email]);

  const getConfidenceColor = (level: string) => level === 'high' ? '#4A7C59' : level === 'medium' ? '#D4A017' : level === 'low' ? '#FF8C00' : '#CC6600';
  const toggleFlash = () => setFlashMode((current) => current === "off" ? "on" : current === "on" ? "auto" : "off");
  const getFlashIcon = () => flashMode === "off" ? "flash-off" : flashMode === "on" ? "flash" : "flash-outline";
  const rotateImageLeft = () => setImageRotation((prev) => (prev - 90) % 360);
  const rotateImageRight = () => setImageRotation((prev) => (prev + 90) % 360);
  const closeResult = () => { setShowResult(false); setPlantResult(null); };
  const openInfoModal = () => { setInfoPage(0); setShowInfoModal(true); };
  const nextInfoPage = () => infoPage < 2 ? setInfoPage(infoPage + 1) : setShowInfoModal(false);
  const prevInfoPage = () => infoPage > 0 && setInfoPage(infoPage - 1);
  const handleLogout = () => { signOut(); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); };
const showMoreResults = () => {
  setVisibleResultsCount(prev => Math.min(prev + 2, topPredictions.length));
};



  const closeImageEditor = () => {
    setShowImageEditor(false);
    setCapturedImageUri(null);
    setImageRotation(0);
    setCropFrame({
      x: SCREEN_WIDTH * 0.125,
      y: SCREEN_HEIGHT * 0.25,
      width: SCREEN_WIDTH * 0.75,
      height: SCREEN_WIDTH * 0.75,
    });
  };

  const startScanAnimation = () => {
    scanAnim.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 0.5, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  };

  const stopScanAnimation = () => {
    scanAnim.stopAnimation();
  };

interface PlantPrediction {
  plant_name: string;
  scientific_name: string;
  confidence: number;
  image_url?: string | null;  // ✅ Allow null
  plant_data?: {
    id: string;
    plant_name: string;
    scientific_name: string;
    common_names: string[];
    origin: string;
    images: string[];
    ailments: Record<string, Array<{
      ailment: string;
      reference: string;
      herbalBenefit: string;
    }>>;
  } | null;
}

  const findPlantMatch = (mlPlantName: string, database: any[]): any | null => {
    const normalized = mlPlantName.toLowerCase().replace(/[_-]/g, ' ').replace(/[^a-z\s]/g, '').trim();
    const directMatch = database.find((plant: any) => {
      const plantName = plant.plant_name.toLowerCase().replace(/[_-]/g, ' ').replace(/[^a-z\s]/g, '').trim();
      return plantName === normalized;
    });
    if (directMatch) return directMatch;
    const commonNameMatch = database.find((plant: any) => {
      if (!plant.common_names || !Array.isArray(plant.common_names)) return false;
      return plant.common_names.some((name: string) => {
        const commonName = name.toLowerCase().replace(/[_-]/g, ' ').replace(/[^a-z\s]/g, '').trim();
        return commonName === normalized;
      });
    });
    if (commonNameMatch) return commonNameMatch;
    const words = normalized.split(' ').filter(w => w.length > 3);
    if (words.length > 0) {
      const partialMatch = database.find((plant: any) => {
        const plantName = plant.plant_name.toLowerCase();
        const scientificName = plant.scientific_name?.toLowerCase() || '';
        return words.every(word => plantName.includes(word) || scientificName.includes(word));
      });
      if (partialMatch) return partialMatch;
    }
    return null;
  };

  const formatPlantName = (name: string): string => {
    return name.replace(/[_-]/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

const processAndScanImage = async (imageUri: string) => {
  try {
    setIsScanning(true);
    setScanComplete(false);
    setShowImageEditor(false);
    
    // ✅ Validate user is logged in
    if (!user?.email) {
      Alert.alert("Error", "You must be logged in to scan plants.");
      setIsScanning(false);
      return;
    }
    
    if (!accessToken) {
      Alert.alert("Error", "Session expired. Please login again.");
      setIsScanning(false);
      return;
    }
    
    console.log("✅ User email:", user.email);
    
    let finalUri = imageUri;
    if (imageRotation !== 0) {
      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri, 
        [{ rotate: imageRotation }], 
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      finalUri = manipResult.uri;
    }
    
    const response = await fetch(finalUri);
    const blob = await response.blob();
    const reader = new FileReader();
    
    reader.onloadend = async () => {
      const base64data = reader.result as string;
      const base64Image = base64data.split(',')[1];
      
      console.log("📤 Sending scan with email:", user.email);
      
      // ✅ EXPLICITLY SEND USER EMAIL IN REQUEST BODY
      const scanResponse = await fetch("http://127.0.0.1:8000/api/scan_plant/", {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${accessToken}`, 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({ 
          imageBase64: base64Image, 
          source: "camera",
          user_email: user.email  // ✅ ADD THIS LINE
        }),
      });
      
      const scanData = await scanResponse.json();
      
      console.log("📥 Response:", scanData);
      
      if (!scanResponse.ok) {
        throw new Error(scanData.error || "Scan failed");
      }
      
      if (scanData.status === "unknown") {
        stopScanAnimation();
        setIsScanning(false);
        setScanComplete(false);
        setCapturedImageUri(null);
        setShowNoPlantModal(true);
        return;
      }
      
      if (scanData.status === "error") {
        throw new Error(scanData.message || "Scan failed");
      }
      
      // Set the main result
      setPlantResult({
        plant_name: scanData.plant_name,
        confidence: scanData.confidence,
        confidence_level: scanData.confidence_level || 'medium',
        warning: scanData.warning
      });
      
      // Build predictions list
      const enrichedPredictions: PlantPrediction[] = [];
      
      // Add the top result first
      if (scanData.plant_data) {
        enrichedPredictions.push({
          plant_name: scanData.plant_name,
          scientific_name: scanData.scientific_name,
          confidence: scanData.confidence,
          image_url: scanData.plant_data.image || capturedImageUri,
          plant_data: scanData.plant_data
        });
      } else {
        enrichedPredictions.push({
          plant_name: scanData.plant_name,
          scientific_name: scanData.scientific_name || scanData.plant_name,
          confidence: scanData.confidence,
          image_url: capturedImageUri,
          plant_data: null
        });
      }
      
      // Add remaining predictions
      if (scanData.top_predictions && scanData.top_predictions.length > 0) {
        for (const pred of scanData.top_predictions) {
          if (pred.plant_name === scanData.plant_name) continue;
          
          enrichedPredictions.push({
            plant_name: pred.plant_name,
            scientific_name: pred.scientific_name,
            confidence: pred.confidence,
            image_url: pred.image_url,
            plant_data: pred.plant_data
          });
          
          if (enrichedPredictions.length >= 5) break;
        }
      }
      
setVisibleResultsCount(2);
      setTopPredictions(enrichedPredictions);

      // ✅ Save scan_history_id for feedback
      if (scanData.scan_history_id) {
        setCurrentScanId(scanData.scan_history_id);
        console.log("✅ Scan ID saved:", scanData.scan_history_id);
      }

      setTimeout(() => { 
        stopScanAnimation(); 
        setScanComplete(true); 
      }, 1500);
    };
    
    reader.readAsDataURL(blob);
  } catch (err: any) {
    console.error("❌ Scan error:", err);
    Alert.alert(
      "Scan Failed", 
      err.message || "Please try a clearer leaf image with better lighting."
    );
    stopScanAnimation();
    setIsScanning(false);
    setScanComplete(false);
    setTopPredictions([]);
    setCapturedImageUri(null);
    setImageRotation(0);
  }
};
  
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Needed", "Please grant gallery access to upload images.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1.0,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets[0].uri) return;
      const imageUri = result.assets[0].uri;
      Image.getSize(imageUri, (width, height) => { setImageDimensions({ width, height }); });
      setCapturedImageUri(imageUri);
      setImageRotation(0);
      setShowImageEditor(true);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to pick image from gallery.");
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1.0, skipProcessing: false, exif: false });
      if (!photo.uri) {
        Alert.alert("Error", "Unable to capture image.");
        return;
      }
      const imageUri = photo.uri;
      Image.getSize(imageUri, (width, height) => { setImageDimensions({ width, height }); });
      setCapturedImageUri(imageUri);
      setImageRotation(0);
      setShowImageEditor(true);
    } catch (err: any) {
      Alert.alert("Capture Failed", err.message || "Unable to take picture.");
    }
  };
  

// ========== PAN RESPONDERS ==========
  const panResponderMove = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gestureState) => {
        setCropFrame((current) => {
          dragStartPos.current = {
            x: gestureState.x0,
            y: gestureState.y0,
            frameX: current.x,
            frameY: current.y,
            frameWidth: current.width,
            frameHeight: current.height,
          };
          return current;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const deltaX = gestureState.dx;
        const deltaY = gestureState.dy;

        setCropFrame({
          x: dragStartPos.current.frameX + deltaX,
          y: dragStartPos.current.frameY + deltaY,
          width: dragStartPos.current.frameWidth,
          height: dragStartPos.current.frameHeight,
        });
      },
    })
  ).current;

  const panResponderTL = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gestureState) => {
        setCropFrame((current) => {
          dragStartPos.current = {
            x: gestureState.x0,
            y: gestureState.y0,
            frameX: current.x,
            frameY: current.y,
            frameWidth: current.width,
            frameHeight: current.height,
          };
          return current;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const deltaX = gestureState.dx;
        const deltaY = gestureState.dy;

        const newX = dragStartPos.current.frameX + deltaX;
        const newY = dragStartPos.current.frameY + deltaY;
        const newWidth = dragStartPos.current.frameWidth - deltaX;
        const newHeight = dragStartPos.current.frameHeight - deltaY;

        if (newWidth > 50 && newHeight > 50) {
          setCropFrame({
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight,
          });
        }
      },
    })
  ).current;

  const panResponderTR = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gestureState) => {
        setCropFrame((current) => {
          dragStartPos.current = {
            x: gestureState.x0,
            y: gestureState.y0,
            frameX: current.x,
            frameY: current.y,
            frameWidth: current.width,
            frameHeight: current.height,
          };
          return current;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const deltaX = gestureState.dx;
        const deltaY = gestureState.dy;

        const newY = dragStartPos.current.frameY + deltaY;
        const newWidth = dragStartPos.current.frameWidth + deltaX;
        const newHeight = dragStartPos.current.frameHeight - deltaY;

        if (newWidth > 50 && newHeight > 50) {
          setCropFrame({
            x: dragStartPos.current.frameX,
            y: newY,
            width: newWidth,
            height: newHeight,
          });
        }
      },
    })
  ).current;

  const panResponderBL = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gestureState) => {
        setCropFrame((current) => {
          dragStartPos.current = {
            x: gestureState.x0,
            y: gestureState.y0,
            frameX: current.x,
            frameY: current.y,
            frameWidth: current.width,
            frameHeight: current.height,
          };
          return current;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const deltaX = gestureState.dx;
        const deltaY = gestureState.dy;

        const newX = dragStartPos.current.frameX + deltaX;
        const newWidth = dragStartPos.current.frameWidth - deltaX;
        const newHeight = dragStartPos.current.frameHeight + deltaY;

        if (newWidth > 50 && newHeight > 50) {
          setCropFrame({
            x: newX,
            y: dragStartPos.current.frameY,
            width: newWidth,
            height: newHeight,
          });
        }
      },
    })
  ).current;

  const panResponderBR = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gestureState) => {
        setCropFrame((current) => {
          dragStartPos.current = {
            x: gestureState.x0,
            y: gestureState.y0,
            frameX: current.x,
            frameY: current.y,
            frameWidth: current.width,
            frameHeight: current.height,
          };
          return current;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const deltaX = gestureState.dx;
        const deltaY = gestureState.dy;

        const newWidth = dragStartPos.current.frameWidth + deltaX;
        const newHeight = dragStartPos.current.frameHeight + deltaY;

        if (newWidth > 50 && newHeight > 50) {
          setCropFrame({
            x: dragStartPos.current.frameX,
            y: dragStartPos.current.frameY,
            width: newWidth,
            height: newHeight,
          });
        }
      },
    })
  ).current;
  // ========== END OF PAN RESPONDERS ==========
  if (!fontsLoaded) return null;

  if (!permission) return <Text style={styles.loadingText}>Loading...</Text>;
  
  if (!permission.granted)
    return (
      <View style={styles.container}>
        <Text style={styles.noAccessText}>
          We need your permission to show the camera
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={requestPermission}>
          <Text style={styles.backButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: "#666" }]}
          onPress={handleLogout}
        >
          <Text style={styles.backButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    );



  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={toggleFlash}>
            <Ionicons name={getFlashIcon()} size={28} color="#fff" />
          </TouchableOpacity>
          
       <View style={styles.rightTopContainer}>
  {/* Notifications icon with badge */}
 <TouchableOpacity
    style={styles.notificationIconContainer}
    onPress={() => {
      navigation.navigate("Notifications");
      setUnreadNotificationsCount(0); // Reset count when opened
    }}
  >
    <Ionicons name="notifications-outline" size={26} color="#fff" />
    {unreadNotificationsCount > 0 && (
      <View style={styles.notificationBadge} />
    )}
  </TouchableOpacity>

  {/* Profile icon */}
  <TouchableOpacity
    style={styles.profileCircle}
    onPress={() => navigation.navigate("Profile")}
  >
    {avatarUrl ? (
      <Image source={{ uri: avatarUrl }} style={styles.profileImage} />
    ) : (
      <Ionicons name="person" size={20} color="#fff" />
    )}
  </TouchableOpacity>
</View>

        </View>

  {isScanning && (
  <Modal
    visible={isScanning}
    animationType="none"
    transparent={true}
    statusBarTranslucent={false}
  >
    <View style={styles.scanResultsContainer}>
      {/* Header */}
      <View style={styles.scanResultsHeader}>
     <TouchableOpacity onPress={() => {
  stopScanAnimation();
  setIsScanning(false);
  setScanComplete(false);
  setTopPredictions([]);
  setCapturedImageUri(null);
  setCurrentScanId(null);  // ← ADD THIS LINE
}}>
  <Ionicons name="arrow-back" size={28} color="#46811cff" />
</TouchableOpacity>
        <Text style={styles.scanResultsTitle}>Snap results</Text>
        <TouchableOpacity>
          <Ionicons name="ellipsis-vertical" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Image Container with Rounded Corners */}
      <View style={styles.scanImageWrapper}>
        <View style={styles.scanImageContainer}>
          {capturedImageUri && (
            <Image 
              source={{ uri: capturedImageUri }}
              style={[
                styles.scanResultImage,
                { transform: [{ rotate: `${imageRotation}deg` }] }
              ]}
              resizeMode="cover"
            />
          )}
          
          {/* Grid Overlay with dots - only show during scanning */}
          {!scanComplete && (
            <View style={styles.gridOverlay}>
              {Array.from({ length: 15 }).map((_, row) => (
                Array.from({ length: 15 }).map((_, col) => (
                  <View 
                    key={`dot-${row}-${col}`} 
                    style={[
                      styles.gridDot,
                      { 
                        left: `${(col * 100) / 14}%`,
                        top: `${(row * 100) / 14}%`
                      }
                    ]} 
                  />
                ))
              ))}
            </View>
          )}

          {/* Scanning Line Animation - only show during scanning */}
          {!scanComplete && (
            <Animated.View
              style={[
                styles.scanLineGreen,
                {
                  transform: [
                    {
                      translateY: scanAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [-SCREEN_WIDTH * 0.6, SCREEN_WIDTH * 0.6, -SCREEN_WIDTH * 0.6],
                      }),
                    },
                  ],
                },
              ]}
            />
          )}

          {/* Expand Icon - Top Right */}
          <TouchableOpacity style={styles.expandButton}>
            <Ionicons name="expand-outline" size={24} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Top Results Section */}
   <ScrollView 
        style={styles.topResultsSection}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.topResultsTitle}>Top results</Text>
        
        {!scanComplete ? (
          // Loading state
          <View style={styles.emptyResultsGrid}>
            <View style={styles.emptyResultCard}>
              <ActivityIndicator size="large" color="#A8D5BA" />
            </View>
            <View style={styles.emptyResultCard}>
              <ActivityIndicator size="large" color="#A8D5BA" />
            </View>
          </View>
        ) : (
          // Results loaded
          <>
           <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.resultsScrollView}
              contentContainerStyle={styles.resultsScrollContent}
            >
           {topPredictions.slice(0, visibleResultsCount).map((prediction, index) => (
                <View 
                  key={index}
                  style={styles.resultCardHorizontal}
                >
     <TouchableOpacity 
  style={styles.resultImageContainerHorizontal}
  onPress={() => {
    const plant = prediction.plant_data;
    
    if (!plant) {
      Alert.alert(
        prediction.plant_name,
        `Scientific name: ${prediction.scientific_name}\nConfidence: ${prediction.confidence.toFixed(1)}%\n\nNo additional information available.`
      );
      return;
    }

    // ✅ DON'T close the scan modal - keep it in background
    // Just navigate to plant details
    navigation.navigate('PlantDetails', { 
      plantId: plant.id 
    });
  }}
>
                    <Image 
                      source={{ uri: prediction.image_url || 'https://via.placeholder.com/150' }}
                      style={styles.resultCardImageHorizontal}
                      resizeMode="cover"
                    />
              <TouchableOpacity 
              style={styles.bookmarkButtonHorizontal}
              onPress={async (e) => {
                e.stopPropagation();
                
                const plant = prediction.plant_data;
                
                if (!plant?.id) {
                  Toast.show({
                    type: 'error',
                    text1: 'Cannot add to journal',
                    text2: 'Plant information not available',
                    position: 'top',
                    topOffset: 80,
                    visibilityTime: 3500,
                    props: {
                      style: {
                        backgroundColor: '#FFFFFF',
                        borderRadius: 12,
                        paddingVertical: 16,
                        paddingHorizontal: 20,
                        marginHorizontal: 20,
                        borderLeftColor: '#E53935',
                        borderLeftWidth: 8,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 8,
                      },
                      text1Style: { 
                        color: '#E53935', 
                        fontFamily: 'Poppins-Bold', 
                        fontSize: 16,
                        marginBottom: 4,
                      },
                      text2Style: { 
                        color: '#666', 
                        fontFamily: 'Poppins', 
                        fontSize: 14,
                        lineHeight: 20,
                      },
                    }
                  });
                  return;
                }

                if (!user?.email) {
                  Toast.show({
                    type: 'error',
                    text1: 'Not logged in',
                    text2: 'Please log in to save plants',
                    position: 'top',
                    topOffset: 80,
                    visibilityTime: 3500,
                    props: {
                      style: {
                        backgroundColor: '#FFFFFF',
                        borderRadius: 12,
                        paddingVertical: 16,
                        paddingHorizontal: 20,
                        marginHorizontal: 20,
                        borderLeftColor: '#E53935',
                        borderLeftWidth: 8,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 8,
                      },
                      text1Style: { 
                        color: '#E53935', 
                        fontFamily: 'Poppins-Bold', 
                        fontSize: 16,
                        marginBottom: 4,
                      },
                      text2Style: { 
                        color: '#666', 
                        fontFamily: 'Poppins', 
                        fontSize: 14,
                        lineHeight: 20,
                      },
                    }
                  });
                  return;
                }

                try {
                   const response = await fetch('http://127.0.0.1:8000/api/add_journal/', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      user_email: user.email,
                      plant_id: plant.id,
                    }),
                  });

                  const data = await response.json();

                  if (response.ok) {
                    if (data.already_exists) {
                      Toast.show({
                        type: 'info',
                        text1: 'Already in journal',
                        text2: `${prediction.plant_name} is already saved`,
                        position: 'top',
                        topOffset: 80,
                        visibilityTime: 3500,
                        props: {
                          style: {
                            backgroundColor: '#aa1717ff',
                            borderRadius: 12,
                            paddingVertical: 16,
                            paddingHorizontal: 20,
                            marginHorizontal: 20,
                            borderLeftColor: '#46811C',
                            borderLeftWidth: 8,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 8,
                          },
                          text1Style: { 
                            color: '#46811C', 
                            fontFamily: 'Poppins-Bold', 
                            fontSize: 16,
                            marginBottom: 4,
                          },
                          text2Style: { 
                            color: '#666', 
                            fontFamily: 'Poppins', 
                            fontSize: 14,
                            lineHeight: 20,
                          },
                        }
                      });
                    } else {
                      Toast.show({
                        type: 'success',
                        text1: 'Added to journal!',
                        text2: `${prediction.plant_name} saved sfsfs`,
                        position: 'top',
                        topOffset: 80,
                        visibilityTime: 3500,
                        props: {
                          style: {
                            backgroundColor: '#267a17ff',
                            borderRadius: 12,
                            paddingVertical: 16,
                            paddingHorizontal: 20,
                            marginHorizontal: 20,
                            borderLeftColor: '#46811C',
                            borderLeftWidth: 8,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 8,
                          },
                          text1Style: { 
                            color: '#46811C', 
                            fontFamily: 'Poppins-Bold', 
                            fontSize: 16,
                            marginBottom: 4,
                          },
                          text2Style: { 
                            color: '#666', 
                            fontFamily: 'Poppins', 
                            fontSize: 14,
                            lineHeight: 20,
                          },
                        }
                      });
                    }
                  } else {
                    throw new Error(data.error || 'Failed to add to journal');
                  }
                } catch (error) {
                  console.error('Error adding to journal:', error);
                  Toast.show({
                    type: 'error',
                    text1: 'Failed to add',
                    text2: 'Please try again later',
                    position: 'top',
                    topOffset: 80,
                    visibilityTime: 3500,
                    props: {
                      style: {
                        backgroundColor: '#a05151ff',
                        borderRadius: 12,
                        paddingVertical: 16,
                        paddingHorizontal: 20,
                        marginHorizontal: 20,
                        borderLeftColor: '#E53935',
                        borderLeftWidth: 8,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 8,
                      },
                      text1Style: { 
                        color: '#E53935', 
                        fontFamily: 'Poppins-Bold', 
                        fontSize: 16,
                        marginBottom: 4,
                      },
                      text2Style: { 
                        color: '#666', 
                        fontFamily: 'Poppins', 
                        fontSize: 14,
                        lineHeight: 20,
                      },
                    }
                  });
                }
              }}
            >
              <Ionicons name="bookmark-outline" size={22} color="#fff" /> 
            </TouchableOpacity>
                  </TouchableOpacity>
                  
                  <View style={styles.resultCardContentHorizontal}>
                    <Text style={styles.resultCardTitleHorizontal} numberOfLines={1}>
                      {prediction.plant_name}
                    </Text>
                    <Text style={styles.resultCardSubtitleHorizontal} numberOfLines={1}>
                      ({prediction.scientific_name})
                    </Text>
                  </View>
                </View>
              ))}

             {/* Plant not listed card / Thanks card */}
              <View style={styles.notListedCard}>
                <View style={styles.notListedContent}>
                <Ionicons name="leaf-outline" size={30} color="#4A7C59" />
                  {!showThanksMessage ? (
                    <>
                      <Text style={styles.notListedTitle}>Plant not listed{'\n'}here?</Text>
                      <TouchableOpacity 
                        style={styles.letUsKnowButton}
                        onPress={() => setShowFeedbackModal(true)}
                      >
                        <Text style={styles.letUsKnowText}>Let us know</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text style={styles.thanksText}>Thanks!</Text>
                  )}
                </View>
              </View>
            </ScrollView>

      
           {/* Show more results button - only show if there are more results */}
                {visibleResultsCount < topPredictions.length ? (
                  <TouchableOpacity 
                    style={styles.showMoreResultsButton}
                    onPress={showMoreResults}
                  >
                    <Text style={styles.showMoreResultsText}>Show more results</Text>
                    <Ionicons name="chevron-forward" size={20} color="#333" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.noMoreResultsContainer}>
                    <Text style={styles.noMoreResultsText}>No more plants to show</Text>
                  </View>
                )}
          

            {/* Found your plant? section */}
            <View style={styles.feedbackSection}>
              <Text style={styles.feedbackText}> Found your plant?</Text>
              <View style={styles.feedbackButtons}>
              <TouchableOpacity 
  style={styles.feedbackButton}
  onPress={async () => {
    // Check if we have scan ID
    if (!currentScanId) {
      Alert.alert("Error", "No scan ID available");
      return;
    }
    
    if (!user?.email) {
      Alert.alert("Error", "User not logged in");
      return;
    }
    
    try {
      console.log("📤 Submitting CORRECT feedback...");
      
      const response = await fetch('http://127.0.0.1:8000/api/feedback/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          user_email: user.email,
          plant_predicted: plantResult?.plant_name,
          user_action: 'correct',
          plant_image_url: capturedImageUri,
          scan_history_id: currentScanId
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log("✅ Feedback submitted:", data);
        Alert.alert("Thank you!", "Your feedback helps improve our plant identification.");
        
        // Reset everything
        setIsScanning(false);
        setScanComplete(false);
        setTopPredictions([]);
        setCapturedImageUri(null);
        setCurrentScanId(null);
      } else {
        throw new Error(data.error || 'Failed to submit feedback');
      }
    } catch (error: any) {
      console.error('❌ Feedback error:', error);
      Alert.alert("Error", error.message || "Failed to submit feedback");
    }
  }}
>
  <Ionicons name="heart-outline" size={24} color="#3a3f3cff" />
</TouchableOpacity>
              <TouchableOpacity 
  style={styles.feedbackButton}
  onPress={async () => {
    // Check if we have scan ID
    if (!currentScanId) {
      Alert.alert("Error", "No scan ID available");
      return;
    }
    
    if (!user?.email) {
      Alert.alert("Error", "User not logged in");
      return;
    }
    
    try {
      console.log("📤 Submitting INCORRECT feedback...");
      
      const response = await fetch('http://127.0.0.1:8000/api/feedback/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          user_email: user.email,
          plant_predicted: plantResult?.plant_name,
          user_action: 'incorrect',
          plant_image_url: capturedImageUri,
          scan_history_id: currentScanId
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log("✅ Feedback submitted:", data);
        Alert.alert("We'll try better", "Thank you for your feedback. We'll improve our identification.");
        
        // Reset everything
        setIsScanning(false);
        setScanComplete(false);
        setTopPredictions([]);
        setCapturedImageUri(null);
        setCurrentScanId(null);
      } else {
        throw new Error(data.error || 'Failed to submit feedback');
      }
    } catch (error: any) {
      console.error('❌ Feedback error:', error);
      Alert.alert("Error", error.message || "Failed to submit feedback");
    }
  }}
>
  <Ionicons name="sad-outline" size={24} color="#3a3f3cff" />
</TouchableOpacity>
              </View>
            </View>

            {/* Re-frame photo button */}
          <TouchableOpacity 
  style={styles.reframeButton}
  onPress={() => {
    setIsScanning(false);
    setScanComplete(false);
    setTopPredictions([]);
    setCapturedImageUri(null);
    setCurrentScanId(null);  // ← ADD THIS LINE
  }}
>
              <Text style={styles.reframeButtonText}>Re-frame photo and try again</Text>
            </TouchableOpacity>
       </>
        )}
   </ScrollView>
       
       {/* Toast Container - High z-index to appear above everything */}
       <View style={{ 
         position: 'absolute', 
         top: 0, 
         left: 0, 
         right: 0, 
         zIndex: 9999,
         elevation: 9999 
       }}>
         <Toast />
       </View>
    </View>
  </Modal>
)}

      {/* Feedback Modal */}
      <Modal
        visible={showFeedbackModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowFeedbackModal(false)}
      >
        <View style={styles.feedbackModalOverlay}>
          <View style={styles.feedbackModalContent}>
            <View style={styles.feedbackModalIcon}>
              <Ionicons name="checkmark-circle-outline" size={38} color="#46811cff"/>
            </View>
            
            <Text style={styles.feedbackModalText}>
              Thank you for helping us improve plant identification for everybody!
            </Text>

            <TouchableOpacity 
              style={styles.feedbackOkayButton}
              onPress={() => {
                setShowFeedbackModal(false);
                setShowThanksMessage(true);
              }}
            >
              <Text style={styles.feedbackOkayButtonText}>Okay</Text>
            </TouchableOpacity>

           <TouchableOpacity 
  style={styles.feedbackTryAgainButton}
  onPress={() => {
    setShowFeedbackModal(false);
    setIsScanning(false);
    setScanComplete(false);
    setTopPredictions([]);
    setCapturedImageUri(null);
    setCurrentScanId(null);  // ← ADD THIS LINE
  }}
>
              <Text style={styles.feedbackTryAgainButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* No Plant Detected Modal */}
      <Modal
        visible={showNoPlantModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowNoPlantModal(false)}
      >
        <View style={styles.noPlantModalOverlay}>
          <View style={styles.noPlantModalContent}>
            <View style={styles.noPlantWarningIcon}>
              <Ionicons name="warning-outline" size={40} color="#E53935" />
            </View>
            
            <Text style={styles.noPlantModalText}>
              It seems there is no plant in this image.
            </Text>

           <TouchableOpacity 
  style={styles.noPlantTryAgainButton}
  onPress={() => {
    setShowNoPlantModal(false);
    setIsScanning(false);
    setScanComplete(false);
    setTopPredictions([]);
    setCapturedImageUri(null);
    setCurrentScanId(null);  // ← ADD THIS LINE
  }}
>
              <Text style={styles.noPlantTryAgainButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

        {/* Bottom Camera Controls */}
        <View style={styles.bottomControls}>
          {/* Info Button (Left) */}
          <TouchableOpacity 
            style={styles.infoButton}
            onPress={openInfoModal}
          >
            <Ionicons name="alert-circle-outline" size={28} color="#61b326ff" />
          </TouchableOpacity>

          {/* Camera Capture Button (Center) */}
          <View style={styles.captureButtonContainer}>
            <TouchableOpacity 
              style={styles.captureButton}
              onPress={takePicture} 
              disabled={isScanning}
            >
              <View style={[styles.captureButtonInner, { opacity: isScanning ? 0.5 : 1 }]} />
            </TouchableOpacity>
          </View>

          {/* Gallery Button (Right) */}
          <TouchableOpacity 
            style={styles.galleryButtonBottom}
            onPress={pickImage}
            disabled={isScanning}
          >
            <Ionicons name="image-outline" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </CameraView>

      {/* Image Editor Modal */}
      <Modal
        visible={showImageEditor}
        animationType="fade"
        transparent={false}
        onRequestClose={closeImageEditor}
        statusBarTranslucent={true}
      >
        <View style={styles.editorContainer}>
          {/* Top Bar */}
          <View style={styles.editorTopBar}>
            <TouchableOpacity 
              style={styles.editorCloseButton}
              onPress={closeImageEditor}
            >
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
            
            <View style={styles.editorRotateButtons}>
              <TouchableOpacity 
                style={styles.editorRotateButton}
                onPress={rotateImageLeft}
              >
                <Ionicons name="refresh-outline" size={30} color="#fff" style={{ transform: [{ scaleX: -1 }] }} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.editorRotateButton}
                onPress={rotateImageRight}
              >
                <Ionicons name="refresh-outline" size={30} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Image Preview with Crop Frame */}
          <View style={styles.editorImageContainer}>
            {capturedImageUri && (
              <Image 
                source={{ uri: capturedImageUri }}
                style={[
                  styles.editorImage,
                  { transform: [{ rotate: `${imageRotation}deg` }] }
                ]}
                resizeMode="contain"
              />
            )}
            
            {/* Crop Frame Overlay */}
            <View style={styles.cropOverlay} pointerEvents="box-none">
              {/* Dark overlay outside crop */}
              <View style={styles.cropDarkOverlay} pointerEvents="none" />
              
              {/* Crop Frame */}
          <View 
                style={[
                  styles.cropFrameContainer,
                  {
                    left: cropFrame.x,
                    top: cropFrame.y,
                    width: cropFrame.width,
                    height: cropFrame.height,
                  }
                ]}
              >
                {/* Draggable inner area */}
                <View 
                  {...panResponderMove.panHandlers}
                  style={styles.cropDraggableArea}
                />
                
                <View style={styles.cropFrameBorder} pointerEvents="none" />
                
                {/* Grid lines inside crop */}
                <View style={styles.cropGrid} pointerEvents="none">
                  <View style={[styles.gridLine, styles.gridLineVertical, { left: '33.33%' }]} />
                  <View style={[styles.gridLine, styles.gridLineVertical, { left: '66.66%' }]} />
                  <View style={[styles.gridLine, styles.gridLineHorizontal, { top: '33.33%' }]} />
                  <View style={[styles.gridLine, styles.gridLineHorizontal, { top: '66.66%' }]} />
                </View>
                
                {/* Corner handles - Draggable */}
                <View 
                  {...panResponderTL.panHandlers}
                  style={[styles.cropHandle, styles.cropHandleTL]}
                />
                <View 
                  {...panResponderTR.panHandlers}
                  style={[styles.cropHandle, styles.cropHandleTR]}
                />
                <View 
                  {...panResponderBL.panHandlers}
                  style={[styles.cropHandle, styles.cropHandleBL]}
                />
                <View 
                  {...panResponderBR.panHandlers}
                  style={[styles.cropHandle, styles.cropHandleBR]}
                />
              </View>
   </View>
      </View>
          {/* Done Button */}
          <View style={styles.editorBottomBar}>
           <TouchableOpacity 
              style={styles.editorDoneButton}
              onPress={() => {
                if (capturedImageUri) {
                  setIsScanning(true);
                  startScanAnimation();        // ⬅️ START ANIMATION HERE
                  processAndScanImage(capturedImageUri);
                }
              }}
            >

              <Text style={styles.editorDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Info Modal */}
      <Modal
        visible={showInfoModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.infoModalContent}>
            {/* Page 1: For plants without flowers */}
            {infoPage === 0 && (
              <View style={styles.infoPageContainer}>
                <View style={styles.comparisonContainer}>
                  <View style={styles.comparisonItem}>
                    <View style={[styles.imageFrame, styles.wrongFrame]}>
                      <View style={styles.cornerTL} />
                      <View style={styles.cornerTR} />
                      <View style={styles.cornerBL} />
                      <View style={styles.cornerBR} />
                      <Image 
                        source={require("../assets/without_flowers.png")} 
                        style={styles.comparisonImage}
                        resizeMode="contain"
                      />
                      <View style={styles.wrongBadge}>
                        <Ionicons name="close" size={20} color="#fff" />
                      </View>
                    </View>
                  </View>

                  <View style={styles.comparisonItem}>
                    <View style={[styles.imageFrame, styles.correctFrame]}>
                      <View style={[styles.cornerTL, styles.greenCorner]} />
                      <View style={[styles.cornerTR, styles.greenCorner]} />
                      <View style={[styles.cornerBL, styles.greenCorner]} />
                      <View style={[styles.cornerBR, styles.greenCorner]} />
                      <Image 
                        source={require("../assets/zoom_flowers.png")} 
                        style={styles.comparisonImage}
                        resizeMode="contain"
                      />
                      <View style={styles.correctBadge}>
                        <Ionicons name="checkmark" size={20} color="#fff" />
                      </View>
                    </View>
                  </View>
                </View>

                <Text style={styles.infoTitle}>For plants without flowers</Text>
                
                <Text style={styles.infoDescription}>
                  Capture <Text style={styles.boldText}>clear photos</Text> of <Text style={styles.boldText}>multiple leaves</Text> to ensure accurate identification.
                </Text>

                <View style={styles.infoNavButtons}>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity
                    style={styles.infoDoneButton}
                    onPress={nextInfoPage}
                  >
                    <Text style={styles.infoDoneText}>Next</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Page 2: Crop the flowers */}
            {infoPage === 1 && (
              <View style={styles.infoPageContainer}>
                <View style={styles.comparisonContainer}>
                  <View style={styles.comparisonItem}>
                    <View style={[styles.imageFrame, styles.wrongFrame]}>
                      <View style={styles.cornerTL} />
                      <View style={styles.cornerTR} />
                      <View style={styles.cornerBL} />
                      <View style={styles.cornerBR} />
                      <Image 
                        source={require("../assets/vitex.png")} 
                        style={styles.comparisonImage}
                        resizeMode="contain"
                      />
                      <View style={styles.wrongBadge}>
                        <Ionicons name="close" size={20} color="#fff" />
                      </View>
                    </View>
                  </View>

                  <View style={styles.comparisonItem}>
                    <View style={[styles.imageFrame, styles.correctFrame]}>
                      <View style={[styles.cornerTL, styles.greenCorner]} />
                      <View style={[styles.cornerTR, styles.greenCorner]} />
                      <View style={[styles.cornerBL, styles.greenCorner]} />
                      <View style={[styles.cornerBR, styles.greenCorner]} />
                      <Image 
                        source={require("../assets/vitexzoom.png")} 
                        style={styles.comparisonImage}
                        resizeMode="contain"
                      />
                      <View style={styles.correctBadge}>
                        <Ionicons name="checkmark" size={20} color="#fff" />
                      </View>
                    </View>
                  </View>
                </View>

                <Text style={styles.infoTitle}>Crop the flowers</Text>
                
                <Text style={styles.infoDescription}>
                  If the plant has <Text style={styles.boldText}>flowers</Text> make sure to <Text style={styles.boldText}>zoom </Text>in  {'\n'}on them.
                </Text>

                <View style={styles.infoNavButtons}>
                  <TouchableOpacity
                    style={styles.infoBackButton}
                    onPress={prevInfoPage}
                  >
                    <Text style={styles.infoBackText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.infoDoneButton}
                    onPress={nextInfoPage}
                  >
                    <Text style={styles.infoDoneText}>Next</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Page 3: Focus on one mature plant */}
            {infoPage === 2 && (
              <View style={styles.infoPageContainer}>
                <View style={styles.comparisonContainer}>
                  <View style={styles.comparisonItem}>
                    <View style={[styles.imageFrame, styles.wrongFrame]}>
                      <View style={styles.cornerTL} />
                      <View style={styles.cornerTR} />
                      <View style={styles.cornerBL} />
                      <View style={styles.cornerBR} />
                      <Image 
                        source={require("../assets/steve.png")} 
                        style={styles.comparisonImage}
                        resizeMode="contain"
                      />
                      <View style={styles.wrongBadge}>
                        <Ionicons name="close" size={20} color="#fff" />
                      </View>
                    </View>
                  </View>

                  <View style={styles.comparisonItem}>
                    <View style={[styles.imageFrame, styles.correctFrame]}>
                      <View style={[styles.cornerTL, styles.greenCorner]} />
                      <View style={[styles.cornerTR, styles.greenCorner]} />
                      <View style={[styles.cornerBL, styles.greenCorner]} />
                      <View style={[styles.cornerBR, styles.greenCorner]} />
                      <Image 
                        source={require("../assets/zoomataatime.png")} 
                        style={styles.comparisonImage}
                        resizeMode="contain"
                      />
                      <View style={styles.correctBadge}>
                        <Ionicons name="checkmark" size={20} color="#fff" />
                      </View>
                    </View>
                  </View>
                </View>

                <Text style={styles.infoTitle}>Focus on one mature{'\n'}plant at a time</Text>
                
                <Text style={styles.infoDescription}>
                  <Text style={styles.boldText}>Avoid</Text> non-plant objects and immature plants.
                </Text>

                <View style={styles.infoNavButtons}>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity
                    style={styles.infoDoneButton}
                    onPress={nextInfoPage}
                  >
                    <Text style={styles.infoDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
    </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  loadingText: { flex: 1, textAlign: "center", textAlignVertical: "center", fontSize: 18, fontFamily: "Poppins", color: "#333" },
  noAccessText: { flex: 1, textAlign: "center", textAlignVertical: "center", fontSize: 18, fontFamily: "Poppins", color: "#333", marginBottom: 20 },
  backButton: { backgroundColor: "#4A7C59", paddingHorizontal: 30, paddingVertical: 15, borderRadius: 25, alignSelf: "center", marginBottom: 50 },
  backButtonText: { color: "#fff", fontSize: 16, fontFamily: "Poppins-Medium" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 50, paddingHorizontal: 20 },
  rightTopContainer: { flexDirection: "row", alignItems: "center", gap: 16 },
  profileCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#444", justifyContent: "center", alignItems: "center", overflow: "hidden" },
  profileImage: { width: 36, height: 36, borderRadius: 18 },
  bottomControls: { position: "absolute", bottom: 120, left: 0, right: 0, flexDirection: "row", justifyContent: "center", alignItems: "center", paddingHorizontal: 30 },
  infoButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0, 0, 0, 0.4)", justifyContent: "center", alignItems: "center", marginRight: 35 },
  captureButtonContainer: { alignItems: "center", justifyContent: "center" },
  captureButton: { width: 65, height: 65, borderRadius: 33, backgroundColor: "transparent", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#fff" },
  captureButtonInner: { width: 46, height: 46, borderRadius: 26, backgroundColor: "#fff" },
  galleryButtonBottom: { width: 44, height: 44, borderRadius: 10, backgroundColor: "rgba(0, 0, 0, 0.4)", borderWidth: 2, borderColor: "#fff", justifyContent: "center", alignItems: "center", marginLeft: 35 },
  editorContainer: { flex: 1, backgroundColor: "#000" },
  editorTopBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 50, paddingHorizontal: 16, paddingBottom: 10 },
  editorCloseButton: { padding: 4 },
  editorRotateButtons: { flexDirection: "row", gap: 16 },
  editorRotateButton: { padding: 4 },
  editorImageContainer: { flex: 1, justifyContent: "center", alignItems: "center", position: "relative" },
  editorImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT - 180 },
  cropOverlay: { position: "absolute", width: "100%", height: "100%", justifyContent: "center", alignItems: "center" },
  cropDarkOverlay: { position: "absolute", width: "100%", height: "100%", backgroundColor: "rgba(0, 0, 0, 0.6)" },
  cropFrameContainer: { position: "absolute", borderWidth: 0, zIndex: 1 },
  cropFrameBorder: { position: "absolute", width: "100%", height: "100%", borderWidth: 2.5, borderColor: "#fff" },
  cropGrid: { position: "absolute", width: "100%", height: "100%" },
  gridLine: { position: "absolute", backgroundColor: "rgba(255, 255, 255, 0.5)" },
  gridLineVertical: { width: 1, height: "100%" },
  gridLineHorizontal: { height: 1, width: "100%" },
  cropHandle: { position: "absolute", width: 20, height: 20, backgroundColor: "#fff", borderWidth: 0, borderRadius: 0, zIndex: 10 },
  cropHandleTL: { top: -2, left: -2 },
  cropHandleTR: { top: -2, right: -2 },
  cropHandleBL: { bottom: -2, left: -2 },
  cropHandleBR: { bottom: -2, right: -2 },
  editorBottomBar: { paddingHorizontal: 16, paddingVertical: 20, paddingBottom: 30, alignItems: "flex-end" },
  editorDoneButton: { backgroundColor: "#3A6B18", paddingHorizontal: 15, paddingVertical: 4, borderRadius: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3, elevation: 3, borderWidth: 1.5, borderColor: "#fff" },
  editorDoneText: { color: "#fff", fontSize: 15, fontFamily: "Poppins-Medium", letterSpacing: 0.3 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", alignItems: "center", paddingBottom: 80 },
  modalContent: { width: "90%", backgroundColor: "#fff", borderRadius: 20, padding: 30, alignItems: "center" },
  infoModalContent: { width: "80%", maxWidth: 340, backgroundColor: "#f5f5f5", borderRadius: 25, padding: 20, alignItems: "center" },
  infoPageContainer: { alignItems: "center", width: "100%" },
  comparisonContainer: { flexDirection: "row", justifyContent: "center", width: "100%", marginTop: 10, marginBottom: 15, gap: 18 },
  comparisonItem: { alignItems: "center", position: "relative" },
  imageFrame: { width: 100, height: 100, borderRadius: 6, justifyContent: "center", alignItems: "center", position: "relative", backgroundColor: "#fff" },
  wrongFrame: { backgroundColor: "#fff" },
  correctFrame: { backgroundColor: "#fff" },
  cornerTL: { position: "absolute", top: -2, left: -2, width: 25, height: 25, borderTopWidth: 4, borderLeftWidth: 4, borderColor: "#E53935", borderTopLeftRadius: 8 },
  cornerTR: { position: "absolute", top: -2, right: -2, width: 25, height: 25, borderTopWidth: 4, borderRightWidth: 4, borderColor: "#E53935", borderTopRightRadius: 8 },
  cornerBL: { position: "absolute", bottom: -2, left: -2, width: 25, height: 25, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: "#E53935", borderBottomLeftRadius: 8 },
  cornerBR: { position: "absolute", bottom: -2, right: -2, width: 25, height: 25, borderBottomWidth: 4, borderRightWidth: 4, borderColor: "#E53935", borderBottomRightRadius: 8 },
  greenCorner: { borderColor: "#4CAF50" },
  comparisonImage: { width: "85%", height: "90%" },
  wrongBadge: { position: "absolute", top: "50%", left: -18, marginTop: -18, width: 34, height: 34, borderRadius: 18, backgroundColor: "#E53935", justifyContent: "center", alignItems: "center", borderWidth: 3, borderColor: "#f5f5f5" },
  correctBadge: { position: "absolute", top: "50%", right: -18, marginTop: -18, width: 34, height: 34, borderRadius: 18, backgroundColor: "#4CAF50", justifyContent: "center", alignItems: "center", borderWidth: 3, borderColor: "#f5f5f5" },
  infoTitle: { fontSize: 18, fontFamily: "Poppins-SemiBold", color: "#3A6B18", textAlign: "center", marginBottom: 10, lineHeight: 24 },
  infoDescription: { fontSize: 15, fontFamily: "Poppins", color: "#333", textAlign: "center", lineHeight: 22, paddingHorizontal: 15, marginBottom: 15 },
  boldText: { fontFamily: "Poppins-SemiBold" },
  infoNavButtons: { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingHorizontal: 10, marginTop: 10 },
  infoBackButton: { paddingVertical: 5 },
  infoBackText: { fontSize: 17, fontFamily: "Poppins-SemiBold", color: "#3A6B18" },
  infoDoneButton: { paddingVertical: 5 },
  infoDoneText: { fontSize: 17, fontFamily: "Poppins-SemiBold", color: "#3A6B18" },
  closeButton: { position: "absolute", top: 15, right: 15, zIndex: 1 },
  modalTitle: { fontSize: 24, fontFamily: "Poppins-Bold", color: "#333", marginTop: 15, marginBottom: 10 },
  modalText: { fontSize: 16, fontFamily: "Poppins", color: "#666", textAlign: "center", marginBottom: 25, lineHeight: 24 },
  modalButton: { backgroundColor: "#4A7C59", paddingHorizontal: 40, paddingVertical: 12, borderRadius: 25 },
  modalButtonText: { color: "#fff", fontSize: 16, fontFamily: "Poppins-Medium" },
  resultContainer: { alignItems: "center", paddingVertical: 20, width: "100%" },
  resultTitle: { fontSize: 24, fontFamily: "Poppins-Bold", color: "#333", marginTop: 15, marginBottom: 10 },
  plantName: { fontSize: 20, fontFamily: "Poppins-SemiBold", color: "#4A7C59", textAlign: "center", marginBottom: 15 },
  confidenceContainer: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  confidenceLabel: { fontSize: 16, fontFamily: "Poppins", color: "#666", marginRight: 8 },
  confidenceValue: { fontSize: 20, fontFamily: "Poppins-Bold" },
  confidenceBadge: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginBottom: 15 },
  confidenceBadgeText: { color: "#fff", fontSize: 14, fontFamily: "Poppins-SemiBold" },
  warningText: { fontSize: 13, fontFamily: "Poppins", color: "#FF8C00", textAlign: "center", marginBottom: 20, paddingHorizontal: 15, lineHeight: 20 },
  buttonContainer: { flexDirection: "row", gap: 10, width: "100%", paddingHorizontal: 10 },
  actionButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 15, borderRadius: 25, gap: 8 },
  scanAgainButton: { backgroundColor: "#4A7C59" },
  tipsButtonSmall: { backgroundColor: "#F0F0F0", borderWidth: 1, borderColor: "#4A7C59" },
  actionButtonText: { color: "#fff", fontSize: 16, fontFamily: "Poppins-Medium" },
  cropDraggableArea: { position: "absolute", width: "100%", height: "100%", zIndex: 1 },
  resultsScrollView: { marginBottom: 2 },
  resultsScrollContent: { paddingRight: 16, gap: 17 },
  resultCardHorizontal: { width: SCREEN_WIDTH * 0.5, height: 220, backgroundColor: "#fff", borderRadius: 8, overflow: "hidden", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, marginRight: 2, marginBottom: 5, position: "relative" },
  resultImageContainerHorizontal: { width: "100%", height: "100%", backgroundColor: "#f0f0f0", position: "relative" },
  resultCardImageHorizontal: { width: "100%", height: "100%" },
  resultCardContentHorizontal: { position: "absolute", bottom: 4, left: 4, right: 4, backgroundColor: "#fff", padding: 8, borderRadius: 5, elevation: 3, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 4 },
  resultCardTitleHorizontal: { fontSize: 16, fontFamily: "Poppins-SemiBold", color: "#333" },
  resultCardSubtitleHorizontal: { fontSize: 13, fontFamily: "Poppins", color: "#666", fontStyle: "italic" },
  bookmarkButtonHorizontal: { position: "absolute", top: 10, right: 15, width: 50, height: 40, borderRadius: 8, backgroundColor: "#46811cff", justifyContent: "center", alignItems: "center", elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3, borderWidth: 1.5, borderColor: "#fff" },
  notListedCard: { width: SCREEN_WIDTH * 0.47, height: 215, backgroundColor: "#E8F5E9", borderRadius: 12, overflow: "hidden", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, justifyContent: "center", alignItems: "center" },
  notListedContent: { alignItems: "center", paddingHorizontal: 20 },
  notListedTitle: { fontSize: 15, fontFamily: "Poppins-SemiBold", color: "#333", textAlign: "center", marginTop: 10, marginBottom: 20, lineHeight: 24 },
  letUsKnowButton: { backgroundColor: "#46811cff", paddingHorizontal: 18, paddingVertical: 12, borderRadius: 30, elevation: 2 },
  letUsKnowText: { color: "#fff", fontSize: 13, fontFamily: "Poppins-Medium", gap: 5 },
  feedbackSection: { backgroundColor: "#f6ebcaff", borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  feedbackText: { fontSize: 15, fontFamily: "Poppins-SemiBold", color: "#333" },
  feedbackButtons: { flexDirection: "row", gap: 12 },
  feedbackButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", elevation: 1 },
  scanResultsContainer: { flex: 1, backgroundColor: "#fff" },
  scanResultsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 50, paddingHorizontal: 20, paddingBottom: 12, backgroundColor: "#fff" },
  scanResultsTitle: { fontSize: 18, fontFamily: "Poppins-SemiBold", color: "#333", letterSpacing: 0.2 },
  scanImageWrapper: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, backgroundColor: "#fff" },
  scanImageContainer: { width: "100%", height: SCREEN_WIDTH * 0.9, backgroundColor: "#e8e8e8", position: "relative", overflow: "hidden", borderRadius: 16, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  scanResultImage: { width: "100%", height: "100%", position: "absolute"  },
  gridOverlay: { position: "absolute", width: "100%", height: "100%", top: 0, left: 0 },
  gridDot: { position: "absolute", width: 2, height: 2, borderRadius: 1, backgroundColor: "rgba(74,124,89,0.35)" },
  scanLineGreen: { position: "absolute", width: "100%", height: 2.5, backgroundColor: "#4A7C59", shadowColor: "#4A7C59", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6, elevation: 5, left: 0, top: "50%" },
  expandButton: { position: "absolute", top: 12, right: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.9)", justifyContent: "center", alignItems: "center", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
  topResultsSection: { flex: 1, paddingHorizontal: 16, paddingTop: 2, backgroundColor: "#fff" },
  topResultsTitle: { fontSize: 16.5, fontFamily: "Poppins-SemiBold", color: "#46811cff", marginBottom: 9, letterSpacing: 0.3 },
  emptyResultsGrid: { flexDirection: "row", gap: 12 },
  emptyResultCard: { flex: 1, height: 220, backgroundColor: "#E8F5E9", borderRadius: 16, justifyContent: "center", alignItems: "center", elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  showMoreResultsButton: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", paddingVertical: 5, paddingLeft: 7, marginBottom: 5, gap: 5 },
  showMoreResultsText: { fontSize: 15, fontFamily: "Poppins-SemiBold", color: "#333" },
  noMoreResultsContainer: { paddingVertical: 10, paddingLeft: 7, marginBottom: 5 },
  noMoreResultsText: { fontSize: 14, fontFamily: "Poppins", color: "#666", fontStyle: "italic" },
  reframeButton: { backgroundColor: "#e0f4e2ff", paddingVertical: 16, paddingHorizontal: 24, borderRadius: 30, alignItems: "center", marginTop: 15, marginBottom: 30 },
  reframeButtonText: { fontSize: 16, fontFamily: "Poppins-SemiBold", color: "#46811cff" },
  feedbackModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", paddingHorizontal: 30 },
  feedbackModalContent: { backgroundColor: "#fff", borderRadius: 20, padding: 30, width: "100%", maxWidth: 340, alignItems: "center" },
  feedbackModalIcon: { marginBottom: 20 },
  feedbackModalText: { fontSize: 16, fontFamily: "Poppins", color: "#333", textAlign: "center", lineHeight: 24, marginBottom: 24 },
  feedbackOkayButton: { backgroundColor: "#E8F5E9", paddingVertical: 14, paddingHorizontal: 50, borderRadius: 25, width: "100%", alignItems: "center", marginBottom: 12 },
  feedbackOkayButtonText: { fontSize: 16, fontFamily: "Poppins-SemiBold", color: "#4A7C59" },
  feedbackTryAgainButton: { backgroundColor: "#46811cff", paddingVertical: 14, paddingHorizontal: 50, borderRadius: 25, width: "100%", alignItems: "center" },
  feedbackTryAgainButtonText: { fontSize: 16, fontFamily: "Poppins-SemiBold", color: "#fff" },
  thanksText: { fontSize: 16, fontFamily: "Poppins-SemiBold", color: "#4A7C59", marginTop: 1 },
  noPlantModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", paddingHorizontal: 30 },
  noPlantModalContent: { backgroundColor: "#fff", borderRadius: 20, padding: 30, width: "100%", maxWidth: 340, alignItems: "center" },
  noPlantWarningIcon: { marginBottom: 15 },
  noPlantModalText: { fontSize: 15, fontFamily: "Poppins-Medium", color: "#333", textAlign: "center", lineHeight: 26, marginBottom: 30 },
  noPlantTryAgainButton: { backgroundColor: "#E53935", paddingVertical: 14, paddingHorizontal: 60, borderRadius: 30, width: "100%", alignItems: "center", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3 },
  noPlantTryAgainButtonText: { fontSize: 16, fontFamily: "Poppins-Medium", color: "#fff" },
  notificationBadgeText: { color: '#fff', fontSize: 11, fontFamily: 'Poppins-Bold', textAlign: 'center' },
  notificationIconContainer: { position: 'relative' },
  notificationBadge: { position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF4B4B', borderWidth: 2, borderColor: '#000' },
  });
