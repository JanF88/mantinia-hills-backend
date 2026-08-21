// iCal-EXPORT: Liefert die eigenen belegten Zeiträume (ab Anzahlung) als
// Kalender-Feed. Diese URL wird bei Booking/Airbnb als Import-Kalender
// eingetragen, damit die Portale unsere Direktbuchungen blocken.
// verify_jwt=false; ?key= als Schutz. Enthält KEINE Gästedaten.

import { createClient } from "npm:@supabase/supabase-js@2";

const KEY = Deno.env.get("ICAL_KEY") ?? "015681fdb57dfca7aaf38572f463bbcd";

function icsDatum(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "");
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("key") !== KEY) {
    return new Response("forbidden", { status: 403 });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await supabase
      .from("buchungen")
      .select("id, anreise, abreise")
      .in("status", ["bestaetigt", "angezahlt", "bezahlt", "abgeschlossen"]);
    if (error) throw error;

    const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const zeilen = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Mantinia Hills//Buchungsverwaltung//DE",
      "CALSCALE:GREGORIAN",
    ];
    for (const b of data ?? []) {
      zeilen.push(
        "BEGIN:VEVENT",
        `UID:${b.id}@clients.mantinia-hills.com`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${icsDatum(b.anreise)}`,
        `DTEND;VALUE=DATE:${icsDatum(b.abreise)}`,
        "SUMMARY:Belegt (Mantinia Hills)",
        "END:VEVENT",
      );
    }
    zeilen.push("END:VCALENDAR");
    return new Response(zeilen.join("\r\n") + "\r\n", {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "Content-Disposition": 'inline; filename="mantinia-hills.ics"',
      },
    });
  } catch (err) {
    console.error("ical Export Fehler:", err instanceof Error ? err.message : String(err));
    return new Response("error", { status: 500 });
  }
});
