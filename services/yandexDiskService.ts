// services/yandexDiskService.ts

const CLIENT_ID = '82011a908efb412092984409dfc1a445';
const CLIENT_SECRET = '59b67dbaaba74acbada97839befb28e2';
const REDIRECT_URI = window.location.origin; // Автоматическое определение домена
const API_BASE = 'https://cloud-api.yandex.net/v1/disk';
const FILE_PATH = '/prompts_vault.json';

export class YandexDiskService {
  private accessToken: string | null = null;
  private isAuthenticated = false;

  constructor() {
    this.checkAuthorizationCode();
    this.restoreToken();
  }

  // Проверяем код авторизации в URL
  private checkAuthorizationCode() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    
    if (code) {
      console.log('🔑 Получен код авторизации');
      this.exchangeCodeForToken(code);
      // Очищаем URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // Восстанавливаем токен из localStorage
  private restoreToken() {
    const savedToken = localStorage.getItem('yandex_access_token');
    if (savedToken) {
      this.accessToken = savedToken;
      this.isAuthenticated = true;
      console.log('✅ Яндекс.Диск: токен восстановлен');
    }
  }

  // Генерируем URL для входа
  getLoginUrl() {
    return `https://oauth.yandex.ru/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  }

  // Обмениваем код на токен
  private async exchangeCodeForToken(code: string) {
    try {
      console.log('🔄 Обмениваем код на токен...');
      
      const response = await fetch('https://oauth.yandex.ru/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        }).toString(),
      });

      const data = await response.json();
      
      if (data.access_token) {
        this.accessToken = data.access_token;
        this.isAuthenticated = true;
        localStorage.setItem('yandex_access_token', this.accessToken);
        console.log('✅ Яндекс.Диск: авторизация успешна');
        window.location.href = window.location.pathname;
      } else {
        console.error('❌ Ошибка при получении токена:', data);
      }
    } catch (err) {
      console.error('❌ Ошибка обмена кода:', err);
    }
  }

  // Быстрый вход (перенаправляет на Яндекс)
  signIn() {
    window.location.href = this.getLoginUrl();
  }

  // Загрузить промпты с Яндекс.Диска
  async loadFromDisk(): Promise<any[]> {
    if (!this.accessToken || !this.isAuthenticated) {
      console.warn('⚠️ Яндекс.Диск: не авторизован');
      return [];
    }

    try {
      console.log('📥 Загружаем с Яндекс.Диска...');
      
      // Получаем ссылку для скачивания
      const downloadResponse = await fetch(
        `${API_BASE}/resources/download?path=${encodeURIComponent(FILE_PATH)}`,
        {
          headers: {
            'Authorization': `OAuth ${this.accessToken}`,
          },
        }
      );

      if (!downloadResponse.ok) {
        console.log('⚠️ Файл на Диске не найден');
        return [];
      }

      const downloadData = await downloadResponse.json();
      const downloadUrl = downloadData.href;

      // Скачиваем файл
      const fileResponse = await fetch(downloadUrl);
      if (!fileResponse.ok) {
        console.warn('⚠️ Ошибка при скачивании файла');
        return [];
      }

      const data = await fileResponse.json();
      console.log('✅ Загружено с Яндекс.Диска:', data.length, 'промптов');
      return data || [];
    } catch (err) {
      console.error('❌ Ошибка загрузки:', err);
      return [];
    }
  }

  // Сохранить промпты в Яндекс.Диск
  async saveToDisk(data: any[]) {
    if (!this.accessToken || !this.isAuthenticated) {
      console.warn('⚠️ Яндекс.Диск: не авторизован');
      return;
    }

    try {
      console.log('💾 Сохраняем в Яндекс.Диск...');
      
      const content = JSON.stringify(data, null, 2);

      // Получаем ссылку для загрузки
      const uploadResponse = await fetch(
        `${API_BASE}/resources/upload?path=${encodeURIComponent(FILE_PATH)}&overwrite=true`,
        {
          method: 'GET',
          headers: {
            'Authorization': `OAuth ${this.accessToken}`,
          },
        }
      );

      if (!uploadResponse.ok) {
        console.error('❌ Ошибка получения ссылки для загрузки');
        return;
      }

      const uploadData = await uploadResponse.json();
      const uploadUrl = uploadData.href;

      // Загружаем файл
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: content,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok || response.status === 201) {
        console.log('✅ Сохранено в Яндекс.Диск');
      } else {
        console.error(`❌ Ошибка загрузки: ${response.status}`);
      }
    } catch (err) {
      console.error('❌ Ошибка сохранения:', err);
    }
  }

  // Выход
  logout() {
    this.accessToken = null;
    this.isAuthenticated = false;
    localStorage.removeItem('yandex_access_token');
    console.log('✅ Выход из Яндекс.Диска');
  }

  getAuthStatus(): boolean {
    return this.isAuthenticated;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }
}

export const yandexDiskService = new YandexDiskService();