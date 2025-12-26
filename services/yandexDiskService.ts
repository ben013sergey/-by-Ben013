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

// 5. УНИВЕРСАЛЬНОЕ СОХРАНЕНИЕ (База, Настройки, Избранное)
export const saveToYandexDisk = async (data: any, customFilename?: string) => {
  try {
    const body = customFilename 
      ? JSON.stringify({ filename: customFilename }) 
      : JSON.stringify({}); 

    // 1. Получаем ссылку на загрузку от нашего API
    const linkResponse = await fetch('/api/yandex', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body
    });
    
    const linkData = await linkResponse.json();
    if (!linkData.href) throw new Error("Не удалось получить ссылку");

    // 2. Формируем JSON и грузим напрямую в Яндекс
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    const uploadResponse = await fetch(linkData.href, { method: 'PUT', body: blob });
    if (!uploadResponse.ok) throw new Error("Ошибка загрузки JSON в Яндекс");

    return true;
  } catch (error) {
    console.error("Save error:", error);
    throw error;
  }
};

// 6. УНИВЕРСАЛЬНАЯ ЗАГРУЗКА
const fetchJsonFromYandex = async (filename?: string) => {
    let url = '/api/yandex';
    if (filename) url += `?filename=${filename}`;

    const response = await fetch(url, { method: 'GET' });
    
    // Если файла нет (404) - это нормально для первого запуска
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Ошибка API Яндекс при чтении");

    // Наш обновленный API (Шаг 1) теперь сам скачивает файл и отдает JSON
    return await response.json();
};

// --- СПЕЦИФИЧЕСКИЕ МЕТОДЫ (Обертки) ---

// Основная база промптов
export const loadFromYandexDisk = async () => {
  return await fetchJsonFromYandex(); 
};

// Избранное админа
export const loadFavoritesFile = async (): Promise<string[] | null> => {
  try {
    const data = await fetchJsonFromYandex('admin_favorites.json');
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error loading favs:", error);
    return [];
  }
};

export const saveFavoritesFile = async (favs: string[]) => {
  return await saveToYandexDisk(favs, 'admin_favorites.json');
};

// --- GLOBAL SETTINGS (НАСТРОЙКИ АДМИНА) ---

export interface GlobalSettings {
  isReadOnly: boolean;
  isPublicAccess: boolean;
}

export const loadSettingsFile = async (): Promise<GlobalSettings> => {
  try {
    const data = await fetchJsonFromYandex('settings.json');
    if (!data) return { isReadOnly: false, isPublicAccess: false };
    
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
  return await saveToYandexDisk(settings, 'settings.json');
};
