import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. АНАЛИЗ ТЕКСТА (Через сервер Vercel)
export const analyzePrompt = async (promptText: string) => {
  try {
    const response = await fetch('/api/ai-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptText }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Server error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error("Gemini Error:", error);
    
    // ВАЖНО: Возвращаем правильную структуру при ошибке
    // Чтобы кнопки перевода и генерации не ломались
    return {
      shortTitle: "Без обработки",
      category: "Другое",
      variants: {
        maleEn: promptText,
        maleRu: promptText,
        femaleEn: promptText,
        femaleRu: promptText,
        unisexEn: promptText,
        unisexRu: promptText
      }
    };
  }
};

// 2. ГЕНЕРАЦИЯ КАРТИНКИ (Pollinations)
export const generateNanoBananaImage = async (prompt: string) => {
  try {
    const seed = Math.floor(Math.random() * 10000);
    const encodedPrompt = encodeURIComponent(prompt);
    // Добавляем model=flux для качества
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=1024&height=1024&nologo=true&model=flux`;

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
