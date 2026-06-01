import { createServerFn } from "@tanstack/react-start";

type CategoryAgg = { name: string; type: string; amount: number; count: number };

export type InsightsInput = {
  currency: string;
  monthlySalary: number;
  range: string; // e.g. "Nov 2026"
  totalSpent: number;
  txnCount: number;
  avgPerDay: number;
  topCategories: CategoryAgg[];
  splitByType: Record<string, number>; // NEED/WANT/EMI/INVESTMENT
  paymentModes: Record<string, number>;
  cardOutstanding: { name: string; outstanding: number }[];
  recentBig: { name: string; amount: number; date: string; category: string }[];
  prevMonthTotal: number | null;
};

export type InsightsResponse = {
  headline: string;
  summary: string;
  positives: string[];
  warnings: string[];
  suggestions: string[];
  forecast: string;
};

export const generateInsights = createServerFn({ method: "POST" })
  .inputValidator((data: InsightsInput) => data)
  .handler(async ({ data }): Promise<InsightsResponse> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const system = `You are a sharp, friendly personal-finance analyst for an Indian user. Be concrete, reference the user's actual numbers, and give actionable advice. Avoid generic platitudes. Use the user's currency (${data.currency}). Keep each list item to one tight sentence.`;

    const user = `Analyze this user's spending for ${data.range} and return structured insights.

Salary: ${data.monthlySalary}
Total spent: ${data.totalSpent} across ${data.txnCount} transactions (avg ${data.avgPerDay.toFixed(0)}/day)
Previous month spent: ${data.prevMonthTotal ?? "n/a"}
Split by type: ${JSON.stringify(data.splitByType)}
Payment modes: ${JSON.stringify(data.paymentModes)}
Top categories: ${JSON.stringify(data.topCategories)}
Card outstanding: ${JSON.stringify(data.cardOutstanding)}
Largest recent transactions: ${JSON.stringify(data.recentBig)}

Call the return_insights tool with your analysis.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_insights",
              description: "Return structured spending insights.",
              parameters: {
                type: "object",
                properties: {
                  headline: { type: "string", description: "One-line punchy headline summarizing the month." },
                  summary: { type: "string", description: "2-3 sentence narrative overview." },
                  positives: { type: "array", items: { type: "string" }, description: "2-4 things the user did well." },
                  warnings: { type: "array", items: { type: "string" }, description: "2-4 spending concerns with specific numbers." },
                  suggestions: { type: "array", items: { type: "string" }, description: "3-5 concrete, actionable suggestions." },
                  forecast: { type: "string", description: "Short forecast for next month if trend continues." },
                },
                required: ["headline", "summary", "positives", "warnings", "suggestions", "forecast"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_insights" } },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Rate limit hit. Try again in a minute.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Workspace settings.");
      throw new Error(`AI gateway error ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) throw new Error("AI returned no insights.");
    return JSON.parse(call.function.arguments) as InsightsResponse;
  });
