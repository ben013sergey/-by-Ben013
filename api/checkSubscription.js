export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { userId } = req.body;
  const BOT_TOKEN = process.env.TG_BOT_TOKEN;
  const CHANNEL_ID = process.env.TG_CHANNEL_ID;
  const YANDEX_DISK_TOKEN = process.env.YANDEX_DISK_TOKEN;

  // 1. ПРОВЕРКА ГЛОБАЛЬНЫХ НАСТРОЕК (settings.json в корне)
  try {
    // Обращаемся к Яндекс Диску напрямую за файлом settings.json
    const settingsResponse = await fetch('https://cloud-api.yandex.net/v1/disk/resources/download?path=settings.json', {
      headers: { Authorization: `OAuth ${YANDEX_DISK_TOKEN}` }
    });

    if (settingsResponse.ok) {
      const linkData = await settingsResponse.json();
      const fileResponse = await fetch(linkData.href);
      const settings = await fileResponse.json();

      // ЕСЛИ ВКЛЮЧЕН ПУБЛИЧНЫЙ ДОСТУП - ПУСКАЕМ ВСЕХ (у кого есть userId или даже без него, если это веб)
      if (settings && settings.isPublicAccess === true) {
         // Возвращаем успех и статус подписки true
         return res.status(200).json({ isSubscribed: true });
      }
    }
  } catch (e) {
    // Если файла нет или ошибка — не страшно, идем к стандартной проверке
    console.log("Settings check skipped or failed (normal if file doesn't exist yet)");
  }

  // 2. СТАНДАРТНАЯ ПРОВЕРКА ПОДПИСКИ
  if (!userId || !BOT_TOKEN || !CHANNEL_ID) {
    return res.status(400).json({ error: "Missing config or userId" });
  }

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${userId}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.ok) {
      console.error("Telegram API Error:", data.description);
      return res.status(500).json({ error: data.description });
    }

    const status = data.result.status;
    const isSubscribed = ['creator', 'administrator', 'member', 'restricted'].includes(status);

    return res.status(200).json({ isSubscribed });

  } catch (error) {
    console.error("Subscription check error:", error);
    return res.status(500).json({ error: error.message });
  }
}
