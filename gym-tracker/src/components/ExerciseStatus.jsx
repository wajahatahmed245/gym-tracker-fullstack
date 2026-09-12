import { useEffect, useState } from "react";
import { api } from "../api/client";

const STATUS_CONFIG = {
  up_to_date: {
    label: "Recently Completed",
    color: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    dot: "#22c55e",
  },
  due_soon: {
    label: "Due Soon",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
    dot: "#f59e0b",
  },
  overdue: {
    label: "Overdue",
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    dot: "#ef4444",
  },
  never: {
    label: "Never Done",
    color: "#6b7280",
    bg: "#f9fafb",
    border: "#e5e7eb",
    dot: "#9ca3af",
  },
};

const BODY_PART_ICONS = {
  Chest: "🫀",
  Back: "🔙",
  Legs: "🦵",
  Shoulders: "🏋️",
  Arms: "💪",
  Core: "🎯",
};

function StatusDot({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.never;
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: cfg.dot,
        marginRight: 6,
        flexShrink: 0,
      }}
    />
  );
}

export default function ExerciseStatus({ refreshTrigger }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    setLoading(true);
    api.exerciseStatus()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  if (loading) return <p style={{ color: "#6b7280", fontSize: 14 }}>Loading exercise status…</p>;
  if (items.length === 0) return null;

  const counts = items.reduce((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1;
    return acc;
  }, {});

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);

  const overdueCt = counts.overdue || 0;
  const dueSoonCt = counts.due_soon || 0;

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
          Exercise Tracker
          {overdueCt > 0 && (
            <span style={{
              marginLeft: 8, background: "#ef4444", color: "#fff",
              borderRadius: 12, padding: "1px 8px", fontSize: 12, fontWeight: 600,
            }}>
              {overdueCt} overdue
            </span>
          )}
          {overdueCt === 0 && dueSoonCt > 0 && (
            <span style={{
              marginLeft: 8, background: "#f59e0b", color: "#fff",
              borderRadius: 12, padding: "1px 8px", fontSize: 12, fontWeight: 600,
            }}>
              {dueSoonCt} due soon
            </span>
          )}
        </h3>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            fontSize: 12, padding: "3px 8px", borderRadius: 6,
            border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer",
          }}
        >
          <option value="all">All ({items.length})</option>
          {counts.overdue && <option value="overdue">Overdue ({counts.overdue})</option>}
          {counts.due_soon && <option value="due_soon">Due Soon ({counts.due_soon})</option>}
          {counts.up_to_date && <option value="up_to_date">Completed ({counts.up_to_date})</option>}
          {counts.never && <option value="never">Never Done ({counts.never})</option>}
        </select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((item) => {
          const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.never;
          const icon = BODY_PART_ICONS[item.body_part] || "🏃";
          return (
            <div
              key={item.assigned_workout_id}
              style={{
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                borderRadius: 10,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span style={{ fontSize: 24 }}>{icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>
                    {item.body_part}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  <StatusDot status={item.status} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: cfg.color }}>
                    {cfg.label}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  {item.message}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
