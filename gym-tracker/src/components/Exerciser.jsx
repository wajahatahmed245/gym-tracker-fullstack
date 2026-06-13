import { useEffect, useState } from "react";
import { BODY_PARTS, bodyPartMeta } from "../utils/bodyParts";
import { formatDateLabel, sinceLabel } from "../utils/format";
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
  const [lastSession, setLastSession] = useState(null);
  const [trainerError, setTrainerError] = useState("");

  const [workoutForm, setWorkoutForm] = useState({
    bodyPart: BODY_PARTS[0].id,
    exercise: "",
    sets: "",
    reps: "",
    weight: "",
  });

  const [cardioForm, setCardioForm] = useState({
    activity: CARDIO_TYPES[0].id,
    duration: "",
  });

  const trainerId = user?.exerciser_profile?.trainer_id || null;

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
    if (screen !== "log-workout") return;
    let cancelled = false;
    api
      .lastWorkout(workoutForm.bodyPart)
      .then((data) => {
        if (!cancelled) setLastSession(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 404) setLastSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, [screen, workoutForm.bodyPart]);

  const goHome = () => {
    setSavedMessage("");
    setError("");
    setScreen("home");
  };

  const handleWorkoutChange = (field, value) => {
    setWorkoutForm({ ...workoutForm, [field]: value });
  };

  const handleCardioChange = (field, value) => {
    setCardioForm({ ...cardioForm, [field]: value });
  };

  const submitWorkout = async (e) => {
    e.preventDefault();
    if (!workoutForm.exercise || !workoutForm.sets || !workoutForm.reps || !workoutForm.weight) {
      return;
    }
    setError("");
    try {
      await api.logWorkout({
        body_part: workoutForm.bodyPart,
        exercise: workoutForm.exercise,
        sets: Number(workoutForm.sets),
        reps: Number(workoutForm.reps),
        weight: Number(workoutForm.weight),
      });
      const [dash, w] = await Promise.all([api.dashboard(), api.listWorkouts()]);
      setDashboard(dash);
      setWorkouts(w);
      try {
        setLastSession(await api.lastWorkout(workoutForm.bodyPart));
      } catch (err) {
        if (err.status === 404) setLastSession(null);
      }
      setSavedMessage("Workout logged successfully!");
      setWorkoutForm({ bodyPart: workoutForm.bodyPart, exercise: "", sets: "", reps: "", weight: "" });
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
            <button className="btn btn-primary" onClick={() => setScreen("log-workout")}>
              💪 Log Workout
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

  if (screen === "log-workout") {
    return (
      <div>
        <div className="screen-header">
          <button className="back-button" onClick={goHome}>←</button>
          <span className="screen-title">Log Workout</span>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={submitWorkout}>
          <div className="form-group">
            <label className="form-label">Body Part</label>
            <div className="chip-row">
              {BODY_PARTS.map((part) => (
                <button
                  key={part.id}
                  type="button"
                  className={`chip ${workoutForm.bodyPart === part.id ? "active" : ""}`}
                  onClick={() => handleWorkoutChange("bodyPart", part.id)}
                >
                  <span className="chip-icon">{part.icon}</span>
                  <span>{part.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Exercise Name</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. Bench press"
              value={workoutForm.exercise}
              onChange={(e) => handleWorkoutChange("exercise", e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Sets</label>
              <input
                className="form-input"
                type="number"
                min="1"
                placeholder="4"
                value={workoutForm.sets}
                onChange={(e) => handleWorkoutChange("sets", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Reps</label>
              <input
                className="form-input"
                type="number"
                min="1"
                placeholder="8"
                value={workoutForm.reps}
                onChange={(e) => handleWorkoutChange("reps", e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Weight (kg)</label>
            <input
              className="form-input"
              type="number"
              min="0"
              placeholder="80"
              value={workoutForm.weight}
              onChange={(e) => handleWorkoutChange("weight", e.target.value)}
            />
          </div>

          <button className="btn btn-primary" type="submit">Save Workout</button>
        </form>

        {lastSession && (
          <div className="info-box">
            <div className="info-box-title">Last Session ({bodyPartMeta(lastSession.body_part)?.label})</div>
            <div>
              {formatDateLabel(lastSession.date)} — {lastSession.exercise}: {lastSession.weight}kg x{lastSession.reps} ({lastSession.sets} sets)
            </div>
          </div>
        )}

        {savedMessage && screen === "log-workout" && (
          <div className="success-box">{savedMessage}</div>
        )}
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
                  <div className="card-subtitle">
                    {item.sets} sets x {item.reps} reps @ {item.weight}kg
                  </div>
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
    const currentTrainer = trainers.find((t) => t.id === trainerId);
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
          </div>
        ) : (
          <div className="info-box">You haven't selected a trainer yet.</div>
        )}

        <div className="section">
          <div className="section-title">Assigned Workouts</div>
          {assignedWorkouts.length === 0 && (
            <div className="card-subtitle">No assigned workouts yet.</div>
          )}
          {assignedWorkouts.map((w) => {
            const meta = bodyPartMeta(w.body_part);
            return (
              <div className="card" key={w.id}>
                <div className="row-between">
                  <div className="card-title">{w.exercise}</div>
                  <span className={`tag ${meta.tagClass}`}>
                    {meta.icon} {meta.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

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
