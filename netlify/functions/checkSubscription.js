export default async (req, context) => {
  // ИСПОЛЬЗУЕМ ТВОИ НАЗВАНИЯ ИЗ СКРИНШОТА
  const BOT_TOKEN = process.env.TG_BOT_TOKEN; 
  
  // Если переменная канала есть в настройках - берем её, иначе используем дефолтную
  const CHANNEL_ID = process.env.TG_CHANNEL_ID || "@ben013_promt_gallery";

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers });
  }

  try {
      const body = await req.json();
      const { userId } = body;

      if (!userId) return new Response(JSON.stringify({ isSubscribed: false }), { status: 400, headers });
      if (!BOT_TOKEN) return new Response(JSON.stringify({ error: "No Bot Token" }), { status: 500, headers });

      const url = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${userId}`;
      const tgRes = await fetch(url);
      const data = await tgRes.json();

      if (!data.ok) {
          console.log("TG Error:", data); // Логирование ошибки для отладки
          return new Response(JSON.stringify({ isSubscribed: false }), { status: 200, headers });
      }

      const status = data.result.status;
      const isSubscribed = ['creator', 'administrator', 'member'].includes(status);

      return new Response(JSON.stringify({ isSubscribed }), { status: 200, headers });

  } catch (e) {
      console.error(e);
      return new Response(JSON.stringify({ error: "Check failed" }), { status: 500, headers });
  }
};
