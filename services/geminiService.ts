// services/geminiService.ts

// 1. АНАЛИЗ ТЕКСТА (Оставляем без изменений)
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

// 2. ГЕНЕРАЦИЯ КАРТИНКИ
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

    // --- Pollinations ---
    if (provider === 'pollinations') {
        imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=${w}&height=${h}&nologo=true&model=flux`;
    }

    // --- HuggingFace ---
    else if (provider === 'huggingface') {
        const hqPrompt = encodeURIComponent(`${prompt}, hyperrealistic, 8k resolution, cinematic lighting, masterpiece`);
        imageUrl = `https://image.pollinations.ai/prompt/${hqPrompt}?seed=${seed}&width=${w}&height=${h}&nologo=true&model=flux-realism&enhance=true`;
    }

    // --- GOOGLE (GeminiGen - Async Polling) ---
    else if (provider === 'google') {
        // 1. Запускаем задачу
        const startResponse = await fetch('/api/googleImage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: prompt,
                aspectRatio: aspectRatio,
                image: refImage
            }),
        });

        if (!startResponse.ok) {
            const err = await startResponse.text();
            throw new Error(`Ошибка запуска GeminiGen: ${err}`);
        }

        const startData = await startResponse.json();

        // Если картинка готова сразу (бывает)
        if (startData.status === 'completed' && startData.url) {
            imageUrl = startData.url;
        } 
        // Если задача в очереди - начинаем ждать (Polling)
        else if (startData.status === 'queued' && startData.uuid) {
            const uuid = startData.uuid;
            let attempts = 0;
            const maxAttempts = 60; // Ждем максимум 2 минуты (60 * 2сек)

            while (attempts < maxAttempts) {
                // Ждем 2 секунды
                await new Promise(r => setTimeout(r, 2000));
                
                // Спрашиваем статус
                const statusRes = await fetch(`/api/checkGeminiStatus?uuid=${uuid}`);
                const statusData = await statusRes.json();

                console.log(`Polling GeminiGen (${attempts}/${maxAttempts}):`, statusData.status);

                if (statusData.status === 'completed' && statusData.url) {
                    imageUrl = statusData.url;
                    break; // Успех!
                }

                if (statusData.status === 'failed') {
                    throw new Error(`Ошибка генерации GeminiGen: ${statusData.error}`);
                }

                // Если processing - продолжаем цикл
                attempts++;
            }

            if (!imageUrl) {
                throw new Error("Тайм-аут: сервер GeminiGen обрабатывает запрос слишком долго.");
            }
        }
    }

    // Задержка для Pollinations
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
