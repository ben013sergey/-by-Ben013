export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const TOKEN = process.env.YANDEX_DISK_TOKEN;
  if (!TOKEN) return res.status(500).json({ error: "Нет токена" });

  // Строгое имя файла для синхронизации
  const FILE_PATH = "/database_prompts.json";

  try {
    // 1. ЗАПРОС НА СОХРАНЕНИЕ (Получить URL для загрузки)
    if (req.method === 'POST') {
      const resp = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/upload?path=${FILE_PATH}&overwrite=true`, {
        headers: { 'Authorization': `OAuth ${TOKEN}` }
      });
      const data = await resp.json();
      return res.status(200).json(data); // Возвращаем ссылку { href: "..." }
    }

    // 2. ЗАПРОС НА ЗАГРУЗКУ (Получить URL для скачивания)
    if (req.method === 'GET') {
      const resp = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/download?path=${FILE_PATH}`, {
        headers: { 'Authorization': `OAuth ${TOKEN}` }
      });
      const data = await resp.json();
      return res.status(200).json(data); // Возвращаем ссылку { href: "..." }
    }

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
