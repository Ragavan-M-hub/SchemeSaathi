// server/services/chatbot.js
// Talks to the Anthropic API. The model is only ever given facts pulled from
// our own database (schemes, glossary) plus the signed-in user's own profile
// and applications — it is never allowed to invent scheme terms, so grounding
// happens in the system prompt, not in the model's memory.

import Groq from "groq-sdk";
import { env } from "../env.js";
import { listSchemes } from "./schemes.js";
import { listGlossary } from "./content.js";
import { getProfile } from "./users.js";
import { listApplications } from "./applications.js";
import { badRequest } from "../utils/errors.js";

const client = new Groq({ apiKey: env.GROQ_API_KEY });

// Keep the catalogue compact — the model needs numbers to be accurate, not
// full prose descriptions. This also caps token cost per request.
function summarizeSchemes() {
  return listSchemes()
    .map((s) => {
      const loan = `₹${s.loan.min.toLocaleString("en-IN")}–₹${s.loan.max.toLocaleString("en-IN")}`;
      const interest = `${s.interest.min}–${s.interest.max}%`;
      return `- ${s.name} (id: ${s.id}): ${s.category}, loan ${loan}, interest ${interest}, income ceiling ₹${s.incomeCeiling.toLocaleString(
        "en-IN"
      )}, purposes: ${s.purposes.join(", ") || "n/a"}, min education: ${s.minEducation}${
        s.womenOnly ? ", women-only" : ""
      }.`;
    })
    .join("\n");
}

function summarizeGlossary(lang) {
  return listGlossary(lang)
    .map((g) => `- ${g.term}: ${g.plain}`)
    .join("\n");
}

function summarizeUser(user) {
  if (!user) return "The visitor is not signed in — speak generally, and suggest creating an account to save progress.";
  const profile = getProfile(user.id);
  const applications = listApplications({ userId: user.id });
  const parts = [`Signed in as ${user.name} (role: ${user.role}).`];
  if (profile?.purpose || profile?.income) {
    parts.push(
      `Their saved profile: purpose=${profile.purpose ?? "n/a"}, income=${profile.income ?? "n/a"}, education=${
        profile.education ?? "n/a"
      }, state=${profile.state ?? "n/a"}.`
    );
  }
  if (applications?.length) {
    parts.push(
      `They have ${applications.length} application(s) in progress: ${applications
        .map((a) => `${a.schemeId} (${a.status})`)
        .join(", ")}.`
    );
  }
  return parts.join(" ");
}

function systemPrompt({ user, lang }) {
  const langName = { en: "English", hi: "Hindi", mr: "Marathi" }[lang] ?? "English";
  return `You are the SchemeSaathi assistant, embedded in a web app that helps SC (Scheduled Caste) entrepreneurs in India find concessional government loan schemes, understand loan terms, and apply.

Reply in ${langName} unless the user clearly writes in a different language.

Ground every factual claim about a scheme (loan amount, interest rate, income ceiling, documents) ONLY in the catalogue below — never invent numbers. If something isn't in the catalogue, say you're not sure and suggest they check the official source.

This is a hackathon prototype. The scheme data below is illustrative demo data, not verified against live government sources — if the user asks for guarantees or asks you to actually submit anything, remind them of that.

SCHEME CATALOGUE:
${summarizeSchemes()}

GLOSSARY:
${summarizeGlossary(lang)}

USER CONTEXT:
${summarizeUser(user)}

Keep answers short and practical (a few sentences, or a short list). When relevant, point them to the right page: /schemes to get matched, /emi to calculate repayment, /partners to find a lender, /applications to track a submitted application.`;
}

const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2000;

export async function chat({ messages, user, lang }) {
  if (!env.GROQ_API_KEY) {
    throw badRequest(
      "The assistant isn't configured yet — ask an admin to set GROQ_API_KEY.",
      "chatbot_not_configured"
    );
  }

  const trimmed = messages.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
    role: m.role,
    content: m.content.slice(0, MAX_MESSAGE_LENGTH),
  }));

  // Groq's API is OpenAI-compatible: the system prompt is just the first
  // message in the same array, not a separate top-level field.
  const response = await client.chat.completions.create({
    model: "openai/gpt-oss-120b",
    max_tokens: 500,
    messages: [{ role: "system", content: systemPrompt({ user, lang }) }, ...trimmed],
  });

  const text = response.choices?.[0]?.message?.content?.trim();

  return text || "Sorry, I couldn't come up with a reply — please try asking again.";
}