import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Loader2, Sparkles, FolderOpen, Upload, Filter, ArrowDownUp, XCircle, MessageCircle, FileText, HardDriveDownload, HardDriveUpload, CheckCircle2, AlertCircle, Save, ChevronDown, Trash2, X, Download, RefreshCw, Wand2, Cloud, Clock, Code, Database } from 'lucide-react';
import { PromptData, VALID_CATEGORIES } from './types';
import { analyzePrompt } from './services/geminiService';
import PromptCard from './components/PromptCard';
import { EXAMPLE_PROMPTS } from './data/examplePrompts';
import EditPromptModal from './components/EditPromptModal';
import { saveToDB, loadFromDB } from './services/db';
import { yandexDiskService } from './services/yandexDiskService';

// Local storage keys
const STORAGE_KEY = 'promptvault_data_v1';
const ITEMS_PER_PAGE = 20;

// Simple Toast Component
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => (
  <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border animate-in slide-in-from-bottom-5 fade-in duration-300 ${
    type === 'success' ? 'bg-slate-800 border-green-500/30 text-green-400' : 'bg-slate-800 border-red-500/30 text-red-400'
  }`}>
    {type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
    <span className="font-medium text-sm text-slate-200">{message}</span>
  </div>
);

// Helper for safe ID generation
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

function App() {
  const [prompts, setPrompts] = useState<PromptData[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const [view, setView] = useState<'list' | 'create'>('list');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<PromptData | null>(null);
  
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const promptsRef = useRef<PromptData[]>([]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [inputTitle, setInputTitle] = useState('');
  const [inputCategory, setInputCategory] = useState('');
  const [inputNote, setInputNote] = useState('');
  const [selectedModel, setSelectedModel] = useState('Flux 2');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'with_photo' | 'without_photo' | 'with_notes'>('newest');
  
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);

  useEffect(() => {
    promptsRef.current = prompts;
  }, [prompts]);

  // INITIAL DATA LOAD - попытка загрузить с Яндекс.Диска, затем с IndexedDB
  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. Проверяем авторизацию Яндекса
        if (yandexDiskService.getAuthStatus()) {
          console.log('📥 Загружаем базу с Яндекс.Диска...');
          const diskPrompts = await yandexDiskService.loadFromDisk();
          if (diskPrompts && diskPrompts.length > 0) {
            setPrompts(diskPrompts);
            setIsDriveConnected(true);
            showToast("✅ База загружена с Яндекс.Диска!");
            setIsDataLoaded(true);
            return;
          }
        }

        // 2. Если Яндекс не авторизован, загружаем с IndexedDB
        const dbPrompts = await loadFromDB<PromptData[]>(STORAGE_KEY);
        if (dbPrompts) {
          setPrompts(dbPrompts);
        } else {
          // 3. Migration: Check LocalStorage if DB is empty
          const lsPrompts = localStorage.getItem(STORAGE_KEY);
          if (lsPrompts) {
            try {
              const parsed = JSON.parse(lsPrompts);
              setPrompts(parsed);
              await saveToDB(STORAGE_KEY, parsed);
            } catch (e) {
              console.error("Migration failed", e);
            }
          }
        }
      } catch (e) {
        console.error("Failed to load data", e);
        showToast("Ошибка инициализации базы данных", "error");
      } finally {
        setIsDataLoaded(true);
      }
    };

    loadData();
  }, []);

  // SAVE EFFECT 1: Сохраняем при каждом изменении
  useEffect(() => {
    if (!isDataLoaded) return;
    
    const save = async () => {
      try {
        // Сохраняем локально в IndexedDB
        await saveToDB(STORAGE_KEY, prompts);
        
        // Если авторизованы в Яндексе, сохраняем там
        if (isDriveConnected && yandexDiskService.getAuthStatus()) {
          await yandexDiskService.saveToDisk(prompts);
        }
        
        setLastSaved(new Date());
      } catch (e) {
        console.error("DB Save Failed", e);
        showToast("Ошибка сохранения. Проверьте место на диске.", "error");
      }
    };
    save();
  }, [prompts, isDataLoaded, isDriveConnected]);

  // SAVE EFFECT 2: Периодическое сохранение каждые 30 секунд
  useEffect(() => {
    if (!isDataLoaded) return;

    const intervalId = setInterval(async () => {
      try {
        if (promptsRef.current.length > 0) {
           await saveToDB(STORAGE_KEY, promptsRef.current);
           
           if (isDriveConnected && yandexDiskService.getAuthStatus()) {
             await yandexDiskService.saveToDisk(promptsRef.current);
           }
           
           setLastSaved(new Date());
        }
      } catch (e) {
        console.error("Periodic Save Failed", e);
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [isDataLoaded, isDriveConnected]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000); 
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [searchQuery, selectedCategoryFilter, sortOrder]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const handleLoadExamples = () => {
    try {
      const fullExamples = EXAMPLE_PROMPTS.map(ex => ({
        ...ex,
        id: generateId(),
        createdAt: Date.now(),
        usageCount: 0
      }));

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullExamples, null, 2));
      const downloadAnchorNode = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `examples_pack_110_${date}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      showToast("Файл с примерами (examples_pack.json) скачан!", "success");
    } catch (e) {
      showToast("Ошибка при создании файла примеров", "error");
    }
  };
  
  // Функция для применения примеров прямо из кода (Import from source)
  const handleApplyInternalExamples = () => {
    try {
      // 1. Создаем Set из существующих оригинальных промптов для быстрой проверки
      const existingPrompts = new Set(promptsRef.current.map(p => p.originalPrompt?.trim()));
      
      // 2. Фильтруем примеры
      const newPrompts = EXAMPLE_PROMPTS.filter(ex => {
        // Если у примера нет текста промпта или он уже есть в базе - пропускаем
        return ex.originalPrompt && !existingPrompts.has(ex.originalPrompt.trim());
      }).map(ex => ({
        ...ex,
        id: generateId(), // Генерируем новые ID
        createdAt: Date.now(),
        usageCount: 0,
        // Гарантируем наличие полей, если они отсутствуют в Partial
        variants: ex.variants || { 
          male: ex.originalPrompt || '', 
          female: ex.originalPrompt || '', 
          unisex: ex.originalPrompt || '' 
        },
        model: ex.model || 'Nana Banana',
        shortTitle: ex.shortTitle || 'Без названия',
        category: ex.category || 'Другое',
        imageBase64: ex.imageBase64 || null
      })) as PromptData[];
      
      if (newPrompts.length === 0) {
        showToast("Все примеры из файла уже добавлены!", "error");
        return;
      }

      setPrompts(prev => [...newPrompts, ...prev]);
      showToast(`Добавлено ${newPrompts.length} новых примеров (дубликаты пропущены)!`);
      
    } catch (e) {
      console.error(e);
      showToast("Ошибка при импорте примеров", "error");
    }
  };

  // Функция для создания файла examplePrompts.ts из текущей базы
  const handleExportToTS = () => {
    try {
      // Очищаем данные от служебных полей для чистого файла примеров
      const cleanPrompts = prompts.map(({ id, usageCount, createdAt, ...rest }) => ({
        ...rest,
        createdAt: Date.now() // Ставим свежую дату или 0
      }));

      const content = `
import { PromptData } from '../types';

export const EXAMPLE_PROMPTS: Partial<PromptData>[] = ${JSON.stringify(cleanPrompts, null, 2)};
`;

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'examplePrompts.ts';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showToast("Файл 'examplePrompts.ts' скачан! Замените им файл в папке 'data'.", "success");
    } catch (e) {
      showToast("Ошибка генерации TS файла", "error");
    }
  };

  const handleExtractNotes = () => {
    let changeCount = 0;
    const regex = /\[(?:Примечание|Note):\s*([\s\S]*?)\]/gi;

    const updatedPrompts = prompts.map(p => {
      let foundNotes: string[] = [];

      const cleanText = (text: string) => {
        let hasMatch = false;
        const cleaned = text.replace(regex, (match, content) => {
          hasMatch = true;
          foundNotes.push(content.trim());
          return '';
        });
        return { 
          text: cleaned.replace(/\n\s*\n/g, '\n\n').trim(), 
          modified: hasMatch 
        };
      };

      const orig = cleanText(p.originalPrompt);
      const male = cleanText(p.variants.male);
      const female = cleanText(p.variants.female);
      const unisex = cleanText(p.variants.unisex);

      if (orig.modified || male.modified || female.modified || unisex.modified) {
        changeCount++;
        const uniqueNotes = Array.from(new Set(foundNotes)).filter(Boolean).join('\n\n');
        const existingNote = p.note ? p.note + '\n\n' : '';
        const finalNote = existingNote + uniqueNotes;

        return {
          ...p,
          originalPrompt: orig.text,
          variants: {
            male: male.text,
            female: female.text,
            unisex: unisex.text
          },
          note: finalNote || undefined
        };
      }
      return p;
    });

    if (changeCount > 0) {
      setPrompts(updatedPrompts);
      showToast(`Извлечены примечания из ${changeCount} промптов!`);
    } else {
      showToast("Примечания в формате [Примечание: ...] не найдены.", "error");
    }
  };

  const handleBackupDatabase = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(prompts, null, 2));
      const downloadAnchorNode = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `prompts_backup_db_${date}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      showToast("Резервная копия базы (JSON) сохранена!");
    } catch (e) {
      showToast("Ошибка при экспорте", "error");
    }
  };

  const handleExportText = () => {
    try {
      let content = `ГАЛЕРЕЯ ПРОМПТОВ BY BEN013\nЭкспорт от ${new Date().toLocaleString('ru-RU')}\n`;
      content += `Всего промптов: ${prompts.length}\n\n`;
      
      const cats = Array.from(new Set(prompts.map(p => p.category || 'Без категории'))).sort();

      cats.forEach((category: string) => {
        const catPrompts = prompts.filter(p => (p.category || 'Без категории') === category);
        if (catPrompts.length === 0) return;

        content += `==================================================\n`;
        content += `КАТЕГОРИЯ: ${category.toUpperCase()}\n`;
        content += `==================================================\n\n`;

        catPrompts.forEach((p, index) => {
           content += `${index + 1}. ${p.shortTitle}\n`;
           content += `   Модель: ${p.model} | Дата: ${new Date(p.createdAt).toLocaleDateString('ru-RU')} | Ген: ${p.usageCount || 0}\n`;
           if (p.note) content += `   Примечание: ${p.note}\n`;
           content += `   -----------------------------------------------\n`;
           content += `   [Девушка]:\n   ${p.variants.female}\n\n`;
           content += `   [Парень]:\n   ${p.variants.male}\n\n`;
           content += `   [Унисекс]:\n   ${p.variants.unisex}\n`;
           content += `   -----------------------------------------------\n\n`;
        });
      });

      const element = document.createElement("a");
      const file = new Blob([content], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = `prompts_readable_${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      showToast("Текстовый файл (TXT) сохранен!");
    } catch (e) {
      showToast("Ошибка при экспорте текста", "error");
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        const importedData = JSON.parse(json);
        processImportedData(importedData);
        showToast(`Успешно синхронизировано ${importedData.length} промптов!`);
        e.target.value = '';
      } catch (err) {
        showToast("Неверный формат файла", "error");
      }
    };
    reader.readAsText(file);
  };

  const processImportedData = (importedData: any) => {
    if (!Array.isArray(importedData)) {
      throw new Error("Invalid format");
    }
    setPrompts(prev => {
      const newMap = new Map(prev.map(p => [p.id, p]));
      importedData.forEach((item: PromptData) => {
        if (!item.id) item.id = generateId();
        if (item.usageCount === undefined) item.usageCount = 0;
        if (item.variants) {
          newMap.set(item.id, item);
        }
      });
      return Array.from(newMap.values());
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!inputPrompt.trim()) return;
    setLoading(true);

    try {
      const analysis = await analyzePrompt(inputPrompt);
      const finalTitle = inputTitle.trim() ? inputTitle.trim() : analysis.shortTitle;
      const finalCategory = inputCategory ? inputCategory : analysis.category;

      const newEntry: PromptData = {
        id: generateId(),
        originalPrompt: inputPrompt,
        model: selectedModel,
        category: finalCategory,
        shortTitle: finalTitle,
        variants: analysis.variants,
        imageBase64: uploadedImage,
        note: inputNote.trim() || undefined,
        usageCount: 0,
        createdAt: Date.now(),
      };

      setPrompts(prev => [newEntry, ...prev]);
      showToast("Промпт сохранен в базу!");

      setInputPrompt('');
      setInputTitle('');
      setInputCategory('');
      setInputNote('');
      setUploadedImage(null);
      setView('list');
    } catch (error) {
      showToast("Ошибка при обработке. Попробуйте снова.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Вы уверены, что хотите удалить этот промпт?')) {
      setPrompts(prev => prev.filter(p => p.id !== id));
      showToast("Промпт удален");
    }
  };

  const handleCategoryUpdate = (id: string, newCategory: string) => {
    setPrompts(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, category: newCategory };
      }
      return p;
    }));
    showToast("Категория обновлена");
  };

  const handleUsageUpdate = (id: string) => {
    setPrompts(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, usageCount: (p.usageCount || 0) + 1 };
      }
      return p;
    }));
  };

  const handleUpdatePrompt = (updatedData: PromptData) => {
    setPrompts(prev => prev.map(p => p.id === updatedData.id ? updatedData : p));
    setEditingPrompt(null);
    showToast("Промпт успешно обновлен!");
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategoryFilter('all');
    setSortOrder('newest');
    showToast("Фильтры сброшены");
  };

  const allCategories = Array.from(new Set(prompts.map(p => p.category || 'Без категории')));

  const allFilteredPrompts = prompts.filter(prompt => {
    const matchesSearch = 
      prompt.shortTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.originalPrompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Object.values(prompt.variants).some((v) => (v as string).toLowerCase().includes(searchQuery.toLowerCase())) ||
      (prompt.note && prompt.note.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategoryFilter === 'all' || prompt.category === selectedCategoryFilter;
    
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    if (sortOrder === 'with_notes') {
      const aHas = !!a.note;
      const bHas = !!b.note;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return b.createdAt - a.createdAt;
    }

    if (sortOrder === 'with_photo') {
      const aHas = !!a.imageBase64;
      const bHas = !!b.imageBase64;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return b.createdAt - a.createdAt;
    }
    
    if (sortOrder === 'without_photo') {
      const aHas = !!a.imageBase64;
      const bHas = !!b.imageBase64;
      if (!aHas && bHas) return -1;
      if (aHas && !bHas) return 1;
      return b.createdAt - a.createdAt;
    }

    if (sortOrder === 'oldest') return a.createdAt - b.createdAt;
    
    return b.createdAt - a.createdAt;
  });

  const visiblePrompts = allFilteredPrompts.slice(0, visibleCount);
  const hasMore = visibleCount < allFilteredPrompts.length;

  const groupedPrompts = visiblePrompts.reduce((acc, prompt) => {
    const cat = prompt.category || 'Без категории';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(prompt);
    return acc;
  }, {} as Record<string, PromptData[]>);

  const sortedCategories = Object.keys(groupedPrompts).sort();

  if (!isDataLoaded) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 size={48} className="animate-spin mb-4 text-indigo-500" />
        <h2 className="text-xl font-medium">Загрузка базы данных...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 pb-20 overflow-x-hidden">
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {editingPrompt && (
        <EditPromptModal 
          isOpen={!!editingPrompt}
          onClose={() => setEditingPrompt(null)}
          onSave={handleUpdatePrompt}
          initialData={editingPrompt}
        />
      )}

      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-col gap-1 w-full md:w-auto">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('list')}>
                <div className="bg-indigo-600 p-2 rounded-lg flex-shrink-0">
                  <Sparkles className="text-white w-5 h-5" />
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent flex flex-wrap items-center">
                  Галерея промптов
                  <span className="text-slate-500 text-sm font-normal ml-2 normal-case tracking-normal text-none whitespace-nowrap">
                    ({prompts.length})
                  </span>
                </h1>
              </div>
              <a 
                href="https://t.me/Ben013sergey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-400 transition-colors ml-11"
              >
                <MessageCircle size={12} />
                <span>by Ben013</span>
              </a>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
              <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700 mr-2 overflow-x-auto max-w-full no-scrollbar">
                
                 <button
                  onClick={handleExtractNotes}
                  className="p-2 text-slate-400 hover:text-purple-300 hover:bg-slate-700 rounded-md transition-colors relative flex-shrink-0"
                  title="Авто-извлечение примечаний из текста промпта"
                >
                  <Wand2 size={18} />
                </button>
                
                <div className="w-px h-6 bg-slate-700 mx-1 flex-shrink-0"></div>

                {/* Example Management Group */}
                <button
                  onClick={handleExportToTS}
                  className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-md transition-colors relative flex-shrink-0"
                  title="Скачать текущую базу как examplePrompts.ts"
                >
                  <Code size={18} />
                </button>

                 <button
                  onClick={handleApplyInternalExamples}
                  className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded-md transition-colors relative flex-shrink-0"
                  title="Применить примеры из файла examplePrompts.ts"
                >
                  <Database size={18} />
                  <div className="absolute top-1 right-0.5 text-[8px] font-bold">+</div>
                </button>

                <div className="w-px h-6 bg-slate-700 mx-1 flex-shrink-0"></div>
                
                <button
                  onClick={handleLoadExamples}
                  className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded-md transition-colors relative flex-shrink-0"
                  title="Скачать примеры (JSON) для импорта"
                >
                  <Download size={18} />
                </button>

                <div className="w-px h-6 bg-slate-700 mx-1 flex-shrink-0"></div>
                
                <button 
                  onClick={handleExportText}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors relative group flex-shrink-0"
                  title="Скачать как текст (.txt)"
                >
                  <FileText size={18} />
                </button>
                
                <div className="w-px h-6 bg-slate-700 mx-1 flex-shrink-0"></div>

                <button 
                  onClick={handleBackupDatabase}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors flex-shrink-0"
                  title="Скачать базу данных (.json) на компьютер"
                >
                  <HardDriveDownload size={18} />
                </button>

                {/* Яндекс.Диск Login Button */}
                {!isDriveConnected && (
                  <button
                    onClick={() => {
                      console.log('🔵 Нажата кнопка входа в Яндекс.Диск');
                      setDriveLoading(true);
                      yandexDiskService.signIn();
                    }}
                    disabled={driveLoading}
                    className={`p-2 rounded-md transition-colors flex-shrink-0 ${
                      driveLoading 
                        ? 'text-slate-600 cursor-not-allowed' 
                        : 'text-slate-400 hover:text-yellow-400 hover:bg-slate-700'
                    }`}
                    title="Войти в Яндекс.Диск"
                  >
                    {driveLoading ? <Loader2 size={18} className="animate-spin" /> : <Cloud size={18} />}
                  </button>
                )}

                {isDriveConnected && (
                  <div className="p-2 text-yellow-400 flex items-center gap-1 text-xs flex-shrink-0">
                    <Cloud size={16} />
                    <span>Yandex</span>
                  </div>
                )}

                <div className="w-px h-6 bg-slate-700 mx-1 flex-shrink-0"></div>
                                
                <label 
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors cursor-pointer flex-shrink-0"
                  title="Загрузить базу данных (Импорт)"
                >
                  <HardDriveUpload size={18} />
                  <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                </label>
              </div>

              <button
                onClick={() => setView(view === 'list' ? 'create' : 'list')}
                className={`flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  view === 'list' 
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {view === 'list' ? (
                  <>
                    <Plus size={18} />
                    <span className="hidden sm:inline">Новый</span>
                    <span className="inline sm:hidden">Создать</span>
                  </>
                ) : (
                  <>
                    <FolderOpen size={18} />
                    <span>Просмотр</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {view === 'list' && prompts.length > 0 && (
            <div className="flex flex-col md:flex-row gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="text"
                  placeholder="Поиск..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-10 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <XCircle size={16} />
                  </button>
                )}
              </div>
              
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <div className="relative flex-grow sm:flex-grow-0 sm:min-w-[160px]">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm appearance-none focus:outline-none focus:border-indigo-500 cursor-pointer text-slate-300 hover:bg-slate-900"
                  >
                    <option value="all">Все категории</option>
                    {allCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="relative flex-grow sm:flex-grow-0 sm:min-w-[160px]">
                  <ArrowDownUp className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm appearance-none focus:outline-none focus:border-indigo-500 cursor-pointer text-slate-300 hover:bg-slate-900"
                  >
                    <option value="newest">Сначала новые</option>
                    <option value="oldest">Сначала старые</option>
                    <option value="with_photo">Сначала с фото</option>
                    <option value="without_photo">Сначала без фото</option>
                    <option value="with_notes">Сначала с примечанием</option>
                  </select>
                </div>

                {(searchQuery || selectedCategoryFilter !== 'all' || sortOrder !== 'newest') && (
                  <button
                    onClick={resetFilters}
                    className="p-2 bg-slate-950 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
                    title="Сбросить все фильтры"
                  >
                    <RefreshCw size={18} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        
        {view === 'create' && (
          <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl">
              <h2 className="text-2xl font-bold text-white mb-6">Добавить новый промпт</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Модель нейросети
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Flux 2', 'Nana Banana', 'Midjourney'].map(model => (
                      <button
                        key={model}
                        onClick={() => setSelectedModel(model)}
                        className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                          selectedModel === model
                            ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Название (Опционально)
                    </label>
                    <input
                      type="text"
                      value={inputTitle}
                      onChange={(e) => setInputTitle(e.target.value)}
                      placeholder="ИИ придумает, если пусто"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Категория (Опционально)
                    </label>
                    <select
                      value={inputCategory}
                      onChange={(e) => setInputCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm appearance-none"
                    >
                      <option value="">Авто-определение (ИИ)</option>
                      {VALID_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Референсное изображение (опционально)
                  </label>
                  <div className={`border-2 border-dashed rounded-xl p-4 transition-colors ${uploadedImage ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-slate-700 hover:border-slate-600 bg-slate-800'}`}>
                    {uploadedImage ? (
                      <div className="relative group">
                         <img src={uploadedImage} alt="Preview" className="h-48 w-full object-contain rounded-lg" />
                         <button 
                            onClick={() => setUploadedImage(null)}
                            className="absolute top-2 right-2 bg-red-500/80 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                         >
                            <Plus className="rotate-45" size={20}/>
                         </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center cursor-pointer h-32">
                        <Upload className="text-slate-500 mb-2" size={24} />
                        <span className="text-sm text-slate-400">Нажмите, чтобы загрузить</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      </label>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Ваш промпт
                  </label>
                  <textarea
                    value={inputPrompt}
                    onChange={(e) => setInputPrompt(e.target.value)}
                    placeholder="Опишите, что вы хотите сгенерировать..."
                    className="w-full h-40 bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    ИИ автоматически создаст варианты для парня/девушки и добавит инструкции по сохранению лица.
                  </p>
                </div>

                <div>
                   <label className="block text-sm font-medium text-slate-400 mb-2">
                     Примечание (Опционально)
                   </label>
                   <textarea
                     value={inputNote}
                     onChange={(e) => setInputNote(e.target.value)}
                     placeholder="Любые заметки, настройки или идеи..."
                     className="w-full h-20 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm resize-none"
                   />
                </div>

                <button
                  onClick={handleSave}
                  disabled={loading || !inputPrompt.trim()}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Обработка...
                    </>
                  ) : (
                    'Сохранить и обработать'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'list' && (
          <div className="space-y-12 animate-in fade-in duration-500">
            {prompts.length === 0 ? (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-800 rounded-full mb-6 text-slate-600">
                  <Search size={40} />
                </div>
                <h3 className="text-xl font-semibold text-slate-300 mb-2">Здесь пока пусто</h3>
                <p className="text-slate-500 max-w-md mx-auto mb-6">
                  Создайте свой первый промпт или загрузите базу данных.
                </p>
                <div className="flex justify-center gap-6">
                  <button
                     onClick={() => setView('create')}
                     className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/20 active:scale-95 transition-all flex items-center gap-2"
                  >
                    <Plus size={20} />
                    Создать промпт
                  </button>
                  
                  <label className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold shadow-lg border-2 border-indigo-500/30 hover:border-indigo-400 active:scale-95 transition-all cursor-pointer flex items-center gap-2">
                    <HardDriveUpload size={20} className="text-indigo-400" />
                    Загрузить базу
                    <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                  </label>
                </div>
              </div>
            ) : allFilteredPrompts.length === 0 ? (
               <div className="text-center py-20 text-slate-500">
                 <p>Ничего не найдено по вашему запросу.</p>
                 <button onClick={resetFilters} className="text-indigo-400 mt-2 hover:underline">Сбросить фильтры</button>
               </div>
            ) : (
              <>
                {sortedCategories.map((category) => (
                  <div key={category} className="space-y-4">
                    <div className="flex items-center gap-4">
                      <h2 className="text-2xl font-bold text-white tracking-tight pl-2 border-l-4 border-indigo-500">
                        {category}
                      </h2>
                      <div className="h-px flex-grow bg-slate-800"></div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-6">
                      {groupedPrompts[category].map((prompt) => (
                        <PromptCard 
                          key={prompt.id} 
                          data={prompt} 
                          index={allFilteredPrompts.indexOf(prompt)}
                          onDelete={handleDelete}
                          onCategoryUpdate={handleCategoryUpdate}
                          onEdit={setEditingPrompt}
                          onUsageUpdate={handleUsageUpdate}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {hasMore && (
                  <div className="flex justify-center pt-8">
                    <button 
                      onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
                      className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full font-medium transition-all shadow-lg border border-slate-700 hover:border-slate-500"
                    >
                      <ChevronDown size={20} />
                      Показать еще ({allFilteredPrompts.length - visibleCount})
                    </button>
                  </div>
                )}

                <div className="text-center text-slate-600 text-xs mt-6 flex flex-col items-center gap-2">
                  <span>Показано {Math.min(visibleCount, allFilteredPrompts.length)} из {allFilteredPrompts.length} промптов</span>
                  {lastSaved && (
                     <div className="flex items-center gap-1.5 text-slate-500/80 bg-slate-900/50 px-3 py-1 rounded-full border border-slate-800">
                       <Cloud size={10} />
                       <span>Сохранено: {lastSaved.toLocaleTimeString('ru-RU')}</span>
                     </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

export default App;