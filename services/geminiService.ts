import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. Инициализация (Берет ключ из файла .env или настроек Vercel)
// Если ключа нет, выкинет ошибку в консоль
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.error("ОШИБКА: Не найден VITE_GEMINI_API_KEY. Проверьте файл .env или настройки Vercel.");
}

const genAI = new GoogleGenerativeAI(API_KEY || "DUMMY_KEY");

// 2. Функция анализа промпта
export const analyzePrompt = async (promptText: string) => {
  try {
    // Используем модель Gemini 1.5 Flash (она быстрая и дешевая/бесплатная)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Инструкция для нейросети (Системный промпт)
    const systemInstruction = `
    Ты помощник для анализа промптов для генерации изображений.
    Твоя задача: прочитать промпт пользователя и вернуть JSON объект.
    
    Структура ответа (JSON):
    {
      "shortTitle": "Короткое название (3-5 слов) на русском",
      "category": "Одна из категорий: 'Портрет', 'Пейзаж', 'Аниме', 'Реализм', 'Фантастика', 'Другое'",
      "variants": {
        "male": "Тот же промпт, но переделанный для парня (на английском)",
        "female": "Тот же промпт, но переделанный для девушки (на английском)",
        "unisex": "Оригинальный промпт переведенный на английский (если был на русском)"
      }
    }
    Верни ТОЛЬКО чистый JSON без markdown разметки.
    `;

    const result = await model.generateContent([systemInstruction, `Промпт пользователя: ${promptText}`]);
    const response = result.response;
    const text = response.text();

    // Очистка от лишних символов (иногда Gemini добавляет ```json ... ```)
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(cleanJson);

  } catch (error) {
    console.error("Ошибка при запросе к Gemini:", error);
    // Возвращаем заглушку, чтобы приложение не упало
    return {
      shortTitle: "Ошибка генерации",
      category: "Другое",
      variants: {
        male: promptText,
        female: promptText,
        unisex: promptText
      }
    };
  }
};
