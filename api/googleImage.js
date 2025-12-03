export default async function handler(req, res) {
  // 1. Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { prompt, aspectRatio, image } = req.body;
  const API_KEY = process.env.GOOGLE_AI_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: "Нет ключа GOOGLE_AI_KEY" });
  }

  // 2. Настройки для Gemini 2.0 Flash
  const MODEL = "gemini-2.0-flash-exp";
  const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

  // Формируем текстовую подсказку про соотношение сторон
  let ratioText = "";
  switch (aspectRatio) {
      case "16:9": ratioText = "Aspect ratio 16:9."; break;
      case "9:16": ratioText = "Aspect ratio 9:16."; break;
      case "4:3":  ratioText = "Aspect ratio 4:3."; break;
      case "3:4":  ratioText = "Aspect ratio 3:4."; break;
      default:     ratioText = "Square aspect ratio 1:1."; break;
  }

  try {
    // 3. Собираем части запроса (Parts)
    const parts = [];

    // Текст промпта
    parts.push({ 
        text: `Generate a high quality photorealistic image of: ${prompt}. ${ratioText}` 
    });

    // Если есть картинка (Image-to-Image)
    if (image) {
        // image приходит как "data:image/png;base64,....."
        const [meta, data] = image.split(',');
        const mimeType = meta.includes('jpeg') || meta.includes('jpg') ? 'image/jpeg' : 'image/png';

        if (data) {
            parts.push({
                inlineData: {
                    mimeType: mimeType,
                    data: data
                }
            });
            // Добавляем инструкцию для модели
            parts.push({ text: "Use the provided image as a reference." });
        }
    }

    console.log(`Sending to Google (${MODEL})...`);

    // 4. Отправляем запрос
    const response = await fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: parts
        }],
        // Ключевой момент для Gemini 2.0 - просим вернуть именно IMAGE
        generationConfig: {
          responseModalities: ["IMAGE"] 
        }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Google API Error:", errText);
      throw new Error(`Google API Error: ${response.status} ${errText}`);
    }

    const data = await response.json();

    // 5. Парсим ответ (Inline Data)
    const candidates = data?.candidates;
    if (!candidates || candidates.length === 0) {
        throw new Error("Google вернул пустой ответ (фильтры безопасности или ошибка).");
    }

    const contentParts = candidates[0]?.content?.parts;
    // Ищем часть, которая является картинкой
    const imagePart = contentParts?.find(p => p.inlineData && p.inlineData.mimeType.startsWith('image'));

    if (imagePart && imagePart.inlineData && imagePart.inlineData.data) {
      const base64Image = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
      return res.status(200).json({ url: base64Image });
    } else {
      console.log("Full Response:", JSON.stringify(data, null, 2));
      throw new Error("Модель вернула текст вместо картинки. Попробуйте упростить промпт.");
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
