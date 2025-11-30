// 1. АНАЛИЗ ТЕКСТА (Через DeepSeek)
export const analyzePrompt = async (promptText: string) => {
  try {
    const response = await fetch('/api/deepseek', {
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
    console.error("AI Analysis Error:", error);
    
    // ВАЖНО: Возвращаем полную структуру при ошибке
    // Чтобы кнопки RU/EN не ломались, дублируем текст во все поля
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

// Функция расчета размеров
const getDimensions = (ratio: string) => {
  switch (ratio) {
    case '16:9': return { w: 1280, h: 720 };
    case '9:16': return { w: 720, h: 1280 };
    case '4:3':  return { w: 1024, h: 768 };
    case '3:4':  return { w: 768, h: 1024 };
    case '21:9': return { w: 1280, h: 544 };
    case '1:1': 
    default:     return { w: 1024, h: 1024 };
  }
};

// 2. ГЕНЕРАЦИЯ КАРТИНКИ (Pollinations Flux - БЕЗ лишней магии)
export const generateNanoBananaImage = async (
  prompt: string, 
  refImage?: string | null, 
  aspectRatio: string = '1:1', 
  upscale: boolean = false
) => {
  try {
    // 1. Считаем точные размеры
    const { w, h } = getDimensions(aspectRatio);
    
    // 2. Случайное зерно
    const seed = Math.floor(Math.random() * 100000);
    
    // 3. Формируем промпт (Только то, что пришло из карточки, без "best quality")
    const encodedPrompt = encodeURIComponent(prompt);

    // 4. Формируем URL
    let imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=${w}&height=${h}&nologo=true&model=flux`;

    // Задержка для UI
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
