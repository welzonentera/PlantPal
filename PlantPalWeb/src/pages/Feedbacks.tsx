import { useState, useEffect } from "react";
import { Eye, X, Bell, Trash2, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import BackgroundImage from "../assets/background.png";

/* ===================== TYPES ===================== */
type FeedbackType = {
  id: string;
  user_name: string;
  email: string;
  message: string;
  date_submitted: string;
  is_positive: boolean;
  plant_identified: string | null;
  confidence_score: number | null;
};

type NotificationTarget = "all" | "subscribed" | "unsubscribed";

type AdminNotification = {
  id: string;
  title: string;
  message: string;
  target: NotificationTarget;
  date_created: string;
};

type FilterType = "all" | "positive" | "negative";

/* ===================== COMPONENT ===================== */
export default function UserFeedbacks() {
  const API_BASE = "http://127.0.0.1:8000/api/";

  const [activeTab, setActiveTab] =
    useState<"feedbacks" | "notifications">("feedbacks");

  /* ---------- FEEDBACK STATE ---------- */
  const [feedbacks, setFeedbacks] = useState<FeedbackType[]>([]);
  const [selectedFeedback, setSelectedFeedback] =
    useState<FeedbackType | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [error, setError] = useState<string | null>(null);

  /* ---------- NOTIFICATION STATE ---------- */
  const [notifications, setNotifications] =
    useState<AdminNotification[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifTarget, setNotifTarget] =
    useState<NotificationTarget>("all");

  /* ===================== EFFECTS ===================== */
  useEffect(() => {
    if (activeTab === "feedbacks") {
      fetchFeedbacks();
    }
  }, [activeTab]);

  /* ===================== HANDLERS ===================== */
  const fetchFeedbacks = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}get_feedbacks/`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (Array.isArray(data)) {
        setFeedbacks(data);
      } else {
        setFeedbacks([]);
        console.warn('Expected array but got:', data);
      }
    } catch (err) {
      console.error("Error fetching feedbacks:", err);
      setError("Failed to load feedbacks. Please try again.");
      setFeedbacks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (feedback: FeedbackType) => {
    setSelectedFeedback(feedback);
    setShowViewModal(true);
  };

  const handleDeleteFeedback = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this feedback?")) {
      try {
        const response = await fetch(`${API_BASE}delete_feedback/${id}/`, {
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer YOUR_ADMIN_TOKEN_HERE', // You need to implement auth
          }
        });
        
        if (response.ok) {
          setFeedbacks(prev => prev.filter(fb => fb.id !== id));
          if (selectedFeedback?.id === id) {
            setShowViewModal(false);
          }
        } else {
          alert('Failed to delete feedback');
        }
      } catch (error) {
        console.error('Error deleting feedback:', error);
        alert('Error deleting feedback');
      }
    }
  };

  const handleSendNotification = () => {
    if (!notifTitle || !notifMessage) {
      alert("Please fill in all fields.");
      return;
    }

    const newNotification: AdminNotification = {
      id: Date.now().toString(),
      title: notifTitle,
      message: notifMessage,
      target: notifTarget,
      date_created: new Date().toLocaleString(),
    };

    setNotifications((prev) => [
      newNotification,
      ...prev,
    ]);

    setNotifTitle("");
    setNotifMessage("");
    setNotifTarget("all");
    setShowAddModal(false);
  };

  const getFilteredFeedbacks = () => {
    if (filter === "all") return feedbacks;
    if (filter === "positive") return feedbacks.filter(fb => fb.is_positive);
    return feedbacks.filter(fb => !fb.is_positive);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (isPositive: boolean) => {
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
        isPositive 
          ? 'bg-green-100 text-green-800 border border-green-200' 
          : 'bg-red-100 text-red-800 border border-red-200'
      }`}>
        {isPositive ? (
          <span className="flex items-center gap-1">
            <CheckCircle size={12} /> Positive
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <XCircle size={12} /> Negative
          </span>
        )}
      </span>
    );
  };

  /* ===================== UI ===================== */
  return (
    <div
      className="flex h-screen font-['Poppins'] bg-cover bg-center"
      style={{ backgroundImage: `url(${BackgroundImage})` }}
    >
      <main className="flex-1 bg-white/20 backdrop-blur-sm p-10 overflow-y-auto">

        {/* ===================== TABS ===================== */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setActiveTab("feedbacks")}
            className={`px-5 py-2 rounded-xl font-semibold transition ${
              activeTab === "feedbacks"
                ? "bg-[#2F4F2F] text-white"
                : "bg-white text-[#2F4F2F]"
            }`}
          >
            User Feedbacks
          </button>

          <button
            onClick={() => setActiveTab("notifications")}
            className={`px-5 py-2 rounded-xl font-semibold flex items-center gap-2 transition ${
              activeTab === "notifications"
                ? "bg-[#2F4F2F] text-white"
                : "bg-white text-[#2F4F2F]"
            }`}
          >
            <Bell size={18} />
            Admin Notifications
          </button>
        </div>

        {/* ===================== FEEDBACK TAB ===================== */}
        {activeTab === "feedbacks" && (
          <div className="bg-white rounded-2xl shadow-md p-6">
            {/* Header with filter and refresh */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold text-[#2F4F2F]">
                  User Feedbacks
                </h2>
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                  {(['all', 'positive', 'negative'] as FilterType[]).map((filterType) => (
                    <button
                      key={filterType}
                      onClick={() => setFilter(filterType)}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition ${
                        filter === filterType
                          ? 'bg-[#2F4F2F] text-white'
                          : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {filterType === 'all' ? 'All' : filterType === 'positive' ? '👍 Positive' : '👎 Negative'}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={fetchFeedbacks}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                  disabled={loading}
                >
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                  Refresh
                </button>
                <div className="text-sm text-gray-500">
                  {getFilteredFeedbacks().length} feedback(s)
                </div>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            {/* Loading state */}
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <RefreshCw size={32} className="animate-spin text-[#2F4F2F]" />
                <span className="ml-3 text-gray-600">Loading feedbacks...</span>
              </div>
            ) : (
              <>
                {/* Feedback Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-separate border-spacing-y-2">
                    <thead>
                      <tr className="text-sm font-semibold text-[#2F4F2F]">
                        <th className="px-4 py-2 text-left">User</th>
                        <th className="px-4 py-2 text-left">Email</th>
                        <th className="px-4 py-2 text-left">Message</th>
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-left">Plant</th>
                        <th className="px-4 py-2 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredFeedbacks().map((fb) => (
                        <tr
                          key={fb.id}
                          className="bg-white/80 hover:bg-white rounded-xl shadow-sm transition"
                        >
                          <td className="px-4 py-3 font-medium">
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded-full bg-[#2F4F2F]/10 flex items-center justify-center mr-3">
                                <span className="text-sm font-medium text-[#2F4F2F]">
                                  {fb.user_name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium">{fb.user_name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <a 
                              href={`mailto:${fb.email}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {fb.email}
                            </a>
                          </td>
                          <td className="px-4 py-3 max-w-[200px]">
                            <div className="truncate" title={fb.message}>
                              {fb.message}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm">
                              {formatDate(fb.date_submitted)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {getStatusBadge(fb.is_positive)}
                          </td>
                          <td className="px-4 py-3">
                            {fb.plant_identified ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                  {fb.plant_identified}
                                </span>
                                {fb.confidence_score && (
                                  <span className="text-xs text-gray-500">
                                    ({fb.confidence_score.toFixed(1)}%)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => handleView(fb)}
                                className="flex gap-2 items-center bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg transition"
                              >
                                <Eye size={16} />
                                View
                              </button>
                              <button
                                onClick={() => handleDeleteFeedback(fb.id)}
                                className="flex gap-2 items-center bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 rounded-lg transition"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {getFilteredFeedbacks().length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="text-center py-12"
                          >
                            <div className="flex flex-col items-center justify-center">
                              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <Bell size={24} className="text-gray-400" />
                              </div>
                              <p className="text-gray-500 text-lg mb-2">
                                {filter === 'all' 
                                  ? 'No feedbacks yet' 
                                  : `No ${filter} feedbacks`}
                              </p>
                              <p className="text-gray-400 text-sm">
                                User feedbacks will appear here
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Stats Summary */}
                {feedbacks.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-green-700">
                          {feedbacks.filter(f => f.is_positive).length}
                        </div>
                        <div className="text-sm text-green-600">Positive Feedbacks</div>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-red-700">
                          {feedbacks.filter(f => !f.is_positive).length}
                        </div>
                        <div className="text-sm text-red-600">Negative Feedbacks</div>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-blue-700">
                          {feedbacks.filter(f => f.plant_identified).length}
                        </div>
                        <div className="text-sm text-blue-600">Plants Identified</div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ===================== NOTIFICATION TAB ===================== */}
        {activeTab === "notifications" && (
          <div className="bg-white rounded-2xl shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-[#2F4F2F]">
                Admin Notifications
              </h2>

              <button
                onClick={() => setShowAddModal(true)}
                className="bg-[#2F4F2F] text-white px-5 py-2 rounded-xl hover:bg-[#3b6b3b] flex items-center gap-2"
              >
                <Bell size={18} />
                + Add Notification
              </button>
            </div>

            {notifications.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bell size={24} className="text-gray-400" />
                </div>
                <p className="text-gray-500 text-lg mb-2">
                  No notifications yet
                </p>
                <p className="text-gray-400 text-sm">
                  Create your first notification to send to users
                </p>
              </div>
            )}

            <div className="space-y-4">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="p-4 bg-gray-50 rounded-xl border hover:bg-gray-100 transition"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-lg">{notif.title}</p>
                      <span className={`text-xs px-2 py-1 rounded ${
                        notif.target === 'all' 
                          ? 'bg-blue-100 text-blue-800' 
                          : notif.target === 'subscribed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {notif.target}
                      </span>
                    </div>
                    <button
                      onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <p className="text-gray-600 mt-2">
                    {notif.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-3">
                    Sent: {notif.date_created}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ===================== VIEW FEEDBACK MODAL ===================== */}
      {showViewModal && selectedFeedback && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-[500px] max-w-[90vw] p-8 relative animate-fadeIn">
            <button
              onClick={() => setShowViewModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={22} />
            </button>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-semibold text-[#2F4F2F]">
                  Feedback Details
                </h3>
                {getStatusBadge(selectedFeedback.is_positive)}
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">User Information</label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-[#2F4F2F]/10 flex items-center justify-center mr-3">
                        <span className="text-lg font-medium text-[#2F4F2F]">
                          {selectedFeedback.user_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{selectedFeedback.user_name}</p>
                        <a 
                          href={`mailto:${selectedFeedback.email}`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {selectedFeedback.email}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Feedback Message</label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg min-h-[100px]">
                    <p className="whitespace-pre-wrap">{selectedFeedback.message}</p>
                  </div>
                </div>

                {selectedFeedback.plant_identified && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Plant Identified</label>
                    <div className="mt-1 p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-green-800">
                          {selectedFeedback.plant_identified}
                        </span>
                        {selectedFeedback.confidence_score && (
                          <span className="text-sm text-green-600">
                            Confidence: {selectedFeedback.confidence_score.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Date Submitted</label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                      <p>{formatDate(selectedFeedback.date_submitted)}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Feedback Type</label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                      <p className={`font-medium ${selectedFeedback.is_positive ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedFeedback.is_positive ? 'Positive 👍' : 'Negative 👎'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => handleDeleteFeedback(selectedFeedback.id)}
                className="flex gap-2 items-center px-5 py-2.5 rounded-xl border border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
              >
                <Trash2 size={18} />
                Delete
              </button>
              <button
                onClick={() => setShowViewModal(false)}
                className="px-6 py-2.5 rounded-xl bg-[#2F4F2F] text-white font-semibold hover:bg-[#3b6b3b]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== ADD NOTIFICATION MODAL ===================== */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-[480px] p-8 relative animate-fadeIn">

            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={22} />
            </button>

            <h3 className="text-2xl font-semibold text-[#2F4F2F] mb-1">
              Create Notification
            </h3>
          

            <input
              className="w-full rounded-xl border px-4 py-3 mb-4 focus:ring-2 focus:ring-[#2F4F2F] focus:border-transparent"
              placeholder="Notification Title"
              value={notifTitle}
              onChange={(e) => setNotifTitle(e.target.value)}
            />
        

            <textarea
              className="w-full rounded-xl border px-4 py-3 mb-6 resize-none focus:ring-2 focus:ring-[#2F4F2F] focus:border-transparent"
              rows={4}
              placeholder="Notification Message"
              value={notifMessage}
              onChange={(e) => setNotifMessage(e.target.value)}
            />

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Audience
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "All Users", value: "all", icon: "👥" },
                  { label: "Subscribed", value: "subscribed", icon: "🔔" },
                  { label: "Unsubscribed", value: "unsubscribed", icon: "🔕" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setNotifTarget(opt.value as NotificationTarget)
                    }
                    className={`rounded-xl px-3 py-4 text-sm font-medium border transition flex flex-col items-center ${
                      notifTarget === opt.value
                        ? "bg-[#2F4F2F] text-white border-[#2F4F2F]"
                        : "bg-gray-50 hover:bg-gray-100 border-gray-300"
                    }`}
                  >
                    <span className="text-lg mb-1">{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-5 py-2.5 rounded-xl border hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                onClick={handleSendNotification}
                className="px-6 py-2.5 rounded-xl bg-[#2F4F2F] text-white font-semibold hover:bg-[#3b6b3b] flex items-center gap-2"
                disabled={!notifTitle || !notifMessage}
              >
                <Bell size={18} />
                Send Notification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}