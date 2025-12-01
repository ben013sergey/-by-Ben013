export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const TOKEN = process.env.YANDEX_DISK_TOKEN;
  if (!TOKEN) return res.status(500).json({ error: "Нет токена" });

  try {
    // --- 1. ЗАГРУЗКА (POST) ---
    if (req.method === 'POST') {
      const { filename, type } = req.body; 
      let targetPath = "/database_prompts.json"; 

      if (type === 'image' && filename) {
        targetPath = `/pv_images/${filename}`;
      } else if (filename) {
        targetPath = `/${filename}`; // Кастомное имя для базы пользователя
      }

      const resp = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/upload?path=${targetPath}&overwrite=true`, {
        headers: { 'Authorization': `OAuth ${TOKEN}` }
      });
      const data = await resp.json();
      return res.status(200).json(data);
    }

    // --- 2. УДАЛЕНИЕ (DELETE) ---
    if (req.method === 'DELETE') {
        const { path } = req.query;
        if (!path) return res.status(400).json({error: "No path"});

        const resp = await fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(path)}&permanently=true`, {
            method: 'DELETE',
            headers: { 'Authorization': `OAuth ${TOKEN}` }
        });
        
        if (resp.status === 204 || resp.status === 202) {
            return res.status(200).json({ success: true });
        } else {
            const err = await resp.json();
            return res.status(resp.status).json(err);
        }
    }

    // --- 3. ПОЛУЧЕНИЕ (GET) ---
    if (req.method === 'GET') {
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
