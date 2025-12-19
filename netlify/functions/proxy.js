export default async (req, context) => {
  // Парсим параметры из URL
  const url = new URL(req.url);
  const path = url.searchParams.get('path');
  const TOKEN = process.env.YANDEX_DISK_TOKEN;

  if (!path || !TOKEN) {
    return new Response("No path or token", { status: 400 });
  }

  try {
    // 1. Получаем ссылку от Яндекса
    const linkRes = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(path)}`, {
      headers: { 'Authorization': `OAuth ${TOKEN}` }
    });

    if (!linkRes.ok) {
       return new Response("Yandex API Error", { status: linkRes.status });
    }

    const linkData = await linkRes.json();
    if (!linkData.href) return new Response("File not found", { status: 404 });

    // 2. Скачиваем картинку
    const imageRes = await fetch(linkData.href);
    
    // 3. Формируем заголовки кэширования (КРИТИЧНО)
    const headers = new Headers(imageRes.headers);
    headers.set("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400");
    headers.set("Access-Control-Allow-Origin", "*");

    // 4. Отдаем ответ
    return new Response(imageRes.body, {
      status: imageRes.status,
      headers: headers
    });

  } catch (e) {
    console.error(e);
    return new Response("Proxy Error", { status: 500 });
  }
};
