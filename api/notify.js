export default async function handler(req, res) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const BOT_TOKEN = process.env.TG_BOT_TOKEN;
  const ADMIN_ID = process.env.TG_ADMIN_ID;

  if (!BOT_TOKEN || !ADMIN_ID) {
    return res.status(500).json({ error: "Нет настроек Telegram" });
  }

  const { username, filename, count } = req.body;

  const message = `
🔔 <b>Новое сохранение от Гостя!</b>

👤 <b>Пользователь:</b> ${username}
📂 <b>Файл:</b> ${filename}
📝 <b>Новых промптов:</b> ${count} шт.

<i>Проверьте Яндекс.Диск (папка приложения).</i>
  `;

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });
    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
