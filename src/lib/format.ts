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
