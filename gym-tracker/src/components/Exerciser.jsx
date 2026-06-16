import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { BODY_PARTS, bodyPartMeta } from "../utils/bodyParts";
import { formatDateLabel, formatJoinedDate, sinceLabel } from "../utils/format";
import { telHref, whatsappHref, buildLeaveMessage } from "../utils/phone";
import { ACTIVITY_LEVELS, BMI_CATEGORY_CLASS, GENDERS } from "../utils/health";
import { toLocalDateStr, buildCalendarCells, WEEKDAY_LABELS } from "../utils/calendar";
import { api } from "../api/client";
import { screenTransition, cardTransition, tabContent, tapScale, popIn } from "../utils/motion";
import AvailabilityCalendar from "./AvailabilityCalendar";
import UnavailabilityTicker from "./UnavailabilityTicker";

const CARDIO_TYPES = [
  { id: "Running", icon: "🏃" },
  { id: "Cycling", icon: "🚴" },
  { id: "Swimming", icon: "🏊" },
  { id: "Rowing", icon: "🚣" },
  { id: "Walking", icon: "🚶" },
  { id: "Elliptical", icon: "🏃‍♀️" },
];

function HealthCard({ health, currentWeight }) {
  const { healthy_weight_min_kg: min, healthy_weight_max_kg: max } = health;

  let percent = 50;
  if (currentWeight < min) {
    percent = Math.max(2, (currentWeight / min) * 25);
  } else if (currentWeight > max) {
    percent = Math.min(98, 75 + ((currentWeight - max) / max) * 25);
  } else if (max > min) {
    percent = 25 + ((currentWeight - min) / (max - min)) * 50;
  }

  return (
    <div className="health-card">
      <div className="health-card-top">
        <div>
          <div className="health-bmi-value">{health.bmi}</div>
          <div className="health-bmi-label">BMI</div>
        </div>
        <span className={`badge ${BMI_CATEGORY_CLASS[health.bmi_category] || ""}`}>
          {health.bmi_category}
        </span>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-value">{health.bmr}</div>
          <div className="metric-label">BMR (kcal/day)</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{health.tdee}</div>
          <div className="metric-label">TDEE (kcal/day)</div>
        </div>
      </div>

      <div className="health-range-bar">
        <div className="health-range-marker" style={{ left: `${percent}%` }} />
      </div>
      <div className="health-range-labels">
        <span>{min}kg</span>
        <span>Healthy Range</span>
        <span>{max}kg</span>
      </div>

      {health.target_weight_kg != null && (
        <div className="info-box">
          <div className="info-box-title">🎯 Target Weight</div>
          Aim for {health.target_weight_kg}kg to reach a healthy BMI range.
        </div>
      )}
    </div>
  );
}

function Exerciser({ user, onUserChange }) {
  const [screen, setScreen] = useState("home");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  const [dashboard, setDashboard] = useState({ workouts_this_week: 0, days_since_last_workout: null });
  const [workouts, setWorkouts] = useState([]);
  const [cardioLogs, setCardioLogs] = useState([]);
  const [assignedWorkouts, setAssignedWorkouts] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [trainerError, setTrainerError] = useState("");

  const [expandedId, setExpandedId] = useState(null);
  const [logSets, setLogSets] = useState([{ reps: "", weight: "" }]);
  const [lastSessions, setLastSessions] = useState({});

  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveNote, setLeaveNote] = useState("");

  const [editingWorkoutId, setEditingWorkoutId] = useState(null);
  const [editWorkoutSets, setEditWorkoutSets] = useState([{ reps: "", weight: "" }]);

  const [cardioForm, setCardioForm] = useState({
    activity: CARDIO_TYPES[0].id,
    duration: "",
  });

  const [profileForm, setProfileForm] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [historyView, setHistoryView] = useState("list");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateStr(new Date()));
  const [exerciseFilterBodyPart, setExerciseFilterBodyPart] = useState(null);
  const [exerciseFilterId, setExerciseFilterId] = useState(null);

  const [myUnavailableDates, setMyUnavailableDates] = useState([]);
  const [trainerUnavailableDates, setTrainerUnavailableDates] = useState([]);

  const trainerId = user?.exerciser_profile?.trainer_id || null;
  const currentTrainer = trainers.find((t) => t.id === trainerId);

  const unavailabilityTickerItems = [
    ...myUnavailableDates.map((d) => ({ icon: "🚫", date: d, mine: true, label: `You: ${formatDateLabel(d)}` })),
    ...trainerUnavailableDates.map((d) => ({
      icon: "🧑‍🏫",
      date: d,
      mine: false,
      label: `${currentTrainer?.name || "Trainer"}: ${formatDateLabel(d)}`,
    })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.dashboard(),
      api.listWorkouts(),
      api.listCardio(),
      api.assignedWorkouts(),
      api.listTrainers(),
    ])
      .then(([dash, w, c, aw, t]) => {
        if (cancelled) return;
        setDashboard(dash);
        setWorkouts(w);
        setCardioLogs(c);
        setAssignedWorkouts(aw);
        setTrainers(t);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (screen !== "home" && screen !== "my-exercises") return;
    let cancelled = false;
    const interval = setInterval(() => {
      api
        .assignedWorkouts()
        .then((aw) => {
          if (cancelled) return;
          setAssignedWorkouts(aw);
          setExpandedId((current) => (current && !aw.some((w) => w.id === current) ? null : current));
        })
        .catch(() => {});
    }, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [screen]);

  useEffect(() => {
    if (screen !== "home" && screen !== "availability") return;
    let cancelled = false;

    const fetchUnavailability = () => {
      api
        .myUnavailability()
        .then((rows) => {
          if (!cancelled) setMyUnavailableDates(rows.map((r) => r.date));
        })
        .catch(() => {});

      if (trainerId) {
        api
          .trainerUnavailability()
          .then((rows) => {
            if (!cancelled) setTrainerUnavailableDates(rows.map((r) => r.date));
          })
          .catch(() => {});
      }
    };

    fetchUnavailability();
    const interval = setInterval(fetchUnavailability, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [screen, trainerId]);

  const goHome = () => {
    setSavedMessage("");
    setError("");
    setProfileError("");
    setShowLeaveForm(false);
    setLeaveNote("");
    setEditingWorkoutId(null);
    setScreen("home");
  };

  const handleCardioChange = (field, value) => {
    setCardioForm({ ...cardioForm, [field]: value });
  };

  const updateSetRow = (index, field, value) => {
    setLogSets(logSets.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const addSetRow = () => {
    setLogSets([...logSets, { reps: "", weight: "" }]);
  };

  const removeSetRow = (index) => {
    setLogSets(logSets.filter((_, i) => i !== index));
  };

  const updateEditSetRow = (index, field, value) => {
    setEditWorkoutSets(editWorkoutSets.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const addEditSetRow = () => {
    setEditWorkoutSets([...editWorkoutSets, { reps: "", weight: "" }]);
  };

  const removeEditSetRow = (index) => {
    setEditWorkoutSets(editWorkoutSets.filter((_, i) => i !== index));
  };

  const startEditWorkout = (item) => {
    setError("");
    setEditingWorkoutId(item.id);
    setEditWorkoutSets(item.sets.map((s) => ({ reps: String(s.reps), weight: String(s.weight) })));
  };

  const cancelEditWorkout = () => {
    setEditingWorkoutId(null);
  };

  const submitEditWorkout = async (e, workoutId) => {
    e.preventDefault();
    if (editWorkoutSets.length === 0 || editWorkoutSets.some((row) => !row.reps || row.weight === "")) {
      return;
    }
    setError("");
    try {
      const updated = await api.updateWorkout(workoutId, {
        sets: editWorkoutSets.map((row) => ({ reps: Number(row.reps), weight: Number(row.weight) })),
      });
      setWorkouts(workouts.map((w) => (w.id === workoutId ? updated : w)));
      if (lastSessions[updated.assigned_workout_id]?.id === workoutId) {
        setLastSessions((prev) => ({ ...prev, [updated.assigned_workout_id]: updated }));
      }
      setEditingWorkoutId(null);
    } catch (err) {
      setError(err.message || "Failed to update workout.");
    }
  };

  const deleteWorkoutEntry = async (workoutId) => {
    if (!window.confirm("Delete this workout entry? This cannot be undone.")) return;
    setError("");
    try {
      await api.deleteWorkout(workoutId);
      setWorkouts(workouts.filter((w) => w.id !== workoutId));
      const [dash] = await Promise.all([api.dashboard()]);
      setDashboard(dash);
      if (editingWorkoutId === workoutId) setEditingWorkoutId(null);
    } catch (err) {
      setError(err.message || "Failed to delete workout.");
    }
  };

  const submitLeaveTrainer = async (e) => {
    e.preventDefault();
    if (!leaveNote.trim()) return;
    setTrainerError("");
    try {
      await api.leaveTrainer(leaveNote.trim());
      await Promise.all([onUserChange?.(), api.assignedWorkouts().then(setAssignedWorkouts)]);
      setLeaveNote("");
      setShowLeaveForm(false);
    } catch (err) {
      setTrainerError(err.message || "Failed to leave trainer.");
    }
  };

  const toggleExpand = (assigned) => {
    setError("");
    setSavedMessage("");
    if (expandedId === assigned.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(assigned.id);
    setLogSets([{ reps: "", weight: "" }]);
    if (!(assigned.id in lastSessions)) {
      api
        .lastWorkoutFor(assigned.id)
        .then((data) => setLastSessions((prev) => ({ ...prev, [assigned.id]: data })))
        .catch((err) => {
          if (err.status === 404) setLastSessions((prev) => ({ ...prev, [assigned.id]: null }));
        });
    }
  };

  const submitLog = async (e, assigned) => {
    e.preventDefault();
    if (logSets.length === 0 || logSets.some((row) => !row.reps || row.weight === "")) {
      return;
    }
    setError("");
    try {
      const logged = await api.logAssignedWorkout(assigned.id, {
        sets: logSets.map((row) => ({ reps: Number(row.reps), weight: Number(row.weight) })),
      });
      const [dash, w] = await Promise.all([api.dashboard(), api.listWorkouts()]);
      setDashboard(dash);
      setWorkouts(w);
      setLastSessions((prev) => ({ ...prev, [assigned.id]: logged }));
      setSavedMessage("Workout logged successfully!");
      setLogSets([{ reps: "", weight: "" }]);
      setExpandedId(null);
    } catch (err) {
      setError(err.message || "Failed to log workout.");
    }
  };

  const submitCardio = async (e) => {
    e.preventDefault();
    if (!cardioForm.duration) {
      return;
    }
    setError("");
    try {
      await api.logCardio({
        activity: cardioForm.activity,
        duration_minutes: Number(cardioForm.duration),
      });
      setCardioLogs(await api.listCardio());
      setSavedMessage("Cardio logged successfully!");
      setCardioForm({ activity: cardioForm.activity, duration: "" });
    } catch (err) {
      setError(err.message || "Failed to log cardio.");
    }
  };

  const openHealth = () => {
    const profile = user?.exerciser_profile || {};
    setProfileForm({
      height: profile.height_cm != null ? String(profile.height_cm) : "",
      weight: profile.weight_kg != null ? String(profile.weight_kg) : "",
      age: profile.age != null ? String(profile.age) : "",
      gender: profile.gender || GENDERS[0],
      activityLevel: profile.activity_level || ACTIVITY_LEVELS[0].id,
    });
    setProfileError("");
    setSavedMessage("");
    setScreen("health");
  };

  const handleProfileChange = (field, value) => {
    setProfileForm({ ...profileForm, [field]: value });
  };

  const submitProfile = async (e) => {
    e.preventDefault();
    if (!profileForm.height || !profileForm.weight || !profileForm.age) {
      setProfileError("Please fill in all fields.");
      return;
    }
    setProfileError("");
    setProfileSaving(true);
    try {
      await api.updateProfile({
        height_cm: Number(profileForm.height),
        weight_kg: Number(profileForm.weight),
        age: Number(profileForm.age),
        gender: profileForm.gender,
        activity_level: profileForm.activityLevel,
      });
      await onUserChange?.();
      setSavedMessage("Profile updated successfully!");
    } catch (err) {
      setProfileError(err.message || "Failed to update profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSelectTrainer = async (id) => {
    setTrainerError("");
    try {
      await api.selectTrainer(id);
      await Promise.all([onUserChange?.(), api.assignedWorkouts().then(setAssignedWorkouts)]);
    } catch (err) {
      setTrainerError(err.message || "Failed to select trainer.");
    }
  };

  const groupedHistory = workouts.reduce((groups, workout) => {
    if (!groups[workout.date]) groups[workout.date] = [];
    groups[workout.date].push(workout);
    return groups;
  }, {});

  const workoutDates = new Set(workouts.map((w) => w.date));

  const exerciseOptionsByBodyPart = workouts.reduce((groups, w) => {
    if (!groups[w.body_part]) groups[w.body_part] = [];
    if (!groups[w.body_part].some((e) => e.id === w.assigned_workout_id)) {
      groups[w.body_part].push({ id: w.assigned_workout_id, exercise: w.exercise });
    }
    return groups;
  }, {});

  const exerciseHistory = exerciseFilterId
    ? workouts.filter((w) => w.assigned_workout_id === exerciseFilterId)
    : [];

  const goToMonth = (delta) => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + delta, 1));
  };

  const renderWorkoutCard = (item, { showDate = false, index = 0, anim } = {}) => {
    const meta = bodyPartMeta(item.body_part);
    return (
      <motion.div className="card" key={item.id} {...(anim || cardTransition(index))}>
        <div className="row-between">
          <div className="card-title">{item.exercise}</div>
          <span className={`tag ${meta.tagClass}`}>
            {meta.icon} {meta.label}
          </span>
        </div>
        {showDate && <div className="card-subtitle">{formatDateLabel(item.date)}</div>}
        <div className="card-subtitle">Assigned by {item.trainer_name}</div>

        {editingWorkoutId === item.id ? (
          <form onSubmit={(e) => submitEditWorkout(e, item.id)}>
            {editWorkoutSets.map((row, idx) => (
              <div className="form-row" key={idx}>
                <div className="form-group">
                  <label className="form-label">Set {idx + 1} Weight (kg)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    value={row.weight}
                    onChange={(e) => updateEditSetRow(idx, "weight", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Reps</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    value={row.reps}
                    onChange={(e) => updateEditSetRow(idx, "reps", e.target.value)}
                  />
                </div>
                {editWorkoutSets.length > 1 && (
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={() => removeEditSetRow(idx)}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button className="btn btn-outline" type="button" onClick={addEditSetRow}>
              ➕ Add Set
            </button>
            <div className="row-between">
              <button className="btn btn-success" type="submit">Save</button>
              <button className="btn btn-outline" type="button" onClick={cancelEditWorkout}>Cancel</button>
            </div>
          </form>
        ) : (
          <>
            {item.sets.map((s) => (
              <div className="card-subtitle" key={s.set_number}>
                Set {s.set_number}: {s.weight}kg x {s.reps} reps
              </div>
            ))}
            <div className="row-between">
              <button className="btn btn-outline" type="button" onClick={() => startEditWorkout(item)}>
                Edit
              </button>
              <button className="btn btn-outline" type="button" onClick={() => deleteWorkoutEntry(item.id)}>
                Delete
              </button>
            </div>
          </>
        )}
      </motion.div>
    );
  };

  if (loading) {
    return (
      <motion.div className="loading-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        Loading…
      </motion.div>
    );
  }

  if (screen === "home") {
    return (
      <motion.div {...screenTransition}>
        {error && (
          <motion.div className="auth-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            {error}
          </motion.div>
        )}

        <UnavailabilityTicker items={unavailabilityTickerItems} />

        <div className="hero-card">
          <div className="hero-greeting">Welcome back, {user?.name} 👋</div>
          {currentTrainer && (
            <div className="hero-trainer">🧑‍🏫 Trainer: {currentTrainer.name}</div>
          )}
          <div className="hero-subtitle">Here's how your week is going</div>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-value">{dashboard.workouts_this_week}</div>
              <div className="hero-stat-label">Workouts This Week</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">{sinceLabel(dashboard.days_since_last_workout)}</div>
              <div className="hero-stat-label">Since Last Workout</div>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-title">⚖️ Health Snapshot</div>
          {user?.exerciser_profile?.health ? (
            <HealthCard
              health={user.exerciser_profile.health}
              currentWeight={user.exerciser_profile.weight_kg}
            />
          ) : (
            <div className="health-setup-card">
              <div className="card-title">Complete your health profile</div>
              <p>
                Add your height, weight, age, gender, and activity level to see your BMI, BMR, TDEE,
                and a personalized healthy weight range.
              </p>
              <button className="btn btn-primary" type="button" onClick={openHealth}>
                Set Up Now
              </button>
            </div>
          )}
        </div>

        <div className="section">
          <div className="section-title">Quick Actions</div>
          <div className="quick-actions">
            <motion.button className="btn btn-primary" whileTap={tapScale} onClick={() => setScreen("my-exercises")}>
              💪 My Exercises
            </motion.button>
            <motion.button className="btn btn-outline" whileTap={tapScale} onClick={() => setScreen("log-cardio")}>
              🏃 Log Cardio
            </motion.button>
            <motion.button className="btn" whileTap={tapScale} onClick={() => setScreen("history")}>
              📜 View History
            </motion.button>
            <motion.button className="btn" whileTap={tapScale} onClick={() => setScreen("trainer")}>
              🧑‍🏫 My Trainer
            </motion.button>
            <motion.button className="btn" whileTap={tapScale} onClick={openHealth}>
              ⚖️ My Health
            </motion.button>
            <motion.button className="btn" whileTap={tapScale} onClick={() => setScreen("availability")}>
              🗓️ My Availability
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (screen === "my-exercises") {
    const grouped = assignedWorkouts.reduce((groups, w) => {
      if (!groups[w.body_part]) groups[w.body_part] = [];
      groups[w.body_part].push(w);
      return groups;
    }, {});

    return (
      <motion.div {...screenTransition}>
        <div className="screen-header">
          <button className="back-button" onClick={goHome}>←</button>
          <span className="screen-title">My Exercises</span>
        </div>

        {error && (
          <motion.div className="auth-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            {error}
          </motion.div>
        )}
        {savedMessage && (
          <motion.div className="success-box" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            {savedMessage}
          </motion.div>
        )}

        {assignedWorkouts.length === 0 && (
          <div className="info-box">Your trainer hasn't assigned any exercises yet.</div>
        )}

        {BODY_PARTS.filter((part) => grouped[part.id]).map((part) => (
          <div className="section" key={part.id}>
            <div className="section-title">{part.icon} {part.label}</div>
            {grouped[part.id].map((assigned, idx) => {
              const last = lastSessions[assigned.id];
              return (
                <motion.div className="card" key={assigned.id} {...cardTransition(idx)}>
                  <div className="row-between">
                    <div className="card-title">{assigned.exercise}</div>
                    <button className="btn btn-outline" type="button" onClick={() => toggleExpand(assigned)}>
                      {expandedId === assigned.id ? "Close" : "Log Today"}
                    </button>
                  </div>

                  {expandedId === assigned.id && (
                    <motion.form
                      onSubmit={(e) => submitLog(e, assigned)}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      style={{ overflow: "hidden" }}
                    >
                      {last && (
                        <div className="card-subtitle">
                          Last ({formatDateLabel(last.date)}): {last.sets
                            .map((s) => `${s.weight}kg x${s.reps}`)
                            .join(", ")}
                        </div>
                      )}
                      {last === null && (
                        <div className="card-subtitle">No previous session yet.</div>
                      )}

                      {logSets.map((row, idx) => (
                        <div className="form-row" key={idx}>
                          <div className="form-group">
                            <label className="form-label">Set {idx + 1} Weight (kg)</label>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              placeholder="80"
                              value={row.weight}
                              onChange={(e) => updateSetRow(idx, "weight", e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Reps</label>
                            <input
                              className="form-input"
                              type="number"
                              min="1"
                              placeholder="8"
                              value={row.reps}
                              onChange={(e) => updateSetRow(idx, "reps", e.target.value)}
                            />
                          </div>
                          {logSets.length > 1 && (
                            <button
                              className="btn btn-outline"
                              type="button"
                              onClick={() => removeSetRow(idx)}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}

                      <button className="btn btn-outline" type="button" onClick={addSetRow}>
                        ➕ Add Set
                      </button>

                      <button className="btn btn-primary" type="submit">Save</button>
                    </motion.form>
                  )}
                </motion.div>
              );
            })}
          </div>
        ))}
      </motion.div>
    );
  }

  if (screen === "history") {
    return (
      <motion.div {...screenTransition}>
        <div className="screen-header">
          <button className="back-button" onClick={goHome}>←</button>
          <span className="screen-title">Workout History</span>
        </div>

        {error && (
          <motion.div className="auth-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            {error}
          </motion.div>
        )}

        <div className="filter-tabs">
          <button
            className={`filter-tab ${historyView === "list" ? "active" : ""}`}
            onClick={() => setHistoryView("list")}
          >
            📜 List
          </button>
          <button
            className={`filter-tab ${historyView === "calendar" ? "active" : ""}`}
            onClick={() => setHistoryView("calendar")}
          >
            📅 Calendar
          </button>
          <button
            className={`filter-tab ${historyView === "exercise" ? "active" : ""}`}
            onClick={() => setHistoryView("exercise")}
          >
            🏋️ By Exercise
          </button>
        </div>

        <AnimatePresence mode="wait">
        {historyView === "list" && (
          <motion.div key="list" {...tabContent}>
            {Object.keys(groupedHistory).length === 0 && (
              <div className="card-subtitle">No workouts logged yet.</div>
            )}
            {Object.entries(groupedHistory).map(([date, items]) => (
              <div className="date-group" key={date}>
                <div className="date-heading">{formatDateLabel(date)}</div>
                {items.map((item, idx) => renderWorkoutCard(item, { index: idx }))}
              </div>
            ))}
          </motion.div>
        )}

        {historyView === "calendar" && (
          <motion.div key="calendar" {...tabContent}>
            <div className="calendar-header">
              <button className="calendar-nav-btn" type="button" onClick={() => goToMonth(-1)}>‹</button>
              <span className="calendar-header-title">
                {calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </span>
              <button className="calendar-nav-btn" type="button" onClick={() => goToMonth(1)}>›</button>
            </div>
            <div className="calendar-grid">
              {WEEKDAY_LABELS.map((label, idx) => (
                <div className="calendar-weekday" key={idx}>{label}</div>
              ))}
              {buildCalendarCells(calendarMonth).map((dateStr, idx) => {
                if (!dateStr) return <div className="calendar-day empty" key={idx} />;
                const dayNum = Number(dateStr.slice(-2));
                const classes = ["calendar-day"];
                if (workoutDates.has(dateStr)) classes.push("has-workout");
                if (dateStr === selectedDate) classes.push("selected");
                if (dateStr === toLocalDateStr(new Date())) classes.push("today");
                return (
                  <motion.button
                    key={dateStr}
                    type="button"
                    whileTap={{ scale: 0.85 }}
                    className={classes.join(" ")}
                    onClick={() => setSelectedDate(dateStr)}
                  >
                    {dayNum}
                  </motion.button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.div className="section" key={selectedDate} {...tabContent}>
                <div className="date-heading">{formatDateLabel(selectedDate)}</div>
                {(groupedHistory[selectedDate] || []).length === 0 ? (
                  <div className="card-subtitle">No workouts logged on this date.</div>
                ) : (
                  groupedHistory[selectedDate].map((item, idx) => renderWorkoutCard(item, { index: idx }))
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}

        {historyView === "exercise" && (
          <motion.div key="exercise" {...tabContent}>
            {Object.keys(exerciseOptionsByBodyPart).length === 0 ? (
              <div className="card-subtitle">No workouts logged yet.</div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">Body Part</label>
                  <div className="chip-row">
                    {BODY_PARTS.filter((part) => exerciseOptionsByBodyPart[part.id]).map((part) => (
                      <button
                        key={part.id}
                        type="button"
                        className={`chip ${exerciseFilterBodyPart === part.id ? "active" : ""}`}
                        onClick={() => {
                          setExerciseFilterBodyPart(part.id);
                          setExerciseFilterId(null);
                        }}
                      >
                        <span className="chip-icon">{part.icon}</span>
                        <span>{part.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {exerciseFilterBodyPart && (
                  <div className="form-group">
                    <label className="form-label">Exercise</label>
                    <select
                      className="form-select"
                      value={exerciseFilterId || ""}
                      onChange={(e) => setExerciseFilterId(Number(e.target.value) || null)}
                    >
                      <option value="">Select an exercise</option>
                      {exerciseOptionsByBodyPart[exerciseFilterBodyPart].map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.exercise}</option>
                      ))}
                    </select>
                  </div>
                )}

                {exerciseFilterId && (
                  <div className="section">
                    <div className="section-title">Latest Record</div>
                    <div className="info-box">
                      Showing only your most recent logged session for this exercise. For full history, switch
                      to the List or Calendar view.
                    </div>
                    {exerciseHistory.length === 0 ? (
                      <div className="card-subtitle">No history logged for this exercise yet.</div>
                    ) : (
                      <AnimatePresence mode="wait">
                        {renderWorkoutCard(exerciseHistory[0], { showDate: true, anim: popIn })}
                      </AnimatePresence>
                    )}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
        </AnimatePresence>
      </motion.div>
    );
  }

  if (screen === "log-cardio") {
    return (
      <motion.div {...screenTransition}>
        <div className="screen-header">
          <button className="back-button" onClick={goHome}>←</button>
          <span className="screen-title">Log Cardio</span>
        </div>

        {error && (
          <motion.div className="auth-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            {error}
          </motion.div>
        )}

        <form onSubmit={submitCardio}>
          <div className="form-group">
            <label className="form-label">Activity Type</label>
            <div className="chip-row">
              {CARDIO_TYPES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  className={`chip ${cardioForm.activity === type.id ? "active" : ""}`}
                  onClick={() => handleCardioChange("activity", type.id)}
                >
                  <span className="chip-icon">{type.icon}</span>
                  <span>{type.id}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Duration (minutes)</label>
            <input
              className="form-input"
              type="number"
              min="1"
              placeholder="30"
              value={cardioForm.duration}
              onChange={(e) => handleCardioChange("duration", e.target.value)}
            />
          </div>

          <button className="btn btn-primary" type="submit">Save Cardio</button>
        </form>

        {savedMessage && screen === "log-cardio" && (
          <motion.div className="success-box" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            {savedMessage}
          </motion.div>
        )}

        {cardioLogs.length > 0 && (
          <div className="section">
            <div className="section-title">Cardio History</div>
            {cardioLogs.map((log, idx) => {
              const icon = CARDIO_TYPES.find((t) => t.id === log.activity)?.icon;
              return (
                <motion.div className="card" key={log.id} {...cardTransition(idx)}>
                  <div className="row-between">
                    <div className="card-title">{log.activity}</div>
                    <span className="tag tag-cardio">{icon} Cardio</span>
                  </div>
                  <div className="card-subtitle">{formatDateLabel(log.date)} — {log.duration_minutes} minutes</div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    );
  }

  if (screen === "trainer") {
    const otherTrainers = trainers.filter((t) => t.id !== trainerId);

    return (
      <motion.div {...screenTransition}>
        <div className="screen-header">
          <button className="back-button" onClick={goHome}>←</button>
          <span className="screen-title">My Trainer</span>
        </div>

        {trainerError && (
          <motion.div className="auth-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            {trainerError}
          </motion.div>
        )}

        {currentTrainer ? (
          <div className="card">
            <div className="card-title">{currentTrainer.name}</div>
            <div className="card-subtitle">
              {currentTrainer.specialty} · {currentTrainer.experience_years} yrs experience
            </div>
            {currentTrainer.phone && (
              <div className="card-subtitle">📞 {currentTrainer.phone}</div>
            )}
            {user?.exerciser_profile?.trainer_joined_at && (
              <div className="joined-badge">
                📅 Joined {formatJoinedDate(user.exerciser_profile.trainer_joined_at)}
              </div>
            )}
            {currentTrainer.phone && (
              <div className="row-between" style={{ marginTop: "8px" }}>
                <a className="btn btn-outline" href={telHref(currentTrainer.phone)}>
                  📞 Call
                </a>
                <a
                  className="btn btn-outline"
                  href={whatsappHref(currentTrainer.phone)}
                  target="_blank"
                  rel="noreferrer"
                >
                  💬 WhatsApp
                </a>
              </div>
            )}

            {showLeaveForm ? (
              <form onSubmit={submitLeaveTrainer} style={{ marginTop: "12px" }}>
                <div className="form-group">
                  <label className="form-label">Reason for leaving</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g. Switching to a trainer closer to home"
                    value={leaveNote}
                    onChange={(e) => setLeaveNote(e.target.value)}
                  />
                </div>
                <div className="row-between">
                  <button className="btn btn-danger" type="submit">Confirm Leave</button>
                  <button className="btn btn-outline" type="button" onClick={() => { setShowLeaveForm(false); setLeaveNote(""); }}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button className="btn btn-outline" type="button" style={{ marginTop: "8px" }} onClick={() => setShowLeaveForm(true)}>
                Leave Trainer
              </button>
            )}
          </div>
        ) : (
          <div className="info-box">You haven't selected a trainer yet.</div>
        )}

        <div className="section">
          <div className="section-title">{currentTrainer ? "Switch Trainer" : "Choose a Trainer"}</div>
          {otherTrainers.length === 0 && (
            <div className="card-subtitle">No trainers available right now.</div>
          )}
          {otherTrainers.map((t, idx) => (
            <motion.div className="card" key={t.id} {...cardTransition(idx)}>
              <div className="row-between">
                <div>
                  <div className="card-title">{t.name}</div>
                  <div className="card-subtitle">{t.specialty} · {t.experience_years} yrs</div>
                </div>
                <button className="btn btn-outline" onClick={() => handleSelectTrainer(t.id)}>Select</button>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  }

  if (screen === "availability") {
    const formattedMyDates = myUnavailableDates.map((d) => formatDateLabel(d));

    return (
      <motion.div {...screenTransition}>
        <div className="screen-header">
          <button className="back-button" onClick={goHome}>←</button>
          <span className="screen-title">My Availability</span>
        </div>

        <AvailabilityCalendar
          title="Days you're unavailable"
          subtitle="Your trainer won't be able to assign new exercises on these days."
          onChange={setMyUnavailableDates}
        />

        {currentTrainer?.phone && myUnavailableDates.length > 0 && (
          <a
            className="btn btn-success"
            style={{ marginTop: "12px" }}
            href={whatsappHref(currentTrainer.phone, buildLeaveMessage(formattedMyDates))}
            target="_blank"
            rel="noreferrer"
          >
            📲 Notify {currentTrainer.name} via WhatsApp
          </a>
        )}

        {currentTrainer && (
          <div className="section">
            <div className="section-title">{currentTrainer.name}'s upcoming leave days</div>
            {trainerUnavailableDates.length === 0 ? (
              <div className="card-subtitle">No upcoming leave days.</div>
            ) : (
              <div className="chip-row">
                {trainerUnavailableDates.map((d) => (
                  <span className="chip" key={d}>{formatDateLabel(d)}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>
    );
  }

  if (screen === "health") {
    const health = user?.exerciser_profile?.health;

    return (
      <motion.div {...screenTransition}>
        <div className="screen-header">
          <button className="back-button" onClick={goHome}>←</button>
          <span className="screen-title">My Health</span>
        </div>

        {savedMessage && (
          <motion.div className="success-box" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            {savedMessage}
          </motion.div>
        )}

        {health ? (
          <div className="section">
            <div className="section-title">Health Metrics</div>
            <HealthCard health={health} currentWeight={user.exerciser_profile.weight_kg} />
          </div>
        ) : (
          <div className="info-box">
            Fill in your height, weight, age, gender, and activity level below to see your BMI, BMR, TDEE,
            and healthy weight range.
          </div>
        )}

        <div className="section">
          <div className="section-title">Edit Profile</div>

          {profileError && (
            <motion.div className="auth-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
              {profileError}
            </motion.div>
          )}

          {profileForm && (
            <form onSubmit={submitProfile}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Height (cm)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    step="0.1"
                    placeholder="e.g. 175"
                    value={profileForm.height}
                    onChange={(e) => handleProfileChange("height", e.target.value)}
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
                    value={profileForm.weight}
                    onChange={(e) => handleProfileChange("weight", e.target.value)}
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
                    value={profileForm.age}
                    onChange={(e) => handleProfileChange("age", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select
                    className="form-select"
                    value={profileForm.gender}
                    onChange={(e) => handleProfileChange("gender", e.target.value)}
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
                  value={profileForm.activityLevel}
                  onChange={(e) => handleProfileChange("activityLevel", e.target.value)}
                >
                  {ACTIVITY_LEVELS.map((level) => (
                    <option key={level.id} value={level.id}>{level.label}</option>
                  ))}
                </select>
              </div>

              <button className="btn btn-primary" type="submit" disabled={profileSaving}>
                {profileSaving ? "Saving…" : "Save Profile"}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    );
  }

  return null;
}

export default Exerciser;
