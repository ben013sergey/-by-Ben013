// Сохранение (С поддержкой имени файла)
// Если customFilename передан - сохранит в новый файл (для гостей)
// Если нет - перезапишет основной database_prompts.json (для админа)
export const saveToYandexDisk = async (data: any, customFilename?: string) => {
  try {
    const body = customFilename 
      ? JSON.stringify({ filename: customFilename }) 
      : JSON.stringify({}); 

    // 1. Просим ссылку у Vercel (передаем имя файла, если есть)
    const linkResponse = await fetch('/api/yandex', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body
    });
    
    const linkData = await linkResponse.json();

    if (!linkData.href) {
      throw new Error("Не удалось получить ссылку на загрузку");
    }

    // 2. Готовим данные (Blob)
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

// Загрузка (Всегда грузит основную базу database_prompts.json)
export const loadFromYandexDisk = async () => {
  try {
    const response = await fetch('/api/yandex', { method: 'GET' });
    
    if (response.status === 404) return null; // Файла нет (первый запуск)
    if (!response.ok) throw new Error("Ошибка загрузки");
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
