import { useState } from "react";
import { Trash2, Search, AlertTriangle } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import Button from "../components/ui/Button.jsx";
import { Field, TextInput, TextArea, SelectInput, Checkbox } from "../components/ui/Field.jsx";
import { Badge, Chip, EmptyState, Notice, SectionTitle, Spinner } from "../components/ui/Bits.jsx";
import { href } from "../utils/routes.js";
import { formatAgorot, toAgorot, toShekels, normalizeToVatInclusive } from "../utils/money.js";
import { formatDate, formatCarat } from "../utils/format.js";
import { validateListing, validateModel, validateDiamond, hasErrors, originLabel } from "../utils/validate.js";
import { contactFor, contentFor } from "../utils/defaults.js";
import { DEMO_WHATSAPP } from "../utils/seed.js";
import { brandIsPlaceholder } from "../brand.js";
import {
  EMPTY_MODEL,
  EMPTY_DIAMOND,
  CATEGORIES,
  SUBCATEGORIES,
  SHAPES,
  COLORS,
  CLARITIES,
  CUTS,
  ORIGINS,
  TREATMENTS,
  CERT_LABS,
  METAL_COLORS,
  METAL_KARATS,
  STATUSES,
  LEAD_STATUSES,
} from "../constants.js";

const TABS = ["models", "diamonds", "leads", "settings"];

export default function AdminPage(props) {
  const { t } = useI18n();
  const { auth, isLocal, tab } = props;
  const active = TABS.includes(tab) ? tab : "models";

  if (auth.authLoading) return <Spinner />;

  // 🔴 אין הרשמה. זה המסך היחיד עם כניסה, והוא לצוות בלבד.
  if (!isLocal && !auth.user) {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-md panel p-6 text-center">
          <h1 className="text-2xl font-semibold">{t("admin.signIn")}</h1>
          <p className="mt-2 text-muted">{t("admin.signInHint")}</p>
          <Button className="mt-5 w-full" size="lg" onClick={auth.signIn}>
            {t("admin.signInGoogle")}
          </Button>
          {auth.authError ? (
            <Notice tone="danger" className="mt-4">
              {t(auth.authError)}
            </Notice>
          ) : null}
        </div>
      </div>
    );
  }

  if (!isLocal && auth.isAdmin === false) {
    return (
      <div className="container-page py-16">
        <EmptyState
          title={t("admin.noAccess")}
          body={t("admin.noAccessHint")}
          action={<Button onClick={auth.signOut}>{t("admin.signOut")}</Button>}
        />
      </div>
    );
  }

  if (!isLocal && auth.isAdmin == null) return <Spinner />;

  return (
    <div className="container-page py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <SectionTitle className="mb-0">{t("admin.title")}</SectionTitle>
        {isLocal ? null : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted">{t("admin.signedInAs", { email: auth.user?.email })}</span>
            <Button variant="secondary" size="sm" onClick={auth.signOut}>
              {t("admin.signOut")}
            </Button>
          </div>
        )}
      </div>

      {isLocal ? (
        <Notice tone="warn" className="mb-4">
          {t("admin.localMode")}
        </Notice>
      ) : null}

      <nav className="mb-6 flex flex-wrap gap-2" aria-label={t("admin.title")}>
        {TABS.map((tb) => (
          <a key={tb} href={href.admin(tb)}>
            <Chip selected={active === tb}>{t(`admin.tab${tb[0].toUpperCase()}${tb.slice(1)}`)}</Chip>
          </a>
        ))}
      </nav>

      {active === "models" ? <ModelsTab {...props} /> : null}
      {active === "diamonds" ? <DiamondsTab {...props} /> : null}
      {active === "leads" ? <LeadsTab {...props} /> : null}
      {active === "settings" ? <SettingsTab {...props} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// שער הפרסום — מוצג בכל מקום שבו פריט יכול להיות "available".
// זה ה-UI של `validateListing`: האדמין רואה **למה** אי אפשר לפרסם.
// ---------------------------------------------------------------------------
function PublishGate({ item }) {
  const { t } = useI18n();
  const errors = validateListing(item);
  if (errors.length === 0) return null;
  return (
    <Notice tone="danger" className="mt-3">
      <p className="flex items-center gap-2 font-semibold">
        <AlertTriangle size={16} aria-hidden="true" />
        {t("validate.title")}
      </p>
      <p className="mt-1">{t("validate.intro")}</p>
      <ul className="mt-2 list-disc space-y-1 ps-5">
        {errors.map((e, i) => (
          <li key={i}>{t(`validate.${e.code.split(".").pop()}`, { terms: (e.terms || []).join(", ") })}</li>
        ))}
      </ul>
    </Notice>
  );
}

function StatusBadge({ status }) {
  const { t } = useI18n();
  const tone = status === "available" ? "success" : status === "sold" ? "neutral" : "warn";
  return <Badge tone={tone}>{t(`taxonomy.status.${status}`)}</Badge>;
}

// ---------------------------------------------------------------------------
// דגמים
// ---------------------------------------------------------------------------
function ModelsTab({ allModels, saveModel, deleteModel }) {
  const { t, lang } = useI18n();
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState("");

  const list = allModels.filter(
    (m) =>
      !q ||
      String(m.sku).toLowerCase().includes(q.toLowerCase()) ||
      String(m.title_he).includes(q)
  );

  if (editing) {
    return (
      <ModelEditor
        model={editing}
        allModels={allModels}
        onCancel={() => setEditing(null)}
        onSave={async (m) => {
          await saveModel(m);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button onClick={() => setEditing({ ...EMPTY_MODEL })}>{t("admin.newModel")}</Button>
        <div className="ms-auto w-full sm:w-64">
          <label className="sr-only" htmlFor="m-search">
            {t("admin.searchModels")}
          </label>
          <TextInput
            id="m-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("admin.searchModels")}
          />
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState title={t("admin.noModels")} />
      ) : (
        <ul className="space-y-3">
          {list.map((m) => (
            <li key={m.id} className="panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    <span className="num">{m.sku}</span> — {m.title_he}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {t(`taxonomy.category.${m.category}`)} ·{" "}
                    <span className="num">{formatAgorot(m.basePriceAgorot, lang)}</span>
                  </p>
                  <div className="mt-2">
                    <StatusBadge status={m.status} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setEditing(m)}>
                    {t("common.edit")}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      if (window.confirm(t("admin.deleteModelConfirm", { sku: m.sku }))) deleteModel(m.id);
                    }}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <PublishGate item={m} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ModelEditor({ model, allModels, onSave, onCancel }) {
  const { t } = useI18n();
  const [v, setV] = useState({ ...model });
  const [errors, setErrors] = useState({});
  const set = (patch) => setV((p) => ({ ...p, ...patch }));

  const toggleIn = (key, value) => {
    const list = v[key] || [];
    set({ [key]: list.includes(value) ? list.filter((x) => x !== value) : [...list, value] });
  };

  function submit(e) {
    e.preventDefault();
    const errs = validateModel(v, allModels);
    setErrors(errs);
    if (hasErrors(errs)) return;
    onSave(v);
  }

  return (
    <form onSubmit={submit} className="panel p-5">
      <h2 className="mb-4 text-xl font-semibold">{v.id ? t("admin.editModel") : t("admin.newModel")}</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("admin.mSku")} required error={errors.sku ? t(errors.sku) : null}>
          {(p) => <TextInput {...p} value={v.sku} onChange={(e) => set({ sku: e.target.value })} dir="ltr" />}
        </Field>

        <Field label={t("admin.mStatus")}>
          {(p) => (
            <SelectInput {...p} value={v.status} onChange={(e) => set({ status: e.target.value })}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`taxonomy.status.${s}`)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>

        <Field label={t("admin.mCategory")}>
          {(p) => (
            <SelectInput
              {...p}
              value={v.category}
              onChange={(e) => set({ category: e.target.value, subcategory: SUBCATEGORIES[e.target.value]?.[0] })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`taxonomy.category.${c}`)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>

        <Field label={t("admin.mSubcategory")}>
          {(p) => (
            <SelectInput {...p} value={v.subcategory || ""} onChange={(e) => set({ subcategory: e.target.value })}>
              {(SUBCATEGORIES[v.category] || []).map((s) => (
                <option key={s} value={s}>
                  {t(`taxonomy.subcategory.${s}`)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>

        <Field label={t("admin.mTitleHe")} required error={errors.title_he ? t(errors.title_he) : null}>
          {(p) => <TextInput {...p} value={v.title_he} onChange={(e) => set({ title_he: e.target.value })} />}
        </Field>
        <Field label={t("admin.mTitleEn")}>
          {(p) => <TextInput {...p} value={v.title_en} onChange={(e) => set({ title_en: e.target.value })} dir="ltr" />}
        </Field>

        <Field label={t("admin.mDescHe")} className="sm:col-span-2">
          {(p) => <TextArea {...p} value={v.description_he} onChange={(e) => set({ description_he: e.target.value })} />}
        </Field>

        {/* A5.1/A5.2 — קלט בשקלים, שאלה מפורשת על מע"מ, שמירה באגורות כולל מע"מ. */}
        <Field
          label={t("admin.mBasePrice")}
          hint={t("admin.mBasePriceHint")}
          required
          error={errors.basePriceAgorot ? t(errors.basePriceAgorot) : null}
        >
          {(p) => (
            <TextInput
              {...p}
              type="number"
              min="0"
              step="1"
              dir="ltr"
              value={v.basePriceAgorot == null ? "" : toShekels(v.basePriceAgorot)}
              onChange={(e) =>
                set({
                  basePriceAgorot:
                    e.target.value === ""
                      ? null
                      : normalizeToVatInclusive(toAgorot(e.target.value), !v.priceInputWasExVat),
                  priceUpdatedAt: new Date().toISOString(),
                  vatIncluded: true,
                })
              }
            />
          )}
        </Field>

        <div className="self-end">
          <Checkbox
            label={t("admin.mPriceExVat")}
            checked={v.priceInputWasExVat}
            onChange={(e) => set({ priceInputWasExVat: e.target.checked })}
          />
        </div>

        <Field
          label={t("admin.mPriceIncludes")}
          required
          error={errors.priceIncludes_he ? t(errors.priceIncludes_he) : null}
          className="sm:col-span-2"
        >
          {(p) => (
            <TextArea {...p} value={v.priceIncludes_he} onChange={(e) => set({ priceIncludes_he: e.target.value })} />
          )}
        </Field>

        <Field label={t("admin.mStoneCount")} hint={t("admin.mStoneCountHint")}>
          {(p) => (
            <TextInput
              {...p}
              type="number"
              min="1"
              step="1"
              dir="ltr"
              value={v.stoneCount ?? 1}
              onChange={(e) => set({ stoneCount: Number(e.target.value) || 1 })}
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("admin.mCaratMin")} error={errors.caratRange ? t(errors.caratRange) : null}>
            {(p) => (
              <TextInput
                {...p}
                type="number"
                step="0.01"
                min="0"
                dir="ltr"
                value={v.caratRange?.min ?? ""}
                onChange={(e) => set({ caratRange: { ...v.caratRange, min: Number(e.target.value) } })}
              />
            )}
          </Field>
          <Field label={t("admin.mCaratMax")}>
            {(p) => (
              <TextInput
                {...p}
                type="number"
                step="0.01"
                min="0"
                dir="ltr"
                value={v.caratRange?.max ?? ""}
                onChange={(e) => set({ caratRange: { ...v.caratRange, max: Number(e.target.value) } })}
              />
            )}
          </Field>
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="label">{t("admin.mCompatibleShapes")}</legend>
        <p className="mb-2 text-sm text-muted">{t("admin.mCompatibleShapesHint")}</p>
        <div className="flex flex-wrap gap-2">
          {SHAPES.map((s) => (
            <Chip
              key={s}
              selected={(v.compatibleShapes || []).includes(s)}
              onClick={() => toggleIn("compatibleShapes", s)}
            >
              {t(`taxonomy.shape.${s}`)}
            </Chip>
          ))}
        </div>
        {errors.compatibleShapes ? (
          <p className="mt-1 text-sm text-danger">{t(errors.compatibleShapes)}</p>
        ) : null}
      </fieldset>

      <fieldset className="mt-5">
        <legend className="label">{t("admin.mMetalOptions")}</legend>
        <div className="flex flex-wrap gap-2">
          {METAL_COLORS.map((m) => (
            <Chip key={m} selected={(v.metalOptions || []).includes(m)} onClick={() => toggleIn("metalOptions", m)}>
              {t(`taxonomy.metalColor.${m}`)}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="label">{t("admin.mKaratOptions")}</legend>
        <div className="flex flex-wrap gap-2">
          {METAL_KARATS.map((k) => (
            <Chip key={k} selected={(v.karatOptions || []).includes(k)} onClick={() => toggleIn("karatOptions", k)}>
              {t(`taxonomy.metalKarat.${k}`)}
            </Chip>
          ))}
        </div>
      </fieldset>

      <div className="mt-5">
        <Checkbox
          label={t("admin.mFeatured")}
          checked={Boolean(v.featured)}
          onChange={(e) => set({ featured: e.target.checked })}
        />
      </div>

      <PublishGate item={v} />

      <div className="mt-6 flex gap-2">
        <Button type="submit">{t("common.save")}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// אבנים
// ---------------------------------------------------------------------------
function DiamondsTab({ allDiamonds, saveDiamond, deleteDiamond }) {
  const { t, lang } = useI18n();
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState("");

  const list = allDiamonds.filter(
    (d) =>
      !q ||
      String(d.stoneId).toLowerCase().includes(q.toLowerCase()) ||
      String(d.certNumber).toLowerCase().includes(q.toLowerCase())
  );

  if (editing) {
    return (
      <DiamondEditor
        diamond={editing}
        allDiamonds={allDiamonds}
        onCancel={() => setEditing(null)}
        onSave={async (d) => {
          await saveDiamond(d);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button onClick={() => setEditing({ ...EMPTY_DIAMOND })}>{t("admin.newDiamond")}</Button>
        <div className="ms-auto w-full sm:w-72">
          <label className="sr-only" htmlFor="d-search">
            {t("admin.searchDiamonds")}
          </label>
          <TextInput
            id="d-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("admin.searchDiamonds")}
          />
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState title={t("admin.noDiamonds")} />
      ) : (
        <ul className="space-y-3">
          {list.map((d) => (
            <li key={d.id} className="panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold num">{d.stoneId}</p>
                  <p className="mt-0.5">{originLabel(d.origin, lang)}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    <span className="num">{formatCarat(d.carat)}</span> ct ·{" "}
                    {d.shape ? t(`taxonomy.shape.${d.shape}`) : "—"} · <span className="num">{d.color}</span>/
                    <span className="num">{d.clarity}</span> ·{" "}
                    <span className="num">{formatAgorot(d.priceAgorot, lang)}</span>
                  </p>
                  <div className="mt-2">
                    <StatusBadge status={d.status} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setEditing(d)}>
                    {t("common.edit")}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      if (window.confirm(t("admin.deleteDiamondConfirm", { stoneId: d.stoneId })))
                        deleteDiamond(d.id);
                    }}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <PublishGate item={d} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function DiamondEditor({ diamond, allDiamonds, onSave, onCancel }) {
  const { t, lang } = useI18n();
  const [v, setV] = useState({ ...diamond });
  const [errors, setErrors] = useState({});
  const set = (patch) => setV((p) => ({ ...p, ...patch }));

  const toggleTreatment = (tr) => {
    const list = v.treatments || [];
    // "ללא טיפול" הוא בלעדי — אי אפשר "ללא טיפול + מילוי סדקים".
    if (tr === "none") return set({ treatments: list.includes("none") ? [] : ["none"] });
    const without = list.filter((x) => x !== "none");
    set({ treatments: without.includes(tr) ? without.filter((x) => x !== tr) : [...without, tr] });
  };

  const isTreated = (v.treatments || []).some((tr) => tr !== "none");

  function submit(e) {
    e.preventDefault();
    const errs = validateDiamond(v, allDiamonds);
    setErrors(errs);
    if (hasErrors(errs)) return;
    onSave(v);
  }

  return (
    <form onSubmit={submit} className="panel p-5">
      <h2 className="mb-4 text-xl font-semibold">{v.id ? t("admin.editDiamond") : t("admin.newDiamond")}</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("admin.dStoneId")} required error={errors.stoneId ? t(errors.stoneId) : null}>
          {(p) => <TextInput {...p} value={v.stoneId} onChange={(e) => set({ stoneId: e.target.value })} dir="ltr" />}
        </Field>

        <Field label={t("admin.dStatus")}>
          {(p) => (
            <SelectInput {...p} value={v.status} onChange={(e) => set({ status: e.target.value })}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`taxonomy.status.${s}`)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>

        <Field label={t("admin.dCarat")} required error={errors.carat ? t(errors.carat) : null}>
          {(p) => (
            <TextInput
              {...p}
              type="number"
              step="0.01"
              min="0"
              dir="ltr"
              value={v.carat ?? ""}
              onChange={(e) => set({ carat: e.target.value === "" ? null : Number(e.target.value) })}
            />
          )}
        </Field>

        <Field label={t("admin.dShape")}>
          {(p) => (
            <SelectInput {...p} value={v.shape || ""} onChange={(e) => set({ shape: e.target.value })}>
              <option value="">—</option>
              {SHAPES.map((s) => (
                <option key={s} value={s}>
                  {t(`taxonomy.shape.${s}`)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>

        <Field label={t("admin.dColor")}>
          {(p) => (
            <SelectInput {...p} value={v.color || ""} onChange={(e) => set({ color: e.target.value })}>
              <option value="">—</option>
              {COLORS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>

        <Field label={t("admin.dClarity")}>
          {(p) => (
            <SelectInput {...p} value={v.clarity || ""} onChange={(e) => set({ clarity: e.target.value })}>
              <option value="">—</option>
              {CLARITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>

        <Field label={t("admin.dCut")}>
          {(p) => (
            <SelectInput {...p} value={v.cut || ""} onChange={(e) => set({ cut: e.target.value })}>
              <option value="">—</option>
              {CUTS.map((c) => (
                <option key={c} value={c}>
                  {t(`taxonomy.cut.${c}`)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>

        {/* 🔴 A2 — origin ללא ברירת מחדל. אין ערך נבחר מראש בטופס. */}
        <Field label={t("admin.dOrigin")} required error={errors.origin ? t(errors.origin) : null}>
          {(p) => (
            <SelectInput {...p} value={v.origin || ""} onChange={(e) => set({ origin: e.target.value || null })}>
              <option value="">—</option>
              {ORIGINS.map((o) => (
                <option key={o} value={o}>
                  {originLabel(o, lang)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>

        <Field label={t("admin.dPrice")} required error={errors.priceAgorot ? t(errors.priceAgorot) : null}>
          {(p) => (
            <TextInput
              {...p}
              type="number"
              min="0"
              step="1"
              dir="ltr"
              value={v.priceAgorot == null ? "" : toShekels(v.priceAgorot)}
              onChange={(e) =>
                set({
                  priceAgorot:
                    e.target.value === ""
                      ? null
                      : normalizeToVatInclusive(toAgorot(e.target.value), !v.priceInputWasExVat),
                  priceUpdatedAt: new Date().toISOString(),
                  vatIncluded: true,
                })
              }
            />
          )}
        </Field>

        <div className="self-end">
          <Checkbox
            label={t("admin.mPriceExVat")}
            checked={v.priceInputWasExVat}
            onChange={(e) => set({ priceInputWasExVat: e.target.checked })}
          />
        </div>

        {/* 🔴 A4 — התעודה כיחידה אחת. שני השדות באותו בלוק, ושניהם חובה. */}
        <Field label={t("admin.dCertLab")}>
          {(p) => (
            <SelectInput {...p} value={v.certLab || ""} onChange={(e) => set({ certLab: e.target.value })}>
              {CERT_LABS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <Field label={t("admin.dCertNumber")} required error={errors.cert ? t(errors.cert) : null}>
          {(p) => (
            <TextInput {...p} value={v.certNumber} onChange={(e) => set({ certNumber: e.target.value })} dir="ltr" />
          )}
        </Field>
        <Field label={t("admin.dCertUrl")} required className="sm:col-span-2">
          {(p) => (
            <TextInput
              {...p}
              value={v.certFileUrl}
              onChange={(e) => set({ certFileUrl: e.target.value })}
              dir="ltr"
              placeholder="https://…"
            />
          )}
        </Field>
      </div>

      {/* 🔴 A3 — טיפולים. בחירה אקטיבית, כולל "ללא טיפול". */}
      <fieldset className="mt-5">
        <legend className="label">{t("diamond.treatments")}</legend>
        <div className="flex flex-wrap gap-2">
          {TREATMENTS.map((tr) => (
            <Chip key={tr} selected={(v.treatments || []).includes(tr)} onClick={() => toggleTreatment(tr)}>
              {t(`taxonomy.treatment.${tr}`)}
            </Chip>
          ))}
        </div>
        {errors.treatments ? <p className="mt-1 text-sm text-danger">{t(errors.treatments)}</p> : null}
      </fieldset>

      {isTreated ? (
        <Field label={t("admin.dTreatmentNote")} required className="mt-4">
          {(p) => (
            <TextArea
              {...p}
              value={v.treatmentNote_he}
              onChange={(e) => set({ treatmentNote_he: e.target.value })}
            />
          )}
        </Field>
      ) : null}

      <Notice className="mt-4">{t("admin.dImagesHint")}</Notice>

      <PublishGate item={v} />

      <div className="mt-6 flex gap-2">
        <Button type="submit">{t("common.save")}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// לידים — A7.7: חיפוש לפי טלפון + מחיקה אמיתית
// ---------------------------------------------------------------------------
function LeadsTab({ leads, leadsLoading, updateLead, deleteLead, findLeadsByPhone }) {
  const { t, lang } = useI18n();
  const [phoneQuery, setPhoneQuery] = useState("");

  const list = phoneQuery.trim() ? findLeadsByPhone(phoneQuery) : leads;

  if (leadsLoading) return <Spinner />;

  return (
    <>
      <Notice className="mb-4">{t("admin.leadsPrivate")}</Notice>

      {/* 🔴 A7.7 — למבקר אין חשבון, ולכן אין לו דרך עצמאית לעיין או למחוק.
          בלי החיפוש והמחיקה כאן אי אפשר לכבד בקשת מחיקה בכלל. */}
      <div className="panel mb-5 p-4">
        <Field label={t("admin.leadSearchByPhone")} hint={t("admin.leadSearchHint")}>
          {(p) => (
            <div className="flex gap-2">
              <TextInput
                {...p}
                value={phoneQuery}
                onChange={(e) => setPhoneQuery(e.target.value)}
                dir="ltr"
                inputMode="tel"
              />
              <Button variant="secondary" onClick={() => setPhoneQuery("")}>
                <Search size={16} aria-hidden="true" />
                {t("common.clear")}
              </Button>
            </div>
          )}
        </Field>
      </div>

      {list.length === 0 ? (
        <EmptyState title={t("admin.leadsNone")} />
      ) : (
        <ul className="space-y-3">
          {list.map((l) => (
            <li key={l.id} className="panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{l.name}</p>
                  <p className="num text-sm">
                    <a className="underline" href={`tel:${l.phone}`}>
                      {l.phone}
                    </a>
                  </p>
                  {l.email ? <p className="num text-sm text-muted">{l.email}</p> : null}
                  <p className="mt-1 text-sm text-muted">
                    {t(`taxonomy.leadSource.${l.source}`)} · {formatDate(l.createdAt?.toDate?.() || l.createdAt, lang)}
                  </p>
                  {l.message ? <p className="mt-2 text-sm">{l.message}</p> : null}

                  {/* A7.2 — ההסכמות כראיה, עם הטקסט שהוצג בפועל. */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone={l.consent?.contact?.granted ? "success" : "danger"}>
                      {t("admin.leadConsentContact")}
                    </Badge>
                    <Badge tone={l.consent?.marketing?.granted ? "success" : "neutral"}>
                      {t("admin.leadConsentMarketing")}
                    </Badge>
                  </div>

                  {l.listingSnapshot ? (
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer font-medium">{t("admin.leadSnapshot")}</summary>
                      <dl className="mt-2 space-y-1 text-muted">
                        <div>
                          {l.listingSnapshot.modelSku} — {l.listingSnapshot.modelTitle}
                        </div>
                        {l.listingSnapshot.specLine ? <div>{l.listingSnapshot.specLine}</div> : null}
                        <div className="num">{formatAgorot(l.listingSnapshot.totalAgorot, lang)}</div>
                      </dl>
                    </details>
                  ) : null}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <SelectInput
                    aria-label={t("admin.leadStatus")}
                    value={l.status || "new"}
                    onChange={(e) => updateLead(l.id, { status: e.target.value })}
                    className="w-auto"
                  >
                    {LEAD_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t(`taxonomy.leadStatus.${s}`)}
                      </option>
                    ))}
                  </SelectInput>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      if (window.confirm(t("admin.leadDeleteConfirm", { name: l.name }))) deleteLead(l.id);
                    }}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    {t("admin.leadDeleteHard")}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// הגדרות ותוכן
// ---------------------------------------------------------------------------
function SettingsTab({ settings, saveSettingsPublic, resetDemoData, isLocal }) {
  const { t, lang } = useI18n();
  const [v, setV] = useState(() => JSON.parse(JSON.stringify(settings)));
  const [saved, setSaved] = useState(false);

  const contact = contactFor(v);
  const content = contentFor(v, lang);

  const setContact = (patch) => {
    setV((p) => ({ ...p, contact: { ...contactFor(p), ...patch } }));
    setSaved(false);
  };
  const setBrand = (patch) => {
    setV((p) => ({ ...p, brand: { ...(p.brand || {}), ...patch } }));
    setSaved(false);
  };
  const setContent = (patch) => {
    setV((p) => ({
      ...p,
      content: { ...(p.content || {}), [lang]: { ...((p.content || {})[lang] || content), ...patch } },
    }));
    setSaved(false);
  };

  async function submit(e) {
    e.preventDefault();
    await saveSettingsPublic(v);
    setSaved(true);
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-6">
      {contact.whatsapp === DEMO_WHATSAPP ? (
        <Notice tone="danger">{t("admin.demoWhatsappWarn")}</Notice>
      ) : null}
      {brandIsPlaceholder(v) ? <Notice tone="warn">{t("admin.brandPlaceholderWarn")}</Notice> : null}

      <section className="panel p-5">
        <h2 className="text-lg font-semibold">{t("admin.sBrand")}</h2>
        <p className="mt-1 text-sm text-muted">{t("admin.sBrandNote")}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={t("admin.sBrandNameHe")}>
            {(p) => (
              <TextInput {...p} value={v.brand?.nameHe ?? ""} onChange={(e) => setBrand({ nameHe: e.target.value })} />
            )}
          </Field>
          <Field label={t("admin.sBrandNameEn")}>
            {(p) => (
              <TextInput
                {...p}
                dir="ltr"
                value={v.brand?.nameEn ?? ""}
                onChange={(e) => setBrand({ nameEn: e.target.value })}
              />
            )}
          </Field>
          <Field label={t("admin.sBrandSuffixHe")}>
            {(p) => (
              <TextInput
                {...p}
                value={v.brand?.suffixHe ?? ""}
                onChange={(e) => setBrand({ suffixHe: e.target.value })}
              />
            )}
          </Field>
          <Field label={t("admin.sBrandSuffixEn")}>
            {(p) => (
              <TextInput
                {...p}
                dir="ltr"
                value={v.brand?.suffixEn ?? ""}
                onChange={(e) => setBrand({ suffixEn: e.target.value })}
              />
            )}
          </Field>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-semibold">{t("admin.sContact")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={t("admin.sWhatsapp")} hint={t("admin.sWhatsappHint")} className="sm:col-span-2">
            {(p) => (
              <TextInput
                {...p}
                dir="ltr"
                inputMode="tel"
                value={contact.whatsapp}
                onChange={(e) => setContact({ whatsapp: e.target.value })}
              />
            )}
          </Field>
          <Field label={t("admin.sEmail")}>
            {(p) => (
              <TextInput
                {...p}
                dir="ltr"
                type="email"
                value={contact.publicEmail}
                onChange={(e) => setContact({ publicEmail: e.target.value })}
              />
            )}
          </Field>
          <Field label={t("admin.sPhone")}>
            {(p) => (
              <TextInput {...p} dir="ltr" value={contact.phone} onChange={(e) => setContact({ phone: e.target.value })} />
            )}
          </Field>
          <Field label={t("admin.sInstagram")}>
            {(p) => (
              <TextInput
                {...p}
                dir="ltr"
                value={contact.instagram}
                onChange={(e) => setContact({ instagram: e.target.value })}
              />
            )}
          </Field>
          <Field label={t("admin.sFacebook")}>
            {(p) => (
              <TextInput
                {...p}
                dir="ltr"
                value={contact.facebook}
                onChange={(e) => setContact({ facebook: e.target.value })}
              />
            )}
          </Field>
          {/* U2 — נדרש במסמך הגילוי לפי תקנות 1995, ולכן נכנס להודעת הוואטסאפ. */}
          <Field label={t("admin.sLegalEntity")} className="sm:col-span-2">
            {(p) => (
              <TextInput
                {...p}
                value={contact.legalEntityName}
                onChange={(e) => setContact({ legalEntityName: e.target.value })}
              />
            )}
          </Field>
          <Field label={t("admin.sLegalEntityId")}>
            {(p) => (
              <TextInput
                {...p}
                dir="ltr"
                value={contact.legalEntityId}
                onChange={(e) => setContact({ legalEntityId: e.target.value })}
              />
            )}
          </Field>
          <Field label={t("admin.sLegalEntityAddress")}>
            {(p) => (
              <TextInput
                {...p}
                value={contact.legalEntityAddress}
                onChange={(e) => setContact({ legalEntityAddress: e.target.value })}
              />
            )}
          </Field>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-semibold">{t("admin.sLangSection", { lang: t(`admin.lang${lang === "he" ? "He" : "En"}`) })}</h2>
        <div className="mt-4 space-y-4">
          <Field label={t("admin.sHeroTitle")}>
            {(p) => (
              <TextInput {...p} value={content.heroTitle} onChange={(e) => setContent({ heroTitle: e.target.value })} />
            )}
          </Field>
          <Field label={t("admin.sHeroSubtitle")}>
            {(p) => (
              <TextArea
                {...p}
                value={content.heroSubtitle}
                onChange={(e) => setContent({ heroSubtitle: e.target.value })}
              />
            )}
          </Field>
          <Field label={t("admin.sStoryBody")}>
            {(p) => (
              <TextArea {...p} value={content.storyBody} onChange={(e) => setContent({ storyBody: e.target.value })} />
            )}
          </Field>
        </div>
      </section>

      {saved ? <Notice tone="success">{t("admin.settingsSaved")}</Notice> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit">{t("admin.saveSettings")}</Button>
        {isLocal ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (window.confirm(t("admin.resetDemoConfirm"))) resetDemoData();
            }}
          >
            {t("admin.resetDemo")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
