import { GoogleGenerativeAI } from "@google/generative-ai";

// Ключ нужен только для генерации картинки (она работает через Pollinations, там ключ не важен)
// Но для анализа текста мы теперь идем через НАШ СЕРВЕР

// --- ФУНКЦИЯ 1: АНАЛИЗ ТЕКСТА (Через сервер Vercel) ---
export const analyzePrompt = async (promptText: string) => {
  try {
    console.log("Отправляем запрос на сервер Vercel...");
    
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: promptText }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ошибка сервера: ${response.status} ${errText}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error("Gemini Error:", error);
    // Возвращаем заглушку, чтобы интерфейс не завис
    return {
      shortTitle: "Ошибка соединения",
      category: "Другое",
      variants: {
        male: promptText,
        female: promptText,
        unisex: promptText
      }
    };
  }
};

// --- ФУНКЦИЯ 2: ГЕНЕРАЦИЯ КАРТИНКИ (Бесплатно через Pollinations) ---
export const generateNanoBananaImage = async (prompt: string) => {
  try {
    const seed = Math.floor(Math.random() * 10000);
    // Используем модель Flux, она лучше понимает промпты
    const encodedPrompt = encodeURIComponent(prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=1024&height=1024&nologo=true&model=flux`;

    // Небольшая задержка для красоты
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
