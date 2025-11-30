export default async function handler(req, res) {
  // CORS заголовки
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

  // Прямой запрос к Gemini 1.5 Flash
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

  const systemInstruction = `
  Ты эксперт по промптам. Твоя задача - проанализировать запрос и вернуть JSON.
  
  Правила:
  1. Переведи промпт на английский (для генерации) и улучши его.
  2. Оставь/создай красивую версию на русском.
  3. Категория должна быть СТРОГО одна из списка:
     - Портрет людей/персонажей
     - Предметы и Дизайн продуктов
     - Фоны и Окружение
     - Стили и улучшения
     - Другое
  
  Структура JSON ответа (все поля обязательны):
  {
    "shortTitle": "Короткое название (RU, 2-4 слова)",
    "category": "Категория из списка выше",
    "variants": {
      "maleEn": "Промпт для парня (English)",
      "maleRu": "Промпт для парня (Russian)",
      "femaleEn": "Промпт для девушки (English)",
      "femaleRu": "Промпт для девушки (Russian)",
      "unisexEn": "Общий промпт (English)",
      "unisexRu": "Общий промпт (Russian)"
    }
  }
  В ответе ТОЛЬКО чистый JSON. Без markdown.
  `;

  const requestBody = {
    contents: [{
      parts: [{
        text: `${systemInstruction}\n\nЗапрос пользователя: ${prompt}`
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

    const text = data.candidates[0].content.parts[0].text;
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return res.status(200).json(JSON.parse(cleanJson));

  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
