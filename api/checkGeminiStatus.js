export default async function handler(req, res) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { uuid } = req.query;
  const API_KEY = process.env.GEMINIGEN_API_KEY;

  if (!API_KEY) return res.status(500).json({ error: "Нет ключа API" });
  if (!uuid) return res.status(400).json({ error: "Нет UUID" });

  const HISTORY_URL = "https://api.geminigen.ai/uapi/v1/histories";

  try {
    const response = await fetch(`${HISTORY_URL}?items_per_page=50&page=1`, {
      method: "GET",
      headers: { "x-api-key": API_KEY }
    });

    // 1. Сначала проверяем статус ответа
    if (!response.ok) {
        const errText = await response.text();
        console.error("GeminiGen History Error:", response.status, errText);
        // Возвращаем ошибку как JSON, чтобы фронтенд не падал
        return res.status(response.status).json({ 
            error: `Ошибка API истории: ${response.status}`, 
            details: errText 
        });
    }

    // 2. Аккуратно парсим JSON
    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        console.error("GeminiGen возвращает не JSON:", text);
        return res.status(500).json({ error: "Ответ API не является JSON", raw: text });
    }

    // 3. Проверяем структуру данных
    if (!data || !data.result || !Array.isArray(data.result)) {
        return res.status(200).json({ status: 'processing', note: 'Задача не найдена в списке (структура ответа отличается)' });
    }

    // 4. Ищем задачу
    const task = data.result.find(item => item.uuid === uuid);

    if (!task) {
      return res.status(200).json({ status: 'processing', note: 'Задача еще не появилась в истории' });
    }

    if (task.status === 2 && task.generate_result) {
      return res.status(200).json({ 
          status: 'completed', 
          url: task.generate_result 
      });
    }

    if (task.status > 2) {
      return res.status(200).json({ 
          status: 'failed', 
          error: task.error_message || "Ошибка генерации"
      });
    }

    return res.status(200).json({ status: 'processing' });

  } catch (error) {
    console.error("Critical Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
