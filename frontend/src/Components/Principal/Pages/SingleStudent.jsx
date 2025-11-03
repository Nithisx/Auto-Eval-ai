import React, { useState } from "react";
import { useParams } from "react-router-dom";

const SingleStudent = () => {
  const { sectionId, examId, subjectId, studentId } = useParams();
  const [selectedImages, setSelectedImages] = useState([]);
  const [showUploadBox, setShowUploadBox] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [existingAnswers, setExistingAnswers] = useState([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [showExistingAnswers, setShowExistingAnswers] = useState(false);
  const [segmentationResults, setSegmentationResults] = useState(null);
  const [showSegmentation, setShowSegmentation] = useState(false);

  const handleImageSelect = (event) => {
    const files = Array.from(event.target.files);
    setSelectedImages(files);
    setError("");
    setSuccess("");
  };

  const handleRemoveImage = (index) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadImages = async () => {
    if (selectedImages.length === 0) {
      setError("Please select at least one image to upload");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const token =
        localStorage.getItem("token") || localStorage.getItem("Token") || "";

      const formData = new FormData();
      formData.append("section_id", sectionId);
      formData.append("exam_id", examId);
      formData.append("subject_id", subjectId);
      formData.append("student_id", studentId);

      // Add all selected images
      selectedImages.forEach((image) => {
        formData.append("images", image);
      });

      const res = await fetch(
        `http://localhost:4000/api/student-image-answers`,
        {
          method: "POST",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: formData,
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to upload images");

      setSuccess("Images uploaded successfully!");

      // Store segmentation results if available
      console.log("Upload Response:", data);
      console.log("Segmentation Data:", data.segmentation);

      if (data.segmentation && data.segmentation.success) {
        setSegmentationResults(data.segmentation);
        setShowSegmentation(true);
        console.log("Segmentation results set:", data.segmentation);
      } else {
        console.log("No segmentation results or segmentation failed");
      }

      setSelectedImages([]);
      setShowUploadBox(false);
      // Refresh existing answers after successful upload
      fetchExistingAnswers();
    } catch (err) {
      setError(err.message || "Error uploading images");
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingAnswers = async () => {
    setLoadingExisting(true);
    try {
      const token =
        localStorage.getItem("token") || localStorage.getItem("Token") || "";

      const queryParams = new URLSearchParams({
        section_id: sectionId,
        exam_id: examId,
        subject_id: subjectId,
        student_id: studentId,
      });

      const res = await fetch(
        `http://localhost:4000/api/student-image-answers?${queryParams}`,
        {
          method: "GET",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      const data = await res.json();
      if (!res.ok)
        throw new Error(data?.error || "Failed to fetch existing answers");

      setExistingAnswers(data.data || []);
    } catch (err) {
      console.error("Error fetching existing answers:", err);
      setError(err.message || "Error fetching existing answers");
    } finally {
      setLoadingExisting(false);
    }
  };

  // Fetch existing answers when component mounts
  React.useEffect(() => {
    fetchExistingAnswers();
  }, [sectionId, examId, subjectId, studentId]);

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Student Details</h1>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setShowUploadBox((prev) => !prev)}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          {showUploadBox ? "Close Upload Box" : "Upload Answer Images"}
        </button>

        <button
          onClick={() => setShowExistingAnswers((prev) => !prev)}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          {showExistingAnswers
            ? "Hide Existing Answers"
            : "View Existing Answers"}
          {existingAnswers.length > 0 && (
            <span className="ml-1 bg-blue-700 text-white px-2 py-0.5 rounded-full text-xs">
              {existingAnswers.length}
            </span>
          )}
        </button>

        <button
          onClick={fetchExistingAnswers}
          disabled={loadingExisting}
          className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
        >
          {loadingExisting ? "Refreshing..." : "Refresh"}
        </button>

        {segmentationResults && (
          <button
            onClick={() => setShowSegmentation((prev) => !prev)}
            className="px-4 py-2 bg-purple-500 text-white rounded"
          >
            {showSegmentation ? "Hide Segmentation" : "View Segmentation"}
            <span className="ml-1 bg-purple-700 text-white px-2 py-0.5 rounded-full text-xs">
              {segmentationResults.overall_summary
                ?.total_regions_across_all_images || 0}{" "}
              regions
            </span>
          </button>
        )}
      </div>

      {showUploadBox && (
        <div className="mb-4 border p-4 rounded">
          <h2 className="text-lg font-medium mb-4">Upload Answer Images</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Images (JPG, PNG, WebP, TIFF, PDF - Max 10 files, 15MB
              each)
            </label>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/tiff,image/tif,application/pdf"
              multiple
              onChange={handleImageSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {selectedImages.length > 0 && (
            <div className="mb-4">
              <h3 className="text-md font-medium mb-2">
                Selected Files ({selectedImages.length}):
              </h3>
              <div className="space-y-2">
                {selectedImages.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-gray-50 p-2 rounded"
                  >
                    <span className="text-sm text-gray-700">
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                    <button
                      onClick={() => handleRemoveImage(index)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 mb-4 p-2 bg-red-50 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="text-sm text-green-600 mb-4 p-2 bg-green-50 rounded">
              {success}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleUploadImages}
              disabled={loading || selectedImages.length === 0}
              className="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? "Uploading..."
                : `Upload ${selectedImages.length} Image${
                    selectedImages.length !== 1 ? "s" : ""
                  }`}
            </button>

            <button
              onClick={() => {
                setSelectedImages([]);
                setError("");
                setSuccess("");
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Segmentation Results Section */}
      {showSegmentation && segmentationResults && (
        <div className="mb-4 border p-4 rounded bg-gradient-to-r from-purple-50 to-indigo-50">
          <h2 className="text-lg font-medium mb-4 text-purple-800">
            🔍 Image Segmentation Analysis Results
          </h2>

          {/* Debug Info */}
          <div className="mb-4 p-2 bg-yellow-100 border border-yellow-300 rounded text-xs">
            <strong>Debug:</strong>
            <div>
              segmentationResults keys:{" "}
              {JSON.stringify(Object.keys(segmentationResults))}
            </div>
            <div>
              cropped_questions length:{" "}
              {segmentationResults.cropped_questions?.length || 0}
            </div>
            <div>summary: {JSON.stringify(segmentationResults.summary)}</div>
          </div>

          {/* Overall Summary */}
          <div className="mb-4 p-4 bg-white rounded-lg border border-purple-200">
            <h3 className="font-semibold text-gray-800 mb-3">
              📊 Question Cropping Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded">
                <div className="text-2xl font-bold text-blue-600">
                  {segmentationResults.summary?.pages_processed || 0}
                </div>
                <div className="text-sm text-blue-800">Pages Processed</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded">
                <div className="text-2xl font-bold text-green-600">
                  {segmentationResults.summary?.total_questions_cropped || 0}
                </div>
                <div className="text-sm text-green-800">Questions Cropped</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded">
                <div className="text-2xl font-bold text-yellow-600">
                  {segmentationResults.summary?.questions_per_page?.page_1 || 0}
                </div>
                <div className="text-sm text-yellow-800">Page 1 Questions</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded">
                <div className="text-2xl font-bold text-purple-600">
                  {segmentationResults.summary?.questions_per_page?.page_2 || 0}
                </div>
                <div className="text-sm text-purple-800">Page 2 Questions</div>
              </div>
            </div>

            {/* Processing Status */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-lg font-semibold text-green-700">
                  {segmentationResults.summary?.processing_status ===
                  "completed"
                    ? "✅ Completed"
                    : "⏳ Processing"}
                </div>
                <div className="text-sm text-gray-600">Processing Status</div>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-lg font-semibold text-gray-700">
                  {segmentationResults.cropped_questions?.length || 0}
                </div>
                <div className="text-sm text-gray-600">
                  Total Cropped Images
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-lg font-semibold text-blue-700">
                  Individual Images
                </div>
                <div className="text-sm text-gray-600">Output Format</div>
              </div>
            </div>

            {/* Questions List */}
            {segmentationResults.summary?.all_questions && (
              <div className="mt-4 p-3 bg-gray-50 rounded">
                <h4 className="font-medium text-gray-800 mb-2">
                  � Questions Found:
                </h4>
                <div className="flex flex-wrap gap-2">
                  {segmentationResults.summary.all_questions.map(
                    (question, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                      >
                        {question}
                      </span>
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Cropped Questions Display */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800 mb-3">
              ✂️ Cropped Questions
            </h3>

            {/* Questions grouped by page */}
            {segmentationResults.cropped_questions && (
              <div className="space-y-6">
                <div className="p-2 bg-blue-100 rounded text-sm">
                  <strong>Debug Cropped Questions:</strong> Found{" "}
                  {segmentationResults.cropped_questions.length} total questions
                </div>

                {/* Group questions by page */}
                {[1, 2].map((pageNum) => {
                  const pageQuestions =
                    segmentationResults.cropped_questions.filter(
                      (q) => q.page_number === pageNum
                    );
                  console.log(`Page ${pageNum} questions:`, pageQuestions);
                  if (pageQuestions.length === 0) return null;

                  return (
                    <div
                      key={pageNum}
                      className="border rounded-lg p-4 bg-white"
                    >
                      <h4 className="font-medium text-gray-800 mb-4">
                        📄 Page {pageNum} - {pageQuestions.length} Questions
                      </h4>

                      {/* Grid of cropped questions */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pageQuestions.map((question, index) => (
                          <div
                            key={index}
                            className="border rounded-lg overflow-hidden bg-gray-50"
                          >
                            {/* Question Header */}
                            <div className="bg-blue-100 px-3 py-2 border-b">
                              <div className="flex justify-between items-center">
                                <h5 className="font-medium text-blue-800">
                                  {question.question_name.toUpperCase()}
                                </h5>
                                <span className="text-xs text-blue-600">
                                  {question.dimensions}
                                </span>
                              </div>
                            </div>

                            {/* Cropped Question Image */}
                            <div className="p-2">
                              <div className="border rounded overflow-hidden bg-white">
                                <img
                                  src={`data:image/jpeg;base64,${question.cropped_image}`}
                                  alt={`Question ${question.question_name}`}
                                  className="w-full h-auto max-h-48 object-contain"
                                />
                              </div>
                            </div>

                            {/* Question Details */}
                            <div className="px-3 py-2 bg-gray-100 text-xs text-gray-600">
                              <div className="flex justify-between">
                                <span>
                                  Position: ({question.bbox.x},{" "}
                                  {question.bbox.y})
                                </span>
                                <span>
                                  Size: {question.bbox.width}×
                                  {question.bbox.height}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Image Alignment Metrics */}
            {segmentationResults.summary?.image_metadata && (
              <div className="mt-4 space-y-4">
                <h4 className="font-medium text-gray-800">
                  📐 Image Alignment Analysis
                </h4>
                {Object.entries(segmentationResults.summary.image_metadata).map(
                  ([imageName, metadata], idx) => (
                    <div key={idx} className="p-4 border rounded-lg bg-white">
                      <div className="flex justify-between items-start mb-3">
                        <h5 className="font-medium text-gray-800">
                          📄 {imageName} (Page {idx + 1})
                        </h5>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            metadata.manual_check_needed
                              ? "bg-red-100 text-red-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {metadata.manual_check_needed
                            ? "⚠️ Manual Check"
                            : "✅ Auto Processed"}
                        </span>
                      </div>

                      {/* Transform Parameters */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3 text-sm">
                        <div>
                          <span className="text-gray-600">Confidence:</span>
                          <div
                            className={`font-bold ${
                              metadata.alignment_confidence > 0.8
                                ? "text-green-600"
                                : metadata.alignment_confidence > 0.5
                                ? "text-yellow-600"
                                : "text-red-600"
                            }`}
                          >
                            {(metadata.alignment_confidence * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-600">Method:</span>
                          <div className="font-bold text-blue-600">
                            {metadata.used_method?.replace(/_/g, " ") ||
                              "Unknown"}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-600">Rotation:</span>
                          <div className="font-bold text-gray-800">
                            {metadata.transform_params?.rotation_deg?.toFixed(
                              1
                            ) || "0.0"}
                            °
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-600">Scale:</span>
                          <div className="font-bold text-gray-800">
                            {metadata.transform_params?.scale_x?.toFixed(2) ||
                              "1.0"}{" "}
                            ×{" "}
                            {metadata.transform_params?.scale_y?.toFixed(2) ||
                              "1.0"}
                          </div>
                        </div>
                      </div>

                      {/* Additional Metrics */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs text-gray-600">
                        <div>
                          Translation: (
                          {metadata.transform_params?.tx?.toFixed(0) || "0"},{" "}
                          {metadata.transform_params?.ty?.toFixed(0) || "0"})px
                        </div>
                        <div>
                          Shear:{" "}
                          {metadata.transform_params?.shear?.toFixed(3) ||
                            "0.000"}
                        </div>
                        <div>
                          Perspective:{" "}
                          {metadata.perspective_metrics?.perspective_distortion_pct?.toFixed(
                            1
                          ) || "0.0"}
                          %
                        </div>
                        {metadata.residual_mad && (
                          <div>
                            Residual MAD: {metadata.residual_mad.toFixed(1)}
                          </div>
                        )}
                        {metadata.doc_area_ratio && (
                          <div>
                            Doc Area:{" "}
                            {(metadata.doc_area_ratio * 100).toFixed(1)}%
                          </div>
                        )}
                      </div>

                      {/* Manual Check Reasons */}
                      {metadata.manual_check_needed &&
                        metadata.manual_check_reasons && (
                          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
                            <div className="font-medium text-red-800 text-sm">
                              ⚠️ Issues Detected:
                            </div>
                            <div className="text-xs text-red-700 mt-1">
                              {metadata.manual_check_reasons.join(", ")}
                            </div>
                          </div>
                        )}
                    </div>
                  )
                )}
              </div>
            )}

            {/* Summary Stats */}
            {segmentationResults.summary && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">
                  📊 Cropping Summary
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-green-700">Total Questions:</span>
                    <div className="font-bold text-green-900">
                      {segmentationResults.summary.total_questions_cropped}
                    </div>
                  </div>
                  <div>
                    <span className="text-green-700">Pages Processed:</span>
                    <div className="font-bold text-green-900">
                      {segmentationResults.summary.pages_processed}
                    </div>
                  </div>
                  <div>
                    <span className="text-green-700">Page 1 Questions:</span>
                    <div className="font-bold text-green-900">
                      {segmentationResults.summary.questions_per_page?.page_1 ||
                        0}
                    </div>
                  </div>
                  <div>
                    <span className="text-green-700">Page 2 Questions:</span>
                    <div className="font-bold text-green-900">
                      {segmentationResults.summary.questions_per_page?.page_2 ||
                        0}
                    </div>
                  </div>
                </div>

                {/* All Questions List */}
                {segmentationResults.summary.all_questions && (
                  <div className="mt-3">
                    <span className="text-green-700 text-sm">
                      Questions Found:
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {segmentationResults.summary.all_questions.map(
                        (qName, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-green-200 text-green-800 text-xs rounded"
                          >
                            {qName}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Existing Answers Section */}
      {showExistingAnswers && (
        <div className="mb-4 border p-4 rounded">
          <h2 className="text-lg font-medium mb-4">Existing Answer Images</h2>

          {loadingExisting ? (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-gray-600">Loading existing answers...</p>
            </div>
          ) : existingAnswers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No existing answer images found for this student.</p>
              <p className="text-sm mt-1">
                Upload some images to see them here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {existingAnswers.map((answer, answerIndex) => (
                <div
                  key={answer.image_answer_id}
                  className="border rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-medium text-gray-800">
                        Submission #{answerIndex + 1}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Submitted:{" "}
                        {new Date(answer.created_at).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        Status:{" "}
                        <span
                          className={`font-medium ${
                            answer.status === "graded"
                              ? "text-green-600"
                              : answer.status === "reviewed"
                              ? "text-blue-600"
                              : "text-yellow-600"
                          }`}
                        >
                          {answer.status.charAt(0).toUpperCase() +
                            answer.status.slice(1)}
                        </span>
                      </p>
                      {answer.marks_obtained > 0 && (
                        <p className="text-sm text-gray-600">
                          Marks:{" "}
                          <span className="font-medium text-green-600">
                            {answer.marks_obtained}
                          </span>
                        </p>
                      )}
                    </div>
                    {answer.teacher_feedback && (
                      <div className="max-w-md">
                        <p className="text-sm text-gray-700 bg-white p-2 rounded border">
                          <strong>Feedback:</strong> {answer.teacher_feedback}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {answer.image_paths &&
                      answer.image_paths.map((imagePath, imageIndex) => (
                        <div
                          key={imageIndex}
                          className="border rounded p-2 bg-white"
                        >
                          <div className="aspect-square bg-gray-100 rounded mb-2 flex items-center justify-center overflow-hidden">
                            <img
                              src={`http://localhost:4000/uploads/${imagePath}`}
                              alt={`Answer image ${imageIndex + 1}`}
                              className="max-w-full max-h-full object-contain"
                              onError={(e) => {
                                e.target.style.display = "none";
                                e.target.nextSibling.style.display = "flex";
                              }}
                            />
                            <div className="hidden items-center justify-center h-full text-gray-500 text-sm">
                              <div className="text-center">
                                <p>Image not available</p>
                                <p className="text-xs mt-1">
                                  {answer.original_filenames?.[imageIndex] ||
                                    "Unknown file"}
                                </p>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 truncate">
                            {answer.original_filenames?.[imageIndex] ||
                              `Image ${imageIndex + 1}`}
                          </p>
                          {answer.file_sizes?.[imageIndex] && (
                            <p className="text-xs text-gray-500">
                              {(
                                answer.file_sizes[imageIndex] /
                                1024 /
                                1024
                              ).toFixed(2)}{" "}
                              MB
                            </p>
                          )}
                          <a
                            href={`http://localhost:4000/uploads/${imagePath}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:text-blue-700 block mt-1"
                          >
                            View Full Size →
                          </a>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SingleStudent;
