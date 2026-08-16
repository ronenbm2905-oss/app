import { useRef, useState } from "react";
import { useI18n } from "../hooks/useI18n.jsx";
import { useMotLookup } from "../hooks/useMotLookup.js";
import { createVehicle } from "../schema.js";
import { seedTasksForVehicle } from "../utils/seed.js";
import { normalizePlate, motSourceFrom } from "../utils/mot.js";
import { formatDate } from "../utils/format.js";
import PlateLookup from "./PlateLookup.jsx";
import VehicleForm from "./VehicleForm.jsx";
import Button from "./ui/Button.jsx";
import { Notice } from "./ui/Card.jsx";

// ============================================================================
// AddVehicleScreen — מסך אחד. למעלה הקיצור (מספר רישוי → משיכה), ומתחתיו
// **הטופס הידני, תמיד גלוי**.
//
// זו לא סטייה מהמפרט אלא הקריאה הנכונה שלו: הטופס הידני הוא המסלול הראשי,
// והמשיכה היא קיצור שממלא אותו. משתמש בלי רשת גולל למטה, ממלא, ושומר —
// בלי לגלות בכלל שיש מסלול אחר.
//
// ★ ובשמירה: `seedTasksForVehicle` הופכת את `tokef_dt` למשימת טסט אמיתית.
// זה הרגע שבו המוצר מתחיל לעבוד בשביל המשתמש.
// ============================================================================

const EMPTY_FORM = {
  plate: "",
  nickname: "",
  manufacturer: "",
  commercialName: "",
  year: "",
  color: "",
  fuelType: "",
  testValidUntil: "",
  lastTestDate: "",
  compulsoryInsuranceUntil: "",
  comprehensiveInsuranceUntil: "",
  insurerName: "",
  policyNumber: "",
  insurerEmergencyPhone: "",
  garageName: "",
  garagePhone: "",
  lastServiceDate: "",
  currentKm: "",
  photoData: null,
  photoRef: null,
  photoName: "",
  photoStorageMode: "none",
};

export function AddVehicleScreen({ data, actions, householdId, today, isLocal, navigate }) {
  const { t, lang } = useI18n();
  const [plate, setPlate] = useState("");
  const [values, setValues] = useState(EMPTY_FORM);
  const [saved, setSaved] = useState(null);
  const motRef = useRef(null);
  const formRef = useRef(null);
  const { state, result, slow, lookup } = useMotLookup();

  const set = (key, value) => setValues((prev) => ({ ...prev, [key]: value }));

  const acceptMot = (v) => {
    motRef.current = motSourceFrom(result);
    setValues((prev) => ({
      ...prev,
      plate: v.plate || prev.plate,
      manufacturer: v.manufacturer || prev.manufacturer,
      commercialName: v.commercialName || v.model || prev.commercialName,
      year: v.year ?? prev.year,
      color: v.color || prev.color,
      fuelType: v.fuelType || prev.fuelType,
      // ★ התאריך שיזרע את משימת הטסט.
      testValidUntil: v.testValidUntil || prev.testValidUntil,
      lastTestDate: v.lastTestDate || prev.lastTestDate,
    }));
    scrollToForm();
  };

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const save = () => {
    const vehicle = createVehicle({
      householdId,
      ...values,
      plate: normalizePlate(values.plate || plate),
      garage: { name: values.garageName, phone: values.garagePhone },
      motSource: motRef.current || undefined,
    });
    const newTasks = seedTasksForVehicle(vehicle, data.tasks || [], {
      today,
      leadDays: data.settings?.leadDays,
      readings: data.odometerReadings || [],
    });

    // ★ **כתיבה אחת.** הרכב והמשימות שנזרעו ממנו נשמרים יחד.
    // קודם זה היה `saveVehicle()` ואז לולאת `saveTask()` — שתי קריאות
    // באותו tick, ששתיהן ראו את אותו מצב-קדם. התוצאה: הרכב נעלם, נשארה
    // משימת טסט יתומה, והמסך הודיע "נשמר". איבוד נתונים שקט.
    actions.saveVehicleWithTasks(vehicle, newTasks);

    const testTask = newTasks.find((x) => x.type === "test");
    setSaved({ vehicleId: vehicle.id, testDate: testTask?.dueDate || null });
  };

  if (saved) {
    return (
      <section className="space-y-4">
        <Notice tone="ok" title={saved.testDate ? t("vehicle.saved.withTask", { date: formatDate(saved.testDate, lang) }) : t("vehicle.saved.toast")}>
          {saved.testDate && <p>{t("task.next.remindLead")}</p>}
        </Notice>
        <Button variant="primary" onClick={() => navigate(`/vehicle/${saved.vehicleId}`)}>
          {t("dashboard.hero.cta.open")}
        </Button>
        <Button variant="secondary" size="md" onClick={() => navigate("/")}>
          {t("error.load.cta.home")}
        </Button>
      </section>
    );
  }

  return (
    <>
      <PlateLookup
        plate={plate}
        setPlate={(p) => {
          setPlate(p);
          set("plate", p);
        }}
        lookup={lookup}
        state={state}
        result={result}
        slow={slow}
        onAccept={acceptMot}
        onManual={scrollToForm}
      />

      {/* ★ תמיד גלוי. לא accordion, לא "מסלול חלופי". */}
      <section ref={formRef} className="space-y-4 border-t border-line-soft pt-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-ink-strong">{t("vehicle.manual.title")}</h2>
          <p className="max-w-prose text-lg text-ink-muted">{t("vehicle.manual.sub")}</p>
        </div>
        <VehicleForm values={values} set={set} local={isLocal} />
        <p className="max-w-prose text-sm text-ink-soft">{t("legal.disclaimer.mot")}</p>
        <Button variant="primary" onClick={save}>
          {t("vehicle.save")}
        </Button>
      </section>
    </>
  );
}

export default AddVehicleScreen;
