import { useRef, useState } from "react";
import { Paperclip, Trash2, ExternalLink, AlertTriangle, ShieldCheck } from "lucide-react";
import { useI18n } from "../../hooks/useI18n.jsx";
import Button from "./Button.jsx";
import { ACCEPTED_TYPES, uploadFile, resolveFileUrl } from "../../utils/files.js";
import { formatFileSize } from "../../utils/format.js";
import { storage, isFirebaseConfigured } from "../../firebase.js";

// FileInput — העלאת סריקה/צילום.
// D4: הקובץ עובר סטריפ EXIF **לפני** ההעלאה (בתוך uploadFile), והמשתמש רואה
//     חיווי מפורש שהמטא-דאטה הוסרה. אין geolocation בשום מקום בטופס.
// D2: `domain` חובה — הוא שקובע את נתיב ה-Storage, ולכן את ההרשאה.
export function FileInput({ value, onChange, label, domain, orgId, fineId, driverId, vehicleId, docId }) {
  const { t } = useI18n();
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const local = !isFirebaseConfigured || !storage;

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const meta = await uploadFile(file, {
        domain,
        orgId,
        fineId,
        driverId,
        vehicleId,
        docId,
        storage: local ? null : storage,
      });
      onChange(meta);
    } catch (err) {
      setError(err.errorKey || "file.err.type");
    } finally {
      setBusy(false);
    }
  };

  const openFile = async () => {
    const url = await resolveFileUrl(value, local ? null : storage);
    if (url) window.open(url, "_blank", "noopener");
  };

  return (
    <div>
      {label && <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>}
      <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-3">
        {value?.fileRef ? (
          <div className="flex flex-wrap items-center gap-2">
            <Paperclip size={15} className="text-slate-500" />
            <span className="text-sm text-slate-700">{value.fileName || t("doc.file")}</span>
            <span className="num text-xs text-slate-500">{formatFileSize(value.fileSize)}</span>
            {value.metadataStripped && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                <ShieldCheck size={12} /> {t("file.exifStripped")}
              </span>
            )}
            <Button size="sm" variant="secondary" onClick={openFile}>
              <ExternalLink size={13} /> {t("file.view")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
              <Trash2 size={13} /> {t("file.remove")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500">{t("file.none")}</span>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => ref.current?.click()}>
              <Paperclip size={13} /> {busy ? t("file.uploading") : t("file.choose")}
            </Button>
            <span className="text-xs text-slate-400">{t("file.accepted")}</span>
          </div>
        )}
        <input ref={ref} type="file" accept={ACCEPTED_TYPES} className="hidden" onChange={pick} />

        <p className="mt-2 flex items-start gap-1 text-[11px] text-slate-600">
          <ShieldCheck size={13} className="mt-px shrink-0 text-emerald-600" />
          {t("file.exifNote")}
        </p>
        <p
          className={`mt-1 flex items-start gap-1 text-[11px] ${
            local ? "text-amber-800" : "text-slate-500"
          }`}
        >
          {local && <AlertTriangle size={13} className="mt-px shrink-0" />}
          {local ? t("file.demoNote") : t("file.cloudNote")}
        </p>
        {error && <p className="mt-1 text-xs text-red-600">{t(error)}</p>}
      </div>
    </div>
  );
}

export default FileInput;
