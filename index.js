// index.js — SGBG chat backend (CORS locked to your domains)
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.set("trust proxy", 1);
app.use(express.json());

// ---- CORS allowlist for SGBG + Duda preview ----
const allowedHosts = new Set([
  "sangabrielbeveragegroup.com",
  "www.sangabrielbeveragegroup.com",
]);

app.use(
  cors({
    origin: (origin, callback) => {
      // allow server-to-server / curl / no-origin
      if (!origin) return callback(null, true);

      try {
        const { protocol, hostname } = new URL(origin);

        const isHttps = protocol === "https:";
        const isAllowedHost =
          allowedHosts.has(hostname) ||
          hostname.endsWith(".dudaone.com") ||
          hostname.endsWith(".multiscreensite.com"); // common Duda preview hosts

        if (isHttps && isAllowedHost) return callback(null, true);
        return callback(new Error("CORS blocked for origin: " + origin), false);
      } catch {
        return callback(new Error("CORS origin parse error"), false);
      }
    },
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// ---- OpenAI client (key is set in Render > Environment) ----
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---- Chat endpoint ----
app.post("/chat", async (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "No message" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // if you ever get a model-permission error, switch to "gpt-3.5-turbo"
      messages: [
        {
          role: "system",
          content:
            "You are San Gabriel’s Cocktail Recipe Assistant. Be concise, friendly, and precise.",
        },
        { role: "user", content: message },
      ],
      max_tokens: 400,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Sorry, I didn’t catch that.";
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

// ---- Start server ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Chat server listening on ${PORT}`));


