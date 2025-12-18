import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const SUMMARIZE_SYSTEM_PROMPT = `You are a helpful assistant that given a users' prompt, summarizes it into 5 words
or less. These summaries should be a short description of the feature/bug a user is trying to work on.
You should not include any punctuation in your summaries. Always capitalize the first letter of your summary
and the rest of the summary should be lowercase. Here are a few examples of good summaries:
#1
User's prompt: "Create a nice landing page for the notion clone that has a clear CTA and hero section."
Summary: "Update landing page
#2
User's prompt: "Fix bug where the slack chat won't auto-scroll to the bottom when a new message is sent."
Summary: "Fix auto-scroll bug"
#3
User's prompt: "Build a simple splitwise clone that has groups and allows users to split expenses."
Summary: "Splitwise clone"
`;

export const firstMessage = internalAction({
  args: { chatMessageId: v.id("chatMessagesStorageState"), message: v.string() },
  handler: async (ctx, args) => {
    const { chatMessageId, message } = args;

    // Skip summarization if Google API key is not configured
    if (!process.env.GOOGLE_API_KEY) {
      console.log("Skipping summarization: GOOGLE_API_KEY not set");
      return;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SUMMARIZE_SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: message }] }],
        }),
      }
    );

    if (!response.ok) {
      console.error("Failed to summarize message:", await response.text());
      return;
    }

    const data = await response.json();
    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!summary) {
      console.error("Failed to extract summary from response");
      return;
    }

    await ctx.runMutation(internal.summarize.saveMessageSummary, {
      chatMessageId,
      summary: summary.trim(),
    });
  },
});

export const saveMessageSummary = internalMutation({
  args: { chatMessageId: v.id("chatMessagesStorageState"), summary: v.string() },
  handler: async (ctx, args) => {
    const { chatMessageId, summary } = args;
    await ctx.db.patch(chatMessageId, {
      description: summary,
    });
  },
});
