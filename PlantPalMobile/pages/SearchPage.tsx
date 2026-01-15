import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ImageBackground,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// API Configuration
const BASE_URL =
  Platform.OS === "android"
    ? "http://127.0.0.1:8000"
    : "http://localhost:8000";

// Define types for the data
interface Plant {
  id: string;
  plant_name: string;
  scientific_name: string;
  image_url?: string;
  images?: string[];
  ailments?: string[];
  disease_types?: string[];
}

export default function SearchPage() {
  const navigation = useNavigation<any>();

  const [fontsLoaded] = useFonts({
    Poppins: require("../assets/fonts/Poppins-Regular.ttf"),
    "Poppins-Bold": require("../assets/fonts/Poppins-Bold.ttf"),
    "Poppins-Medium": require("../assets/fonts/Poppins-Medium.ttf"),
    "Poppins-SemiBold": require("../assets/fonts/Poppins-SemiBold.ttf"),
  });

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"plants" | "herbal">("plants");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  
  // Data states
  const [trendingPlants, setTrendingPlants] = useState<Plant[]>([]);
  const [searchResults, setSearchResults] = useState<Plant[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);

  const ailmentOptions: Record<string, string[]> = {
    Digestive: ["Constipation", "Ulcer", "Diarrhea", "Indigestion", "Laxative", "Nausea", "Stomachache"],
    Skin: ["Cuts", "Wound", "Boils", "Rashes", "Eczema", "Animal Bites", "Insect Bites", "Acne", "Burns"],
    Respiratory: ["Cough", "Cold", "Asthma", "Flu", "Sore throat", "Bronchitis"],
    Immunity: ["Fever", "Allergy", "Hair loss", "Antioxidant", "Fatigue"],
    Reproductive: ["Dysmenorrhea", "Pregnancy", "Aphrodisiac", "Infertility"],
    Parasitic: ["Ringworm", "Amoebiasis", "Anti-parasitic", "Malaria"],
    Nervous: ["Headache", "Migraine", "Anxiety", "Insomnia", "Epilepsy", "Nervous Tension"],
    Excretory: ["Kidney Stones", "Urinary Tract Infection", "Diuretic", "Bladder Infection"],
    Eye: ["Eye Infection", "Conjunctivitis", "Sore Eyes", "Vision Problems"],
    Musculoskeletal: ["Arthritis", "Rheumatism", "Joint Pain", "Back Pain", "Muscle Cramps"],
    Inflammations: ["Swelling", "Pain Relief", "Anti-inflammatory", "Inflammation"],
    Oral: ["Toothache", "Gum Disease", "Mouth Ulcer", "Sore Throat"],
    Circulatory: ["Hypertension", "High Cholesterol", "Anemia", "Hematoma"],
  };

  const categoryIcons: Record<string, any> = {
    Digestive: require("../assets/search-icons/stomach.png"),
    Skin: require("../assets/search-icons/skin.png"),
    Respiratory: require("../assets/search-icons/respi.png"),
    Immunity: require("../assets/search-icons/immunity.png"),
    Reproductive: require("../assets/search-icons/reproductive.png"),
    Parasitic: require("../assets/search-icons/parasitic.png"),
    Nervous: require("../assets/search-icons/nervous.png"),
    Excretory: require("../assets/search-icons/excre.png"),
    Eye: require("../assets/search-icons/eye.png"),
    Musculoskeletal: require("../assets/search-icons/musku.png"),
    Inflammations: require("../assets/search-icons/inflammation.png"),
    Oral: require("../assets/search-icons/oral.png"),
    Circulatory: require("../assets/search-icons/circu.png"),
  };

  const categoryColors: Record<string, { bg: string; text: string; }> = {
    Circulatory: { bg: "#fce8e8", text: "#9b4444" },
    Digestive: { bg: "#e8f5e8", text: "#4a7c4a"},
    Excretory: { bg: "#e6f7f5", text: "#4a7c78" },
    Eye: { bg: "#e6f4f8", text: "#4a7088"},
    Immunity: { bg: "#f0e8f5", text: "#7a4a88"},
    Inflammations: { bg: "#e8f5ed", text: "#4a8060"},
    "Insect bites": { bg: "#f5f5e6", text: "#7c7c4a"},
    Musculoskeletal: { bg: "#f5f0e6", text: "#8c7050" },
    Nervous: { bg: "#e8ebf5", text: "#4a5488"},
    Oral: { bg: "#f5e8f0", text: "#88547a"},
    Parasitic: { bg: "#f5f3e6", text: "#8c8350"},
    Reproductive: { bg: "#f8e8eb", text: "#88505a"},
    Respiratory: { bg: "#e8eef8", text: "#4a6088" },
    Skin: { bg: "#f8e8f0", text: "#88506b" },
  };

  
  // Real-time search when query changes
  useEffect(() => {
    if (query.trim().length > 0) {
      const delayDebounce = setTimeout(() => {
        if (activeTab === "plants") {
          searchPlantsByName(query, false); // false = don't save to history yet
        } else {
          searchPlantsByAilment(query, false); // Search by ailment in Herbal Uses tab
        }
      }, 500); // 500ms debounce

      return () => clearTimeout(delayDebounce);
    } else if (query.trim().length === 0) {
      setSearchResults([]);
    }
  }, [query, activeTab]);

  // Load search history from AsyncStorage
  const loadHistory = async () => {
    try {
      const saved = await AsyncStorage.getItem("searchHistory");
      if (saved) setHistory(JSON.parse(saved));
    } catch (error) {
      console.error("Error loading history:", error);
    }
  };

  // Save search to history
  const saveToHistory = async (searchTerm: string) => {
    try {
      const updatedHistory = [searchTerm, ...history.filter(item => item !== searchTerm)].slice(0, 10);
      setHistory(updatedHistory);
      await AsyncStorage.setItem("searchHistory", JSON.stringify(updatedHistory));
    } catch (error) {
      console.error("Error saving history:", error);
    }
  };

  
// Add this useEffect after your existing useEffect for loadHistory
useEffect(() => {
  loadHistory();
  fetchTrendingPlants(); // ✅ Fetch trending plants on mount
}, []);

// Add this function to fetch trending plants
const fetchTrendingPlants = async () => {
  try {
    setTrendingLoading(true);
    console.log("📊 Fetching trending plants...");
    
    const url = `${BASE_URL}/api/trending_plants/`;
    console.log("📡 URL:", url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    console.log("📡 Response status:", response.status);

    if (response.ok) {
      const data = await response.json();
      console.log("✅ Trending plants:", data);
      
      if (data && data.trending_plants && Array.isArray(data.trending_plants)) {
        setTrendingPlants(data.trending_plants);
      } else {
        console.error("❌ Invalid data structure:", data);
        setTrendingPlants([]);
      }
    } else {
      const errorText = await response.text();
      console.error("❌ Error response:", errorText);
      setTrendingPlants([]);
    }
  } catch (error) {
    console.error("❌ Network error:", error);
    setTrendingPlants([]);
  } finally {
    setTrendingLoading(false);
  }
};


  // Search plants by name (Plants tab)
  const searchPlantsByName = async (searchQuery: string, saveHistory: boolean = true) => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      console.log("🔍 Searching for:", searchQuery);
      
      const url = `${BASE_URL}/api/search_plants_mobile/?query=${encodeURIComponent(searchQuery)}`;
      console.log("📡 URL:", url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      console.log("📡 Response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Search results:", data);
        
        // Backend returns { plants: [...] }
        if (data && data.plants && Array.isArray(data.plants)) {
          setSearchResults(data.plants);
          
          // Only save to history when explicitly searching (pressing enter)
          if (saveHistory) {
            await saveToHistory(searchQuery);
          }
          
          if (data.plants.length === 0 && saveHistory) {
            Alert.alert("No Results", `No plants found for "${searchQuery}"`);
          }
        } else {
          console.error("❌ Invalid data structure:", data);
          setSearchResults([]);
        }
      } else {
        const errorText = await response.text();
        console.error("❌ Error response:", errorText);
        setSearchResults([]);
      }
    } catch (error) {
      console.error("❌ Network error:", error);
      if (saveHistory) {
        Alert.alert(
          "Connection Error", 
          `Cannot connect to server at ${BASE_URL}\n\nMake sure:\n1. Backend is running\n2. Using correct IP address`
        );
      }
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Search plants by ailment (Herbal Uses tab)
  const searchPlantsByAilment = async (ailment: string, saveHistory: boolean = true) => {
    if (!ailment.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      console.log("🔍 Searching for ailment:", ailment);
      
      const url = `${BASE_URL}/api/search_by_ailment_mobile/?ailment=${encodeURIComponent(ailment)}`;
      console.log("📡 URL:", url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      console.log("📡 Response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Ailment search results:", data);
        
        // Backend returns { plants: [...] }
        if (data && data.plants && Array.isArray(data.plants)) {
          setSearchResults(data.plants);
          
          // Only save to history when explicitly clicking (not typing)
          if (saveHistory) {
            await saveToHistory(ailment);
          }
          
          if (data.plants.length === 0 && saveHistory) {
            Alert.alert("No Results", `No plants found for "${ailment}"`);
          }
        } else {
          console.error("❌ Invalid data structure:", data);
          setSearchResults([]);
        }
      } else {
        const errorText = await response.text();
        console.error("❌ Error response:", errorText);
        setSearchResults([]);
      }
    } catch (error) {
      console.error("❌ Network error:", error);
      if (saveHistory) {
        Alert.alert(
          "Connection Error", 
          `Cannot connect to server at ${BASE_URL}\n\nMake sure:\n1. Backend is running\n2. Using correct IP address`
        );
      }
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (!query.trim()) return;

    if (activeTab === "plants") {
      searchPlantsByName(query, true); // true = save to history
    } else {
      searchPlantsByAilment(query, true);
    }
  };

  const getPlaceholder = () => {
    return activeTab === "plants"
      ? "Search plant name"
      : "What are you looking to treat?";
  };

  const toggleCategory = (category: string) => {
    setExpandedCategory(expandedCategory === category ? null : category);
  };

  const handleAilmentClick = (ailment: string) => {
    console.log("🎯 Ailment clicked:", ailment);
    setQuery(ailment);
    // Immediately search when clicking an ailment tag
    searchPlantsByAilment(ailment, true);
  };

  if (!fontsLoaded) return null;

  return (
    <ImageBackground
      source={require("../assets/background.png")}
      style={styles.bg}
      resizeMode="cover"
    >
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* HEADER */}
        <View style={styles.header}>
        

  <View style={styles.sideSpace} />
  <Text style={styles.headerTitle}>Search Plants</Text>
  <Ionicons name="leaf-outline" size={24} color="#2F4F2F" />
</View>



        {/* SEARCH */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={22} color="#2F4F2F" />
          <TextInput
            style={styles.searchInput}
            placeholder={getPlaceholder()}
            placeholderTextColor="#3d583d"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => {
              setQuery("");
              setSearchResults([]);
            }}>
              <Ionicons name="close-circle" size={20} color="#6b8f6b" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleSearch} style={{ marginLeft: 8 }}>
            <Ionicons
              name="arrow-forward-circle"
              size={26}
              color="#2F4F2F"
            />
          </TouchableOpacity>
        </View>

        {/* TABS */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[
              styles.tabItem,
              activeTab === "plants" && styles.activeTabItem,
            ]}
            onPress={() => {
              setActiveTab("plants");
              setQuery("");
              setSearchResults([]);
            }}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "plants" && styles.activeTabText,
              ]}
            >
              Plants
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabItem,
              activeTab === "herbal" && styles.activeTabItem,
            ]}
            onPress={() => {
              setActiveTab("herbal");
              setQuery("");
              setSearchResults([]);
            }}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "herbal" && styles.activeTabText,
              ]}
            >
              Herbal Uses
            </Text>
          </TouchableOpacity>
        </View>

{activeTab === "plants" && query === "" && (
  <View style={styles.trendingBlock}>
    <Text style={styles.sectionTitle}>Trending species</Text>
    <Text style={styles.trendingSubtitle}>in the past week</Text>

    {trendingLoading ? (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#2F4F2F" />
        <Text style={styles.loadingText}>Loading trending plants...</Text>
      </View>
    ) : trendingPlants.length > 0 ? (
      trendingPlants.map((plant, index) => (
        <TouchableOpacity
          key={plant.id}
          style={styles.trendingItem}
          onPress={() =>
            navigation.navigate("PlantDetails", {
              plantId: plant.id,
            })
          }
        >
          {plant.image_url ? (
            <Image
              source={{ uri: plant.image_url }}
              style={styles.trendingImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.trendingImage, styles.placeholderImage]}>
              <Ionicons name="leaf" size={24} color="#6b8f6b" />
            </View>
          )}

          <View style={styles.trendingInfo}>
            <Text style={styles.plantName} numberOfLines={1}>
              {plant.plant_name}
            </Text>
            <Text style={styles.plantDesc} numberOfLines={1}>
              ({plant.scientific_name})
            </Text>
          </View>

          <Ionicons
            name="trending-up-outline"
            size={22}
            color="#2F7D32"
          />
        </TouchableOpacity>
      ))
    ) : (
      <View style={styles.noDataContainer}>
        <Ionicons name="leaf-outline" size={40} color="#b0c4a0" />
        <Text style={styles.noDataText}>
          No trending plants this week
        </Text>
        <Text style={styles.noDataSubtext}>
          Be the first to scan a plant!
        </Text>
      </View>
    )}
  </View>
)}


        {/* HERBAL USES - BROWSE BY AILMENT */}
        {activeTab === "herbal" && query === "" && (
          <View style={styles.browseBlock}>
            <Text style={styles.sectionTitle}>Browse by Ailment</Text>
            
            {Object.keys(ailmentOptions).map((category) => (
              <View key={category} style={styles.categoryContainer}>
                <TouchableOpacity
                  style={styles.categoryHeader}
                  onPress={() => toggleCategory(category)}
                >
                  <View style={styles.categoryLeft}>
                    <Image 
                      source={categoryIcons[category]} 
                      style={styles.categoryIcon}
                    />
                    <Text style={styles.categoryTitle}>{category}</Text>
                  </View>
                  <Ionicons
                    name={expandedCategory === category ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#2F4F2F"
                  />
                </TouchableOpacity>

                {expandedCategory === category && (
                  <View style={styles.ailmentTagContainer}>
                    {ailmentOptions[category].map((ailment, index) => {
                      const colors = categoryColors[category];
                      return (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.ailmentTag,
                            { backgroundColor: colors.bg }
                          ]}
                          onPress={() => handleAilmentClick(ailment)}
                        >
                          <Text style={[styles.ailmentTagText, { color: colors.text }]}>
                            {ailment}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* SEARCH RESULTS */}
        {query.length > 0 && (
          <View style={styles.resultsBlock}>
            {loading ? (
              <ActivityIndicator size="large" color="#2F4F2F" />
            ) : (
              <>
                <Text style={styles.resultsText}>
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found for{" "}
                  <Text style={styles.queryText}>"{query}"</Text>
                </Text>

                {searchResults.length > 0 ? (
                  searchResults.map((plant) => (
                    <TouchableOpacity 
                      key={plant.id} 
                      style={styles.resultItem}
                      onPress={() => {
                        navigation.navigate('PlantDetails', { plantId: plant.id });
                      }}
                    >
                      {plant.image_url ? (
                        <Image source={{ uri: plant.image_url }} style={styles.resultImage} />
                      ) : (
                        <View style={[styles.resultImage, { backgroundColor: "#c5d9ba", justifyContent: "center", alignItems: "center" }]}>
                          <Ionicons name="leaf" size={30} color="#2F4F2F" />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultName}>{plant.plant_name}</Text>
                        {plant.scientific_name && (
                          <Text style={styles.resultScientific}>({plant.scientific_name})</Text>
                        )}
                        {plant.disease_types && plant.disease_types.length > 0 && (
                          <View style={styles.tagRow}>
                            {plant.disease_types.slice(0, 3).map((diseaseType, idx) => {
                              const colors = categoryColors[diseaseType] || categoryColors.Digestive;
                              return (
                                <View
                                  key={idx}
                                  style={[
                                    styles.miniTag,
                                    { backgroundColor: colors.bg }
                                  ]}
                                >
                                  <Image 
                                    source={categoryIcons[diseaseType] || categoryIcons.Digestive} 
                                    style={styles.miniTagIcon}
                                  />
                                  <Text style={[styles.miniTagText, { color: colors.text }]}>
                                    {plant.ailments && plant.ailments[idx] ? plant.ailments[idx] : diseaseType}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>
                      {/* Diagonal arrow pointing up-right */}
                      <Ionicons name="arrow-up-outline" size={24} color="#2F4F2F" style={{ transform: [{ rotate: '45deg' }] }} />
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noDataText}>No plants found for "{query}"</Text>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  container: { flexGrow: 1, alignItems: "center", paddingVertical: 40, paddingBottom: 80 },
  header: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  width: "90%",
  marginBottom: 20,
},

sideSpace: {
  width: 24, 
},

headerTitle: {
  fontSize: 20,
  fontFamily: "Poppins-SemiBold",
  color: "#2F4F2F",
  textAlign: "center",
},
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#e1e9d7", borderRadius: 20, paddingHorizontal: 15, width: "90%", height: 48, marginBottom: 15 },
  searchInput: { flex: 1, fontFamily: "Poppins", fontSize: 14, marginLeft: 8, color: "#2F4F2F" },
  tabRow: { flexDirection: "row", width: "90%", marginBottom: 20 },
  tabItem: { flex: 1, alignItems: "center", paddingBottom: 8, borderBottomWidth: 4, borderBottomColor: "transparent" },
  activeTabItem: { borderBottomColor: "#2F7D32" },
  tabText: { fontFamily: "Poppins-Medium", color: "#6b8f6b", fontSize: 14 },
  activeTabText: { color: "#2F7D32" },
  trendingBlock: { width: "90%", marginBottom: 3 },
  sectionTitle: { fontFamily: "Poppins-SemiBold", color: "#2F4F2F", fontSize: 16, marginBottom: 2 },
  trendingSubtitle: { fontFamily: "Poppins", fontSize: 14, color: "#6b8f6b", marginBottom: 8 },
  trendingItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#e1e9d7", borderRadius: 18, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 10, minHeight: 72 },
  trendingImage: { width: 48, height: 48, borderRadius: 12, marginRight: 14 },
  plantName: { fontFamily: "Poppins-Medium", fontSize: 15, color: "#2F4F2F" },
  plantDesc: { fontFamily: "Poppins", fontSize: 13, color: "#6b8f6b", fontStyle: "italic", marginTop: 2 },
  browseBlock: { width: "90%", paddingBottom: 20 },
  categoryContainer: { backgroundColor: "rgba(225, 233, 215, 0.8)", borderRadius: 12, marginBottom: 8, overflow: "hidden" },
  categoryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 12 },
  categoryLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  categoryIcon: { width: 20, height: 20, marginRight: 8 },
  categoryTitle: { fontFamily: "Poppins-SemiBold", fontSize: 13, color: "#2F4F2F" },
  ailmentTagContainer: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, paddingBottom: 12, gap: 6 },
  ailmentTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16 },
  ailmentTagText: { fontFamily: "Poppins", fontSize: 11 },
  resultsBlock: { width: "90%" },
  resultsText: { fontFamily: "Poppins", fontSize: 14, color: "#6b8f6b", marginBottom: 15 },
  queryText: { fontFamily: "Poppins-SemiBold", color: "#2F4F2F" },
  resultItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#e1e9d7", borderRadius: 18, padding: 14, marginBottom: 10 },
  resultImage: { width: 60, height: 60, borderRadius: 12, marginRight: 12 },
  resultName: { fontFamily: "Poppins-SemiBold", fontSize: 15, color: "#2F4F2F", marginBottom: 2 },
  resultScientific: { fontFamily: "Poppins", fontSize: 12, color: "#6b8f6b", fontStyle: "italic", marginBottom: 6 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  miniTag: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  miniTagIcon: { width: 14, height: 14 },
  miniTagText: { fontFamily: "Poppins", fontSize: 11 },
  noDataText: { fontFamily: "Poppins", fontSize: 14, color: "#6b8f6b", textAlign: "center", marginTop: 20 },
loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 10,
  },
  loadingText: {
    fontFamily: "Poppins",
    fontSize: 13,
    color: "#6b8f6b",
  },
  trendingInfo: {
    flex: 1,
    marginRight: 8,
  },
  placeholderImage: {
    backgroundColor: "#c5d9ba",
    justifyContent: "center",
    alignItems: "center",
  },
  noDataContainer: {
    alignItems: "center",
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  noDataSubtext: {
    fontFamily: "Poppins",
    fontSize: 12,
    color: "#b0c4a0",
    textAlign: "center",
    marginTop: 4,
  },


});
