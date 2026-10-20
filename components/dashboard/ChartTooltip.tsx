import type { ReactNode } from "react";

/** Tooltip body shared by all charts: the value leads, details follow. */
export default function ChartTooltip({
  title,
  value,
  lines = [],
}: {
  title: string;
  value: ReactNode;
  lines?: ReactNode[];
}) {
  return (
    <div className="mme-tooltip">
      <p className="mme-tooltip-title">{title}</p>
      <p className="mme-tooltip-value">{value}</p>
      {lines.map((line, i) => (
        <p key={i} className="mme-tooltip-line">
          {line}
        </p>
      ))}
    </div>
  );
}
