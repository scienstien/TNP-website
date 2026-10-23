"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  BarChart3,
  Maximize2,
  RefreshCw,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./CompanyOfferHistoryChart.module.css";

export interface CompanyOfferCycleRow {
  cycleId: string;
  cycleCode: string;
  offerCount: number;
}

export interface CompanyOfferHistoryChartProps {
  company: { companyId: string; name: string } | null;
  scopeLabel: string;
  rows: CompanyOfferCycleRow[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

const BAR_COLOR = "#3a72e6";
const GRID_COLOR = "rgba(110, 160, 255, 0.12)";
const AXIS_TEXT = "#8f9bb0";
const LABEL_TEXT = "#dbe7fc";

/**
 * CompanyOfferHistoryChart displays a horizontally scrollable bar chart of
 * authorized final reported placement offers across explicit cycles for a single company.
 *
 * Includes an enlarged responsive modal overlay with focus containment, Escape key handling,
 * and scroll-position retention.
 */
export default function CompanyOfferHistoryChart({
  company,
  scopeLabel,
  rows,
  loading,
  error,
  onRetry,
}: CompanyOfferHistoryChartProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const compactScrollRef = useRef<HTMLDivElement>(null);
  const savedScrollLeftRef = useRef<number>(0);

  const titleId = useId();
  const overlayTitleId = useId();

  const totalOffers = rows.reduce((sum, r) => sum + r.offerCount, 0);
  const hasData = Boolean(company && !loading && !error && rows.length > 0);

  // Preserve scroll position when opening/closing
  const openOverlay = useCallback(() => {
    if (compactScrollRef.current) {
      savedScrollLeftRef.current = compactScrollRef.current.scrollLeft;
    }
    setIsExpanded(true);
  }, []);

  const closeOverlay = useCallback(() => {
    setIsExpanded(false);
  }, []);

  // Handle focus trapping, Escape key, and body scroll lock for the overlay
  useEffect(() => {
    if (!isExpanded) {
      // Restore focus to trigger button
      expandButtonRef.current?.focus();
      // Restore compact scroll position
      if (compactScrollRef.current) {
        compactScrollRef.current.scrollLeft = savedScrollLeftRef.current;
      }
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Auto-focus the close button in the overlay
    const timer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeOverlay();
        return;
      }

      if (event.key === "Tab" && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExpanded, closeOverlay]);

  // Dynamic widths for horizontal scrollability without compressing bars
  const compactChartWidth = Math.max(340, rows.length * 60);
  const overlayChartWidth = Math.max(720, rows.length * 76);

  // Render chart content
  const renderChart = (isOverlaySize: boolean) => {
    const width = isOverlaySize ? overlayChartWidth : compactChartWidth;
    const height = isOverlaySize ? 420 : 250;
    const barSize = isOverlaySize ? 28 : 22;

    return (
      <div style={{ width: `${width}px`, minWidth: "100%", height: `${height}px` }}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={rows}
            margin={{ top: 18, right: 28, bottom: 24, left: 0 }}
            barCategoryGap={isOverlaySize ? 14 : 10}
          >
            <CartesianGrid vertical={false} stroke={GRID_COLOR} />
            <XAxis
              dataKey="cycleCode"
              interval={0}
              tickLine={false}
              axisLine={{ stroke: GRID_COLOR }}
              tick={{ fill: AXIS_TEXT, fontSize: isOverlaySize ? 12 : 11 }}
              label={{
                value: "Placement cycle",
                position: "insideBottom",
                offset: -14,
                fill: AXIS_TEXT,
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: AXIS_TEXT, fontSize: 11 }}
              label={{
                value: "Final offers",
                angle: -90,
                position: "insideLeft",
                fill: AXIS_TEXT,
                fontSize: 11,
                style: { textAnchor: "middle" },
              }}
            />
            <Tooltip
              cursor={{ fill: "rgba(110, 160, 255, 0.08)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as CompanyOfferCycleRow;
                const count = row.offerCount;
                return (
                  <div className={styles.tooltip}>
                    <p className={styles.tooltipTitle}>{row.cycleCode}</p>
                    <p className={styles.tooltipValue}>
                      {count} {count === 1 ? "offer" : "offers"}
                    </p>
                    {company && (
                      <p className={styles.tooltipDetail}>{company.name}</p>
                    )}
                  </div>
                );
              }}
            />
            <Bar
              dataKey="offerCount"
              fill={BAR_COLOR}
              barSize={barSize}
              radius={[4, 4, 0, 0]}
            >
              <LabelList
                dataKey="offerCount"
                position="top"
                fill={LABEL_TEXT}
                fontSize={11}
                formatter={(val: unknown) => {
                  const num = Number(val);
                  return num > 0 ? num : "";
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInfo}>
          <p className={styles.kicker}>HISTORY TREND</p>
          <h2 id={titleId} className={styles.title}>
            Offer history by cycle
          </h2>
          <p className={styles.subtitle}>
            {company ? (
              <>
                <span>{company.name}</span>
                <span>•</span>
                <span>{scopeLabel}</span>
                {hasData && (
                  <>
                    <span>•</span>
                    <span>
                      {totalOffers} total {totalOffers === 1 ? "offer" : "offers"} across {rows.length}{" "}
                      {rows.length === 1 ? "cycle" : "cycles"}
                    </span>
                  </>
                )}
              </>
            ) : (
              <span>No company selected</span>
            )}
          </p>
        </div>

        <div className={styles.actions}>
          <button
            ref={expandButtonRef}
            type="button"
            className={styles.expandButton}
            onClick={openOverlay}
            disabled={!hasData}
            title={hasData ? "Expand offer history chart" : "Chart cannot be expanded without data"}
            aria-label="Expand offer history chart"
          >
            <Maximize2 size={14} aria-hidden="true" />
            <span>Expand</span>
          </button>
        </div>
      </header>

      {/* State View Handling */}
      {!company && (
        <div className={styles.stateBox} role="status">
          <BarChart3 size={32} className={styles.stateIcon} aria-hidden="true" />
          <p>Select a company to view placement offer history across cycles.</p>
        </div>
      )}

      {company && loading && (
        <div className={styles.stateBox} role="status" aria-live="polite">
          <div className={styles.loadingSpinner} aria-hidden="true" />
          <p>Loading placement offer history for {company.name}...</p>
        </div>
      )}

      {company && !loading && error && (
        <div className={`${styles.stateBox} ${styles.errorBox}`} role="alert">
          <AlertCircle size={32} className={styles.errorIcon} aria-hidden="true" />
          <p className={styles.errorMessage}>{error}</p>
          <button
            type="button"
            className={styles.retryButton}
            onClick={onRetry}
          >
            <RefreshCw size={13} aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {company && !loading && !error && rows.length === 0 && (
        <div className={styles.stateBox} role="status">
          <BarChart3 size={32} className={styles.stateIcon} aria-hidden="true" />
          <p>No placement cycles or offers recorded for {company.name}.</p>
        </div>
      )}

      {/* Active Chart View */}
      {hasData && company && (
        <>
          <div
            ref={compactScrollRef}
            className={styles.scrollArea}
            tabIndex={0}
            role="region"
            aria-label="Scrollable offer history chart"
          >
            <div className={styles.chartCanvas} aria-hidden="true">
              {renderChart(false)}
            </div>
          </div>

          {/* Accessible Table for Screen Readers */}
          <table className={styles.srOnly}>
            <caption>
              Offer history for {company.name} by cycle ({scopeLabel})
            </caption>
            <thead>
              <tr>
                <th scope="col">Placement cycle</th>
                <th scope="col">Final offers</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.cycleId}>
                  <td>{row.cycleCode}</td>
                  <td>{row.offerCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Enlarged Modal Overlay */}
      {isExpanded && company && hasData && (
        <div
          className={styles.overlayBackdrop}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeOverlay();
          }}
        >
          <div
            ref={dialogRef}
            className={styles.overlayDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={overlayTitleId}
          >
            <header className={styles.overlayHeader}>
              <div>
                <h2 id={overlayTitleId} className={styles.overlayTitle}>
                  {company.name} — Offer history by cycle
                </h2>
                <p className={styles.overlaySubtitle}>
                  Scope: {scopeLabel} • {totalOffers} total{" "}
                  {totalOffers === 1 ? "offer" : "offers"} across {rows.length}{" "}
                  {rows.length === 1 ? "recorded cycle" : "recorded cycles"}
                </p>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                className={styles.closeButton}
                onClick={closeOverlay}
                aria-label="Close enlarged chart"
              >
                <X size={16} aria-hidden="true" />
                <span>Close</span>
              </button>
            </header>

            <div className={styles.overlayBody}>
              <div
                className={styles.overlayScrollArea}
                tabIndex={0}
                role="region"
                aria-label="Scrollable enlarged offer history chart"
              >
                <div className={styles.overlayChartCanvas} aria-hidden="true">
                  {renderChart(true)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

