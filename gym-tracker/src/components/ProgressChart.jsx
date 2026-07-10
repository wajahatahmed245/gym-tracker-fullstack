import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { formatDateLabel } from "../utils/format";

const shortDate = (d) => {
  if (!d) return "";
  const [, m, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${parseInt(day)} ${months[parseInt(m) - 1]}`;
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-sm)",
      padding: "8px 12px",
      fontSize: 13,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{formatDateLabel(label)}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.stroke }}>
          {p.name}: <strong>{p.value}{p.unit}</strong>
        </div>
      ))}
    </div>
  );
}

export function StrengthChart({ history }) {
  const [metric, setMetric] = useState("weight");

  if (!history || history.length === 0) return null;

  const data = history
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) => ({
      date: w.date,
      weight: Math.max(...w.sets.map((s) => s.weight)),
      volume: Math.round(w.sets.reduce((sum, s) => sum + s.weight * s.reps, 0)),
    }));

  const best = Math.max(...data.map((d) => d[metric]));
  const unit = metric === "weight" ? "kg" : "";
  const label = metric === "weight" ? "Max Weight" : "Volume (kg·reps)";

  return (
    <div>
      <div className="filter-tabs" style={{ marginBottom: 12 }}>
        <button className={`filter-tab ${metric === "weight" ? "active" : ""}`} onClick={() => setMetric("weight")}>
          🏋️ Max Weight
        </button>
        <button className={`filter-tab ${metric === "volume" ? "active" : ""}`} onClick={() => setMetric("volume")}>
          📦 Volume
        </button>
      </div>

      {data.length === 1 && (
        <div className="card-subtitle" style={{ marginBottom: 8 }}>
          Log more sessions to see your progression trend.
        </div>
      )}

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit={unit} />
          <Tooltip content={<ChartTooltip />} />
          <Line
            type="monotone"
            dataKey={metric}
            name={label}
            unit={unit}
            stroke="var(--color-primary, #2563eb)"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "var(--color-primary, #2563eb)", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div style={{ textAlign: "center", fontSize: 12, color: "var(--color-text-muted, #6b7280)", marginTop: 6 }}>
        {data.length} session{data.length !== 1 ? "s" : ""} · Best: <strong>{best}{unit || " kg·reps"}</strong>
      </div>
    </div>
  );
}

export function CardioChart({ sessions }) {
  const [metric, setMetric] = useState("duration");

  if (!sessions || sessions.length === 0) return null;

  const hasCals = sessions.some((s) => s.calories_burned);

  const data = sessions
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({
      date: s.date,
      duration: s.duration_minutes,
      calories: s.calories_burned || 0,
    }));

  const best = Math.max(...data.map((d) => d[metric]));
  const unit = metric === "duration" ? " min" : " kcal";
  const label = metric === "duration" ? "Duration" : "Calories";

  return (
    <div>
      {hasCals && (
        <div className="filter-tabs" style={{ marginBottom: 12 }}>
          <button className={`filter-tab ${metric === "duration" ? "active" : ""}`} onClick={() => setMetric("duration")}>
            ⏱ Duration
          </button>
          <button className={`filter-tab ${metric === "calories" ? "active" : ""}`} onClick={() => setMetric("calories")}>
            🔥 Calories
          </button>
        </div>
      )}

      {data.length === 1 && (
        <div className="card-subtitle" style={{ marginBottom: 8 }}>
          Log more sessions to see your progression trend.
        </div>
      )}

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Line
            type="monotone"
            dataKey={metric}
            name={label}
            unit={unit}
            stroke="#f59e0b"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#f59e0b", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div style={{ textAlign: "center", fontSize: 12, color: "var(--color-text-muted, #6b7280)", marginTop: 6 }}>
        {data.length} session{data.length !== 1 ? "s" : ""} · Best: <strong>{best}{unit}</strong>
      </div>
    </div>
  );
}
