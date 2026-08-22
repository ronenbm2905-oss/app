import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { masShevachConfig } from '@shared/config/mas-shevach';
import { QuestionnaireEngine } from '@/components/questionnaire/QuestionnaireEngine';
import { loadPixels } from '@/lib/loadPixels';
import './index.css';

loadPixels();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QuestionnaireEngine config={masShevachConfig} />
  </StrictMode>
);
