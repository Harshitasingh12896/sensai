"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini with a supported model
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5" }); // ✅ Use valid model

/* ------------------------------------------------------------
 🔹 Generate Cover Letter
------------------------------------------------------------ */
export async function generateCoverLetter(data) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });
  if (!user) throw new Error("User not found");

  const prompt = `
Write a professional cover letter for a ${data.jobTitle} position at ${data.companyName}.

About the candidate:
- Industry: ${user.industry || "N/A"}
- Experience: ${user.experience || "N/A"} years
- Skills: ${user.skills?.join(", ") || "N/A"}
- Bio: ${user.bio || "N/A"}

Job Description:
${data.jobDescription}

Requirements:
1. Keep tone professional yet engaging.
2. Highlight relevant experience and achievements.
3. Keep it concise (under 400 words).
4. Format as a proper business cover letter in Markdown.
`;

  try {
    const result = await model.generateContent(prompt);
    const content = result.response.text().trim();

    console.log("✅ Gemini response:", content);

    return await db.coverLetter.create({
      data: {
        content,
        jobDescription: data.jobDescription,
        companyName: data.companyName,
        jobTitle: data.jobTitle,
        status: "completed",
        userId: user.id,
      },
    });
  } catch (error) {
    console.error("❌ Error generating cover letter:", error);

    // Fallback cover letter if AI fails
    const fallbackContent = `
Dear Hiring Manager,

I am excited to apply for the ${data.jobTitle} role at ${data.companyName}. With ${user.experience || "X"} years of experience in ${user.industry || "your industry"} and skills in ${user.skills?.join(", ") || "key technologies"}, I am confident in my ability to contribute effectively to your team.

I am particularly drawn to ${data.companyName} because of your commitment to innovation and excellence. I look forward to the opportunity to bring my expertise and enthusiasm to your projects.

Thank you for your time and consideration.

Sincerely,
${user.bio || "Your Name"}
`;

    return await db.coverLetter.create({
      data: {
        content: fallbackContent,
        jobDescription: data.jobDescription,
        companyName: data.companyName,
        jobTitle: data.jobTitle,
        status: "fallback",
        userId: user.id,
      },
    });
  }
}

/* ------------------------------------------------------------
 🔹 Get all cover letters
------------------------------------------------------------ */
export async function getCoverLetters() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");

  return await db.coverLetter.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
}

/* ------------------------------------------------------------
 🔹 Get single cover letter
------------------------------------------------------------ */
export async function getCoverLetter(id) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");

  return await db.coverLetter.findFirst({
    where: { id, userId: user.id },
  });
}


/* ------------------------------------------------------------
 🔹 Delete cover letter
------------------------------------------------------------ */
export async function deleteCoverLetter(id) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");

  return await db.coverLetter.deleteMany({
    where: { id, userId: user.id },
  });
}
