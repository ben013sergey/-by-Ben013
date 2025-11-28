// services/googleDriveService.ts

const CLIENT_ID = '682289980262-k7dr1qjmv3lo931iumu4ie0c2n5dj1m1.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const FILE_NAME = 'prompts_vault.json';

declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

export class GoogleDriveService {
  private fileId: string | null = null;
  private isAuthenticated = false;
  private tokenClient: any = null;
  private accessToken: string | null = null;

  async init() {
    console.log('🚀 Initializing Google Drive Service...');
    
    // Загружаем Google Identity Services
    await this.loadGIS();
    
    // Загружаем Google API Client
    await this.loadGAPI();
    
    console.log('✅ Google Drive Service initialized');
  }

  private loadGIS() {
    return new Promise<void>((resolve) => {
      if (window.google?.accounts) {
        console.log('GIS already loaded');
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log('✅ GIS loaded');
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  private loadGAPI() {
    return new Promise<void>((resolve) => {
      if (window.gapi?.client) {
        console.log('GAPI already loaded');
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        window.gapi.load('client', async () => {
          try {
            await window.gapi.client.init({
              apiKey: '',
              discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            });
            console.log('✅ GAPI loaded');
            resolve();
          } catch (err) {
            console.error('GAPI init error:', err);
            resolve();
          }
        });
      };
      document.head.appendChild(script);
    });
  }

  async signIn() {
    console.log('🔑 Attempting Google Drive sign in...');

    return new Promise<void>((resolve, reject) => {
      if (!window.google?.accounts?.oauth2) {
        console.error('❌ Google OAuth2 not loaded');
        return reject('Google OAuth2 not loaded');
      }

      // Инициализируем token client
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (response: any) => {
          if (response.error) {
            console.error('❌ Auth error:', response.error);
            reject(response.error);
            return;
          }

          console.log('✅ Got access token');
          this.accessToken = response.access_token;
          this.isAuthenticated = true;

          // Ищем или создаём файл
          try {
            await this.findOrCreateFile();
            resolve();
          } catch (err) {
            reject(err);
          }
        },
      });

      // Запрашиваем токен
      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  private async findOrCreateFile() {
    console.log('🔍 Looking for existing file in Drive...');

    try {
      const response = await this.callGoogleAPI({
        method: 'GET',
        url: `https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME}' and trashed=false&fields=files(id,name)&pageSize=1`,
      });

      const files = response.result?.files || [];

      if (files.length > 0) {
        this.fileId = files[0].id;
        console.log('✅ Found existing file:', this.fileId);
      } else {
        console.log('📝 Creating new file...');
        const createResponse = await this.callGoogleAPI({
          method: 'POST',
          url: 'https://www.googleapis.com/drive/v3/files?fields=id',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            name: FILE_NAME,
            mimeType: 'application/json',
          },
        });

        this.fileId = createResponse.result?.id;
        console.log('✅ Created new file:', this.fileId);
      }
    } catch (err) {
      console.error('❌ Error finding/creating file:', err);
      throw err;
    }
  }

  private async callGoogleAPI(options: any) {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(options.url, {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json();
      throw error;
    }

    return { result: await response.json() };
  }

  async loadFromDrive(): Promise<any[]> {
    if (!this.fileId || !this.isAuthenticated) {
      console.warn('⚠️ Not authenticated or file not found');
      return [];
    }

    try {
      console.log('📥 Loading from Drive...');
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${this.fileId}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      );

      const data = await response.json();
      console.log('✅ Loaded from Drive');
      return data || [];
    } catch (err) {
      console.error('❌ Load error:', err);
      return [];
    }
  }

  async saveToDrive(data: any[]) {
    if (!this.fileId || !this.isAuthenticated) {
      console.warn('⚠️ Not authenticated or file not found');
      return;
    }

    try {
      console.log('💾 Saving to Drive...');
      const content = JSON.stringify(data, null, 2);

      const response = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${this.fileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: content,
        }
      );

      if (response.ok) {
        console.log('✅ Saved to Google Drive');
      } else {
        throw new Error(`Upload failed: ${response.status}`);
      }
    } catch (err) {
      console.error('❌ Save error:', err);
    }
  }

  isReady(): boolean {
    return this.isAuthenticated && this.fileId !== null;
  }

  getFileId(): string | null {
    return this.fileId;
  }

  getAuthStatus(): boolean {
    return this.isAuthenticated;
  }
}

export const googleDriveService = new GoogleDriveService();
