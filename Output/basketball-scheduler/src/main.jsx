import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, useParams, Navigate } from "react-router-dom";
import App from "./App.jsx";
import PortalApp from "./portal/PortalApp.jsx";
import NewClubPage from "./admin/NewClubPage.jsx";
import { DEFAULT_CLUB_ID } from "./firebase";
import { isValidClubSlug, clubPath } from "./utils/clubId";
import "./index.css";

// One deployment, many clubs. The club is taken from the path at runtime:
//   /          → the build's default club (keeps every existing link working)
//   /c/<slug>  → that club
// firebase.json already rewrites all paths to index.html, so deep links work.

function ClubRoute() {
  const { clubSlug } = useParams();
  if (!isValidClubSlug(clubSlug)) return <InvalidClub slug={clubSlug} />;
  // Club ids are lowercase. A link that arrives with different casing is accepted but
  // redirected to the canonical URL, so a club has exactly one address rather than
  // several that all resolve to the same document.
  const canonical = clubSlug.toLowerCase();
  if (clubSlug !== canonical) return <Navigate to={clubPath(canonical)} replace />;
  return <App clubId={canonical} />;
}

function PortalRoute() {
  const { clubSlug } = useParams();
  if (!isValidClubSlug(clubSlug)) return <InvalidClub slug={clubSlug} />;
  const canonical = clubSlug.toLowerCase();
  if (clubSlug !== canonical) return <Navigate to={`${clubPath(canonical)}/portal`} replace />;
  return <PortalApp />;
}

function InvalidClub({ slug }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4" dir="rtl">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8 max-w-sm w-full text-center space-y-3">
        <h1 className="text-lg font-bold text-stone-900">כתובת מועדון לא תקינה</h1>
        <p className="text-sm text-stone-600">
          הכתובת <span dir="ltr" className="font-mono text-xs bg-stone-100 px-1 py-0.5 rounded">/c/{String(slug || "")}</span> אינה
          מזהה מועדון חוקי. בדוק את הקישור שקיבלת.
        </p>
      </div>
    </div>
  );
}

// Registered only in a real build: during development a service worker intercepting
// requests just fights with Vite's dev server and hides changes.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability is a nicety; the app works fine without it.
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App clubId={DEFAULT_CLUB_ID} />} />
        {/* Service operator, not any one club, so it sits outside /c/:clubSlug rather
            than under some club's path. Unlisted rather than secret: the real gate is
            config/global in the rules, which only an operator may read. */}
        <Route path="/admin/new-club" element={<NewClubPage />} />
        <Route path="/c/:clubSlug" element={<ClubRoute />} />
        {/* Parent / player portal — reads only the published weekly projection. */}
        <Route path="/c/:clubSlug/portal" element={<PortalRoute />} />
        <Route path="/portal" element={<Navigate to={`/c/${DEFAULT_CLUB_ID}/portal`} replace />} />
        {/* Anything else lands on the default club rather than a dead end. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
