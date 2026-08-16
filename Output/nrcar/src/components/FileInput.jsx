import { useRef, useState } from "react";
import { Upload, AlertCircle } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import { uploadFile, ACCEPTED_TYPES } from "../utils/files.js";
import { storage, isFirebaseConfigured } from "../firebase.js";
import Button from "./ui/Button.jsx";

// ============================================================================
// FileInput — בחירת קובץ + העלאה. **כל העלאה עוברת דרך utils/uploadFile**,
// ולכן היא תמיד עוברת קודם הפשטת EXIF (GPS, חותמת זמן, מזהה מכשיר).
//
// ⚠️ הכשל אינו שקוף: אם ההפשטה נכשלת — **לא מעלים**. עדיף לחסום מאשר
// להעלות תמונה עם קואורדינטות.
//
// ⚠️ מסמכים אישיים (domain="personal") חסומים במצב fallback מקומי, וההודעה
// היא של שירה ("כדי לשמור מסמכים אישיים צריך להתחבר לחשבון") ולא שגיאה
// טכנית. הבדיקה עצמה יושבת ב-validateFile, לא כאן — כדי שלא ניתן יהיה
// לעקוף אותה במסך אחר.
// ============================================================================

export function FileInput({ label, icon, domain, hid, vehicleId, driverId, docId, local, disabled, onPicked }) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const isLocal = local ?? !isFirebaseConfigured;

  const handle = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // כדי שבחירה חוזרת באותו קובץ תפעיל onChange
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const res = await uploadFile(file, {
        storage: isLocal ? null : storage,
        domain,
        hid,
        vehicleId,
        driverId,
        docId,
      });
      onPicked?.(res);
    } catch (err) {
      setError(err?.errorKey || "error.upload.title");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handle}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />
      <Button
        variant="secondary"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        loading={busy}
        loadingLabel={t("loading.upload")}
      >
        {icon || <Upload size={24} aria-hidden="true" />}
        {label}
      </Button>
      {error && (
        <p className="flex items-center gap-2 text-base text-danger-700">
          <AlertCircle size={20} aria-hidden="true" />
          {t(error)}
        </p>
      )}
    </div>
  );
}

export default FileInput;
