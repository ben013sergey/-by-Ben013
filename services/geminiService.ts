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
    
    // Заглушка
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

// 2. ГЕНЕРАЦИЯ КАРТИНКИ (Pollinations v2)
export const generateNanoBananaImage = async (
  prompt: string, 
  refImage?: string | null, 
  aspectRatio: string = '1:1',
  provider: 'pollinations' | 'huggingface' = 'pollinations'
) => {
  try {
    const { w, h } = getDimensions(aspectRatio);
    const seed = Math.floor(Math.random() * 100000);
    const encodedPrompt = encodeURIComponent(prompt);

    let imageUrl = "";

    // --- ВАРИАНТ 1: FAST (Быстро) ---
    if (provider === 'pollinations') {
        // Обычный Flux, быстро
        imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=${w}&height=${h}&nologo=true&model=flux`;
    }

    // --- ВАРИАНТ 2: HQ (Качественно) ---
    // Мы используем тот же Pollinations, но с параметром enhance=true и моделью flux-realism
    // Это дает качество лучше, чем HF Free Tier, и работает стабильнее
    if (provider === 'huggingface') {
        const hqPrompt = encodeURIComponent(`${prompt}, hyperrealistic, 8k resolution, cinematic lighting, sharp focus, masterpiece`);
        imageUrl = `https://image.pollinations.ai/prompt/${hqPrompt}?seed=${seed}&width=${w}&height=${h}&nologo=true&model=flux-realism&enhance=true`;
    }

    // Искусственная задержка для UI (чтобы пользователь понял, что процесс идет)
    await new Promise(resolve => setTimeout(resolve, 1500));

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
