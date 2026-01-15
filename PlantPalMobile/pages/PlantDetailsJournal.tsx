import React, { useState, useEffect, useRef } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAuth } from "../src/contexts/AuthContext";
import EditPlantScreen from "./EditPlantScreen";
import * as ImagePicker from 'expo-image-picker';
import { useFonts } from "expo-font";




interface RouteParams {
  plantId: string;
  plantName: string;
  plantImage: any;
  scientificName?: string;
  journalId?: string;
  currentNickname?: string;
}

interface NoteContent {
  type: 'text' | 'image';
  content: string;
  id: string;
}

interface SavedNote {
  title?: string;
  text: string;
  date: string;
  image?: string;
  contents?: NoteContent[];
}

const getBaseUrl = () => {
  return 'http://127.0.0.1:8000';
};


export default function PlantDetailsJournal() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const { 
    plantName, 
    plantImage, 
    scientificName, 
    journalId, 
    currentNickname,
  } = route.params as RouteParams;

  const [noteTitle, setNoteTitle] = useState("");
  const [noteContents, setNoteContents] = useState<NoteContent[]>([
    { type: 'text', content: '', id: 'text-0' }
  ]);
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
 const [nickname, setNickname] = useState(currentNickname || "");
const [scientificNameState, setScientificNameState] = useState(scientificName || "");
  const [loading, setLoading] = useState(false);
  const [notesLoading, setNotesLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"add" | "saved">("add");
const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);


const [fontsLoaded] = useFonts({
  "Poppins": require("../assets/fonts/Poppins-Regular.ttf"),
  "Poppins-Italic": require("../assets/fonts/Poppins-Italic.ttf"),
  "Poppins-SemiBold": require("../assets/fonts/Poppins-SemiBold.ttf"),
  "Poppins-Bold": require("../assets/fonts/Poppins-Bold.ttf"),
});




 const fetchJournalNotes = async () => {
  if (!journalId || !user?.email) {
    setNotesLoading(false);
    return;
  }

  try {
    setNotesLoading(true);
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/api/get_journal_details/${journalId}/?user_email=${encodeURIComponent(user.email)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      setNotesLoading(false);
      return;
    }

    const data = await response.json();
    
    console.log('📥 Journal details:', data); // Debug log
    
    if (data.notes && Array.isArray(data.notes)) {
      setSavedNotes(data.notes);
    } else {
      setSavedNotes([]);
    }
    
    if (data.nickname) {
      setNickname(data.nickname);
    }
    
    // Update scientific name if available
   if (data.scientificName) {
  setScientificNameState(data.scientificName);
}
  } catch (error) {
    console.log('❌ Error in fetchJournalNotes:', error);
  } finally {
    setNotesLoading(false);
  }
};

  useEffect(() => {
    if (journalId && user?.email) {
      fetchJournalNotes();
    } else {
      setNotesLoading(false);
    }
  }, [journalId, user?.email]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const takePhoto = async () => {
    
    
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      insertImageData(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const choosePhoto = async () => {
    
    
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      insertImageData(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

const insertImageData = (imageData: string) => {
  const imageId = `image-${Date.now()}`;
  const textId = `text-${Date.now() + 1}`;
  
  // Add image followed by new text input for continuous editing
  setNoteContents([
    ...noteContents,
    { type: 'image', content: imageData, id: imageId },
    { type: 'text', content: '', id: textId }
  ]);

  setTimeout(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, 100);
};

  const updateTextContent = (index: number, text: string) => {
    const newContents = [...noteContents];
    newContents[index].content = text;
    setNoteContents(newContents);
  };

  const removeImage = (index: number) => {
    const newContents = noteContents.filter((_, i) => i !== index);
    setNoteContents(newContents);
  };

  const handleSaveNote = async () => {
    const hasText = noteContents.some(c => c.type === 'text' && c.content.trim());
    const hasImages = noteContents.some(c => c.type === 'image');
    
    if (!hasText && !hasImages) {
      Alert.alert("Error", "Please add some content to your note");
      return;
    }

    if (!journalId || !user?.email) {
      Alert.alert("Error", "Unable to save note");
      return;
    }

    try {
      setLoading(true);
      
      const processedContents = await Promise.all(
        noteContents.map(async (content) => {
          if (content.type === 'image') {
            try {
              const imageResponse = await fetch(`${getBaseUrl()}/api/upload_note_image/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  user_email: user.email,
                  journal_id: journalId,
                  image: content.content,
                }),
              });

              if (imageResponse.ok) {
                const imageData = await imageResponse.json();
                return {
                  type: 'image' as const,
                  content: imageData.image_url,
                  id: content.id
                };
              }
            } catch (error) {
              console.log('Failed to upload image:', error);
            }
          }
          return content;
        })
      );

      const filteredContents = processedContents.filter(c => 
        c.type === 'image' || (c.type === 'text' && c.content.trim())
      );

     const newNote: SavedNote = {
      title: noteTitle.trim() || undefined,
      text: noteContents
        .filter(c => c.type === 'text' && c.content.trim())
        .map(c => c.content.trim())
        .join('\n\n'),
      date: new Date().toISOString(),
      contents: filteredContents,
    };

     let updatedNotes;
if (editingNoteIndex !== null) {
  updatedNotes = [...savedNotes];
  updatedNotes[editingNoteIndex] = newNote; // update the existing note
  setEditingNoteIndex(null); // reset editing state
} else {
  updatedNotes = [newNote, ...savedNotes]; // add new note
}


      const response = await fetch(`${getBaseUrl()}/api/update_journal/${journalId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: user.email,
          notes: updatedNotes,
        }),
      });

      if (!response.ok) throw new Error('Failed to save note');

    setSavedNotes(updatedNotes);
    setNoteTitle("");
    setNoteContents([{ type: 'text', content: '', id: 'text-0' }]);
      Alert.alert("Success", "Note saved!");
      setActiveTab("saved");
    } catch (error) {
      console.log('❌ Error saving note:', error);
      Alert.alert("Error", "Failed to save note");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNote = (index: number) => {
    Alert.alert(
      "Delete Note",
      "Are you sure you want to delete this note?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const updatedNotes = savedNotes.filter((_, i) => i !== index);
            
            try {
              const response = await fetch(`${getBaseUrl()}/api/update_journal/${journalId}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  user_email: user?.email,
                  notes: updatedNotes,
                }),
              });

              if (!response.ok) throw new Error('Failed to delete note');
              
              setSavedNotes(updatedNotes);
              Alert.alert("Success", "Note deleted!");
            } catch (error) {
              Alert.alert("Error", "Failed to delete note");
            }
          }
        },
      ]
    );
  };

  const handleSaveEdit = async (newNickname: string, species: string) => {
    if (!journalId || !user?.email) {
      Alert.alert("Error", "Unable to update plant");
      return;
    }

    try {
      const response = await fetch(`${getBaseUrl()}/api/update_journal/${journalId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: user.email,
          nickname: newNickname,
        }),
      });

      if (!response.ok) throw new Error('Failed to update plant');

      setNickname(newNickname);
      setShowEditModal(false);
      Alert.alert("Success", "Plant updated!");
    } catch (error) {
      Alert.alert("Error", "Failed to update plant");
    }
  };

  const hasUnsavedChanges = () => {
  const hasText = noteContents.some(c => c.type === 'text' && c.content.trim());
  const hasImages = noteContents.some(c => c.type === 'image');
  const titleChanged = noteTitle.trim() !== "";
  return hasText || hasImages || titleChanged;
};

const handleEditNote = (index: number) => {
  const noteToEdit = savedNotes[index];
  if (!noteToEdit) return;

// Store index of note being edited
setEditingNoteIndex(index);

// Populate Add Note tab with existing content
setNoteTitle(noteToEdit.title || "");
setNoteContents(noteToEdit.contents || [{ type: 'text', content: '', id: 'text-0' }]);

// Switch to Add Note tab
setActiveTab("add");


setEditingNoteIndex(index);
};

  const handleDeletePlant = async () => {
    Alert.alert(
      "Remove Plant",
      "Are you sure you want to remove this plant from your journal?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            if (!journalId || !user?.email) return;

            try {
              const response = await fetch(
                `${getBaseUrl()}/api/delete_journal/${journalId}/?user_email=${encodeURIComponent(user.email)}`,
                { method: 'DELETE' }
              );

              if (!response.ok) throw new Error('Failed to delete plant');

              Alert.alert("Success", "Plant removed from journal", [
                { text: "OK", onPress: () => navigation.goBack() }
              ]);
            } catch (error) {
              Alert.alert("Error", "Failed to remove plant");
            }
          }
        }
      ]
    );
  };

 const renderNoteContent = (note: SavedNote) => {
  // Get first image and text content
  const firstImage = note.contents?.find(c => c.type === 'image');
  const textContent = note.contents?.filter(c => c.type === 'text' && c.content.trim()).map(c => c.content).join('\n\n') || note.text;
  
  return (
    <View style={styles.noteContentRow}>
      <View style={styles.noteTextColumn}>
        <Text style={styles.savedNoteText} numberOfLines={3}>
          {textContent}
        </Text>
      </View>
      {firstImage && (
        <Image
          source={{ uri: firstImage.content }}
          style={styles.savedNoteThumbnail}
          resizeMode="cover"
        />
      )}
    </View>
  );
};

  return (
    <ImageBackground
      source={require("../assets/background.png")}
      style={styles.bg}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
      <TouchableOpacity
  style={styles.backButton}
  onPress={() => {
    if (hasUnsavedChanges()) {
      Alert.alert(
        "Unsaved Changes",
        "You have unsaved changes. Do you want to save or discard?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: () => navigation.goBack() },
          { text: "Save", onPress: handleSaveNote }
        ]
      );
    } else {
      navigation.goBack();
    }
  }}
>

            <Ionicons name="arrow-back" size={28} color="#5a8c4a" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            {nickname ? (
              <>
                <Text style={styles.headerNameGreen}>{nickname}</Text>
              <Text style={styles.headerPlantName}>{plantName}</Text>
              {scientificNameState && (
                <Text style={styles.headerScientific}>({scientificNameState})</Text>
              )}
              </>
            ) : (
              <>
                <Text style={styles.headerPlantName}>{plantName}</Text>
                {scientificName && (
                  <Text style={styles.headerScientific}>({scientificName})</Text>
                )}
              </>
            )}
          </View>

          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => setShowEditModal(true)}
          >
            <Ionicons name="create-outline" size={28} color="#5a8c4a" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView 
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
        <ScrollView
  style={styles.flex}
  contentContainerStyle={{ paddingBottom: 40 }}
  showsVerticalScrollIndicator={false}
>
  <View style={styles.container}>

            <View style={styles.imageContainer}>
              <ImageBackground
                source={plantImage}
                style={styles.plantImage}
                imageStyle={styles.plantImageStyle}
                defaultSource={require("../assets/icon.png")}
              >
              <View style={styles.plantBadgeContainer}>
            <View style={styles.plantBadge}>
              <Ionicons name="leaf-outline" size={20} color="#5a8c4a" />
              <Text style={styles.plantBadgeText}>
                {scientificNameState || plantName}
              </Text>
            </View>
          </View>
                        </ImageBackground>
            </View>

            <View style={styles.notesSection}>
              <Text style={styles.notesTitle}>Notes</Text>

              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[styles.tab, activeTab === "add" && styles.tabActive]}
                  onPress={() => setActiveTab("add")}
                >
                  <Text style={[styles.tabText, activeTab === "add" && styles.tabTextActive]}>
                    Add Note
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === "saved" && styles.tabActive]}
                  onPress={() => setActiveTab("saved")}
                >
                  <Text style={[styles.tabText, activeTab === "saved" && styles.tabTextActive]}>
                    Saved Notes ({savedNotes.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {activeTab === "add" ? (
                <View style={styles.addNoteContainer}>
                  {/* Title Input */}
<TextInput
  style={styles.titleInput}
  placeholder="Title"
  placeholderTextColor="#999"
  value={noteTitle}
  onChangeText={setNoteTitle}
  editable={!loading}
/>

                  <ScrollView
                    ref={scrollViewRef}
                    style={styles.noteScrollArea}
                    contentContainerStyle={styles.noteContentContainer}
                    showsVerticalScrollIndicator={false}
                  >
                 {noteContents.map((content, index) => (
                    <View key={content.id}>
                      {content.type === 'text' ? (
                      <TextInput
                        style={styles.continuousTextInput}
                        placeholder={index === 0 ? "Write your note here..." : "Continue writing..."}
                        placeholderTextColor="#999"
                        value={content.content}
                        onChangeText={(text) => updateTextContent(index, text)}
                        multiline
                        textAlignVertical="top"
                        editable={!loading}
                        scrollEnabled={false}
                      />
                        ) : (
                          <View style={styles.imageInNoteContainer}>
                            <Image 
                              source={{ uri: content.content }} 
                              style={styles.imageInNote}
                              resizeMode="cover"
                            />
                            <TouchableOpacity 
                              style={styles.removeImageButton}
                              onPress={() => removeImage(index)}
                            >
                              <Ionicons name="close-circle" size={28} color="#ff4444" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ))}
                  </ScrollView>

             <View style={styles.toolbar}>
  {/* Photo Buttons */}
  <View style={styles.photoButtonsContainer}>
    <TouchableOpacity
      style={styles.photoButton}
      onPress={takePhoto}
      disabled={loading}
    >
      <Ionicons name="camera-outline" size={22} color="#5a8c4a" />
      <Text style={styles.photoButtonText}>Take Photo</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.photoButton}
      onPress={choosePhoto}
      disabled={loading}
    >
      <Ionicons name="image-outline" size={22} color="#5a8c4a" />
      <Text style={styles.photoButtonText}>Choose Photo</Text>
    </TouchableOpacity>
  </View>

  {/* Save Button */}
  <TouchableOpacity
    style={[styles.saveButton, loading && styles.saveButtonDisabled]}
    onPress={handleSaveNote}
    disabled={loading}
  >
    {loading ? (
      <ActivityIndicator color="#fff" size="small" />
    ) : (
      <>
        <Ionicons name="checkmark" size={20} color="#fff" />
        <Text style={styles.saveButtonText}>Save</Text>
      </>
    )}
  </TouchableOpacity>
</View>
                </View>
              ) : (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.savedNotesScroll}
                >
                  {notesLoading ? (
                    <View style={styles.notesLoadingContainer}>
                      <ActivityIndicator size="small" color="#5a8c4a" />
                      <Text style={styles.notesLoadingText}>Loading notes...</Text>
                    </View>
                  ) : savedNotes.length > 0 ? (
                    <View>
                      {savedNotes.map((savedNote, index) => (
                        <View key={index} style={styles.savedNoteCard}>
                 <View style={styles.savedNoteTopRow}>
  <Text style={styles.savedNoteDate}>
    {new Date(savedNote.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}
  </Text>

  <View style={{ flexDirection: 'row', gap: 12 }}>
    {/* Edit Button */}
    <TouchableOpacity
      onPress={() => handleEditNote(index)}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons name="create-outline" size={20} color="#5a8c4a" />
    </TouchableOpacity>

    {/* Delete Button */}
    <TouchableOpacity 
      onPress={() => handleDeleteNote(index)}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons name="trash-outline" size={20} color="#ff4444" />
    </TouchableOpacity>
  </View>
</View>


{savedNote.title && (
  <Text style={styles.savedNoteTitle}>{savedNote.title}</Text>
)}

{renderNoteContent(savedNote)}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.emptyNotesContainer}>
                      <Ionicons name="clipboard-outline" size={48} color="#ccc" />
                      <Text style={styles.emptyNotesText}>No notes yet</Text>
                      <Text style={styles.emptyNotesSubtext}>Add your first note in the "Add Note" tab</Text>
                    </View>
                  )}
                </ScrollView>
              )}
            </View>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>

       

   <EditPlantScreen
  visible={showEditModal}
  onClose={() => {
    if (hasUnsavedChanges()) {
      Alert.alert(
        "Unsaved Changes",
        "You have unsaved changes. Do you want to save or discard?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: () => setShowEditModal(false) },
          { text: "Save", onPress: handleSaveNote }
        ]
      );
    } else {
      setShowEditModal(false);
    }
  }}
  onSave={handleSaveEdit}
  onDelete={handleDeletePlant}
  currentNickname={nickname}
  currentSpecies={plantName}
  plantImage={plantImage}
/>

      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg:{flex:1,width:"100%",height:"100%"},
  safeArea:{flex:1},
  flex:{flex:1},
  container:{flex:1},

  header:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:20,paddingTop:35,paddingBottom:15,backgroundColor:"transparent"},
  backButton:{width:44,height:44,justifyContent:"center",alignItems:"center"},
  headerCenter:{flex:1,alignItems:"center",paddingHorizontal:8},
  headerNameGreen:{fontSize:16,fontFamily:"Poppins-Bold",color:"#5a8c4a", marginBottom:0  },
  headerPlantName:{fontSize:17,fontFamily:"Poppins-Italic",color:"#333",marginBottom:0},
  headerScientific:{fontSize:13,fontFamily:"Poppins-Italic",color:"#666"},
  editButton:{width:44,height:44,justifyContent:"center",alignItems:"center"},

  imageContainer:{paddingHorizontal:20,marginBottom:16},
  plantImage:{width:"100%",height:230,borderRadius:20,overflow:"hidden",backgroundColor:"#e0e0e0"},
  plantImageStyle:{borderRadius:20},

  plantBadgeContainer:{position:"absolute",bottom:16,left:16,right:16,alignItems:"flex-start"},
  plantBadge:{flexDirection:"row",alignItems:"center",backgroundColor:"rgba(255,255,255,0.74)",paddingVertical:4,paddingHorizontal:13,borderRadius:25,shadowColor:"#000",shadowOffset:{width:0,height:2},shadowOpacity:0.15,shadowRadius:4,elevation:3},
  plantBadgeText:{fontSize:12,fontFamily:"Poppins-SemiBold",color:"#333",marginLeft:8},
  plantBadgeScientific:{fontFamily:"Poppins-Italic",fontSize:14,color:"#666"},

  notesSection:{flex:1,paddingHorizontal:20},
  notesTitle:{fontSize:18,fontFamily:"Poppins-Bold",color:"#333",marginBottom:0},

  tabContainer:{flexDirection:"row",marginBottom:16,borderBottomWidth:2,borderBottomColor:"#e0e0e0"},
  tab:{flex:1,paddingVertical:7,alignItems:"center",borderBottomWidth:3,borderBottomColor:"transparent",marginBottom:-2},
  tabActive:{borderBottomColor:"#5a8c4a"},
  tabText:{fontSize:15,fontFamily:"Poppins-SemiBold",color:"#999"},
  tabTextActive:{color:"#5a8c4a",fontFamily:"Poppins-Bold"},

  addNoteContainer:{flex:1,backgroundColor:"#fff",borderRadius:12,overflow:"hidden"},
  noteScrollArea:{flex:1},
  noteContentContainer:{padding:16,  paddingBottom: 10 },

continuousTextInput:{fontSize:14,fontFamily:"Poppins",color:"#333",minHeight:40,textAlignVertical:"top"},
 imageInNoteContainer:{marginVertical:0,position:"relative"},
  imageInNote:{width:"100%",height:200,borderRadius:8,backgroundColor:"#e0e0e0"},
  removeImageButton:{position:"absolute",top:8,right:8,backgroundColor:"rgba(255,255,255,0.95)",borderRadius:14,shadowColor:"#000",shadowOffset:{width:0,height:2},shadowOpacity:0.2,shadowRadius:3,elevation:3},

  toolbar: {
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderTopWidth: 1,
  borderTopColor: "#e0e0e0",
  backgroundColor: "#fff",
},
  toolbarButton:{width:44,height:44,justifyContent:"center",alignItems:"center"},
saveButton: {
  flexDirection: "row",
  backgroundColor: "#5a8c4a",
  borderRadius: 8,
  paddingVertical: 12,
  paddingHorizontal: 20,
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
},
  saveButtonDisabled:{opacity:0.6},
  saveButtonText:{fontSize:15,fontFamily:"Poppins-SemiBold",color:"#fff"},

  savedNotesScroll:{paddingBottom:20},
  notesLoadingContainer:{flexDirection:"row",alignItems:"center",justifyContent:"center",paddingVertical:40},
  notesLoadingText:{marginLeft:12,fontSize:14,fontFamily:"Poppins",color:"#666"},

  savedNoteCard:{backgroundColor:"#fff",borderRadius:12,padding:14,marginBottom:10,borderWidth:1,borderColor:"#e0e0e0",shadowColor:"#000",shadowOffset:{width:0,height:1},shadowOpacity:0.05,shadowRadius:2,elevation:1},
 
  savedNoteDate:{fontSize:12,fontFamily:"Poppins-SemiBold",color:"#5a8c4a"},
  
  emptyNotesContainer:{alignItems:"center",paddingVertical:40},
  emptyNotesText:{fontSize:16,fontFamily:"Poppins-SemiBold",color:"#999",marginTop:12},
  emptyNotesSubtext:{fontSize:13,fontFamily:"Poppins",color:"#bbb",marginTop:4},

  modalOverlay:{flex:1,backgroundColor:"rgba(0,0,0,0.5)",justifyContent:"center",alignItems:"center"},
  imagePickerMenu:{backgroundColor:"#fff",borderRadius:12,width:"80%",maxWidth:300,overflow:"hidden",shadowColor:"#000",shadowOffset:{width:0,height:4},shadowOpacity:0.3,shadowRadius:8,elevation:8},
  imagePickerOption:{flexDirection:"row",alignItems:"center",padding:18,gap:16},
  imagePickerText:{fontSize:16,fontFamily:"Poppins-SemiBold",color:"#333"},
  imagePickerDivider:{height:1,backgroundColor:"#e0e0e0"},
  
titleInput: {
  fontSize: 20,
  fontFamily: "Poppins-SemiBold",
  color: "#333",
  paddingBottom: 12,
  paddingLeft: 16,  
  borderBottomWidth: 1,
  borderBottomColor: "#e0e0e0",
  marginBottom: 16,
},
photoButtonsContainer: {
  flexDirection: "row",
  gap: 8,
  marginBottom: 10,
},
photoButton: {
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#f0f7ed",
  borderRadius: 8,
  paddingVertical: 10,
  paddingHorizontal: 12,
  borderWidth: 1,
  borderColor: "#d0e5ca",
  gap: 6,
},
photoButtonText: {
  fontSize: 13,
  fontFamily: "Poppins-SemiBold",
  color: "#5a8c4a",
},

savedNoteTitle: {
  fontSize: 16,
  fontFamily: "Poppins-Bold",
  color: "#333",
  marginBottom: 4,
},

savedNoteTopRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 8,
},


noteContentRow: {
  flexDirection: "row",
  gap: 12,
  alignItems: "flex-start",
},
noteTextColumn: {
  flex: 1,
},
savedNoteText: {
  fontSize: 14,
  fontFamily: "Poppins",
  color: "#333",
  lineHeight: 20,
},
savedNoteThumbnail: {
  width: 100,
  height: 75,
  borderRadius: 8,
  backgroundColor: "#e0e0e0",
},
});
