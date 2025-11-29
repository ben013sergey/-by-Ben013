export default async function handler(req, res) {
  // 1. CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { prompt } = req.body;
  const API_KEY = process.env.VITE_GEMINI_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: "API Key не найден" });
  }

  // 2. ФОРМИРУЕМ ЗАПРОС ВРУЧНУЮ (Без библиотек)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

  const systemInstruction = `
    Ты помощник для анализа промптов. Верни JSON.
    Структура:
    {
      "shortTitle": "Название (RU)",
      "category": "Категория (RU)",
      "variants": {"Портрет людей/персонажей", "Предметы и Дизайн продуктов", "Фоны и Окружение", "Стили и улучшения", "Другое"}
        "male": "Промпт (EN)",
        "female": "Промпт (EN)",
        "unisex": "Промпт (EN)"
      }
    }
  В ответе должен быть ТОЛЬКО JSON. Никаких markdown символов.
  `;

    const requestBody = {
    contents: [{
      parts: [{
        text: `${systemInstruction}\n\nПромпт пользователя: ${prompt}`
      }]
    }]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Ошибка Google API");
    }

    // 3. Достаем текст из ответа Google
    const text = data.candidates[0].content.parts[0].text;
    
    // Чистим JSON
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const finalData = JSON.parse(cleanJson);

    return res.status(200).json(finalData);

  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
