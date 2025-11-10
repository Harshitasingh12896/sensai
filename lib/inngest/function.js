import { db } from "@/lib/prisma"; // ✅ Use shared Prisma instance
import { inngest } from "./client";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const generateIndustryInsights = inngest.createFunction(
  { name: "Generate Industry Insights" },
  { cron: "0 0 * * 0" }, // every Sunday
  async ({ step }) => {
    // ✅ Ensure GEMINI_API_KEY exists
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) throw new Error("❌ Missing GEMINI_API_KEY");

    // ✅ Initialize Gemini client (fresh per invocation)
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // ✅ Fetch all industries
    const industries = await step.run("Fetch industries", async () => {
      return await db.industryInsight.findMany({
        select: { industry: true },
      });
    });

    // ✅ Loop through industries
    for (const { industry } of industries) {
      const prompt = `
        Analyze the ${industry} industry and provide ONLY JSON:
        {
          "salaryRanges": [{"role": "string", "min": number, "max": number, "median": number, "location": "string"}],
          "growthRate": number,
          "demandLevel": "High"|"Medium"|"Low",
          "topSkills": ["skill1","skill2"],
          "marketOutlook": "Positive"|"Neutral"|"Negative",
          "keyTrends": ["trend1","trend2"],
          "recommendedSkills": ["skill1","skill2"]
        }
        No markdown, no explanation, just JSON.
      `;

      // ✅ Step 1: Generate data from Gemini
      const res = await step.run(`Gemini generate for ${industry}`, async () => {
        try {
          const result = await model.generateContent(prompt);
          const raw = result.response.text();

          const first = raw.indexOf("{");
          const last = raw.lastIndexOf("}");
          const jsonText =
            first !== -1 && last !== -1 ? raw.slice(first, last + 1) : raw;

          const clean = jsonText.replace(/```(?:json)?/g, "").trim();
          const parsed = JSON.parse(clean);

          // ✅ Ensure structure always valid
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

      // ✅ Step 2: Upsert into Prisma (with safe retry)
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

          // ✅ Retry once after reconnect (for Neon/Pooling issues)
          try {
            await db.$disconnect();
            await new Promise((r) => setTimeout(r, 500)); // short delay for pool reset
            const { PrismaClient } = await import("@prisma/client");
            const retryDb = new PrismaClient();

            await retryDb.industryInsight.upsert({
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

            await retryDb.$disconnect();
          } catch (retryErr) {
            console.error(`[Retry failed for ${industry}]`, retryErr);
          }
        }
      });
    }

    // ✅ Clean disconnect at the end of the job
    await db.$disconnect();
  }
);
