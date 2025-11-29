import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. Инициализация (Берет ключ из настроек Vercel)
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.error("ОШИБКА: Не найден VITE_GEMINI_API_KEY.");
}

const genAI = new GoogleGenerativeAI(API_KEY || "DUMMY_KEY");

// 2. Функция анализа промпта (для улучшения текста)
export const analyzePrompt = async (promptText: string) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemInstruction = `
    Ты помощник для анализа промптов. Верни JSON объект.
    Структура:
    {
      "shortTitle": "Короткое название (3-5 слов) на русском",
      "category": "Категория (Портрет, Пейзаж, Аниме, Реализм, Фантастика, Другое)",
      "variants": {
        "male": "Промпт для парня (en)",
        "female": "Промпт для девушки (en)",
        "unisex": "Общий промпт (en)"
      }
    }
    Верни ТОЛЬКО чистый JSON.
    `;

    const result = await model.generateContent([systemInstruction, `Промпт: ${promptText}`]);
    const response = result.response;
    const text = response.text();
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(cleanJson);

  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      shortTitle: "Ошибка генерации",
      category: "Другое",
      variants: { male: promptText, female: promptText, unisex: promptText }
    };
  }
};

// 3. Функция генерации картинки (которой не хватало!)
// Используем бесплатный API Pollinations, так как он не требует прокси
export const generateNanoBananaImage = async (prompt: string) => {
  try {
    // Генерируем случайное число, чтобы картинка не кешировалась
    const seed = Math.floor(Math.random() * 10000);
    const encodedPrompt = encodeURIComponent(prompt);
    
    // Формируем ссылку на картинку
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=1024&height=1024&nologo=true`;

    // Эмулируем задержку, как будто нейросеть думает
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      url: imageUrl,
      prompt: prompt,
      createdAt: Date.now()
    };
  } catch (error) {
    console.error("Image Gen Error:", error);
    throw error;
  }
};
