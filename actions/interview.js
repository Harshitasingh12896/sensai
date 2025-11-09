"use server";

import { db } from "@/lib/prisma"; // ✅ ensure correct import path
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ✅ Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/* ------------------------------------------------------------
 🔹 Generate Quiz Questions (10 questions based on user profile)
------------------------------------------------------------ */
export async function generateQuiz() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { industry: true, skills: true },
  });

  if (!user) throw new Error("User not found");

  const prompt = `
    Generate 10 multiple-choice technical interview questions for a ${user.industry} professional
    ${user.skills?.length ? `with expertise in ${user.skills.join(", ")}` : ""}.

    Each question must have this JSON format:
    {
      "question": "string",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "string",
      "explanation": "string"
    }

    Return only valid JSON in this structure:
    {
      "questions": [ ... ]
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    const cleanedText = response.replace(/```(?:json)?\n?/g, "").trim();
    const quiz = JSON.parse(cleanedText);

    if (!quiz.questions || quiz.questions.length < 1)
      throw new Error("Invalid quiz format");

    console.log("✅ Quiz generated with", quiz.questions.length, "questions");
    return quiz.questions;
  } catch (error) {
    console.error("❌ Error generating quiz:", error);

    // fallback quiz
    return [
      {
        question: "What does HTML stand for?",
        options: [
          "HyperText Markup Language",
          "HighText Machine Language",
          "HyperTransfer Markup Language",
          "HyperText Markdown Language",
        ],
        correctAnswer: "HyperText Markup Language",
        explanation: "HTML defines the structure of web pages.",
      },
      {
        question: "Which CSS property is used to change text color?",
        options: ["color", "text-color", "font-color", "background-color"],
        correctAnswer: "color",
        explanation: "The 'color' property defines text color in CSS.",
      },
      {
        question: "Which JavaScript keyword declares a constant variable?",
        options: ["const", "var", "let", "static"],
        correctAnswer: "const",
        explanation: "'const' creates a block-scoped, unchangeable variable.",
      },
      {
        question: "Which React hook is used for state management?",
        options: ["useState", "useEffect", "useContext", "useMemo"],
        correctAnswer: "useState",
        explanation: "useState manages component-level state in React.",
      },
      {
        question: "What does SQL stand for?",
        options: [
          "Structured Query Language",
          "Simple Query Language",
          "Sequential Query Logic",
          "Structured Question Language",
        ],
        correctAnswer: "Structured Query Language",
        explanation: "SQL stands for Structured Query Language.",
      },
      {
        question: "Which tag is used to link an external CSS file in HTML?",
        options: ["<link>", "<style>", "<css>", "<stylesheet>"],
        correctAnswer: "<link>",
        explanation: "The <link> tag links external CSS files.",
      },
      {
        question: "Which method converts JSON text into a JavaScript object?",
        options: [
          "JSON.parse()",
          "JSON.stringify()",
          "JSON.convert()",
          "JSON.toObject()",
        ],
        correctAnswer: "JSON.parse()",
        explanation: "JSON.parse() converts JSON strings to JS objects.",
      },
      {
        question: "What is Node.js?",
        options: [
          "JavaScript runtime environment",
          "Programming language",
          "Database",
          "Web framework",
        ],
        correctAnswer: "JavaScript runtime environment",
        explanation: "Node.js runs JavaScript outside the browser.",
      },
      {
        question: "Which HTTP method is used to create data on a server?",
        options: ["POST", "GET", "PUT", "DELETE"],
        correctAnswer: "POST",
        explanation: "POST is used to create or submit data to a server.",
      },
      {
        question: "Which AI model is commonly used for text generation?",
        options: ["Transformer", "CNN", "RNN", "GAN"],
        correctAnswer: "Transformer",
        explanation: "Transformer models power modern LLMs like Gemini and GPT.",
      },
    ];
  }
}

/* ------------------------------------------------------------
 🔹 Save Quiz Results and Generate Improvement Tip
------------------------------------------------------------ */
export async function saveQuizResult(questions, answers, score) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  // ✅ Prepare quiz question data
  const questionResults = questions.map((q, i) => ({
    question: q.question,
    correctAnswer: q.correctAnswer,
    userAnswer: answers[i],
    isCorrect: q.correctAnswer === answers[i],
    explanation: q.explanation,
  }));

  // ✅ Identify wrong answers
  const wrongAnswers = questionResults.filter((q) => !q.isCorrect);

  // ✅ Generate improvement tip using Gemini
  let improvementTip = null;
  if (wrongAnswers.length > 0) {
    const wrongSummary = wrongAnswers
      .map(
        (q) =>
          `Question: "${q.question}" | Correct: "${q.correctAnswer}" | User: "${q.userAnswer}"`
      )
      .join("\n");

    const improvementPrompt = `
      The user made mistakes in the following ${user.industry} technical questions:
      ${wrongSummary}

      Based on these, suggest a short improvement tip (2 sentences max),
      focusing on what the user should learn next. Keep it positive and specific.
    `;

    try {
      const tip = await model.generateContent(improvementPrompt);
      improvementTip = tip.response.text().trim();
    } catch (err) {
      console.error("⚠️ Error generating improvement tip:", err);
    }
  }

  // ✅ Save assessment record in DB
  try {
    const assessment = await db.assessment.create({
      data: {
        userId: user.id,
        quizScore: score,
        category: "Technical",
        questions: questionResults,
        improvementTip,
      },
    });

    console.log("✅ Assessment saved successfully");
    return assessment;
  } catch (error) {
    console.error("❌ Error saving assessment:", error);
    throw new Error("Failed to save quiz result");
  }
}

/* ------------------------------------------------------------
 🔹 Fetch All Assessments for User
------------------------------------------------------------ */
export async function getAssessments() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  try {
    const assessments = await db.assessment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return assessments;
  } catch (error) {
    console.error("❌ Error fetching assessments:", error);
    throw new Error("Failed to fetch assessments");
  }
}
