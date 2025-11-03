import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const Exam = () => {
  const { sectionId, examId } = useParams();
  const [examDetails, setExamDetails] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchExamDetails = async () => {
      setLoading(true);
      setError("");
      try {
        const token =
          localStorage.getItem("token") || localStorage.getItem("Token") || "";
        const res = await fetch(
          `http://localhost:4000/api/exams/subjects/${examId}`,
          {
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );

        const data = await res.json();
        if (!res.ok)
          throw new Error(data?.message || "Failed to fetch exam details");

        setExamDetails(data.exam);
        setSubjects(data.subjects || []);
      } catch (err) {
        setError(err.message || "Error fetching exam details");
      } finally {
        setLoading(false);
      }
    };

    fetchExamDetails();
  }, [examId]);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md mt-8">
      {loading ? (
        <div className="text-center text-gray-600 text-sm py-12">Loading exam details...</div>
      ) : error ? (
        <div className="bg-red-100 text-red-700 p-4 rounded-md text-center">{error}</div>
      ) : examDetails ? (
        <>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-4">{examDetails.title}</h1>
          <p className="text-gray-700 mb-6 leading-relaxed">{examDetails.description}</p>
          <p className="text-sm text-gray-500 mb-8 font-semibold">
            Schedule:{" "}
            <time dateTime={examDetails.start_time} className="underline">
              {new Date(examDetails.start_time).toLocaleString()}
            </time>{" "}
            -{" "}
            <time dateTime={examDetails.end_time} className="underline">
              {new Date(examDetails.end_time).toLocaleString()}
            </time>
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mb-4">Subjects</h2>
          {subjects.length === 0 ? (
            <p className="text-gray-500 italic">No subjects available.</p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {subjects.map((subject) => (
                <li
                  key={subject.subject_id}
                  onClick={() =>
                    navigate(`/principal/subject/${sectionId}/${examId}/${subject.subject_id}`)
                  }
                  className="cursor-pointer rounded-lg border border-gray-200 p-4 hover:border-indigo-500 hover:bg-indigo-50 transition-shadow shadow-sm hover:shadow-md"
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      navigate(`/principal/subject/${sectionId}/${examId}/${subject.subject_id}`);
                    }
                  }}
                >
                  <h3 className="text-lg font-medium text-indigo-700">{subject.name}</h3>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="text-center text-gray-400 py-12">No exam data available.</div>
      )}
    </div>
  );
};

export default Exam;
