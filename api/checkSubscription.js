export default async function handler(req, res) {
  // Разрешаем запросы с вашего сайта
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { userId } = req.body;
  // Используем ваши названия переменных из скриншота
  const BOT_TOKEN = process.env.TG_BOT_TOKEN;
  const CHANNEL_ID = process.env.TG_CHANNEL_ID;

  if (!userId || !BOT_TOKEN || !CHANNEL_ID) {
    return res.status(400).json({ error: "Missing config or userId" });
  }

  try {
    // Спрашиваем у Телеграма: "Этот юзер есть в канале?"
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${userId}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.ok) {
      console.error("Telegram API Error:", data.description);
      // Если бот не админ или канал не найден, возвращаем ошибку, но можно временно пустить
      return res.status(500).json({ error: data.description });
    }

    const status = data.result.status;
    // Статусы, которые означают, что подписка есть
    const isSubscribed = ['creator', 'administrator', 'member', 'restricted'].includes(status);

    return res.status(200).json({ isSubscribed });

  } catch (error) {
    console.error("Subscription check error:", error);
    return res.status(500).json({ error: error.message });
  }
}
