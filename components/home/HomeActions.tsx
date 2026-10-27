"use client";

export default function HomeActions({
  onDashboard,
  onCalendar,
}: {
  onDashboard: () => void;
  onCalendar: () => void;
}) {
  return (
    <div className="home-actions">
      <button className="dark-button" onClick={onDashboard}>
        Dashboard <span aria-hidden="true">→</span>
      </button>
      <button className="light-button" onClick={onCalendar}>
        Calendar
      </button>
    </div>
  );
}
