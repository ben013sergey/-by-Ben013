export default async function handler(req, res) {
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

  // ИСПОЛЬЗУЕМ КОНКРЕТНУЮ ВЕРСИЮ МОДЕЛИ (gemini-1.5-flash-001)
  // Если она не сработает, Google сам переключит на gemini-pro
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-001:generateContent?key=${API_KEY}`;

  const systemInstruction = `
  Ты эксперт по промптам. Верни JSON.
  Структура:
  {
    "shortTitle": "Название (RU)",
    "category": "Категория",
    "variants": {
      "maleEn": "Prompt for male (English)",
      "maleRu": "Промпт для парня (Russian)",
      "femaleEn": "Prompt for female (English)",
      "femaleRu": "Промпт для девушки (Russian)",
      "unisexEn": "General prompt (English)",
      "unisexRu": "Общий промпт (Russian)"
    }
  }
  Категории строго: 'Портрет людей/персонажей', 'Предметы и Дизайн продуктов', 'Фоны и Окружение', 'Стили и улучшения', 'Другое'.
  Верни ТОЛЬКО JSON.
  `;

  const requestBody = {
    contents: [{
      parts: [{ text: `${systemInstruction}\n\nЗапрос: ${prompt}` }]
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
