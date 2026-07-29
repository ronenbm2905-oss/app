import { GAMES, APP_TITLE, APP_SUBTITLE } from "../constants";

// מסך הבית — רשת של 8 מצבי המשחק
export default function Home({ onSelect, speechWarning }) {
  return (
    <div className="min-h-full pb-10">
      <div className="text-center pt-8 pb-6 px-4">
        <h1 className="text-5xl font-bold text-cardbackDark drop-shadow-sm">{APP_TITLE}</h1>
        <p className="mt-2 text-lg text-cardbackDark/70">{APP_SUBTITLE}</p>
      </div>

      {speechWarning && (
        <div className="mx-auto mb-4 max-w-xl px-4">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2 text-sm text-center">
            הערה: לא נמצא קול עברי במכשיר. ההקראה עשויה לא לפעול — הטקסט תמיד מוצג על המסך.
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 px-4 max-w-4xl mx-auto">
        {GAMES.map((g) => (
          <button
            key={g.id}
            onClick={() => onSelect(g.id)}
            className={`group flex flex-col items-center text-center gap-2 rounded-3xl border-2 p-5 shadow-sm
              transition hover:shadow-lg hover:-translate-y-1 active:scale-95 ${g.color}`}
          >
            <span className="text-5xl drop-shadow-sm group-hover:scale-110 transition">{g.emoji}</span>
            <span className="text-lg font-bold text-gray-800 leading-tight">{g.title}</span>
            <span className="text-sm text-gray-600 leading-tight">{g.desc}</span>
            <span className="mt-1 text-xs font-bold bg-white/70 rounded-full px-3 py-0.5 text-gray-700">
              גיל {g.age}
            </span>
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-gray-700 mt-10 px-4">
        מבוסס על ערכת הקלפים "הדרך למילים" מאת דורית בן מאיר · doritplus.co.il
      </p>
      <p className="text-center text-xs text-gray-700 mt-2 px-4">
        אפליקציה זו אינה אוספת מידע אישי, אינה משתמשת בעוגיות ואינה עוקבת אחרי המשתמש.
      </p>
    </div>
  );
}
