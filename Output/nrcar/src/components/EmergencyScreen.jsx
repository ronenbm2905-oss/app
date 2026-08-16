import { useEffect, useMemo, useState } from "react";
import { Siren, Phone, FileText, ChevronLeft, WifiOff, Plus } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import { buildEmergencyCard, cacheEmergencyCard, readCachedCard } from "../utils/emergency.js";
import { EMERGENCY_NUMBERS } from "../constants.js";
import { activeVehicles } from "../utils/options.js";
import { formatDate, telLink, formatPhone } from "../utils/format.js";
import { Card, Notice, EmptyState } from "./ui/Card.jsx";
import Button, { LinkButton } from "./ui/Button.jsx";
import DocViewer from "./DocViewer.jsx";

// ============================================================================
// EmergencyScreen — עמוד הערך השני של המוצר, ומסך שנפתח בזירת תאונה.
//
// 🔴 **חוק ברזל: אין שום נתיב קריאה לא-מאומת.** אין קישור ציבורי, אין QR,
// ואין "מצב חירום" שעוקף Auth. השער היחיד הוא סשן קיים — והוא נאכף ב-App:
// בלי משתמש, האפליקציה כולה מציגה מסך כניסה, כולל המסלול הזה. הלחץ להוסיף
// "QR למגן דוד אדום" יגיע, והוא יישמע הגיוני. הוא לא.
//
// עקרונות התכנון של המסך (מפרט איתי §6.2):
//   · **סדר ה-DOM = סדר הקריאה = סדר החשיבות.** הקורא עומד בצד הדרך, בלחץ,
//     אולי מקריא למישהו אחר. גלילה אנכית אחת: בלי טאבים, בלי אקורדיון,
//     בלי מפה, ובלי `navigator.geolocation`.
//   · **מספר הרישוי הוא הפריט הגדול ביותר באפליקציה כולה** — הוא הדבר
//     הראשון שנמסר בזירת תאונה.
//   · **בלי skeleton חוסם.** הכרטיס מוצג מיד מהמטמון; רענון מתעדכן בשקט
//     מתחת. מסך חירום שמראה ספינר הוא מסך חירום שנכשל.
//   · כפתורי החיוג הם **`<a href="tel:">` בלבד** — לא חיוג תכנותי.
//   · פרטי הבעלים = **שם + טלפון בלבד** (O7). מה שלא על המסך לא דולף.
// ============================================================================

export function EmergencyScreen({ data, uid, today, navigate }) {
  const { t, lang } = useI18n();
  const vehicles = activeVehicles(data);
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || null);
  const [viewing, setViewing] = useState(null);

  const card = useMemo(
    () => buildEmergencyCard({ data, vehicleId, uid, profile: data.profile }),
    [data, vehicleId, uid]
  );

  // מטמון: נכתב אחרי כל טעינה מוצלחת, נקרא כשאין נתונים.
  // ⚠️ טקסט בלבד. לעולם לא כתובות הורדה — URL במטמון הוא מאגר טוקנים
  // קבועים על המכשיר (N1 + N2).
  useEffect(() => {
    if (card && uid) cacheEmergencyCard(uid, card);
  }, [card, uid]);

  const cached = !card && vehicleId ? readCachedCard(uid, vehicleId) : null;
  const shown = card || cached?.card || null;

  if (!vehicles.length && !shown) {
    return (
      <EmptyState
        title={t("emergency.empty.noVehicle.title")}
        body={t("emergency.empty.noVehicle.body")}
        action={
          <LinkButton href="#/vehicles/new" variant="primary">
            <Plus size={24} aria-hidden="true" />
            {t("emergency.empty.noVehicle.cta")}
          </LinkButton>
        }
      />
    );
  }

  const docs = [...(shown?.documents || []), ...(shown?.personal || [])];
  const resolveDoc = (entry) =>
    entry.storageDomain === "personal"
      ? (data.personalDocs || []).find((d) => d.id === entry.id)
      : (data.documents || []).find((d) => d.id === entry.id);

  return (
    <>
      {/* סרגל אדום מלא — לבן על #b91c1c = 6.47:1 ✓ */}
      <div className="-mx-4 -mt-4 mb-2 flex h-[64px] items-center gap-3 bg-danger-600 px-4">
        <Siren size={28} className="text-white" aria-hidden="true" />
        <h1 className="text-xl font-bold text-white">{t("emergency.title")}</h1>
      </div>

      {cached && (
        <Notice tone="warn" icon={<WifiOff size={24} />} title={t("emergency.offline.now")}>
          {cached.savedAt && <p>{t("emergency.offline.saved", { date: formatDate(cached.savedAt, lang) })}</p>}
          <p>{t("emergency.offline.docsUnavailable")}</p>
        </Notice>
      )}

      {/* בורר רכב — רק כשיש יותר מאחד. פחות בחירות, פחות בלבול. */}
      {vehicles.length > 1 && (
        <div className="flex flex-wrap gap-3">
          {vehicles.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={v.id === vehicleId}
              onClick={() => setVehicleId(v.id)}
              className={`min-h-12 rounded-xl border-2 px-4 text-lg font-semibold
                ${v.id === vehicleId ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface text-ink-soft"}`}
            >
              {v.nickname || v.manufacturer || v.plate}
            </button>
          ))}
        </div>
      )}

      {/* ① הרכב — מספר הרישוי ב-40px, הפריט הגדול ביותר באפליקציה. */}
      <Card className="space-y-2 p-4 text-center">
        <p className="text-base text-ink-muted">{t("emergency.field.vehicle")}</p>
        <p className="num text-3xl font-bold text-ink-strong">{shown?.plateFormatted || "—"}</p>
        <p className="text-lg text-ink">
          {[shown?.manufacturer, shown?.commercialName, shown?.year, shown?.color].filter(Boolean).join(" · ") ||
            t("emergency.field.missing")}
        </p>
      </Card>

      {/* ② ביטוח + חיוג למוקד — הפעולה השכיחה, ולכן כחולה ולא אדומה. */}
      <Card className="space-y-3 p-4">
        <p className="text-base text-ink-muted">{t("emergency.field.insurer")}</p>
        <p className="text-xl font-semibold text-ink">{shown?.insurer?.name || t("emergency.field.missing")}</p>
        <p className="text-base text-ink-muted">{t("emergency.field.policy")}</p>
        <p className="num text-2xl font-bold text-ink-strong">
          {shown?.insurer?.policyNumber || t("emergency.field.missing")}
        </p>
        {shown?.insurer?.phone ? (
          <LinkButton href={telLink(shown.insurer.phone)} variant="primary">
            <Phone size={24} aria-hidden="true" />
            {t("emergency.call.insurer")}
          </LinkButton>
        ) : (
          <Notice tone="info" title={t("emergency.call.insurer.missing")}>
            <Button variant="secondary" size="md" onClick={() => navigate(`/vehicle/${vehicleId}`)}>
              {t("emergency.call.insurer.add")}
            </Button>
          </Notice>
        )}
      </Card>

      {/* ③ חיוג מהיר — קישורי tel: בלבד. אדום = שירותי חירום ממשלתיים, ורק הם. */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-ink">{t("emergency.quickCall")}</h2>
        <LinkButton href={`tel:${EMERGENCY_NUMBERS.police}`} variant="emergency">
          <Phone size={24} aria-hidden="true" />
          <span className="num">{t("emergency.call.police")}</span>
        </LinkButton>
        <LinkButton href={`tel:${EMERGENCY_NUMBERS.mda}`} variant="emergency">
          <Phone size={24} aria-hidden="true" />
          <span className="num">{t("emergency.call.mda")}</span>
        </LinkButton>
      </section>

      {/* ④ המסמכים — רק shared של הרכב הזה, ורישיון הנהיגה של המשתמש עצמו. */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-ink">{t("nav.docs")}</h2>
        {!docs.length && (
          <Notice tone="info" title={t("emergency.empty.title")}>
            <p>{t("emergency.empty.body")}</p>
            <LinkButton href="#/docs" variant="secondary" size="md" className="mt-3 w-auto">
              {t("emergency.empty.cta")}
            </LinkButton>
          </Notice>
        )}
        {docs.map((entry) => {
          const doc = resolveDoc(entry);
          const available = entry.available && doc;
          return (
            <button
              key={entry.id}
              type="button"
              disabled={!available}
              onClick={() => setViewing(doc)}
              className="flex min-h-[72px] w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 text-start disabled:opacity-60"
            >
              <span className="flex items-center gap-3">
                <FileText size={24} className="text-brand-600" aria-hidden="true" />
                <span className="text-lg text-ink">{t(entry.labelKey)}</span>
              </span>
              <span className="flex items-center gap-2 text-base text-ink-muted">
                {available ? t("emergency.doc.open") : t("emergency.doc.missing")}
                <ChevronLeft size={24} className="icon-flip" aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </section>

      {/* ⑤ פרטי הבעלים — שם + טלפון בלבד (O7). בלי כתובת, בלי מייל, בלי מזהים. */}
      <Card className="space-y-2 p-4">
        <p className="text-base text-ink-muted">{t("emergency.field.owner")}</p>
        <p className="text-xl font-semibold text-ink">{shown?.owner?.name || t("emergency.field.missing")}</p>
        {shown?.owner?.phone && (
          <a href={telLink(shown.owner.phone)} className="text-lg text-brand-600 underline underline-offset-4">
            <span className="num">{formatPhone(shown.owner.phone)}</span>
          </a>
        )}
      </Card>

      <p className="max-w-prose text-sm text-ink-soft">{t("legal.disclaimer.emergency")}</p>

      {viewing && (
        <DocViewer doc={viewing} title={t(`doc.type.${viewing.type}`)} onClose={() => setViewing(null)} />
      )}
    </>
  );
}

export default EmergencyScreen;
