"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Home as HomeIcon,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";
import type { PortalRole } from "./types";

const commonItems = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
] as const;

const adminItems = [
  { href: "/companies", label: "Companies", icon: Building2 },
] as const;

const trailingItems = [
  { href: "/outreach", label: "Outreach", icon: ClipboardList },
] as const;

const adminTrailingItems = [
  { href: "/students/ug", label: "Student records", icon: GraduationCap },
] as const;

export default function PortalNavigation({ role }: { role: PortalRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = [
    ...commonItems,
    ...(role === "Admin" ? adminItems : []),
    ...trailingItems,
    ...(role === "Admin" ? adminTrailingItems : []),
  ];

  return (
    <nav>
      {items.map((item) => (
        <NavButton
          key={item.href}
          active={pathname === item.href || (item.href === "/students/ug" && pathname.startsWith("/students/"))}
          onClick={() => router.push(item.href)}
          icon={item.icon}
        >
          {item.label}
        </NavButton>
      ))}
    </nav>
  );
}

function NavButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick} aria-current={active ? "page" : undefined}>
      <span aria-hidden="true"><Icon size={18} strokeWidth={1.8} /></span>
      {children}
    </button>
  );
}
