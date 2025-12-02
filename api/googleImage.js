export default async function handler(req, res) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { prompt, aspectRatio, image } = req.body;
  const API_KEY = process.env.GOOGLE_AI_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: "Нет ключа GOOGLE_AI_KEY в настройках" });
  }

  // Формируем текст про соотношение сторон
  let ratioText = "";
  switch (aspectRatio) {
      case "16:9": ratioText = "Aspect ratio 16:9."; break;
      case "9:16": ratioText = "Aspect ratio 9:16."; break;
      case "4:3":  ratioText = "Aspect ratio 4:3."; break;
      case "3:4":  ratioText = "Aspect ratio 3:4."; break;
      default:     ratioText = "Square aspect ratio 1:1."; break;
  }

  // Точное название модели из документации
  const MODEL = "gemini-2.5-flash-image";
  const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

  try {
    // Собираем части запроса (parts)
    const parts = [];

    // 1. Текст промпта
    parts.push({ 
        text: `${prompt}. ${ratioText} High quality, detailed.` 
    });

    // 2. Если есть картинка - добавляем её (режим Image-to-Image)
    if (image) {
        // Картинка приходит как "data:image/png;base64,iVBOR..."
        // Нам нужно отделить заголовок от самих данных
        const [meta, data] = image.split(',');
        // Пытаемся понять mimeType (png или jpeg), по умолчанию png
        const mimeType = meta.includes('jpeg') || meta.includes('jpg') ? 'image/jpeg' : 'image/png';

        if (data) {
            parts.push({
                inlineData: {
                    mimeType: mimeType,
                    data: data
                }
            });
        }
    }

    const response = await fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: parts
        }],
        // Принудительно просим вернуть картинку
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

    const resultData = await response.json();

    // Парсим ответ (inlineData)
    const contentParts = resultData?.candidates?.[0]?.content?.parts;
    const imagePart = contentParts?.find(p => p.inlineData && p.inlineData.mimeType.startsWith('image'));

    if (imagePart && imagePart.inlineData && imagePart.inlineData.data) {
      const base64Image = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
      return res.status(200).json({ url: base64Image });
    } else {
      console.log("Full Response:", JSON.stringify(resultData, null, 2));
      throw new Error("Модель не вернула картинку (возможно, сработал фильтр безопасности).");
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
