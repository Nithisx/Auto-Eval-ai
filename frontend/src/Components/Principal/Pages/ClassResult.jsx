import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const ClassResult = () => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchClasses = async () => {
      setLoading(true);
      setError("");
      try {
        const token =
          localStorage.getItem("token") || localStorage.getItem("Token") || "";
        const res = await fetch(`http://localhost:4000/api/classes`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const data = await res.json();
        if (!res.ok)
          throw new Error(data?.message || "Failed to fetch classes");
        setClasses(data.classes || []);
      } catch (err) {
        setError(err.message || "Error fetching classes");
      } finally {
        setLoading(false);
      }
    };

    fetchClasses();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8 pb-6 border-b border-gray-200">
          <h1 className="text-2xl font-semibold text-gray-900">Classes</h1>
          <p className="text-sm text-gray-600 mt-1">
            Select a class to view sections and results
          </p>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-gray-300 border-t-gray-900 mb-3"></div>
            <p className="text-sm text-gray-600">Loading classes...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        ) : classes.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-600">No classes available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {classes.map((cls) => (
              <div
                key={cls.class_id}
                className="border border-gray-200 rounded-lg p-5 cursor-pointer hover:border-gray-400 hover:shadow-sm transition-all bg-white"
                onClick={() =>
                  navigate(`/principal/sectionresult/${cls.class_id}`)
                }
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">
                      {cls.name}
                    </h3>
                    <p className="text-sm text-gray-500">Grade: {cls.grade}</p>
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassResult;
