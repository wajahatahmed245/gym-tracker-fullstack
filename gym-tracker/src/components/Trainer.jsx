import { useEffect, useState } from "react";
import { BODY_PARTS, bodyPartMeta } from "../utils/bodyParts";
import { formatDateLabel, initialsFor } from "../utils/format";
import { api } from "../api/client";

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
  }, []);

  const openClient = (id) => {
    setSelectedId(id);
    setShowAssign(false);
    setAssignedMessage("");
    setError("");
    setEditingId(null);
    setClientDetail(null);
    api.clientDetail(id).then(setClientDetail).catch((err) => setError(err.message || "Failed to load client."));
  };

  const goBack = () => {
    setSelectedId(null);
    setClientDetail(null);
    setShowAssign(false);
    setAssignedMessage("");
    setError("");
    setEditingId(null);
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
      setError(err.message || "Failed to update exercise.");
    }
  };

  const removeAssigned = async (assignedId) => {
    setError("");
    try {
      await api.deleteAssignedWorkout(selectedId, assignedId);
      setClientDetail(await api.clientDetail(selectedId));
      if (editingId === assignedId) setEditingId(null);
    } catch (err) {
      setError(err.message || "Failed to remove exercise.");
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
      setError(err.message || "Failed to assign workout.");
    }
  };

  if (loading) {
    return <div className="loading-screen">Loading…</div>;
  }

  if (pending) {
    return (
      <div>
        <div className="screen-header">
          <span className="screen-title">My Clients</span>
        </div>
        <div className="info-box">
          Your trainer account is pending admin approval. You'll be able to see your clients once approved.
        </div>
      </div>
    );
  }

  if (selectedId) {
    if (!clientDetail) {
      return <div className="loading-screen">Loading…</div>;
    }

    return (
      <div>
        <div className="screen-header">
          <button className="back-button" onClick={goBack}>←</button>
          <span className="screen-title">{clientDetail.name}</span>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <div className="card">
          <div className="card-row">
            <div className="avatar">{initialsFor(clientDetail.name)}</div>
            <div className="card-text">
              <div className="card-title">{clientDetail.name}</div>
              <div className="card-subtitle">Goal: {clientDetail.goal}</div>
            </div>
          </div>
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

        <div className="section">
          <div className="section-title">Assigned Exercises</div>
          {clientDetail.assigned_workouts.length === 0 && (
            <div className="card-subtitle">No exercises assigned yet.</div>
          )}
          {clientDetail.assigned_workouts.map((assigned) => {
            const meta = bodyPartMeta(assigned.body_part);
            return (
              <div className="card" key={assigned.id}>
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
              </div>
            );
          })}
        </div>

        <div className="section">
          <div className="section-title">Recent Workout Logs</div>
          {clientDetail.recent_workouts.length === 0 && (
            <div className="card-subtitle">No activity yet.</div>
          )}
          {clientDetail.recent_workouts.map((item, idx) => {
            const meta = bodyPartMeta(item.body_part);
            return (
              <div className="card" key={idx}>
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
              </div>
            );
          })}
        </div>

        <div className="section">
          <button className="btn btn-primary" onClick={() => setShowAssign(!showAssign)}>
            ➕ Assign New Exercise
          </button>
        </div>

        {showAssign && (
          <form onSubmit={submitAssign} className="section">
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
          </form>
        )}

        {assignedMessage && <div className="success-box">{assignedMessage}</div>}
      </div>
    );
  }

  return (
    <div>
      <div className="screen-header">
        <span className="screen-title">My Clients</span>
      </div>

      {error && <div className="auth-error">{error}</div>}

      {clients.length === 0 && <div className="card-subtitle">No clients yet.</div>}

      {clients.map((client) => (
        <div className="card clickable" key={client.id} onClick={() => openClient(client.id)}>
          <div className="card-row">
            <div className="avatar">{initialsFor(client.name)}</div>
            <div className="card-text">
              <div className="card-title">{client.name}</div>
              <div className="card-subtitle">
                Last workout: {client.last_workout_date ? formatDateLabel(client.last_workout_date) : "—"}
              </div>
              <div className="streak-badge">🔥 {client.streak} day streak</div>
            </div>
            <span className="chevron">›</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Trainer;
