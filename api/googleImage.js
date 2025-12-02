export default async function handler(req, res) {
  // Настройка CORS (чтобы фронтенд мог обращаться к этому API)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { prompt, aspectRatio } = req.body;
  const API_KEY = process.env.GOOGLE_AI_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: "Нет ключа GOOGLE_AI_KEY в настройках" });
  }

  // Google Imagen 3 поддерживает конкретные соотношения сторон
  let googleRatio = "1:1";
  switch (aspectRatio) {
      case "16:9": googleRatio = "16:9"; break;
      case "9:16": googleRatio = "9:16"; break;
      case "4:3":  googleRatio = "4:3"; break;
      case "3:4":  googleRatio = "3:4"; break;
      case "21:9": googleRatio = "16:9"; break; // Google не поддерживает 21:9 напрямую, берем ближайшее
      default:     googleRatio = "1:1"; break;
  }

  // URL для модели Imagen 3
  const URL = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${API_KEY}`;

  try {
    const response = await fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [
          { prompt: prompt },
        ],
        parameters: {
          sampleCount: 1,
          aspectRatio: googleRatio,
          // personGeneration: "allow_adult", // Можно раскомментировать, если нужно снять цензуру на людей
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Google API Error:", errText);
      throw new Error(`Google API Error: ${response.status} ${errText}`);
    }

    const data = await response.json();

    // Google возвращает картинку в base64
    if (data.predictions && data.predictions[0] && data.predictions[0].bytesBase64Encoded) {
      const base64Image = `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
      return res.status(200).json({ url: base64Image });
    } else {
      throw new Error("Google вернул пустой ответ (картинка не сгенерирована)");
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
