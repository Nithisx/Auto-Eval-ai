// Controllers/Resultcontroller.js
const ResultModel = require("../Model/Resultmodel");

const ResultController = {
  /**
   * POST /api/results
   * Store evaluation results from the LLM service
   * Body: {
   *   exam_id,
   *   section_id,
   *   subject_id,
   *   student_id,
   *   questions: [...],
   *   total_marks,
   *   max_total_marks
   * }
   */
  async storeResult(req, res, next) {
    try {
      const {
        exam_id,
        section_id,
        subject_id,
        student_id,
        questions,
        total_marks,
        max_total_marks,
      } = req.body;

      // Validate required fields
      if (!exam_id || !section_id || !subject_id || !student_id) {
        return res.status(400).json({
          error:
            "Missing required fields: exam_id, section_id, subject_id, student_id",
        });
      }

      // Check if result already exists
      const existing = await ResultModel.existsByStudentExamSectionSubject(
        exam_id,
        section_id,
        subject_id,
        student_id
      );

      let result;
      if (existing) {
        // Update existing result
        result = await ResultModel.updateResult(existing.result_id, {
          questions,
          total_marks,
          max_total_marks,
        });
      } else {
        // Create new result
        result = await ResultModel.createResult({
          exam_id,
          section_id,
          subject_id,
          student_id,
          evaluated_by: req.user?.user_id || null,
          questions,
          total_marks,
          max_total_marks,
        });
      }

      return res.status(existing ? 200 : 201).json({
        message: existing
          ? "Result updated successfully"
          : "Result stored successfully",
        result,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/results/bulk
   * Store multiple evaluation results at once
   * Body: {
   *   results: [{ exam_id, section_id, subject_id, student_id, questions, total_marks, max_total_marks }]
   * }
   */
  async storeBulkResults(req, res, next) {
    try {
      const { results } = req.body;

      if (!Array.isArray(results) || results.length === 0) {
        return res.status(400).json({
          error: "Results array is required and cannot be empty",
        });
      }

      const storedResults = [];
      const errors = [];

      for (const resultData of results) {
        try {
          const {
            exam_id,
            section_id,
            subject_id,
            student_id,
            questions,
            total_marks,
            max_total_marks,
          } = resultData;

          // Check if result already exists
          const existing = await ResultModel.existsByStudentExamSectionSubject(
            exam_id,
            section_id,
            subject_id,
            student_id
          );

          let result;
          if (existing) {
            result = await ResultModel.updateResult(existing.result_id, {
              questions,
              total_marks,
              max_total_marks,
            });
          } else {
            result = await ResultModel.createResult({
              exam_id,
              section_id,
              subject_id,
              student_id,
              evaluated_by: req.user?.user_id || null,
              questions,
              total_marks,
              max_total_marks,
            });
          }

          storedResults.push(result);
        } catch (error) {
          errors.push({
            student_id: resultData.student_id,
            error: error.message,
          });
        }
      }

      return res.status(201).json({
        message: "Bulk results processed",
        stored: storedResults.length,
        errors: errors.length,
        results: storedResults,
        failed: errors,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/results/evaluated
   * Store a single evaluated result sent from the evaluation engine
   * Body: {
   *   exam_id,
   *   section_id,
   *   subject_id,
   *   student_id,
   *   questions: [{ q_no|question_number, marks, status, feedback }]
   * }
   */
  async storeEvaluated(req, res, next) {
    try {
      const { exam_id, section_id, subject_id, student_id, questions } =
        req.body;

      if (!exam_id || !section_id || !subject_id || !student_id) {
        return res
          .status(400)
          .json({
            error:
              "Missing required fields: exam_id, section_id, subject_id, student_id",
          });
      }

      if (!Array.isArray(questions) || questions.length === 0) {
        return res
          .status(400)
          .json({ error: "questions array is required and cannot be empty" });
      }

      // Normalize questions to the stored format
      const normalizedQuestions = questions.map((q) => {
        const qnum = q.question_number ?? q.q_no ?? q.qNo ?? null;
        const marks = Number(q.marks ?? q.mark ?? q.awarded_marks ?? 0) || 0;
        const status = q.status ?? (marks > 0 ? "correct" : "wrong");
        const feedback = q.feedback ?? q.comment ?? "";

        return {
          question_number: qnum,
          marks,
          status,
          feedback,
        };
      });

      const total_marks = normalizedQuestions.reduce(
        (s, q) => s + (Number(q.marks) || 0),
        0
      );
      const max_total_marks = normalizedQuestions.length; // best-effort; client may send actual max if available

      // Check if result exists for this student/exam/section/subject
      const existing = await ResultModel.existsByStudentExamSectionSubject(
        exam_id,
        section_id,
        subject_id,
        student_id
      );

      let result;
      const payload = {
        exam_id,
        section_id,
        subject_id,
        student_id,
        evaluated_by: req.user?.user_id || null,
        questions: normalizedQuestions,
        total_marks,
        max_total_marks,
      };

      if (existing) {
        result = await ResultModel.updateResult(existing.result_id, {
          questions: payload.questions,
          total_marks: payload.total_marks,
          max_total_marks: payload.max_total_marks,
        });
      } else {
        result = await ResultModel.createResult(payload);
      }

      return res
        .status(existing ? 200 : 201)
        .json({
          message: existing
            ? "Evaluated result updated"
            : "Evaluated result stored",
          result,
        });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/results/:resultId
   * Get a single result by ID
   */
  async getResultById(req, res, next) {
    try {
      const { resultId } = req.params;

      const result = await ResultModel.findById(resultId);

      if (!result) {
        return res.status(404).json({ error: "Result not found" });
      }

      return res.json({ result });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/results/student/:studentId
   * Get all results for a specific student
   */
  async getStudentResults(req, res, next) {
    try {
      const { studentId } = req.params;

      const results = await ResultModel.listByStudent(studentId);

      return res.json({
        student_id: studentId,
        total_results: results.length,
        results,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/results/sections/:sectionId/exams/:examId/subjects/:subjectId/students/:studentId
   * Get a specific student's result for an exam/section/subject
   */
  async getStudentExamResult(req, res, next) {
    try {
      const { sectionId, examId, subjectId, studentId } = req.params;

      const result = await ResultModel.findByStudentExamSectionSubject(
        examId,
        sectionId,
        subjectId,
        studentId
      );

      if (!result) {
        return res.status(404).json({
          error:
            "No result found for this student in the specified exam/subject",
        });
      }

      return res.json({ result });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/results/sections/:sectionId/exams/:examId/subjects/:subjectId
   * Get all students' results for an exam/section/subject
   */
  async getSectionExamSubjectResults(req, res, next) {
    try {
      const { sectionId, examId, subjectId } = req.params;

      const results = await ResultModel.listByExamSectionSubject(
        examId,
        sectionId,
        subjectId
      );

      // Get statistics
      const statistics = await ResultModel.getStatistics(
        examId,
        sectionId,
        subjectId
      );

      return res.json({
        exam_id: examId,
        section_id: sectionId,
        subject_id: subjectId,
        total_students: results.length,
        statistics,
        results,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/results/:resultId
   * Delete a result
   */
  async deleteResult(req, res, next) {
    try {
      const { resultId } = req.params;

      const result = await ResultModel.deleteResult(resultId);

      if (!result) {
        return res.status(404).json({ error: "Result not found" });
      }

      return res.json({
        message: "Result deleted successfully",
        result,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/results/sections/:sectionId/exams/:examId/subjects/:subjectId/statistics
   * Get statistics for an exam/section/subject
   */
  async getStatistics(req, res, next) {
    try {
      const { sectionId, examId, subjectId } = req.params;

      const statistics = await ResultModel.getStatistics(
        examId,
        sectionId,
        subjectId
      );

      if (!statistics || statistics.total_students === "0") {
        return res.status(404).json({
          error: "No results found for this exam/section/subject",
        });
      }

      return res.json({
        exam_id: examId,
        section_id: sectionId,
        subject_id: subjectId,
        statistics,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = ResultController;
