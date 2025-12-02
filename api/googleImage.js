export default async function handler(req, res) {
  // 1. Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { prompt, aspectRatio, image } = req.body;
  const API_KEY = process.env.GEMINIGEN_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: "Нет ключа GEMINIGEN_API_KEY" });
  }

  // 2. URL API
  const URL = "https://api.geminigen.ai/uapi/v1/generate_image";

  // 3. Формируем FormData
  const formData = new FormData();
  
  formData.append("prompt", prompt);
  
  // === ИЗМЕНЕНИЕ: Пробуем модель imagen-pro ===
  formData.append("model", "imagen-pro"); 
  // ============================================
  
  formData.append("aspect_ratio", aspectRatio || "1:1");
  formData.append("style", "Photorealistic");

  // Обработка картинки для Image-to-Image (если загружена)
  if (image) {
      try {
        const base64Data = image.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const blob = new Blob([buffer], { type: 'image/png' });
        formData.append("input_image", blob, "input.png");
      } catch (e) {
        console.error("Ошибка обработки картинки:", e);
      }
  }

  try {
    console.log(`Sending to GeminiGen (imagen-pro): ${prompt.substring(0, 50)}...`);

    // 4. Отправляем запрос
    const response = await fetch(URL, {
      method: "POST",
      headers: {
        "x-api-key": API_KEY 
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("GeminiGen API Error:", errText);
      throw new Error(`API Error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    
    // 5. Достаем ссылку
    const imageUrl = data.generate_result;

    if (imageUrl) {
        return res.status(200).json({ url: imageUrl });
    } else {
        throw new Error("API не вернул ссылку в поле generate_result");
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
