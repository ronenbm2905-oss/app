import { useState } from "react";
import { Select } from "./ui/Select";
import { AddToCalendarButton } from "./AddToCalendarButton";
import { gamesForCalendar } from "../utils/calendar";
import { teamIdsForCoach } from "../utils/gameFilters";

// One coach's fixtures as a calendar file, so the season lands in the calendar they already
// look at instead of in a screen they have to remember to open.
//
// WHY A COACH PICKER AND NOT THE TEAM FILTER ABOVE. The parents' sheet deliberately refuses
// a second picker and takes its squad from the screen's filter, because a sheet is ABOUT a
// squad and two pickers could disagree about which one. This is a different axis: it is
// about a PERSON. Eight of this club's coaches hold more than one squad and one holds
// three, so a file built per team would hand a third of the staff two or three files to
// import and leave them to notice that themselves.
//
// WHAT THE MANAGER CANNOT DO, and it is worth being plain about it: nothing here writes
// into anyone else's calendar. There is no such thing without that person connecting their
// Google account to this service, which would be a new processor, a new consent and a new
// set of keys. What this produces is a file. The manager sends it, the coach opens it once,
// and from then on the fixtures are in their own calendar.
//
// The squads are the ones formally assigned to the coach — the same test the fixture list
// itself uses (`teamIdsForCoach`), and deliberately NOT the wider net that counts a
// stand-in who took one training. A fixture belongs to the squad, and the squad has one
// coach on the record.
export function CoachGamesCalendar({ data, canEdit, myCoachId }) {
  const [picked, setPicked] = useState("");
  const coachId = canEdit ? picked : myCoachId || "";

  const coaches = (data?.coaches || []).filter(Boolean);
  const coachName = coaches.find((c) => c && c.id === coachId)?.name || "";
  const teamIds = teamIdsForCoach(data, coachId);
  const teamNames = (data?.teams || [])
    .filter((t) => t && teamIds.includes(t.id))
    .map((t) => t.name);
  // Fixtures still ahead only. A coach does not need last November in their calendar, and a
  // file carrying the whole season would put it there every time they tapped the button.
  const games = coachId ? gamesForCalendar(data, { teamIds }) : [];
  // A called-off fixture is IN the file — as a cancellation, which is the only way it comes
  // back out of a calendar it already reached. But it is not a game anyone is going to, so
  // counting it among "fixtures coming up" would overstate the season by exactly the games
  // that are not happening.
  const off = games.filter((g) => g.cancelled).length;
  const live = games.length - off;
  // "1 משחקים" is what a count reads like in Hebrew when nobody looks at the singular, and
  // a coach with one fixture left in the season is the ordinary case in May.
  const many = (n) => (n === 1 ? "משחק אחד" : `${n} משחקים`);

  // A coach whose record is not linked to any squad. Saying "no fixtures" would read as a
  // broken import; the truth is that nothing is assigned to them.
  const unassigned = coachId && teamIds.length === 0;

  // Somebody who is not a manager and whom the service cannot match to a coach record —
  // the case `CoachView` already has to handle, because identity there is a choice from a
  // list and not a linked account. There is no picker for them and no "my fixtures" to
  // export, so the card would be a box asking them to choose from nothing.
  if (!canEdit && !myCoachId) return null;

  return (
    <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 space-y-2" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-sky-900">
          <span className="font-semibold">{canEdit ? "משחקים ליומן של מאמן" : "המשחקים שלי ליומן"}</span>
          <span className="text-sky-800">
            {" — "}
            {canEdit
              ? "בוחרים מאמן, מקבלים קובץ יומן לשליחה אליו. הוא פותח אותו פעם אחת וכל המשחקים נכנסים ליומן שלו."
              : "קובץ שנפתח ביומן של המכשיר. כל המשחקים הקרובים של הקבוצות שלך."}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Select
              value={picked}
              onChange={setPicked}
              options={coaches}
              placeholder="בחר מאמן"
              label="בחירת מאמן/ת לייצוא המשחקים ליומן"
              className="w-44"
            />
          )}
          <AddToCalendarButton
            games={games}
            data={data}
            label={coachName ? `משחקים ${coachName}` : "משחקים"}
            calendarName={coachName ? `משחקים — ${coachName}` : "משחקים"}
            title={
              !coachId
                ? "בחרו מאמן"
                : unassigned
                ? "למאמן זה לא משויכת קבוצה"
                : games.length === 0
                ? "אין משחקים קרובים לקבוצות של מאמן זה"
                : `${many(live)} ליומן`
            }
          />
        </div>
      </div>
      <p className="text-[11px] text-sky-800">
        {!coachId
          ? "בחרו מאמן כדי לראות כמה משחקים ייכנסו."
          : unassigned
          ? "למאמן זה לא משויכת אף קבוצה, ולכן אין לו משחקים."
          : games.length === 0
          ? `${teamNames.join(" · ")} — אין משחקים קרובים.`
          : /* Named, not counted: a file that quietly carried the wrong squad is the thing
               worth catching before it is sent, and a number cannot be checked. */
            `${many(live)} ${live === 1 ? "קרוב" : "קרובים"} · ${teamNames.join(" · ")}` +
            (off ? ` · ועוד ${many(off)} ${off === 1 ? "שבוטל ונשלח" : "שבוטלו ונשלחים"} כביטול` : "")}
      </p>
      {/* The same rule the parents' sheet states on its own page. A calendar file gets
          forwarded, so what is not in it is worth saying out loud. */}
      {/* A sentence that opens with "בקובץ:" reads as a CLOSED list, so it has to be one.
          The first version named four of the seven fields — and the one it left out was the
          only one that is not a fact. The federation publishes a tip-off and no end, so the
          90 minutes are ours; a coach who books something at 18:30 because the calendar
          says the game ends at 18:30 relied on a constant we invented. Same family as the
          gathering time, and handled the same way: said out loud, where it is read.
          What is promised about the cancellation is what the FILE says, not what a calendar
          will do with it — that is their behaviour and not ours. */}
      <p className="text-[11px] text-sky-700">
        בקובץ: תאריך, שעת פתיחה, שעת סיום משוערת (90 דקות — האיגוד מפרסם שעת פתיחה בלבד),
        קבוצה, בית/חוץ, יריבה, מקום וליגה. אין בו שמות שחקנים, פרטי נהג, שעת התייצבות או
        הערות מקצועיות. הקובץ הוא תמונת מצב: שינוי שייעשה אחריו לא יגיע ליומן מעצמו, אלא רק
        בקובץ חדש שייפתח. משחק שבוטל נשלח מסומן כמבוטל, וכותרתו נפתחת ב"מבוטל" — ביומנים
        רבים הוא יירד מעצמו, ובאחרים יישאר מסומן.
      </p>
    </div>
  );
}
