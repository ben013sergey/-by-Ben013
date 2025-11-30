export default async function handler(req, res) {
  // Настройки доступа
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const TOKEN = process.env.YANDEX_DISK_TOKEN;
  if (!TOKEN) return res.status(500).json({ error: "Нет токена" });

  // ИСПРАВЛЕНИЕ ПУТИ: Убираем слеш в начале. 
  // Это скажет Яндексу: "Сохрани в папку этого приложения"
  const FILE_PATH = "database_prompts.json";

  try {
    // --- 1. ЗАПРОС НА СОХРАНЕНИЕ (Frontend просит ссылку) ---
    if (req.method === 'POST') {
      // Запрашиваем у Яндекса разрешение на загрузку
      const resp = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/upload?path=${FILE_PATH}&overwrite=true`, {
        headers: { 'Authorization': `OAuth ${TOKEN}` }
      });
      const data = await resp.json();
      return res.status(200).json(data); // Отдаем ссылку фронтенду
    }

    // --- 2. ЗАПРОС НА ЗАГРУЗКУ (Vercel качает сам) ---
    if (req.method === 'GET') {
      // А. Узнаем ссылку на скачивание
      const linkRes = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/download?path=${FILE_PATH}`, {
        headers: { 'Authorization': `OAuth ${TOKEN}` }
      });
      const linkData = await linkRes.json();

      if (linkData.error === "DiskNotFoundError") {
        return res.status(404).json({ error: "Файл еще не создан" });
      }

      // Б. СЕРВЕР VERCEL СКАЧИВАЕТ ФАЙЛ (Обход CORS)
      // Так как сервер в США, он скачает это мгновенно
      const fileRes = await fetch(linkData.href);
      const fileJson = await fileRes.json();

      // В. Отдаем чистый JSON вашему приложению
      return res.status(200).json(fileJson);
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
