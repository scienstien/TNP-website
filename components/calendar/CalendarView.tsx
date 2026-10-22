"use client";

import PageHeading from "@/components/portal/PageHeading";
import DriveCalendar from "./DriveCalendar";

export default function CalendarView({
  today,
  isAdmin,
  scope,
}: {
  today: string;
  isAdmin: boolean;
  scope: string;
}) {
  return (
    <>
      <PageHeading
        eyebrow="RECRUITMENT PIPELINE"
        title="Process calendar"
        subtitle="Plan and track OT, group discussions, resume shortlisting and PI rounds."
      />
      <DriveCalendar today={today} isAdmin={isAdmin} scope={scope} />
    </>
  );
}
