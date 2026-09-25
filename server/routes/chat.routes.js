// server/routes/chat.routes.js
// A simple chatbot endpoint. No conversation is stored server-side — the
// client sends its own message history each time, same pattern the Anthropic
// API itself uses. Works for guests (general Q&A) and signed-in users (who
// also get their own profile/applications folded into context).

import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { chat } from "../services/chatbot.js";
import { LANGS } from "./_schemas.js";

export const chatRouter = Router();

const chatBody = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      })
    )
    .min(1)
    .max(40),
  lang: z.enum(LANGS).optional().default("en"),
});

chatRouter.post(
  "/chat",
  writeLimiter,
  validate({ body: chatBody }),
  async (req, res, next) => {
    try {
      const reply = await chat({
        messages: req.body.messages,
        user: req.user ?? null,
        lang: req.body.lang,
      });
      res.json({ reply });
    } catch (err) {
      next(err);
    }
  }
);
