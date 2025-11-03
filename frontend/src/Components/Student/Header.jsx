import React from "react";
import { NavLink } from "react-router-dom";

const Header = () => {
  const linkStyle = ({ isActive }) => ({
    display: "block",
    padding: "8px 12px",
    color: isActive ? "#fff" : "#333",
    background: isActive ? "#007acc" : "transparent",
    textDecoration: "none",
    borderRadius: 4,
    marginBottom: 6,
  });

  return (
    <aside
      style={{
        width: 220,
        padding: 16,
        borderRight: "1px solid #eee",
        height: "100vh",
        boxSizing: "border-box",
      }}
    >
      <h3>Student</h3>
      <nav>
        <NavLink to="/student/dashboard" style={linkStyle}>
          Dashboard
        </NavLink>
        <NavLink to="/student/profile" style={linkStyle}>
          Profile
        </NavLink>
      </nav>
    </aside>
  );
};

export default Header;
