// server/routes/content.routes.js
// Translated content: glossary terms and the demo personas. Both are served
// per-language with an English fallback, so the client no longer ships three
// copies of this text in its bundle.

import { Router } from "express";
import { validate, q } from "../middleware/validate.js";
import { listGlossary, listPersonas } from "../services/content.js";
import { langQuery } from "./_schemas.js";

export const contentRouter = Router();

contentRouter.get("/glossary", validate({ query: langQuery }), (req, res) => {
  const lang = q(req).lang;
  res.json({ lang, terms: listGlossary(lang) });
});

contentRouter.get("/personas", validate({ query: langQuery }), (req, res) => {
  const lang = q(req).lang;
  res.json({ lang, personas: listPersonas(lang) });
});
