import { useEffect, useState } from "react";
import AppHeader from "./components/AppHeader";
import Login from "./components/Login";
import SignupExerciser from "./components/SignupExerciser";
import SignupTrainer from "./components/SignupTrainer";
import Exerciser from "./components/Exerciser";
import Trainer from "./components/Trainer";
import Admin from "./components/Admin";
import { api, getToken, setToken } from "./api/client";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [authView, setAuthView] = useState("login");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((me) => setUser(me))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const refreshUser = () => {
    return api
      .me()
      .then((me) => setUser(me))
      .catch(() => {});
  };

  const handleAuthSuccess = (data) => {
    setToken(data.access_token);
    setUser(data.user);
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setAuthView("login");
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading-screen">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app">
        {authView === "signup-exerciser" && (
          <SignupExerciser onSignup={handleAuthSuccess} onBack={() => setAuthView("login")} />
        )}
        {authView === "signup-trainer" && (
          <SignupTrainer onSignup={handleAuthSuccess} onBack={() => setAuthView("login")} />
        )}
        {authView === "login" && <Login onLogin={handleAuthSuccess} onNavigate={setAuthView} />}
      </div>
    );
  }

  return (
    <div className="app">
      <AppHeader user={user} onLogout={handleLogout} />
      <div className="screen">
        {user.role === "exerciser" && <Exerciser user={user} onUserChange={refreshUser} />}
        {user.role === "trainer" && <Trainer user={user} />}
        {user.role === "admin" && <Admin user={user} />}
      </div>
    </div>
  );
}

export default App;
