// services/telegramStorage.ts

const IS_TG = typeof window !== 'undefined' && 
              window.Telegram?.WebApp?.CloudStorage;

export const tgStorage = {
  // Получить значение (всегда возвращает строку или null)
  getItem: async (key: string): Promise<string | null> => {
    if (IS_TG) {
      return new Promise((resolve, reject) => {
        window.Telegram.WebApp.CloudStorage.getItem(key, (err, value) => {
          if (err) {
            console.error('CloudStorage Error:', err);
            reject(err);
          } else {
            resolve(value || null);
          }
        });
      });
    } else {
      // Фолбэк для браузера
      return Promise.resolve(localStorage.getItem(key));
    }
  },

  // Сохранить значение
  setItem: async (key: string, value: string): Promise<boolean> => {
    if (IS_TG) {
      return new Promise((resolve, reject) => {
        window.Telegram.WebApp.CloudStorage.setItem(key, value, (err, stored) => {
          if (err) {
            console.error('CloudStorage Set Error:', err);
            reject(err);
          } else {
            resolve(stored);
          }
        });
      });
    } else {
      // Фолбэк для браузера
      localStorage.setItem(key, value);
      return Promise.resolve(true);
    }
  },

  // Удалить значение (если понадобится)
  removeItem: async (key: string): Promise<boolean> => {
    if (IS_TG) {
        return new Promise((resolve, reject) => {
            window.Telegram.WebApp.CloudStorage.removeItem(key, (err, deleted) => {
                if(err) reject(err);
                else resolve(deleted);
            })
        })
    } else {
        localStorage.removeItem(key);
        return Promise.resolve(true);
    }
  }
};
