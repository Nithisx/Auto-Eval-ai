import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const ExamResult = () => {
  const { classId, sectionId } = useParams();
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchExams = async () => {
      setLoading(true);
      setError("");
      try {
        const token =
          localStorage.getItem("token") || localStorage.getItem("Token") || "";
        const res = await fetch(
          `http://localhost:4000/api/sections/${sectionId}/exams`,
          {
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to fetch exams");
        setExams(data.exams || []);
      } catch (err) {
        setError(err.message || "Error fetching exams");
      } finally {
        setLoading(false);
      }
    };

    fetchExams();
  }, [sectionId]);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8 pb-6 border-b border-gray-200">
          <h1 className="text-2xl font-semibold text-gray-900">Exams</h1>
          <p className="text-sm text-gray-600 mt-1">
            Select an exam to view subjects and results
          </p>
        </div>

        {loading ? (
          <div className="py-16 text-center">Loading exams...</div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        ) : exams.length === 0 ? (
          <div className="text-center py-16">
            No exams available for this section
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {exams.map((examItem) => {
              // backend may return items as { exam: {...}, subjects: [...] }
              const examObj = examItem?.exam ? examItem.exam : examItem;
              const examId = examObj?.exam_id || examObj?.id || examObj?.examId;
              const title = examObj?.title || examObj?.name || "Untitled Exam";
              // show date range if available, fallback to examObj.date
              const dateDisplay = examObj?.start_time
                ? `${new Date(
                    examObj.start_time
                  ).toLocaleString()} - ${new Date(
                    examObj.end_time || examObj.start_time
                  ).toLocaleString()}`
                : examObj?.date || "";
              const subjectsCount =
                examItem?.subjects?.length ?? examObj?.subjects?.length ?? 0;

              return (
                <div
                  key={examId || title}
                  className="p-4 border rounded-md hover:shadow-sm cursor-pointer flex justify-between items-center"
                  onClick={() =>
                    navigate(
                      `/principal/subjectresult/${classId}/${sectionId}/${examId}`
                    )
                  }
                >
                  <div>
                    <h3 className="font-medium text-gray-900">{title}</h3>
                    <p className="text-sm text-gray-500">{dateDisplay}</p>
                    {subjectsCount > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        {subjectsCount}{" "}
                        {subjectsCount === 1 ? "subject" : "subjects"}
                      </p>
                    )}
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamResult;
