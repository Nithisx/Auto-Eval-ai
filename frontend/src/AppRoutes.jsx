import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Pages
import LoginPage from './Pages/Login';
import Signup from './Pages/Signup';
import Home from './Pages/home';
import About from './Pages/about';

// Layouts
import AdminLayout from './Components/Principal/PrincipalLayout';
import StaffLayout from './Components/Teacher/TeacherLayout';
import AlumniLayout from './Components/Student/StudentLayout';

// Protected route wrapper
import ProtectedRoute from './Components/Shared/ProtectedRoute';

const AppRoutes = () => {
  const token = localStorage.getItem('Token');
  const role = localStorage.getItem('role');

  // Redirect authenticated users to their respective dashboards
  const redirectAuthenticated = () => {
    if (!token) return <Navigate to="/home" replace />;

    switch (role) {
      case 'Principal':
        return <Navigate to="/principal/dashboard" replace />;
      case 'Teacher':
        return <Navigate to="/teacher/dashboard" replace />;
      case 'Student':
        return <Navigate to="/student/dashboard" replace />;
      default:
        return <Navigate to="/home" replace />;
    }
  };

  return (
    <Router>
      <Routes>
        {/* Initial Route - Redirect based on role or to home */}
        <Route path="/" element={redirectAuthenticated()} />

        {/* Public Routes */}
        <Route path="/home" element={<Home />} />
        <Route path="/about" element={<About />} />
        
        {/* Login and Signup */}
        <Route path="/login" element={token ? redirectAuthenticated() : <LoginPage />} />
        <Route path="/signup" element={token ? redirectAuthenticated() : <Signup />} />

        {/* Principal Routes */}
        <Route
          path="/principal/*"
          element={
            <ProtectedRoute requiredRole="principal">
              <AdminLayout />
            </ProtectedRoute>
          }
        />

        {/* Teacher Routes */}
        <Route
          path="/teacher/*"
          element={
            <ProtectedRoute requiredRole="teacher">
              <StaffLayout />
            </ProtectedRoute>
          }
        />

        {/* Student Routes */}
        <Route
          path="/student/*"
          element={
            <ProtectedRoute requiredRole={[ "student"]}>
              <AlumniLayout />
            </ProtectedRoute>
          }
        />

        {/* Fallback Route */}
        <Route path="*" element={token ? redirectAuthenticated() : <Navigate to="/home" />} />
      </Routes>
    </Router>
  );
};

export default AppRoutes;
