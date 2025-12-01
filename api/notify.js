export default async function handler(req, res) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const BOT_TOKEN = process.env.TG_BOT_TOKEN;
  const ADMIN_ID = process.env.TG_ADMIN_ID; // Убедитесь, что эта переменная есть в Vercel

  if (!BOT_TOKEN || !ADMIN_ID) {
    console.error("TG config missing");
    return res.status(500).json({ error: "Нет настроек Telegram" });
  }

  // ВАЖНО: yandexDiskService отправляет поле 'user', а не 'username'
  const { user, filename, count } = req.body;

  const message = `
🔔 <b>Новое сохранение от Гостя!</b>

👤 <b>Пользователь:</b> ${user || 'Аноним'}
📂 <b>Файл:</b> ${filename}
📝 <b>Новых промптов:</b> ${count} шт.

<i>Проверьте Яндекс.Диск (папка приложения).</i>
  `;

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });

    const tgData = await tgRes.json();
    
    if (!tgData.ok) {
        console.error("Telegram Error:", tgData);
        throw new Error(tgData.description);
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error("Notify handler error:", error);
    return res.status(500).json({ error: error.message });
  }
}
