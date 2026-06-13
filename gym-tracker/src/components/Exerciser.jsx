import { useEffect, useState } from "react";
import { BODY_PARTS, bodyPartMeta } from "../utils/bodyParts";
import { formatDateLabel, sinceLabel } from "../utils/format";
import { telHref, whatsappHref } from "../utils/phone";
import { api } from "../api/client";

const CARDIO_TYPES = [
  { id: "Running", icon: "🏃" },
  { id: "Cycling", icon: "🚴" },
  { id: "Swimming", icon: "🏊" },
  { id: "Rowing", icon: "🚣" },
  { id: "Walking", icon: "🚶" },
  { id: "Elliptical", icon: "🏃‍♀️" },
];

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

  const trainerId = user?.exerciser_profile?.trainer_id || null;
  const currentTrainer = trainers.find((t) => t.id === trainerId);

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

  const goHome = () => {
    setSavedMessage("");
    setError("");
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

  if (loading) {
    return <div className="loading-screen">Loading…</div>;
  }

  if (screen === "home") {
    return (
      <div>
        {error && <div className="auth-error">{error}</div>}
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
          <div className="section-title">Quick Actions</div>
          <div className="quick-actions">
            <button className="btn btn-primary" onClick={() => setScreen("my-exercises")}>
              💪 My Exercises
            </button>
            <button className="btn btn-outline" onClick={() => setScreen("log-cardio")}>
              🏃 Log Cardio
            </button>
            <button className="btn" onClick={() => setScreen("history")}>
              📜 View History
            </button>
            <button className="btn" onClick={() => setScreen("trainer")}>
              🧑‍🏫 My Trainer
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "my-exercises") {
    const grouped = assignedWorkouts.reduce((groups, w) => {
      if (!groups[w.body_part]) groups[w.body_part] = [];
      groups[w.body_part].push(w);
      return groups;
    }, {});

    return (
      <div>
        <div className="screen-header">
          <button className="back-button" onClick={goHome}>←</button>
          <span className="screen-title">My Exercises</span>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {savedMessage && <div className="success-box">{savedMessage}</div>}

        {assignedWorkouts.length === 0 && (
          <div className="info-box">Your trainer hasn't assigned any exercises yet.</div>
        )}

        {BODY_PARTS.filter((part) => grouped[part.id]).map((part) => (
          <div className="section" key={part.id}>
            <div className="section-title">{part.icon} {part.label}</div>
            {grouped[part.id].map((assigned) => {
              const last = lastSessions[assigned.id];
              return (
                <div className="card" key={assigned.id}>
                  <div className="row-between">
                    <div className="card-title">{assigned.exercise}</div>
                    <button className="btn btn-outline" type="button" onClick={() => toggleExpand(assigned)}>
                      {expandedId === assigned.id ? "Close" : "Log Today"}
                    </button>
                  </div>

                  {expandedId === assigned.id && (
                    <form onSubmit={(e) => submitLog(e, assigned)}>
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
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  if (screen === "history") {
    return (
      <div>
        <div className="screen-header">
          <button className="back-button" onClick={goHome}>←</button>
          <span className="screen-title">Workout History</span>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {Object.keys(groupedHistory).length === 0 && (
          <div className="card-subtitle">No workouts logged yet.</div>
        )}

        {Object.entries(groupedHistory).map(([date, items]) => (
          <div className="date-group" key={date}>
            <div className="date-heading">{formatDateLabel(date)}</div>
            {items.map((item) => {
              const meta = bodyPartMeta(item.body_part);
              return (
                <div className="card" key={item.id}>
                  <div className="row-between">
                    <div className="card-title">{item.exercise}</div>
                    <span className={`tag ${meta.tagClass}`}>
                      {meta.icon} {meta.label}
                    </span>
                  </div>
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
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  if (screen === "log-cardio") {
    return (
      <div>
        <div className="screen-header">
          <button className="back-button" onClick={goHome}>←</button>
          <span className="screen-title">Log Cardio</span>
        </div>

        {error && <div className="auth-error">{error}</div>}

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
          <div className="success-box">{savedMessage}</div>
        )}

        {cardioLogs.length > 0 && (
          <div className="section">
            <div className="section-title">Cardio History</div>
            {cardioLogs.map((log) => {
              const icon = CARDIO_TYPES.find((t) => t.id === log.activity)?.icon;
              return (
                <div className="card" key={log.id}>
                  <div className="row-between">
                    <div className="card-title">{log.activity}</div>
                    <span className="tag tag-cardio">{icon} Cardio</span>
                  </div>
                  <div className="card-subtitle">{formatDateLabel(log.date)} — {log.duration_minutes} minutes</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (screen === "trainer") {
    const otherTrainers = trainers.filter((t) => t.id !== trainerId);

    return (
      <div>
        <div className="screen-header">
          <button className="back-button" onClick={goHome}>←</button>
          <span className="screen-title">My Trainer</span>
        </div>

        {trainerError && <div className="auth-error">{trainerError}</div>}

        {currentTrainer ? (
          <div className="card">
            <div className="card-title">{currentTrainer.name}</div>
            <div className="card-subtitle">
              {currentTrainer.specialty} · {currentTrainer.experience_years} yrs experience
            </div>
            {currentTrainer.phone && (
              <div className="card-subtitle">📞 {currentTrainer.phone}</div>
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
          {otherTrainers.map((t) => (
            <div className="card" key={t.id}>
              <div className="row-between">
                <div>
                  <div className="card-title">{t.name}</div>
                  <div className="card-subtitle">{t.specialty} · {t.experience_years} yrs</div>
                </div>
                <button className="btn btn-outline" onClick={() => handleSelectTrainer(t.id)}>Select</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

export default Exerciser;
