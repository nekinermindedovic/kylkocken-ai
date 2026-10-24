
import express from "express";
import multer from "multer";
import OpenAI from "openai";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || 3000;
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const publicDir = path.join(root, "public");
const htmlPath = fs.existsSync(path.join(publicDir, "index.html"))
  ? path.join(publicDir, "index.html")
  : path.join(root, "index.html");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(fs.existsSync(path.join(publicDir, "index.html")) ? publicDir : root));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error("Använd JPG, PNG, WEBP eller GIF."));
  }
});

function requireAI(_req, res, next) {
  if (!openai) {
    return res.status(503).json({
      error: "OpenAI API-nyckeln saknas. Lägg till OPENAI_API_KEY i Render."
    });
  }
  next();
}

function getText(response) {
  return response.output_text || "";
}

function parseJSON(text) {
  return JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
}

app.get("/", (_req, res) => {
  if (!fs.existsSync(htmlPath)) {
    return res.status(404).send("index.html hittades inte.");
  }
  res.sendFile(htmlPath);
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, aiConfigured: Boolean(openai) });
});

app.post("/api/scan", requireAI, upload.array("images", 5), async (req, res) => {
  try {
    if (!req.files?.length) {
      return res.status(400).json({ error: "Välj minst en bild." });
    }

    const content = [{
      type: "input_text",
      text: 'Identifiera synliga matvaror. Svara endast med JSON: {"ingredients":[{"name":"namn","confidence":"hög"}],"notes":""}. Gissa inte varor som inte syns.'
    }];

    for (const file of req.files) {
      content.push({
        type: "input_image",
        image_url: `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
        detail: "high"
      });
    }

    const response = await openai.responses.create({
      model,
      input: [{ role: "user", content }],
      max_output_tokens: 1200
    });

    res.json(parseJSON(getText(response)));
  } catch (err) {
    console.error("Scan error:", err.message);
    res.status(500).json({
      error: "Bildanalysen misslyckades. Kontrollera API-nyckeln och försök igen."
    });
  }
});

app.post("/api/recipes", requireAI, async (req, res) => {
  try {
    const p = req.body || {};
    if (!Array.isArray(p.ingredients) || !p.ingredients.length) {
      return res.status(400).json({ error: "Lägg till ingredienser först." });
    }

    const preferences = {
      ingredients: p.ingredients.slice(0, 100),
      meal: String(p.meal || "Middag").slice(0, 40),
      servings: Math.min(12, Math.max(1, Number(p.servings) || 2)),
      maxMinutes: Math.min(240, Math.max(5, Number(p.maxMinutes) || 30)),
      diet: String(p.diet || "Allätare").slice(0, 60),
      allergies: String(p.allergies || "").slice(0, 500),
      likes: String(p.likes || "").slice(0, 1000),
      budget: String(p.budget || "Under 40 kr").slice(0, 60)
    };

    const response = await openai.responses.create({
      model,
      instructions: 'Du är KylKocken AI, en svensk receptkock. Skapa exakt 3 recept på svenska. Respektera kosthållning och allergier, utan att lova allergisäkerhet. Använd helst varor som redan finns hemma och lista saknade varor separat. Svara endast med giltig JSON i formatet: {"recipes":[{"title":"...","description":"...","minutes":20,"servings":2,"ingredients":[{"name":"...","amount":"..."}],"steps":["..."],"missingIngredients":["..."]}]}.',
      input: JSON.stringify(preferences),
      max_output_tokens: 3500
    });

    const result = parseJSON(getText(response));
    if (!Array.isArray(result.recipes)) throw new Error("Recept saknas i svaret");
    res.json({ recipes: result.recipes.slice(0, 3) });
  } catch (err) {
    console.error("Recipe error:", err.message);
    res.status(500).json({
      error: "Recept kunde inte skapas. Kontrollera API-inställningarna och försök igen."
    });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(400).json({ error: err.message || "Begäran misslyckades." });
});

app.listen(port, () => console.log(`KylKocken AI kör på port ${port}`));
