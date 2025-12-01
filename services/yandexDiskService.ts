// 1. Загрузка картинки
export const uploadImageToYandex = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop();
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
    
    const linkResponse = await fetch('/api/yandex', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: uniqueName, type: 'image' })
    });
    
    const linkData = await linkResponse.json();
    if (!linkData.href) throw new Error("Нет ссылки для загрузки картинки");
  
    await fetch(linkData.href, { method: 'PUT', body: file });
  
    return `/pv_images/${uniqueName}`; 
};

// 2. Генерация ссылки для отображения (ИСПОЛЬЗУЕМ ПРОКСИ)
export const getProxyImageUrl = (path: string): string => {
    // Просто возвращаем ссылку на наш прокси
    return `/api/proxy?path=${encodeURIComponent(path)}`;
};

// 3. Удаление картинки
export const deleteImageFromYandex = async (path: string) => {
    try {
        await fetch(`/api/yandex?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
    } catch (e) {
        console.error("Delete image error", e);
    }
};

// 4. Уведомление Админа (Телеграм)
export const notifyAdminNewPrompts = async (username: string, filename: string, count: number) => {
    try {
        await fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: username, filename, count })
        });
    } catch (e) {
        console.error("Notify error", e);
    }
};

// 5. Сохранение Базы
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
    if (!linkData.href) throw new Error("Не удалось получить ссылку");

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    const uploadResponse = await fetch(linkData.href, { method: 'PUT', body: blob });
    if (!uploadResponse.ok) throw new Error("Ошибка загрузки JSON");

    return true;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// Загрузка
export const loadFromYandexDisk = async () => {
  try {
    const response = await fetch('/api/yandex', { method: 'GET' });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Ошибка загрузки");
    return await response.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
};
