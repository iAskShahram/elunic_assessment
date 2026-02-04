import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

/**
 * Create and configure the Google Gemini LLM instance
 * Uses the GOOGLE_API_KEY environment variable
 */
export function createLLM() {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GOOGLE_API_KEY environment variable is not set. Please set it in your .env file."
    );
  }

  return new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey,
    temperature: 0.7,
    maxOutputTokens: 2048,
  });
}

/**
 * Create a streaming-enabled LLM instance
 */
export function createStreamingLLM() {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GOOGLE_API_KEY environment variable is not set. Please set it in your .env file."
    );
  }

  return new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey,
    temperature: 0.7,
    maxOutputTokens: 2048,
    streaming: true,
  });
}
