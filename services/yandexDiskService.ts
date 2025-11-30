// Сохранение (Прямая загрузка - чтобы не было лимитов на размер)
export const saveToYandexDisk = async (data: any) => {
  try {
    // 1. Просим ссылку у Vercel
    const linkResponse = await fetch('/api/yandex', { method: 'POST' });
    const linkData = await linkResponse.json();

    if (!linkData.href) {
      throw new Error("Не удалось получить ссылку на загрузку");
    }

    // 2. Готовим данные
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    // 3. Отправляем НАПРЯМУЮ в Яндекс (PUT)
    const uploadResponse = await fetch(linkData.href, {
      method: 'PUT',
      body: blob
    });

    if (!uploadResponse.ok) {
      throw new Error("Ошибка при прямой загрузке в Яндекс");
    }

    return true;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// Загрузка (Через Прокси Vercel - чтобы не было ошибки CORS)
export const loadFromYandexDisk = async () => {
  try {
    // Просто просим наш сервер: "Дай мне базу"
    // Сервер сам сходит в Яндекс и вернет JSON
    const response = await fetch('/api/yandex', { method: 'GET' });
    
    if (response.status === 404) return null; // Файла нет
    
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Ошибка загрузки");
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
