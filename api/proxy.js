// api/proxy.js
export default async function handler(req, res) {
  const { path } = req.query;
  const TOKEN = process.env.YANDEX_DISK_TOKEN;

  if (!path || !TOKEN) return res.status(400).send("No path or token");

  try {
    // 1. Получаем ссылку на скачивание от API Яндекса
    const linkRes = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(path)}`, {
      headers: { 'Authorization': `OAuth ${TOKEN}` }
    });

    if (!linkRes.ok) {
       // Логируем ошибку, чтобы видеть в Vercel Logs
       console.error(`Yandex Link Error: ${linkRes.status}`);
       return res.status(linkRes.status).send("Yandex API Error");
    }

    const linkData = await linkRes.json();
    if (!linkData.href) return res.status(404).send("File not found on Yandex");

    // 2. Скачиваем сам файл (картинку) по полученной ссылке
    const imageRes = await fetch(linkData.href);
    
    if (!imageRes.ok) {
       console.error(`Image Download Error: ${imageRes.status}`);
       return res.status(imageRes.status).send("Failed to fetch image");
    }
    
    // 3. Превращаем файл в Буфер (Самый надежный способ для Node.js)
    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. ГЛАВНОЕ: ЗАГОЛОВКИ КЭШИРОВАНИЯ
    // Это то, что спасет твой лимит.
    // s-maxage=86400 -> Vercel Edge (CDN) запомнит эту картинку на 24 часа.
    // Следующий запрос НЕ запустит эту функцию, а отдаст картинку из памяти Vercel.
    res.setHeader("Content-Type", imageRes.headers.get("content-type") || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400");
    
    // 5. Отдаем картинку
    res.send(buffer);

  } catch (e) {
    console.error("Critical Proxy Error:", e);
    res.status(500).send("Internal Proxy Error");
  }
}
