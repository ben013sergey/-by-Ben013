
export enum GenderVariant {
  Male = 'Male',
  Female = 'Female',
  Unisex = 'Unisex'
}

export type AspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '9:16' | '16:9' | '21:9';

export interface PromptData {
  id: string;
  originalPrompt: string;
  model: string;
  category: string;
  shortTitle: string;
  variants: {
    male: string;
    female: string;
    unisex: string;
  };
  imageBase64: string | null;
  note?: string; // Optional user note
  usageCount?: number; // Counter for successful generations
  createdAt: number;
}

export interface GeminiAnalysisResult {
  category: string;
  shortTitle: string;
  variants: {
    male: string;
    female: string;
    unisex: string;
  };
}

export const VALID_CATEGORIES = [
  'Портрет людей/персонажей',
  'Предметы и Дизайн продуктов',
  'Фоны и Окружение',
  'Стили и улучшения',
  'Промпты с фото',
  'Другое'
];