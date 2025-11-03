import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("principal@gmail.com");
  const [password, setPassword] = useState("12345678");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("http://localhost:4000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        // API may return message in data.message
        throw new Error(data?.message || "Login failed");
      }

      // Example response shape assumed from your sample
      // store both 'token' and 'Token' (for backwards compatibility)
      const token = data.token || data?.data?.token || data?.data;
      const user = data.user || data?.data?.user || null;

      if (!token) {
        throw new Error("No token returned from server");
      }

      localStorage.setItem("token", token);
      localStorage.setItem("Token", token); // keep existing code compatibility

      if (user && user.role) {
        localStorage.setItem("role", user.role);
      }

      if (user) {
        localStorage.setItem("user", JSON.stringify(user));
      }

      // Redirect based on role
      const role = (
        user?.role ||
        localStorage.getItem("role") ||
        ""
      ).toLowerCase();
      if (role === "principal")
        navigate("/principal/dashboard", { replace: true });
      else if (role === "teacher")
        navigate("/teacher/dashboard", { replace: true });
      else if (role === "student")
        navigate("/student/dashboard", { replace: true });
      else navigate("/home", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow">
        <h1 className="text-2xl font-semibold mb-4">Sign in to your account</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>

        <div className="mt-4 text-sm text-gray-600">
          <p>Test credentials pre-filled for convenience.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
