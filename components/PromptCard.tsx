import React, { useState, useRef, useEffect } from 'react';
import { PromptData, VALID_CATEGORIES, AspectRatio, GeneratedImage } from '../types';
import { Copy, Check, Trash2, Image as ImageIcon, X, Maximize2, Clock, Edit2, Play, Loader2, Upload, Pencil, ZoomIn, ZoomOut, Download, RotateCcw, StickyNote, Scaling, Languages, Lock, Aperture, User, ExternalLink, Share2, Heart } from 'lucide-react';
import { generateNanoBananaImage } from '../services/geminiService';
import { getProxyImageUrl } from '../services/yandexDiskService';

enum GenderVariant {
  Male = 'Male',
  Female = 'Female',
  Unisex = 'Unisex'
}

type ModelProvider = 'pollinations' | 'huggingface' | 'google';

interface PromptCardProps {
  data: PromptData;
  index: number;
  onDelete: (id: string) => void;
  onCategoryUpdate: (id: string, newCategory: string) => void;
  onEdit: (data: PromptData) => void;
  onUsageUpdate: (id: string) => void;
  onAddHistory: (id: string, image: GeneratedImage) => void;
  isAdmin: boolean;
  // Новые пропсы для Избранного
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}

const PromptCard: React.FC<PromptCardProps> = ({ data, index, onDelete, onCategoryUpdate, onEdit, onUsageUpdate, onAddHistory, isAdmin, isFavorite, onToggleFavorite }) => {
  const [activeVariant, setActiveVariant] = useState<GenderVariant>(GenderVariant.Female);
  const [showRussian, setShowRussian] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeModalImage, setActiveModalImage] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  const finalImageSrc = data.imagePath 
    ? getProxyImageUrl(data.imagePath) 
    : data.imageBase64;

  const [testReferenceImage, setTestReferenceImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [genModel, setGenModel] = useState<ModelProvider>('pollinations');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [adminCopiedInfo, setAdminCopiedInfo] = useState<string | null>(null);

  // Zoom & Parallax State
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number, y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const canEdit = isAdmin || !data.isSystem;

  // --- HAPTIC FEEDBACK (Усиленный) ---
  const triggerHaptic = (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') => {
    // @ts-ignore
    if (window.Telegram?.WebApp?.HapticFeedback) {
        // @ts-ignore
        window.Telegram.WebApp.HapticFeedback.impactOccurred(style);
    }
  };

  const triggerNotification = (type: 'success' | 'warning' | 'error') => {
    // @ts-ignore
    if (window.Telegram?.WebApp?.HapticFeedback) {
        // @ts-ignore
        window.Telegram.WebApp.HapticFeedback.notificationOccurred(type);
    }
  };

  // --- ГИРОСКОП (Сглаженный) ---
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
        if (isHovered) return;

        // Максимальный наклон в градусах (уменьшили с 15 до 5 для тонкого эффекта)
        const MAX_TILT = 5; 
        
        let x = e.beta || 0; 
        let y = e.gamma || 0;

        // Корректировка под "держание в руке" (~45 градусов)
        x = x - 45; 

        // Сглаживание: умножаем на 0.1, чтобы движение было плавным и мелким
        x = x * 0.1;
        y = y * 0.1;

        if (x > MAX_TILT) x = MAX_TILT;
        if (x < -MAX_TILT) x = -MAX_TILT;
        if (y > MAX_TILT) y = MAX_TILT;
        if (y < -MAX_TILT) y = -MAX_TILT;

        setRotateX(-x); 
        setRotateY(y);
    };

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile && window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
        if (isMobile) {
            window.removeEventListener('deviceorientation', handleOrientation);
        }
    };
  }, [isHovered]);

  const getCurrentText = () => {
    if (activeVariant === GenderVariant.Female) return showRussian ? (data.variants.femaleRu || data.variants.female) : (data.variants.femaleEn || data.variants.female);
    if (activeVariant === GenderVariant.Male) return showRussian ? (data.variants.maleRu || data.variants.male) : (data.variants.maleEn || data.variants.male);
    return showRussian ? (data.variants.unisexRu || data.variants.unisex) : (data.variants.unisexEn || data.variants.unisex);
  };

  const getGenerationText = () => {
     if (activeVariant === GenderVariant.Female) return data.variants.femaleEn || data.variants.female;
     if (activeVariant === GenderVariant.Male) return data.variants.maleEn || data.variants.male;
     return data.variants.unisexEn || data.variants.unisex;
  };

  useEffect(() => {
    if (!activeModalImage) {
      setZoomLevel(1);
      setPanPosition({ x: 0, y: 0 });
    }
  }, [activeModalImage]);

  const handleCopy = () => {
    triggerHaptic('medium'); // Усиленная вибрация для копирования
    navigator.clipboard.writeText(getCurrentText() || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleDownload = async (imageUrl: string | null, fileName: string) => {
    if (!imageUrl) return;
    triggerHaptic('medium');

    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile) {
            const file = new File([blob], `${fileName}.png`, { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: fileName,
                    });
                    return;
                } catch (shareError) {
                    console.log("Share API cancelled");
                }
            }
        }

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.png`;
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        }, 100);

    } catch (e) {
        console.error("Download failed:", e);
        window.open(imageUrl, '_blank');
    }
  };

  const openExternalLink = (url: string) => {
    // @ts-ignore
    if (window.Telegram?.WebApp?.openLink) {
        // @ts-ignore
        window.Telegram.WebApp.openLink(url, { try_instant_view: false });
    } else {
        window.open(url, '_blank');
    }
  };

  const handleTestGeneration = async () => {
    triggerHaptic('medium');

    if (genModel === 'google' && isAdmin) {
        const promptToUse = getGenerationText();
        let textToCopy = `Create a photorealistic image: ${promptToUse}. Aspect ratio ${aspectRatio}.`;
        let notifyMsg = "✅ Промпт скопирован! Вставьте в чат.";

        if (testReferenceImage) {
            textToCopy += " (Use uploaded image as reference)";
            notifyMsg = "⚠️ Промпт скопирован! (Загрузите фото вручную)";
        }

        navigator.clipboard.writeText(textToCopy);
        openExternalLink('https://gemini.google.com/app');
        setAdminCopiedInfo(notifyMsg);
        setTimeout(() => setAdminCopiedInfo(null), 6000);
        return;
    }

    setIsGenerating(true);
    setGenError(null);
    setGeneratedImage(null);

    try {
      const promptToUse = getGenerationText();
      if (!promptToUse) throw new Error("Промпт пустой");

      const result = await generateNanoBananaImage(promptToUse, testReferenceImage, aspectRatio, genModel as 'pollinations' | 'huggingface');
      
      setGeneratedImage(result.url);
      triggerNotification('success');
      onUsageUpdate(data.id);
      
      const newHistoryItem: GeneratedImage = {
        id: Date.now().toString(),
        url: result.url,
        timestamp: Date.now(),
        aspectRatio: aspectRatio
      };
      onAddHistory(data.id, newHistoryItem);
      if (!showHistory && (data.generationHistory?.length || 0) > 0) setShowHistory(true);
    } catch (e: any) {
      triggerNotification('error');
      setGenError(e.message || "Ошибка генерации.");
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => setTestReferenceImage(reader.result as string); reader.readAsDataURL(file); }};
  const handleMainImageClick = (e: React.MouseEvent) => { e.stopPropagation(); if (finalImageSrc) { handleDownload(finalImageSrc, data.shortTitle); }};
  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => { if (!cardRef.current) return; const rect = cardRef.current.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top; const centerX = rect.width / 2; const centerY = rect.height / 2; setRotateX(((y - centerY) / centerY) * -3); setRotateY(((x - centerX) / centerX) * 3); };
  const handleCardMouseEnter = () => setIsHovered(true);
  const handleCardMouseLeave = () => { setIsHovered(false); setRotateX(0); setRotateY(0); };
  const handleZoomIn = (e: React.MouseEvent) => { e.stopPropagation(); setZoomLevel(prev => Math.min(prev + 0.5, 5)); };
  const handleZoomOut = (e: React.MouseEvent) => { e.stopPropagation(); setZoomLevel(prev => Math.max(prev - 0.5, 0.5)); };
  const handleResetZoom = (e: React.MouseEvent) => { e.stopPropagation(); setZoomLevel(1); setPanPosition({ x: 0, y: 0 }); };
  const handleDownloadFromModal = (e: React.MouseEvent) => { e.stopPropagation(); handleDownload(activeModalImage, `generated_${Date.now()}`); };
  const handleMouseDown = (e: React.MouseEvent) => { e.preventDefault(); if (zoomLevel > 1) { setIsDragging(true); dragStartRef.current = { x: e.clientX - panPosition.x, y: e.clientY - panPosition.y }; }};
  const handleMouseMove = (e: React.MouseEvent) => { if (isDragging && dragStartRef.current) { e.preventDefault(); setPanPosition({ x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y }); }};
  const handleMouseUp = () => { setIsDragging(false); dragStartRef.current = null; };
  const handleWheel = (e: React.WheelEvent) => { if (e.ctrlKey || activeModalImage) { if (e.deltaY < 0) setZoomLevel(prev => Math.min(prev + 0.1, 5)); else setZoomLevel(prev => Math.max(prev - 0.1, 0.5)); }};
  const aspectRatioOptions: AspectRatio[] = ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'];

  return (
    <>
      <div 
        ref={cardRef} onMouseMove={handleCardMouseMove} onMouseEnter={handleCardMouseEnter} onMouseLeave={handleCardMouseLeave}
        className={`bg-gradient-to-br from-slate-800 to-indigo-900/30 rounded-xl border ${data.isSystem ? 'border-indigo-500/20' : 'border-emerald-500/40'} overflow-hidden shadow-md hover:shadow-2xl transition-all duration-200 w-full transform-gpu`}
        style={{ transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${isHovered || rotateX !== 0 ? 1.01 : 1})`, transformStyle: 'preserve-3d' }}
      >
        <div className="p-4 flex flex-col md:flex-row gap-6" style={{ transform: 'translateZ(20px)' }}>
          <div className="flex-shrink-0 flex flex-col items-center gap-3 md:w-48">
            <div className="flex items-center justify-between w-full px-1">
               <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm border ${data.isSystem ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'}`}>#{index + 1}</div>
               <div className="text-xs text-slate-400 font-mono bg-slate-900 px-2 py-1 rounded">{data.model}</div>
            </div>
            
            <div className={`w-full aspect-square rounded-lg overflow-hidden bg-slate-900 border border-slate-700 relative group ${finalImageSrc ? 'cursor-pointer' : ''}`} onClick={() => finalImageSrc && setActiveModalImage(finalImageSrc)}>
              {!isImageLoaded && finalImageSrc && (<div className="absolute inset-0 flex items-center justify-center bg-slate-800 animate-pulse z-10"><ImageIcon className="text-slate-600 w-10 h-10 opacity-50" /></div>)}
              {finalImageSrc ? (
                <>
                    <img src={finalImageSrc} alt={data.shortTitle} className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-500 ${isImageLoaded ? 'opacity-100' : 'opacity-0'}`} onLoad={() => setIsImageLoaded(true)} />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <button onClick={handleMainImageClick} className="absolute top-2 left-2 p-1.5 bg-black/50 hover:bg-black/80 rounded-full text-white transition-colors shadow-md z-10"><Download size={16} /></button>
                        <button className="p-2 bg-black/50 hover:bg-black/80 rounded-full text-white transition-colors shadow-md transform scale-90 group-hover:scale-100"><Maximize2 size={24} /></button>
                    </div>
                </>
              ) : (<div className="w-full h-full flex flex-col items-center justify-center text-slate-500"><ImageIcon size={32} /><span className="text-xs mt-2">Нет фото</span></div>)}
            </div>
            
            {/* КНОПКА ИЗБРАННОГО */}
            <div className="flex justify-between items-center w-full mt-2">
                <button 
                    onClick={(e) => { e.stopPropagation(); triggerHaptic('medium'); onToggleFavorite(data.id); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isFavorite ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'}`}
                >
                    <Heart size={14} className={isFavorite ? "fill-red-400" : ""} />
                    <span>{isFavorite ? 'В избранном' : 'В избранное'}</span>
                </button>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500"><Clock size={10} /><span>{formatDate(data.createdAt)}</span></div>
            </div>
            
            {isAdmin && data.author && (<div className="flex items-center gap-1 mt-1 px-2 py-1 bg-slate-900/80 rounded border border-indigo-500/30 text-[10px] text-indigo-300 w-full"><User size={10} /><span>by {data.author}</span></div>)}
          </div>

          <div className="flex-grow flex flex-col min-w-0">
            {/* ... ТЕКСТОВАЯ ЧАСТЬ КАРТОЧКИ (код тот же) ... */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex flex-col relative flex-grow mr-4 min-w-0">
                <div className="group relative inline-flex items-center gap-1 mb-1 cursor-pointer" onClick={() => canEdit && setShowCategoryDropdown(!showCategoryDropdown)}>
                  <span className="text-xs text-indigo-400 font-medium uppercase tracking-wider hover:text-indigo-300 transition-colors truncate">{data.category}</span>
                  {canEdit && <Edit2 size={10} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />}
                  {showCategoryDropdown && canEdit && (
                    <div className="absolute top-full left-0 mt-1 z-20 bg-slate-800 border border-slate-600 rounded-lg shadow-xl w-64 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                       {VALID_CATEGORIES.map(cat => (<div key={cat} className={`px-3 py-2 text-xs hover:bg-indigo-600 hover:text-white cursor-pointer transition-colors ${data.category === cat ? 'bg-indigo-500/10 text-indigo-300' : 'text-slate-300'}`} onClick={(e) => { e.stopPropagation(); onCategoryUpdate(data.id, cat); setShowCategoryDropdown(false); }}>{cat}</div>))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2"><h3 className="text-lg font-semibold text-white truncate" title={data.shortTitle}>{data.shortTitle}</h3>{data.isSystem && !isAdmin && <Lock size={14} className="text-slate-500" title="Системный промпт" />}</div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">{canEdit ? (<><button onClick={(e) => { e.stopPropagation(); onEdit(data); }} className="text-slate-500 hover:text-white hover:bg-slate-700 rounded p-1.5"><Pencil size={18} /></button><button onClick={(e) => { e.stopPropagation(); onDelete(data.id); }} className="text-slate-500 hover:text-red-400 hover:bg-slate-700/50 rounded p-1.5"><Trash2 size={18} /></button></>) : (<span className="text-[10px] text-slate-600 px-2 py-1 border border-slate-700 rounded select-none">ReadOnly</span>)}</div>
            </div>

            {data.note && <div className="mb-3 px-3 py-2 bg-yellow-500/5 border border-yellow-500/20 rounded-lg text-xs text-yellow-200/80 flex items-start gap-2"><StickyNote size={14} className="mt-0.5 text-yellow-500/50 flex-shrink-0" /><span className="whitespace-pre-wrap leading-relaxed break-words">{data.note}</span></div>}

            <div className="flex flex-wrap gap-2 mb-3">{[GenderVariant.Female, GenderVariant.Male, GenderVariant.Unisex].map((variant) => (<button key={variant} onClick={() => {triggerHaptic('light'); setActiveVariant(variant);}} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeVariant === variant ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>{variant === GenderVariant.Female ? 'Девушка' : variant === GenderVariant.Male ? 'Парень' : 'Унисекс'}</button>))}</div>

            <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 flex-grow grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-700/50">
              <div className="p-3 lg:col-span-2 flex flex-col relative group">
                <p className="text-sm text-slate-300 font-mono leading-relaxed break-words whitespace-pre-wrap flex-grow h-full max-h-[300px] overflow-y-auto">{getCurrentText()}</p>
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => { triggerHaptic('light'); setShowRussian(!showRussian); }} className={`p-2 rounded-md transition-all text-xs flex items-center gap-1 ${showRussian ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-blue-400'}`}><Languages size={14} /><span>{showRussian ? 'RU' : 'EN'}</span></button>
                  <button onClick={handleCopy} className="p-2 rounded-md bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all border border-slate-600 flex items-center gap-2 text-xs">{copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}<span>{copied ? 'Copied' : 'Copy'}</span></button>
                </div>
              </div>
              <div className="p-3 bg-slate-900/80 flex flex-col gap-3">
                 <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Тест (Генерация)</div>
                 <div className="relative group/upload h-24">
                   {testReferenceImage ? (
                     <div className="relative w-full h-full rounded-lg overflow-hidden border border-slate-600 bg-black/50"><img src={testReferenceImage} className="w-full h-full object-cover opacity-80" alt="ref" /><button onClick={() => setTestReferenceImage(null)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-red-500/80"><X size={12} /></button></div>
                   ) : (<label className="w-full h-full border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-colors"><Upload size={16} className="text-slate-500 mb-1" /><span className="text-[10px] text-slate-400">Фото (опц)</span><input type="file" accept="image/*" className="hidden" onChange={handleRefUpload} /></label>)}
                 </div>
                 <button onClick={handleTestGeneration} disabled={isGenerating} className={`w-full h-10 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${isGenerating ? 'bg-slate-700 text-slate-400' : genModel === 'google' ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'}`}>{genModel === 'google' ? <ExternalLink size={16} /> : isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />} {genModel === 'google' ? 'Открыть Gemini' : isGenerating ? 'Wait...' : 'Генерировать'}</button>
                 <div className="flex gap-2 h-8 w-full">
                    <div className="relative flex-1">
                      <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)} className="w-full h-full bg-slate-800 border border-slate-600 rounded-lg pl-2 pr-1 text-[10px] text-slate-300 outline-none appearance-none">{aspectRatioOptions.map(ratio => <option key={ratio} value={ratio}>{ratio}</option>)}</select>
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500"><Scaling size={12} /></div>
                    </div>
                    <div className="relative flex-1">
                      <select value={genModel} onChange={(e) => setGenModel(e.target.value as ModelProvider)} className="w-full h-full bg-slate-800 border border-slate-600 rounded-lg pl-2 pr-1 text-[10px] text-slate-300 outline-none appearance-none">
                        <option value="pollinations">Fast (Free)</option>
                        <option value="huggingface">HQ (Flux)</option>
                        {isAdmin && <option value="google">Nano Banana (Pro)</option>}
                      </select>
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500"><Aperture size={12} /></div>
                    </div>
                 </div>
                 {adminCopiedInfo && <div className="mt-2 text-[10px] text-amber-300 bg-amber-500/10 p-2 rounded border border-amber-500/20 animate-in fade-in slide-in-from-top-2">{adminCopiedInfo}</div>}
                 {generatedImage && !isGenerating && (<div className="mt-2 animate-in fade-in zoom-in duration-300"><div className="relative w-full h-40 rounded-lg overflow-hidden border border-emerald-500/50 shadow-lg cursor-pointer" onClick={() => setActiveModalImage(generatedImage)}><img src={generatedImage} className="w-full h-full object-cover" alt="Generated" /></div></div>)}
                 {genError && <div className="mt-2 text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">{genError}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
      {activeModalImage && (<div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center overflow-hidden" onWheel={handleWheel}><div className="absolute top-4 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-full px-4 py-2 shadow-2xl backdrop-blur-md"><button onClick={handleZoomOut} className="p-2 text-slate-300 hover:text-white"><ZoomOut size={20} /></button><span className="text-xs text-slate-400 w-12 text-center">{Math.round(zoomLevel * 100)}%</span><button onClick={handleZoomIn} className="p-2 text-slate-300 hover:text-white"><ZoomIn size={20} /></button><div className="w-px h-6 bg-slate-600 mx-1"></div><button onClick={handleResetZoom} className="p-2 text-slate-300 hover:text-white"><RotateCcw size={20} /></button><button onClick={handleDownloadFromModal} className="p-2 text-indigo-400 hover:text-white"><Download size={20} /></button><div className="w-px h-6 bg-slate-600 mx-1"></div><button onClick={() => setActiveModalImage(null)} className="p-2 text-red-400 hover:text-white"><X size={20} /></button></div><div className={`w-full h-full flex items-center justify-center ${zoomLevel > 1 ? 'cursor-move' : 'cursor-default'}`} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}><img src={activeModalImage} alt="Full view" className="max-w-none transition-transform duration-75 ease-linear select-none" style={{ transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel})`, maxHeight: zoomLevel === 1 ? '90vh' : 'none', maxWidth: zoomLevel === 1 ? '90vw' : 'none' }} draggable={false}/></div></div>)}
    </>
  );
};

export default PromptCard;
