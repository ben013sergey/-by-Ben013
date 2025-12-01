import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Loader2, Sparkles, FolderOpen, Upload, Filter, 
  ArrowDownUp, XCircle, MessageCircle, FileText, HardDriveDownload, 
  HardDriveUpload, CheckCircle2, AlertCircle, Save, ChevronDown, 
  Trash2, X, Download, RefreshCw, Wand2, Code, Database, ChevronUp, 
  Send, Cloud, CloudDownload, Lock, Scaling 
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
      }
    }
  }
}

const STORAGE_KEY = 'promptvault_data_v1';
const DRAFT_KEY = 'promptvault_create_draft';
const ITEMS_PER_PAGE = 20;
// ВАШ ID (Замените на свой, если он другой)
const ADMIN_ID = 439014866; 
const CHANNEL_LINK = "https://t.me/ben013_promt_gallery"; 

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => (
  <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border animate-in slide-in-from-bottom-5 fade-in duration-300 ${
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

  // Form states
  const [inputPrompt, setInputPrompt] = useState('');
  const [inputTitle, setInputTitle] = useState('');
  const [inputCategory, setInputCategory] = useState('');
  const [inputNote, setInputNote] = useState('');
  const [selectedModel, setSelectedModel] = useState('Flux 2');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'with_photo' | 'without_photo' | 'with_notes'>('newest');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [showScrollTopButton, setShowScrollTopButton] = useState(false);

  // --- ПОЛУЧЕНИЕ ЮЗЕРА ---
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const userId = tgUser?.id;
  let username = tgUser?.username || tgUser?.first_name || "Guest";
  
  const urlParams = new URLSearchParams(window.location.search);
  const urlPass = urlParams.get('uid');

  let isAdmin = false;
  if (userId === ADMIN_ID) isAdmin = true;
  if (urlPass === 'ben013') { isAdmin = true; username = "Admin (Browser)"; }

  // --- ПРОВЕРКА ДОСТУПА ---
  useEffect(() => {
    const checkSubscription = async () => {
      if (isAdmin) { setHasAccess(true); return; }
      if (!userId) { setHasAccess(false); return; } // Блокируем браузер без ID

      try {
        // Здесь можно раскомментировать проверку подписки, если API работает
        // const res = await fetch('/api/check-sub', ...);
        setHasAccess(true); // Пока пускаем всех из телеграма
      } catch (error) {
        setHasAccess(true); 
      }
    };
    checkSubscription();
  }, [userId, isAdmin]);

  // --- ЭФФЕКТЫ ---
  useEffect(() => { promptsRef.current = prompts; }, [prompts]);

  useEffect(() => {
    const handleScroll = () => setShowScrollTopButton(window.scrollY > 300);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // Загрузка данных
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

  // Черновики
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
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (view === 'create') {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ inputPrompt, inputTitle, inputCategory, inputNote, selectedModel }));
    }
  }, [inputPrompt, inputTitle, inputCategory, inputNote, selectedModel, view]);

  // Автосохранение локально
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

  // --- ФУНКЦИИ ---
  
  const handleApplyInternalExamples = () => {
    // Упрощенная версия для примера
    showToast("Примеры пока отключены для экономии места");
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
      showToast("Скачано на устройство", "success");
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
        showToast(`Импортировано ${importedData.length} промптов!`);
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
        // При импорте ставим isSystem: false, чтобы их можно было редактировать
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
    setInputPrompt(''); setInputTitle(''); setInputCategory(''); setInputNote(''); setUploadedImage(null);
    localStorage.removeItem(DRAFT_KEY); setView('list');
  };

  const handleManualSave = async () => {
    if (!inputPrompt.trim()) return;
    setLoading(true);
    try {
      const text = inputPrompt;
      const newEntry: PromptData = {
        id: generateId(), originalPrompt: text, model: selectedModel, category: inputCategory || "Другое", shortTitle: inputTitle || "Без названия",
        variants: { maleEn: text, maleRu: text, femaleEn: text, femaleRu: text, unisexEn: text, unisexRu: text, male: text, female: text, unisex: text },
        imageBase64: uploadedImage, note: inputNote.trim(), usageCount: 0, createdAt: Date.now(), generationHistory: [], isSystem: false
      };
      setPrompts(prev => [newEntry, ...prev]);
      showToast("Сохранено!"); clearCreateForm();
    } catch (error) { showToast("Ошибка", "error"); } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!inputPrompt.trim()) return;
    setLoading(true);
    try {
      const analysis = await analyzePrompt(inputPrompt);
      const newEntry: PromptData = {
        id: generateId(), originalPrompt: inputPrompt, model: selectedModel, category: inputCategory || analysis.category, shortTitle: inputTitle || analysis.shortTitle,
        variants: analysis.variants, imageBase64: uploadedImage, note: inputNote.trim(), usageCount: 0, createdAt: Date.now(), generationHistory: [], isSystem: false
      };
      setPrompts(prev => [newEntry, ...prev]);
      showToast("Обработано и сохранено!"); clearCreateForm();
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

  // --- ФИЛЬТРАЦИЯ ---
  const allCategories = Array.from(new Set(prompts.map(p => p.category || 'Без категории')));
  const categoryCounts = prompts.reduce((acc, p) => { const c = p.category || 'Без категории'; acc[c] = (acc[c] || 0) + 1; return acc; }, {} as any);
  
  const allFilteredPrompts = prompts.filter(p => {
    const s = searchQuery.toLowerCase();
    const matches = p.shortTitle.toLowerCase().includes(s) || p.originalPrompt.toLowerCase().includes(s);
    const cat = selectedCategoryFilter === 'all' || p.category === selectedCategoryFilter;
    return matches && cat;
  }).sort((a, b) => {
    // Ваша логика сортировки
    if (sortOrder === 'with_notes') return (a.note ? -1 : 1);
    if (sortOrder === 'with_photo') return (a.imageBase64 ? -1 : 1);
    if (sortOrder === 'without_photo') return (!a.imageBase64 ? -1 : 1);
    if (sortOrder === 'oldest') return a.createdAt - b.createdAt;
    return b.createdAt - a.createdAt; // newest
  });

  const visiblePrompts = allFilteredPrompts.slice(0, visibleCount);
  const groupedPrompts = visiblePrompts.reduce((acc, p) => { const c = p.category || 'Без категории'; if (!acc[c]) acc[c] = []; acc[c].push(p); return acc; }, {} as any);
  const sortedCategories = Object.keys(groupedPrompts).sort();


  // --- РЕНДЕРИНГ ---

  if (hasAccess === null) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>;
  
  if (hasAccess === false) return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-6">
        <div className="bg-red-500/10 p-6 rounded-2xl border border-red-500/20 max-w-sm">
          <Lock size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Доступ закрыт</h2>
          <a href={CHANNEL_LINK} className="block w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold mt-4">Подписаться</a>
        </div>
      </div>
  );

  if (!isDataLoaded) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans pb-20 overflow-x-hidden">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {editingPrompt && <EditPromptModal isOpen={!!editingPrompt} onClose={() => setEditingPrompt(null)} onSave={handleUpdatePrompt} initialData={editingPrompt} />}

      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('list')}>
                <div className="bg-indigo-600 p-2 rounded-lg"><Sparkles className="text-white w-5 h-5" /></div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Галерея промптов</h1>
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto max-w-full no-scrollbar pb-1">
                <button 
                  onClick={handleApplyInternalExamples}
                  className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-700/80 rounded-md transition-all relative flex-shrink-0"
                  title="Применить примеры"
                >
                  <Database size={18} />
                </button>

                <div className="w-px h-6 bg-slate-700 mx-1 flex-shrink-0"></div>

                <button 
                  onClick={async () => {
                    if(!confirm("Загрузить базу с Яндекса?")) return;
                    const data = await loadFromYandexDisk();
                    if(data) {
                       const protectedData = data.map((p: any) => ({ ...p, isSystem: true }));
                       setPrompts(protectedData);
                       showToast("База обновлена!");
                    }
                  }}
                  className="p-2 text-white bg-blue-600 hover:bg-blue-500 rounded-md shadow-md flex-shrink-0"
                >
                  <CloudDownload size={18} />
                </button>

                {isAdmin ? (
                  <button 
                    onClick={async () => {
                      if(!confirm("Перезаписать базу на Яндексе?")) return;
                      await saveToYandexDisk(prompts);
                      showToast("✅ База обновлена (Main)");
                    }}
                    className="p-2 flex items-center gap-1 text-white bg-red-600 hover:bg-red-500 rounded-md shadow-md flex-shrink-0"
                  >
                    <Cloud size={18} /><span className="text-[10px] font-bold">MAIN</span>
                  </button>
                ) : (
                  <button 
                    onClick={async () => {
                      const userPrompts = prompts.filter(p => p.isSystem === false);
                      if (userPrompts.length === 0) { showToast("Нет новых промптов", "error"); return; }
                      const safeName = `suggestion_${username}_${new Date().toISOString().slice(0,10)}.json`;
                      await saveToYandexDisk(userPrompts, safeName);
                      showToast("✅ Копия отправлена админу!");
                    }}
                    className="p-2 flex items-center gap-1 text-slate-900 bg-yellow-400 hover:bg-yellow-300 rounded-md shadow-md flex-shrink-0"
                  >
                    <Cloud size={18} /><span className="text-[10px] font-bold">COPY</span>
                  </button>
                )}

                <div className="w-px h-6 bg-slate-700 mx-1 flex-shrink-0"></div>

                <button 
                  onClick={handleBackupDatabase}
                  className="p-2 text-white bg-slate-700 hover:bg-slate-600 rounded-md transition-all flex-shrink-0"
                  title="Скачать JSON локально"
                >
                  <HardDriveDownload size={18} />
                </button>

                {/* --- КНОПКА ИМПОРТА (ТОЛЬКО ДЛЯ АДМИНА) --- */}
                {isAdmin && (
                  <label 
                    className="p-2 text-white bg-emerald-600/50 hover:bg-emerald-500/80 rounded-md transition-all cursor-pointer flex-shrink-0"
                    title="Импорт из файла"
                  >
                    <HardDriveUpload size={18} />
                    <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                  </label>
                )}

                <div className="w-px h-6 bg-slate-700 mx-1 flex-shrink-0"></div>

                <button 
                  onClick={() => setView(view === 'list' ? 'create' : 'list')} 
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium shadow-lg flex-shrink-0"
                >
                  {view === 'list' ? <><Plus size={18} /><span>Новый</span></> : <><FolderOpen size={18} /><span>Просмотр</span></>}
                </button>
            </div>
          </div>
          
          {/* Поиск и фильтры - АДАПТИРОВАНЫ ДЛЯ МОБИЛЬНЫХ */}
          {view === 'list' && (
             <div className="flex flex-col sm:flex-row gap-2">
               <div className="relative flex-grow">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                 <input type="text" placeholder="Поиск..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-sm focus:border-indigo-500" />
                 {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"><XCircle size={16} /></button>}
               </div>
               
               <div className="flex gap-2">
                 <select value={selectedCategoryFilter} onChange={(e) => setSelectedCategoryFilter(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-sm text-slate-300 flex-grow sm:flex-grow-0 min-w-[120px]">
                   <option value="all">Все категории</option>
                   {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>

                 <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-sm text-slate-300 flex-grow sm:flex-grow-0 min-w-[140px]">
                    <option value="newest">Сначала новые</option>
                    <option value="oldest">Сначала старые</option>
                    <option value="with_photo">Сначала с фото</option>
                    <option value="without_photo">Сначала без фото</option>
                    <option value="with_notes">Сначала с прим.</option>
                 </select>
               </div>
             </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        
        {/* --- ПОЛНАЯ ФОРМА СОЗДАНИЯ (Теперь одинаковая для всех устройств) --- */}
        {view === 'create' && (
          <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-white mb-6">Добавить новый промпт</h2>
            
            <div className="space-y-6">
              {/* Модель */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Модель нейросети</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Flux 2', 'Nana Banana', 'Midjourney'].map(model => (
                    <button key={model} onClick={() => setSelectedModel(model)} className={`py-2 px-2 text-xs font-medium border rounded-lg transition-all ${selectedModel === model ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{model}</button>
                  ))}
                </div>
              </div>

              {/* Название и Категория */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Название</label>
                  <input type="text" value={inputTitle} onChange={(e) => setInputTitle(e.target.value)} placeholder="Авто или своё..." className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-slate-200 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Категория</label>
                  <input list="cat-opts" value={inputCategory} onChange={(e) => setInputCategory(e.target.value)} placeholder="Выберите..." className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-slate-200 focus:border-indigo-500" />
                  <datalist id="cat-opts">{VALID_CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
                </div>
              </div>

              {/* Фото */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Референс (Опционально)</label>
                <div className={`border-2 border-dashed rounded-xl p-4 transition-colors ${uploadedImage ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-slate-700 hover:border-slate-600 bg-slate-800'}`}>
                  {uploadedImage ? (
                    <div className="relative group">
                       <img src={uploadedImage} alt="Preview" className="h-48 w-full object-contain rounded-lg" />
                       <button onClick={() => setUploadedImage(null)} className="absolute top-2 right-2 bg-red-500/80 p-1 rounded-full text-white"><X size={20}/></button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center cursor-pointer h-32">
                      <Upload className="text-slate-500 mb-2" size={24} />
                      <span className="text-sm text-slate-400">Нажмите для загрузки</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  )}
                </div>
              </div>

              {/* Промпт */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Промпт</label>
                <textarea value={inputPrompt} onChange={(e) => setInputPrompt(e.target.value)} placeholder="Ваш запрос..." className="w-full h-40 bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-200 focus:border-indigo-500 resize-none" />
              </div>

              {/* Заметка */}
              <div>
                 <label className="block text-sm font-medium text-slate-400 mb-2">Заметка</label>
                 <textarea value={inputNote} onChange={(e) => setInputNote(e.target.value)} placeholder="Доп. инфо..." className="w-full h-20 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:border-indigo-500 resize-none" />
              </div>

              {/* Кнопки */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <button onClick={handleManualSave} disabled={loading || !inputPrompt.trim()} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold rounded-xl transition-all">
                  {loading ? <Loader2 className="animate-spin inline mr-2" /> : <Save className="inline mr-2" />} Сохранить
                </button>

                <button onClick={handleSave} disabled={loading || !inputPrompt.trim()} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold rounded-xl transition-all">
                  {loading ? <Loader2 className="animate-spin inline mr-2" /> : <Sparkles className="inline mr-2" />} Сохранить и обработать
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'list' && (
          <div className="space-y-8">
            {sortedCategories.map(cat => (
              <div key={cat}>
                <h2 className="text-xl font-bold text-white mb-4 border-l-4 border-indigo-500 pl-2">{cat}</h2>
                <div className="grid gap-6">
                  {groupedPrompts[cat].map((p: any) => (
                    <PromptCard 
                      key={p.id} data={p} index={allFilteredPrompts.indexOf(p)} 
                      onDelete={handleDelete} onEdit={setEditingPrompt} 
                      onCategoryUpdate={handleCategoryUpdate} onUsageUpdate={handleUsageUpdate} 
                      onAddHistory={handleAddHistory}
                    />
                  ))}
                </div>
              </div>
            ))}
            {allFilteredPrompts.length === 0 && <div className="text-center text-slate-500 py-10">Ничего не найдено</div>}
          </div>
        )}
      </main>

      {showScrollTopButton && (
        <button onClick={scrollToTop} className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-100"><ChevronUp size={24} /></button>
      )}
    </div>
  );
}

export default App;
