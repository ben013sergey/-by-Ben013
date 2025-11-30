// Сохранение (Прямая загрузка)
export const saveToYandexDisk = async (data: any) => {
  try {
    // 1. Получаем ссылку от Vercel
    const linkResponse = await fetch('/api/yandex', { method: 'POST' });
    const linkData = await linkResponse.json();

    if (!linkData.href) {
      throw new Error("Не удалось получить ссылку на загрузку");
    }

    // 2. Формируем данные (Blob)
    // Если data это уже объект промптов, превращаем в строку
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    // 3. Отправляем НАПРЯМУЮ в Яндекс (минуя Vercel)
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

// Загрузка (Прямое скачивание)
export const loadFromYandexDisk = async () => {
  try {
    // 1. Получаем ссылку
    const linkResponse = await fetch('/api/yandex', { method: 'GET' });
    
    if (linkResponse.status === 404) return null;
    
    const linkData = await linkResponse.json();
    
    // Если файла нет (ошибка DiskNotFoundError от Яндекса внутри JSON)
    if (linkData.error === "DiskNotFoundError") return null;
    if (!linkData.href) throw new Error("Файл не найден или ошибка доступа");

    // 2. Скачиваем НАПРЯМУЮ с Яндекса
    const fileResponse = await fetch(linkData.href);
    const data = await fileResponse.json();
    
    return data;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
