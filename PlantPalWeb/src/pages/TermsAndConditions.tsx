import { useState, useEffect } from "react";
import { Eye, Plus, CheckCircle, X, AlertCircle } from "lucide-react";
import BackgroundImage from "../assets/background.png";

/* ===================== TYPES ===================== */
type VersionType = {
  version: string;
  is_active: boolean;
  effective_date: string;
  content: string;
};

export default function TermsAndConditions() {
  const API_BASE = "http://127.0.0.1:8000/api/";

  const [versions, setVersions] = useState<VersionType[]>([]);
  const [version, setVersion] = useState("");
  const [content, setContent] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [loading, setLoading] = useState(false);

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedVersion, setSelectedVersion] =
    useState<VersionType | null>(null);

  const [showErrorModal, setShowErrorModal] = useState(false);

  /* ===================== FETCH DATA ===================== */
  useEffect(() => {
    fetch(`${API_BASE}get_terms_conditions/`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setVersions(data);
      })
      .catch((err) => console.error("Fetch error:", err));
  }, []);

  /* ===================== HANDLERS ===================== */
  const handleAddNew = () => {
    const confirmAdd = window.confirm(
      "Do you want to add a new Terms & Conditions version?"
    );

    if (!confirmAdd) return;

    setVersion("");
    setContent("");
    setEffectiveDate(new Date().toISOString().split("T")[0]);
    setIsAddingNew(true);
    setShowAddModal(true);
  };

  const handleSave = async () => {
    if (!version.trim() || !content.trim()) {
      alert("Please enter version and content.");
      return;
    }

    const duplicate = versions.some((v) => v.version === version);
    if (duplicate) {
      setShowErrorModal(true);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}add_terms_conditions/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version,
          content,
          effective_date: effectiveDate,
        }),
      });

      if (res.ok) {
        setVersions((prev) => [
          { version, is_active: true, effective_date: effectiveDate, content },
          ...prev.map((v) => ({ ...v, is_active: false })),
        ]);
        setIsAddingNew(false);
        setShowAddModal(false);
        setShowSuccessModal(true);
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (v: VersionType) => {
    setSelectedVersion(v);
    setShowViewModal(true);
  };

  /* ===================== UI ===================== */
  return (
    <div
      className="flex h-screen font-['Poppins'] bg-cover bg-center"
      style={{ backgroundImage: `url(${BackgroundImage})` }}
    >
      <main className="flex-1 bg-white/20 backdrop-blur-md overflow-y-auto p-10">
        {/* ===================== TABLE ===================== */}
        <div className="bg-[#b8d4a8] rounded-2xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-[#2F4F2F]">
              Terms & Conditions Versions
            </h2>

            <button
              onClick={handleAddNew}
              className="flex items-center gap-2 bg-[#C9E4C5] hover:bg-[#a7d4a0] px-5 py-2 rounded-full shadow transition"
            >
              <Plus size={18} /> Add New Version
            </button>
          </div>

          <table className="w-full border-separate border-spacing-y-3">
            <thead>
              <tr className="text-sm uppercase tracking-wide text-[#2F4F2F]">
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Effective Date</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>

            <tbody>
              {versions.map((v, index) => (
                <tr
                  key={index}
                  className={`
                    rounded-xl shadow-sm transition hover:shadow-md
                    ${
                      v.is_active
                        ? "bg-green-50 border-l-4 border-green-500"
                        : "bg-white/80 hover:bg-[#eaf5e6]"
                    }
                  `}
                >
                  <td className="px-4 py-4 font-semibold">{v.version}</td>

                  <td className="px-4 py-4">
                    <span
                      className={`px-3 py-1 text-xs font-semibold rounded-full
                        ${
                          v.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-200 text-gray-600"
                        }
                      `}
                    >
                      {v.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>

                  <td className="px-4 py-4">{v.effective_date}</td>

                  <td className="px-4 py-4 text-center">
                    <button
                      onClick={() => handleView(v)}
                      className="flex items-center justify-center gap-2 mx-auto bg-[#C9E4C5] hover:bg-[#a7d4a0] px-4 py-2 rounded-full shadow transition"
                    >
                      <Eye size={18} /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ===================== ADD MODAL ===================== */}
        {isAddingNew && showAddModal && (
          <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-[600px] shadow-lg">
              <h3 className="text-xl font-bold text-[#2F4F2F] mb-5">
                Add New Version
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <input
                  placeholder="Version (e.g. v2.0)"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="p-2 border rounded"
                />
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="p-2 border rounded"
                />
              </div>

              <textarea
                rows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter Terms & Conditions..."
                className="w-full mt-4 p-3 border rounded resize-none"
              />

              <div className="flex justify-end gap-4 mt-6">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-full"
                >
                  {loading ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="bg-gray-300 px-5 py-2 rounded-full"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== SUCCESS MODAL ===================== */}
        {showSuccessModal && (
          <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-2xl shadow-lg text-center">
              <CheckCircle size={48} className="text-green-600 mx-auto mb-3" />
              <p className="font-semibold text-[#2F4F2F]">
                Successfully Added!
              </p>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="mt-4 bg-green-500 text-white px-6 py-2 rounded-full"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* ===================== VIEW MODAL ===================== */}
        {showViewModal && selectedVersion && (
          <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-2xl w-[600px] max-h-[80vh] overflow-y-auto shadow-lg relative">
              <button
                onClick={() => setShowViewModal(false)}
                className="absolute top-3 right-3"
              >
                <X />
              </button>

              <h3 className="text-xl font-bold mb-2">
                {selectedVersion.version}
              </h3>
              <p className="text-sm mb-4">
                Effective Date: {selectedVersion.effective_date}
              </p>
              <div className="bg-gray-100 p-4 rounded whitespace-pre-wrap">
                {selectedVersion.content}
              </div>
            </div>
          </div>
        )}

        {/* ===================== ERROR MODAL ===================== */}
        {showErrorModal && (
          <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-2xl shadow-lg text-center">
              <AlertCircle size={48} className="text-red-600 mx-auto mb-3" />
              <p className="font-semibold text-red-700">
                Duplicate Version Detected
              </p>
              <button
                onClick={() => setShowErrorModal(false)}
                className="mt-4 bg-red-500 text-white px-6 py-2 rounded-full"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
