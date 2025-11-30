export enum GenderVariant {
  Male = 'Male',
  Female = 'Female',
  Unisex = 'Unisex'
}

export type AspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '9:16' | '16:9' | '21:9';

export interface GeneratedImage {
  id: string;
  url: string;
  timestamp: number;
  aspectRatio: AspectRatio;
}

// 1. Создаем специальный интерфейс для вариантов, чтобы поддерживать и старое, и новое
export interface PromptVariants {
  // Новые поля (могут отсутствовать в старых записях, поэтому ?)
  maleEn?: string;
  maleRu?: string;
  femaleEn?: string;
  femaleRu?: string;
  unisexEn?: string;
  unisexRu?: string;

  // Старые поля (оставляем для совместимости с вашей текущей базой)
  male?: string;
  female?: string;
  unisex?: string;
}

export interface PromptData {
  id: string;
  originalPrompt: string;
  model: string;
  category: string;
  shortTitle: string;
  
  // 2. Используем обновленную структуру вариантов
  variants: PromptVariants;
  
  imageBase64: string | null;
  note?: string; 
  usageCount?: number; 
  generationHistory?: GeneratedImage[]; 
  createdAt: number;
}

export interface GeminiAnalysisResult {
  category: string;
  shortTitle: string;
  // 3. Тут тоже обновляем
  variants: PromptVariants;
}

export const VALID_CATEGORIES = [
  'Портрет людей/персонажей',
  'Предметы и Дизайн продуктов',
  'Фоны и Окружение',
  'Стили и улучшения',
  'Промпты с фото',
  'Другое'
];
