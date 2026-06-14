import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { BODY_PARTS, bodyPartMeta } from "../utils/bodyParts";
import { formatDateLabel, formatJoinedDate, initialsFor } from "../utils/format";
import { BMI_CATEGORY_CLASS } from "../utils/health";
import { api } from "../api/client";
import { screenTransition, cardTransition, tapScale } from "../utils/motion";

function Trainer() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [clientDetail, setClientDetail] = useState(null);
  const [showAssign, setShowAssign] = useState(false);
  const [assignForm, setAssignForm] = useState({ bodyPart: BODY_PARTS[0].id, exercise: "" });
  const [assignedMessage, setAssignedMessage] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ bodyPart: BODY_PARTS[0].id, exercise: "" });

  const [notes, setNotes] = useState([]);
  const [showRemoveClient, setShowRemoveClient] = useState(false);
  const [removeNote, setRemoveNote] = useState("");

  useEffect(() => {
    api
      .clients()
      .then(setClients)
      .catch((err) => {
        if (err.status === 403) {
          setPending(true);
        } else {
          setError(err.message || "Failed to load clients.");
        }
      })
      .finally(() => setLoading(false));

    api.trainerNotes().then(setNotes).catch(() => {});
  }, []);

  useEffect(() => {
    if (pending || selectedId !== null) return;

    const interval = setInterval(() => {
      api.clients().then(setClients).catch(() => {});
      api.trainerNotes().then(setNotes).catch(() => {});
    }, 8000);

    return () => clearInterval(interval);
  }, [pending, selectedId]);

  useEffect(() => {
    if (selectedId === null) return;

    const interval = setInterval(() => {
      api.clientDetail(selectedId).then(setClientDetail).catch((err) => {
        if (err.status === 404) {
          handleClientGone("This client is no longer assigned to you.");
        }
      });
    }, 8000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const openClient = (id) => {
    setSelectedId(id);
    setShowAssign(false);
    setAssignedMessage("");
    setError("");
    setEditingId(null);
    setClientDetail(null);
    setShowRemoveClient(false);
    setRemoveNote("");
    api.clientDetail(id).then(setClientDetail).catch((err) => {
      if (err.status === 404) {
        handleClientGone("This client is no longer assigned to you.");
      } else {
        setError(err.message || "Failed to load client.");
      }
    });
  };

  const goBack = () => {
    setSelectedId(null);
    setClientDetail(null);
    setShowAssign(false);
    setAssignedMessage("");
    setError("");
    setEditingId(null);
    setShowRemoveClient(false);
    setRemoveNote("");
    api.clients().then(setClients).catch(() => {});
  };

  const handleClientGone = (message) => {
    goBack();
    setError(message);
  };

  const submitRemoveClient = async (e) => {
    e.preventDefault();
    if (!removeNote.trim()) return;
    setError("");
    try {
      await api.removeClient(selectedId, removeNote.trim());
      goBack();
    } catch (err) {
      if (err.status === 404) {
        handleClientGone("This client is no longer assigned to you.");
      } else {
        setError(err.message || "Failed to remove client.");
      }
    }
  };

  const startEdit = (assigned) => {
    setError("");
    setAssignedMessage("");
    setEditingId(assigned.id);
    setEditForm({ bodyPart: assigned.body_part, exercise: assigned.exercise });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const submitEdit = async (e, assignedId) => {
    e.preventDefault();
    if (!editForm.exercise) return;
    setError("");
    try {
      await api.updateAssignedWorkout(selectedId, assignedId, {
        body_part: editForm.bodyPart,
        exercise: editForm.exercise,
      });
      setClientDetail(await api.clientDetail(selectedId));
      setEditingId(null);
    } catch (err) {
      if (err.status === 404) {
        handleClientGone("This client is no longer assigned to you.");
      } else {
        setError(err.message || "Failed to update exercise.");
      }
    }
  };

  const removeAssigned = async (assignedId) => {
    setError("");
    try {
      await api.deleteAssignedWorkout(selectedId, assignedId);
      setClientDetail(await api.clientDetail(selectedId));
      if (editingId === assignedId) setEditingId(null);
    } catch (err) {
      if (err.status === 404) {
        handleClientGone("This client is no longer assigned to you.");
      } else {
        setError(err.message || "Failed to remove exercise.");
      }
    }
  };

  const submitAssign = async (e) => {
    e.preventDefault();
    if (!assignForm.exercise) return;
    setError("");
    try {
      await api.assignWorkout(selectedId, {
        body_part: assignForm.bodyPart,
        exercise: assignForm.exercise,
      });
      setClientDetail(await api.clientDetail(selectedId));
      setAssignedMessage(`New workout assigned to ${clientDetail?.name}!`);
      setAssignForm({ bodyPart: BODY_PARTS[0].id, exercise: "" });
      setShowAssign(false);
    } catch (err) {
      if (err.status === 404) {
        handleClientGone("This client is no longer assigned to you.");
      } else {
        setError(err.message || "Failed to assign workout.");
      }
    }
  };

  if (loading) {
    return (
      <motion.div className="loading-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        Loading…
      </motion.div>
    );
  }

  if (pending) {
    return (
      <motion.div {...screenTransition}>
        <div className="hero-card">
          <div className="hero-greeting">👥 My Clients</div>
          <div className="hero-subtitle">Your trainer account is awaiting approval</div>
        </div>
        <div className="info-box">
          Your trainer account is pending admin approval. You'll be able to see your clients once approved.
        </div>
      </motion.div>
    );
  }

  if (selectedId) {
    if (!clientDetail) {
      return (
        <motion.div className="loading-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          Loading…
        </motion.div>
      );
    }

    return (
      <motion.div {...screenTransition}>
        <div className="screen-header">
          <button className="back-button" onClick={goBack}>←</button>
          <span className="screen-title">{clientDetail.name}</span>
        </div>

        {error && (
          <motion.div className="auth-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            {error}
          </motion.div>
        )}

        <div className="card">
          <div className="card-row">
            <div className="avatar avatar-lg">{initialsFor(clientDetail.name)}</div>
            <div className="card-text">
              <div className="card-title">{clientDetail.name}</div>
              <div className="card-meta-row">
                <span className="tag tag-goal">🎯 {clientDetail.goal}</span>
                {clientDetail.joined_at && (
                  <span className="joined-badge">📅 Joined {formatJoinedDate(clientDetail.joined_at)}</span>
                )}
              </div>
            </div>
          </div>

          {showRemoveClient ? (
            <form onSubmit={submitRemoveClient} style={{ marginTop: "12px" }}>
              <div className="form-group">
                <label className="form-label">Reason for removing this client</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. Client stopped attending sessions"
                  value={removeNote}
                  onChange={(e) => setRemoveNote(e.target.value)}
                />
              </div>
              <div className="row-between">
                <button className="btn btn-danger" type="submit">Confirm Remove</button>
                <button className="btn btn-outline" type="button" onClick={() => { setShowRemoveClient(false); setRemoveNote(""); }}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <motion.button className="btn btn-outline" type="button" style={{ marginTop: "8px" }} whileTap={tapScale} onClick={() => setShowRemoveClient(true)}>
              Remove Client
            </motion.button>
          )}
        </div>

        <div className="metric-grid">
          <div className="metric-card">
            <div className="metric-value">{clientDetail.total_workouts}</div>
            <div className="metric-label">Total Workouts</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{clientDetail.streak}</div>
            <div className="metric-label">Day Streak</div>
          </div>
        </div>

        {clientDetail.health ? (
          <div className="section">
            <div className="section-title">⚖️ Health Metrics</div>
            <div className="card">
              <div className="row-between">
                <div className="card-title">BMI: {clientDetail.health.bmi}</div>
                <span className={`badge ${BMI_CATEGORY_CLASS[clientDetail.health.bmi_category] || ""}`}>
                  {clientDetail.health.bmi_category}
                </span>
              </div>
              <div className="metric-grid">
                <div className="metric-card">
                  <div className="metric-value">{clientDetail.health.bmr}</div>
                  <div className="metric-label">BMR (kcal/day)</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{clientDetail.health.tdee}</div>
                  <div className="metric-label">TDEE (kcal/day)</div>
                </div>
              </div>
              <div className="card-subtitle">
                Healthy weight range: {clientDetail.health.healthy_weight_min_kg}kg – {clientDetail.health.healthy_weight_max_kg}kg
              </div>
              {clientDetail.health.target_weight_kg != null && (
                <div className="info-box">
                  <div className="info-box-title">🎯 Target Weight</div>
                  This client's current weight is outside the healthy range. Target: {clientDetail.health.target_weight_kg}kg.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="info-box">
            This client hasn't completed their health profile yet (height, weight, age, gender, activity level).
          </div>
        )}

        <div className="section">
          <div className="section-title">🏋️ Assigned Exercises</div>
          {clientDetail.assigned_workouts.length === 0 && (
            <div className="card-subtitle">No exercises assigned yet.</div>
          )}
          {clientDetail.assigned_workouts.map((assigned, idx) => {
            const meta = bodyPartMeta(assigned.body_part);
            return (
              <motion.div className="card" key={assigned.id} {...cardTransition(idx)}>
                {editingId === assigned.id ? (
                  <form onSubmit={(e) => submitEdit(e, assigned.id)}>
                    <div className="form-group">
                      <label className="form-label">Body Part</label>
                      <div className="chip-row">
                        {BODY_PARTS.map((part) => (
                          <button
                            key={part.id}
                            type="button"
                            className={`chip ${editForm.bodyPart === part.id ? "active" : ""}`}
                            onClick={() => setEditForm({ ...editForm, bodyPart: part.id })}
                          >
                            <span className="chip-icon">{part.icon}</span>
                            <span>{part.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Exercise</label>
                      <input
                        className="form-input"
                        type="text"
                        value={editForm.exercise}
                        onChange={(e) => setEditForm({ ...editForm, exercise: e.target.value })}
                      />
                    </div>
                    <div className="row-between">
                      <button className="btn btn-success" type="submit">Save</button>
                      <button className="btn btn-outline" type="button" onClick={cancelEdit}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <div className="row-between">
                    <div className="card-title">{assigned.exercise}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className={`tag ${meta.tagClass}`}>
                        {meta.icon} {meta.label}
                      </span>
                      <button className="btn btn-outline" type="button" onClick={() => startEdit(assigned)}>Edit</button>
                      <button className="btn btn-outline" type="button" onClick={() => removeAssigned(assigned.id)}>Remove</button>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="section">
          <div className="section-title">📋 Recent Workout Logs</div>
          {clientDetail.recent_workouts.length === 0 && (
            <div className="card-subtitle">No activity yet.</div>
          )}
          {clientDetail.recent_workouts.map((item, idx) => {
            const meta = bodyPartMeta(item.body_part);
            return (
              <motion.div className="card" key={idx} {...cardTransition(idx)}>
                <div className="row-between">
                  <div className="card-title">{item.exercise}</div>
                  {meta && (
                    <span className={`tag ${meta.tagClass}`}>
                      {meta.icon} {meta.label}
                    </span>
                  )}
                </div>
                <div className="card-subtitle">{formatDateLabel(item.date)}</div>
                {item.sets.map((s) => (
                  <div className="card-subtitle" key={s.set_number}>
                    Set {s.set_number}: {s.weight}kg x {s.reps} reps
                  </div>
                ))}
              </motion.div>
            );
          })}
        </div>

        <div className="section">
          <motion.button className="btn btn-primary" whileTap={tapScale} onClick={() => setShowAssign(!showAssign)}>
            ➕ Assign New Exercise
          </motion.button>
        </div>

        {showAssign && (
          <motion.form
            onSubmit={submitAssign}
            className="section"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="form-group">
              <label className="form-label">Body Part</label>
              <div className="chip-row">
                {BODY_PARTS.map((part) => (
                  <button
                    key={part.id}
                    type="button"
                    className={`chip ${assignForm.bodyPart === part.id ? "active" : ""}`}
                    onClick={() => setAssignForm({ ...assignForm, bodyPart: part.id })}
                  >
                    <span className="chip-icon">{part.icon}</span>
                    <span>{part.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Exercise</label>
              <input
                className="form-input"
                type="text"
                placeholder="e.g. Incline bench press"
                value={assignForm.exercise}
                onChange={(e) => setAssignForm({ ...assignForm, exercise: e.target.value })}
              />
            </div>
            <button className="btn btn-success" type="submit">Assign</button>
          </motion.form>
        )}

        {assignedMessage && (
          <motion.div className="success-box" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            {assignedMessage}
          </motion.div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div {...screenTransition}>
      <div className="hero-card">
        <div className="hero-greeting">👥 My Clients</div>
        <div className="hero-subtitle">
          {clients.length === 0
            ? "No clients yet"
            : `${clients.length} ${clients.length === 1 ? "client" : "clients"} training with you`}
        </div>
      </div>

      {error && (
        <motion.div className="auth-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          {error}
        </motion.div>
      )}

      {clients.length === 0 && <div className="empty-text">No clients yet.</div>}

      <div className="section">
        {clients.map((client, idx) => (
          <motion.div className="card clickable" key={client.id} {...cardTransition(idx)} whileTap={tapScale} onClick={() => openClient(client.id)}>
            <div className="card-row">
              <div className="avatar">{initialsFor(client.name)}</div>
              <div className="card-text">
                <div className="card-title">{client.name}</div>
                <div className="card-subtitle">
                  Last workout: {client.last_workout_date ? formatDateLabel(client.last_workout_date) : "—"}
                </div>
                <div className="card-meta-row">
                  <div className="streak-badge">🔥 {client.streak} day streak</div>
                  {client.joined_at && (
                    <div className="joined-badge">📅 Joined {formatJoinedDate(client.joined_at)}</div>
                  )}
                </div>
              </div>
              <span className="chevron">›</span>
            </div>
          </motion.div>
        ))}
      </div>

      {notes.length > 0 && (
        <div className="section">
          <div className="section-title">💬 Client Feedback</div>
          {notes.map((note, idx) => (
            <motion.div className="card" key={idx} {...cardTransition(idx)}>
              <div className="row-between">
                <div className="card-title">{note.exerciser_name}</div>
                <span className="card-subtitle">{formatDateLabel(note.created_at.slice(0, 10))}</span>
              </div>
              <div className="card-subtitle">
                {note.author === "exerciser" ? "Left you" : "You removed them"} — {note.note}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default Trainer;
