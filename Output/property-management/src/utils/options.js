// עוזר: ממיר מערך enum לרשימת אפשרויות ל-<Select>, עם תוויות מתורגמות.
// group = הקבוצה ב-i18n (למשל "propertyType") → מפתח enum.<group>.<value>.
export function enumOptions(values, group, t) {
  return values.map((v) => ({ value: v, label: t(`enum.${group}.${v}`) }));
}
