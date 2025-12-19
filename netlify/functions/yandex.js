export default async (req, context) => {
  const TOKEN = process.env.YANDEX_DISK_TOKEN;
  const FOLDER_PATH = "disk:/Apps/PromptVault/db"; // Проверь свой путь, если менял
  const DB_FILE_NAME = "prompts_v2.json";
  
  // CORS заголовки
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    // --- GET: Загрузка базы ---
    if (req.method === "GET") {
        const url = new URL(req.url);
        // Если передан параметр filename, грузим его, иначе стандартную базу
        const fileNameParam = url.searchParams.get('filename');
        const targetFile = fileNameParam || DB_FILE_NAME;

        const downloadUrlRes = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(`${FOLDER_PATH}/${targetFile}`)}`, {
            headers: { 'Authorization': `OAuth ${TOKEN}` }
        });

        if (downloadUrlRes.status === 404) {
            // Файла нет - возвращаем пустой массив
            return new Response(JSON.stringify([]), { status: 200, headers });
        }

        const downloadData = await downloadUrlRes.json();
        const fileRes = await fetch(downloadData.href);
        const jsonData = await fileRes.json();

        return new Response(JSON.stringify(jsonData), { status: 200, headers });
    }

    // --- POST: Сохранение или Загрузка картинки ---
    if (req.method === "POST") {
        const contentType = req.headers.get("content-type") || "";

        // 1. Загрузка картинки (FormData)
        if (contentType.includes("multipart/form-data")) {
            const formData = await req.formData();
            const file = formData.get("file");
            
            if (!file) return new Response("No file", { status: 400, headers });

            // Получаем URL для загрузки
            const uploadUrlRes = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/upload?path=${encodeURIComponent("/Apps/PromptVault/pv_images/" + file.name)}&overwrite=true`, {
                headers: { 'Authorization': `OAuth ${TOKEN}` }
            });
            const uploadData = await uploadUrlRes.json();

            // Загружаем байты
            await fetch(uploadData.href, {
                method: 'PUT',
                body: file
            });

            return new Response(JSON.stringify({ path: "/Apps/PromptVault/pv_images/" + file.name }), { status: 200, headers });
        }

        // 2. Сохранение JSON (обычный POST)
        const body = await req.json();
        
        // Определяем имя файла (основная база или предложка)
        const targetFileName = body.fileName || DB_FILE_NAME;
        const dataToSave = body.data || body; // Если структура {fileName, data} или просто массив

        // Получаем URL для загрузки (перезаписи) файла
        const uploadUrlRes = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/upload?path=${encodeURIComponent(`${FOLDER_PATH}/${targetFileName}`)}&overwrite=true`, {
             headers: { 'Authorization': `OAuth ${TOKEN}` }
        });
        const uploadData = await uploadUrlRes.json();

        // Отправляем JSON
        await fetch(uploadData.href, {
            method: 'PUT',
            body: JSON.stringify(dataToSave)
        });

        return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    }

    // --- DELETE: Удаление картинки ---
    if (req.method === "DELETE") {
        const url = new URL(req.url);
        const pathToDelete = url.searchParams.get('path');
        
        if (!pathToDelete) return new Response("No path", { status: 400, headers });

        await fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(pathToDelete)}&permanently=true`, {
            method: 'DELETE',
            headers: { 'Authorization': `OAuth ${TOKEN}` }
        });

        return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    }

  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.toString() }), { status: 500, headers });
  }

  return new Response("Method not allowed", { status: 405, headers });
};
