import { DAYS } from "../constants.js";
import { parseDateDMY } from "./dates.js";
import { matchHall, withHallAliases } from "./halls.js";
import { assemblyTime, departBeforeOf } from "./transport.js";

// One team's fixture list, as a sheet a coach can send to the team's parents.
//
// THE SAME RULE AS THE PARENT BOARD, FOR THE SAME REASON. This leaves the club and lands in
// a WhatsApp group, so it is built by naming what goes IN rather than by hiding what should
// not — the distinction this project has been caught on more than once. What is deliberately
// absent:
//
//   • The driver's name and phone. They are on the transport sheet, which stays inside the
//     club, and the terms of use say so in as many words.
//   • The coach's game note and any score typed into it. That is professional documentation
//     written for the club; a fixture list is not the way it reaches parents.
//   • Every other team. A sheet is built for ONE team, by id, and cannot mix two.
//   • Any player. A fixture record does not know children exist, and nothing here adds them.
//
// What it does carry beyond the fixture itself is the gathering time for away games — the
// one line a parent has to act on, taken from the same call the coach's own screen makes so
// the squad and the families cannot be given different times.

const arr = (list) => (Array.isArray(list) ? list : []);

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// Sortable, and safe on a malformed date: those sort last rather than scrambling the list.
function sortKey(game) {
  const d = parseDateDMY(game?.date);
  return d ? d.getTime() : Number.MAX_SAFE_INTEGER;
}

export function teamGameRows(data, teamId, { now = new Date(), includePast = false } = {}) {
  if (!teamId) return [];
  const today = startOfDay(now);
  const halls = arr(data?.halls);
  const hallName = (id) => halls.find((h) => h && h.id === id)?.name || "";
  const departBefore = departBeforeOf(data);

  return arr(data?.games)
    .filter((g) => g && g.teamId === teamId)
    .filter((g) => {
      if (includePast) return true;
      const d = parseDateDMY(g.date);
      // A fixture with an unreadable date is kept rather than silently dropped — a missing
      // row is the one error nobody notices.
      return !d || startOfDay(d) >= today;
    })
    .sort((a, b) => sortKey(a) - sortKey(b))
    .map((g) => {
      const d = parseDateDMY(g.date);
      const rawVenue = g.addressOverride || g.venue || "";
      const hallId = g.isHome ? g.hallId || matchHall(rawVenue, halls) : "";
      return {
        date: d ? `${d.getDate()}.${d.getMonth() + 1}` : String(g.date || ""),
        day: d ? DAYS[d.getDay()] : g.weekDay || "",
        time: g.time || "",
        home: Boolean(g.isHome),
        opponent: String(g.opponent || "").trim(),
        // Home: our name for the hall, never the federation's older name for it.
        // Away: the address the transport sheet uses, so the two cannot drift apart.
        where: (g.isHome && hallName(hallId)) || withHallAliases(rawVenue),
        // Away only. A home fixture has nowhere to gather for.
        assembly: g.isHome ? "" : assemblyTime(g, departBefore),
        cancelled: Boolean(g.cancelled),
      };
    });
}

export function teamNameOf(data, teamId) {
  return arr(data?.teams).find((t) => t && t.id === teamId)?.name || "";
}

// Windows refuses these outright and WhatsApp mangles them; a sheet that cannot be saved is
// a sheet that does not get sent.
export function sheetFileName(teamName, now = new Date()) {
  const safe = String(teamName || "קבוצה").replace(/[\\/:*?"<>|]/g, "").trim() || "קבוצה";
  return `משחקים-${safe}-${now.getDate()}.${now.getMonth() + 1}.pdf`;
}
