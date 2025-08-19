// index.js — SGBG brand-locked chat backend (uses your approved list + blocklist)
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.set("trust proxy", 1);
app.use(express.json());

// ---------- CORS: allow your live domains and Duda previews ----------
const allowedHosts = new Set([
  "sangabrielbeveragegroup.com",
  "www.sangabrielbeveragegroup.com",
]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // allow curl/server-to-server

      try {
        const { protocol, hostname } = new URL(origin);
        const ok =
          protocol === "https:" &&
          (allowedHosts.has(hostname) ||
            hostname.endsWith(".dudaone.com") ||
            hostname.endsWith(".multiscreensite.com"));

        return ok
          ? callback(null, true)
          : callback(new Error("CORS blocked for: " + origin), false);
      } catch {
        return callback(new Error("CORS origin parse error"), false);
      }
    },
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// ---------- Load your product lists from files ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readLines(file) {
  try {
    return fs
      .readFileSync(path.join(__dirname, file), "utf8")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch (e) {
    console.error(`Could not read ${file}:`, e.message);
    return [];
  }
}

// IMPORTANT: add these two files to your repo (next section)
const APPROVED = readLines("Clean_San_Gabriel_Approved_Products.txt"); // exact brand names, one per line
const BLOCKLIST = readLines("Competitor_Blocklist.txt").map((s) => s.toLowerCase()); // competitor names

const BRAND_BULLETS = APPROVED.map((n) => `• ${n}`).join("\n");
const APPROVED_SET = new Set(APPROVED.map((n) => n.toLowerCase()));

// ---------- OpenAI client ----------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------- Strict system policy ----------
const SYSTEM_RULES = `
You are San Gabriel Beverage Group’s Cocktail Recipe Assistant.
Follow these rules without exception:

1) You must ONLY recommend products from the SGBG Approved List below (exact names).
2) Never name, recommend, or imply a brand not on the Approved List.
3) If the user asks for a non-approved brand or something generic, politely use an SGBG substitute from the Approved List.
4) Keep answers concise, friendly, and precise.

SGBG Approved List (exact names):
${BRAND_BULLETS}
`;

// ---------- POST /chat ----------
app.post("/chat", async (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "No message" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // if you ever see a model-permission error, try "gpt-3.5-turbo"
      temperature: 0.6,
      messages: [
        { role: "system", content: SYSTEM_RULES },
        {
          role: "system",
          content:
            "Reminder: never output brands outside the Approved List. If the user names a competitor, refuse and suggest an SGBG alternative.",
        },
        { role: "user", content: message },
      ],
      max_tokens: 500,
    });

    let reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Sorry, I didn’t catch that.";

    // ---------- Lightweight guardrail: check output for non-approved / blocked brands ----------
    const maybeBrands = reply.match(/[A-Z][A-Za-z0-9'&-]+(?:\s[A-Z][A-Za-z0-9'&-]+)*/g) || [];
    const flagged = new Set();

    for (const phrase of maybeBrands) {
      const norm = phrase.toLowerCase();
      if (BLOCKLIST.includes(norm)) flagged.add(phrase);
      if (!APPROVED_SET.has(norm)) {
        // ignore common words/units
        if (
          !/(oz|ml|dash|teaspoon|tablespoon|fresh|juice|simple|syrup|bitters|salt|ice|garnish|shake|strain|glass|rim|rocks|lime|lemon|soda|sugar|agave|pineapple|orange|triple|cola|strawberry|bloody|mix|mixes)/i.test(
            phrase
          )
        ) {
          // treat as out-of-catalog brandy-looking phrase
          flagged.add(phrase);
        }
      }
    }

    if (flagged.size) {
      reply +=
        `\n\n_Note: We only recommend SGBG brands from our Approved List. If a non-approved brand slipped in (${[
          ...flagged,
        ].join(", ")}), please substitute with an SGBG product above._`;
    }

    res.json({ reply });
  } catch (err) {
    const details =
      err?.response?.data?.error?.message ||
      err?.response?.data ||
      err?.message ||
      "OpenAI error";
    console.error("OpenAI call failed:", details);
    res.status(500).json({ error: details });
  }
});

// ---------- Start server ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Chat server listening on ${PORT}`));
