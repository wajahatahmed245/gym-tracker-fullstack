import { useState } from "react";
import { api } from "../api/client";

const GOALS = ["Weight Loss", "Muscle Gain", "General Fitness", "Endurance"];

function SignupExerciser({ onSignup, onBack }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    goal: GOALS[0],
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.confirmPassword) {
      setError("Please fill in all required fields.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const data = await api.signupExerciser({
        name: form.name,
        email: form.email,
        password: form.password,
        goal: form.goal,
      });
      onSignup(data);
    } catch (err) {
      setError(err.message || "Signup failed.");
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

      <div className="auth-card">
        <button className="back-button auth-back" onClick={onBack} type="button">←</button>
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">Sign up as an Exerciser</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. Ali Raza"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
            />
          </div>

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

          <div className="form-row">
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
            <div className="form-group">
              <label className="form-label">Confirm</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={form.confirmPassword}
                onChange={(e) => handleChange("confirmPassword", e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Fitness Goal</label>
            <select
              className="form-select"
              value={form.goal}
              onChange={(e) => handleChange("goal", e.target.value)}
            >
              {GOALS.map((goal) => (
                <option key={goal} value={goal}>{goal}</option>
              ))}
            </select>
          </div>

          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create Account"}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{" "}
          <button className="link-button" onClick={onBack}>Log in</button>
        </p>
      </div>
    </div>
  );
}

export default SignupExerciser;
