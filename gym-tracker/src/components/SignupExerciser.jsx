import { useState } from "react";
import { api } from "../api/client";
import { ACTIVITY_LEVELS, GENDERS } from "../utils/health";

const GOALS = ["Weight Loss", "Muscle Gain", "General Fitness", "Endurance"];

function SignupExerciser({ onSignup, onBack }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    goal: GOALS[0],
    height: "",
    weight: "",
    age: "",
    gender: GENDERS[0],
    activityLevel: ACTIVITY_LEVELS[0].id,
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (
      !form.name ||
      !form.email ||
      !form.password ||
      !form.confirmPassword ||
      !form.height ||
      !form.weight ||
      !form.age
    ) {
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
        height_cm: Number(form.height),
        weight_kg: Number(form.weight),
        age: Number(form.age),
        gender: form.gender,
        activity_level: form.activityLevel,
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

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Height (cm)</label>
              <input
                className="form-input"
                type="number"
                min="1"
                step="0.1"
                placeholder="e.g. 175"
                value={form.height}
                onChange={(e) => handleChange("height", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Weight (kg)</label>
              <input
                className="form-input"
                type="number"
                min="1"
                step="0.1"
                placeholder="e.g. 70"
                value={form.weight}
                onChange={(e) => handleChange("weight", e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Age</label>
              <input
                className="form-input"
                type="number"
                min="1"
                placeholder="e.g. 28"
                value={form.age}
                onChange={(e) => handleChange("age", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select
                className="form-select"
                value={form.gender}
                onChange={(e) => handleChange("gender", e.target.value)}
              >
                {GENDERS.map((gender) => (
                  <option key={gender} value={gender}>{gender}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Activity Level</label>
            <select
              className="form-select"
              value={form.activityLevel}
              onChange={(e) => handleChange("activityLevel", e.target.value)}
            >
              {ACTIVITY_LEVELS.map((level) => (
                <option key={level.id} value={level.id}>{level.label}</option>
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
