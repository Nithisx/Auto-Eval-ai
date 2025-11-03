import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ChevronDown, ChevronUp, Award, TrendingUp, Users, CheckCircle, XCircle } from "lucide-react";

const SubjectResult = () => {
  const { classId, sectionId, examId } = useParams();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [expandedStudent, setExpandedStudent] = useState(null);

  useEffect(() => {
    const fetchSubjects = async () => {
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
          throw new Error(data?.message || "Failed to fetch subjects/results");
        setSubjects(data.subjects || data.results || []);
      } catch (err) {
        setError(err.message || "Error fetching subjects/results");
      } finally {
        setLoading(false);
      }
    };

    fetchSubjects();
  }, [sectionId, examId]);

  const fetchSubjectDetail = async (subjectId) => {
    setDetailLoading(true);
    setDetailError("");
    setSelectedDetail(null);
    setExpandedStudent(null);
    try {
      const token =
        localStorage.getItem("token") || localStorage.getItem("Token") || "";
      const res = await fetch(
        `http://localhost:4000/api/results/sections/${sectionId}/exams/${examId}/subjects/${subjectId}`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data?.message || "Failed to fetch subject detail");
      setSelectedDetail(data);
    } catch (err) {
      setDetailError(err.message || "Error fetching subject detail");
    } finally {
      setDetailLoading(false);
    }
  };

  const getScoreColor = (score, maxScore) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 90) return "text-green-600";
    if (percentage >= 75) return "text-blue-600";
    if (percentage >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBgColor = (score, maxScore) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 90) return "bg-green-50 border-green-200";
    if (percentage >= 75) return "bg-blue-50 border-blue-200";
    if (percentage >= 60) return "bg-yellow-50 border-yellow-200";
    return "bg-red-50 border-red-200";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Exam Results</h1>
          <p className="text-gray-600 mt-2">View detailed results by subject</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading results...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        ) : subjects.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg shadow">
            <p className="text-gray-500">No subjects available for this exam</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((s) => (
              <div
                key={s.subject_id || s.id || s._id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
                onClick={() =>
                  fetchSubjectDetail(s.subject_id || s.id || s._id)
                }
              >
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    {s.name || s.subject}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 flex items-center">
                        <Users className="w-4 h-4 mr-2" />
                        Students
                      </span>
                      <span className="font-semibold">{s.student_count ?? s.count ?? "-"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 flex items-center">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Average
                      </span>
                      <span className="font-semibold text-blue-600">{s.average ?? s.avg ?? "-"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 flex items-center">
                        <Award className="w-4 h-4 mr-2" />
                        Top Score
                      </span>
                      <span className="font-semibold text-green-600">{s.top_score ?? "-"}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {detailLoading && (
          <div className="mt-8 flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-3 text-gray-600">Loading details...</p>
            </div>
          </div>
        )}

        {detailError && (
          <div className="mt-8 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{detailError}</p>
          </div>
        )}

        {selectedDetail && (
          <div className="mt-8 space-y-6">
            {/* Statistics Overview */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {selectedDetail.results?.[0]?.subject_name || "Subject"} - {selectedDetail.results?.[0]?.exam_title || "Exam"}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm text-blue-600 mb-1">Total Students</p>
                  <p className="text-2xl font-bold text-blue-900">{selectedDetail.statistics?.total_students || 0}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <p className="text-sm text-green-600 mb-1">Average Score</p>
                  <p className="text-2xl font-bold text-green-900">{selectedDetail.statistics?.average_score || 0}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <p className="text-sm text-purple-600 mb-1">Highest Score</p>
                  <p className="text-2xl font-bold text-purple-900">{selectedDetail.statistics?.highest_score || 0}</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                  <p className="text-sm text-orange-600 mb-1">Lowest Score</p>
                  <p className="text-2xl font-bold text-orange-900">{selectedDetail.statistics?.lowest_score || 0}</p>
                </div>
              </div>
            </div>

            {/* Student Results */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900">Student Results</h3>
              {selectedDetail.results?.map((result) => (
                <div key={result.result_id} className="bg-white rounded-lg shadow overflow-hidden">
                  <div
                    className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedStudent(expandedStudent === result.result_id ? null : result.result_id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4">
                          <h4 className="text-lg font-semibold text-gray-900">{result.student_name}</h4>
                          <span className="text-sm text-gray-500">Roll #{result.roll_number}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{result.student_email}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className={`px-4 py-2 rounded-lg border ${getScoreBgColor(parseFloat(result.total_marks), parseFloat(result.max_total_marks))}`}>
                          <p className={`text-2xl font-bold ${getScoreColor(parseFloat(result.total_marks), parseFloat(result.max_total_marks))}`}>
                            {result.total_marks}/{result.max_total_marks}
                          </p>
                          <p className="text-xs text-gray-600 text-center mt-1">
                            {((parseFloat(result.total_marks) / parseFloat(result.max_total_marks)) * 100).toFixed(1)}%
                          </p>
                        </div>
                        {expandedStudent === result.result_id ? (
                          <ChevronUp className="w-6 h-6 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {expandedStudent === result.result_id && (
                    <div className="border-t border-gray-200 bg-gray-50 p-6">
                      <h5 className="font-semibold text-gray-900 mb-4">Question-by-Question Breakdown</h5>
                      <div className="space-y-3">
                        {result.questions?.map((q) => (
                          <div
                            key={q.question_number}
                            className={`p-4 rounded-lg border ${q.is_correct ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  {q.is_correct ? (
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                  ) : (
                                    <XCircle className="w-5 h-5 text-red-600" />
                                  )}
                                  <span className="font-medium text-gray-700">Question {q.question_number}</span>
                                </div>
                                <p className="text-sm text-gray-900 mb-2">{q.question_text}</p>
                                <p className="text-sm text-gray-700">
                                  <span className="font-medium">Answer:</span> {q.student_answer}
                                </p>
                              </div>
                              <div className={`ml-4 px-3 py-1 rounded-full text-sm font-semibold ${q.is_correct ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {q.marks}/{q.marks === 0 && !q.is_correct ? '1' : q.marks}
                              </div>
                            </div>
                            <div className={`text-sm mt-2 p-2 rounded ${q.is_correct ? 'bg-green-100' : 'bg-red-100'}`}>
                              <span className="font-medium">Feedback:</span> {q.feedback}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubjectResult;