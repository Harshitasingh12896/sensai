import { db } from "@/lib/prisma";
import { inngest } from "./client";
import { GoogleGenerativeAI } from "@google/generative-ai";

// 🧠 Generate weekly industry insights
export const generateIndustryInsights = inngest.createFunction(
  { name: "Generate Industry Insights" },
  { cron: "0 0 * * 0" }, // every Sunday
  async ({ step }) => {
    // ✅ 1. Check API key
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) throw new Error("❌ Missing GEMINI_API_KEY in environment");

    // ✅ 2. Initialize Gemini model
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // ✅ 3. Fetch all industries
    const industries = await step.run("Fetch industries", async () => {
      return await db.industryInsight.findMany({
        select: { industry: true },
      });
    });

    // ✅ 4. Loop through each industry
    for (const { industry } of industries) {
      const prompt = `
      Analyze the ${industry} industry and provide ONLY this JSON:
      {
        "salaryRanges": [{"role": "string", "min": number, "max": number, "median": number, "location": "string"}],
        "growthRate": number,
        "demandLevel": "High"|"Medium"|"Low",
        "topSkills": ["skill1","skill2"],
        "marketOutlook": "Positive"|"Neutral"|"Negative",
        "keyTrends": ["trend1","trend2"],
        "recommendedSkills": ["skill1","skill2"]
      }
      Return ONLY valid JSON — no markdown or text.
      `;

      // ✅ 5. Generate insights via Gemini
      const res = await step.run(`Gemini generate for ${industry}`, async () => {
        try {
          const result = await model.generateContent(prompt);
          const raw = result.response.text();

          // Extract clean JSON
          const first = raw.indexOf("{");
          const last = raw.lastIndexOf("}");
          const jsonText = first !== -1 && last !== -1 ? raw.slice(first, last + 1) : raw;
          const clean = jsonText.replace(/```(?:json)?/g, "").trim();
          const parsed = JSON.parse(clean);

          // Fallback-safe defaults
          return {
            salaryRanges: parsed.salaryRanges || [],
            growthRate: typeof parsed.growthRate === "number" ? parsed.growthRate : 0,
            demandLevel: parsed.demandLevel || "Medium",
            topSkills: parsed.topSkills || [],
            marketOutlook: parsed.marketOutlook || "Neutral",
            keyTrends: parsed.keyTrends || [],
            recommendedSkills: parsed.recommendedSkills || [],
          };
        } catch (err) {
          console.error(`[Gemini Error for ${industry}]`, err);
          return {
            salaryRanges: [],
            growthRate: 0,
            demandLevel: "Medium",
            topSkills: [],
            marketOutlook: "Neutral",
            keyTrends: [],
            recommendedSkills: [],
          };
        }
      });

      // ✅ 6. Upsert data safely
      await step.run(`Upsert ${industry} insights`, async () => {
        try {
          await db.industryInsight.upsert({
            where: { industry },
            update: {
              ...res,
              lastUpdated: new Date(),
              nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
            },
            create: {
              industry,
              ...res,
              lastUpdated: new Date(),
              nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          });
        } catch (err) {
          console.error(`[Upsert Error for ${industry}]`, err);

          // Optional: retry once for Neon connection drops
          await db.$disconnect();
          const retry = await db.industryInsight.upsert({
            where: { industry },
            update: {
              ...res,
              lastUpdated: new Date(),
              nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
            create: {
              industry,
              ...res,
              lastUpdated: new Date(),
              nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          });
          console.log(`[Retry successful for ${industry}]`, retry);
        }
      });
    }

    // ✅ 7. Close Prisma (important on Vercel)
    await db.$disconnect();
  }
);
