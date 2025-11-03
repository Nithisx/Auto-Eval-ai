import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Manage = () => {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [sectionsInput, setSectionsInput] = useState("A,B,C");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [classes, setClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [classesError, setClassesError] = useState("");

  const navigate = useNavigate();

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const token =
        localStorage.getItem("token") || localStorage.getItem("Token") || "";
      const body = {
        name,
        grade: Number(grade),
        sections: sectionsInput
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };

      const res = await fetch("http://localhost:4000/api/classes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Create class failed");

      setResult(data);
      await fetchClasses();
      setShowForm(false);
      setName("");
      setGrade("");
      setSectionsInput("A,B,C");
    } catch (err) {
      setError(err.message || "Error creating class");
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    setClassesError("");
    setClassesLoading(true);
    try {
      const token =
        localStorage.getItem("token") || localStorage.getItem("Token") || "";
      const res = await fetch("http://localhost:4000/api/classes", {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to fetch classes");
      setClasses(data.classes || []);
    } catch (err) {
      setClassesError(err.message || "Error fetching classes");
    } finally {
      setClassesLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 pb-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Class Management</h1>
              <p className="text-sm text-gray-600 mt-1">Create and manage academic classes</p>
            </div>
            <button
              className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              onClick={() => setShowForm((s) => !s)}
            >
              {showForm ? "Cancel" : "Create New Class"}
            </button>
          </div>
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="mb-8 border border-gray-200 rounded-lg p-6 bg-gray-50">
            <h2 className="text-lg font-medium text-gray-900 mb-4">New Class Details</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Class Name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="e.g., Mathematics Advanced"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Grade Level
                  </label>
                  <input
                    type="number"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    required
                    placeholder="e.g., 10"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Sections
                </label>
                <input
                  value={sectionsInput}
                  onChange={(e) => setSectionsInput(e.target.value)}
                  placeholder="e.g., A,B,C"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1.5">Enter section names separated by commas</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Creating Class..." : "Create Class"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Classes List */}
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-medium text-gray-900">All Classes</h2>
            <p className="text-sm text-gray-600 mt-0.5">Click on a class to view sections</p>
          </div>

          {classesLoading ? (
            <div className="py-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 mb-2"></div>
              <p className="text-sm text-gray-600">Loading classes...</p>
            </div>
          ) : classesError ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {classesError}
            </div>
          ) : classes.length === 0 ? (
            <div className="text-center py-12 border border-gray-200 rounded-lg">
              <p className="text-gray-600">No classes available</p>
              <p className="text-sm text-gray-500 mt-1">Create your first class to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {classes.map((c) => (
                <div
                  key={c.class_id}
                  className="border border-gray-200 rounded-lg p-5 cursor-pointer hover:border-gray-400 hover:shadow-sm transition-all bg-white"
                  onClick={() => navigate(`/principal/sections/${c.class_id}`)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-base font-medium text-gray-900 mb-1">
                        {c.name}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>Grade {c.grade}</span>
                        <span className="text-gray-400">•</span>
                        <span>{new Date(c.created_at).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}</span>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>

                  {Array.isArray(c.sections) && c.sections.length > 0 && (
                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-700 mb-2">Sections</p>
                      <div className="flex flex-wrap gap-2">
                        {c.sections.map((s) => (
                          <span
                            key={s.section_id}
                            className="px-2.5 py-1 bg-gray-100 border border-gray-200 rounded text-xs font-medium text-gray-700"
                          >
                            {s.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Manage;