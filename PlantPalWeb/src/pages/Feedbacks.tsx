import { useState, useEffect } from 'react';
import { Search, ChevronDown, CheckCircle,  } from "lucide-react";
import BackgroundImage from "../assets/background.png";

interface Feedback {
  id: number;
  plant_predicted: string;
  user_action: 'correct' | 'incorrect';
  plant_image: string;
  status: 'auto-logged' | 'pending' | 'resolved';
  date: string;
  timestamp?: string;
  user_email?: string;
  confidence?: number;
  plant_id?: string;
  image_source?: string;
  original_image_url?: string;
}

// Custom Image Component for handling feedback images
const FeedbackImage = ({ 
  src, 
  alt, 
  className = "w-full h-full object-cover", 
  showDebug = false,
  size = "normal" 
}: {
  src: string;
  alt: string;
  className?: string;
  showDebug?: boolean;
  size?: "small" | "normal" | "large";
}) => {
  const [imageUrl, setImageUrl] = useState(src);
  const [isLoading, setIsLoading] = useState(true);


  useEffect(() => {
    setIsLoading(true);
    
    let finalUrl = src;
    
    // If it's a data URL (base64), use placeholder instead
    if (src && src.startsWith('data:')) {
      if (showDebug) console.log('⚠️ Base64 image detected, using placeholder for:', alt);
      const plantName = alt?.split(' ')[0] || 'Plant';
      finalUrl = `https://via.placeholder.com/150/4F6F4F/FFFFFF?text=${encodeURIComponent(plantName)}`;
      setIsLoading(false);
    }
    // If it's our image endpoint, add cache busting
    else if (src && src.includes('/api/feedback/') && src.includes('/image/')) {
      finalUrl = `${src}?t=${Date.now()}`;
    }
    // Fallback for missing images
    else if (!src) {
      const plantName = alt?.split(' ')[0] || 'Plant';
      finalUrl = `https://via.placeholder.com/150/4F6F4F/FFFFFF?text=${encodeURIComponent(plantName)}`;
      setIsLoading(false);
    }
    
    setImageUrl(finalUrl);
    
    // Test load the image
    const img = new Image();
    img.onload = () => {
      setIsLoading(false);
      if (showDebug) console.log('✅ Image loaded:', alt);
    };
    img.onerror = () => {
      if (showDebug) console.log('❌ Image failed to load:', src?.substring(0, 100));
      setIsLoading(false);
     
      const plantName = alt?.split(' ')[0] || 'Plant';
      setImageUrl(`https://via.placeholder.com/150/4F6F4F/FFFFFF?text=${encodeURIComponent(plantName)}`);
    };
    img.src = finalUrl;
    
  }, [src, alt, showDebug]);

  const containerClass = size === "small" 
    ? "relative w-14 h-14 rounded-lg overflow-hidden border border-gray-300" 
    : "relative rounded-xl overflow-hidden border border-gray-300";

  return (
    <div className={containerClass}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className={`${size === "small" ? "w-4 h-4" : "w-8 h-8"} border-2 border-[#2F4F2F] border-t-transparent rounded-full animate-spin`}></div>
        </div>
      )}
      <img
        src={imageUrl}
        alt={alt}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
       
          const plantName = alt?.split(' ')[0] || 'Plant';
          setImageUrl(`https://via.placeholder.com/150/4F6F4F/FFFFFF?text=${encodeURIComponent(plantName)}`);
        }}
      />
    </div>
  );
};

export default function Feedbacks() {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    correct_confirmations: 0,
    incorrect_reports: 0,
    pending_reviews: 0,
    overall_accuracy: 0
  });

  // Fetch statistics
  const fetchStats = async () => {
    try {
      console.log('📊 Fetching stats...');
      const response = await fetch('http://127.0.0.1:8000/api/feedback/stats/');
      console.log('Stats response:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Stats data:', data);
        setStats(data);
      } else {
        console.error('Stats fetch failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Fetch feedback list - UPDATED FOR IMAGE ENDPOINT
  const fetchFeedbacks = async () => {
    try {
      setLoading(true);
      console.log('📋 Fetching feedbacks...');
      
      let url = 'http://127.0.0.1:8000/api/feedback/list/';
      const params = new URLSearchParams();
      
      if (filterStatus !== 'all') {
        params.append('status', filterStatus);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      console.log('Fetching from:', url);
      const response = await fetch(url);
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Feedback data received:', data);
        
        // Transform data for frontend - UPDATED
        const transformedData = data.feedback_list.map((item: any) => {
          // Log the image URL for debugging
          console.log(`Plant: ${item.plant_predicted}, Image: ${item.plant_image?.substring(0, 100)}...`);
          
          // Create a better placeholder if needed
          let plantImage = item.plant_image;
          if (!plantImage || plantImage.includes('placeholder.com')) {
            const plantName = item.plant_predicted?.substring(0, 15) || 'Plant';
            plantImage = `https://via.placeholder.com/150/4F6F4F/FFFFFF?text=${encodeURIComponent(plantName)}`;
          }
          
          return {
            id: item.id,
            plant_predicted: item.plant_predicted,
            user_action: item.user_action,
            plant_image: plantImage,
            status: item.status,
            date: item.date,
            timestamp: item.created_at ? new Date(item.created_at).toLocaleString() : item.date,
            user_email: item.user_email,
            confidence: item.confidence,
            plant_id: item.plant_id,
            image_source: item.image_source,
            original_image_url: item.original_image_url
          };
        });
        
        console.log('✅ Transformed data count:', transformedData.length);
        setFeedbacks(transformedData);
      } else {
        console.error('Feedbacks fetch failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update feedback status
  const updateFeedbackStatus = async (id: number, action: 'correct' | 'incorrect') => {
    try {
      console.log(`🔄 Updating feedback ${id} to ${action}`);
      
      const response = await fetch(`http://127.0.0.1:8000/api/feedback/update/${id}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: action,
          admin_action: action
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Update successful:', data);
        
        // Refresh data
        fetchFeedbacks();
        fetchStats();
        
        // Update selected feedback
        if (selectedFeedback && selectedFeedback.id === id) {
          setSelectedFeedback({
            ...selectedFeedback,
            status: 'resolved',
            user_action: action
          });
        }
        
        alert(`Feedback marked as ${action === 'correct' ? 'Correct' : 'Incorrect'}`);
      } else {
        console.error('Update failed:', response.status);
        alert('Failed to update feedback');
      }
    } catch (error) {
      console.error('Error updating feedback:', error);
      alert('Error updating feedback');
    }
  };

 
  // Initial load
  useEffect(() => {
    console.log('🚀 Initializing Feedbacks component');
    fetchStats();
    fetchFeedbacks();
  }, []);

  // Filter when filterStatus or searchQuery changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      console.log('🔍 Applying filters...');
      fetchFeedbacks();
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [filterStatus, searchQuery]);

  const handleAcknowledge = (action: 'correct' | 'incorrect') => {
    if (!selectedFeedback) {
      alert('Please select a feedback first');
      return;
    }
    
    if (selectedFeedback.status !== 'pending') {
      alert('This feedback has already been processed');
      return;
    }
    
    if (confirm(`Are you sure you want to mark this as ${action}?`)) {
      updateFeedbackStatus(selectedFeedback.id, action);
    }
  };

  // Format action for display
  const formatAction = (action: string) => {
    return action === 'correct' ? 'Correct' : 'Incorrect';
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'auto-logged': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-amber-200 text-amber-800';
      case 'resolved': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get status display text
  const getStatusDisplay = (status: string) => {
    switch(status) {
      case 'auto-logged': return 'Auto-logged';
      case 'pending': return 'Pending';
      case 'resolved': return 'Resolved';
      default: return status;
    }
  };

  return (
    <div
      className="flex h-screen font-['Poppins'] bg-cover bg-center"
      style={{ backgroundImage: `url(${BackgroundImage})` }}
    >
      <main className="flex-1 flex flex-col bg-white/20 backdrop-blur-sm overflow-hidden">
        {/* Header with refresh button */}
        <div className="px-10 py-6">
          <h2 className="text-3xl font-bold text-[#2F4F2F] mb-2">Admin Feedback</h2>
          
        </div>

          {/* Stats Cards */}    
        <section className="grid grid-cols-4 gap-4 px-10 pb-6">  
        <div className="p-4 rounded-2xl bg-[#d8e8cb] shadow-md">
  <p className="text-xs font-semibold text-gray-700 tracking-wider mb-1">Incorrect Reports</p>
  <h3 className="text-4xl font-bold text-[#2F4F2F]">{stats.incorrect_reports}</h3>
</div>
<div className="p-4 rounded-2xl bg-[#d8e8cb] shadow-md">
  <p className="text-xs font-semibold text-gray-700 tracking-wider mb-1">Pending Reviews</p>
  <h3 className="text-4xl font-bold text-[#2F4F2F]">{stats.pending_reviews}</h3>
</div>
<div className="p-4 rounded-2xl bg-[#d8e8cb] shadow-md">
  <p className="text-xs font-semibold text-gray-700 tracking-wider mb-1">Overall Accuracy</p>
  <h3 className="text-4xl font-bold text-[#2F4F2F]">{stats.overall_accuracy}%</h3>
</div>
        </section>

        {/* Main Content */}
   
        <section className="px-10 pb-6 flex-1 overflow-hidden min-h-0">
         <div className="bg-[#d8e8cb] rounded-2xl shadow-lg p-4 h-full flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-[#2F4F2F] tracking-wide">Feedback Table</h3>
              <div className="text-sm text-gray-600">
                Showing {feedbacks.length} feedbacks
              </div>
            </div>

            {/* Table and User Feedback Side by Side */}
            <div className="flex gap-6 flex-1 overflow-hidden">
              {/* Table */}
              <div className="flex-[1.5] overflow-hidden flex flex-col">
                {/* Search and Filter Controls */}
                <div className="flex justify-end gap-3 mb-4">
                  <div className="relative">
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="appearance-none bg-white/70 text-[#2F4F2F] px-4 py-2 pr-10 rounded-lg text-sm font-medium cursor-pointer hover:bg-white/90 transition-colors"
                    >
                      <option value="all">All</option>
                      <option value="incorrect">Incorrect Only</option>
                      <option value="pending">Pending Only</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#2F4F2F]" size={16} />
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search by plants"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-white/70 text-[#2F4F2F] px-4 py-2 pr-10 rounded-lg text-sm placeholder:text-[#2F4F2F]/60 focus:outline-none focus:ring-2 focus:ring-[#2F4F2F]/30"
                    />
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#2F4F2F]" size={16} />
                  </div>
                </div>
                
                {/* Table */}
               <div className="overflow-auto flex-1 max-h-full">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-[#c8dbbb]">
                    <tr className="text-left text-sm font-normal text-[#2F4F2F]">
                        <th className="p-2 rounded-tl-lg">ID</th>
                        <th className="p-2">Plant Predicted</th>
                        <th className="p-2">User Action</th>
                        <th className="p-2">User Email</th>
                        <th className="p-2">Confidence</th>
                        <th className="p-2">Plant Image</th>
                        <th className="p-2">Status</th>
                        <th className="p-2 rounded-tr-lg">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center">
                            <div className="flex flex-col items-center justify-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2F4F2F] mb-2"></div>
                              <p className="text-sm text-gray-600">Loading feedbacks...</p>
                            </div>
                          </td>
                        </tr>
                      ) : feedbacks.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-[#2F4F2F]/60">
                            No feedback found. {searchQuery ? 'Try a different search term.' : 'No feedback submitted yet.'}
                          </td>
                        </tr>
                      ) : (
                        feedbacks.map((feedback) => (
                          <tr
                            key={feedback.id}
                            onClick={() => setSelectedFeedback(feedback)}
                            className={`border-t border-[#b8cba8]/30 hover:bg-white/50 cursor-pointer transition-colors ${
                              selectedFeedback?.id === feedback.id ? 'bg-white/70' : ''
                            }`}
                          >
                           <td className="p-2 text-sm font-medium text-[#2F4F2F]">
                              {feedbacks.indexOf(feedback) + 1}
                            </td>
                          <td className="p-2 text-sm text-[#2F4F2F] font-medium">
  {feedback.plant_predicted}
</td>
<td className="p-2">
  <span className={`text-sm font-medium ${
    feedback.user_action === 'correct' ? 'text-green-700' : 'text-red-600'
  }`}>
    {formatAction(feedback.user_action)}
  </span>
</td>
<td className="p-2 text-xs text-[#2F4F2F] truncate max-w-[120px]">
  {feedback.user_email || 'Anonymous'}
</td>
<td className="p-2 text-sm text-[#2F4F2F]">
  {feedback.confidence ? `${feedback.confidence.toFixed(1)}%` : 'N/A'}
</td>
<td className="p-2">
  <FeedbackImage 
    src={feedback.plant_image} 
    alt={feedback.plant_predicted}
    size="small"
    showDebug={false}
  />
</td>
<td className="p-2">
  <span className={`text-xs px-3 py-1 rounded-full font-medium ${getStatusColor(feedback.status)}`}>
    {getStatusDisplay(feedback.status)}
  </span>
</td>
<td className="p-2 text-sm text-[#2F4F2F]">{feedback.date}</td>
                          
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* User Feedback Detail */}
           {/* User Feedback Detail */}
<div className="flex-1 bg-[#c8dbbb] rounded-2xl p-5 flex flex-col min-h-0 max-h-full">
  <h3 className="text-lg font-bold text-[#2F4F2F] tracking-wide mb-4 flex-shrink-0">User Feedback Details</h3>
  
  {selectedFeedback ? (
    <div className="flex flex-col gap-3 overflow-y-auto flex-1">
      <div className="flex-shrink-0">
        <h4 className="text-xl font-bold text-[#2F4F2F] mb-0.5">
          {formatAction(selectedFeedback.user_action)}
        </h4>
        <p className="text-sm text-[#2F4F2F]/70 italic">
          {selectedFeedback.plant_predicted}
        </p>
      </div>

   <div className="flex-shrink-0">
  <div className="h-20-full">  {/* Smaller image - 96px */}
    <FeedbackImage 
      src={selectedFeedback.plant_image}
      alt={selectedFeedback.plant_predicted}
      className="w-full h-full object-cover object-center"
      showDebug={true}
      size="small"
    />
  </div>
</div>

      <p className="text-xs text-[#2F4F2F] font-medium flex-shrink-0">
        Submitted: {selectedFeedback.timestamp || selectedFeedback.date}
      </p>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 flex-shrink-0">
        {selectedFeedback.status === 'pending' ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleAcknowledge('incorrect')}
              className="bg-[#d08080] hover:bg-[#c07070] text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              Mark as Incorrect
            </button>
            <button
              onClick={() => handleAcknowledge('correct')}
              className="bg-[#6b8e5a] hover:bg-[#5a7a4a] text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              Mark as Correct
            </button>
          </div>
        ) : (
          <div className="bg-[#b8cba8] rounded-lg p-4 text-center">
            <CheckCircle size={24} className="text-[#2F4F2F] mx-auto mb-2" />
            <p className="text-sm font-medium text-[#2F4F2F]">
              Feedback {getStatusDisplay(selectedFeedback.status)}
            </p>
            <p className="text-xs text-[#2F4F2F]/70 mt-1">
              This feedback has been processed
            </p>
          </div>
        )}
      </div>
    </div>
  ) : (
 
                  <div className="flex-1 flex flex-col items-center justify-center text-[#2F4F2F]/60">
                    <div className="text-center mb-4">
                      <div className="w-16 h-16 rounded-full bg-[#b8cba8]/50 flex items-center justify-center mx-auto mb-3">
                        <Search size={24} className="text-[#2F4F2F]/60" />
                      </div>
                      <p className="text-sm">Select a feedback to view details</p>
                      <p className="text-xs mt-1">{feedbacks.length} feedbacks available</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}