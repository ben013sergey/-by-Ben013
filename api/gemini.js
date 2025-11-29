import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // 1. Разрешаем браузеру обращаться к этому файлу (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Если это предварительный запрос проверки - отвечаем ОК
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Получаем промпт от сайта
  const { prompt } = req.body;
  
  // Берем ключ. На сервере Vercel он видит переменную, даже если она VITE_
  const API_KEY = process.env.VITE_GEMINI_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: "API Key не найден на сервере" });
  }

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    // ИСПОЛЬЗУЕМ САМУЮ НОВУЮ МОДЕЛЬ
    // Если она вдруг не сработает, поменяйте на "gemini-1.5-flash"
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const systemInstruction = `
    Ты помощник для анализа промптов.
    Твоя задача: прочитать промпт и вернуть JSON.
    Структура ответа:
    {
      "shortTitle": "Название (3-5 слов, RU)",
      "category": "Категория (из списка: Портрет, Пейзаж, Аниме, Реализм, Фантастика, Другое)",
      "variants": {
        "male": "Промпт для парня (EN)",
        "female": "Промпт для девушки (EN)",
        "unisex": "Общий промпт (EN)"
      }
    }
    Верни ТОЛЬКО чистый JSON без markdown.
    `;

    const result = await model.generateContent([systemInstruction, `Промпт пользователя: ${prompt}`]);
    const response = result.response;
    const text = response.text();

    // Чистим ответ от лишних символов
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Проверяем, что это валидный JSON
    const data = JSON.parse(cleanJson);

    // Отправляем ответ обратно на сайт
    return res.status(200).json(data);

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: error.message, details: "Ошибка на сервере Vercel" });
  }
}
