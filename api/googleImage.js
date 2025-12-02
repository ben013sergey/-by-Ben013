export default async function handler(req, res) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { prompt, aspectRatio } = req.body;
  const API_KEY = process.env.GOOGLE_AI_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: "Нет ключа GOOGLE_AI_KEY в настройках" });
  }

  // Для Gemini 2.0 Flash соотношение сторон лучше указывать прямо в промпте,
  // так как это мультимодальная модель, а не чистый генератор картинок.
  let ratioText = "";
  switch (aspectRatio) {
      case "16:9": ratioText = "Wide aspect ratio 16:9"; break;
      case "9:16": ratioText = "Tall aspect ratio 9:16"; break;
      case "4:3":  ratioText = "Aspect ratio 4:3"; break;
      case "3:4":  ratioText = "Aspect ratio 3:4"; break;
      default:     ratioText = "Square aspect ratio 1:1"; break;
  }

  // Используем новейшую модель Gemini 2.0 Flash Experimental
  // Она доступна бесплатно и умеет генерировать картинки нативно.
  const MODEL = "gemini-2.0-flash-exp";
  const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

  try {
    const response = await fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ 
            text: `Generate a photorealistic image of: ${prompt}. ${ratioText}. High quality, detailed.` 
          }]
        }],
        // Явно просим модель вернуть картинку (если поддерживается API версии)
        // Но даже без этого промпт "Generate an image" обычно работает в 2.0 Flash
        generationConfig: {
          responseModalities: ["IMAGE"] 
        }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Google API Error:", errText);
      
      // Если 2.0 Flash еще недоступна на этом ключе, пробуем обычный Flash 1.5 (но он не рисует)
      // Или возвращаем понятную ошибку
      throw new Error(`Google API Error: ${response.status} ${errText}`);
    }

    const data = await response.json();

    // Разбираем ответ Gemini 2.0. Картинка приходит как inlineData
    // Структура: candidates[0].content.parts[0].inlineData.data (base64)
    
    const parts = data?.candidates?.[0]?.content?.parts;
    const imagePart = parts?.find(p => p.inlineData && p.inlineData.mimeType.startsWith('image'));

    if (imagePart && imagePart.inlineData && imagePart.inlineData.data) {
      const base64Image = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
      return res.status(200).json({ url: base64Image });
    } else {
      console.log("Full Response:", JSON.stringify(data, null, 2));
      throw new Error("Модель не вернула картинку. Возможно, запрос был заблокирован фильтрами безопасности.");
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
