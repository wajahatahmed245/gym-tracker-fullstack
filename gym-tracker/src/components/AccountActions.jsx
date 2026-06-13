import { useState } from "react";

function AccountActions({ name, label, onChangePassword, onDelete }) {
  const [passwordForm, setPasswordForm] = useState({ password: "", confirmPassword: "" });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const submitPassword = async (e) => {
    e.preventDefault();
    if (!passwordForm.password || !passwordForm.confirmPassword) {
      setPasswordError("Please fill in both fields.");
      setPasswordSuccess("");
      return;
    }
    if (passwordForm.password !== passwordForm.confirmPassword) {
      setPasswordError("Passwords do not match.");
      setPasswordSuccess("");
      return;
    }
    setPasswordError("");
    try {
      await onChangePassword(passwordForm.password);
      setPasswordSuccess(`Password updated for ${name}.`);
      setPasswordForm({ password: "", confirmPassword: "" });
    } catch (err) {
      setPasswordSuccess("");
      setPasswordError(err.message || "Failed to update password.");
    }
  };

  return (
    <>
      <div className="section">
        <div className="section-title">Change Password</div>
        <form onSubmit={submitPassword}>
          {passwordError && <div className="auth-error">{passwordError}</div>}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={passwordForm.password}
                onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              />
            </div>
          </div>
          <button className="btn btn-outline" type="submit">Update Password</button>
        </form>
        {passwordSuccess && <div className="success-box">{passwordSuccess}</div>}
      </div>

      <div className="section">
        <div className="section-title">Danger Zone</div>
        {!confirmingDelete && (
          <button className="btn btn-danger" onClick={() => setConfirmingDelete(true)}>
            Delete {label}
          </button>
        )}
        {confirmingDelete && (
          <div className="confirm-box">
            <div className="confirm-text">
              Delete {name}? This can't be undone.
            </div>
            <div className="action-row">
              <button className="btn" onClick={() => setConfirmingDelete(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={onDelete}>Confirm Delete</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default AccountActions;
