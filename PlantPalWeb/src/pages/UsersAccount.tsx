"use client"

import { useState, useEffect } from "react"
import { Search, Trash2, ArrowUpDown, Loader2, Flag, ChevronDown } from "lucide-react"

type UserType = {
  id: string
  user_name: string
  user_email: string
  created_at: string
  city?: string
  avatar_url?: string
  is_premium?: boolean
  subscription_status?: "Subscribed" | "Not Subscribed" | "Expired"
}

type SortConfig = {
  key: keyof UserType | null
  direction: "asc" | "desc"
}

export default function UserAccount() {
  const API_BASE =
    typeof window !== "undefined"
      ? window.location.hostname === "localhost"
        ? "http://127.0.0.1:8000/api/"
        : "/api/"
      : "/api/"

  const [users, setUsers] = useState<UserType[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "user_name", direction: "asc" })
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [statusFilter, setStatusFilter] = useState<"All" | "Subscribed" | "Not Subscribed" | "Expired">("All")

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
  const interval = setInterval(() => {
    fetchUsers()
  }, 10000) // refresh every 10 seconds

  return () => clearInterval(interval)
}, [])


  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    
    const accessToken = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : ""

    try {
      const res = await fetch(`${API_BASE}get_users/`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }

      const data = await res.json()
      
      if (Array.isArray(data)) {
        
        // Transform API data to match our component structure
        const transformedUsers: UserType[] = data.map((user: any) => {
        let avatarUrl = user.avatar_url

        if (!avatarUrl) {
          avatarUrl = `https://avatar.vercel.sh/${user.user_email || user.email}`
        } else if (!avatarUrl.startsWith("data:image")) {
          avatarUrl = `${avatarUrl}?t=${Date.now()}`
        }

        return {
          id: user.id,
          user_name: user.user_name || user.full_name || "Unknown User",
          user_email: user.user_email || user.email,
          created_at: user.date_joined,
          city: user.city,
          avatar_url: avatarUrl,
          is_premium: Boolean(user.is_premium),
          subscription_status: user.is_premium
            ? "Subscribed"
            : "Not Subscribed",
        }
      })

        
        setUsers(transformedUsers)
      }
    } catch (err) {
      console.error("Error fetching users:", err)
      setError("Failed to load users. Please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteUserId) return

    const accessToken = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : ""

    try {
      const res = await fetch(`${API_BASE}delete_user/${deleteUserId}/`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!res.ok) {
        throw new Error(`Failed to delete user, status: ${res.status}`)
      }
      
      setDeleteUserId(null)
      setShowSuccessModal(true)
      fetchUsers()
    } catch (err) {
      console.error("Error deleting user:", err)
      setError("Failed to delete user. Please try again.")
      setDeleteUserId(null)
    }
  }

  const formatDate = (timestamp: string) => {
    if (!timestamp) return ""
    const date = new Date(timestamp)
    return date.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  }

  const handleSort = (key: keyof UserType, direction: "asc" | "desc") => {
    setSortConfig({ key, direction })
    setShowSortDropdown(false)
  }

  const filteredUsers = users
    .filter((user) => {
      const matchesSearch = user.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.user_email.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesStatus = statusFilter === "All" || user.subscription_status === statusFilter
      
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      if (!sortConfig.key) return 0

      const aValue = a[sortConfig.key]
      const bValue = b[sortConfig.key]

      if (aValue == null) return 1
      if (bValue == null) return -1

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1
      return 0
    })

  return (
    <div className="p-8 min-h-screen">
      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm">
        {/* Search and Filter Row */}
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users by name or email"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[38px] pl-9 pr-4 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5F7F5A] placeholder:text-sm"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 h-[38px] border border-gray-200 rounded-lg text-sm text-gray-700">
              Subscription
              <Flag className="w-4 h-4 text-yellow-500" fill="currentColor" />
            </div>

            <div className="relative">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="flex items-center gap-2 px-4 h-[38px] border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                {statusFilter === "All" ? "Status" : statusFilter}
                <ChevronDown className="w-4 h-4" />
              </button>
              
              {showStatusDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setStatusFilter("All")
                        setShowStatusDropdown(false)
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
                    >
                      All
                    </button>
                    <button
                      onClick={() => {
                        setStatusFilter("Subscribed")
                        setShowStatusDropdown(false)
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
                    >
                      Subscribed
                    </button>
                    <button
                      onClick={() => {
                        setStatusFilter("Not Subscribed")
                        setShowStatusDropdown(false)
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
                    >
                      Not Subscribed
                    </button>
                    <button
                      onClick={() => {
                        setStatusFilter("Expired")
                        setShowStatusDropdown(false)
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
                    >
                      Expired
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center gap-2 px-4 h-[38px] bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ArrowUpDown className="w-4 h-4" />
                Filter
              </button>
              
              {showSortDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="py-1">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Sort by Name</div>
                    <button
                      onClick={() => handleSort("user_name", "asc")}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
                    >
                      Name: A → Z
                    </button>
                    <button
                      onClick={() => handleSort("user_name", "desc")}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
                    >
                      Name: Z → A
                    </button>
                    
                    <div className="border-t border-gray-100 my-1"></div>
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Sort by Date</div>
                    <button
                      onClick={() => handleSort("created_at", "desc")}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
                    >
                      Date Joined: Newest First
                    </button>
                    <button
                      onClick={() => handleSort("created_at", "asc")}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
                    >
                      Date Joined: Oldest First
                    </button>
                    
                    <div className="border-t border-gray-100 my-1"></div>
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Sort by Status</div>
                    <button
                      onClick={() => handleSort("subscription_status", "asc")}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
                    >
                      Subscription: Subscribed First
                    </button>
                    <button
                      onClick={() => handleSort("subscription_status", "desc")}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
                    >
                      Subscription: Not Subscribed First
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#5F7F5A]" />
            <span className="ml-3 text-gray-600">Loading users...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#2C3E2C] uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#2C3E2C] uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#2C3E2C] uppercase tracking-wider">
                    Subscription Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#2C3E2C] uppercase tracking-wider">
                    Date Joined
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-[#2C3E2C] uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} 
                    className={"bg-[white] hover:bg-[#bcebb5]"}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={user.avatar_url || "/placeholder.svg"}
                          alt={user.user_name}
                          className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                        />
                        <div>
                          <div className="text-sm font-medium text-[#2C3E2C]">{user.user_name}</div>
                          {user.is_premium && (
                            <span className="inline-block mt-0.5 px-2 py-0.5 text-xs bg-[#FFD700]/20 text-[#B8860B] rounded">
                              Premium ⭐
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[#2C3E2C]">{user.user_email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-3 py-1 text-sm rounded-full ${
                          user.subscription_status === "Subscribed"
                            ? "bg-[#C8D9BF] text-[#4A6B45]"
                            : user.subscription_status === "Expired"
                              ? "bg-[#F4E4C1] text-[#8B6F47]"
                              : "bg-[#D9D9D9] text-[#5A5A5A]"
                        }`}
                      >
                        {user.subscription_status || "Not Subscribed"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[#2C3E2C] whitespace-nowrap">{formatDate(user.created_at)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => setDeleteUserId(user.id)}
                          className="p-2 bg-[#E89B8E] hover:bg-[#D88B7E] text-white rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="text-center text-[#2C3E2C] py-8 italic">
                      {searchQuery ? "No users found matching your search." : "No user accounts found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {filteredUsers.length} of {users.length} users
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded transition-colors">
              ← Previous
            </button>
            <button className="w-8 h-8 bg-[#5F7F5A] text-white rounded">1</button>
            <button className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded transition-colors">
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteUserId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[400px] shadow-xl">
            <h3 className="text-lg font-semibold text-[#2C3E2C] mb-2">Confirm Deletion</h3>
            <p className="mb-6 text-gray-600">
              Are you sure you want to delete this user? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteUserId(null)}
                className="px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[350px] shadow-xl text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="mb-6 text-[#2C3E2C] font-medium">User deleted successfully!</p>
            <button
              onClick={() => setShowSuccessModal(false)}
              className="px-6 py-2 bg-[#5F7F5A] hover:bg-[#4F6F4A] text-white rounded-lg transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}