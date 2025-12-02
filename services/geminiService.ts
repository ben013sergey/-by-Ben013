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

// 2. ГЕНЕРАЦИЯ КАРТИНКИ (Pollinations v2 / HuggingFace / Google)
export const generateNanoBananaImage = async (
  prompt: string, 
  refImage?: string | null, 
  aspectRatio: string = '1:1',
  provider: 'pollinations' | 'huggingface' | 'google' = 'pollinations'
) => {
  try {
    const { w, h } = getDimensions(aspectRatio);
    const seed = Math.floor(Math.random() * 100000);
    const encodedPrompt = encodeURIComponent(prompt);

    let imageUrl = "";

    // --- ВАРИАНТ 1: FAST (Pollinations - Flux) ---
    if (provider === 'pollinations') {
        let url = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=${w}&height=${h}&nologo=true&model=flux`;
        // Если есть референс, Pollinations тоже умеет его принимать (но работает нестабильно, поэтому можно пока не передавать или добавить &image=...)
        if (refImage) {
            // Pollinations требует URL картинки, а у нас base64. 
            // Поэтому для Pollinations референс пока пропускаем или используем только для Google.
        }
        imageUrl = url;
    }

    // --- ВАРИАНТ 2: HQ (Pollinations - Flux Realism) ---
    else if (provider === 'huggingface') {
        const hqPrompt = encodeURIComponent(`${prompt}, hyperrealistic, 8k resolution, cinematic lighting, sharp focus, masterpiece`);
        imageUrl = `https://image.pollinations.ai/prompt/${hqPrompt}?seed=${seed}&width=${w}&height=${h}&nologo=true&model=flux-realism&enhance=true`;
    }

    // --- ВАРИАНТ 3: GOOGLE (Nano Banana / Gemini 2.5 Flash Image) ---
    else if (provider === 'google') {
        // Отправляем запрос на наш API
        const response = await fetch('/api/googleImage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: prompt,
                aspectRatio: aspectRatio,
                image: refImage // <-- ВАЖНО: Передаем картинку, если она есть
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Ошибка Google: ${err}`);
        }

        const data = await response.json();
        imageUrl = data.url; // Google сразу возвращает Base64
    }

    // Искусственная задержка только для Pollinations
    if (provider !== 'google') {
        await new Promise(resolve => setTimeout(resolve, 1500));
    }

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
