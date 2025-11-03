import React from "react";
import { Routes, Route, Outlet } from "react-router-dom";
import Header from "./Header";
import PrincipalDashboard from "./Pages/Dashboard";
import PrincipalSettings from "./Pages/Settings";
import Manage from "./Pages/Manage";
import Section from "./Pages/Section";
import Students from "./Pages/Students";
import Exam from "./Pages/Exam";
import Subject from "./Pages/Subject";
import SingleStudent from "./Pages/SingleStudent";
import OralExams from "./Pages/Oral";
import ClassResult from "./Pages/ClassResult";
import SectionResult from "./Pages/SectionResult";
import ExamResult from "./Pages/ExamResult";
import SubjectResult from "./Pages/SubjectResult";
const AdminLayout = () => {
  return (
    <div style={{ display: "flex" }}>
      {/* Side navbar */}
      <Header />

      {/* Content area */}
      <div style={{ flex: 1 }}>
        <main style={{ padding: 20 }}>
          {/* Define nested routes for principal under /principal/* */}
          <Routes>
            <Route path="dashboard" element={<PrincipalDashboard />} />
            <Route path="settings" element={<PrincipalSettings />} />

            <Route path="manage" element={<Manage />} />
            <Route path="classresult" element={<ClassResult />} />
            <Route path="sectionresult/:classId" element={<SectionResult />} />
            <Route
              path="examresult/:classId/:sectionId"
              element={<ExamResult />}
            />
            <Route
              path="subjectresult/:classId/:sectionId/:examId"
              element={<SubjectResult />}
            />
            <Route path="sections/:classId" element={<Section />} />
            <Route path="students/:sectionId" element={<Students />} />
            <Route path="exam/:sectionId/:examId" element={<Exam />} />
            <Route path="oral" element={<OralExams />} />
            <Route
              path="subject/:sectionId/:examId/:subjectId"
              element={<Subject />}
            />
            <Route
              path="student/:sectionId/:examId/:subjectId/:studentId"
              element={<SingleStudent />}
            />

            {/* Default route when path is /principal/ */}
            <Route path="" element={<PrincipalDashboard />} />
          </Routes>

          {/* Keep Outlet available for any further nested routes */}
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
