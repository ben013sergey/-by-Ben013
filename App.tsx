import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Loader2, Sparkles, FolderOpen, Upload, Filter, 
  ArrowDownUp, XCircle, MessageCircle, FileText, HardDriveDownload, 
  HardDriveUpload, CheckCircle2, AlertCircle, Save, ChevronDown, 
  Trash2, X, Download, RefreshCw, Wand2, Code, Database, ChevronUp, 
  Send, Cloud, CloudDownload 
} from 'lucide-react';

import { PromptData, VALID_CATEGORIES, GeneratedImage } from './types';
import { analyzePrompt } from './services/geminiService';
import PromptCard from './components/PromptCard';
import { EXAMPLE_PROMPTS } from './data/examplePrompts';
import EditPromptModal from './components/EditPromptModal';
import { saveToDB, loadFromDB } from './services/db';
import { saveToYandexDisk, loadFromYandexDisk } from './services/yandexDiskService';

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        sendData: (data: string) => void;
        initDataUnsafe: any;
      }
    }
  }
}

// Local storage keys
const STORAGE_KEY = 'promptvault_data_v1';
const DRAFT_KEY = 'promptvault_create_draft';
const ITEMS_PER_PAGE = 20;

// === ВАШ ID (Администратор) ===
const ADMIN_ID = 439014866; 
// ==============================

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
  const [showScrollTopButton, setShowScrollTopButton] = useState(false);

  useEffect(() => {
    promptsRef.current = prompts;
  }, [prompts]);

  // Scroll-to-Top Logic
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTopButton(true);
      } else {
        setShowScrollTopButton(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  // INITIAL DATA LOAD (С Яндексом)
  useEffect(() => {
    const loadData = async () => {
      setIsDataLoaded(false); // Показываем спиннер
      try {
        // 1. Сначала пробуем загрузить из Яндекса (это приоритет)
        const cloudData = await loadFromYandexDisk();
        
        if (cloudData && Array.isArray(cloudData) && cloudData.length > 0) {
          setPrompts(cloudData);
          showToast("☁️ База синхронизирована с Яндекс.Диском!", "success");
          // Обновляем и локальную копию
          await saveToDB(STORAGE_KEY, cloudData);
        } else {
          // 2. Если в облаке пусто, берем из памяти телефона
          const dbPrompts = await loadFromDB<PromptData[]>(STORAGE_KEY);
          if (dbPrompts) setPrompts(dbPrompts);
        }
      } catch (e) {
        console.error("Load Error", e);
        // Если ошибка интернета, грузим локально
        const dbPrompts = await loadFromDB<PromptData[]>(STORAGE_KEY);
        if (dbPrompts) setPrompts(dbPrompts);
        showToast("Нет связи с Яндексом, загружена локальная копия", "error");
      } finally {
        setIsDataLoaded(true);
      }
    };

    loadData();
  }, []);

  // LOAD DRAFT FOR CREATE FORM
  useEffect(() => {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.inputPrompt) setInputPrompt(parsed.inputPrompt);
        if (parsed.inputTitle) setInputTitle(parsed.inputTitle);
        if (parsed.inputCategory) setInputCategory(parsed.inputCategory);
        if (parsed.inputNote) setInputNote(parsed.inputNote);
        if (parsed.selectedModel) setSelectedModel(parsed.selectedModel);
      } catch (e) {
        console.error("Failed to load draft", e);
      }
    }
  }, []);

  // AUTO-SAVE DRAFT FOR CREATE FORM
  useEffect(() => {
    if (view === 'create') {
      const draftData = {
        inputPrompt,
        inputTitle,
        inputCategory,
        inputNote,
        selectedModel
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
    }
  }, [inputPrompt, inputTitle, inputCategory, inputNote, selectedModel, view]);

  // SAVE EFFECT 1
  useEffect(() => {
    if (!isDataLoaded) return;
    
    const save = async () => {
      try {
        await saveToDB(STORAGE_KEY, prompts);
        setLastSaved(new Date());
      } catch (e) {
        console.error("DB Save Failed", e);
        showToast("Ошибка сохранения. Проверьте место на диске.", "error");
      }
    };
    save();
  }, [prompts, isDataLoaded]);

  // SAVE EFFECT 2 (Periodic)
  useEffect(() => {
    if (!isDataLoaded) return;

    const intervalId = setInterval(async () => {
      try {
        if (promptsRef.current.length > 0) {
           await saveToDB(STORAGE_KEY, promptsRef.current);
           setLastSaved(new Date());
        }
      } catch (e) {
        console.error("Periodic Save Failed", e);
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [isDataLoaded]);

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
      showToast("Файл с примерами скачан (в браузере)", "success");
    } catch (e) {
      showToast("Ошибка при создании файла примеров", "error");
    }
  };
  
  const handleApplyInternalExamples = () => {
    try {
      const existingPrompts = new Set(promptsRef.current.map(p => p.originalPrompt?.trim()));
      const newPrompts = EXAMPLE_PROMPTS.filter(ex => {
        return ex.originalPrompt && !existingPrompts.has(ex.originalPrompt.trim());
      }).map(ex => ({
        ...ex,
        id: generateId(),
        createdAt: Date.now(),
        usageCount: 0,
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
      showToast(`Добавлено ${newPrompts.length} новых примеров!`);
    } catch (e) {
      console.error(e);
      showToast("Ошибка при импорте примеров", "error");
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
      showToast("Файл базы данных скачан на устройство", "success");
    } catch (e) {
      showToast("Ошибка при экспорте", "error");
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
        if (!item.generationHistory) item.generationHistory = [];
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

  const clearCreateForm = () => {
    setInputPrompt('');
    setInputTitle('');
    setInputCategory('');
    setInputNote('');
    setUploadedImage(null);
    localStorage.removeItem(DRAFT_KEY);
    setView('list');
  };

  const handleManualSave = async () => {
    if (!inputPrompt.trim()) return;
    setLoading(true);

    try {
      const finalTitle = inputTitle.trim() ? inputTitle.trim() : "Без названия";
      const finalCategory = inputCategory ? inputCategory : "Другое";

      const text = inputPrompt;

      const newEntry: PromptData = {
        id: generateId(),
        originalPrompt: text,
        model: selectedModel,
        category: finalCategory,
        shortTitle: finalTitle,
        variants: {
            maleEn: text, maleRu: text,
            femaleEn: text, femaleRu: text,
            unisexEn: text, unisexRu: text,
            male: text, female: text, unisex: text 
        },
        imageBase64: uploadedImage,
        note: inputNote.trim() || undefined,
        usageCount: 0,
        createdAt: Date.now(),
        generationHistory: []
      };

      setPrompts(prev => [newEntry, ...prev]);
      showToast("Промпт сохранен вручную!");
      clearCreateForm();

    } catch (error) {
      showToast("Ошибка при сохранении.", "error");
    } finally {
      setLoading(false);
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
        generationHistory: []
      };

      setPrompts(prev => [newEntry, ...prev]);
      showToast("Промпт сохранен в базу!");
      clearCreateForm();

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

  const handleAddHistory = (id: string, image: GeneratedImage) => {
    setPrompts(prev => prev.map(p => {
      if (p.id === id) {
        const prevHistory = p.generationHistory || [];
        return { ...p, generationHistory: [image, ...prevHistory].slice(0, 5) };
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
  const categoryCounts = prompts.reduce((acc, p) => {
    const cat = p.category || 'Без категории';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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
                  onClick={handleApplyInternalExamples}
                  className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-700/80 rounded-md transition-all relative flex-shrink-0 active:scale-95 shadow-inner shadow-black/20"
                  title="Применить примеры из файла"
                >
                  <Database size={18} />
                </button>

                <div className="w-px h-6 bg-slate-700 mx-1 flex-shrink-0"></div>
                
                <button
                  onClick={handleLoadExamples}
                  className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-700/80 rounded-md transition-all relative flex-shrink-0 active:scale-95 shadow-inner shadow-black/20"
                  title="Скачать примеры (JSON)"
                >
                  <Download size={18} />
                </button>

                <button 
                  onClick={handleBackupDatabase}
                  className="p-2 text-white bg-slate-700 hover:bg-slate-600 rounded-md transition-all flex-shrink-0 active:scale-95"
                  title="Скачать базу в браузер (Локально)"
                >
                  <HardDriveDownload size={18} />
                </button>

                {/* --- КНОПКИ ЯНДЕКС ДИСК --- */}
                
                {/* 1. Загрузка (Доступна всем) */}
                <button 
                  onClick={async () => {
                    if(!confirm("Заменить текущую базу версией с Яндекс.Диска?")) return;
                    const toastId = showToast("Загрузка с Яндекса...", "success");
                    try {
                       const data = await loadFromYandexDisk();
                       if (data) {
                         setPrompts(data);
                         showToast("✅ Загружено из облака!", "success");
                         await saveToDB(STORAGE_KEY, data); // Сохраняем и локально
                       } else {
                         showToast("Файл на Диске пуст или не найден", "error");
                       }
                    } catch(e) {
                       showToast("Ошибка загрузки", "error");
                    }
                  }}
                  className="p-2 text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-all flex-shrink-0 active:scale-95 shadow-md"
                  title="Скачать с Яндекс.Диска"
                >
                  <CloudDownload size={18} />
                </button>

                {/* 2. Сохранение (С логикой Админ/Гость) */}
                {(() => {
                  const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
                  const userId = user?.id;
                  const username = user?.username || user?.first_name || "user";
                  
                  // Проверка на админа
                  const isAdmin = userId === ADMIN_ID;

                  if (isAdmin) {
                    return (
                      <button 
                        onClick={async () => {
                          if(!confirm("⚠️ Вы АДМИН.\nЭто действие ПЕРЕЗАПИШЕТ основную базу!\nПродолжить?")) return;
                          const toastId = showToast("Сохранение (Master)...", "success");
                          try {
                             await saveToYandexDisk(prompts); 
                             setLastSaved(new Date());
                             showToast("✅ Основная база обновлена!", "success");
                          } catch(e) {
                             showToast("Ошибка сохранения", "error");
                          }
                        }}
                        className="p-2 flex items-center gap-1 text-white bg-red-600 hover:bg-red-500 rounded-md transition-all flex-shrink-0 active:scale-95 shadow-md"
                        title="АДМИН: Перезаписать базу"
                      >
                        <Cloud size={18} />
                        <span className="text-[10px] font-bold">MAIN</span>
                      </button>
                    );
                  } else {
                    return (
                      <button 
                        onClick={async () => {
                          const dateStr = new Date().toISOString().slice(0,10);
                          const safeName = `suggestion_${username}_${dateStr}.json`;
                          
                          const toastId = showToast(`Сохранение копии (${username})...`, "success");
                          try {
                             await saveToYandexDisk(prompts, safeName);
                             showToast(`✅ Копия сохранена: ${safeName}`, "success");
                          } catch(e) {
                             showToast("Ошибка сохранения", "error");
                          }
                        }}
                        className="p-2 flex items-center gap-1 text-slate-900 bg-yellow-400 hover:bg-yellow-300 rounded-md transition-all flex-shrink-0 active:scale-95 shadow-md"
                        title="Предложить изменения (Сохранить копию)"
                      >
                        <Cloud size={18} />
                        <span className="text-[10px] font-bold">COPY</span>
                      </button>
                    );
                  }
                })()}
                
                {/* ---------------------------------- */}

                <div className="w-px h-6 bg-slate-700 mx-1 flex-shrink-0"></div>

                <label 
                  className="p-2 text-white bg-emerald-600/50 hover:bg-emerald-500/80 rounded-md transition-all cursor-pointer flex-shrink-0 active:scale-95 shadow-md shadow-emerald-900/30"
                  title="Загрузить базу данных (Импорт файла)"
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
          {/* ...Остальной интерфейс... */}
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
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"><XCircle size={16} /></button>
                )}
              </div>
              
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <div className="relative flex-grow sm:flex-grow-0 sm:min-w-[200px]">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <select value={selectedCategoryFilter} onChange={(e) => setSelectedCategoryFilter(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm appearance-none focus:outline-none focus:border-indigo-500 cursor-pointer text-slate-300 hover:bg-slate-900">
                    <option value="all">Все категории ({prompts.length})</option>
                    {allCategories.map(cat => (
                      <option key={cat} value={cat}>{cat} ({categoryCounts[cat] || 0})</option>
                    ))}
                  </select>
                </div>
                <div className="relative flex-grow sm:flex-grow-0 sm:min-w-[160px]">
                  <ArrowDownUp className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)} className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm appearance-none focus:outline-none focus:border-indigo-500 cursor-pointer text-slate-300 hover:bg-slate-900">
                    <option value="newest">Сначала новые</option>
                    <option value="oldest">Сначала старые</option>
                    <option value="with_photo">Сначала с фото</option>
                    <option value="without_photo">Сначала без фото</option>
                    <option value="with_notes">Сначала с примечанием</option>
                  </select>
                </div>
                {(searchQuery || selectedCategoryFilter !== 'all' || sortOrder !== 'newest') && (
                  <button onClick={resetFilters} className="p-2 bg-slate-950 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0" title="Сбросить все фильтры">
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
                  <label className="block text-sm font-medium text-slate-400 mb-2">Модель нейросети</label>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {['Flux 2', 'Nana Banana', 'Midjourney'].map(model => (
                      <button key={model} onClick={() => setSelectedModel(model)} className={`py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium border transition-all truncate ${selectedModel === model ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}>{model}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Название (Опционально)</label>
                    <input type="text" value={inputTitle} onChange={(e) => setInputTitle(e.target.value)} placeholder="ИИ придумает, если пусто" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Категория (Или своя)</label>
                    <input list="category-options" value={inputCategory} onChange={(e) => setInputCategory(e.target.value)} placeholder="Выберите или введите..." className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm" />
                    <datalist id="category-options">{VALID_CATEGORIES.map(cat => (<option key={cat} value={cat} />))}</datalist>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Референсное изображение (опционально)</label>
                  <div className={`border-2 border-dashed rounded-xl p-4 transition-colors ${uploadedImage ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-slate-700 hover:border-slate-600 bg-slate-800'}`}>
                    {uploadedImage ? (
                      <div className="relative group">
                         <img src={uploadedImage} alt="Preview" className="h-48 w-full object-contain rounded-lg" />
                         <button onClick={() => setUploadedImage(null)} className="absolute top-2 right-2 bg-red-500/80 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"><Plus className="rotate-45" size={20}/></button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center cursor-pointer h-32"><Upload className="text-slate-500 mb-2" size={24} /><span className="text-sm text-slate-400">Нажмите, чтобы загрузить</span><input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} /></label>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Ваш промпт</label>
                  <textarea value={inputPrompt} onChange={(e) => setInputPrompt(e.target.value)} placeholder="Опишите, что вы хотите сгенерировать..." className="w-full h-40 bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-400 mb-2">Примечание (Опционально)</label>
                   <textarea value={inputNote} onChange={(e) => setInputNote(e.target.value)} placeholder="Любые заметки..." className="w-full h-20 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm resize-none" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <button onClick={handleManualSave} disabled={loading || !inputPrompt.trim()} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/20 active:scale-95 flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} Сохранить</button>
                  <button onClick={handleSave} disabled={loading || !inputPrompt.trim()} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-900/20 active:scale-95 flex items-center justify-center gap-2">{loading ? (<><Loader2 className="animate-spin" size={20} />Обработка...</>) : (<><Sparkles size={20} />Сохранить и обработать</>)}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'list' && (
          <div className="space-y-12 animate-in fade-in duration-500">
            {prompts.length === 0 ? (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-800 rounded-full mb-6 text-slate-600"><Search size={40} /></div>
                <h3 className="text-xl font-semibold text-slate-300 mb-2">Здесь пока пусто</h3>
                <p className="text-slate-500 max-w-md mx-auto mb-6">Создайте свой первый промпт или загрузите базу данных.</p>
                <div className="flex justify-center gap-6">
                  <button onClick={() => setView('create')} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/20 active:scale-95 transition-all flex items-center gap-2"><Plus size={20} /> Создать промпт</button>
                  <label className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold shadow-lg border-2 border-indigo-500/30 hover:border-indigo-400 active:scale-95 transition-all cursor-pointer flex items-center gap-2"><HardDriveUpload size={20} className="text-indigo-400" /> Загрузить базу <input type="file" accept=".json" onChange={handleImport} className="hidden" /></label>
                </div>
              </div>
            ) : allFilteredPrompts.length === 0 ? (
               <div className="text-center py-20 text-slate-500"><p>Ничего не найдено по вашему запросу.</p><button onClick={resetFilters} className="text-indigo-400 mt-2 hover:underline">Сбросить фильтры</button></div>
            ) : (
              <>
                {sortedCategories.map((category) => (
                  <div key={category} className="space-y-4">
                    <div className="flex items-center gap-4"><h2 className="text-2xl font-bold text-white tracking-tight pl-2 border-l-4 border-indigo-500">{category}</h2><div className="h-px flex-grow bg-slate-800"></div></div>
                    <div className="grid grid-cols-1 gap-6">{groupedPrompts[category].map((prompt) => (<PromptCard key={prompt.id} data={prompt} index={allFilteredPrompts.indexOf(prompt)} onDelete={handleDelete} onCategoryUpdate={handleCategoryUpdate} onEdit={setEditingPrompt} onUsageUpdate={handleUsageUpdate} onAddHistory={handleAddHistory}/>))}</div>
                  </div>
                ))}
                {hasMore && (<div className="flex justify-center pt-8"><button onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)} className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full font-medium transition-all shadow-lg border border-slate-700 hover:border-slate-500"><ChevronDown size={20} /> Показать еще ({allFilteredPrompts.length - visibleCount})</button></div>)}
                <div className="text-center text-slate-600 text-xs mt-6 flex flex-col items-center gap-2"><span>Показано {Math.min(visibleCount, allFilteredPrompts.length)} из {allFilteredPrompts.length} промптов</span>{lastSaved && (<div className="flex items-center gap-1.5 text-slate-500/80 bg-slate-900/50 px-3 py-1 rounded-full border border-slate-800"><span>Сохранено: {lastSaved.toLocaleTimeString('ru-RU')}</span></div>)}</div>
              </>
            )}
          </div>
        )}
      </main>

      {showScrollTopButton && (
        <button onClick={scrollToTop} className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 hover:scale-110 active:scale-100" title="Наверх"><ChevronUp size={24} /></button>
      )}
    </div>
  );
}

export default App;
