export default async function handler(req, res) {
  // 1. Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { prompt, aspectRatio, image } = req.body;
  const API_KEY = process.env.GEMINIGEN_API_KEY;

  if (!API_KEY) return res.status(500).json({ error: "Нет ключа GEMINIGEN_API_KEY" });

  // URLs
  const GENERATE_URL = "https://api.geminigen.ai/uapi/v1/generate_image";
  const HISTORY_URL = "https://api.geminigen.ai/uapi/v1/histories";

  // --- ЭТАП 1: ЗАПУСК ГЕНЕРАЦИИ ---
  const formData = new FormData();
  formData.append("prompt", prompt);
  formData.append("model", "imagen-pro"); // Твоя модель
  formData.append("aspect_ratio", aspectRatio || "1:1");
  formData.append("style", "Photorealistic");

  if (image) {
      try {
        const base64Data = image.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const blob = new Blob([buffer], { type: 'image/png' });
        formData.append("input_image", blob, "input.png");
      } catch (e) {
        console.error("Image error:", e);
      }
  }

  try {
    // Отправляем запрос на создание
    const initResponse = await fetch(GENERATE_URL, {
      method: "POST",
      headers: { "x-api-key": API_KEY },
      body: formData,
    });

    const initData = await initResponse.json();

    // Если сразу вернул ссылку (бывает редко)
    if (initData.generate_result) {
        return res.status(200).json({ url: initData.generate_result });
    }

    // Если вернул UUID (задача в очереди), начинаем ждать
    const taskUuid = initData.uuid;
    if (!taskUuid) {
        console.error("GeminiGen Init Error:", initData);
        throw new Error("Не удалось запустить генерацию (нет uuid)");
    }

    // --- ЭТАП 2: ОЖИДАНИЕ РЕЗУЛЬТАТА (Polling) ---
    // Будем проверять статус каждые 2 секунды (максимум 10 раз)
    const MAX_ATTEMPTS = 15; 
    let attempts = 0;
    let finalImageUrl = null;

    while (attempts < MAX_ATTEMPTS) {
        attempts++;
        
        // Ждем 2 секунды
        await new Promise(r => setTimeout(r, 2000));

        // Запрашиваем историю (последние 5 записей)
        const historyResponse = await fetch(`${HISTORY_URL}?items_per_page=5&page=1`, {
            method: "GET",
            headers: { "x-api-key": API_KEY }
        });

        const historyData = await historyResponse.json();
        
        // Ищем нашу задачу по UUID в списке
        if (historyData.result && Array.isArray(historyData.result)) {
            const myTask = historyData.result.find(item => item.uuid === taskUuid);

            if (myTask) {
                console.log(`Check #${attempts}: Status ${myTask.status} (${myTask.status_desc})`);
                
                // Статус 2 = completed (из документации)
                if (myTask.status === 2 && myTask.generate_result) {
                    finalImageUrl = myTask.generate_result;
                    break; // Ура, готово! Выходим из цикла
                }
                
                // Статус 3 или 4 = ошибка (обычно)
                if (myTask.status > 2) {
                    throw new Error(`Ошибка генерации: ${myTask.error_message || 'Неизвестная ошибка'}`);
                }
            }
        }
    }

    if (finalImageUrl) {
        return res.status(200).json({ url: finalImageUrl });
    } else {
        throw new Error("Тайм-аут: картинка генерируется слишком долго. Попробуйте позже.");
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
