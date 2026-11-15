/**
 * Minimal iCalendar (.ics) builder for "Add to calendar" (RFC 5545). Works with Google Calendar,
 * Apple Calendar and Outlook. Times are written in UTC, so no timezone block is needed.
 */

function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function buildIcs(event: {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  now?: Date;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Daybook//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${icsDate(event.now ?? new Date())}`,
    `DTSTART:${icsDate(event.start)}`,
    `DTEND:${icsDate(event.end)}`,
    `SUMMARY:${escapeText(event.title)}`,
    ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(event.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

/** Triggers a download of the .ics file in the browser. */
export function downloadIcs(filename: string, contents: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
