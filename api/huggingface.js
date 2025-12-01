export default async function handler(req, res) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { prompt, width, height } = req.body;
  const TOKEN = process.env.HUGGINGFACE_TOKEN;

  if (!TOKEN) return res.status(500).json({ error: "Нет токена HF в настройках Vercel" });

  // Используем FLUX.1-dev (Лучшее качество на сегодня)
  const MODEL_URL = "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev";

  try {
    const response = await fetch(MODEL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        inputs: prompt,
        parameters: {
            width: width || 1024,
            height: height || 1024,
            num_inference_steps: 25, // Оптимально для Flux
            guidance_scale: 3.5
        }
      }),
    });

    if (!response.ok) {
       const err = await response.text();
       // HF иногда пишет "Model is loading", это нормально для бесплатных аккаунтов
       throw new Error(`HF Error: ${err}`);
    }

    // HF возвращает Blob (картинку), а не JSON
    const imageBlob = await response.blob();
    const arrayBuffer = await imageBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Конвертируем в base64, чтобы отдать фронтенду
    const base64Image = `data:image/jpeg;base64,${buffer.toString('base64')}`;

    return res.status(200).json({ url: base64Image });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
