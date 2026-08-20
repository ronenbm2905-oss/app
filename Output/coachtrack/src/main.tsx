import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { FatalScreen } from './components/FatalScreen';

/**
 * נקודת הכניסה.
 *
 * הטעינה של עץ האפליקציה היא **דינמית** בכוונה: `lib/firebase.ts` זורק בזמן
 * טעינת המודול כשחסרים משתני סביבה, ושגיאה כזו בייבוא סטטי הייתה מסתיימת
 * במסך לבן ובשגיאה בקונסולה בלבד. כייבוא דינמי היא מגיעה כדחיית Promise,
 * ואפשר להציג במקומה מסך בעברית שאומר מה קרה.
 *
 * (זה בדיוק המצב שנוצר כשבונים בלי .env.local — הקונפיג נצרב ל-build,
 *  ולכן build אחד שגוי נראה כמו אובדן נתונים.)
 */

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('לא נמצא אלמנט #root ב-index.html');

const root = createRoot(rootElement);

import('./AppProviders')
  .then(({ AppProviders }) => {
    root.render(
      <StrictMode>
        <AppProviders />
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    console.error('[CoachTrack] טעינת האפליקציה נכשלה', error);
    const detail = error instanceof Error ? error.message : String(error);
    root.render(<FatalScreen detail={detail} />);
  });
