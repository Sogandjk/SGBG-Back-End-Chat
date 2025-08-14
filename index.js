import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.set("trust proxy", 1);
app.use(express.json());

// Keep "*" while testing. After it works, change to your Duda URL.
app.use(cors({ origin: "*" }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// TEMP: prove which key the server is using (only prints first 7 chars + length)
console.log(
  "Using OPENAI_API_KEY prefix:",
  (process.env.OPENAI_API_KEY || "").slice(0, 7),
  "… length:",
  (process.env.OPENAI_API_KEY || "").length
);

app.post("/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "No message" });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // if permission error, try "gpt-3.5-turbo"
      messages: [
        {
          role: "system",
          content:
            "You are San Gabriel’s Cocktail Recipe Assistant. Be concise, friendly and precise."
        },
        { role: "user", content: message }
      ],
      max_tokens: 400
    });

    res.json({ reply: completion.choices[0].message.content.trim() });
  } catch (err) {
    // TEMP diagnostic catch: shows the real OpenAI error
    const details =
      err?.response?.data?.error?.message ||
      err?.response?.data ||
      err?.message ||
      String(err);
    console.error("OpenAI call failed:", details);
    res.status(500).json({ error: details });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Chat server listening on ${PORT}`));

