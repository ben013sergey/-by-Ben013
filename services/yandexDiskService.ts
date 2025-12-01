// 1. Загрузка картинки (Возвращает путь к файлу на Яндексе)
export const uploadImageToYandex = async (file: File): Promise<string> => {
    // Генерируем уникальное имя файла
    const ext = file.name.split('.').pop();
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
    
    // Просим ссылку для типа 'image'
    const linkResponse = await fetch('/api/yandex', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: uniqueName, type: 'image' })
    });
    
    const linkData = await linkResponse.json();
    if (!linkData.href) throw new Error("Нет ссылки для загрузки картинки");
  
    // Грузим файл
    await fetch(linkData.href, { method: 'PUT', body: file });
  
    return `/pv_images/${uniqueName}`; // Возвращаем путь
};

// 2. Получение прямой ссылки на картинку (для просмотра)
export const getImageUrlFromYandex = async (path: string): Promise<string | null> => {
    try {
        const res = await fetch(`/api/yandex?action=get_file_link&path=${encodeURIComponent(path)}`);
        const data = await res.json();
        return data.href || null;
    } catch (e) {
        console.error(e);
        return null;
    }
};

// 3. Сохранение Базы (Оставлено как было, только type не передаем)
export const saveToYandexDisk = async (data: any, customFilename?: string) => {
  try {
    const body = customFilename 
      ? JSON.stringify({ filename: customFilename }) 
      : JSON.stringify({}); 

    const linkResponse = await fetch('/api/yandex', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body
    });
    
    const linkData = await linkResponse.json();

    if (!linkData.href) {
      throw new Error("Не удалось получить ссылку на загрузку");
    }

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

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

// Загрузка Базы
export const loadFromYandexDisk = async () => {
  try {
    const response = await fetch('/api/yandex', { method: 'GET' });
    
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Ошибка загрузки");
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
