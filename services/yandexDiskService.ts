// Сохранение на Яндекс.Диск
export const saveToYandexDisk = async (data: any) => {
  try {
    const response = await fetch('/api/yandex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: data })
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Ошибка сохранения");
    }
    return true;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// Загрузка с Яндекс.Диска
export const loadFromYandexDisk = async () => {
  try {
    const response = await fetch('/api/yandex');
    
    if (response.status === 404) return null; // Файла нет (первый запуск)
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
