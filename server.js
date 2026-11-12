import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pathToFileURL } from "node:url";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

function groqErrorResponse(status) {
  switch (status) {
    case 401:
    case 403:
      // Our server's key is bad; that's a config problem, not the caller's fault.
      return { status: 503, error: "The server's Groq API key was rejected." };
    case 429:
      return { status: 429, error: "Rate limit reached. Please try again shortly." };
    case 400:
    case 404:
    case 422:
      return { status: 502, error: "Groq rejected the request. The model name or parameters may be wrong." };
    case 413:
      return { status: 413, error: "Message is too long." };
    default:
      return status >= 500
        ? { status: 502, error: "Groq is having problems. Please try again later." }
        : { status: 502, error: `Groq request failed (HTTP ${status}).` };
  }
}

app.post("/groq", async (req, res) => {
  const { message } = req.body ?? {};
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Please provide a non-empty message." });
  }

  if (!process.env.GROQ_API_KEY) {
    console.error("GROQ_API_KEY is not configured.");
    return res.status(503).json({ error: "Server is missing its Groq API key." });
  }

  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: message }],
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      // Log the upstream body server-side only; never send it to the client.
      const body = await response.text().catch(() => "");
      console.error(`Groq HTTP ${response.status}:`, body.slice(0, 500));

      const { status, error } = groqErrorResponse(response.status);
      const retryAfter = response.headers.get("retry-after");
      if (response.status === 429 && retryAfter) {
        res.set("Retry-After", retryAfter);
      }
      return res.status(status).json({ error });
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const reply = choice?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      console.error("Groq returned no message. finish_reason:", choice?.finish_reason);
      return res.status(502).json({ error: "Groq returned an empty response." });
    }

    res.json({ reply });
  } catch (error) {
    if (error.name === "TimeoutError") {
      console.error("Groq request timed out.");
      return res.status(504).json({ error: "Groq took too long to respond." });
    }
    console.error("Groq request failed:", error);
    res.status(502).json({ error: "Could not reach Groq. Check the server logs." });
  }
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
  });
}

export default app;
