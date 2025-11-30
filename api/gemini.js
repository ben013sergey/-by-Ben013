export default async function handler(req, res) {
  // Заголовки для доступа
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

  // --- ЧИСТЫЙ ЗАПРОС (БЕЗ БИБЛИОТЕК) ---
  // Используем Gemini 1.5 Flash (она сейчас основная бесплатная)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

  const systemInstruction = `
  Ты эксперт по промптам. Твоя задача: вернуть валидный JSON.
  Структура:
  {
    "shortTitle": "Название (RU)",
    "category": "Категория",
    "variants": {
      "maleEn": "Prompt for male (EN)",
      "maleRu": "Промпт для парня (RU)",
      "femaleEn": "Prompt for female (EN)",
      "femaleRu": "Промпт для девушки (RU)",
      "unisexEn": "Prompt (EN)",
      "unisexRu": "Промпт (RU)"
    }
  }
  Категории: 'Портрет людей/персонажей', 'Предметы и Дизайн продуктов', 'Фоны и Окружение', 'Стили и улучшения', 'Другое'.
  Верни ТОЛЬКО JSON.
  `;

  const requestBody = {
    contents: [{
      parts: [{
        text: `${systemInstruction}\n\nЗАПРОС ПОЛЬЗОВАТЕЛЯ: ${prompt}`
      }]
    }]
  };

  try {
    console.log("Отправляем запрос в Google...");
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    // Если Google вернул ошибку, выводим её текст
    if (!response.ok) {
      console.error("Google Error:", JSON.stringify(data));
      throw new Error(data.error?.message || "Ошибка Google API");
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Пустой ответ");

    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return res.status(200).json(JSON.parse(cleanJson));

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
