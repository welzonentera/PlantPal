import { useEffect, useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail } from "lucide-react";
import { toast } from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";
import deerBg from "../assets/deer-bg.jpg";
import plantpalTitle from "../assets/plantpal-title.png";
import backgroundBox from "../assets/background.png";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { setAdmin, admin } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const API_BASE = "http://127.0.0.1:8000/api/";

  // Redirect if already logged in
  useEffect(() => {
    if (admin) {
      navigate("/dashboard", { replace: true });
    }
  }, [admin, navigate]);

  // Typed form submission handler
  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}admin_login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Invalid email or password");
        setShowErrorModal(true);
        return;
      }

      const adminData = data.admin;
      const accessToken = data.access;
      const refreshToken = data.refresh;

      if (!adminData || !accessToken || !refreshToken) {
        toast.error("Unexpected server response");
        return;
      }

      setAdmin(adminData, accessToken, refreshToken);
      toast.success(`Welcome ${adminData.user_name || adminData.email}!`);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("⚠️ Login error:", err);
      setErrorMessage("Network error. Please try again.");
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen w-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${deerBg})` }}
      />
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Login Box */}
      <div
        className="relative w-full max-w-md p-8 rounded-2xl shadow-lg backdrop-blur-md border border-gray-200"
        style={{
          backgroundImage: `url(${backgroundBox})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <img
          src={plantpalTitle}
          alt="PlantPal+"
          className="mx-auto w-56 sm:w-60 md:w-72 mb-0"
        />

        <h2 className="text-2xl font-bold text-[#2F4F2F] text-center mb-1">
          Admin Login!
        </h2>
        <p className="text-base text-gray-700 text-center mb-6">
          Sign in to your admin account
        </p>

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Email */}
          <div className="flex items-center bg-[#e1e9d7] rounded-[50px] px-3.5 py-2 w-full mb-4">
            <input
              type="email"
              placeholder="Username or Email"
              className="flex-1 bg-transparent outline-none text-gray-800 placeholder-gray-500 text-base pl-4"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div className="flex-shrink-0 ml-2 w-10 h-10 rounded-full bg-[#faffef] flex items-center justify-center shadow-sm">
              <Mail className="text-gray-600" size={20} />
            </div>
          </div>

          {/* Password */}
          <div className="flex items-center bg-[#e1e9d7] rounded-[50px] px-3.5 py-2 w-full mb-4">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="flex-1 bg-transparent outline-none text-gray-800 placeholder-gray-500 text-base pl-4"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="flex-shrink-0 ml-2 w-10 h-10 rounded-full bg-[#faffef] flex items-center justify-center shadow-sm"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Remember Me */}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-5 h-5 accent-green-600"
            />
            Remember Me
          </label>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-[#3B6E3B] text-white rounded-[20px] py-3 font-semibold hover:bg-[#2E5C2E]"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-80 text-center">
            <h3 className="text-lg font-semibold text-red-600 mb-3">
              Login Failed
            </h3>
            <p className="text-gray-700 mb-4">{errorMessage}</p>

            <button
              onClick={() => setShowErrorModal(false)}
              className="w-full bg-[#3B6E3B] text-white py-2 rounded-lg hover:bg-[#2E5C2E]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
