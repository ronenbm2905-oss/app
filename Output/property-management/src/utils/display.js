// עוזרי תצוגה לנכס ולישויות מקושרות.

// מחרוזת כתובת קריאה מהאובייקט המובנה.
export function addressLine(property) {
  const a = property?.address || {};
  const parts = [a.street, a.number].filter(Boolean).join(" ");
  const withApt = a.apartment ? `${parts}/${a.apartment}` : parts;
  const city = a.city ? `, ${a.city}` : "";
  return (withApt + city).trim() || "—";
}

// דייר פעיל של נכס (דרך חוזה פעיל).
export function activeLeaseFor(propertyId, leases) {
  return (leases || []).find(
    (l) => l.propertyId === propertyId && l.status === "active"
  );
}

export function tenantById(id, tenants) {
  return (tenants || []).find((t) => t.id === id) || null;
}
