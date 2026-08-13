import { Suspense, lazy } from "react";
import { useRoute } from "./hooks/useRoute.js";
import { useAuth } from "./hooks/useAuth.js";
import { useShop } from "./hooks/useShop.js";
import { useI18n } from "./hooks/useI18n.jsx";
import AppShell from "./components/AppShell.jsx";
import { Spinner, Notice, EmptyState } from "./components/ui/Bits.jsx";
import Button from "./components/ui/Button.jsx";
import { href } from "./utils/routes.js";

import HomePage from "./pages/HomePage.jsx";
import CatalogPage from "./pages/CatalogPage.jsx";
import ModelPage from "./pages/ModelPage.jsx";
import DiamondsPage from "./pages/DiamondsPage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import ContactPage from "./pages/ContactPage.jsx";
import LegalPage from "./pages/LegalPage.jsx";

// מסך הניהול נטען רק כשנכנסים אליו — הוא לא צריך להיות ב-bundle של מבקר
// שמגיע מאינסטגרם לדף דגם.
const AdminPage = lazy(() => import("./pages/AdminPage.jsx"));

export default function App() {
  const { t } = useI18n();
  const { route, navigate } = useRoute();
  // ⚠️ useAuth רץ תמיד, אבל **שום מסך ציבורי אינו מציג כפתור התחברות**.
  // אין הרשמה ואין חשבונות לקוח — זה קו אדום באפיון.
  const auth = useAuth();
  const shop = useShop(auth.user);

  const ctx = { ...shop, route, navigate, auth };

  if (shop.loading) {
    return (
      <AppShell settings={shop.settings} route={route}>
        <Spinner label={t("catalog.loading")} />
      </AppShell>
    );
  }

  return (
    <AppShell settings={shop.settings} route={route}>
      {shop.error ? (
        <div className="container-page pt-4">
          <Notice tone="danger">{t(shop.error)}</Notice>
        </div>
      ) : null}
      {renderRoute(route, ctx, t)}
    </AppShell>
  );
}

function renderRoute(route, ctx, t) {
  switch (route.name) {
    case "home":
      return <HomePage {...ctx} />;
    case "catalog":
      return <CatalogPage {...ctx} />;
    case "model":
      return <ModelPage {...ctx} modelId={route.params.id} />;
    case "diamonds":
      return <DiamondsPage {...ctx} />;
    case "about":
      return <AboutPage {...ctx} />;
    case "contact":
      return <ContactPage {...ctx} />;
    case "privacy":
      return <LegalPage {...ctx} doc="privacy" />;
    case "accessibility":
      return <LegalPage {...ctx} doc="accessibility" />;
    case "admin":
      return (
        <Suspense fallback={<Spinner />}>
          <AdminPage {...ctx} tab={route.params.tab} />
        </Suspense>
      );
    default:
      return (
        <div className="container-page py-16">
          <EmptyState
            title={t("errors.notFoundTitle")}
            body={t("errors.notFoundBody")}
            action={
              <Button as="a" href={href.home()}>
                {t("errors.goHome")}
              </Button>
            }
          />
        </div>
      );
  }
}
