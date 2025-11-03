import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const SectionResult = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8 pb-6 border-b border-gray-200">
          <h1 className="text-2xl font-semibold text-gray-900">Sections</h1>
          <p className="text-sm text-gray-600 mt-1">
            Select a section to view exams
          </p>
        </div>

        {loading ? (
          <div className="py-16 text-center">Loading sections...</div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        ) : sections.length === 0 ? (
          <div className="text-center py-16">
            No sections available for this class
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {sections.map((sec) => (
              <div
                key={sec.section_id}
                className="p-4 border rounded-md hover:shadow-sm cursor-pointer flex justify-between items-center"
                onClick={() =>
                  navigate(`/principal/examresult/${classId}/${sec.section_id}`)
                }
              >
                <div>
                  <h3 className="font-medium text-gray-900">{sec.name}</h3>
                  
                </div>
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SectionResult;
