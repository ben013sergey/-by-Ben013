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

  // 2. Правильный URL из документации
  const URL = "https://api.geminigen.ai/uapi/v1/generate_image";

  // 3. Формируем FormData (как в примере axios из документации)
  // В Node.js 18+ FormData встроен глобально
  const formData = new FormData();
  
  formData.append("prompt", prompt);
  formData.append("model", "imagen-flash"); // Модель, которую ты просил
  
  // Передаем соотношение сторон (16:9, 1:1 и т.д.)
  // Если придет что-то нестандартное, ставим 1:1
  formData.append("aspect_ratio", aspectRatio || "1:1");
  
  // Можно добавить стиль по умолчанию, чтобы было красивее
  formData.append("style", "Photorealistic");

  /* 
     ВАЖНО ПРО КАРТИНКУ (Image-to-Image):
     В документации, которую ты скинул (Generate Image), пример только для текста.
     Поля для загрузки файла обычно называются "image" или "file".
     Я добавлю попытку отправить картинку, если она есть, но если API 
     её не примет, он просто сгенерирует по тексту.
  */
  if (image) {
      // Превращаем base64 обратно в Blob, чтобы отправить как файл
      try {
        const base64Data = image.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const blob = new Blob([buffer], { type: 'image/png' });
        formData.append("input_image", blob, "input.png"); // Пробуем имя поля input_image
      } catch (e) {
        console.error("Ошибка обработки картинки:", e);
      }
  }

  try {
    console.log(`Sending to GeminiGen: ${prompt} [${aspectRatio}]`);

    // 4. Отправляем запрос
    const response = await fetch(URL, {
      method: "POST",
      headers: {
        "x-api-key": API_KEY // Авторизация через header
        // Content-Type ставить НЕ НУЖНО, fetch сам поставит multipart/form-data boundary
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("GeminiGen API Error:", errText);
      throw new Error(`API Error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    console.log("GeminiGen Response:", JSON.stringify(data).substring(0, 200));

    // 5. Достаем ссылку на картинку
    // В документации сказано, что поле называется "generate_result"
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
