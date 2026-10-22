import PageHeading from "@/components/portal/PageHeading";
import type { CalendarEvent, CalendarWindow } from "@/lib/calendar/types";
import type { DriveOption } from "@/lib/drives/types";
import DriveCalendar from "./DriveCalendar";

export default function CalendarView(props: { today: string; canEdit: boolean; scope: string; window: CalendarWindow; events: CalendarEvent[]; drives: DriveOption[] }) {
  return <><PageHeading eyebrow="DRIVE STAGES" title="Process calendar" subtitle="Scheduled and undated historical drive stages, shared through the database." /><DriveCalendar key={`${props.window.startsOn}:${props.scope}`} {...props} /></>;
}
