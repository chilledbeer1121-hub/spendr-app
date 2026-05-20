// Currency + Indian number formatting helpers

export function formatCurrency(amount: number, currency = "INR"): string {
  if (currency === "INR") {
    // Indian system: 1,02,215 (lakhs/crores)
    const formatted = new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 0,
    }).format(Math.round(amount));
    return `₹${formatted}`;
  }
  const symbol = { USD: "$", EUR: "€", GBP: "£", AED: "د.إ" }[currency] ?? "";
  return `${symbol}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(amount))}`;
}

// PDF-safe currency formatter. jsPDF's built-in Helvetica uses WinAnsi
// encoding which doesn't support ₹ (U+20B9) or د.إ — they render as garbled
// glyphs with broken letter spacing. Use ASCII-safe prefixes instead.
export function formatCurrencyPDF(amount: number, currency = "INR"): string {
  const rounded = Math.round(amount);
  if (currency === "INR") {
    return `Rs ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(rounded)}`;
  }
  if (currency === "AED") {
    return `AED ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(rounded)}`;
  }
  const symbol = { USD: "$", EUR: "EUR ", GBP: "GBP " }[currency] ?? `${currency} `;
  return `${symbol}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(rounded)}`;
}

export function currencySymbol(currency = "INR"): string {
  return ({ INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ" } as Record<string, string>)[currency] ?? "";
}

// Salary % — single source of truth
export function pctOfSalary(amount: number, monthlySalary: number, monthsInRange = 1): number {
  const totalSalary = monthlySalary * Math.max(monthsInRange, 1);
  if (totalSalary <= 0) return 0;
  return (amount / totalSalary) * 100;
}

export function savingRate(monthlySalary: number, totalSpent: number): number {
  if (monthlySalary <= 0) return 0;
  return ((monthlySalary - totalSpent) / monthlySalary) * 100;
}
