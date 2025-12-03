export default async function handler(req, res) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { uuid } = req.query;
  const API_KEY = process.env.GEMINIGEN_API_KEY;

  if (!API_KEY) return res.status(500).json({ error: "Нет ключа API" });
  if (!uuid) return res.status(400).json({ error: "Нет UUID задачи" });

  const HISTORY_URL = "https://api.geminigen.ai/uapi/v1/histories";

  try {
    // Запрашиваем последние 10 записей истории
    const response = await fetch(`${HISTORY_URL}?items_per_page=10&page=1`, {
      method: "GET",
      headers: { "x-api-key": API_KEY }
    });

    const data = await response.json();

    // Ищем нашу задачу
    const task = data.result?.find(item => item.uuid === uuid);

    if (!task) {
      // Если задачи нет в списке, возможно, она старая или ошибка ID. 
      // Пока скажем "ждите", вдруг она появится на следующей странице истории (редко).
      return res.status(200).json({ status: 'processing' });
    }

    // Статус 2 = Готово (Completed)
    if (task.status === 2 && task.generate_result) {
      return res.status(200).json({ 
          status: 'completed', 
          url: task.generate_result 
      });
    }

    // Статус > 2 = Ошибка (Failed)
    if (task.status > 2) {
      return res.status(200).json({ 
          status: 'failed', 
          error: task.error_message || "Ошибка генерации на стороне GeminiGen"
      });
    }

    // Любой другой статус = В процессе
    return res.status(200).json({ status: 'processing' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
