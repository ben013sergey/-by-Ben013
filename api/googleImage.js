export default async function handler(req, res) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { prompt, aspectRatio, image } = req.body;
  
  // Берем ключ GeminiGen
  const API_KEY = process.env.GEMINIGEN_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: "Нет ключа GEMINIGEN_API_KEY в настройках" });
  }

  // GeminiGen API Endpoint
  const URL = "https://api.geminigen.ai/uapi/v1/generate";

  // Формируем описание соотношения сторон для добавления в промпт
  // (Так надежнее, если API вдруг не примет параметр aspect_ratio напрямую)
  let ratioText = "";
  switch (aspectRatio) {
      case "16:9": ratioText = "--ar 16:9"; break;
      case "9:16": ratioText = "--ar 9:16"; break;
      case "4:3":  ratioText = "--ar 4:3"; break;
      case "3:4":  ratioText = "--ar 3:4"; break;
      default:     ratioText = "--ar 1:1"; break;
  }

  // Собираем тело запроса согласно документации GeminiGen
  const requestBody = {
    type: "image",
    model: "imagen-flash", // Та самая модель Nano Banana
    prompt: `${prompt} ${ratioText}`, 
    aspect_ratio: aspectRatio || "1:1" // Попробуем передать и как параметр
  };

  // Если есть картинка (режим Image-to-Image)
  if (image) {
      // Обычно такие сервисы ожидают либо URL, либо Base64.
      // Попробуем передать как base64 в поле image
      requestBody.image = image; 
      // Добавим пометку в промпт, чтобы модель поняла задачу
      requestBody.prompt = `Enhance this image: ${prompt}`;
  }

  try {
    console.log("Sending request to GeminiGen...", JSON.stringify(requestBody).substring(0, 100));

    const response = await fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY // Важно: авторизация через этот заголовок
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("GeminiGen API Error:", errText);
      throw new Error(`GeminiGen Error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    console.log("GeminiGen Response:", JSON.stringify(data).substring(0, 200));

    // Логика разбора ответа зависит от того, что вернет GeminiGen.
    // Обычно это { url: "..." } или { data: [{ url: "..." }] }
    
    let finalUrl = null;

    // Вариант 1: Прямая ссылка в url
    if (data.url) finalUrl = data.url;
    // Вариант 2: Ссылка внутри data (как у OpenAI)
    else if (data.data && data.data[0] && data.data[0].url) finalUrl = data.data[0].url;
    // Вариант 3: Base64 внутри data
    else if (data.data && data.data[0] && data.data[0].b64_json) finalUrl = `data:image/png;base64,${data.data[0].b64_json}`;

    if (finalUrl) {
        return res.status(200).json({ url: finalUrl });
    } else {
        throw new Error("Не удалось найти картинку в ответе GeminiGen");
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
