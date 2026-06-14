import { useState } from "react";
import { motion } from "motion/react";
import { api } from "../api/client";
import { ACTIVITY_LEVELS, GENDERS } from "../utils/health";
import { screenTransition, tapScale } from "../utils/motion";

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
    gender: "",
    activityLevel: "",
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
        height_cm: form.height === "" ? null : Number(form.height),
        weight_kg: form.weight === "" ? null : Number(form.weight),
        age: form.age === "" ? null : Number(form.age),
        gender: form.gender || null,
        activity_level: form.activityLevel || null,
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

      <motion.div className="auth-card" {...screenTransition}>
        <button className="back-button auth-back" onClick={onBack} type="button">←</button>
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">Sign up as an Exerciser</p>

        {error && (
          <motion.div className="auth-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            {error}
          </motion.div>
        )}

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

          <div className="info-box">
            <div className="info-box-title">💡 Optional — get personalized health insights</div>
            Add these details now to see your BMI, BMR, and daily calorie needs right away, or skip
            them and fill them in later from your profile.
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Height (cm) <span className="optional-label">Optional</span></label>
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
              <label className="form-label">Weight (kg) <span className="optional-label">Optional</span></label>
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
              <label className="form-label">Age <span className="optional-label">Optional</span></label>
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
              <label className="form-label">Gender <span className="optional-label">Optional</span></label>
              <select
                className="form-select"
                value={form.gender}
                onChange={(e) => handleChange("gender", e.target.value)}
              >
                <option value="">Prefer to skip</option>
                {GENDERS.map((gender) => (
                  <option key={gender} value={gender}>{gender}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Activity Level <span className="optional-label">Optional</span></label>
            <select
              className="form-select"
              value={form.activityLevel}
              onChange={(e) => handleChange("activityLevel", e.target.value)}
            >
              <option value="">Prefer to skip</option>
              {ACTIVITY_LEVELS.map((level) => (
                <option key={level.id} value={level.id}>{level.label}</option>
              ))}
            </select>
          </div>

          <motion.button className="btn btn-primary" type="submit" whileTap={tapScale} disabled={submitting}>
            {submitting ? "Creating…" : "Create Account"}
          </motion.button>
        </form>

        <p className="auth-footer">
          Already have an account?{" "}
          <button className="link-button" onClick={onBack}>Log in</button>
        </p>
      </motion.div>
    </div>
  );
}

export default SignupExerciser;
