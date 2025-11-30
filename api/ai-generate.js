export default async function handler(req, res) {
  // 1. Настройка доступов (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { prompt } = req.body;

  // 2. ФОРМИРУЕМ ЗАПРОС К POLLINATIONS (Бесплатно, Без ключей)
  // Мы используем модель 'openai' или 'mistral', Pollinations сам выберет доступную
  const url = 'https://text.pollinations.ai/';

  const systemInstruction = `
  You are a JSON API. You MUST return ONLY valid JSON.
  Response structure:
  {
    "shortTitle": "Russian Title (3-5 words)",
    "category": "Category Name",
    "variants": {
      "maleEn": "Prompt for male (English)",
      "maleRu": "Prompt for male (Russian)",
      "femaleEn": "Prompt for female (English)",
      "femaleRu": "Prompt for female (Russian)",
      "unisexEn": "Prompt (English)",
      "unisexRu": "Prompt (Russian)"
    }
  }
  Categories list: 'Портрет людей/персонажей', 'Предметы и Дизайн продуктов', 'Фоны и Окружение', 'Стили и улучшения', 'Другое'.
  IMPORTANT: Do not write \`\`\`json or markdown. Just the raw JSON object.
  `;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: `Create prompts for: ${prompt}` }
        ],
        model: 'openai', // Просим модель уровня GPT
        seed: Math.floor(Math.random() * 1000)
      })
    });

    if (!response.ok) {
      throw new Error(`Pollinations Error: ${response.status}`);
    }

    const text = await response.text();
    
    // 3. Чистим ответ (нейросети любят добавлять мусор)
    const cleanJson = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    // Проверяем, валидный ли JSON
    const data = JSON.parse(cleanJson);

    return res.status(200).json(data);

  } catch (error) {
    console.error("AI Error:", error);
    // Даже если ошибка, возвращаем структуру, чтобы приложение не зависло
    return res.status(200).json({
      shortTitle: "Ошибка AI",
      category: "Другое",
      variants: {
        maleEn: prompt, maleRu: prompt,
        femaleEn: prompt, femaleRu: prompt,
        unisexEn: prompt, unisexRu: prompt
      }
    });
  }
}
