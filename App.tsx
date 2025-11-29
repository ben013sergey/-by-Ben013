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

      const newEntry: PromptData = {
        id: generateId(),
        originalPrompt: inputPrompt,
        model: selectedModel,
        category: finalCategory,
        shortTitle: finalTitle,
        variants: {
            male: inputPrompt,
            female: inputPrompt,
            unisex: inputPrompt
        },
        imageBase64: uploadedImage,
        note: inputNote.trim() || undefined,
        usageCount: 0,
        createdAt: Date.now(),
        generationHistory: []
      };

      setPrompts(prev => [newEntry, ...prev]);
      showToast("Промпт сохранен (без обработки)!");
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
        // Limit history to 5 items
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

  // CATEGORY COUNT CALCULATION
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
                  <Down
