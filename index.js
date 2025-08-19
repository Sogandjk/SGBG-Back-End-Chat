// index.js
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();

/* ---------- CORS ----------
 * While testing, * allows the Duda editor preview.
 * Once live, change to: ["https://sangabrielbeveragegroup.com"]
 */
app.use(cors({ origin: "*" }));

app.set("trust proxy", 1);
app.use(express.json());

// OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Build the system prompt from approved & blocked lists.
 *  Neutral brand voice: never tell customers to "replace" a brand;
 *  simply present recipes using SGBG-approved items.
 */
function buildSystemPrompt(approved = [], blocked = []) {
  const approvedList =
    approved && approved.length
      ? `Approved products (use by exact name when calling for a spirit-flavored wine):
- ${approved.join("\n- ")}`
      : `Approved products: (none provided by client — use generic drink components only)`;

  const blockedList =
    blocked && blocked.length
      ? `Do NOT mention or recommend any of these brand names:\n- ${blocked.join("\n- ")}`
      : "";

  return `
You are the San Gabriel Cocktail Recipe Assistant on the official SGBG website.
Your job is to create cocktail recipes with a natural, in-store brand voice.
Use ONLY the approved SGBG spirit-flavored wines when a branded base is needed.
If the user gives an off-catalog brand, just create the recipe using the best
fit from the approved list without calling attention to substitutions.

${approvedList}

${blockedList}

STYLE GUIDELINES
- Tone: friendly, concise, professional. No over-explaining brand details.
- Never say “replace X with SGBG Y” or similar. Just present the recipe naturally.
- Keep ingredient lists tight and specific; use exact approved product names when applicable.
- Generic mixers (lime juice, simple syrup, soda water, etc.) are fine.
- If the user asks for a recipe that requires something not in the approved list,
  build it around the closest approved SGBG product without calling this out.

OUTPUT FORMAT (plain text):
Title
Ingredients
- list (1 per line)
Instructions
1. step
2. step
Notes (optional)
- brief, if helpful
`;
}

app.get("/", (_req, res) => {
  res.type("text/plain").send("SGBG Cocktail Recipe Assistant is running.");
});

/** POST /chat
 *  Body: { message: string, history?: {role,content}[], catalog?: string[], blocked?: string[] }
 */
app.post("/chat", async (req, res) => {
  try {
    const { message, history = [], catalog = [], blocked = [] } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "No message" });
    }

    // de-dupe the incoming lists
    const approved = [...new Set((catalog || []).filter(Boolean))];
    const deny     = [...new Set((blocked || []).filter(Boolean))];

    const systemPrompt = buildSystemPrompt(approved, deny);

    // Clip history to avoid large context
    const clipped = history.slice(-10);

    const messages = [
      { role: "system", content: systemPrompt },
      ...clipped.map(x => ({ role: x.role, content: x.content })),
      { role: "user", content: message }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 700
    });

    const reply = completion?.choices?.[0]?.message?.content?.trim() || "";
    if (!reply) throw new Error("Empty response from model.");

    res.json({ reply });
  } catch (err) {
    const details =
      err?.response?.data?.error?.message ||
      err?.message ||
      "OpenAI error";
    console.error("OpenAI call failed:", details);
    res.status(500).json({ error: details });
  }
});

const PORT = process.env.PORT || 10000; // Render will map this to 443
app.listen(PORT, () => {
  console.log(`Chat server listening on ${PORT}`);
});
