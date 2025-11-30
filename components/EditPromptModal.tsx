import React, { useState, useEffect } from 'react';
import { PromptData, GenderVariant, VALID_CATEGORIES, PromptVariants } from '../types';
import { X, Save, Upload, Image as ImageIcon, Trash2, Languages } from 'lucide-react';

interface EditPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedData: PromptData) => void;
  initialData: PromptData;
}

const EditPromptModal: React.FC<EditPromptModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState<PromptData>(initialData);
  const [activeVariant, setActiveVariant] = useState<GenderVariant>(GenderVariant.Female);

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, imageBase64: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Универсальная функция для обновления текста (En или Ru)
  const handleVariantTextChange = (lang: 'En' | 'Ru', text: string) => {
    const prefix = activeVariant.toLowerCase(); // male, female, unisex
    const key = `${prefix}${lang}` as keyof PromptVariants; // maleEn, maleRu ...

    setFormData(prev => ({
      ...prev,
      variants: {
        ...prev.variants,
        [key]: text
      }
    }));
  };

  // Хелпер для получения текущего значения (с поддержкой старых данных)
  const getVariantValue = (lang: 'En' | 'Ru') => {
    const prefix = activeVariant.toLowerCase();
    const key = `${prefix}${lang}` as keyof PromptVariants;
    const oldKey = prefix as keyof PromptVariants; // male, female...

    // Если есть новое поле (maleEn) - берем его. Если нет - берем старое (male).
    return (formData.variants[key] || formData.variants[oldKey] || '') as string;
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
          <h3 className="text-lg font-bold text-white">Редактировать промпт</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Top Row: Title & Model */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Название</label>
              <input 
                type="text" 
                value={formData.shortTitle}
                onChange={(e) => setFormData({...formData, shortTitle: e.target.value})}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Модель нейросети</label>
              <select 
                value={formData.model}
                onChange={(e) => setFormData({...formData, model: e.target.value})}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 outline-none"
              >
                <option value="Flux 2">Flux 2</option>
                <option value="Nana Banana">Nana Banana</option>
                <option value="Midjourney">Midjourney</option>
              </select>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Категория</label>
            <select 
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 outline-none"
            >
              {VALID_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Note Section */}
          <div>
             <label className="block text-xs font-medium text-slate-400 mb-1">Примечание</label>
             <textarea
               value={formData.note || ''}
               onChange={(e) => setFormData({...formData, note: e.target.value})}
               className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 outline-none resize-none h-20"
               placeholder="Заметки..."
             />
          </div>

          {/* Image Section */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Изображение / Референс</label>
            <div className="flex items-start gap-4">
              {formData.imageBase64 ? (
                <div className="relative group w-32 h-32 rounded-lg overflow-hidden border border-slate-700 bg-black">
                  <img src={formData.imageBase64} alt="Preview" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => setFormData({...formData, imageBase64: null})}
                    className="absolute top-1 right-1 bg-red-500/80 p-1.5 rounded-full text-white hover:bg-red-600 transition-colors"
                    title="Удалить фото"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : (
                <div className="w-32 h-32 rounded-lg border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 bg-slate-800/50">
                  <ImageIcon size={24} />
                  <span className="text-[10px] mt-1">Нет фото</span>
                </div>
              )}
              
              <div className="flex-grow">
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg cursor-pointer transition-colors text-sm text-slate-300">
                  <Upload size={16} />
                  <span>{formData.imageBase64 ? "Заменить фото" : "Загрузить фото"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
                <p className="text-xs text-slate-500 mt-2">
                  Используется как превью в галерее и как референс для тестов генерации.
                </p>
              </div>
            </div>
          </div>

          {/* Prompt Variants Editor (NEW 6 FIELDS) */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Текст промпта (по вариантам)</label>
            
            {/* Tabs */}
            <div className="flex gap-2 mb-2">
              {[GenderVariant.Female, GenderVariant.Male, GenderVariant.Unisex].map((variant) => (
                <button
                  key={variant}
                  onClick={() => setActiveVariant(variant)}
                  className={`px-3 py-1.5 rounded-t-lg text-xs font-medium transition-colors border-b-2 ${
                    activeVariant === variant
                      ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {variant === GenderVariant.Female ? 'Девушка' : 
                   variant === GenderVariant.Male ? 'Парень' : 'Унисекс'}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 bg-slate-950 border border-slate-700 rounded-b-lg rounded-tr-lg p-3">
                {/* English Field */}
                <div>
                    <label className="text-[10px] text-indigo-400 uppercase font-bold mb-1 block flex items-center gap-1">
                        English <span className="text-slate-500 font-normal">(Для генерации)</span>
                    </label>
                    <textarea 
                      value={getVariantValue('En')}
                      onChange={(e) => handleVariantTextChange('En', e.target.value)}
                      className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 font-mono focus:border-indigo-500 outline-none resize-none"
                      placeholder="Prompt in English..."
                    />
                </div>

                {/* Russian Field */}
                <div>
                    <label className="text-[10px] text-blue-400 uppercase font-bold mb-1 block flex items-center gap-1">
                        Русский <span className="text-slate-500 font-normal">(Для чтения/перевода)</span>
                    </label>
                    <textarea 
                      value={getVariantValue('Ru')}
                      onChange={(e) => handleVariantTextChange('Ru', e.target.value)}
                      className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 font-mono focus:border-indigo-500 outline-none resize-none"
                      placeholder="Описание на русском..."
                    />
                </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            Отмена
          </button>
          <button 
            onClick={() => onSave(formData)}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-indigo-900/20 transition-all"
          >
            <Save size={16} />
            Сохранить изменения
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPromptModal;
