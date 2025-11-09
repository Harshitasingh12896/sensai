"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5" }); // ✅ Use valid model
export const generateAIInsights = async (industry) => {
  console.log("[generateAIInsights] industry:", industry);
  if (!process.env.GEMINI_API_KEY) {
    console.error("[generateAIInsights] GEMINI_API_KEY missing");
    throw new Error("Missing Gemini API key");
  }

  const prompt = `
    Analyze the current state of the ${industry} industry and return ONLY valid JSON with keys:
    salaryRanges (array of objects), growthRate (number), demandLevel (string),
    topSkills (array), marketOutlook (string), keyTrends (array), recommendedSkills (array).
    Example JSON only, no text or markdown.
  `;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    console.log("[generateAIInsights] raw:", raw);

    // Robust cleaning: keep only text between first { and last }
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    const maybeJson = firstBrace !== -1 && lastBrace !== -1 ? raw.slice(firstBrace, lastBrace + 1) : raw;

    const cleaned = maybeJson.replace(/```(?:json)?/g, "").trim();
    let parsed = JSON.parse(cleaned);

    // ensure fields exist, add defaults
    parsed = {
      salaryRanges: parsed.salaryRanges || [],
      growthRate: typeof parsed.growthRate === "number" ? parsed.growthRate : 0,
      demandLevel: parsed.demandLevel || "Medium",
      topSkills: parsed.topSkills || [],
      marketOutlook: parsed.marketOutlook || "Neutral",
      keyTrends: parsed.keyTrends || [],
      recommendedSkills: parsed.recommendedSkills || [],
    };

    console.log("[generateAIInsights] parsed:", parsed);
    return parsed;
  } catch (err) {
    console.error("Gemini Parsing Error:", err);
    // Return safe defaults so transaction can continue
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
};

export async function getIndustryInsights() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: { industryInsight: true },
  });

  if (!user) throw new Error("User not found");

  if (!user.industryInsight) {
    const industryKey = user.industry || "general";
    const insights = await generateAIInsights(industryKey);

    const newInsight = await db.industryInsight.create({
      data: {
        industry: industryKey,
        salaryRanges: insights.salaryRanges, // will be stored as JSON
        growthRate: insights.growthRate,
        demandLevel: insights.demandLevel,
        topSkills: insights.topSkills,
        marketOutlook: insights.marketOutlook,
        keyTrends: insights.keyTrends,
        recommendedSkills: insights.recommendedSkills,
        nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // link user to new insight
    await db.user.update({
      where: { clerkUserId: userId },
      data: { industryInsightId: newInsight.id },
    });

    return newInsight;
  }

  return user.industryInsight;
}
