export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { prompt, aspectRatio, image } = req.body;
  const API_KEY = process.env.GEMINIGEN_API_KEY;

  if (!API_KEY) return res.status(500).json({ error: "Нет ключа GEMINIGEN_API_KEY" });

  const URL = "https://api.geminigen.ai/uapi/v1/generate_image";

  const formData = new FormData();
  formData.append("prompt", prompt);
  
  // Оставляем пока imagen-pro, раз она прошла проверку на премиум
  formData.append("model", "imagen-pro"); 
  
  formData.append("aspect_ratio", aspectRatio || "1:1");
  formData.append("style", "Photorealistic");

  if (image) {
      try {
        const base64Data = image.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const blob = new Blob([buffer], { type: 'image/png' });
        formData.append("input_image", blob, "input.png");
      } catch (e) {
        console.error("Error processing image:", e);
      }
  }

  try {
    const response = await fetch(URL, {
      method: "POST",
      headers: { "x-api-key": API_KEY },
      body: formData,
    });

    // Читаем ответ
    const data = await response.json();
    
    // ЛОГИКА ОТЛАДКИ
    // Если ссылки нет, мы возвращаем ВЕСЬ ответ сервера клиенту, чтобы увидеть причину
    if (!data.generate_result) {
        console.error("GeminiGen Failed Response:", data);
        return res.status(500).json({ 
            error: "Ошибка генерации (нет ссылки)", 
            debug_response: data // <-- Вот это мы увидим в консоли
        });
    }

    return res.status(200).json({ url: data.generate_result });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
