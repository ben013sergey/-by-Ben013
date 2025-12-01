// api/proxy.js
export default async function handler(req, res) {
  const { path } = req.query;
  const TOKEN = process.env.YANDEX_DISK_TOKEN;

  if (!path || !TOKEN) return res.status(400).send("No path or token");

  try {
    // 1. Получаем ссылку на скачивание
    const linkRes = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(path)}`, {
      headers: { 'Authorization': `OAuth ${TOKEN}` }
    });
    const linkData = await linkRes.json();

    if (!linkData.href) return res.status(404).send("File not found on Yandex");

    // 2. Скачиваем сам файл
    const imageRes = await fetch(linkData.href);
    
    // 3. Передаем заголовки (тип файла, кэширование)
    res.setHeader("Content-Type", imageRes.headers.get("content-type"));
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable"); // Кэшируем надолго

    // 4. Отдаем поток данных (картинку) в браузер
    const buffer = await imageRes.arrayBuffer();
    res.send(Buffer.from(buffer));

  } catch (e) {
    console.error(e);
    res.status(500).send("Proxy error");
  }
}
