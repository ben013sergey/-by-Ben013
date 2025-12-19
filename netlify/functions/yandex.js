export default async (req, context) => {
  // CORS заголовки (разрешаем запросы с любого сайта)
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  // Если это пре-запрос браузера (OPTIONS), отвечаем сразу "ОК"
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const TOKEN = process.env.YANDEX_DISK_TOKEN;
  if (!TOKEN) {
    return new Response(JSON.stringify({ error: "Нет токена (Netlify Env)" }), { status: 500, headers });
  }

  try {
    // --- 1. ЗАГРУЗКА (POST) ---
    // Получаем URL для загрузки файла (сам файл грузит фронтенд)
    if (req.method === 'POST') {
      const body = await req.json(); // В Netlify так получаем body
      const { filename, type } = body; 
      
      let targetPath = "/database_prompts.json"; 

      // Логика путей точь-в-точь как у тебя на Vercel
      if (type === 'image' && filename) {
        targetPath = `/pv_images/${filename}`;
      } else if (filename) {
        targetPath = `/${filename}`;
      }

      // Запрашиваем у Яндекса ссылку для загрузки
      const resp = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/upload?path=${encodeURIComponent(targetPath)}&overwrite=true`, {
        headers: { 'Authorization': `OAuth ${TOKEN}` }
      });
      const data = await resp.json();
      
      return new Response(JSON.stringify(data), { status: 200, headers });
    }

    // --- 2. УДАЛЕНИЕ (DELETE) ---
    if (req.method === 'DELETE') {
        const url = new URL(req.url);
        const path = url.searchParams.get('path'); // В Netlify так получаем query params

        if (!path) return new Response(JSON.stringify({error: "No path"}), { status: 400, headers });

        const resp = await fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(path)}&permanently=true`, {
            method: 'DELETE',
            headers: { 'Authorization': `OAuth ${TOKEN}` }
        });
        
        if (resp.status === 204 || resp.status === 202) {
            return new Response(JSON.stringify({ success: true }), { status: 200, headers });
        } else {
            const err = await resp.json();
            return new Response(JSON.stringify(err), { status: resp.status, headers });
        }
    }

    // --- 3. ПОЛУЧЕНИЕ (GET) ---
    // Скачиваем базу промптов
    if (req.method === 'GET') {
      const FILE_PATH = "/database_prompts.json";
      
      // 1. Получаем ссылку
      const linkRes = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(FILE_PATH)}`, {
        headers: { 'Authorization': `OAuth ${TOKEN}` }
      });
      const linkData = await linkRes.json();

      if (linkData.error === "DiskNotFoundError") {
        return new Response(JSON.stringify({ error: "Файл еще не создан" }), { status: 404, headers });
      }

      // 2. Скачиваем сам JSON
      const fileRes = await fetch(linkData.href);
      const fileJson = await fileRes.json();
      
      return new Response(JSON.stringify(fileJson), { status: 200, headers });
    }

    return new Response("Method not allowed", { status: 405, headers });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), { status: 500, headers });
  }
};
