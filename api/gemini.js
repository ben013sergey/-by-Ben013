import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // Разрешаем CORS
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

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    // ИСПОЛЬЗУЕМ СТАНДАРТНУЮ МОДЕЛЬ 1.5 FLASH
    // Она работает 100% стабильно
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

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
    Верни ТОЛЬКО чистый JSON.
    `;

    const result = await model.generateContent([systemInstruction, `Промпт: ${prompt}`]);
    const response = result.response;
    const text = response.text();
    
    // Чистка JSON
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanJson);

    return res.status(200).json(data);

  } catch (error) {
    console.error("Server Error:", error);
    // Возвращаем текст ошибки, чтобы видеть в консоли
    return res.status(500).json({ error: error.message });
  }
}
