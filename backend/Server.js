// server.js
require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const cors = require("cors");
const authRoutes = require("./Routes/Authroutes");
const errorHandler = require("./Middleware/ErrorHandler");
const classesRoutes = require("./Routes/Classroutes");
const studentsRoutes = require('./Routes/Studentroutes');
const sectionExamRoutes = require('./Routes/Examroutes');
const answersRoutes = require('./Routes/Answerroutes');
const notesRoutes = require('./Routes/Notesroutes');
const teacheranswer = require('./Routes/TeacherAnswersRoutes');
const studentanswer = require('./Routes/studentAnswersRoutes');
const resultRoutes = require('./Routes/Resultroutes');
const studentImageAnswerRoutes = require('./Routes/Studentimageanswerroutes');
// Initialize app
const app = express();

// Middleware setup
app.use(helmet());
app.use(cors());
// Lightweight request logger (method, url, status + response time)
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

// Serve static files from uploads directory
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/classes", classesRoutes);
app.use("/api/sections", studentsRoutes);
app.use("/api/sections", sectionExamRoutes); // creates: POST /api/sections/:sectionId/exams and GET /api/sections/:sectionId/exams
app.use("/api/exams", sectionExamRoutes);
app.use("/api", answersRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/teacheranswers", teacheranswer);
app.use("/api/studentanswers", studentanswer);
app.use("/api", resultRoutes);
app.use("/api", studentImageAnswerRoutes);

// Health check route
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Global error handler
app.use(errorHandler);

// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
