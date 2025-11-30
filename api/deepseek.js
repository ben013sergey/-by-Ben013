export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { prompt } = req.body;
  const API_KEY = process.env.DEEPSEEK_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: "Нет ключа DeepSeek" });
  }

  // ИНСТРУКЦИЯ: 6 вариантов + Сохранение лица + Категории
  const systemInstruction = `
  You are an expert prompt engineer. Analyze the user's prompt.
  
  Tasks:
  1. Detect context and gender.
  2. Create a short title in Russian (3-6 words).
  3. Categorize into exactly one of: 'Портрет людей/персонажей', 'Предметы и Дизайн продуктов', 'Фоны и Окружение', 'Стили и улучшения', 'Промпты с фото', 'Другое'.
  4. Generate 6 variations:
     - maleEn, femaleEn, unisexEn: For Image Generation (In English).
     - maleRu, femaleRu, unisexRu: For User Reading (In Russian).
  
  CRITICAL RULE FOR FACE PRESERVATION:
  If the prompt involves a person/human/character, you MUST append exactly this string to the English variants (*En):
  "(сохраняй лицо человека на 100% точным по сравнению с загруженным изображением),(Не меняй черты лица)"
  
  RESPONSE FORMAT (JSON ONLY):
  {
    "category": "String",
    "shortTitle": "String",
    "variants": {
      "maleEn": "Prompt for male (English) + Face Tag if needed",
      "maleRu": "Промпт для парня (Russian translation)",
      "femaleEn": "Prompt for female (English) + Face Tag if needed",
      "femaleRu": "Промпт для девушки (Russian translation)",
      "unisexEn": "Prompt for unisex (English) + Face Tag if needed",
      "unisexRu": "Общий промпт (Russian translation)"
    }
  }
  `;

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "DeepSeek API Error");
    }

    const jsonContent = JSON.parse(data.choices[0].message.content);
    return res.status(200).json(jsonContent);

  } catch (error) {
    console.error("DeepSeek Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
