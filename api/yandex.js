export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const TOKEN = process.env.YANDEX_DISK_TOKEN;
  if (!TOKEN) return res.status(500).json({ error: "Нет токена" });

  try {
    // --- 1. СОХРАНЕНИЕ (POST) ---
    if (req.method === 'POST') {
      // Получаем имя файла от сайта. Если не прислали - используем дефолтное (опасное)
      const { filename } = req.body; 
      const targetPath = filename ? `/${filename}` : "/database_prompts.json";

      // Запрашиваем разрешение на загрузку
      const resp = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/upload?path=${targetPath}&overwrite=true`, {
        headers: { 'Authorization': `OAuth ${TOKEN}` }
      });
      const data = await resp.json();
      return res.status(200).json(data);
    }

    // --- 2. ЗАГРУЗКА (GET) ---
    if (req.method === 'GET') {
      // Загружаем всегда ОСНОВНУЮ базу
      const FILE_PATH = "/database_prompts.json";
      
      const linkRes = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/download?path=${FILE_PATH}`, {
        headers: { 'Authorization': `OAuth ${TOKEN}` }
      });
      const linkData = await linkRes.json();

      if (linkData.error === "DiskNotFoundError") {
        return res.status(404).json({ error: "Файл еще не создан" });
      }

      const fileRes = await fetch(linkData.href);
      const fileJson = await fileRes.json();

      return res.status(200).json(fileJson);
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
