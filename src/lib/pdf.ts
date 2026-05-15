import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { formatCurrency } from "./format";
import type { Expense, Category, Profile } from "./expense-queries";

export function exportExpensesPDF(opts: {
  expenses: Expense[];
  categories: Category[];
  profile: Profile;
  rangeLabel: string;
  fileName: string;
}) {
  const { expenses, categories, profile, rangeLabel, fileName } = opts;
  const currency = profile.currency ?? "INR";
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Header banner
  doc.setFillColor(20, 20, 24);
  doc.rect(0, 0, pageW, 90, "F");
  doc.setTextColor(180, 220, 80);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Spendr", 40, 45);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Expense report — ${rangeLabel}`, 40, 65);
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 180);
  doc.text(`Generated ${format(new Date(), "MMM d, yyyy")} · ${profile.name || profile.email || ""}`, 40, 80);

  // Summary box
  let y = 120;
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TOTAL SPENT", 40, y);
  doc.text("TRANSACTIONS", 220, y);
  doc.text("% OF SALARY", 380, y);
  doc.setFontSize(18);
  doc.text(formatCurrency(total, currency), 40, y + 22);
  doc.text(`${expenses.length}`, 220, y + 22);
  const pct = profile.monthly_salary > 0 ? ((total / profile.monthly_salary) * 100).toFixed(1) + "%" : "—";
  doc.text(pct, 380, y + 22);

  // Category breakdown
  y += 60;
  const byCat = new Map<string, { name: string; amount: number; count: number; color: string }>();
  expenses.forEach((e) => {
    const c = categories.find((c) => c.id === e.category_id);
    const key = c?.id ?? "unknown";
    const cur = byCat.get(key) ?? { name: c?.name ?? "Unknown", amount: 0, count: 0, color: c?.color ?? "#999" };
    cur.amount += Number(e.amount);
    cur.count += 1;
    byCat.set(key, cur);
  });
  const catRows = Array.from(byCat.values())
    .sort((a, b) => b.amount - a.amount)
    .map((r) => [r.name, r.count.toString(), formatCurrency(r.amount, currency), total > 0 ? ((r.amount / total) * 100).toFixed(1) + "%" : "0%"]);

  autoTable(doc, {
    head: [["Category", "Count", "Amount", "% of total"]],
    body: catRows,
    startY: y,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [30, 30, 35], textColor: [200, 230, 100], halign: "left" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });

  // Transactions
  const txY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text("All transactions", 40, txY);

  const txRows = expenses.map((e) => {
    const c = categories.find((c) => c.id === e.category_id);
    return [
      format(parseISO(e.date), "MMM d"),
      e.name,
      c?.name ?? "—",
      e.payment_mode,
      formatCurrency(Number(e.amount), currency),
    ];
  });

  autoTable(doc, {
    head: [["Date", "Name", "Category", "Mode", "Amount"]],
    body: txRows,
    startY: txY + 8,
    theme: "striped",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [30, 30, 35], textColor: [200, 230, 100] },
    columnStyles: { 4: { halign: "right" } },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`Page ${i} of ${pageCount}`, pageW - 40, doc.internal.pageSize.getHeight() - 20, { align: "right" });
    doc.text("Spendr — personal expense tracker", 40, doc.internal.pageSize.getHeight() - 20);
  }

  doc.save(fileName);
}
