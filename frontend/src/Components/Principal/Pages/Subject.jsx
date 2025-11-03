import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  X,
  Upload,
  Eye,
  Settings,
  FileText,
  CheckCircle,
  Search,
  AlertTriangle,
  Copy,
  AlertCircle,
  Trash2,
} from "lucide-react";

export default function Subject() {
  const { sectionId, examId, subjectId } = useParams();

  const [totalMarks, setTotalMarks] = useState(100);
  const [uploadFormat, setUploadFormat] = useState("OMR Upload");
  const [uploadImage, setUploadImage] = useState(null);
  const [questions, setQuestions] = useState([
    {
      question_number: 1,
      question_text: "",
      max_marks: 0,
      ideal_answer: "",
      rubrics: "",
    },
  ]);
  const [teacherAnswers, setTeacherAnswers] = useState([]);
  const [selectedAnswerId, setSelectedAnswerId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [userNames, setUserNames] = useState({}); // Cache for user names

  // Function to fetch user name by ID
  const fetchUserName = async (userId) => {
    if (!userId || userNames[userId]) return userNames[userId] || userId;

    try {
      const token =
        localStorage.getItem("token") || localStorage.getItem("Token") || "";
      const res = await fetch(`http://localhost:4000/api/auth/user/${userId}`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.ok) {
        const userData = await res.json();
        const userName =
          userData.full_name || userData.name || userData.email || userId;
        setUserNames((prev) => ({ ...prev, [userId]: userName }));
        return userName;
      }
    } catch (err) {
      console.error("Error fetching user name:", err);
    }

    return userId; // Fallback to UUID if fetch fails
  };

  // Function to get display name (cached or fetch)
  const getDisplayName = (userId) => {
    return userNames[userId] || userId;
  };

  // Fetch existing rubrics
  useEffect(() => {
    const fetchExistingRubrics = async () => {
      setLoading(true);
      setError("");
      try {
        const token =
          localStorage.getItem("token") || localStorage.getItem("Token") || "";

        const res = await fetch(
          `http://localhost:4000/api/teacheranswers/sections/${sectionId}/exams/${examId}/subjects/${subjectId}/teacher-answers`,
          {
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );

        console.log("Fetch rubrics response status:", res.status); // Debug log

        let data;
        const contentType = res.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
          data = await res.json();
        } else {
          const text = await res.text();
          console.log("Fetch rubrics non-JSON response:", text); // Debug log
          throw new Error(
            `Server returned non-JSON response. Status: ${res.status}. Check if backend is running and endpoint exists.`
          );
        }

        if (!res.ok)
          throw new Error(data?.message || "Failed to fetch rubrics");

        const list = Array.isArray(data.teacher_answers)
          ? data.teacher_answers
          : data.teacher_answer
          ? [data.teacher_answer]
          : [];

        setTeacherAnswers(list);

        // Fetch user names for all uploaders
        const uniqueUploaderIds = [
          ...new Set(list.map((item) => item.uploader_id).filter(Boolean)),
        ];
        uniqueUploaderIds.forEach((userId) => {
          fetchUserName(userId);
        });

        if (list.length > 0) {
          const sorted = [...list].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
          );
          setSelectedAnswerId(sorted[0].teacher_answer_id);
          const latest = sorted[0].answers || {};
          setTotalMarks(latest.total_marks ?? 100);
          setQuestions(
            latest.questions && latest.questions.length > 0
              ? latest.questions
              : questions
          );
        }
      } catch (err) {
        setError(err.message || "Error fetching rubrics");
      } finally {
        setLoading(false);
      }
    };

    fetchExistingRubrics();
  }, [sectionId, examId, subjectId]);

  // Filtering and sorting
  const filteredAndSorted = useMemo(() => {
    let arr = [...teacherAnswers];
    if (query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter((t) => {
        const uploaderName = getDisplayName(t.uploader_id).toLowerCase();
        const p = [uploaderName, t.teacher_answer_id, t.total_marks?.toString()]
          .join(" ")
          .toLowerCase();
        const q0 =
          t.answers?.questions?.[0]?.question_text?.toLowerCase() || "";
        return p.includes(q) || q0.includes(q);
      });
    }

    if (sortBy === "newest")
      arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (sortBy === "oldest")
      arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    if (sortBy === "marks-desc")
      arr.sort((a, b) => (b.total_marks || 0) - (a.total_marks || 0));
    if (sortBy === "marks-asc")
      arr.sort((a, b) => (a.total_marks || 0) - (b.total_marks || 0));

    return arr;
  }, [teacherAnswers, query, sortBy, userNames]);

  // Handlers
  const handleAddQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        question_number: prev.length + 1,
        question_text: "",
        max_marks: 0,
        ideal_answer: "",
        rubrics: "",
      },
    ]);
  };

  const handleRemoveQuestion = (index) => {
    setQuestions((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((q, i) => ({ ...q, question_number: i + 1 }));
    });
  };

  const handleQuestionChange = (index, field, value) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  };

  const handleUploadRubrics = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const token =
        localStorage.getItem("token") || localStorage.getItem("Token") || "";

      const payload = {
        exam_id: examId,
        subject_id: subjectId,
        section_id: sectionId,
        total_marks: totalMarks,
        questions,
      };

      console.log("Sending payload:", payload); // Debug log
      console.log(
        "Token being used:",
        token ? `${token.substring(0, 20)}...` : "NO TOKEN"
      ); // Debug log
      console.log(
        "URL:",
        `http://localhost:4000/api/teacheranswers/sections/${sectionId}/exams/${examId}/subjects/${subjectId}/teacher-answers`
      ); // Debug log

      const res = await fetch(
        `http://localhost:4000/api/teacheranswers/sections/${sectionId}/exams/${examId}/subjects/${subjectId}/teacher-answers`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        }
      );

      console.log("Response status:", res.status); // Debug log
      console.log(
        "Response headers:",
        Object.fromEntries(res.headers.entries())
      ); // Debug log
      console.log("Response Content-Type:", res.headers.get("content-type")); // Debug log

      let data;
      const contentType = res.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        // If response is not JSON (like HTML error page), get text
        const text = await res.text();
        console.log("Non-JSON response:", text); // Debug log
        throw new Error(
          `Server returned non-JSON response. Status: ${res.status}. Check if backend is running and endpoint exists.`
        );
      }

      console.log("Response data:", data); // Debug log

      if (!res.ok) throw new Error(data?.message || "Failed to upload rubrics");

      const newAnswer = data.teacher_answer || data;
      setTeacherAnswers((prev) => [newAnswer, ...prev]);
      setSelectedAnswerId(newAnswer.teacher_answer_id);
      setShowUpload(false);
    } catch (err) {
      console.error("Upload error:", err); // Debug log
      setError(err.message || "Error uploading rubrics");
    } finally {
      setLoading(false);
    }
  };

  const pickTeacherAnswer = (id) => {
    setSelectedAnswerId(id);
    const item = teacherAnswers.find((t) => t.teacher_answer_id === id);
    if (item && item.answers) {
      const ans = item.answers;
      setTotalMarks(ans.total_marks ?? 100);
      setQuestions(
        ans.questions && ans.questions.length > 0 ? ans.questions : []
      );
    }
  };

  const copyJSON = (obj) => {
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    alert("Copied to clipboard");
  };

  const formatDate = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  };

  // Handler for format buttons
  const handleFormatButtonClick = (format) => {
    setUploadFormat(format);
    setShowUpload(true);
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    setUploadImage(file);
  };

  const handleEvaluate = async () => {
    const token =
      localStorage.getItem("token") || localStorage.getItem("Token") || "";

    const payload = {
      section_id: sectionId,
      exam_id: examId,
      subject_id: subjectId,
      backend_url: "http://localhost:4000",
    };

    try {
      setLoading(true);
      setError("");

      const res = await fetch("http://localhost:8000/eval", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Evaluation failed");

      alert("Evaluation successful!");
      console.log("Evaluation results:", data);
    } catch (err) {
      console.error("Evaluation error:", err);
      setError(err.message || "Error during evaluation");
      alert(err.message || "Error during evaluation");
    } finally {
      setLoading(false);
    }
  };

  // Enhanced format button click to also support answer upload
  const handleFormatButtonClickWithUpload = (format) => {
    if (format === "Upload Answer Sheets") {
      setShowAnswerUpload(true);
    } else {
      setUploadFormat(format);
      setShowUpload(true);
    }
  };

  // Helper for rendering selected rubric
  const renderSelectedRubric = () => {
    const item = teacherAnswers.find(
      (t) => t.teacher_answer_id === selectedAnswerId
    );
    if (!item) {
      return (
        <div className="text-gray-500 text-sm mt-3">
          Selected rubric not found.
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Display Upload Format and Image */}
        {(item.upload_format || item.upload_image_url) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-3">
              Upload Information
            </h4>
            <div className="space-y-3">
              {item.upload_format && (
                <div>
                  <span className="text-xs font-medium text-blue-700 uppercase tracking-wider">
                    Format:
                  </span>
                  <div className="text-sm text-blue-900 mt-1">
                    {item.upload_format}
                  </div>
                </div>
              )}
              {item.upload_image_url && (
                <div>
                  <span className="text-xs font-medium text-blue-700 uppercase tracking-wider">
                    Question Layout Image:
                  </span>
                  <div className="mt-2">
                    <img
                      src={item.upload_image_url}
                      alt="Question Layout"
                      className="max-w-full h-auto max-h-64 rounded-lg border border-gray-300 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() =>
                        window.open(item.upload_image_url, "_blank")
                      }
                    />
                    <p className="text-xs text-blue-600 mt-1">
                      Click image to view full size
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Display Files if any */}
        {item.files && item.files.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-green-800 mb-3">
              Uploaded Files
            </h4>
            <div className="space-y-2">
              {item.files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-white p-3 rounded-lg border border-green-200"
                >
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 text-green-600 mr-2" />
                    <span className="text-sm text-gray-700">
                      {file.name || `File ${index + 1}`}
                    </span>
                    {file.size && (
                      <span className="text-xs text-gray-500 ml-2">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    )}
                  </div>
                  {file.url && (
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:text-green-800 text-sm font-medium"
                    >
                      Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Question Breakdown</h3>
            <button
              onClick={() => copyJSON(item.answers)}
              className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 px-3 py-1.5 rounded-md border border-gray-300 hover:border-gray-400 transition-colors"
            >
              <Copy size={14} />
              Copy JSON
            </button>
          </div>

          <div className="divide-y divide-gray-200">
            {item.answers?.questions?.length ? (
              item.answers.questions.map((q, i) => (
                <div
                  key={i}
                  className="px-6 py-5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="font-semibold text-gray-900">
                      Question {i + 1}: {q.question_text || "(no text)"}
                    </div>
                    <div className="text-sm font-semibold text-gray-900 bg-gray-100 px-3 py-1 rounded-full">
                      {q.max_marks} marks
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="text-gray-700">
                      <span className="font-medium text-gray-900">
                        Ideal Answer:
                      </span>{" "}
                      {q.ideal_answer || "—"}
                    </div>
                    <div className="text-gray-700">
                      <span className="font-medium text-gray-900">
                        Rubrics:
                      </span>{" "}
                      {q.rubrics || "—"}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-gray-500">
                No questions available.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // UI Starts
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="text-gray-700" size={32} />
              Teacher Rubrics
            </h1>
            <p className="text-gray-600 mt-1">
              Manage and evaluate examination rubrics
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleEvaluate}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium shadow-sm"
            >
              <CheckCircle size={18} />
              Evaluate
            </button>
            <button
              onClick={() => handleFormatButtonClick("OMR Upload")}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium shadow-sm"
            >
              <Upload size={18} />
              OMR Upload
            </button>
            <button
              onClick={() => handleFormatButtonClick("Structured Format")}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors font-medium shadow-sm"
            >
              <FileText size={18} />
              Structured Format
            </button>
            <button
              onClick={() => handleFormatButtonClick("Unstructured Format")}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-500 text-white rounded-lg hover:bg-gray-400 transition-colors font-medium shadow-sm"
            >
              <Search size={18} />
              Unstructured Format
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  placeholder="Search rubrics..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
                />
              </div>

              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-2">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="marks-desc">Highest Marks</option>
                  <option value="marks-asc">Lowest Marks</option>
                </select>
              </div>
            </div>

            <div className="p-4 space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
              {loading ? (
                <div className="text-sm text-gray-500 text-center py-8">
                  Loading rubrics...
                </div>
              ) : filteredAndSorted.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-8">
                  No rubrics found.
                </div>
              ) : (
                filteredAndSorted.map((t) => (
                  <div
                    key={t.teacher_answer_id}
                    onClick={() => pickTeacherAnswer(t.teacher_answer_id)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      t.teacher_answer_id === selectedAnswerId
                        ? "border-gray-900 bg-gray-900 text-white shadow-md"
                        : "border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300"
                    }`}
                  >
                    <div
                      className={`text-sm font-semibold mb-1 ${
                        t.teacher_answer_id === selectedAnswerId
                          ? "text-white"
                          : "text-gray-900"
                      }`}
                    >
                      {getDisplayName(t.uploader_id)}
                    </div>
                    <div
                      className={`text-xs mb-2 ${
                        t.teacher_answer_id === selectedAnswerId
                          ? "text-gray-300"
                          : "text-gray-500"
                      }`}
                    >
                      ID: {t.teacher_answer_id}
                    </div>

                    {/* Show upload format */}
                    {t.upload_format && (
                      <div
                        className={`text-xs mb-1 ${
                          t.teacher_answer_id === selectedAnswerId
                            ? "text-gray-200"
                            : "text-gray-600"
                        }`}
                      >
                        Format: {t.upload_format}
                      </div>
                    )}

                    {/* Show if has image */}
                    {t.upload_image_url && (
                      <div
                        className={`text-xs mb-1 flex items-center ${
                          t.teacher_answer_id === selectedAnswerId
                            ? "text-gray-200"
                            : "text-gray-600"
                        }`}
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Has layout image
                      </div>
                    )}

                    {/* Show file count */}
                    {t.files && t.files.length > 0 && (
                      <div
                        className={`text-xs mb-1 flex items-center ${
                          t.teacher_answer_id === selectedAnswerId
                            ? "text-gray-200"
                            : "text-gray-600"
                        }`}
                      >
                        <Upload className="w-3 h-3 mr-1" />
                        {t.files.length} file(s)
                      </div>
                    )}

                    <div
                      className={`text-xs line-clamp-2 mb-2 ${
                        t.teacher_answer_id === selectedAnswerId
                          ? "text-gray-200"
                          : "text-gray-600"
                      }`}
                    >
                      {t.answers?.questions?.[0]?.question_text ??
                        "No question preview"}
                    </div>
                    <div
                      className={`flex justify-between items-center text-xs ${
                        t.teacher_answer_id === selectedAnswerId
                          ? "text-gray-300"
                          : "text-gray-500"
                      }`}
                    >
                      <span>
                        Marks:{" "}
                        <strong
                          className={
                            t.teacher_answer_id === selectedAnswerId
                              ? "text-white"
                              : "text-gray-900"
                          }
                        >
                          {t.total_marks ?? 0}
                        </strong>
                      </span>
                      <span>{formatDate(t.created_at)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-5 border-b border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Rubric Details
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      View detailed rubric information
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Selected ID
                    </div>
                    <div className="text-sm font-semibold text-gray-900 mt-1">
                      {selectedAnswerId ?? "—"}
                    </div>
                    <div className="text-xs text-gray-600 mt-2">
                      Total:{" "}
                      <span className="font-semibold text-gray-900">
                        {totalMarks} marks
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {!selectedAnswerId ? (
                  <div className="text-center py-12 text-gray-500">
                    <FileText
                      size={48}
                      className="mx-auto mb-4 text-gray-300"
                    />
                    <p className="text-sm">No rubric selected</p>
                    <p className="text-xs mt-1">
                      Select a rubric from the sidebar or upload a new one
                    </p>
                  </div>
                ) : (
                  renderSelectedRubric()
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {uploadFormat}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Add new examination rubrics using {uploadFormat.toLowerCase()}{" "}
                  method
                </p>
              </div>
              <button
                onClick={() => setShowUpload(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form
              onSubmit={handleUploadRubrics}
              className="overflow-y-auto max-h-[calc(90vh-140px)]"
            >
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Total Marks
                    </label>
                    <input
                      type="number"
                      value={totalMarks}
                      onChange={(e) => setTotalMarks(Number(e.target.value))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Question Layout
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
                    />
                    {uploadImage && (
                      <p className="mt-2 text-sm text-gray-600">
                        Selected: {uploadImage.name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-700">
                      Upload Format: {uploadFormat}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    This form is configured for {uploadFormat.toLowerCase()}{" "}
                    method.
                  </p>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-900">
                      Questions
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddQuestion}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <Plus size={16} />
                      Add Question
                    </button>
                  </div>

                  <div className="space-y-4">
                    {questions.map((q, i) => (
                      <div
                        key={i}
                        className="border border-gray-200 rounded-lg p-5 bg-gray-50 hover:border-gray-300 transition-colors"
                      >
                        <div className="flex justify-between items-center mb-4">
                          <h5 className="font-semibold text-gray-900">
                            Question {i + 1}
                          </h5>
                          {questions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveQuestion(i)}
                              className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 px-3 py-1.5 rounded-md border border-red-200 hover:border-red-300 transition-colors"
                            >
                              <Trash2 size={14} />
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Question Text
                            </label>
                            <textarea
                              placeholder="Enter question text..."
                              value={q.question_text}
                              onChange={(e) =>
                                handleQuestionChange(
                                  i,
                                  "question_text",
                                  e.target.value
                                )
                              }
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
                              rows={2}
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Maximum Marks
                            </label>
                            <input
                              type="number"
                              placeholder="0"
                              value={q.max_marks}
                              onChange={(e) =>
                                handleQuestionChange(
                                  i,
                                  "max_marks",
                                  Number(e.target.value)
                                )
                              }
                              className="w-32 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Ideal Answer
                            </label>
                            <textarea
                              placeholder="Enter ideal answer..."
                              value={q.ideal_answer}
                              onChange={(e) =>
                                handleQuestionChange(
                                  i,
                                  "ideal_answer",
                                  e.target.value
                                )
                              }
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
                              rows={3}
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Rubrics
                            </label>
                            <textarea
                              placeholder="Enter marking rubrics..."
                              value={q.rubrics}
                              onChange={(e) =>
                                handleQuestionChange(
                                  i,
                                  "rubrics",
                                  e.target.value
                                )
                              }
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
                              rows={3}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Upload size={16} />
                  {loading ? "Uploading..." : `Upload ${uploadFormat}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
