import express from "express";
import multer from "multer";
import OpenAI from "openai";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    cb(allowed.includes(file.mimetype) ? null : new Error("Använd JPG, PNG, WEBP eller GIF."), allowed.includes(file.mimetype));
  }
});
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));
const openai = apiKey ? new OpenAI({ apiKey }) : null;

function requireAI(_req, res, next) {
  if (!openai) return res.status(503).json({ error: "AI-backend saknar OPENAI_API_KEY. Lägg till nyckeln i .env och starta om servern." });
  next();
}
function extractOutput(response) {
  if (response.output_text) return response.output_text;
  const texts = [];
  for (const item of response.output || []) for (const c of item.content || []) if (c.type === "output_text") texts.push(c.text);
  return texts.join("\n");
}
function parseJson(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}
app.get("/api/health", (_req, res) => res.json({ ok: true, aiConfigured: Boolean(openai) }));

app.post("/api/scan", requireAI, upload.array("images", 5), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: "Ladda upp minst en bild." });
    const content = [
      { type: "input_text", text: `Analysera dessa foton av matvaror för en svensk receptapp. Identifiera endast varor som faktiskt syns. Var försiktig: om något är osäkert, markera låg säkerhet. Skilj inte på exakt mängd om det inte går att se. Svara ENDAST med giltig JSON enligt formatet: {"ingredients":[{"name":"svenskt ingrediensnamn","confidence":"hög|medel|låg","note":"kort osäkerhet eller tom sträng"}],"notes":"kort notering på svenska"}. Inkludera inte recept. Om bilden inte visar mat, returnera en tom lista.` },
      ...req.files.map(file => ({
        type: "input_image",
        image_url: `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
        detail: "high"
      }))
    ];
    const response = await openai.responses.create({
      model,
      input: [{ role: "user", content }],
      max_output_tokens: 1200
    });
    const result = parseJson(extractOutput(response));
    res.json(result);
  } catch (err) {
    console.error("scan error:", err.message);
    res.status(500).json({ error: "AI kunde inte analysera bilderna. Försök med tydligare bilder eller kontrollera modell/API-inställningarna." });
  }
});

app.post("/api/recipes", requireAI, async (req, res) => {
  try {
    const p = req.body || {};
    if (!Array.isArray(p.ingredients) || !p.ingredients.length) return res.status(400).json({ error: "Lägg till ingredienser först." });
    const safePrefs = {
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
      instructions: `Du är KylKocken AI, en noggrann svensk receptkock. Skapa recept utifrån användarens bekräftade ingredienser och preferenser. Returnera ENDAST giltig JSON, ingen markdown. Skapa exakt 3 recept. Använd helst ingredienserna användaren redan har. Hitta inte på att en ingrediens finns hemma. Lägg till saknade ingredienser separat. Respektera kosthållning och allergier strikt; om allergifiltret är oklart, välj säkra alternativ och skriv en tydlig varning. Gör inte medicinska garantier om allergisäkerhet. Svara på svenska. JSON-format: {"recipes":[{"title":"...","description":"...","minutes":20,"servings":2,"ingredients":[{"name":"...","amount":"..."}],"steps":["..."],"missingIngredients":["..."],"dietNotes":"..."}]}. Mängder ska vara rimliga för portionerna. Undvik påhittade exakta näringsvärden och priser.`,
      input: JSON.stringify(safePrefs),
      max_output_tokens: 3500
    });
    const result = parseJson(extractOutput(response));
    if (!Array.isArray(result.recipes)) throw new Error("AI-svaret saknade receptlista");
    res.json({ recipes: result.recipes.slice(0, 3) });
  } catch (err) {
    console.error("recipe error:", err.message);
    res.status(500).json({ error: "Recept kunde inte skapas. Försök igen eller kontrollera modell/API-inställningarna." });
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: "Bilden är för stor eller för många bilder valdes. Max 8 MB per bild och 5 bilder åt gången." });
  console.error(err.message);
  res.status(400).json({ error: err.message || "Begäran kunde inte behandlas." });
});
app.listen(port, () => console.log(`KylKocken AI kör på http://localhost:${port}`));
