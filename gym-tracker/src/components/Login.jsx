import { useState } from "react";
import { motion } from "motion/react";
import { api } from "../api/client";
import { screenTransition, tapScale } from "../utils/motion";

const ROLES = [
  { id: "exerciser", label: "Exerciser", icon: "🏋️" },
  { id: "trainer", label: "Trainer", icon: "🧑‍🏫" },
  { id: "admin", label: "Admin", icon: "🛠️" },
];

function Login({ onLogin, onNavigate }) {
  const [role, setRole] = useState("exerciser");
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError("Please enter your email and password.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const data = await api.login(role, form.email, form.password);
      onLogin(data);
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-logo">
        <span className="auth-logo-icon">🏋️‍♂️</span>
        <span>GymTrack</span>
      </div>

      <motion.div className="auth-card" {...screenTransition}>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Log in to continue</p>

        <div className="role-selector">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`role-option ${role === r.id ? "active" : ""}`}
              onClick={() => setRole(r.id)}
            >
              <span className="role-option-icon">{r.icon}</span>
              <span>{r.label}</span>
            </button>
          ))}
        </div>

        {error && (
          <motion.div className="auth-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            {error}
          </motion.div>
        )}

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => handleChange("password", e.target.value)}
            />
          </div>

          <motion.button className="btn btn-primary" type="submit" whileTap={tapScale} disabled={submitting}>
            {submitting ? "Logging in…" : "Log In"}
          </motion.button>
        </form>

        {role !== "admin" && (
          <p className="auth-footer">
            New {role}?{" "}
            <button
              className="link-button"
              onClick={() => onNavigate(role === "exerciser" ? "signup-exerciser" : "signup-trainer")}
            >
              Create an account
            </button>
          </p>
        )}
      </motion.div>
    </div>
  );
}

export default Login;
