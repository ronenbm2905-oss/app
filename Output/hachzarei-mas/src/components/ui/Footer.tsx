import { site } from '@shared/config/site';

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto w-full max-w-2xl space-y-4 px-5 py-10 text-sm text-muted">
        <div className="space-y-1">
          <p className="font-semibold text-ink">{site.officeName}</p>
          <p>{site.officeAddress}</p>
          <p>
            טלפון:{' '}
            <a href={`tel:${site.phone.replace(/-/g, '')}`} className="text-brand">
              {site.phone}
            </a>
          </p>
          {/* מספר הרישיון הוא דרישה רגולטורית לייצוג מול רשות המסים,
              וגם אלמנט האמון החזק בדף. ראה החלטה פתוחה 11.4 באפיון. */}
          <p>מספר רישיון: {site.licenseNumber}</p>
        </div>

        <nav aria-label="עמודי מידע" className="flex flex-wrap gap-x-5 gap-y-2">
          <a href="/takanon" className="underline underline-offset-4 hover:text-ink">
            תקנון ותנאי שימוש
          </a>
          <a href="/privacy" className="underline underline-offset-4 hover:text-ink">
            מדיניות פרטיות
          </a>
          <a href="/accessibility" className="underline underline-offset-4 hover:text-ink">
            הצהרת נגישות
          </a>
        </nav>

        <p className="pt-2 text-xs leading-relaxed">
          המידע באתר אינו מהווה ייעוץ מס ואינו תחליף לבדיקה פרטנית. זכאות להחזר ושיעורו נקבעים
          על פי נתוני התיק ובכפוף לדין.
        </p>
      </div>
    </footer>
  );
}
