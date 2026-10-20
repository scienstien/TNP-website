import type { ReactNode } from "react";

export interface ChartTable {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
}

interface ChartCardProps {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  footnote?: ReactNode;
  isEmpty: boolean;
  emptyMessage?: string;
  /** Same values as the chart, for screen readers. */
  table: ChartTable;
  /** Let the chart grow to the card's height (for charts with a flexible height). */
  fill?: boolean;
  className?: string;
  children: ReactNode;
}

/** Shared frame for every dashboard chart: heading, empty state and an accessible data table. */
export default function ChartCard({
  title,
  subtitle,
  actions,
  footnote,
  isEmpty,
  emptyMessage = "No placement records match the current filters.",
  table,
  fill = false,
  className = "",
  children,
}: ChartCardProps) {
  return (
    <section className={`panel mme-card ${className}`}>
      <header className="mme-card-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {actions}
      </header>

      {isEmpty ? (
        <div className="mme-empty" role="status">
          {emptyMessage}
        </div>
      ) : (
        <div
          className={`mme-chart ${fill ? "mme-chart--fill" : ""}`}
          aria-hidden="true"
        >
          {children}
        </div>
      )}

      {footnote && !isEmpty && <p className="mme-footnote">{footnote}</p>}

      <table className="sr-only">
        <caption>{table.caption}</caption>
        <thead>
          <tr>
            {table.columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
