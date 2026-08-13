import DiamondShape from "./ui/DiamondShape.jsx";
import SmartImage from "./ui/SmartImage.jsx";
import { useI18n } from "../hooks/useI18n.jsx";

// ============================================================================
// DiamondVisual — 🔴 A1, במקום אחד.
//
// עדי: "תמונה להמחשה בלבד" **אינה מרפאת** את ההטעיה. אבן עם 4C, מספר תעודה
// ומחיר טוענת שיש אבן פיזית אחת ומסוימת; תווית "להמחשה" לצד הטענה הזאת אינה
// הסתייגות אלא **סתירה**. לכן `validateListing` חוסמת פרסום של אבן עם תמונת
// סטוק, והרכיב הזה פשוט לא מקבל כזו.
//
//   יש תמונה אמיתית (`isStock === false`) → מציגים אותה.
//   אין                                    → **איור סכמטי לפי הצורה**, עם
//                                            משפט מפורש שזה איור.
//
// ⚠️ אם בכל זאת הגיעה לכאן תמונה עם `isStock === true` (נתון ישן, ייבוא) —
// אנחנו **לא** מציגים אותה. עדיף איור מאשר תצלום מתחזה.
// ============================================================================

export default function DiamondVisual({ diamond, className = "", showNote = false, priority = false }) {
  const { t, lang } = useI18n();
  const shapeLabel = t(`taxonomy.shape.${diamond?.shape}`);

  const images = Array.isArray(diamond?.images) ? diamond.images : [];
  const realPhoto = images.find((img) => img?.url && img.isStock === false);

  if (realPhoto) {
    const alt =
      (lang === "en" ? realPhoto.alt_en : realPhoto.alt_he) ||
      `${t("diamond.title")} ${diamond?.stoneId || ""} — ${shapeLabel}`;
    return (
      <div className={className}>
        <SmartImage
          src={realPhoto.url}
          alt={alt}
          className="aspect-square h-full w-full"
          priority={priority}
          fallback={<DiamondShape shape={diamond?.shape} className="h-1/2 w-1/2" />}
        />
        {showNote ? <p className="mt-2 text-sm text-muted">{t("diamond.realPhoto")}</p> : null}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex aspect-square h-full w-full items-center justify-center bg-gradient-to-br from-white to-sand">
        <DiamondShape
          shape={diamond?.shape}
          className="h-[62%] w-[62%]"
          title={t("diamond.schematicAlt", { shape: shapeLabel })}
        />
      </div>
      {showNote ? <p className="mt-2 text-sm text-muted">{t("diamond.schematicNote")}</p> : null}
    </div>
  );
}
