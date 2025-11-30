export default async function handler(req, res) {
  // Настройка доступов (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const TOKEN = process.env.YANDEX_DISK_TOKEN;
  if (!TOKEN) {
    return res.status(500).json({ error: "Нет токена Яндекса в настройках Vercel" });
  }

  // Путь к файлу внутри папки приложения
  const FILE_PATH = "app:/database_prompts.json";

  try {
    // --- 1. СОХРАНЕНИЕ (POST) ---
    if (req.method === 'POST') {
      const { content } = req.body;
      
      // Превращаем данные в красивый текст JSON
      // Важно: если content уже строка, не стрингифаем её второй раз
      const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);

      // А. Получаем ссылку для загрузки (Get Upload URL)
      const uploadUrlRes = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/upload?path=${FILE_PATH}&overwrite=true`, {
        headers: { 'Authorization': `OAuth ${TOKEN}` }
      });
      const uploadUrlData = await uploadUrlRes.json();
      
      // Если ошибка на этапе получения ссылки (например, папка не создалась или места нет)
      if (!uploadUrlData.href) {
         console.error("Yandex Upload URL Error:", uploadUrlData);
         throw new Error(uploadUrlData.message || "Не удалось получить ссылку для загрузки");
      }

      // Б. Загружаем файл по полученной ссылке (PUT)
      const uploadRes = await fetch(uploadUrlData.href, {
        method: 'PUT',
        body: fileContent
      });

      // Проверяем, что файл реально записался
      if (!uploadRes.ok) {
         throw new Error("Ошибка при записи файла: " + uploadRes.statusText);
      }

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
        return res.status(404).json({ error: "Файл еще не создан (База пуста)" });
      }
      
      if (!downloadUrlData.href) {
         throw new Error(downloadUrlData.message || "Ошибка получения ссылки на скачивание");
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
