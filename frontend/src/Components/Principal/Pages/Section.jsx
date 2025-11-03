import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const Section = () => {
  const { classId } = useParams();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const fetchSections = async () => {
      setLoading(true);
      setError("");
      try {
        const token =
          localStorage.getItem("token") || localStorage.getItem("Token") || "";
        const res = await fetch(
          `http://localhost:4000/api/classes/${classId}/sections`,
          {
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );

        const data = await res.json();
        if (!res.ok)
          throw new Error(data?.message || "Failed to fetch sections");
        setSections(data.sections || []);
      } catch (err) {
        setError(err.message || "Error fetching sections");
      } finally {
        setLoading(false);
      }
    };

    fetchSections();
  }, [classId]);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Simple Header */}
        <div className="mb-8 pb-6 border-b border-gray-200">
          <h1 className="text-2xl font-semibold text-gray-900">Sections</h1>
          <p className="text-sm text-gray-600 mt-1">Select a section to view students and manage exams</p>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-gray-300 border-t-gray-900 mb-3"></div>
            <p className="text-sm text-gray-600">Loading sections...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        ) : sections.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-600">No sections available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sections.map((section) => (
              <div
                key={section.section_id}
                className="border border-gray-200 rounded-lg p-5 cursor-pointer hover:border-gray-400 hover:shadow-sm transition-all bg-white"
                onClick={() =>
                  navigate(`/principal/students/${section.section_id}`)
                }
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">
                      {section.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Created {new Date(section.created_at).toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Section;