const ROLE_META = {
  exerciser: { label: "Exerciser", icon: "🏋️" },
  trainer: { label: "Trainer", icon: "🧑‍🏫" },
  admin: { label: "Admin", icon: "🛠️" },
};

function AppHeader({ user, onLogout }) {
  const meta = ROLE_META[user.role];

  return (
    <header className="app-header">
      <div className="app-header-brand">
        <div className="app-header-icon">{meta.icon}</div>
        <div className="app-header-text">
          <div className="app-header-name">{user.name}</div>
          <div className="app-header-role">{meta.label}</div>
        </div>
      </div>
      <button className="logout-button" onClick={onLogout}>Logout</button>
    </header>
  );
}

export default AppHeader;
