export default async function handler(req, res) {
  // Настройка CORS
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

  // ПРЯМОЙ URL К API GOOGLE (Без библиотек)
  // Используем самую стабильную версию 1.5 Flash
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

  const systemInstruction = `
  Ты эксперт по промптам. Твоя задача: вернуть валидный JSON.
  
  Структура ответа:
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
  
  Категории (выбери одну):
  - Портрет людей/персонажей
  - Предметы и Дизайн продуктов
  - Фоны и Окружение
  - Стили и улучшения
  - Другое

  ВАЖНО: Верни ТОЛЬКО JSON объект. Без markdown, без слова json.
  `;

  // Формируем тело запроса вручную
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

    // Достаем текст
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) throw new Error("Пустой ответ от нейросети");

    // Чистим JSON от мусора
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return res.status(200).json(JSON.parse(cleanJson));

  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
