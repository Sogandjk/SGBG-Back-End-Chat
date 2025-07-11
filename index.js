import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(cors({ origin: "*" }));   // change to your Duda URL later

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "No message" });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are San Gabriel’s Cocktail Recipe Assistant. Be concise, friendly and precise." },
        { role: "user", content: message }
      ],
      max_tokens: 400
    });
    res.json({ reply: completion.choices[0].message.content.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "OpenAI error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Chat server listening on ${PORT}`));
