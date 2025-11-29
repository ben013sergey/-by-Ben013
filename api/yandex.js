export default async function handler(req, res) {
  // Разрешаем запросы
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const TOKEN = process.env.YANDEX_DISK_TOKEN;
  if (!TOKEN) return res.status(500).json({ error: "Нет токена Яндекса" });

  const FILE_PATH = "app:/database_prompts.json"; // Файл будет лежать в папке Приложения

  try {
    // --- 1. СОХРАНЕНИЕ (POST) ---
    if (req.method === 'POST') {
      const { content } = req.body;
      
      // А. Получаем ссылку для загрузки
      const uploadUrlRes = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/upload?path=${FILE_PATH}&overwrite=true`, {
        headers: { 'Authorization': `OAuth ${TOKEN}` }
      });
      const uploadUrlData = await uploadUrlRes.json();
      
      if (!uploadUrlData.href) throw new Error("Не удалось получить ссылку для загрузки");

      // Б. Загружаем файл по этой ссылке
      await fetch(uploadUrlData.href, {
        method: 'PUT',
        body: JSON.stringify(content)
      });

      return res.status(200).json({ status: "saved" });
    }

    // --- 2. ЗАГРУЗКА (GET) ---
    if (req.method === 'GET') {
      // А. Получаем ссылку для скачивания
      const downloadUrlRes = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/download?path=${FILE_PATH}`, {
        headers: { 'Authorization': `OAuth ${TOKEN}` }
      });
      const downloadUrlData = await downloadUrlRes.json();

      if (downloadUrlData.error === "DiskNotFoundError") {
        return res.status(404).json({ error: "Файл еще не создан" });
      }

      // Б. Скачиваем сам файл
      const fileRes = await fetch(downloadUrlData.href);
      const fileData = await fileRes.json();

      return res.status(200).json(fileData);
    }

  } catch (error) {
    console.error("Yandex Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
