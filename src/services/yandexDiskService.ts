export const saveToYandexDisk = async (data: any) => {
  try {
    const response = await fetch('/api/yandex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: data })
    });
    
    if (!response.ok) throw new Error("Ошибка сохранения");
    return true;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const loadFromYandexDisk = async () => {
  try {
    const response = await fetch('/api/yandex');
    
    if (response.status === 404) return null; // Файла нет (первый запуск)
    if (!response.ok) throw new Error("Ошибка загрузки");
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
