import { db } from "@/lib/prisma";
import { inngest } from "./client";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const generateIndustryInsights = inngest.createFunction(
  { name: "Generate Industry Insights" },
  { cron: "0 0 * * 0" }, // every Sunday
  async ({ step }) => {
    // ✅ Ensure GEMINI_API_KEY is available in both local + vercel
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) {
      console.error("❌ Missing GEMINI_API_KEY in environment");
      throw new Error("Missing GEMINI_API_KEY");
    }

    // ✅ Initialize Gemini each run — safer for Vercel cold starts
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // ✅ Fetch all industries safely
    const industries = await step.run("Fetch industries", async () => {
      return await db.industryInsight.findMany({
        select: { industry: true },
      });
    });

    // ✅ Loop over each industry
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
      No markdown, no text, only JSON.
      `;

      // ✅ Call Gemini safely
      const res = await step.run(`Gemini generate for ${industry}`, async () => {
        try {
          const result = await model.generateContent(prompt);
          const raw = result.response.text();

          // clean response — only valid JSON
          const firstBrace = raw.indexOf("{");
          const lastBrace = raw.lastIndexOf("}");
          const jsonString =
            firstBrace !== -1 && lastBrace !== -1
              ? raw.slice(firstBrace, lastBrace + 1)
              : raw;

          const clean = jsonString.replace(/```(?:json)?/g, "").trim();
          const parsed = JSON.parse(clean);

          // ✅ Ensure default values so Prisma never fails
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

      // ✅ Upsert industry data (creates if missing)
      await step.run(`Upsert ${industry} insights`, async () => {
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
      });
    }
  }
);
