import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Settings,
  BarChart3,
  Calendar,
  Award,
  Building,
  LogOut,
  Headphones,
  User,
} from "lucide-react";

const Header = () => {
  const navigationItems = [
    {
      title: "Dashboard",
      path: "/principal/dashboard",
      icon: LayoutDashboard,
      description: "Overview & Analytics",
    },

    {
      title: "Manage",
      path: "/principal/manage",
      icon: Building,
      description: "School Management",
    },
    {
      title: "Results",
      path: "/principal/classresult",
      icon: BarChart3,
      description: "Exam Results & Statistics",
    },
    {
      title: "Oral",
      path: "/principal/oral",
      icon: Headphones,
      description: "Oral Exams",
    },
    {
      title: "Settings",
      path: "/principal/settings",
      icon: Settings,
      description: "System Settings",
    },
  ];

  const HandleSignOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("Token");
    window.location.href = "/home";
  };

  const NavItem = ({ item }) => {
    return (
      <NavLink
        to={item.path}
        className={({ isActive }) =>
          `flex items-center px-4 py-3 mb-1 rounded-lg transition-all duration-200 group ${
            isActive
              ? "bg-gray-600 text-white shadow-lg"
              : "text-gray-700 hover:bg-gray-50 hover:text-gray-700"
          }`
        }
      >
        <item.icon
          size={20}
          className={`mr-3 transition-colors duration-200`}
        />
        <div className="flex-1">
          <div className="font-medium">{item.title}</div>
          {item.description && (
            <div className="text-xs opacity-75 mt-0.5">{item.description}</div>
          )}
        </div>
      </NavLink>
    );
  };

  return (
    <aside className="w-72 bg-white border-r border-gray-200 h-screen flex flex-col shadow-sm ">
      {/* Header Section */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-linear-to-br from-gray-600 to-gray-700 rounded-lg flex items-center justify-center">
            <Building className="text-white" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Principal</h2>
            <p className="text-sm text-gray-500">Admin Dashboard</p>
          </div>
        </div>
      </div>

      {/* User Profile Section */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <User className="text-gray-600" size={16} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Dr. John Smith</p>
            <p className="text-xs text-gray-500">Principal</p>
          </div>
        </div>
      </div>

      {/* Navigation Section */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-1">
          {navigationItems.map((item, index) => (
            <NavItem key={index} item={item} />
          ))}
        </div>
      </nav>

      {/* Footer Section */}
      <div className="p-4 border-t border-gray-200">
        <button
          className="w-full flex items-center px-4 py-3 text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all duration-200 group"
          onClick={HandleSignOut}
        >
          <LogOut size={20} className="mr-3 group-hover:text-red-600" />
          <span className="font-medium">Sign Out</span>
        </button>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">School Management System v2.0</p>
        </div>
      </div>
    </aside>
  );
};

export default Header;
