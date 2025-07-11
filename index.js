// index.js  – San Gabriel Beverage Group ChatGPT relay
// -----------------------------------------------
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();

/* Replit / Render run behind proxies → trust them so req.ip & rate-limit work. */
app.set("trust proxy", 1);

app.use(express.json());

/* CORS
   ───────────────
   • Leave origin: "*" while you’re testing from anywhere.
   • When you go live, replace "*" with your real Duda URL, e.g.
     app.use(cors({ origin: "https://san-gabriel.dudaone.com" }));
*/
app.use(cors({ origin: "*" }));

/* Initialise OpenAI with the secret key you’ll set as an env var on Render. */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* POST  /chat  –  main endpoint */
app.post(
