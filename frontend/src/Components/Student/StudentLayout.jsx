import React from "react";
import { Routes, Route, Outlet } from "react-router-dom";
import Header from "./Header";
import StudentDashboard from "./Dashboard";
import StudentProfile from "./Profile";

const AlumniLayout = () => {
  return (
    <div style={{ display: "flex" }}>
      <Header />

      <div style={{ flex: 1 }}>
        <main style={{ padding: 20 }}>
          <Routes>
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="profile" element={<StudentProfile />} />
            <Route path="" element={<StudentDashboard />} />
          </Routes>

          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AlumniLayout;
