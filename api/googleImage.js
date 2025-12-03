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
    const response = await fetch(URL, {
      method: "POST",
      headers: { "x-api-key": API_KEY },
      body: formData,
    });

    const data = await response.json();

    // Сразу возвращаем то, что ответил сервер (UUID или готовую ссылку)
    if (data.generate_result) {
        return res.status(200).json({ status: 'completed', url: data.generate_result });
    } else if (data.uuid) {
        return res.status(200).json({ status: 'queued', uuid: data.uuid });
    } else {
        throw new Error("GeminiGen не вернул UUID задачи: " + JSON.stringify(data));
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
