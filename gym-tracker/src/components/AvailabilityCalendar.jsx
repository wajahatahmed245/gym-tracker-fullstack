import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../api/client";
import { formatDateLabel } from "../utils/format";
import { toLocalDateStr, buildCalendarCells, WEEKDAY_LABELS } from "../utils/calendar";
import { tabContent, tapScale } from "../utils/motion";

export default function AvailabilityCalendar({ title, subtitle, onChange }) {
  const [dates, setDates] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .myUnavailability()
      .then((rows) => {
        if (!active) return;
        setDates(rows.map((r) => r.date));
      })
      .catch((err) => setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    onChange?.(dates);
  }, [dates, onChange]);

  function goToMonth(delta) {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  async function toggleDate(dateStr) {
    const today = toLocalDateStr(new Date());
    if (dateStr < today) return;

    setError("");
    try {
      if (dates.includes(dateStr)) {
        await api.removeUnavailableDate(dateStr);
        setDates((prev) => prev.filter((d) => d !== dateStr));
      } else {
        await api.addUnavailableDate(dateStr);
        setDates((prev) => [...prev, dateStr].sort());
      }
    } catch (err) {
      setError(err.message);
    }
  }

  const today = toLocalDateStr(new Date());
  const upcoming = [...dates].sort();

  return (
    <div className="section">
      <div className="card-title">{title}</div>
      {subtitle && <div className="card-subtitle">{subtitle}</div>}

      {error && (
        <motion.div className="auth-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          {error}
        </motion.div>
      )}

      <div className="calendar-header" style={{ marginTop: 12 }}>
        <button className="calendar-nav-btn" type="button" onClick={() => goToMonth(-1)}>‹</button>
        <span className="calendar-header-title">
          {calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button className="calendar-nav-btn" type="button" onClick={() => goToMonth(1)}>›</button>
      </div>

      {loading ? (
        <div className="card-subtitle">Loading…</div>
      ) : (
        <div className="calendar-grid">
          {WEEKDAY_LABELS.map((label, idx) => (
            <div className="calendar-weekday" key={idx}>{label}</div>
          ))}
          {buildCalendarCells(calendarMonth).map((dateStr, idx) => {
            if (!dateStr) return <div className="calendar-day empty" key={idx} />;
            const dayNum = Number(dateStr.slice(-2));
            const isPast = dateStr < today;
            const classes = ["calendar-day"];
            if (dates.includes(dateStr)) classes.push("unavailable");
            if (dateStr === today) classes.push("today");
            if (isPast) classes.push("disabled");
            return (
              <motion.button
                key={dateStr}
                type="button"
                whileTap={isPast ? undefined : tapScale}
                className={classes.join(" ")}
                disabled={isPast}
                onClick={() => toggleDate(dateStr)}
              >
                {dayNum}
              </motion.button>
            );
          })}
        </div>
      )}

      <div className="section">
        <div className="card-subtitle">Upcoming unavailable days</div>
        {upcoming.length === 0 ? (
          <div className="card-subtitle">No days marked yet. Tap a date above to mark it.</div>
        ) : (
          <div className="chip-row" style={{ marginTop: 8 }}>
            <AnimatePresence>
              {upcoming.map((dateStr) => (
                <motion.button
                  key={dateStr}
                  type="button"
                  className="chip active"
                  whileTap={tapScale}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => toggleDate(dateStr)}
                >
                  {formatDateLabel(dateStr)} ✕
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
