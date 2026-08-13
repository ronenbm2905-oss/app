import { formatAgorot } from "./money.js";
import { originLabel } from "./validate.js";
import { formatCarat, formatDate, toWhatsappDigits } from "./format.js";

// ============================================================================
// whatsapp.js — 🔴 **O1: ההודעה המוכנה היא מסמך גילוי, לא נוחות.**
//
// ההמרה יוצאת מהפלטפורמה — הסגירה קורית בוואטסאפ. תקנות 1995 דורשות גילוי
// (צורה, טבעי/מסונתז, משקל בקראט, מילוי/טיפול צבע) **בעל פה זמן סביר לפני
// המכירה ובמסמך בכתב הכולל את שם העוסק וכתובתו**. ההודעה המוכנה היא הנקודה
// האחרונה שבה האפליקציה עדיין שולטת בתוכן.
//
// לכן ההודעה נושאת את **המפרט המלא** ולא רק את שם הפריט:
//   מונח המקור הנגזר · קראט · צורה · צבע · ניקיון · טיפולים · מספר תעודה ·
//   מחיר כולל מע"מ · תאריך עדכון המחיר · שם וכתובת העוסק.
//
// "מתעניין בטבעת" מוחק את כל עבודת הגילוי שנעשתה בדף.
// ============================================================================

export function whatsappHref(rawNumber, message) {
  const digits = toWhatsappDigits(rawNumber);
  if (!digits) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${text}`;
}

// שורת המפרט של אבן — משמשת גם בהודעה וגם ב-listingSnapshot.
export function diamondSpecLine(t, diamond, lang = "he") {
  if (!diamond) return "";
  const parts = [
    originLabel(diamond.origin, lang), // A2.3(ד) — המונח הנגזר, בהודעה
    `${formatCarat(diamond.carat)}ct`,
    t(`taxonomy.shape.${diamond.shape}`),
    `${t("diamond.color")} ${diamond.color}`,
    `${t("diamond.clarity")} ${diamond.clarity}`,
    treatmentsLabel(t, diamond), // A3.3 — הטיפולים חלק מהמפרט
  ];
  if (diamond.certLab && diamond.certNumber) {
    parts.push(`${t("diamond.cert")} ${diamond.certLab} ${diamond.certNumber}`);
  }
  return parts.filter(Boolean).join(" · ");
}

export function treatmentsLabel(t, diamond) {
  const list = Array.isArray(diamond?.treatments) ? diamond.treatments : [];
  if (list.length === 0) return "";
  if (list.length === 1 && list[0] === "none") return t("diamond.noTreatment");
  return list.map((tr) => t(`taxonomy.treatment.${tr}`)).join(", ");
}

// זיהוי העוסק — נדרש במסמך הגילוי (תקנות 1995).
function vendorLine(contact) {
  const bits = [contact?.legalEntityName, contact?.legalEntityId, contact?.legalEntityAddress].filter(
    Boolean
  );
  return bits.length ? bits.join(" · ") : "";
}

export function generalMessage(t) {
  return t("whatsapp.generalMessage");
}

export function modelMessage(t, model, lang = "he") {
  return t("whatsapp.modelMessage", {
    modelSku: model?.sku || "",
    modelTitle: (lang === "en" ? model?.title_en : model?.title_he) || model?.title_he || "",
  });
}

export function diamondMessage(t, diamond, contact, lang = "he") {
  const lines = [
    t("whatsapp.diamondIntro", { stoneId: diamond?.stoneId || "" }),
    diamondSpecLine(t, diamond, lang),
    t("whatsapp.priceLine", {
      price: formatAgorot(diamond?.priceAgorot, lang) || "",
      updated: formatDate(diamond?.priceUpdatedAt, lang),
    }),
  ];
  const vendor = vendorLine(contact);
  if (vendor) lines.push(vendor);
  return lines.filter(Boolean).join("\n");
}

// ההודעה של הקונפיגורטור — הפריט המרכזי.
export function configMessage(
  t,
  { model, metalColor, metalKarat, diamond, totalAgorot, priceUpdatedAt },
  contact,
  lang = "he"
) {
  const title = (lang === "en" ? model?.title_en : model?.title_he) || model?.title_he || "";
  const lines = [
    t("whatsapp.configIntro"),
    t("whatsapp.configModelLine", { modelSku: model?.sku || "", modelTitle: title }),
    t("whatsapp.configMetalLine", {
      karat: t(`taxonomy.metalKaratShort.${metalKarat}`),
      metal: t(`taxonomy.metalColor.${metalColor}`),
    }),
    diamond
      ? t("whatsapp.configDiamondLine", {
          stoneId: diamond.stoneId || "",
          spec: diamondSpecLine(t, diamond, lang),
        })
      : t("whatsapp.configNoDiamond"),
    t("whatsapp.priceLine", {
      price: formatAgorot(totalAgorot, lang) || "",
      updated: formatDate(priceUpdatedAt, lang),
    }),
    // A5.8א — הסכום הוא הצעת מחיר, לא הצעה מחייבת. גם בהודעה, לא רק במסך.
    t("model.quoteDisclaimer"),
  ];
  const vendor = vendorLine(contact);
  if (vendor) lines.push(vendor);
  return lines.filter(Boolean).join("\n");
}

// ---------------------------------------------------------------------------
// 🔴 A7.6 / A5.8א — תצלום מצב של מה שהלקוח ראה בפועל.
// **ערכים משוכפלים, לא הפניה לפריט.** אם יישמר רק `modelId` והמחיר ישתנה
// אחר כך — אין דרך לדעת מה הלקוח ראה, וזו בדיוק המחלוקת.
// ---------------------------------------------------------------------------
export function buildListingSnapshot(
  t,
  { model, metalColor, metalKarat, diamond, price },
  lang = "he"
) {
  return {
    quotedAt: new Date().toISOString(),
    lang,
    modelId: model?.id || null,
    modelSku: model?.sku || null,
    modelTitle: (lang === "en" ? model?.title_en : model?.title_he) || model?.title_he || null,
    metalColor: metalColor || null,
    metalKarat: metalKarat || null,
    stoneCount: price?.stoneCount ?? 1,
    diamondId: diamond?.id || null,
    diamondStoneId: diamond?.stoneId || null,
    origin: diamond?.origin || null,
    originLabel: diamond ? originLabel(diamond.origin, lang) : null,
    carat: diamond?.carat ?? null,
    shape: diamond?.shape || null,
    color: diamond?.color || null,
    clarity: diamond?.clarity || null,
    cut: diamond?.cut || null,
    treatments: Array.isArray(diamond?.treatments) ? [...diamond.treatments] : [],
    certLab: diamond?.certLab || null,
    certNumber: diamond?.certNumber || null,
    settingAgorot: price?.settingAgorot ?? null,
    diamondsAgorot: price?.diamondsAgorot ?? null,
    totalAgorot: price?.totalAgorot ?? null,
    vatIncluded: true,
    priceUpdatedAt: model?.priceUpdatedAt || null,
    specLine: diamond ? diamondSpecLine(t, diamond, lang) : null,
  };
}
