import { useEffect, useState } from "react";
import { motion } from "motion/react";
import AccountActions from "./AccountActions";
import { initialsFor } from "../utils/format";
import { api } from "../api/client";
import { screenTransition, cardTransition, tapScale } from "../utils/motion";

const USER_FILTERS = ["All", "active", "inactive"];

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function Admin() {
  const [screen, setScreen] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dashboardData, setDashboardData] = useState(null);
  const [users, setUsers] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [userFilter, setUserFilter] = useState("All");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedTrainerId, setSelectedTrainerId] = useState(null);

  useEffect(() => {
    Promise.all([api.adminDashboard(), api.adminUsers(), api.adminTrainers()])
      .then(([dash, u, t]) => {
        setDashboardData(dash);
        setUsers(u);
        setTrainers(t);
      })
      .catch((err) => setError(err.message || "Failed to load admin data."))
      .finally(() => setLoading(false));
  }, []);

  const filteredUsers =
    userFilter === "All" ? users : users.filter((u) => u.status === userFilter);

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const selectedTrainer = trainers.find((t) => t.id === selectedTrainerId);

  const approveTrainer = async (id) => {
    setError("");
    try {
      await api.approveTrainer(id);
      setTrainers(await api.adminTrainers());
    } catch (err) {
      setError(err.message || "Failed to approve trainer.");
    }
  };

  const rejectTrainer = async (id) => {
    setError("");
    try {
      await api.deleteTrainer(id);
      setTrainers(await api.adminTrainers());
      setSelectedTrainerId(null);
      setScreen("trainers");
    } catch (err) {
      setError(err.message || "Failed to reject trainer.");
    }
  };

  const toggleUserStatus = async (id, currentStatus) => {
    setError("");
    try {
      await api.setUserStatus(id, currentStatus === "active" ? "inactive" : "active");
      setUsers(await api.adminUsers());
    } catch (err) {
      setError(err.message || "Failed to update user status.");
    }
  };

  const toggleTrainerActive = async (id, currentStatus) => {
    setError("");
    try {
      await api.setTrainerStatus(id, currentStatus === "active" ? "inactive" : "active");
      setTrainers(await api.adminTrainers());
    } catch (err) {
      setError(err.message || "Failed to update trainer status.");
    }
  };

  const deleteUser = async (id) => {
    setError("");
    try {
      await api.deleteUser(id);
      setUsers(await api.adminUsers());
      setSelectedUserId(null);
      setScreen("users");
    } catch (err) {
      setError(err.message || "Failed to delete user.");
    }
  };

  const deleteTrainer = async (id) => {
    setError("");
    try {
      await api.deleteTrainer(id);
      setTrainers(await api.adminTrainers());
      setSelectedTrainerId(null);
      setScreen("trainers");
    } catch (err) {
      setError(err.message || "Failed to delete trainer.");
    }
  };

  if (loading) {
    return (
      <motion.div className="loading-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        Loading…
      </motion.div>
    );
  }

  if (screen === "user-detail" && selectedUser) {
    return (
      <motion.div {...screenTransition}>
        <div className="screen-header">
          <button className="back-button" onClick={() => setScreen("users")}>←</button>
          <span className="screen-title">{selectedUser.name}</span>
        </div>

        {error && (
          <motion.div className="auth-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            {error}
          </motion.div>
        )}

        <div className="card">
          <div className="card-row">
            <div className="avatar">{initialsFor(selectedUser.name)}</div>
            <div className="card-text">
              <div className="card-title">{selectedUser.name}</div>
              <div className="card-subtitle">{selectedUser.email}</div>
              {selectedUser.goal && <div className="card-subtitle">Goal: {selectedUser.goal}</div>}
            </div>
            <span className={`badge badge-${selectedUser.status}`}>
              {cap(selectedUser.status)}
            </span>
          </div>
        </div>

        <motion.button
          className={`btn ${selectedUser.status === "active" ? "btn-danger" : "btn-success"}`}
          whileTap={tapScale}
          onClick={() => toggleUserStatus(selectedUser.id, selectedUser.status)}
        >
          {selectedUser.status === "active" ? "Deactivate User" : "Activate User"}
        </motion.button>

        <AccountActions
          name={selectedUser.name}
          label="User"
          onChangePassword={(newPassword) => api.resetUserPassword(selectedUser.id, newPassword)}
          onDelete={() => deleteUser(selectedUser.id)}
        />
      </motion.div>
    );
  }

  if (screen === "trainer-detail" && selectedTrainer) {
    return (
      <motion.div {...screenTransition}>
        <div className="screen-header">
          <button className="back-button" onClick={() => setScreen("trainers")}>←</button>
          <span className="screen-title">{selectedTrainer.name}</span>
        </div>

        {error && (
          <motion.div className="auth-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            {error}
          </motion.div>
        )}

        <div className="card">
          <div className="card-row">
            <div className="avatar">{initialsFor(selectedTrainer.name)}</div>
            <div className="card-text">
              <div className="card-title">{selectedTrainer.name}</div>
              <div className="card-subtitle">{selectedTrainer.email}</div>
              <div className="card-subtitle">
                {selectedTrainer.specialty} · {selectedTrainer.experience_years} yrs
              </div>
            </div>
          </div>
          <div className="action-row">
            <span className={`badge badge-${selectedTrainer.approval_status}`}>
              {cap(selectedTrainer.approval_status)}
            </span>
            {selectedTrainer.approval_status === "approved" && (
              <span className={`badge badge-${selectedTrainer.status}`}>
                {cap(selectedTrainer.status)}
              </span>
            )}
          </div>
        </div>

        {selectedTrainer.approval_status === "pending" && (
          <div className="action-row">
            <motion.button className="btn btn-success" whileTap={tapScale} onClick={() => approveTrainer(selectedTrainer.id)}>
              Approve
            </motion.button>
            <motion.button className="btn btn-danger" whileTap={tapScale} onClick={() => rejectTrainer(selectedTrainer.id)}>
              Reject
            </motion.button>
          </div>
        )}

        {selectedTrainer.approval_status === "approved" && (
          <motion.button
            className={`btn ${selectedTrainer.status === "active" ? "btn-danger" : "btn-success"}`}
            whileTap={tapScale}
            onClick={() => toggleTrainerActive(selectedTrainer.id, selectedTrainer.status)}
          >
            {selectedTrainer.status === "active" ? "Deactivate Trainer" : "Activate Trainer"}
          </motion.button>
        )}

        <AccountActions
          name={selectedTrainer.name}
          label="Trainer"
          onChangePassword={(newPassword) => api.resetTrainerPassword(selectedTrainer.id, newPassword)}
          onDelete={() => deleteTrainer(selectedTrainer.id)}
        />
      </motion.div>
    );
  }

  if (screen === "users") {
    return (
      <motion.div {...screenTransition}>
        <div className="screen-header">
          <button className="back-button" onClick={() => setScreen("dashboard")}>←</button>
          <span className="screen-title">Users Management</span>
        </div>

        {error && (
          <motion.div className="auth-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            {error}
          </motion.div>
        )}

        <div className="filter-tabs">
          {USER_FILTERS.map((filter) => (
            <button
              key={filter}
              className={`filter-tab ${userFilter === filter ? "active" : ""}`}
              onClick={() => setUserFilter(filter)}
            >
              {filter === "All" ? "All" : cap(filter)}
            </button>
          ))}
        </div>

        {filteredUsers.map((user, idx) => (
          <motion.div
            className="card clickable"
            key={user.id}
            {...cardTransition(idx)}
            whileTap={tapScale}
            onClick={() => {
              setSelectedUserId(user.id);
              setScreen("user-detail");
            }}
          >
            <div className="card-row">
              <div className="avatar">{initialsFor(user.name)}</div>
              <div className="card-text">
                <div className="card-title">{user.name}</div>
                <div className="card-subtitle">{user.email}</div>
              </div>
              <span className={`badge badge-${user.status}`}>
                {cap(user.status)}
              </span>
              <span className="chevron">›</span>
            </div>
          </motion.div>
        ))}

        {filteredUsers.length === 0 && <div className="empty-text">No users found.</div>}
      </motion.div>
    );
  }

  if (screen === "trainers") {
    return (
      <motion.div {...screenTransition}>
        <div className="screen-header">
          <button className="back-button" onClick={() => setScreen("dashboard")}>←</button>
          <span className="screen-title">Trainers Management</span>
        </div>

        {error && (
          <motion.div className="auth-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            {error}
          </motion.div>
        )}

        {trainers.map((trainer, idx) => (
          <motion.div
            className="card clickable"
            key={trainer.id}
            {...cardTransition(idx)}
            whileTap={tapScale}
            onClick={() => {
              setSelectedTrainerId(trainer.id);
              setScreen("trainer-detail");
            }}
          >
            <div className="card-row">
              <div className="avatar">{initialsFor(trainer.name)}</div>
              <div className="card-text">
                <div className="card-title">{trainer.name}</div>
                <div className="card-subtitle">{trainer.specialty}</div>
              </div>
              <span className={`badge badge-${trainer.approval_status}`}>
                {cap(trainer.approval_status)}
              </span>
              <span className="chevron">›</span>
            </div>
            {trainer.approval_status === "approved" && (
              <div className="card-row">
                <span className={`badge badge-${trainer.status}`}>
                  {cap(trainer.status)}
                </span>
              </div>
            )}
          </motion.div>
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div {...screenTransition}>
      <div className="screen-header">
        <span className="screen-title">Admin Dashboard</span>
      </div>

      {error && (
        <motion.div className="auth-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          {error}
        </motion.div>
      )}

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-value">{dashboardData?.total_users ?? 0}</div>
          <div className="metric-label">Total Users</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{dashboardData?.active_trainers ?? 0}</div>
          <div className="metric-label">Active Trainers</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{dashboardData?.workouts_this_week ?? 0}</div>
          <div className="metric-label">Workouts This Week</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{dashboardData?.workouts_today ?? 0}</div>
          <div className="metric-label">Workouts Today</div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Quick Actions</div>
        <div className="quick-actions">
          <motion.button className="btn btn-primary" whileTap={tapScale} onClick={() => setScreen("users")}>
            👥 Manage Users
          </motion.button>
          <motion.button className="btn btn-outline" whileTap={tapScale} onClick={() => setScreen("trainers")}>
            🧑‍🏫 Manage Trainers
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

export default Admin;
