import { db } from "@/lib/prisma";
import { inngest } from "./client";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const generateIndustryInsights = inngest.createFunction(
  { name: "Generate Industry Insights" },
  { cron: "0 0 * * 0" }, // every Sunday
  async ({ step }) => {
    // ✅ Ensure GEMINI_API_KEY is loaded properly
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Missing GEMINI_API_KEY in environment");
    }

    // Initialize Gemini inside the step (ensures runtime binding)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Fetch all industries
    const industries = await step.run("Fetch industries", async () => {
      return await db.industryInsight.findMany({
        select: { industry: true },
      });
    });

    for (const { industry } of industries) {
      const prompt = `
      Analyze the ${industry} industry and provide JSON:
      {
        "salaryRanges": [{"role": "string", "min": number, "max": number, "median": number, "location": "string"}],
        "growthRate": number,
        "demandLevel": "High"|"Medium"|"Low",
        "topSkills": ["skill1","skill2"],
        "marketOutlook": "Positive"|"Neutral"|"Negative",
        "keyTrends": ["trend1","trend2"],
        "recommendedSkills": ["skill1","skill2"]
      }
      Return ONLY the JSON (no markdown or explanations).
      `;

      // ✅ Generate Gemini output with better error handling
      const res = await step.run(`Gemini generate for ${industry}`, async () => {
        try {
          const result = await model.generateContent(prompt);
          const text = result.response.text();
          const clean = text.replace(/```(?:json)?/g, "").trim();
          return JSON.parse(clean);
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

      // ✅ Update database
      await step.run(`Update ${industry} insights`, async () => {
        await db.industryInsight.update({
          where: { industry },
          data: {
            ...res,
            lastUpdated: new Date(),
            nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      });
    }
  }
);
