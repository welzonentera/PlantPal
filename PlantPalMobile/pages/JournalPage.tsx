import React, { useState, useEffect, useRef } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  Alert,
  ImageBackground,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../src/contexts/AuthContext";
import { useNavigation, useFocusEffect } from "@react-navigation/native";

interface Plant {
  journal_id: string;
  plant_id: string;
  name: string;
  scientificName?: string;
  nickname?: string;
  image: string | null;
  notes?: any[];
  created_at?: string;
}

interface NoteContent {
  type: 'text' | 'image';
  content: string;
  id: string;
}

interface Note {
  id?: string;
  title?: string;
  text: string;
  date: string;
  contents?: NoteContent[];
  plantName?: string;
  plantId?: string;
  journalId?: string;
  plantImage?: string | null;
}

export default function JournalPage() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<"plants" | "notes">("plants");
  const [plants, setPlants] = useState<Plant[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use ref to track if component is mounted
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Test backend connectivity
  const testConnection = async () => {
    const baseUrl = 'http://127.0.0.1:8000';
    console.log(`🔌 Testing connection to: ${baseUrl}`);
    
    try {
      const response = await fetch(`${baseUrl}/api/get_user_journal/?user_email=test@test.com`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      console.log(`✅ Connection test - Status: ${response.status}`);
      const text = await response.text();
      console.log(`📄 Response: ${text}`);
    } catch (error) {
      console.error('❌ Connection test failed:', error);
    }
  };

  // Fetch journal plants from backend
  const fetchJournalPlants = React.useCallback(async () => {
    if (!user?.email) {
      console.log("❌ No user email found");
      setLoading(false);
      setError("Please log in to view your journal");
      return;
    }

    try {
      setError(null);
      console.log(`🔄 Fetching journal for: ${user.email}`);
      
      const baseUrl = 'http://127.0.0.1:8000';
      const url = `${baseUrl}/api/get_user_journal/?user_email=${encodeURIComponent(user.email)}`;
      console.log(`📡 Request URL: ${url}`);
      
      // Add timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('⏱️ Request timeout - aborting');
        controller.abort();
      }, 10000);
        
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log(`📥 Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Server error: ${errorText}`);
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log(`✅ Received data:`, JSON.stringify(data, null, 2));
      console.log(`📊 Plant count: ${data.count}`);
      
      // Only update state if component is still mounted
      if (isMounted.current) {
        setPlants(data.plants || []);
        setError(null);
        
        // Extract all notes from all plants
        const allNotes: Note[] = [];
        (data.plants || []).forEach((plant: Plant) => {
          if (plant.notes && Array.isArray(plant.notes)) {
            plant.notes.forEach(note => {
              allNotes.push({
                ...note,
                plantName: plant.nickname || plant.name,
                plantId: plant.plant_id,
                journalId: plant.journal_id,
                plantImage: plant.image,
              });
            });
          }
        });
        
        // Sort by date (newest first)
        allNotes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        console.log(`📝 Total notes across all plants: ${allNotes.length}`);
        
        setNotes(allNotes);
      }
    } catch (error: any) {
      console.error('❌ Error fetching journal:', error);
      
      if (isMounted.current) {
        let errorMessage = 'Failed to load journal';
        
        if (error?.name === 'AbortError') {
          errorMessage = 'Request timeout - server not responding';
        } else if (error?.message?.includes('Network request failed')) {
          errorMessage = 'Cannot connect to server. Make sure backend is running on port 8000';
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        
        console.error('❌ Error name:', error?.name);
        console.error('❌ Error message:', errorMessage);
        
        setError(errorMessage);
        
        // Show alert only if not refreshing
        if (!refreshing) {
          Alert.alert(
            'Error Loading Journal', 
            errorMessage + '\n\nPlease check your connection and try again.'
          );
        }
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [user?.email, refreshing, isMounted]);

  // Load data when component mounts
  useEffect(() => {
    console.log("🔄 useEffect triggered - mounting component");
    console.log("📱 Platform:", Platform.OS);
    console.log("👤 User:", user);
    testConnection();
    fetchJournalPlants();
  }, [fetchJournalPlants]);

  // Refresh when screen comes into focus (after adding from scan)
  useFocusEffect(
    React.useCallback(() => {
      console.log("🔄 useFocusEffect triggered - screen focused");
      fetchJournalPlants();
      
      return () => {
        console.log("🔄 useFocusEffect cleanup");
      };
    }, [fetchJournalPlants])
  );

  const onRefresh = () => {
    console.log("🔄 Manual refresh triggered");
    setRefreshing(true);
    fetchJournalPlants();
  };

  const renderPlantCard = ({ item }: { item: Plant }) => {
    console.log(`Rendering plant card: ${item.name} (${item.journal_id})`);
    
    const displayName = item.name;
    
    return (
      <TouchableOpacity 
        style={styles.plantCard} 
        activeOpacity={0.9}
        onPress={() => {
          console.log(`Navigating to plant details: ${item.plant_id}`);
          (navigation as any).navigate("PlantDetailsJournal", {
            plantId: item.plant_id,
            plantName: item.name,
            plantImage: item.image ? { uri: item.image } : require("../assets/icon.png"),
            journalId: item.journal_id,
            currentNickname: item.nickname,
          });
        }}
      >
        <ImageBackground
          source={item.image ? { uri: item.image } : require("../assets/icon.png")}
          style={styles.plantCardImage}
          imageStyle={styles.plantCardImageStyle}
        >
          <View style={styles.plantNameContainer}>
            <View style={styles.plantNameBadge}>
              <Text style={styles.plantCardText}>{displayName}</Text>
            </View>
          </View>
        </ImageBackground>
      </TouchableOpacity>
    );
  };

  const renderNoteCard = ({ item }: { item: Note }) => {
    // Get first image and text content
    const firstImage = item.contents?.find(c => c.type === 'image');
    const textContent = item.contents?.filter(c => c.type === 'text' && c.content.trim()).map(c => c.content).join('\n\n') || item.text;
    
    return (
      <TouchableOpacity 
        style={styles.noteCard} 
        activeOpacity={0.9}
        onPress={() => {
          if (item.journalId && item.plantId) {
            (navigation as any).navigate("PlantDetailsJournal", {
              plantId: item.plantId,
              plantName: item.plantName,
              plantImage: item.plantImage ? { uri: item.plantImage } : require("../assets/icon.png"),
              journalId: item.journalId,
            });
          }
        }}
      >
      {/* Plant Badge and Date on same line */}
<View style={styles.noteTopRow}>
  <View style={styles.notePlantBadge}>
    <Ionicons name="leaf" size={14} color="#5a8c4a" />
    <Text style={styles.notePlantName}>{item.plantName}</Text>
  </View>
  <Text style={styles.noteDateText}>
    {new Date(item.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}
  </Text>
</View>

{/* Title (if exists) */}
{item.title && (
  <Text style={styles.noteTitleText}>{item.title}</Text>
)}

        {/* Note Content with Image */}
        <View style={styles.noteContentRow}>
          <View style={styles.noteTextColumn}>
            <Text style={styles.noteContentText} numberOfLines={3}>
              {textContent}
            </Text>
          </View>
          {firstImage && (
            <Image
              source={{ uri: firstImage.content }}
              style={styles.noteThumbnail}
              resizeMode="cover"
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ImageBackground
      source={require("../assets/background.png")}
      style={styles.bg}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Journal</Text>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "plants" && styles.tabActive]}
            onPress={() => setActiveTab("plants")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "plants" && styles.tabTextActive,
              ]}
            >
              Plants ({plants.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "notes" && styles.tabActive]}
            onPress={() => setActiveTab("notes")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "notes" && styles.tabTextActive,
              ]}
            >
              My Notes ({notes.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {activeTab === "plants" ? (
          loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#5a8c4a" />
              <Text style={styles.loadingText}>Loading your plants...</Text>
            </View>
          ) : error ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="alert-circle-outline" size={64} color="#e74c3c" />
              <Text style={styles.errorText}>Error Loading Journal</Text>
              <Text style={styles.emptySubtext}>{error}</Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => {
                  setLoading(true);
                  setError(null);
                  fetchJournalPlants();
                }}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : plants.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="leaf-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No plants in your journal yet</Text>
              <Text style={styles.emptySubtext}>
                Scan plants and bookmark them to add to your journal
              </Text>
            </View>
          ) : (
            <FlatList
              data={plants}
              renderItem={renderPlantCard}
              keyExtractor={(item) => item.journal_id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={["#5a8c4a"]}
                  tintColor="#5a8c4a"
                />
              }
            />
          )
        ) : (
          <FlatList
            data={notes}
            renderItem={renderNoteCard}
            keyExtractor={(item, index) => `${item.journalId}-${index}`}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#5a8c4a"]}
                tintColor="#5a8c4a"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="clipboard-outline" size={64} color="#ccc" />
                <Text style={styles.emptyText}>No notes yet</Text>
                <Text style={styles.emptySubtext}>
                  Add notes to your plants to see them here
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  container: {
    flex: 1,
    paddingBottom: Platform.OS === "ios" ? 95 : 82,
  },
  header: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 35,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Poppins-SemiBold",
    color: "#333",
    letterSpacing: 0.2,
  },
  tabContainer: {
    flexDirection: "row",
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingBottom: 10,
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
    marginBottom: -1,
  },
  tabActive: {
    borderBottomColor: "#5a8c4a",
  },
  tabText: {
    fontSize: 15,
    fontFamily: "Poppins-SemiBold",
    color: "#999",
  },
  tabTextActive: {
    fontFamily: "Poppins-Bold",
    color: "#5a8c4a",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: "Poppins",
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: "Poppins-SemiBold",
    color: "#666",
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: "Poppins",
    color: "#999",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  errorText: {
    fontSize: 18,
    fontFamily: "Poppins-SemiBold",
    color: "#e74c3c",
    marginTop: 16,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: "#5a8c4a",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Poppins-SemiBold",
  },
  plantCard: {
    width: "100%",
    height: 140,
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  plantCardImage: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  plantCardImageStyle: {
    borderRadius: 16,
  },
  plantNameContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    alignItems: "center",
  },
  plantNameBadge: {
    backgroundColor: "rgba(250, 243, 243, 0.33)",
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    width: "98%",
  },
  plantCardText: {
    fontSize: 18,
    fontFamily: "Poppins-SemiBold",
    color: "#fff",
    textAlign: "center",
  },
  noteCard: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  notePlantBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f7ed",
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 10,
    gap: 4,
  },
  notePlantName: {
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
    color: "#5a8c4a",
  },
noteTopRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 8,
},
  noteHeaderLeft: {
    flex: 1,
  },
 noteDateText: {
  fontSize: 12,
  fontFamily: "Poppins-SemiBold",
  color: "#5a8c4a",
},
  noteTitleText: {
    fontSize: 16,
    fontFamily: "Poppins-Bold",
    color: "#333",
  },
  noteContentRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  noteTextColumn: {
    flex: 1,
  },
  noteContentText: {
    fontSize: 14,
    fontFamily: "Poppins",
    color: "#333",
    lineHeight: 20,
  },
  noteThumbnail: {
    width: 100,
    height: 75,
    borderRadius: 8,
    backgroundColor: "#e0e0e0",
  },
});