import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const Students = () => {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [newStudentFields, setNewStudentFields] = useState([
    { email: "", password: "", full_name: "", roll_number: "" },
  ]);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  const [exams, setExams] = useState([]);
  const [examsLoading, setExamsLoading] = useState(false);
  const [examsError, setExamsError] = useState("");

  const [showExamForm, setShowExamForm] = useState(false);
  const [newExam, setNewExam] = useState({
    title: "",
    description: "",
    start_time: "",
    end_time: "",
    subjects: "",
  });
  const [createExamLoading, setCreateExamLoading] = useState(false);
  const [createExamError, setCreateExamError] = useState("");
  
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);

  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      setError("");
      try {
        const token =
          localStorage.getItem("token") || localStorage.getItem("Token") || "";
        const res = await fetch(
          `http://localhost:4000/api/sections/${sectionId}/students`,
          {
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );

        const data = await res.json();
        if (!res.ok)
          throw new Error(data?.message || "Failed to fetch students");
        setStudents(data.students || []);
      } catch (err) {
        setError(err.message || "Error fetching students");
      } finally {
        setLoading(false);
      }
    };

    const fetchExams = async () => {
      setExamsLoading(true);
      setExamsError("");
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
        setExamsError(err.message || "Error fetching exams");
      } finally {
        setExamsLoading(false);
      }
    };

    fetchStudents();
    fetchExams();
  }, [sectionId]);

  const handleAddStudentField = () => {
    setNewStudentFields((prev) => [
      ...prev,
      { email: "", password: "", full_name: "", roll_number: "" },
    ]);
  };

  const handleFieldChange = (index, field, value) => {
    setNewStudentFields((prev) => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  };

  const handleCreateStudents = async (e) => {
    e.preventDefault();
    setCreateError("");
    setCreateLoading(true);
    try {
      const token =
        localStorage.getItem("token") || localStorage.getItem("Token") || "";

      const res = await fetch(
        `http://localhost:4000/api/sections/${sectionId}/students`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ students: newStudentFields }),
        }
      );

      const data = await res.json();
      if (!res.ok)
        throw new Error(data?.message || "Failed to create students");

      setStudents((prev) => [...prev, ...(data.created || [])]);
      setShowForm(false);
      setNewStudentFields([
        { email: "", password: "", full_name: "", roll_number: "" },
      ]);
    } catch (err) {
      setCreateError(err.message || "Error creating students");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCreateExam = async (e) => {
    e.preventDefault();
    setCreateExamError("");
    setCreateExamLoading(true);
    try {
      const token =
        localStorage.getItem("token") || localStorage.getItem("Token") || "";

      const res = await fetch(
        `http://localhost:4000/api/sections/${sectionId}/exams`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            ...newExam,
            subjects: newExam.subjects.split(",").map((s) => s.trim()),
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to create exam");

      setExams((prev) => [...prev, data.exam]);
      setShowExamForm(false);
      setNewExam({
        title: "",
        description: "",
        start_time: "",
        end_time: "",
        subjects: "",
      });
    } catch (err) {
      setCreateExamError(err.message || "Error creating exam");
    } finally {
      setCreateExamLoading(false);
    }
  };

  const handleNavigateToStudent = (student, examId, subjectId) => {
    if (!examId || !subjectId) {
      alert("Please select an exam and subject first!");
      return;
    }
    navigate(
      `/principal/student/${sectionId}/${examId}/${subjectId}/${student.student_id}`
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 mb-1">Student Management</h1>
            <p className="text-slate-600">Manage students, examinations, and submissions</p>
          </div>
          <button
            className="px-6 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
            onClick={() => setShowForm((s) => !s)}
          >
            {showForm ? "Cancel" : "Add Student"}
          </button>
        </div>

        {/* Create Students Form */}
        {showForm && (
          <div className="mb-8 bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-6">Enroll New Students</h2>
            <form onSubmit={handleCreateStudents} className="space-y-6">
              {newStudentFields.map((student, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-5 bg-slate-50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-slate-900">Student {index + 1}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={student.email}
                        onChange={(e) =>
                          handleFieldChange(index, "email", e.target.value)
                        }
                        required
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white"
                        placeholder="student@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Password
                      </label>
                      <input
                        type="password"
                        value={student.password}
                        onChange={(e) =>
                          handleFieldChange(index, "password", e.target.value)
                        }
                        required
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white"
                        placeholder="Enter password"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={student.full_name}
                        onChange={(e) =>
                          handleFieldChange(index, "full_name", e.target.value)
                        }
                        required
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Roll Number
                      </label>
                      <input
                        type="text"
                        value={student.roll_number}
                        onChange={(e) =>
                          handleFieldChange(index, "roll_number", e.target.value)
                        }
                        required
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white"
                        placeholder="2024001"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleAddStudentField}
                  className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                >
                  Add Another Student
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-6 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createLoading ? "Creating..." : "Create Students"}
                </button>
              </div>
              {createError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {createError}
                </div>
              )}
            </form>
          </div>
        )}

        {/* Exam and Subject Selection */}
        <div className="mb-8 bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Examination Context</h2>
          <p className="text-sm text-slate-600 mb-6">Select exam and subject before uploading student submissions</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Examination
              </label>
              <select
                value={selectedExam || ""}
                onChange={(e) => {
                  setSelectedExam(e.target.value);
                  setSelectedSubject(null);
                }}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white"
              >
                <option value="">Select Examination</option>
                {exams.map((exam) => (
                  <option key={exam.exam.exam_id} value={exam.exam.exam_id}>
                    {exam.exam.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Subject
              </label>
              <select
                value={selectedSubject || ""}
                onChange={(e) => setSelectedSubject(e.target.value)}
                disabled={!selectedExam}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select Subject</option>
                {selectedExam &&
                  exams
                    .find((exam) => exam.exam.exam_id === selectedExam)
                    ?.subjects.map((subject) => (
                      <option key={subject.subject_id} value={subject.subject_id}>
                        {subject.name}
                      </option>
                    ))}
              </select>
            </div>
          </div>
          
          {selectedExam && selectedSubject && (
            <div className="mt-5 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-start gap-3">
              <svg className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-emerald-900">
                  {exams.find((e) => e.exam.exam_id === selectedExam)?.exam.title} • 
                  {" "}{exams.find((e) => e.exam.exam_id === selectedExam)?.subjects.find((s) => s.subject_id === selectedSubject)?.name}
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">Context selected successfully</p>
              </div>
            </div>
          )}
        </div>

        {/* Examinations Section */}
        <div className="mb-8 bg-white border border-slate-200 rounded-lg">
          <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Examinations</h2>
              <p className="text-sm text-slate-600 mt-0.5">View and manage examination schedules</p>
            </div>
            <button
              className="px-5 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
              onClick={() => setShowExamForm((s) => !s)}
            >
              {showExamForm ? "Cancel" : "Create Exam"}
            </button>
          </div>

          <div className="p-6">
            {showExamForm && (
              <form onSubmit={handleCreateExam} className="mb-6 border border-slate-200 rounded-lg p-5 bg-slate-50">
                <h3 className="font-medium text-slate-900 mb-5">New Examination</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Examination Title
                    </label>
                    <input
                      type="text"
                      value={newExam.title}
                      onChange={(e) =>
                        setNewExam({ ...newExam, title: e.target.value })
                      }
                      required
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white"
                      placeholder="Mid-term Examination"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Subjects (comma separated)
                    </label>
                    <input
                      type="text"
                      value={newExam.subjects}
                      onChange={(e) =>
                        setNewExam({ ...newExam, subjects: e.target.value })
                      }
                      required
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white"
                      placeholder="Mathematics, Physics, Chemistry"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Description
                    </label>
                    <textarea
                      value={newExam.description}
                      onChange={(e) =>
                        setNewExam({ ...newExam, description: e.target.value })
                      }
                      rows={3}
                      required
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white"
                      placeholder="Provide examination description"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Start Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={newExam.start_time}
                      onChange={(e) =>
                        setNewExam({ ...newExam, start_time: e.target.value })
                      }
                      required
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      End Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={newExam.end_time}
                      onChange={(e) =>
                        setNewExam({ ...newExam, end_time: e.target.value })
                      }
                      required
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white"
                    />
                  </div>
                </div>

                {createExamError && (
                  <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {createExamError}
                  </div>
                )}

                <div className="mt-5">
                  <button
                    type="submit"
                    disabled={createExamLoading}
                    className="px-6 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createExamLoading ? "Creating Examination..." : "Create Examination"}
                  </button>
                </div>
              </form>
            )}

            {examsLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-slate-900"></div>
                <p className="text-slate-600 mt-3 text-sm">Loading examinations...</p>
              </div>
            ) : examsError ? (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {examsError}
              </div>
            ) : exams.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-slate-600 text-sm">No examinations scheduled</p>
              </div>
            ) : (
              <div className="space-y-3">
                {exams.map((exam) => (
                  <div
                    key={exam.exam.exam_id}
                    className="border border-slate-200 rounded-lg p-5 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer bg-white"
                    onClick={() =>
                      navigate(`/principal/exam/${sectionId}/${exam.exam.exam_id}`)
                    }
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-slate-900 mb-1">{exam.exam.title}</h3>
                        <p className="text-sm text-slate-600 leading-relaxed">{exam.exam.description}</p>
                      </div>
                      <span className="ml-4 px-3 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-full whitespace-nowrap">
                        {exam.subjects.length} {exam.subjects.length === 1 ? 'Subject' : 'Subjects'}
                      </span>
                    </div>
                    <div className="flex items-center text-xs text-slate-500 mb-3">
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {new Date(exam.exam.start_time).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} - {new Date(exam.exam.end_time).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {exam.subjects.map((subject) => (
                        <span key={subject.subject_id} className="px-3 py-1 text-xs font-medium bg-slate-50 text-slate-700 rounded border border-slate-200">
                          {subject.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Students List */}
        <div className="bg-white border border-slate-200 rounded-lg">
          <div className="px-6 py-5 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Students</h2>
            <p className="text-sm text-slate-600 mt-0.5">Select a student to upload examination submissions</p>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-slate-900"></div>
                <p className="text-slate-600 mt-3 text-sm">Loading students...</p>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <p className="text-slate-600 text-sm">No students enrolled</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {students.map((student) => (
                  <div
                    key={student.student_id}
                    className="border border-slate-200 rounded-lg p-5 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer bg-white"
                    onClick={() =>
                      handleNavigateToStudent(
                        student,
                        selectedExam,
                        selectedSubject
                      )
                    }
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-11 h-11 rounded-lg bg-slate-900 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                        {student.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate">{student.full_name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Roll No. {student.roll_number}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs text-slate-600">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-2 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="truncate">{student.email}</span>
                      </div>
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-2 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Enrolled {new Date(student.enrollment_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Students;