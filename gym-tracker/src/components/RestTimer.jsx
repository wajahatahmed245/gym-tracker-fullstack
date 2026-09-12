import { useEffect, useState } from "react";

export const REST_DURATION_SECONDS = 180;

const storageKey = (userId) => `gymtrack_rest_${userId}`;

export function startRestTimer(userId) {
  const rest_ends_at = new Date(Date.now() + REST_DURATION_SECONDS * 1000).toISOString();
  localStorage.setItem(storageKey(userId), rest_ends_at);
}

export function clearRestTimer(userId) {
  localStorage.removeItem(storageKey(userId));
}

function getRemainingSeconds(userId) {
  const raw = localStorage.getItem(storageKey(userId));
  if (!raw) return null;
  const secs = Math.ceil((new Date(raw) - Date.now()) / 1000);
  return Math.max(0, secs);
}

export function useRestTimerRemaining(userId) {
  const [remaining, setRemaining] = useState(() => getRemainingSeconds(userId));

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(getRemainingSeconds(userId));
    }, 1000);
    return () => clearInterval(id);
  }, [userId]);

  return remaining;
}

export default function RestTimer({ userId }) {
  const remaining = useRestTimerRemaining(userId);

  const dismiss = () => {
    clearRestTimer(userId);
  };

  if (remaining === null) return null;

  const done = remaining === 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className={`rest-timer${done ? " rest-timer--done" : ""}`}>
      <div className="rest-timer-inner">
        {done ? (
          <>
            <span className="rest-timer-icon">✅</span>
            <span className="rest-timer-text">Rest Complete — Ready for Next Set!</span>
          </>
        ) : (
          <>
            <span className="rest-timer-icon">⏱</span>
            <span className="rest-timer-text">Rest</span>
            <span className="rest-timer-count">{mm}:{ss}</span>
          </>
        )}
        {/* Dismiss only available once rest is complete — cannot skip the rest period */}
        {done && (
          <button className="rest-timer-dismiss" onClick={dismiss} aria-label="Dismiss timer">✕</button>
        )}
      </div>
    </div>
  );
}
