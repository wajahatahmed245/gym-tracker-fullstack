function UnavailabilityTicker({ items }) {
  if (!items || items.length === 0) return null;

  const duration = Math.max(items.length * 4, 12);

  return (
    <div className="ticker-banner">
      <div className="ticker-label">📅 Upcoming Unavailability</div>
      <div className="ticker-viewport">
        <div className="ticker-track" style={{ "--ticker-duration": `${duration}s` }}>
          {[...items, ...items].map((item, idx) => (
            <span className={`ticker-chip ${item.mine ? "" : "other"}`} key={idx}>
              <span className="ticker-chip-icon">{item.icon}</span>
              <span className="ticker-chip-text">{item.label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default UnavailabilityTicker;
