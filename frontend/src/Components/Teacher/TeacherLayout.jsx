import React from "react";
import { Routes, Route, Outlet } from "react-router-dom";
import Header from "./Header";
import TeacherDashboard from "./Dashboard";
import TeacherCourses from "./Courses";

const StaffLayout = () => {
  return (
    <div style={{ display: "flex" }}>
      <Header />

      <div style={{ flex: 1 }}>
        <main style={{ padding: 20 }}>
          <Routes>
            <Route path="dashboard" element={<TeacherDashboard />} />
            <Route path="courses" element={<TeacherCourses />} />
            <Route path="" element={<TeacherDashboard />} />
          </Routes>

          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default StaffLayout;
