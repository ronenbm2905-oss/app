/**
 * כל הספקים של האפליקציה במקום אחד.
 *
 * הסדר חשוב: `AuthProvider` יושב **בתוך** ה-Router, כדי שמסכים שמוצגים לפי מצב
 * האימות יוכלו להשתמש בניווט; ו-React Query עוטף הכל כי בשלב 3 ימשכו דרכו
 * נתוני תוכניות ודיווחים (ב-שלב 1 אין עדיין אף query — האימות עובד ב-onSnapshot).
 *
 * הקובץ נטען דינמית מ-`main.tsx`, ולכן כשל בקונפיג של Firebase מגיע כדחיית
 * Promise שאפשר להציג כמסך, במקום מסך לבן עם שגיאה בקונסולה בלבד.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './features/auth/AuthProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
