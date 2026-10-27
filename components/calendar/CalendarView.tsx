import PageHeading from "@/components/portal/PageHeading";
import type { CalendarEvent, CalendarWindow } from "@/lib/calendar/types";
import type { DriveOption } from "@/lib/drives/types";
import DriveCalendar from "./DriveCalendar";

export default function CalendarView(props: { today: string; initialDay: string | null; canEdit: boolean; scope: string; window: CalendarWindow; events: CalendarEvent[]; upcoming: CalendarEvent[]; drives: DriveOption[] }) {
  return <><PageHeading title="Calendar" /><DriveCalendar key={`${props.window.startsOn}:${props.scope}:${props.initialDay ?? ""}`} {...props} /></>;
}
