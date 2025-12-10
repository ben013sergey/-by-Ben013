// api/proxy.js
export default async function handler(req, res) {
  const { path } = req.query;
  const TOKEN = process.env.YANDEX_DISK_TOKEN;

  if (!path || !TOKEN) return res.status(400).send("No path or token");

  try {
    // 1. Запрашиваем у Яндекса временную ссылку на файл
    // Это очень легкий запрос (байты), лимит не тратит.
    const linkRes = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(path)}`, {
      headers: { 'Authorization': `OAuth ${TOKEN}` }
    });

    if (!linkRes.ok) {
       // Если ошибка Яндекса (404 и т.д.)
       return res.status(linkRes.status).send("Yandex API Error");
    }

    const linkData = await linkRes.json();

    if (!linkData.href) return res.status(404).send("File not found on Yandex");

    // 2. НАСТРОЙКА КЭШИРОВАНИЯ (Экономим вызовы API)
    // s-maxage=3600 -> Vercel запомнит эту ссылку на 1 час и не будет дергать Яндекс.
    // Это экономит время выполнения функции.
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600');

    // 3. РЕДИРЕКТ (Спасение от лимитов)
    // Вместо res.send(buffer), мы отправляем юзера качать файл напрямую с Яндекса.
    // Трафик Vercel = 0.
    res.redirect(302, linkData.href);

  } catch (e) {
    console.error(e);
    res.status(500).send("Proxy error");
  }
}
