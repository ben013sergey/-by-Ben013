export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { userId } = req.body;
  const BOT_TOKEN = process.env.TG_BOT_TOKEN;
  const CHANNEL_ID = process.env.TG_CHANNEL_ID;

  if (!userId || !BOT_TOKEN || !CHANNEL_ID) {
    return res.status(400).json({ error: "Missing data" });
  }

  try {
    // Спрашиваем у Телеграма статус пользователя в чате
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${userId}`);
    const data = await response.json();

    if (!data.ok) {
      // Если бот не админ или канала не существует
      console.error("TG Error:", data);
      return res.status(200).json({ isSubscribed: false, error: "Bot error" });
    }

    const status = data.result.status;
    // Статусы, которые считаются "Подписан"
    const allowedStatuses = ['creator', 'administrator', 'member', 'restricted'];

    const isSubscribed = allowedStatuses.includes(status);

    return res.status(200).json({ isSubscribed });

  } catch (error) {
    console.error("Check Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
