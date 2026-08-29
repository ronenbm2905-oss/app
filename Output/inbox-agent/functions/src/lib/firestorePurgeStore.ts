// ============================================================================
// firestorePurgeStore.ts — המימוש של `PurgeStore` מול Firestore.
//
// דק בכוונה, מאותה סיבה כמו `gmailFetch.ts`: כל מה שאפשר לבדוק בלי ענן יושב
// ב-`shared/lib/purgePolicy.ts` ורץ ב-`npm test`. כאן נשארו רק קריאות ה-SDK.
//
// ★ `FieldValue.delete()` ולא `null`, ולא `deleted: true`.
//   ההבדל אינו סגנוני: `recipient: null` משאיר מפתח במסמך ובאינדקסים, והוא
//   נראה בייצוא. `FieldValue.delete()` מסיר את השדה. הדרישה בסקירה (B9)
//   מנוסחת בדיוק כך — *"מחיקת שדות אמיתית (**לא** `deleted: true`)"*.
// ============================================================================

import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  COLLECTIONS,
  collectionPath,
  docPath,
  USERS,
  type CollectionName,
} from '../shared/lib/firestorePaths';
import type { PurgeStore, StoredDoc } from '../shared/lib/purgePolicy';

export class FirestorePurgeStore implements PurgeStore {
  constructor(private readonly db: Firestore) {}

  async listUsers(): Promise<string[]> {
    const snap = await this.db.collection(USERS).get();
    return snap.docs.map((d) => d.id);
  }

  async listAll(uid: string, collection: CollectionName): Promise<StoredDoc[]> {
    const snap = await this.db.collection(collectionPath(uid, collection)).get();
    return snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }));
  }

  /**
   * ★★ מחיקת פרטי הנמענת.
   *
   * `recipientPurged: true` נשאר — וזו לא סתירה למחיקה. השדה הזה הוא ההבדל
   * בין "נמחק לפי המדיניות" לבין "לא הצלחתי לקרוא את ההודעה": שני מצבים
   * שנראים על המסך זהה — רשומה בלי כתובת — ומשמעותם הפוכה לגמרי.
   */
  async purgeRecipient(uid: string, orderId: string, at: string): Promise<void> {
    await this.db.doc(docPath(uid, COLLECTIONS.orders, orderId)).update({
      recipient: FieldValue.delete(),
      recipientPurged: true,
      updatedAt: at,
    });
  }

  async deleteDoc(uid: string, collection: CollectionName, id: string): Promise<void> {
    await this.db.doc(docPath(uid, collection, id)).delete();
  }

  async stripFields(
    uid: string,
    collection: CollectionName,
    id: string,
    fields: readonly string[],
  ): Promise<void> {
    const patch: Record<string, unknown> = {};
    for (const f of fields) patch[f] = FieldValue.delete();
    await this.db.doc(docPath(uid, collection, id)).update(patch);
  }
}
