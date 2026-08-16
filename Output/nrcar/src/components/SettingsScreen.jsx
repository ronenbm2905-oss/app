import { useState } from "react";
import { LogOut, Download, Trash2, Siren } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import { SCHEMA_VERSION, DEFAULTS } from "../constants.js";
import { Card, Notice } from "./ui/Card.jsx";
import { Field, Select, Switch, TextInput, PhoneInput } from "./ui/Field.jsx";
import Button, { LinkButton } from "./ui/Button.jsx";

// ============================================================================
// SettingsScreen.
//
// שתי דרישות שנראות "אדמיניסטרטיביות" והן למעשה חוסמות:
//
// 1. **"יציאה מהחשבון" היא פעולה גלויה בלחיצה אחת** — לא שלוש רמות עומק.
//    אצל קהל מבוגר, פעולה קבורה שווה לפעולה שלא קיימת, וזה גם התיקון
//    היחיד שיש למי שהטלפון שלו נגיש לאחרים (עדי 1.1ב).
//
// 2. **מחיקת חשבון וייצוא נתונים — גלויים, לא חבויים** (N6). זו לא רק
//    פרטיות: Apple 5.1.1(v) מחייבת יזימת מחיקה מתוך האפליקציה מאז 30.6.2022,
//    ו-Google Play מחייבת מסלול מחיקה מאז 31.5.2024. פרוסה 3 היא חנויות —
//    לגלות את זה בדחיית הגשה עולה פרוסה שלמה.
//
// ⚠️ `emergencyOffline: "textAndDocs"` **מושבת ומסומן "בקרוב"** עד שהמימוש
// ב-Cache Storage ינחת בפרוסה 2. מתג שמבטיח שמירת מסמכים על המכשיר בזמן
// שנשמר טקסט בלבד הוא מצג שלא תואם את הקוד. הטקסטים של עדי (6.4) נשארים
// במילון ומחוברים לרגע שהמימוש יגיע.
// ============================================================================

const LEAD_OPTIONS = [
  { days: 30, key: "settings.reminders.lead.month" },
  { days: 14, key: "settings.reminders.lead.twoWeeks" },
  { days: 7, key: "settings.reminders.lead.week" },
];

export function SettingsScreen({ data, actions, user, isLocal, onSignOut, navigate }) {
  const { t, lang, setLang } = useI18n();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [done, setDone] = useState(null);
  const settings = data.settings || {};
  const profile = data.profile || {};
  const [name, setName] = useState(profile.displayName || user?.displayName || "");
  const [phone, setPhone] = useState(profile.phone || "");

  const exportData = () => {
    const { json } = actions.exportHousehold(data);
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nrcar-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDone("export");
  };

  const deleteAll = async () => {
    await actions.deleteHousehold(data);
    setConfirmDelete(false);
    setDone("delete");
  };

  return (
    <>
      <h1 className="text-2xl font-bold text-ink-strong">{t("settings.title")}</h1>

      {done && (
        <Notice tone="ok" title={t(done === "export" ? "settings.account.export.done" : "settings.account.delete.done")} />
      )}

      {/* -- פרופיל -------------------------------------------------------- */}
      {/* ⚠️ שדות מבוקרים מקומית, ונשמרים ב-blur.
          קודם כל הקלדה קראה ל-`saveProfile`, כלומר **כתיבה ל-Firestore לכל
          תו**. זה לא איבוד נתונים, אבל זה עשרות כתיבות מיותרות לשם אחד
          ומרוץ בין תווים סמוכים. */}
      <Card className="space-y-4 p-4">
        <h2 className="text-xl font-semibold text-ink">{t("settings.section.profile")}</h2>
        <Field label={t("settings.profile.name")}>
          {({ id, ...aria }) => (
            <TextInput
              id={id}
              {...aria}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name !== (profile.displayName || "") && actions.saveProfile({ displayName: name })}
            />
          )}
        </Field>
        {/* הטלפון הזה הוא מה שמופיע בכרטיס החירום — שם + טלפון בלבד (O7). */}
        <Field label={t("settings.profile.phone")}>
          {({ id, ...aria }) => (
            <PhoneInput
              id={id}
              {...aria}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => phone !== (profile.phone || "") && actions.saveProfile({ phone })}
            />
          )}
        </Field>
      </Card>

      {/* -- תזכורות ------------------------------------------------------- */}
      <Card className="space-y-4 p-4">
        <h2 className="text-xl font-semibold text-ink">{t("settings.section.reminders")}</h2>
        <Field label={t("settings.reminders.lead")} hint={t("settings.reminders.lead.hint")}>
          {({ id, ...aria }) => (
            <Select
              id={id}
              {...aria}
              value={settings.leadDays ?? DEFAULTS.leadDays}
              onChange={(e) => actions.setSettings({ leadDays: Number(e.target.value) })}
            >
              {LEAD_OPTIONS.map((o) => (
                <option key={o.days} value={o.days}>
                  {t(o.key)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {/* ההובלה עצמה (Push/SMS/מייל) היא פרוסה 2 — מוצג כ"בקרוב", לא
            כמתג שלא עושה כלום. */}
        <p className="text-lg text-ink-muted">
          {t("settings.reminders.channels")} — {t("settings.reminders.soon")}
        </p>
        <p className="max-w-prose text-sm text-ink-soft">{t("legal.disclaimer.reminders")}</p>
      </Card>

      {/* -- מסך חירום ----------------------------------------------------- */}
      <Card className="space-y-4 p-4">
        <h2 className="text-xl font-semibold text-ink">{t("settings.section.emergency")}</h2>
        <LinkButton href="#/emergency" variant="secondary" size="md" className="w-auto">
          <Siren size={24} aria-hidden="true" />
          {t("emergency.drill.cta")}
        </LinkButton>

        <Switch
          checked={settings.emergencyOffline !== "none"}
          onChange={() => {}}
          disabled
          label={t("settings.emergency.offline")}
          hint={t("settings.emergency.offline.hint")}
        />

        {/* ============================================================
            ⚠️ **מושבת בכוונה — "בקרוב", לא "פעיל".**
            המימוש (שמירת קובצי המסמכים ב-Cache Storage) מגיע בפרוסה 2.
            מתג שמבטיח "המסמכים יישמרו על המכשיר" בזמן שנשמר **טקסט בלבד**
            הוא הצהרה שלא תואמת את מה שהקוד עושה — בדיוק סוג המצג שחסם
            deploy בפרויקט הכדורסל. עדיף "בקרוב" כן, על "פעיל" לא.
            הטקסטים (6.4 של עדי) נשארים במילון ומחוברים לרגע שהמימוש ינחת.
            ============================================================ */}
        <Switch
          checked={false}
          onChange={() => {}}
          disabled
          label={`${t("settings.emergency.offline.docs")} — ${t("settings.reminders.soon")}`}
          hint={t("settings.emergency.offline.docs.hint")}
        />

        {/* "always" מוצג כאפשרות **מושבתת** — לא כמימוש חלש. הביומטריה
            האמיתית מגיעה עם Capacitor. */}
        <fieldset className="space-y-2">
          <legend className="text-base font-medium text-ink-soft">{t("settings.emergency.auth")}</legend>
          <label className="flex items-center gap-3 text-lg text-ink">
            <input
              type="radio"
              name="emergencyAuth"
              className="h-6 w-6"
              checked={(settings.emergencyAuth || "session") === "session"}
              onChange={() => actions.setSettings({ emergencyAuth: "session" })}
            />
            {t("settings.emergency.auth.session")}
          </label>
          <label className="flex items-center gap-3 text-lg text-ink-muted">
            <input type="radio" name="emergencyAuth" className="h-6 w-6" disabled />
            {t("settings.emergency.auth.always")} — {t("settings.emergency.auth.soon")}
          </label>
        </fieldset>
      </Card>

      {/* -- תצוגה --------------------------------------------------------- */}
      <Card className="space-y-4 p-4">
        <h2 className="text-xl font-semibold text-ink">{t("settings.section.display")}</h2>
        <Field label={t("settings.display.language")}>
          {({ id, ...aria }) => (
            <Select id={id} {...aria} value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="he">עברית</option>
              <option value="en">English</option>
            </Select>
          )}
        </Field>
      </Card>

      {/* -- נהגים — פרוסה 2 ----------------------------------------------- */}
      <Card className="space-y-2 p-4">
        <h2 className="text-xl font-semibold text-ink">{t("settings.section.drivers")}</h2>
        <p className="max-w-prose text-lg text-ink-muted">{t("settings.drivers.soon")}</p>
      </Card>

      {/* -- משפטי --------------------------------------------------------- */}
      <Card className="space-y-3 p-4">
        <h2 className="text-xl font-semibold text-ink">{t("settings.section.legal")}</h2>
        <LinkButton href="#/settings/notice" variant="secondary" size="md" className="w-auto">
          {t("legal.notice.reopen")}
        </LinkButton>
        <LinkButton href="#/settings/accessibility" variant="secondary" size="md" className="w-auto">
          {t("settings.legal.accessibility")}
        </LinkButton>
        <p className="max-w-prose text-sm text-ink-soft">{t("legal.disclaimer.docs")}</p>
      </Card>

      {/* -- החשבון -------------------------------------------------------- */}
      <Card className="space-y-4 p-4">
        <h2 className="text-xl font-semibold text-ink">{t("settings.section.account")}</h2>

        {/* ★ יציאה — פעולה גלויה בלחיצה אחת. */}
        {!isLocal && (
          <Button variant="secondary" onClick={onSignOut}>
            <LogOut size={24} aria-hidden="true" />
            {t("settings.account.signOut")}
          </Button>
        )}

        {/* ★ N6 — זכות העיון, גלויה. */}
        <div className="space-y-2">
          <Button variant="secondary" onClick={exportData}>
            <Download size={24} aria-hidden="true" />
            {t("settings.account.export")}
          </Button>
          <p className="max-w-prose text-base text-ink-muted">{t("settings.account.export.hint")}</p>
        </div>

        {/* ★ N6 — מחיקת חשבון, גלויה, מאחורי אישור כפול. */}
        {!confirmDelete ? (
          <Button variant="quiet" size="md" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={24} aria-hidden="true" />
            {t("settings.account.delete")}
          </Button>
        ) : (
          <Notice tone="danger" title={t("settings.account.delete.confirm.title")}>
            <p>{t("settings.account.delete.confirm.body")}</p>
            <div className="mt-3 space-y-3">
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                {t("settings.account.delete.cancel")}
              </Button>
              <Button variant="quiet" size="md" onClick={deleteAll}>
                {t("settings.account.delete.confirm.cta")}
              </Button>
            </div>
          </Notice>
        )}

        <p className="text-base text-ink-muted num">
          {t("settings.version", { n: `0.1 · schema ${SCHEMA_VERSION}` })}
        </p>
      </Card>
    </>
  );
}

export default SettingsScreen;
