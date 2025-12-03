export default async function handler(req, res) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { prompt, aspectRatio, image } = req.body;
  const API_KEY = process.env.GOOGLE_AI_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: "Нет ключа GOOGLE_AI_KEY" });
  }

  // Используем Gemini 2.0 Flash Experimental
  const MODEL = "gemini-2.0-flash-exp";
  const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

  let ratioText = "";
  switch (aspectRatio) {
      case "16:9": ratioText = "Aspect ratio 16:9."; break;
      case "9:16": ratioText = "Aspect ratio 9:16."; break;
      case "4:3":  ratioText = "Aspect ratio 4:3."; break;
      case "3:4":  ratioText = "Aspect ratio 3:4."; break;
      default:     ratioText = "Square aspect ratio 1:1."; break;
  }

  try {
    const parts = [];
    parts.push({ 
        text: `Generate a high quality photorealistic image of: ${prompt}. ${ratioText}` 
    });

    if (image) {
        const [meta, data] = image.split(',');
        const mimeType = meta.includes('jpeg') || meta.includes('jpg') ? 'image/jpeg' : 'image/png';
        if (data) {
            parts.push({
                inlineData: { mimeType: mimeType, data: data }
            });
            parts.push({ text: "Use the provided image as a reference." });
        }
    }

    const response = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: parts }],
        generationConfig: { responseModalities: ["IMAGE"] }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google API Error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const imagePart = data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

    if (imagePart) {
      const base64Image = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
      return res.status(200).json({ url: base64Image });
    } else {
      throw new Error("Модель вернула текст вместо картинки.");
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
