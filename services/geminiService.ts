// 1. АНАЛИЗ ТЕКСТА (Через OpenRouter / Qwen)
export const analyzePrompt = async (promptText: string) => {
  try {
    const response = await fetch('/api/openrouter', {
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
    
    // Заглушка при ошибке
    return {
      shortTitle: "Без обработки",
      category: "Другое",
      variants: {
        maleEn: promptText, maleRu: promptText,
        femaleEn: promptText, femaleRu: promptText,
        unisexEn: promptText, unisexRu: promptText
      }
    };
  }
};

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

// 2. ГЕНЕРАЦИЯ КАРТИНКИ (Мульти-модельная)
export const generateNanoBananaImage = async (
  prompt: string, 
  refImage?: string | null, 
  aspectRatio: string = '1:1',
  provider: 'pollinations' | 'huggingface' = 'pollinations'
) => {
  try {
    const { w, h } = getDimensions(aspectRatio);
    const seed = Math.floor(Math.random() * 100000);

    // --- ВАРИАНТ 1: POLLINATIONS (Быстро) ---
    if (provider === 'pollinations') {
        const encodedPrompt = encodeURIComponent(prompt);
        let imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=${w}&height=${h}&nologo=true&model=flux`;
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { url: imageUrl, prompt: prompt, createdAt: Date.now() };
    }

    // --- ВАРИАНТ 2: HUGGING FACE (Качественно) ---
    if (provider === 'huggingface') {
        // Улучшаем промпт для HF, так как он "голый"
        const enhancedPrompt = `${prompt}, high quality, 8k, masterpiece, sharp focus, detailed texture`;
        
        const response = await fetch('/api/huggingface', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: enhancedPrompt,
                width: w,
                height: h
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "Ошибка HF");
        }

        const data = await response.json();
        return { url: data.url, prompt: prompt, createdAt: Date.now() };
    }

    throw new Error("Неизвестный провайдер");

  } catch (error) {
    console.error("Image Gen Error:", error);
    throw error;
  }
};
