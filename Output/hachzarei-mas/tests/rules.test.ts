import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

/**
 * כללי Firestore — הבדיקה שמגנה על ה-PII.
 *
 * הכלל היחיד כאן: **הלקוח לא נוגע בלידים.** לא קורא, לא כותב, לא מעודכן —
 * לא מחובר ולא אנונימי. כל כתיבה עוברת דרך Cloud Function שרצה ב-Admin SDK
 * ועוקפת את הכללים, ולכן אין ולא צריך להיות שום חוק "מותר ללקוח אם...".
 * חוק כזה היה מאפשר לכל מי שיש לו את מפתח ה-Web להזריק לידים ולעקוף
 * את חישוב הציון בשרת.
 *
 * דורש אמולטור פעיל:  npm run emulate
 * ואז בטרמינל אחר:     npm run test:rules
 */

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-hachzarei-mas-rules',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

const collections = ['leads', 'rateLimits', 'mail'] as const;

describe('firestore.rules — הלקוח נעול החוצה', () => {
  for (const name of collections) {
    it(`אנונימי לא קורא מסמך ב-${name}`, async () => {
      const db = env.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(db, name, 'any-id')));
    });

    it(`אנונימי לא מרשים את ${name}`, async () => {
      const db = env.unauthenticatedContext().firestore();
      await assertFails(getDocs(collection(db, name)));
    });

    it(`אנונימי לא כותב ל-${name}`, async () => {
      const db = env.unauthenticatedContext().firestore();
      await assertFails(setDoc(doc(db, name, 'injected'), { tier: 'A' }));
    });

    it(`משתמש מחובר לא קורא ולא כותב ב-${name}`, async () => {
      const db = env.authenticatedContext('some-user').firestore();
      await assertFails(getDoc(doc(db, name, 'any-id')));
      await assertFails(setDoc(doc(db, name, 'injected'), { tier: 'A' }));
    });
  }

  it('אין אוסף אחר שנשאר פתוח בטעות', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, 'anythingElse', 'x'), { a: 1 }));
    await assertFails(getDoc(doc(db, 'anythingElse', 'x')));
  });
});
