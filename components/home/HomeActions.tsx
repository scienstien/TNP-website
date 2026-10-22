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
        Open dashboard <span>{"->"}</span>
      </button>
      <button className="light-button" onClick={onCalendar}>
        View drive calendar
      </button>
    </div>
  );
}
