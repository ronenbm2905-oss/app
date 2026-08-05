// ============================================================================
// finance.js — פונקציות טהורות לחישוב תשואה ותזרים.
// תשואה = שדה מחושב (נגזר מהכנסות/הוצאות/מימון) — לעולם לא מוזן ידנית.
// ============================================================================

// סכום ההשקעה בבסיס התשואה: הון עצמי אם קיים, אחרת מחיר רכישה + עלויות נלוות.
export function investmentBase(property) {
  const f = property?.finance || {};
  if (f.equity && Number(f.equity) > 0) return Number(f.equity);
  const purchase = Number(f.purchasePrice) || 0;
  const ec = f.extraCosts || {};
  const extras =
    (Number(ec.purchaseTax) || 0) +
    (Number(ec.notary) || 0) +
    (Number(ec.registration) || 0) +
    (Number(ec.renovation) || 0) +
    (Number(ec.brokerage) || 0) +
    (Number(ec.legal) || 0);
  return purchase + extras;
}

// הכנסה שנתית לנכס: מסכם תנועות הכנסה ב-12 החודשים האחרונים;
// אם אין תנועות — נופל לשכ"ד החודשי מהחוזה הפעיל × 12.
export function annualIncome(property, transactions, leases) {
  const txns = incomeExpenseInLastYear(property.id, transactions);
  if (txns.income > 0) return txns.income;
  const activeLease = (leases || []).find(
    (l) => l.propertyId === property.id && l.status === "active" && l.monthlyRent
  );
  return activeLease ? Number(activeLease.monthlyRent) * 12 : 0;
}

// הוצאה שנתית לנכס: תנועות הוצאה ב-12 החודשים האחרונים + החזר מימון שנתי.
export function annualExpenses(property, transactions) {
  const txns = incomeExpenseInLastYear(property.id, transactions);
  const financing = Number(property?.finance?.financing?.monthlyPayment) || 0;
  // אם המימון כבר מופיע כתנועת הוצאה בקטגוריית financing — לא נכפיל.
  const hasFinancingTxn = (transactions || []).some(
    (t) => t.propertyId === property.id && t.type === "expense" && t.category === "financing"
  );
  const financingAnnual = hasFinancingTxn ? 0 : financing * 12;
  return txns.expense + financingAnnual;
}

// תזרים נטו שנתי
export function netAnnualCashflow(property, transactions, leases) {
  return annualIncome(property, transactions, leases) - annualExpenses(property, transactions);
}

// תזרים נטו חודשי (ממוצע)
export function netMonthlyCashflow(property, transactions, leases) {
  return netAnnualCashflow(property, transactions, leases) / 12;
}

// תשואה שנתית נטו באחוזים. null אם אין בסיס השקעה ידוע.
export function computeYield(property, transactions, leases) {
  const base = investmentBase(property);
  if (!base || base <= 0) return null;
  const net = netAnnualCashflow(property, transactions, leases);
  return (net / base) * 100;
}

// עוזר: סכום הכנסות/הוצאות לנכס ב-12 החודשים האחרונים.
function incomeExpenseInLastYear(propertyId, transactions) {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  let income = 0;
  let expense = 0;
  for (const t of transactions || []) {
    if (t.propertyId !== propertyId) continue;
    const d = t.date ? new Date(t.date) : null;
    if (d && !isNaN(d.getTime()) && d < cutoff) continue; // מחוץ לשנה
    const amt = Number(t.amount) || 0;
    if (t.type === "income") income += amt;
    else if (t.type === "expense") expense += amt;
  }
  return { income, expense };
}

// ---- אגרגציות לפורטפוליו (מסך 1 + מסך 2) ----

export function portfolioTotals(state) {
  const { properties = [], transactions = [], leases = [], debts = [] } = state;
  let totalIncome = 0;
  let netCashflowMonthly = 0;
  const yields = [];
  let lowYieldCount = 0;
  const threshold = state.settings?.lowYieldThreshold ?? 3;

  for (const p of properties) {
    totalIncome += annualIncome(p, transactions, leases);
    netCashflowMonthly += netMonthlyCashflow(p, transactions, leases);
    const y = computeYield(p, transactions, leases);
    if (y !== null) {
      yields.push(y);
      if (y < threshold) lowYieldCount += 1;
    }
  }

  const avgYield = yields.length ? yields.reduce((a, b) => a + b, 0) / yields.length : null;
  const openDebt = (debts || [])
    .filter((d) => !d.resolved)
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  return {
    propertyCount: properties.length,
    totalAnnualIncome: totalIncome,
    netCashflowMonthly,
    avgYield,
    lowYieldPct: yields.length ? (lowYieldCount / yields.length) * 100 : null,
    lowYieldCount,
    openDebt,
  };
}

// חוב פתוח לנכס בודד
export function openDebtForProperty(propertyId, debts) {
  return (debts || [])
    .filter((d) => d.propertyId === propertyId && !d.resolved)
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
}

// מספר תקלות פתוחות לנכס
export function openTicketsForProperty(propertyId, tickets) {
  return (tickets || []).filter(
    (t) => t.propertyId === propertyId && t.status !== "closed"
  ).length;
}
