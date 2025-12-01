import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Loader2, Sparkles, FolderOpen, Upload, Filter, 
  ArrowDownUp, XCircle, MessageCircle, FileText, HardDriveDownload, 
  HardDriveUpload, CheckCircle2, AlertCircle, Save, ChevronDown, 
  Trash2, X, Download, RefreshCw, Wand2, Code, Database, ChevronUp, 
  Send, Cloud, CloudDownload, Lock, Scaling, AlertTriangle, ArrowLeft 
} from 'lucide-react';

import { PromptData, VALID_CATEGORIES, GeneratedImage, AspectRatio } from './types';
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
        openTelegramLink: (url: string) => void;
        BackButton: {
            show: () => void;
            hide: () => void;
            onClick: (cb: () => void) => void;
        }
        expand: () => void;
      }
    }
  }
}

const STORAGE_KEY = 'promptvault_data_v1';
const DRAFT_KEY = 'promptvault_create_draft';
const ITEMS_PER_PAGE = 20;
// ВАШ ID
const ADMIN_ID = 439014866; 
const CHANNEL_LINK = "https://t.me/ben013_promt_gallery"; 

// --- ФУНКЦИЯ СРАВНЕНИЯ ТЕКСТА ---
function compareStrings(string1: string, string2: string): number {
  if (!string1 || !string2) return 0;
  // Оптимизация для мобильных: если длина сильно разная, не тратим ресурсы
  if (Math.abs(string1.length - string2.length) > Math.max(string1.length, string2.length) * 0.5) {
    return 0;
  }

  const s1 = string1.toLowerCase().replace(/[^a-zа-яё0-9]/g, '');
  const s2 = string2.toLowerCase().replace(/[^a-zа-яё0-9]/g, '');
  
  if (s1 === s2) return 1;
  if (s1.length < 3 || s2.length < 3) return 0;

  const bigrams = new Map();
  for (let i = 0; i < s1.length - 1; i++) {
    const bigram = s1.substring(i, i + 2);
    const count = bigrams.has(bigram) ? bigrams.get(bigram) + 1 : 1;
    bigrams.set(bigram, count);
  }

  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bigram = s2.substring(i, i + 2);
    const count = bigrams.has(bigram) ? bigrams.get(bigram) : 0;
    if (count > 0) {
      bigrams.set(bigram, count - 1);
      intersection++;
    }
  }

  return (2.0 * intersection) / (s1.length + s2.length - 2);
}

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => (
  <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border animate-in slide-in-from-bottom-5 fade-in duration-300 ${
    type === 'success' ? 'bg-slate-800 border-green-500/30 text-green-400' : 'bg-slate-800 border-red-500/30 text-red-400'
  }`}>
    {type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
    <span className="font-medium text-sm text-slate-200">{message}</span>
  </div>
);

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

function App() {
  const [prompts, setPrompts] = useState<PromptData[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

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

  // --- ОПРЕДЕЛЕНИЕ ПРАВ ---
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const userId = tgUser?.id;
  const urlParams = new URLSearchParams(window.location.search);
  const urlPass = urlParams.get('uid');

  // Админ если: ID совпадает ИЛИ введен пароль в URL
  const isAdmin = (userId === ADMIN_ID) || (urlPass === 'ben013');

  // --- ЛОГИКА ДОСТУПА ---
  useEffect(() => {
    const checkSubscription = async () => {
      // 1. Если Админ - пускаем сразу (даже если нет ID, но есть пароль)
      if (isAdmin) { 
        setHasAccess(true); 
        return; 
      }

      // 2. Если не Админ и нет ID (просто браузер) - блокируем
      if (!userId) { 
        setHasAccess(false); 
        return; 
      }

      // 3. Обычный пользователь в Телеграме - пускаем
      setHasAccess(true); 
    };
    checkSubscription();
  }, [userId, isAdmin]);

  // --- НАСТРОЙКИ ТЕЛЕГРАМА ---
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.expand();
      if (view === 'create') {
        window.Telegram.WebApp.BackButton.show();
        window.Telegram.WebApp.BackButton.onClick(() => { setView('list'); clearCreateForm(); });
      } else {
        window.Telegram.WebApp.BackButton.hide();
      }
    }
  }, [view]);

  // --- ПРОВЕРКА ДУБЛИКАТОВ (Порог 70%) ---
  const checkAndConfirmDuplicate = (text: string): boolean => {
    if (text.length < 10) return true;

    let maxSimilarity = 0;
    let match: PromptData | null = null;

    for (const p of prompts) {
      const sim1 = compareStrings(text, p.originalPrompt);
      const sim2 = compareStrings(text, p.variants.maleEn || '');
      const currentMax = Math.max(sim1, sim2);

      if (currentMax > maxSimilarity) {
        maxSimilarity = currentMax;
        match = p;
      }
      if (maxSimilarity > 0.95) break; 
    }

    if (maxSimilarity > 0.70 && match) {
        const userChoice = window.confirm(
            `⚠️ НАЙДЕН ДУБЛИКАТ (${Math.round(maxSimilarity * 100)}%)\n\n` +
            `Название: "${match.shortTitle}"\n` +
            `Нажмите ОК, чтобы все равно сохранить.\n` +
            `Нажмите Отмена, чтобы посмотреть существующий.`
        );

        if (userChoice) {
            return true;
        } else {
            setView('list');
            setSearchQuery(match.shortTitle);
            clearCreateForm();
            return false;
        }
    }
    return true; 
  };

  useEffect(() => { promptsRef.current = prompts; }, [prompts]);

  useEffect(() => {
    const handleScroll = () => setShowScrollTopButton(window.scrollY > 300);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // Загрузка
  useEffect(() => {
    if (hasAccess !== true) return;

    const loadData = async () => {
      setIsDataLoaded(false); 
      try {
        const cloudData = await loadFromYandexDisk();
        if (cloudData && Array.isArray(cloudData) && cloudData.length > 0) {
          const protectedData = cloudData.map((p: any) => ({ ...p, isSystem: true }));
          setPrompts(protectedData);
          showToast("☁️ База синхронизирована!", "success");
          await saveToDB(STORAGE_KEY, protectedData);
        } else {
          const dbPrompts = await loadFromDB<PromptData[]>(STORAGE_KEY);
          if (dbPrompts) setPrompts(dbPrompts);
        }
      } catch (e) {
        const dbPrompts = await loadFromDB<PromptData[]>(STORAGE_KEY);
        if (dbPrompts) setPrompts(dbPrompts);
      } finally {
        setIsDataLoaded(true);
      }
    };
    loadData();
  }, [hasAccess]);

  useEffect(() => {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft && view === 'create' && !inputPrompt) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.inputPrompt) setInputPrompt(parsed.inputPrompt);
        if (parsed.inputTitle) setInputTitle(parsed.inputTitle);
        if (parsed.inputCategory) setInputCategory(parsed.inputCategory);
        if (parsed.inputNote) setInputNote(parsed.inputNote);
        if (parsed.selectedModel) setSelectedModel(parsed.selectedModel);
      } catch (e) {}
    }
  }, [view]); 

  useEffect(() => {
    if (view === 'create') {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ inputPrompt, inputTitle, inputCategory, inputNote, selectedModel }));
    }
  }, [inputPrompt, inputTitle, inputCategory, inputNote, selectedModel, view]);

  useEffect(() => {
    if (!isDataLoaded) return;
    saveToDB(STORAGE_KEY, prompts).catch(console.error);
  }, [prompts, isDataLoaded]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000); 
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => { setVisibleCount(ITEMS_PER_PAGE); }, [searchQuery, selectedCategoryFilter, sortOrder]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type });

  const handleApplyInternalExamples = () => { showToast("Примеры отключены"); };

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
      showToast("Скачано локально", "success");
    } catch (e) {
      showToast("Ошибка экспорта", "error");
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
        showToast(`Импортировано ${importedData.length}!`);
        e.target.value = '';
      } catch (err) { showToast("Ошибка файла", "error"); }
    };
    reader.readAsText(file);
  };

  const processImportedData = (importedData: any) => {
    if (!Array.isArray(importedData)) return;
    setPrompts(prev => {
      const newMap = new Map(prev.map(p => [p.id, p]));
      importedData.forEach((item: PromptData) => {
        if (!item.id) item.id = generateId();
        newMap.set(item.id, { ...item, isSystem: false }); 
      });
      return Array.from(newMap.values());
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const reader = new FileReader(); reader.onloadend = () => setUploadedImage(reader.result as string); reader.readAsDataURL(file); }
  };

  const clearCreateForm = () => {
    setInputPrompt(''); 
    setInputTitle(''); 
    setInputCategory(''); 
    setInputNote(''); 
    setUploadedImage(null);
    localStorage.removeItem(DRAFT_KEY); 
  };

  const handleOpenCreate = () => {
      clearCreateForm(); 
      setView('create'); 
  };

  const handleManualSave = async () => {
    if (!inputPrompt.trim()) return;
    if (!checkAndConfirmDuplicate(inputPrompt)) return;

    setLoading(true);
    try {
      const text = inputPrompt;
      const newEntry: PromptData = {
        id: generateId(), originalPrompt: text, model: selectedModel, category: inputCategory || "Другое", shortTitle: inputTitle || "Без названия",
        variants: { maleEn: text, maleRu: text, femaleEn: text, femaleRu: text, unisexEn: text, unisexRu: text, male: text, female: text, unisex: text },
        imageBase64: uploadedImage, note: inputNote.trim(), usageCount: 0, createdAt: Date.now(), generationHistory: [], isSystem: false
      };
      setPrompts(prev => [newEntry, ...prev]);
      showToast("Сохранено!"); 
      clearCreateForm(); 
      setView('list');
    } catch (error) { showToast("Ошибка", "error"); } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!inputPrompt.trim()) return;
    if (!checkAndConfirmDuplicate(inputPrompt)) return;

    setLoading(true);
    try {
      const analysis = await analyzePrompt(inputPrompt);
      const newEntry: PromptData = {
        id: generateId(), originalPrompt: inputPrompt, model: selectedModel, category: inputCategory || analysis.category, shortTitle: inputTitle || analysis.shortTitle,
        variants: analysis.variants, imageBase64: uploadedImage, note: inputNote.trim(), usageCount: 0, createdAt: Date.now(), generationHistory: [], isSystem: false
      };
      setPrompts(prev => [newEntry, ...prev]);
      showToast("Обработано и сохранено!"); 
      clearCreateForm(); 
      setView('list');
    } catch (error) { showToast("Ошибка AI", "error"); } finally { setLoading(false); }
  };

  const handleDelete = (id: string) => {
    if(confirm('Удалить?')) setPrompts(prev => prev.filter(p => p.id !== id));
  };
  
  const handleCategoryUpdate = (id: string, cat: string) => setPrompts(prev => prev.map(p => p.id === id ? { ...p, category: cat } : p));
  const handleUsageUpdate = (id: string) => setPrompts(prev => prev.map(p => p.id === id ? { ...p, usageCount: (p.usageCount || 0) + 1 } : p));
  const handleAddHistory = (id: string, img: GeneratedImage) => setPrompts(prev => prev.map(p => p.id === id ? { ...p, generationHistory: [img, ...(p.generationHistory||[])].slice(0,5) } : p));
  const handleUpdatePrompt = (ud: PromptData) => { setPrompts(prev => prev.map(p => p.id === ud.id ? ud : p)); setEditingPrompt(null); };
  
  const resetFilters = () => { setSearchQuery(''); setSelectedCategoryFilter('all'); setSortOrder('newest'); };

  const allCategories = Array.from(new Set(prompts.map(p => p.category || 'Без категории')));
  const allFilteredPrompts = prompts.filter(p => {
    const s = searchQuery.toLowerCase();
    const matches = p.shortTitle.toLowerCase().includes(s) || p.originalPrompt.toLowerCase().includes(s);
    const cat = selectedCategoryFilter === 'all' || p.category === selectedCategoryFilter;
    return matches && cat;
  }).sort((a, b) => {
    if (sortOrder === 'with_notes') return (a.note ? -1 : 1);
    if (sortOrder === 'with_photo') return (a.imageBase64 ? -1 : 1);
    if (sortOrder === 'without_photo') return (!a.imageBase64 ? -1 : 1);
    if (sortOrder === 'oldest') return a.createdAt - b.createdAt;
    return b.createdAt - a.createdAt; 
  });

  const visiblePrompts = allFilteredPrompts.slice(0, visibleCount);
  const groupedPrompts = visiblePrompts.reduce((acc, p) => { const c = p.category || 'Без категории'; if (!acc[c]) acc[c] = []; acc[c].push(p); return acc; }, {} as any);
  const sortedCategories = Object.keys(groupedPrompts).sort();


  // --- РЕНДЕРИНГ ---

  if (hasAccess === null) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>;
  
  if (hasAccess === false) return <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-6"><div className="bg-red-500/10 p-6 rounded-2xl border border-red-500/20 max-w-sm"><Lock size={48} className="mx-auto text-red-500 mb-4" /><h2 className="text-2xl font-bold text-white mb-2">Доступ закрыт</h2><a href={CHANNEL_LINK} className="block w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold mt-4">Подписаться</a></div></div>;

  if (!isDataLoaded) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>;

  // --- ЭКРАН СОЗДАНИЯ ---
  if (view === 'create') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto w-full h-full">
        <div className="max-w-2xl mx-auto p-4 min-h-screen">
          <div className="flex items-center justify-between mb-6 sticky top-0 bg-slate-950/95 backdrop-blur py-2 z-10">
             <button onClick={() => { setView('list'); clearCreateForm(); }} className="p-2 -ml-2 text-slate-400 hover:text-white"><ArrowLeft size={24} /></button>
             <h2 className="text-xl font-bold text-white">Новый промпт</h2>
             <div className="w-8"></div>
          </div>
          
          <div className="space-y-6 pb-20">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Модель</label>
              <div className="grid grid-cols-3 gap-2">
                {['Flux 2', 'Nana Banana', 'Midjourney'].map(model => (
                  <button key={model} onClick={() => setSelectedModel(model)} className={`py-2 px-1 text-[10px] sm:text-xs font-medium border rounded-lg transition-all ${selectedModel === model ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{model}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Название</label>
                <input type="text" value={inputTitle} onChange={(e) => setInputTitle(e.target.value)} placeholder="Авто..." className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Категория</label>
                <input list="cat-opts" value={inputCategory} onChange={(e) => setInputCategory(e.target.value)} placeholder="Выберите..." className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:border-indigo-500" />
                <datalist id="cat-opts">{VALID_CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Референс</label>
              <div className={`border-2 border-dashed rounded-xl p-4 transition-colors ${uploadedImage ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-slate-700 hover:border-slate-600 bg-slate-800'}`}>
                {uploadedImage ? (
                  <div className="relative group">
                     <img src={uploadedImage} alt="Preview" className="h-48 w-full object-contain rounded-lg" />
                     <button onClick={() => setUploadedImage(null)} className="absolute top-2 right-2 bg-red-500/80 p-1 rounded-full text-white"><X size={20}/></button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center cursor-pointer h-24">
                    <Upload className="text-slate-500 mb-2" size={24} />
                    <span className="text-xs text-slate-400">Нажмите для загрузки</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Промпт</label>
              <textarea value={inputPrompt} onChange={(e) => setInputPrompt(e.target.value)} placeholder="Ваш запрос..." className="w-full h-40 bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-200 focus:border-indigo-500 resize-none" />
            </div>

            <div>
               <label className="block text-sm font-medium text-slate-400 mb-2">Заметка</label>
               <textarea value={inputNote} onChange={(e) => setInputNote(e.target.value)} placeholder="Доп. инфо..." className="w-full h-20 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:border-indigo-500 resize-none" />
            </div>

            <div className="grid grid-cols-1 gap-3 pt-2 pb-10">
              <button onClick={handleSave} disabled={loading || !inputPrompt.trim()} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-900/30">
                {loading ? <Loader2 className="animate-spin inline mr-2" /> : <Sparkles className="inline mr-2" />} Сохранить и обработать
              </button>
              
              <button onClick={handleManualSave} disabled={loading || !inputPrompt.trim()} className="w-full py-3 bg-emerald-600/80 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-medium rounded-xl transition-all">
                {loading ? <Loader2 className="animate-spin inline mr-2" /> : <Save className="inline mr-2" />} Просто сохранить
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- СПИСОК (ОСНОВНОЙ ЭКРАН) ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans pb-24 overflow-x-hidden">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {editingPrompt && <EditPromptModal isOpen={!!editingPrompt} onClose={() => setEditingPrompt(null)} onSave={handleUpdatePrompt} initialData={editingPrompt} />}

      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col gap-3">
          
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => scrollToTop()}>
                <div className="bg-indigo-600 p-1.5 rounded-lg"><Sparkles className="text-white w-4 h-4" /></div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent hidden sm:block">Галерея</h1>
                <h1 className="text-lg font-bold text-indigo-400 sm:hidden">PVault</h1>
            </div>
            
            <div className="flex items-center gap-2">
                <button onClick={handleApplyInternalExamples} className="p-2 text-slate-400 bg-slate-800 rounded-lg"><Database size={18} /></button>
                <button onClick={async () => { if(!confirm("Загрузить базу?")) return; const data = await loadFromYandexDisk(); if(data) { const protectedData = data.map((p: any) => ({ ...p, isSystem: true })); setPrompts(protectedData); showToast("Обновлено!"); } }} className="p-2 text-white bg-blue-600 rounded-lg shadow-md"><CloudDownload size={18} /></button>
                
                {isAdmin ? (
                  <button onClick={async () => { if(!confirm("Перезаписать?")) return; await saveToYandexDisk(prompts); showToast("Сохранено (Main)"); }} className="p-2 text-white bg-red-600 rounded-lg shadow-md"><Cloud size={18} /></button>
                ) : (
                  <button onClick={async () => { /* User copy logic */ }} className="p-2 text-slate-900 bg-yellow-400 rounded-lg shadow-md"><Cloud size={18} /></button>
                )}
                
                {isAdmin && <label className="p-2 text-white bg-emerald-600 rounded-lg cursor-pointer"><HardDriveUpload size={18} /><input type="file" accept=".json" onChange={handleImport} className="hidden" /></label>}
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
             <div className="relative w-full">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
               <input type="text" placeholder="Поиск..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-8 py-2 text-sm focus:border-indigo-500" />
               {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 p-1"><XCircle size={14} /></button>}
             </div>
             
             <div className="flex gap-2 w-full overflow-x-auto no-scrollbar">
               <select value={selectedCategoryFilter} onChange={(e) => setSelectedCategoryFilter(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-sm text-slate-300 flex-grow min-w-[140px]">
                 <option value="all">Все категории</option>
                 {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
               </select>
               <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-sm text-slate-300 flex-grow min-w-[140px]">
                  <option value="newest">Сначала новые</option>
                  <option value="oldest">Сначала старые</option>
                  <option value="with_photo">С фото</option>
                  <option value="without_photo">Без фото</option>
                  <option value="with_notes">С прим.</option>
               </select>
               
               {(searchQuery || selectedCategoryFilter !== 'all' || sortOrder !== 'newest') && (
                 <button
                    onClick={resetFilters}
                    className="p-2 bg-slate-950 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
                    title="Сбросить фильтры"
                 >
                    <RefreshCw size={18} />
                 </button>
               )}
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="space-y-8">
          {sortedCategories.map(cat => (
            <div key={cat}>
              <h2 className="text-lg font-bold text-white mb-3 border-l-4 border-indigo-500 pl-2">{cat}</h2>
              <div className="grid gap-4">
                {groupedPrompts[cat].map((p: any) => (
                  <PromptCard 
                    key={p.id} 
                    data={p} 
                    index={allFilteredPrompts.indexOf(p)} 
                    onDelete={handleDelete} 
                    onEdit={setEditingPrompt} 
                    onCategoryUpdate={handleCategoryUpdate} 
                    onUsageUpdate={handleUsageUpdate} 
                    onAddHistory={handleAddHistory}
                    isAdmin={isAdmin}  // <--- ВОТ ТУТ МЫ ВЕРНУЛИ ВАЖНУЮ ДЕТАЛЬ
                  />
                ))}
              </div>
            </div>
          ))}
          {allFilteredPrompts.length === 0 && <div className="text-center text-slate-500 py-10">Ничего не найдено</div>}
        </div>
      </main>

      <button 
        onClick={handleOpenCreate} 
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-indigo-900/50 hover:scale-110 active:scale-95 transition-all"
      >
        <Plus size={28} />
      </button>

      {showScrollTopButton && (
        <button onClick={scrollToTop} className="fixed bottom-24 right-7 z-40 w-10 h-10 bg-slate-700/80 text-white rounded-full flex items-center justify-center shadow-lg backdrop-blur"><ChevronUp size={20} /></button>
      )}
    </div>
  );
}

export default App;
