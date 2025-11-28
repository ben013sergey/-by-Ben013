
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GeminiAnalysisResult, AspectRatio } from "../types";

export const analyzePrompt = async (promptText: string): Promise<GeminiAnalysisResult> => {
  // Initialize inside the function to ensure process.env.API_KEY is available at runtime
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        category: {
          type: Type.STRING,
          description: "One of the following categories: 'Портрет людей/персонажей', 'Предметы и Дизайн продуктов', 'Фоны и Окружение', 'Стили и улучшения', 'Промпты с фото', or 'Другое'.",
        },
        shortTitle: {
          type: Type.STRING,
          description: "A very short, catchy title (3-6 words) in Russian describing the essence of the prompt.",
        },
        variants: {
          type: Type.OBJECT,
          properties: {
            male: {
              type: Type.STRING,
              description: "Prompt adapted for a Male subject. MUST include face preservation tags if a person is present.",
            },
            female: {
              type: Type.STRING,
              description: "Prompt adapted for a Female subject. MUST include face preservation tags if a person is present.",
            },
            unisex: {
              type: Type.STRING,
              description: "Prompt adapted for a Unisex/Ambiguous subject. MUST include face preservation tags if a person is present.",
            },
          },
          required: ["male", "female", "unisex"],
        },
      },
      required: ["category", "shortTitle", "variants"],
    };

    const promptInstructions = `
      Analyze this image generation prompt: "${promptText}".
      
      Tasks:
      1. Create a short title in Russian.
      2. Categorize it into one of these exact categories: 'Портрет людей/персонажей', 'Предметы и Дизайн продуктов', 'Фоны и Окружение', 'Стили и улучшения', 'Промпты с фото', 'Другое'.
         - Use 'Промпты с фото' if the prompt explicitly mentions uploading a reference image, using an input image, or image-to-image transformation.
      3. Create 3 variations of the prompt text (Male, Female, Unisex).
      
      CRITICAL RULE FOR PERSONS:
      If the prompt involves a person/human/character:
      You MUST append exactly this string: "(сохраняй лицо человека на 100% точным по сравнению с загруженным изображением),(Не меняй черты лица)" 
      immediately after the gender/person descriptor (e.g., "A man (сохраняй...), wearing...") OR at the end of the prompt if simpler.
      
      If no person is involved, do not add the face preservation text.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: promptInstructions,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    return JSON.parse(text) as GeminiAnalysisResult;
  } catch (error) {
    console.error("Error analyzing prompt:", error);
    // Fallback if AI fails
    return {
      category: "Общее",
      shortTitle: promptText.slice(0, 20) + "...",
      variants: {
        male: promptText,
        female: promptText,
        unisex: promptText,
      },
    };
  }
};

export const generateNanoBananaImage = async (prompt: string, referenceImageBase64?: string | null, aspectRatio: AspectRatio = '1:1'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const parts: any[] = [];
    
    // Add reference image if provided
    if (referenceImageBase64) {
      // Extract base64 data and mime type
      // Expecting format: "data:image/png;base64,....."
      const matches = referenceImageBase64.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        parts.push({
          inlineData: {
            mimeType: matches[1],
            data: matches[2]
          }
        });
      }
    }

    // Add text prompt
    parts.push({ text: prompt });

    let response;
    
    // Attempt 1: Try High-Quality Model
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: parts
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio
          }
        }
      });
    } catch (primaryError: any) {
      // Check for permission/not found errors
      if (primaryError.message && (
          primaryError.message.includes('403') || 
          primaryError.message.includes('404') || 
          primaryError.message.includes('PERMISSION_DENIED') ||
          primaryError.message.includes('NOT_FOUND')
      )) {
        console.warn("Primary model failed (403/404). Falling back to 'gemini-2.5-flash-image'.");
        // Attempt 2: Fallback to Standard Model
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: parts
          },
          config: {
            imageConfig: {
              aspectRatio: aspectRatio
            }
          }
        });
      } else {
        // Rethrow other errors (e.g. rate limit, content policy)
        throw primaryError;
      }
    }

    const content = response.candidates?.[0]?.content;
    const responseParts = content?.parts || [];

    // Check for inline data (image)
    for (const part of responseParts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }

    // If no image, check for text (usually an error message or refusal)
    const textOutput = responseParts
      .filter(p => p.text)
      .map(p => p.text)
      .join(' ')
      .trim();

    if (textOutput) {
      throw new Error(`Модель вернула текст вместо фото: "${textOutput.slice(0, 200)}${textOutput.length > 200 ? '...' : ''}"`);
    }
    
    throw new Error("Ответ модели пуст (нет фото или текста).");
  } catch (error) {
    console.error("Generation error:", error);
    throw error;
  }
};
