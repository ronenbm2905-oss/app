import { useState, useRef } from "react";
import { clubName as clubNameOf, clubPickupPoint } from "../utils/club";
import { formatWeekRange } from "../utils/dates";
import {
  awayGamesForWeek,
  buildTransportRows,
  exportTransportXlsx,
  transportRowToCells,
  TRANSPORT_HEADERS,
} from "../utils/transport";
import { WeekNav } from "./ui/WeekNav";
import { IconDownload, IconBus, IconMapPin } from "./ui/icons";

// Cells that read better centered (times / short codes) — by column index in TRANSPORT_HEADERS.
const CENTER_COLS = new Set([1, 3, 8, 10, 11]); // יום, שעה, שעת התייצבות, איסוף חזרה, סוג רכב

// Manager tool: weekly export of away games + addresses for ordering transportation.
// Two outputs — an editable .xlsx (send to the bus vendor) and a PNG image (share on WhatsApp).
// Column set matches the file the vendor already knows from last season.
export function TransportExport({ data, weekStart, setWeekStart }) {
  const [departBefore, setDepartBefore] = useState(90); // minutes before tip-off → "שעת התייצבות"
  const [busy, setBusy] = useState(false);
  const captureRef = useRef(null); // off-screen node snapshotted into the shareable image

  const CLUB_NAME = clubNameOf(data);
  const pickupPoint = clubPickupPoint(data);

  const awayGames = awayGamesForWeek(data.games || [], weekStart);
  const rows = buildTransportRows(awayGames, {
    teams: data.teams,
    coaches: data.coaches,
    departBefore,
    pickupPoint,
  });
  const weekLabel = formatWeekRange(weekStart);
  const hasRows = rows.length > 0;

  const handleXlsx = () => {
    if (!hasRows) return;
    exportTransportXlsx(rows, weekStart);
  };

  async function handleImage() {
    if (!captureRef.current || !hasRows || busy) return;
    setBusy(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(captureRef.current, { scale: 2, backgroundColor: "#ffffff" });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("no blob");
      const fileName = `הסעות-משחקי-חוץ-${weekStart}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `הסעות משחקי חוץ — ${weekLabel}` });
          return;
        } catch (err) {
          if (err && err.name === "AbortError") return; // user cancelled the share sheet
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("לא הצלחנו להפיק את הקובץ. נסה שוב, או הפק אותו מהמחשב.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3" dir="rtl">
      <div className="flex items-center gap-2">
        <IconBus size={18} className="text-indigo-700 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-indigo-900">הסעות למשחקי חוץ</h3>
          <p className="text-xs text-indigo-700">
            רשימת משחקי החוץ לשבוע הנבחר, מוכנה להזמנת הסעות — כולל מאמן, טלפון, כתובת, שעות ורכב.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <WeekNav value={weekStart} onChange={setWeekStart} />
        <label className="flex items-center gap-1.5 text-xs text-indigo-900">
          התייצבות
          <input
            type="number"
            min={0}
            step={15}
            value={departBefore}
            onChange={(e) => setDepartBefore(Math.max(0, Number(e.target.value) || 0))}
            className="w-16 bg-white border border-indigo-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="דקות לפני המשחק להתייצבות"
          />
          דק' לפני שריקת הפתיחה
        </label>
      </div>

      <div className="text-xs text-indigo-800">
        {hasRows
          ? `${rows.length} משחקי חוץ בשבוע ${weekLabel}. נקודת איסוף: ${pickupPoint}. איסוף חזרה = סיום המשחק.`
          : `אין משחקי חוץ בשבוע ${weekLabel}.`}
      </div>

      {/* On-screen preview so the manager sees what will be exported */}
      {hasRows && (
        <div className="bg-white rounded-lg border border-indigo-100 overflow-x-auto">
          <table className="w-full text-xs" dir="rtl">
            <thead>
              <tr className="bg-indigo-100/60 text-indigo-900">
                {TRANSPORT_HEADERS.map((h) => (
                  <th key={h} className="px-2.5 py-1.5 text-right font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-50">
              {rows.map((r, i) => (
                <tr key={i} className="text-stone-700">
                  {transportRowToCells(r).map((cell, ci) => (
                    <td
                      key={ci}
                      className={`px-2.5 py-1.5 ${CENTER_COLS.has(ci) ? "text-center tabular-nums whitespace-nowrap" : ""}`}
                    >
                      {cell || (ci === 5 ? "—" : "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleXlsx}
          disabled={!hasRows}
          className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600"
          title={hasRows ? "הורדת קובץ אקסל" : "אין משחקי חוץ בשבוע זה"}
        >
          <IconDownload size={15} /> ייצוא אקסל
        </button>
        <button
          onClick={handleImage}
          disabled={!hasRows || busy}
          className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-50 disabled:opacity-40"
          title={hasRows ? "שיתוף / הורדת תמונה" : "אין משחקי חוץ בשבוע זה"}
        >
          <IconMapPin size={15} /> {busy ? "מכין תמונה..." : "שיתוף / הורדת תמונה"}
        </button>
      </div>

      {/* Off-screen capture target for the PNG (rendered, not display:none, so html2canvas can snapshot it) */}
      <div
        ref={captureRef}
        dir="rtl"
        aria-hidden="true"
        style={{ position: "fixed", top: 0, left: "-10000px", width: "1180px", background: "#fff", padding: "24px" }}
      >
        <div style={{ textAlign: "center", marginBottom: "10px" }}>
          <div style={{ fontSize: "13px", color: "#57534E" }}>{CLUB_NAME}</div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "4px 0" }}>הסעות — משחקי חוץ</h1>
          <div style={{ fontSize: "14px", color: "#57534E" }}>{weekLabel}</div>
          <div style={{ fontSize: "12px", color: "#6366F1", marginTop: "2px" }}>
            התייצבות {departBefore} דק' לפני המשחק · איסוף חזרה = סיום המשחק · נקודת איסוף: {pickupPoint}
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ background: "#EEF2FF" }}>
              {TRANSPORT_HEADERS.map((h) => (
                <th key={h} style={{ border: "1px solid #C7D2FE", padding: "5px 6px", textAlign: "right", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {transportRowToCells(r).map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      border: "1px solid #E0E7FF",
                      padding: "5px 6px",
                      textAlign: CENTER_COLS.has(ci) ? "center" : "right",
                      fontWeight: ci === 8 ? 700 : ci === 1 ? 600 : 400,
                      color: ci === 8 ? "#4338CA" : "#1C1917",
                      whiteSpace: CENTER_COLS.has(ci) ? "nowrap" : "normal",
                    }}
                  >
                    {cell || (ci === 5 ? "—" : "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
