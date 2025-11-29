export default async function handler(req, res) {
  // Настройка доступов (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { prompt } = req.body;
  const API_KEY = process.env.VITE_GEMINI_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: "Нет API ключа" });
  }

  // ПРЯМОЙ URL (Используем стабильную модель 1.5 Flash)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

  // Инструкция для ИИ
  const systemInstruction = `
  Ты помощник. Твоя задача: вернуть валидный JSON.
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
  В ответе должен быть ТОЛЬКО JSON. Без markdown.
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Ошибка Google API");
    }

    // Достаем текст
    const text = data.candidates[0].content.parts[0].text;
    
    // Чистим JSON
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return res.status(200).json(JSON.parse(cleanJson));

  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
