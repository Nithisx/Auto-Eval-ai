// controllers/studentImageAnswerController.js
const { validationResult } = require("express-validator");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const StudentImageAnswerModel = require("../Model/Studentimageanswermodel");
const pool = require("../Config/Config");

const StudentImageAnswerController = {
  /**
   * POST /api/student-image-answers
   * Submit multiple images for a student's exam answer
   * Body: { section_id, exam_id, subject_id, student_id, question_id? }
   * Files: Multiple images via multipart form data
   */
  async submitImageAnswer(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { section_id, exam_id, subject_id, student_id, question_id } =
        req.body;

      // Validate required fields
      if (!section_id || !exam_id || !subject_id || !student_id) {
        return res.status(400).json({
          error:
            "Missing required fields: section_id, exam_id, subject_id, student_id",
        });
      }

      // Check if files were uploaded
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No images uploaded" });
      }

      // Check for existing submission
      const existingSubmission =
        await StudentImageAnswerModel.checkExistingSubmission(
          section_id,
          exam_id,
          subject_id,
          student_id
        );

      if (existingSubmission) {
        return res.status(409).json({
          error:
            "Student has already submitted an answer for this exam/subject",
          existing_submission: existingSubmission,
        });
      }

      // Create unique folder for this submission
      const submissionId = `${Date.now()}-${student_id}`;
      const uploadDir = path.join(
        __dirname,
        "..",
        "uploads",
        "answers",
        submissionId
      );

      // Ensure upload directory exists
      fs.mkdirSync(uploadDir, { recursive: true });

      // Process uploaded files
      const image_paths = [];
      const original_filenames = [];
      const file_sizes = [];
      const mime_types = [];

      for (const file of req.files) {
        // Generate new filename to avoid conflicts
        const ext = path.extname(file.originalname);
        const newFilename = `${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}${ext}`;
        const newPath = path.join(uploadDir, newFilename);

        // Move file to organized directory
        fs.renameSync(file.path, newPath);

        // Store relative path from uploads directory
        const relativePath = `answers/${submissionId}/${newFilename}`;

        image_paths.push(relativePath);
        original_filenames.push(file.originalname);
        file_sizes.push(file.size);
        mime_types.push(file.mimetype);
      }

      // Call segmentation service
      let segmentationResults = null;
      try {
        console.log("📸 Sending images to segmentation service...");

        const formData = new FormData();

        // Add all uploaded files to FormData for segmentation
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const filePath = path.join(uploadDir, path.basename(image_paths[i]));
          const fileBuffer = fs.readFileSync(filePath);

          formData.append("images", fileBuffer, {
            filename: original_filenames[i],
            contentType: mime_types[i],
          });
        }

        const segmentResponse = await axios.post(
          "http://localhost:8001/segment",
          formData,
          {
            headers: {
              ...formData.getHeaders(),
            },
            timeout: 30000, // 30 second timeout
          }
        );

        segmentationResults = segmentResponse.data;
        console.log(
          `✅ Segmentation completed: ${
            segmentationResults.summary?.total_questions_cropped || 0
          } questions cropped`
        );
      } catch (segmentError) {
        console.error("⚠️ Segmentation service error:", segmentError.message);
        // Continue without segmentation if service is down
        segmentationResults = {
          success: false,
          error: "Segmentation service unavailable",
          message: "Images uploaded successfully but segmentation failed",
        };
      }

      // Save to database
      const imageAnswer =
        await StudentImageAnswerModel.createStudentImageAnswer({
          section_id,
          exam_id,
          subject_id,
          student_id,
          question_id: question_id || null,
          image_paths,
          original_filenames,
          file_sizes,
          mime_types,
          status: "submitted",
        });

      return res.status(201).json({
        success: true,
        message: "Image answer submitted successfully",
        data: imageAnswer,
        segmentation: segmentationResults, // Include segmentation results
      });
    } catch (error) {
      console.error("Error submitting image answer:", error);
      next(error);
    }
  },

  /**
   * GET /api/student-image-answers
   * Get student image answers with various filters
   * Query params: section_id, exam_id, subject_id, student_id, question_id, status
   */
  async getImageAnswers(req, res, next) {
    try {
      const filters = {};

      // Extract filters from query parameters
      if (req.query.section_id) filters.section_id = req.query.section_id;
      if (req.query.exam_id) filters.exam_id = req.query.exam_id;
      if (req.query.subject_id) filters.subject_id = req.query.subject_id;
      if (req.query.student_id) filters.student_id = req.query.student_id;
      if (req.query.question_id) filters.question_id = req.query.question_id;
      if (req.query.status) filters.status = req.query.status;

      const answers = await StudentImageAnswerModel.getStudentImageAnswers(
        filters
      );

      return res.json({
        success: true,
        count: answers.length,
        data: answers,
      });
    } catch (error) {
      console.error("Error getting image answers:", error);
      next(error);
    }
  },

  /**
   * GET /api/student-image-answers/:answerId
   * Get a specific student image answer by ID
   */
  async getImageAnswerById(req, res, next) {
    try {
      const { answerId } = req.params;

      const answer = await StudentImageAnswerModel.getStudentImageAnswerById(
        answerId
      );

      if (!answer) {
        return res.status(404).json({ error: "Image answer not found" });
      }

      return res.json({
        success: true,
        data: answer,
      });
    } catch (error) {
      console.error("Error getting image answer by ID:", error);
      next(error);
    }
  },

  /**
   * PUT /api/student-image-answers/:answerId/grade
   * Grade a student's image answer (teacher/principal only)
   */
  async gradeImageAnswer(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { answerId } = req.params;
      const { status, marks_obtained, teacher_feedback } = req.body;
      const graded_by = req.user.user_id; // From auth middleware

      const updatedAnswer =
        await StudentImageAnswerModel.updateStudentImageAnswer(answerId, {
          status: status || "graded",
          marks_obtained,
          teacher_feedback,
          graded_by,
        });

      if (!updatedAnswer) {
        return res.status(404).json({ error: "Image answer not found" });
      }

      return res.json({
        success: true,
        message: "Image answer graded successfully",
        data: updatedAnswer,
      });
    } catch (error) {
      console.error("Error grading image answer:", error);
      next(error);
    }
  },

  /**
   * GET /api/student-image-answers/exam/:examId/statistics
   * Get statistics for an exam's image submissions
   */
  async getExamStatistics(req, res, next) {
    try {
      const { examId } = req.params;

      const statistics = await StudentImageAnswerModel.getExamStatistics(
        examId
      );

      return res.json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      console.error("Error getting exam statistics:", error);
      next(error);
    }
  },

  /**
   * DELETE /api/student-image-answers/:answerId
   * Delete a student image answer (admin/principal only)
   */
  async deleteImageAnswer(req, res, next) {
    try {
      const { answerId } = req.params;

      // Get the answer first to clean up files
      const answer = await StudentImageAnswerModel.getStudentImageAnswerById(
        answerId
      );

      if (!answer) {
        return res.status(404).json({ error: "Image answer not found" });
      }

      // Delete the database record
      const deletedAnswer =
        await StudentImageAnswerModel.deleteStudentImageAnswer(answerId);

      // Clean up uploaded files
      if (answer.image_paths && answer.image_paths.length > 0) {
        for (const imagePath of answer.image_paths) {
          const fullPath = path.join(__dirname, "..", "uploads", imagePath);
          try {
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath);
            }
          } catch (fileError) {
            console.warn("Could not delete file:", fullPath, fileError.message);
          }
        }

        // Try to remove the directory if empty
        const dirPath = path.dirname(
          path.join(__dirname, "..", "uploads", answer.image_paths[0])
        );
        try {
          fs.rmdirSync(dirPath);
        } catch (dirError) {
          // Directory not empty or other error, ignore
        }
      }

      return res.json({
        success: true,
        message: "Image answer deleted successfully",
        data: deletedAnswer,
      });
    } catch (error) {
      console.error("Error deleting image answer:", error);
      next(error);
    }
  },
};

module.exports = StudentImageAnswerController;
