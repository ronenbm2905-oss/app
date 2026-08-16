import { useState } from "react";
import { Camera, ShieldCheck } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import { createDocument, createPersonalDoc } from "../schema.js";
import { newId } from "../utils/id.js";
import { STORAGE_DOMAINS, VISIBILITY_BY_DOC_TYPE, DOCUMENT_TYPE } from "../constants.js";
import { personalDocsAllowed } from "../utils/files.js";
import { Field, Select, DateInput } from "./ui/Field.jsx";
import Button from "./ui/Button.jsx";
import { Notice } from "./ui/Card.jsx";
import FileInput from "./FileInput.jsx";

// ============================================================================
// DocumentUpload — העלאת מסמך רכב או מסמך אישי.
//
// שתי החלטות שנאכפות כאן ולא רק מוסברות:
//
// 1. **הנראות נגזרת מסוג המסמך, במודע** (VISIBILITY_BY_DOC_TYPE): רישיון
//    רכב וביטוח חובה → `shared`, כי נהג שנעצר חייב אותם. פוליסה וקבלות →
//    `owner`, לתמיד. וזה נאמר למשתמש בשורה קטנה, לא נגזר בשקט — כי
//    המסמכים האלה נושאים ת.ז. (N3).
//
// 2. **מסמכים אישיים חסומים במצב fallback מקומי.** במצב מקומי הקובץ נשמר
//    base64 ב-localStorage, ורישיון נהיגה שם הוא תעודת זהות בטקסט גלוי על
//    הדיסק. תמונת רכב — בסדר גמור. ההודעה היא של שירה, לא שגיאה טכנית.
// ============================================================================

export function DocumentUpload({ vehicles, householdId, uid, driverId, isLocal, onSave, mode = "vehicle" }) {
  const { t } = useI18n();
  const personal = mode === "personal";
  const [vehicleId, setVehicleId] = useState(vehicles?.[0]?.id || "");
  const [type, setType] = useState(personal ? "drivingLicence" : "vehicleLicence");
  const [validUntil, setValidUntil] = useState("");
  const [file, setFile] = useState(null);
  const [docId] = useState(() => newId(personal ? "pdoc" : "doc"));

  const blocked = personal && !personalDocsAllowed({ local: isLocal });
  const visibility = personal ? "personal" : VISIBILITY_BY_DOC_TYPE[type] || "owner";
  const domain = personal
    ? STORAGE_DOMAINS.personal
    : visibility === "shared"
      ? STORAGE_DOMAINS.shared
      : STORAGE_DOMAINS.owner;

  if (blocked) {
    return (
      <Notice tone="warn" icon={<ShieldCheck size={24} />} title={t("error.localMode.docs")}>
        <p>{t("auth.localMode.note")}</p>
      </Notice>
    );
  }

  const save = () => {
    if (!file) return;
    const entity = personal
      ? createPersonalDoc({
          id: docId,
          householdId,
          driverId,
          driverUid: uid,
          type: "drivingLicence",
          validUntil,
          fileRef: file.fileRef,
          fileName: file.fileName,
          storageMode: file.storageMode,
          metadataStripped: file.metadataStripped,
        })
      : createDocument({
          id: docId,
          householdId,
          vehicleId,
          type,
          validUntil,
          fileRef: file.fileRef,
          localData: file.localData,
          fileName: file.fileName,
          storageMode: file.storageMode,
          metadataStripped: file.metadataStripped,
        });
    onSave(entity);
  };

  return (
    <div className="space-y-4">
      {!personal && (
        <>
          <Field label={t("doc.field.vehicle")}>
            {({ id, ...aria }) => (
              <Select id={id} {...aria} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                {(vehicles || []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nickname || [v.manufacturer, v.commercialName].filter(Boolean).join(" ") || v.plate}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t("doc.type.select")}>
            {({ id, ...aria }) => (
              <Select id={id} {...aria} value={type} onChange={(e) => setType(e.target.value)}>
                {DOCUMENT_TYPE.map((d) => (
                  <option key={d} value={d}>
                    {t(`doc.type.${d}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </>
      )}

      <Field label={t("doc.field.validUntil")} hint={t("common.optional")}>
        {({ id, ...aria }) => (
          <DateInput id={id} {...aria} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        )}
      </Field>

      {/* ★ הנראות נאמרת, לא נגזרת בשקט. */}
      <p className="max-w-prose text-base text-ink-muted">{t(`doc.visibility.${visibility}`)}</p>

      <FileInput
        label={t("doc.upload.camera")}
        icon={<Camera size={24} aria-hidden="true" />}
        domain={domain}
        hid={householdId}
        vehicleId={personal ? null : vehicleId}
        driverId={personal ? driverId : null}
        docId={docId}
        local={isLocal}
        onPicked={setFile}
      />

      {file && <p className="text-base text-ok-700">{file.fileName}</p>}

      <Button variant="primary" onClick={save} disabled={!file}>
        {t("common.save")}
      </Button>
    </div>
  );
}

export default DocumentUpload;
