const { GoogleGenAI } = require("@google/genai");

// Valid categories — must stay in sync with Issue.model.js enum
const VALID_CATEGORIES = [
  "pothole",
  "garbage",
  "water",
  "power",
  "drainage",
  "streetlight",
  "road",
  "other",
];

// @route   POST /api/ai/analyze-issue
// @desc    Analyze a civic issue photo with Gemini and return structured autofill data
// @access  Private – authenticated users
const analyzeIssue = async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        message: "AI analysis is not configured. Add GEMINI_API_KEY to the backend .env file.",
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No image provided." });
    }

    const { buffer, mimetype } = req.file;
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(mimetype)) {
      return res.status(400).json({ message: "Invalid image type. Use JPEG, PNG, or WebP." });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `You are a civic issue classification assistant for a city reporting app.

Analyze this image and determine if it shows a civic infrastructure issue.

If the image contains a visible civic issue, respond with ONLY valid JSON in this exact format:
{
  "title": "brief descriptive title (5-80 chars)",
  "description": "detailed description of the visible problem (10-200 chars)",
  "category": "one of: pothole, garbage, water, power, drainage, streetlight, road, other",
  "confidence": 0.95
}

Rules:
- category MUST be exactly one of: pothole, garbage, water, power, drainage, streetlight, road, other
- confidence is a decimal number between 0 and 1
- If the image does NOT show a civic issue, respond ONLY with: {"error": "not_civic_issue"}
- If the image is unclear, respond ONLY with: {"error": "unclear_image"}
- Output ONLY the JSON object. No markdown, no code fences, no explanation.`;

    let rawText;
    if (process.env.NODE_ENV === "test" || process.env.MOCK_GEMINI === "true") {
      const scenario = req.headers["x-test-scenario"];
      if (scenario === "invalid-json") {
        rawText = "Not a JSON response";
      } else if (scenario === "api-failure") {
        throw new Error("API_KEY_INVALID");
      } else if (scenario === "quota-exceeded") {
        throw new Error("RESOURCE_EXHAUSTED");
      } else if (scenario === "not-civic") {
        rawText = JSON.stringify({ error: "not_civic_issue" });
      } else if (scenario === "unclear") {
        rawText = JSON.stringify({ error: "unclear_image" });
      } else if (scenario === "invalid-category") {
        rawText = JSON.stringify({
          title: "Pothole on Main Road",
          description: "A huge pothole that needs immediate attention.",
          category: "invalid_category_here",
          confidence: 0.92
        });
      } else {
        rawText = JSON.stringify({
          title: "Pothole on Main Road",
          description: "A huge pothole that needs immediate attention.",
          category: "pothole",
          confidence: 0.92
        });
      }
    } else {
      const response = await ai.models.generateContent({
        model: "gemini-flash-lite-latest",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: mimetype,
                  data: buffer.toString("base64"),
                },
              },
              { text: prompt },
            ],
          },
        ],
      });

      rawText = response.text.trim();
    }

    // Strip markdown code fences if Gemini wraps output
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Gemini non-JSON response:", rawText);
      return res.status(422).json({
        message: "AI returned an unexpected response. Please fill the form manually.",
      });
    }

    if (parsed.error === "not_civic_issue") {
      return res.status(422).json({
        message: "This image does not appear to show a civic issue. Please upload a relevant photo or fill the form manually.",
      });
    }

    if (parsed.error === "unclear_image") {
      return res.status(422).json({
        message: "The image is unclear. Please take a clearer photo or fill the form manually.",
      });
    }

    // Sanitise category
    if (!parsed.category || !VALID_CATEGORIES.includes(parsed.category)) {
      parsed.category = "other";
    }

    // Sanitise title
    if (!parsed.title || String(parsed.title).length < 5) {
      parsed.title = "Civic issue detected";
    }
    parsed.title = String(parsed.title).substring(0, 150);

    // Sanitise description
    if (!parsed.description || String(parsed.description).length < 10) {
      parsed.description = "Issue detected in the uploaded photo. Please review and add more details.";
    }
    parsed.description = String(parsed.description).substring(0, 1000);

    // Sanitise confidence
    const confidence = typeof parsed.confidence === "number"
      ? Math.min(1, Math.max(0, parsed.confidence))
      : 0.8;

    return res.status(200).json({
      title:       parsed.title,
      description: parsed.description,
      category:    parsed.category,
      confidence,
    });

  } catch (error) {
    console.error("AI analyze-issue error:", error.message ?? error);

    if (error.message?.includes("RESOURCE_EXHAUSTED") || error.status === 429 ||
        (typeof error === 'object' && JSON.stringify(error).includes('RESOURCE_EXHAUSTED'))) {
      return res.status(429).json({
        message: "AI quota exceeded. Enable the Generative Language API in Google Cloud Console for your project, or wait a minute and retry.",
      });
    }

    if (error.message?.includes("API_KEY_INVALID")) {
      return res.status(503).json({
        message: "Invalid Gemini API key. Please check GEMINI_API_KEY in the backend .env file.",
      });
    }

    return res.status(500).json({
      message: "AI analysis failed. Please fill the form manually.",
      error: error.message,
    });
  }
};

module.exports = { analyzeIssue };
