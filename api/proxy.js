// api/proxy.js
import { pipeline } from 'stream';
import { promisify } from 'util';

const streamPipeline = promisify(pipeline);

export default async function handler(req, res) {
  const { path } = req.query;
  const TOKEN = process.env.YANDEX_DISK_TOKEN;

  if (!path || !TOKEN) return res.status(400).send("No path or token");

  try {
    // 1. Получаем ссылку на скачивание
    const linkRes = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(path)}`, {
      headers: { 'Authorization': `OAuth ${TOKEN}` }
    });
    
    if (!linkRes.ok) return res.status(linkRes.status).send("Yandex API Error");
    
    const linkData = await linkRes.json();
    if (!linkData.href) return res.status(404).send("File not found");

    // 2. Скачиваем файл с Яндекса
    const imageRes = await fetch(linkData.href);
    if (!imageRes.ok) return res.status(imageRes.status).send("Image fetch error");

    // 3. МАГИЯ КЭШИРОВАНИЯ (Спасаем лимиты)
    // s-maxage=86400 -> Vercel Edge хранит картинку 24 часа.
    // stale-while-revalidate -> Если кэш устарел, Vercel покажет старую и тихо обновит её в фоне.
    res.setHeader('Content-Type', imageRes.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
    
    // Добавляем CORS, чтобы картинку можно было использовать в Canvas/редакторе
    res.setHeader('Access-Control-Allow-Origin', '*');

    // 4. Отдаем поток (Stream) вместо буфера
    // Это экономит память функции и работает быстрее
    if (!imageRes.body) return res.status(500).send("No body");
    
    // В Node.js среде fetch возвращает body как поток, который можно перенаправить
    // Используем streamPipeline для надежной передачи
    await streamPipeline(imageRes.body, res);

  } catch (e) {
    console.error("Proxy Error:", e);
    // Если заголовки еще не отправлены, шлем 500
    if (!res.headersSent) res.status(500).send("Internal Proxy Error");
  }
}
