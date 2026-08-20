/** גישה למצב האימות. זורק אם נעשה בו שימוש מחוץ ל-AuthProvider — טעות תכנות, לא מצב ריצה. */

import { useContext } from 'react';
import { AuthContext } from '../features/auth/authContext';
import type { AuthContextValue } from '../features/auth/authContext';

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth נקרא מחוץ ל-AuthProvider');
  }
  return context;
}
