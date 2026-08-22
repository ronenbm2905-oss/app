import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { masHachnasaConfig } from '@shared/config/mas-hachnasa';
import { QuestionnaireEngine } from '@/components/questionnaire/QuestionnaireEngine';
import { loadPixels } from '@/lib/loadPixels';
import './index.css';

loadPixels();

/**
 * ⚠️ הקונפיג מיובא **ישירות**, לא דרך ה-registry ב-`config/index.ts`.
 * כך הדף הזה לא שולח לדפדפן גם את השאלון של דף מס שבח.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QuestionnaireEngine config={masHachnasaConfig} />
  </StrictMode>
);
