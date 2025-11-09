import { Inngest } from "inngest";

// Create the Inngest client
export const inngest = new Inngest({
  id: "sensai",
  name: "Sensai",
  signingKey: process.env.INNGEST_SIGNING_KEY, // ✅ Required for signature verification

  credentials: {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
    },
  },
});

