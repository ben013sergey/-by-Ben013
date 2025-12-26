// 1. Загрузка картинки
export const uploadImageToYandex = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop();
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
    
    // Получаем ссылку для загрузки
    const linkResponse = await fetch('/api/yandex', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: uniqueName, type: 'image' })
    });
    
    const linkData = await linkResponse.json();
    if (!linkData.href) throw new Error("Нет ссылки для загрузки картинки");
  
    // Грузим файл по ссылке Яндекса
    await fetch(linkData.href, { method: 'PUT', body: file });
  
    return `/pv_images/${uniqueName}`; 
};

// 2. Генерация ссылки для отображения (ИСПОЛЬЗУЕМ ПРОКСИ)
export const getProxyImageUrl = (path: string | null): string => {
  if (!path) return '';
  // Добавляем &v=fix1, чтобы сбросить старый кэш Vercel и браузера
  return `/api/proxy?path=${encodeURIComponent(path)}&v=fix1`;
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

    // 1. Получаем ссылку
    const linkResponse = await fetch('/api/yandex', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body
    });
    
    const linkData = await linkResponse.json();
    if (!linkData.href) throw new Error("Не удалось получить ссылку");

    // 2. Формируем JSON и грузим
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

// Загрузка Базы
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

// --- FAVORITES (ИЗБРАННОЕ) ---

export const loadFavoritesFile = async (): Promise<string[] | null> => {
  try {
    const response = await fetch(`/api/yandex?filename=admin_favorites.json`, {
      method: 'GET',
    });

    if (response.status === 404) return []; 
    if (!response.ok) throw new Error('Ошибка загрузки избранного');

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error loading admin favorites:", error);
    return null;
  }
};

export const saveFavoritesFile = async (favs: string[]) => {
  // Используем логику saveToYandexDisk для надежности
  const jsonString = JSON.stringify(favs, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });

  try {
      const linkResponse = await fetch('/api/yandex', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'admin_favorites.json' })
      });
      const linkData = await linkResponse.json();
      if (linkData.href) {
          await fetch(linkData.href, { method: 'PUT', body: blob });
      }
  } catch (error) {
    console.error("Error saving admin favorites:", error);
  }
};

// --- GLOBAL SETTINGS (НАСТРОЙКИ АДМИНА) ---

export interface GlobalSettings {
  isReadOnly: boolean;
  isPublicAccess: boolean;
}

export const loadSettingsFile = async (): Promise<GlobalSettings> => {
  try {
    // Читаем settings.json из корня
    const response = await fetch(`/api/yandex?filename=settings.json`, { method: 'GET' });
    
    if (response.status === 404) {
        return { isReadOnly: false, isPublicAccess: false };
    }
    
    if (!response.ok) throw new Error('Ошибка загрузки настроек');
    
    const data = await response.json();
    return {
        isReadOnly: data.isReadOnly ?? false,
        isPublicAccess: data.isPublicAccess ?? false
    };
  } catch (error) {
    console.error("Error loading settings:", error);
    return { isReadOnly: false, isPublicAccess: false };
  }
};

export const saveSettingsFile = async (settings: GlobalSettings) => {
  // Используем надежный метод (Get Link -> PUT Blob)
  const jsonString = JSON.stringify(settings, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });

  try {
    // 1. Просим ссылку для settings.json
    const linkResponse = await fetch('/api/yandex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'settings.json' }),
    });

    const linkData = await linkResponse.json();
    if (!linkData.href) throw new Error("Не удалось получить ссылку для настроек");

    // 2. Загружаем файл
    await fetch(linkData.href, { method: 'PUT', body: blob });
    
    console.log("Settings saved successfully");
  } catch (error) {
    console.error("Error saving settings:", error);
    throw error;
  }
};
