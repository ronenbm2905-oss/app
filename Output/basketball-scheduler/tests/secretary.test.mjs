import assert from "node:assert/strict";
import {
  secretaryDutiesFor, secretaryLabel, secretaryWhen, shortDate,
  secretaryLeadFor, SECRETARY_LEAD_MIN,
} from "../src/utils/secretary.js";

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("  ok  " + name); };

const W = "2026-09-06";          // Sunday
const teams = [
  { id: "host", name: "נוער על" },
  { id: "mine", name: "נוער ארצית" },
  { id: "other", name: "ילדים א לאומית" },
];
// 07-09-2026 is the Monday of week 2026-09-06
const game = { federationCode: "749196", teamId: "host", isHome: true, date: "07-09-2026", time: "20:30", venue: "אולם רימונים" };
const base = {
  teams,
  games: [game],
  weeklyAssignments: { [`${W}__host`]: { playing: "host", secretary: "mine" } },
};

console.log("- the basic question -");
t("my team is on the table at another team's game", () => {
  const d = secretaryDutiesFor(base, "mine", W);
  assert.equal(d.length, 1);
  assert.equal(d[0].hostTeamName, "נוער על");
});
t("the host team itself has no duty", () =>
  assert.deepEqual(secretaryDutiesFor(base, "host", W), []));
t("an uninvolved team has no duty", () =>
  assert.deepEqual(secretaryDutiesFor(base, "other", W), []));
t("another week is not counted", () =>
  assert.deepEqual(secretaryDutiesFor(base, "mine", "2026-09-13"), []));
t("no assignments at all = no work", () =>
  assert.deepEqual(secretaryDutiesFor({ teams, games: [game] }, "mine", W), []));

console.log("- the time: a quarter hour before the whistle -");
t("20:30 game means the crew is due at 20:15", () => {
  const d = secretaryDutiesFor(base, "mine", W)[0];
  assert.equal(d.time, "20:15");
  assert.equal(d.gameTime, "20:30");   // the tip-off is kept, so the label can name it
  assert.equal(d.date, "07-09-2026");
  assert.equal(d.day, "שני");
  assert.equal(d.venue, "אולם רימונים");
});
t("the lead is taken off the GAME time, not the session start", () => {
  // syncGamesToSessions would have said 20:00 (warm-up). 20:00 - 15 = 19:45 would be wrong.
  assert.equal(secretaryDutiesFor(base, "mine", W)[0].time, "20:15");
});
t("a duty just after midnight wraps rather than going negative", () => {
  const d = { ...base, games: [{ ...game, time: "00:05" }] };
  assert.equal(secretaryDutiesFor(d, "mine", W)[0].time, "23:50");
});
t("a game with no time yields no arrival time either", () => {
  const d = { ...base, games: [{ ...game, time: "" }] };
  assert.equal(secretaryDutiesFor(d, "mine", W)[0].time, "");
});
t("a manual address override wins over the federation venue", () => {
  const d = { ...base, games: [{ ...game, addressOverride: "היכל הספורט, רחוב אחר" }] };
  assert.equal(secretaryDutiesFor(d, "mine", W)[0].venue, "היכל הספורט, רחוב אחר");
});

console.log("- host resolution -");
t("`playing` wins over the row's own team id", () => {
  const d = {
    ...base,
    weeklyAssignments: { [`${W}__other`]: { playing: "host", secretary: "mine" } },
  };
  assert.equal(secretaryDutiesFor(d, "mine", W)[0].hostTeamId, "host");
});
t("the row team is the fallback when `playing` is empty", () => {
  const d = {
    ...base,
    weeklyAssignments: { [`${W}__host`]: { playing: "", secretary: "mine" } },
  };
  assert.equal(secretaryDutiesFor(d, "mine", W)[0].hostTeamId, "host");
});
t("keeping the table at your own game is a slip, not a duty", () => {
  const d = {
    ...base,
    weeklyAssignments: { [`${W}__mine`]: { playing: "mine", secretary: "mine" } },
  };
  assert.deepEqual(secretaryDutiesFor(d, "mine", W), []);
});

console.log("- fixtures -");
t("a cancelled game produces no duty", () => {
  const d = { ...base, games: [{ ...game, cancelled: true }] };
  const out = secretaryDutiesFor(d, "mine", W);
  assert.equal(out.length, 1);
  assert.equal(out[0].date, "");     // still says "this week", without a time
});
t("an AWAY game of the host is not a home fixture", () => {
  const d = { ...base, games: [{ ...game, isHome: false }] };
  assert.equal(secretaryDutiesFor(d, "mine", W)[0].date, "");
});
t("two home games that week = two duties", () => {
  const d = {
    ...base,
    games: [game, { ...game, federationCode: "749197", date: "09-09-2026", time: "18:00" }],
  };
  const out = secretaryDutiesFor(d, "mine", W);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((x) => x.time), ["20:15", "17:45"]);
});
t("no fixture on record still reports the duty, without a date", () => {
  const d = { ...base, games: [] };
  const out = secretaryDutiesFor(d, "mine", W);
  assert.equal(out.length, 1);
  assert.equal(out[0].date, "");
  assert.equal(out[0].hostTeamName, "נוער על");
});
t("dated duties sort before undated ones", () => {
  const d = {
    ...base,
    weeklyAssignments: {
      [`${W}__host`]: { playing: "host", secretary: "mine" },
      [`${W}__other`]: { playing: "other", secretary: "mine" },
    },
  };
  const out = secretaryDutiesFor(d, "mine", W);
  assert.equal(out.length, 2);
  assert.equal(out[0].hostTeamId, "host");   // has a game
  assert.equal(out[1].date, "");             // "other" has none
});

console.log("- labels -");
t("label names the host", () =>
  assert.equal(secretaryLabel({ hostTeamName: "נוער על" }), "מזכירות — משחק של נוער על"));
t("label names the TIP-OFF, because the time beside it is 15 minutes earlier", () =>
  assert.equal(secretaryLabel({ hostTeamName: "נוער על", gameTime: "20:30" }),
    "מזכירות — משחק של נוער על · שריקה 20:30"));
t("label survives a missing host name", () =>
  assert.equal(secretaryLabel({ hostTeamName: "" }), "מזכירות"));
t("when = day, date and the ARRIVAL time", () =>
  assert.equal(secretaryWhen({ day: "שני", date: "07-09-2026", time: "20:15" }), "יום שני 07/09 · 20:15"));
t("when is empty for an undated duty", () =>
  assert.equal(secretaryWhen({ date: "" }), ""));
t("shortDate trims the year", () => assert.equal(shortDate("07-09-2026"), "07/09"));

// ---- The lead time is the CLUB's rule, not the product's ----
//
// The single-club branch hard-codes fifteen minutes with a comment saying out loud that it
// is "a club rule". These assertions are what makes moving it to settings real, and what
// stops a bad value from putting "NaN:NaN" on a coach's screen.

t("a club that has not set it gets the default", () =>
  assert.equal(secretaryLeadFor({ settings: {} }), SECRETARY_LEAD_MIN));
t("...and so does a club document with no settings at all", () =>
  assert.equal(secretaryLeadFor(undefined), SECRETARY_LEAD_MIN));
t("a club's own value is used", () =>
  assert.equal(secretaryLeadFor({ settings: { secretaryLeadMin: 30 } }), 30));
t("zero is a real answer — 'arrive at tip-off'", () =>
  assert.equal(secretaryLeadFor({ settings: { secretaryLeadMin: 0 } }), 0));
t("a numeric string from the form is accepted", () =>
  assert.equal(secretaryLeadFor({ settings: { secretaryLeadMin: "20" } }), 20));
t("a cleared field falls back rather than becoming NaN", () =>
  assert.equal(secretaryLeadFor({ settings: { secretaryLeadMin: "" } }), SECRETARY_LEAD_MIN));
for (const bad of ["רבע שעה", null, undefined, true, false, [], -5, 999, Infinity, NaN, {}, "  "]) {
  t(`a value that cannot be a lead time is refused: ${JSON.stringify(bad)}`, () =>
    assert.equal(secretaryLeadFor({ settings: { secretaryLeadMin: bad } }), SECRETARY_LEAD_MIN));
}

t("the duty time follows the club's own lead", () => {
  const at = (lead) =>
    secretaryDutiesFor({ ...base, settings: { secretaryLeadMin: lead } }, "mine", W)[0].time;
  assert.equal(at(15), "20:15");
  assert.equal(at(30), "20:00");
  assert.equal(at(0), "20:30", "no lead means the tip-off time itself");
  // The tip-off itself never moves — it is the game's, not the club's.
  assert.equal(secretaryDutiesFor({ ...base, settings: { secretaryLeadMin: 45 } }, "mine", W)[0].gameTime, "20:30");
});

t("a lead that crosses midnight wraps instead of going negative", () => {
  const lateGame = { ...game, time: "00:10" };
  const duty = secretaryDutiesFor(
    { ...base, games: [lateGame], settings: { secretaryLeadMin: 30 } }, "mine", W
  )[0];
  assert.equal(duty.time, "23:40");
});

console.log("\n" + pass + " tests passed");
