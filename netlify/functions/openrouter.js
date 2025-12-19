export default async (req, context) => {
  // Настройка CORS заголовков
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  // 1. Обработка пре-запроса (OPTIONS)
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  // 2. Получение ключа (поддержка твоего названия VITE_)
  const API_KEY = process.env.VITE_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;

  if (!API_KEY) {
    return new Response(JSON.stringify({ error: "Нет ключа OpenRouter (проверьте Netlify Env)" }), { status: 500, headers });
  }

  try {
    // 3. Получение промпта от фронтенда
    const body = await req.json();
    const { prompt } = body;

    if (!prompt) {
        return new Response(JSON.stringify({ error: "Промпт не получен" }), { status: 400, headers });
    }

    // ВАШИ ИНСТРУКЦИИ (Точь-в-точь как было на Vercel)
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

    // 4. Запрос к OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
        "HTTP-Referer": "https://promptvault.netlify.app", // Актуализировали реферер
        "X-Title": "PromptVault"
      },
      body: JSON.stringify({
        model: "qwen/qwen-2.5-72b-instruct", // Твоя модель
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    // 5. Обработка ответа
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || "OpenRouter API Error");
    }

    if (!data.choices || !data.choices[0]) {
       throw new Error("Пустой ответ от нейросети");
    }

    // Парсим JSON, который вернула нейросеть
    const jsonContent = JSON.parse(data.choices[0].message.content);

    // Возвращаем результат фронтенду
    return new Response(JSON.stringify(jsonContent), { status: 200, headers });

  } catch (error) {
    console.error("OpenRouter Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
};
