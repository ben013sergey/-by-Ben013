import { PromptData } from '../types';

export const EXAMPLE_PROMPTS: Partial<PromptData>[] = [
  {
    originalPrompt: "Core Instruction: A Japanese Ukiyoe style collectible trading card design, vertical composition. The illustration style needs to closely mimic the visual aesthetics of \"Demon Slayer\", features include: ink outlines with varying thickness, traditional woodblock print color schemes, and dramatic dynamic composition.\n\nSubject Description: The card protagonist is {Character Name} (Title: {Hashira Name/Title}), in a dynamic fighting pose, holding {Weapon Description}. The character is performing {Breathing Style Move Name}, surrounded by {Visual Effect Description} (e.g., giant flames / water dragon / whirlwind), these effects need to be presented in Traditional Japanese Sumi-e style.\n\nBackground and Material: The background needs to blend textured Holographic Foil effect, shimmering beneath the traditional ink elements.\n\nBorder: The image should have a decorative border composed of Traditional Japanese Patterns (such as Seigaiha or Asanoha). At the bottom, there is a stylized banner with \"{Japanese Kanji Name}\" written in ancient Japanese calligraphy.",
    category: "Стили и улучшения",
    shortTitle: "Карточка в стиле Укиё-э",
    model: "Nana Banana",
    variants: {
      male: "Core Instruction: A Japanese Ukiyoe style collectible trading card design... (Adapted for Male)",
      female: "Core Instruction: A Japanese Ukiyoe style collectible trading card design... (Adapted for Female)",
      unisex: "Core Instruction: A Japanese Ukiyoe style collectible trading card design..."
    },
    note: "Необходимо заполнить информацию в скобках {} в промпте"
  },
  {
    originalPrompt: "Create an image at 40.7128° N, 74.0060° W, on September 11, 2001, at 08:46",
    category: "Фоны и Окружение",
    shortTitle: "Генерация по координатам",
    model: "Nana Banana",
    variants: {
      male: "Create an image at 40.7128° N, 74.0060° W, on September 11, 2001, at 08:46",
      female: "Create an image at 40.7128° N, 74.0060° W, on September 11, 2001, at 08:46",
      unisex: "Create an image at 40.7128° N, 74.0060° W, on September 11, 2001, at 08:46"
    }
  },
  {
     originalPrompt: "Based on the uploaded reference character, shoot a real-life scene in a spacious Tokyo girl's apartment... Place about thirty characters identical to the reference character...",
     category: "Портрет людей/персонажей",
     shortTitle: "Клонирование персонажа",
     model: "Nana Banana",
     variants: {
       male: "Based on the uploaded reference character, shoot a real-life scene... Place about thirty characters... (сохраняй лицо человека на 100% точным по сравнению с загруженным изображением),(Не меняй черты лица)",
       female: "Based on the uploaded reference character, shoot a real-life scene... Place about thirty characters... (сохраняй лицо человека на 100% точным по сравнению с загруженным изображением),(Не меняй черты лица)",
       unisex: "Based on the uploaded reference character, shoot a real-life scene... Place about thirty characters... (сохраняй лицо человека на 100% точным по сравнению с загруженным изображением),(Не меняй черты лица)"
     },
     note: "Требуется загрузка референсного фото персонажа"
  }
];