import { useState } from "react";
import { motion } from "motion/react";
import { api } from "../api/client";
import { screenTransition, tapScale } from "../utils/motion";

const SPECIALTIES = [
  "Strength Training",
  "Cardio & Weight Loss",
  "Bodybuilding",
  "CrossFit",
  "Yoga & Mobility",
];

function SignupTrainer({ onSignup, onBack }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    specialty: SPECIALTIES[0],
    experience: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone || !form.password || !form.confirmPassword) {
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
      const data = await api.signupTrainer({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        specialty: form.specialty,
        experience_years: Number(form.experience) || 0,
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
        <p className="auth-subtitle">Sign up as a Trainer</p>

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
              placeholder="e.g. Sara Riaz"
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

          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input
              className="form-input"
              type="tel"
              placeholder="e.g. +92 300 1234567"
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
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
            <label className="form-label">Specialty</label>
            <select
              className="form-select"
              value={form.specialty}
              onChange={(e) => handleChange("specialty", e.target.value)}
            >
              {SPECIALTIES.map((specialty) => (
                <option key={specialty} value={specialty}>{specialty}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Years of Experience</label>
            <input
              className="form-input"
              type="number"
              min="0"
              placeholder="e.g. 3"
              value={form.experience}
              onChange={(e) => handleChange("experience", e.target.value)}
            />
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

export default SignupTrainer;
