export default async function handler(req, res) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { prompt } = req.body;
  const API_KEY = process.env.OPENROUTER_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: "Нет ключа OpenRouter" });
  }

  // ВАШИ ИНСТРУКЦИИ (Сохранение лица, 6 вариантов, категории)
  const systemInstruction = `
  You are an expert prompt engineer. Analyze the user's prompt.
  
  Tasks:
  1. Categorize into exactly one of: 'Портрет людей/персонажей', 'Предметы и Дизайн продуктов', 'Фоны и Окружение', 'Стили и улучшения', 'Промпты с фото', 'Другое'.
  2. Create a short title in Russian (3-6 words).
  3. Create 6 variations of the prompt text. Preserving the structure, context and atmosphere of the original promt. 
     When changing the gender (male, female, unisex) description of a person, his clothes, accessories, 
     try to choose the appropriate one for the one described in the original promt text, but for the desired gender:
     - maleEn, femaleEn, unisexEn: For Image Generation (In English). 
     - maleRu, femaleRu, unisexRu: For User Reading (In Russian).
     


  
  CRITICAL RULE FOR FACE PRESERVATION:
  If the prompt involves a person/human/character, you MUST append exactly this string to the English variants (*En):
  "(сохраняй лицо человека на 100% точным по сравнению с загруженным изображением),(Не меняй черты лица)"
  
  If NO person is involved, do NOT add this string.
  Do NOT change the core meaning of the prompt.
  
  RESPONSE FORMAT (JSON ONLY):
  {
    "category": "String",
    "shortTitle": "String",
    "variants": {
      "maleEn": "Prompt (English) + Face Tag if needed",
      "maleRu": "Prompt (Russian)",
      "femaleEn": "Prompt (English) + Face Tag if needed",
      "femaleRu": "Prompt (Russian)",
      "unisexEn": "Prompt (English) + Face Tag if needed",
      "unisexRu": "Prompt (Russian)"
    }
  }
  `;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
        "HTTP-Referer": "https://vercel.app", // Требование OpenRouter
      },
      body: JSON.stringify({
        // Используем Qwen 2.5 72B Instruct (Мощная и часто бесплатная/дешевая)
        model: "qwen/qwen-2.5-72b-instruct",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || "OpenRouter Error");
    }

    if (!data.choices || !data.choices[0]) {
       throw new Error("Пустой ответ от нейросети");
    }

    const jsonContent = JSON.parse(data.choices[0].message.content);
    return res.status(200).json(jsonContent);

  } catch (error) {
    console.error("OpenRouter Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
