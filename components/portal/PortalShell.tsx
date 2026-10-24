"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import DepartmentNavbar, {
  type DepartmentOption,
} from "@/components/dashboard/DepartmentNavbar";
import PortalSidebar from "./PortalSidebar";
import type { DashboardUser, PortalRole } from "./types";

export default function PortalShell({
  user,
  departments,
  children,
}: {
  user: DashboardUser;
  departments: DepartmentOption[];
  children: ReactNode;
}) {
  const isSuper = user.role === "SUPERADMIN";
  const role: PortalRole = user.role === "PROFESSOR" ? "Professor" : "Admin";

  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const leaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Restore user's pin preference from localStorage if set
  useEffect(() => {
    try {
      const saved = localStorage.getItem("tnp_sidebar_pinned");
      if (saved !== null) {
        setIsPinned(saved === "true");
      }
    } catch {
      // ignore localStorage errors in restricted contexts
    }
  }, []);

  const togglePin = () => {
    setIsPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("tnp_sidebar_pinned", String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const handleMouseEnter = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    leaveTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 120);
  };

  useEffect(() => {
    return () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle pin
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        togglePin();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isExpanded = isPinned || isHovered;
  const isCollapsed = !isExpanded;

  return (
    <main
      className={`portal-shell ${
        isCollapsed ? "portal-shell--collapsed" : "portal-shell--expanded"
      }`}
    >
      <PortalSidebar
        user={user}
        role={role}
        isSuper={isSuper}
        collapsed={isCollapsed}
        pinned={isPinned}
        onToggle={togglePin}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
      <section className="content-area">
        <DepartmentNavbar
          current={user.department}
          departments={departments}
          canSwitch={isSuper}
        />
        {children}
      </section>
    </main>
  );
}
