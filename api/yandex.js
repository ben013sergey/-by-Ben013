export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const TOKEN = process.env.YANDEX_DISK_TOKEN;
  if (!TOKEN) {
    return res.status(500).json({ error: "Нет токена Яндекса" });
  }

  // ИСПРАВЛЕНИЕ: Убираем "app:/", используем просто корень
  const FILE_PATH = "/database_prompts.json";

  try {
    // --- 1. СОХРАНЕНИЕ (POST) ---
    if (req.method === 'POST') {
      const { content } = req.body;
      const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);

      // А. Получаем ссылку для загрузки
      const uploadUrlRes = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/upload?path=${FILE_PATH}&overwrite=true`, {
        headers: { 'Authorization': `OAuth ${TOKEN}` }
      });
      
      if (!uploadUrlRes.ok) {
          const err = await uploadUrlRes.json();
          throw new Error(`Ошибка получения ссылки: ${err.message}`);
      }
      
      const uploadUrlData = await uploadUrlRes.json();

      // Б. Загружаем файл
      const uploadRes = await fetch(uploadUrlData.href, {
        method: 'PUT',
        body: fileContent
        // Яндекс сам поймет тип, заголовки тут не обязательны, но body нужен
      });

      if (!uploadRes.ok) {
         throw new Error("Ошибка при записи файла: " + uploadRes.statusText);
      }

      return res.status(200).json({ status: "saved" });
    }

    // --- 2. ЗАГРУЗКА (GET) ---
    if (req.method === 'GET') {
      const downloadUrlRes = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/download?path=${FILE_PATH}`, {
        headers: { 'Authorization': `OAuth ${TOKEN}` }
      });
      const downloadUrlData = await downloadUrlRes.json();

      if (downloadUrlData.error === "DiskNotFoundError") {
        return res.status(404).json({ error: "Файл еще не создан" });
      }
      
      if (!downloadUrlRes.ok) {
         throw new Error(downloadUrlData.message || "Ошибка получения ссылки");
      }

      const fileRes = await fetch(downloadUrlData.href);
      const fileData = await fileRes.json();

      return res.status(200).json(fileData);
    }

  } catch (error) {
    console.error("Yandex Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
