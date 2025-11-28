
import React, { useState, useRef, useEffect } from 'react';
import { PromptData, GenderVariant, VALID_CATEGORIES, AspectRatio } from '../types';
import { Copy, Check, Trash2, Image as ImageIcon, X, Maximize2, Clock, Edit2, Play, Loader2, Upload, Pencil, Ratio, ZoomIn, ZoomOut, Download, Move, RotateCcw, StickyNote } from 'lucide-react';
import { generateNanoBananaImage } from '../services/geminiService';

interface PromptCardProps {
  data: PromptData;
  index: number;
  onDelete: (id: string) => void;
  onCategoryUpdate: (id: string, newCategory: string) => void;
  onEdit: (data: PromptData) => void;
  onUsageUpdate: (id: string) => void;
}

const PromptCard: React.FC<PromptCardProps> = ({ data, index, onDelete, onCategoryUpdate, onEdit, onUsageUpdate }) => {
  const [activeVariant, setActiveVariant] = useState<GenderVariant>(GenderVariant.Female);
  const [copied, setCopied] = useState(false);
  const [copyAnim, setCopyAnim] = useState(false);
  
  // Replaced boolean state with string state to hold the URL of the image to show in modal
  const [activeModalImage, setActiveModalImage] = useState<string | null>(null);
  
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Testing State
  // Initialize as null to decouple from gallery image
  const [testReferenceImage, setTestReferenceImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Zoom & Pan State for Modal
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number, y: number } | null>(null);

  // Parallax State
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const currentPromptText = 
    activeVariant === GenderVariant.Male ? data.variants.male :
    activeVariant === GenderVariant.Female ? data.variants.female :
    data.variants.unisex;

  // Reset zoom/pan when modal opens/closes
  useEffect(() => {
    if (!activeModalImage) {
      setZoomLevel(1);
      setPanPosition({ x: 0, y: 0 });
    }
  }, [activeModalImage]);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentPromptText);
    setCopied(true);
    setCopyAnim(true);
    setTimeout(() => setCopyAnim(false), 300); // 300ms pop animation
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleTestGeneration = async () => {
    setIsGenerating(true);
    setGenError(null);
    setGeneratedImage(null);

    try {
      const result = await generateNanoBananaImage(currentPromptText, testReferenceImage, aspectRatio);
      setGeneratedImage(result);
      onUsageUpdate(data.id);
    } catch (e: any) {
      setGenError(e.message || "Ошибка генерации. Проверьте API ключ или лимиты.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTestReferenceImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMainImageDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.imageBase64) {
      const link = document.createElement('a');
      link.href = data.imageBase64;
      link.download = `${data.shortTitle.replace(/\s+/g, '_')}_ref.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // --- Parallax Handlers ---
  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Calculate rotation (max 3 degrees for subtlety)
    const rotateXVal = ((y - centerY) / centerY) * -3; 
    const rotateYVal = ((x - centerX) / centerX) * 3;

    setRotateX(rotateXVal);
    setRotateY(rotateYVal);
  };

  const handleCardMouseEnter = () => {
    setIsHovered(true);
  };

  const handleCardMouseLeave = () => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
  };

  // --- Modal Image Controls ---

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoomLevel(prev => Math.min(prev + 0.5, 5));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoomLevel(prev => Math.max(prev - 0.5, 0.5));
  };

  const handleResetZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleDownloadImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeModalImage) {
      const link = document.createElement('a');
      link.href = activeModalImage;
      link.download = `${data.shortTitle.replace(/\s+/g, '_')}_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent default drag behavior
    if (zoomLevel > 1) {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX - panPosition.x, y: e.clientY - panPosition.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && dragStartRef.current) {
      e.preventDefault();
      setPanPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Optional: Zoom on wheel
    if (e.ctrlKey || activeModalImage) {
      // e.stopPropagation();
      // Simple zoom logic
      if (e.deltaY < 0) {
        setZoomLevel(prev => Math.min(prev + 0.1, 5));
      } else {
        setZoomLevel(prev => Math.max(prev - 0.1, 0.5));
      }
    }
  };

  const aspectRatioOptions: AspectRatio[] = ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'];

  return (
    <>
      <div 
        ref={cardRef}
        onMouseMove={handleCardMouseMove}
        onMouseEnter={handleCardMouseEnter}
        onMouseLeave={handleCardMouseLeave}
        className="bg-gradient-to-br from-slate-800 to-indigo-900/30 rounded-xl border border-slate-700 overflow-hidden shadow-md hover:shadow-2xl hover:shadow-indigo-500/20 transition-all duration-200 ease-out hover:border-indigo-500/50 w-full transform-gpu"
        style={{
          transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${isHovered ? 1.01 : 1})`,
          transformStyle: 'preserve-3d'
        }}
      >
        <div className="p-4 flex flex-col md:flex-row gap-6" style={{ transform: 'translateZ(20px)' }}>
          
          {/* Left: Index & Main Image (Metadata) */}
          <div className="flex-shrink-0 flex flex-col items-center gap-3 md:w-48">
            <div className="flex items-center justify-between w-full px-1">
               <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-sm border border-indigo-500/50">
                 #{index + 1}
               </div>
               <div className="text-xs text-slate-400 font-mono bg-slate-900 px-2 py-1 rounded">
                 {data.model}
               </div>
            </div>
            
            <div 
              className={`w-full aspect-square rounded-lg overflow-hidden bg-slate-900 border border-slate-700 relative group ${data.imageBase64 ? 'cursor-pointer' : ''}`}
              onClick={() => data.imageBase64 && setActiveModalImage(data.imageBase64)}
            >
              {data.imageBase64 ? (
                <>
                  <img 
                    src={data.imageBase64} 
                    alt={data.shortTitle} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    {/* Top Left Download Button */}
                    <button 
                      onClick={handleMainImageDownload}
                      className="absolute top-2 left-2 p-1.5 bg-black/50 hover:bg-black/80 rounded-full text-white transition-colors shadow-md z-10" 
                      title="Скачать PNG"
                    >
                      <Download size={16} />
                    </button>
                    
                    {/* Center Maximize Button */}
                    <button className="p-2 bg-black/50 hover:bg-black/80 rounded-full text-white transition-colors shadow-md transform scale-90 group-hover:scale-100" title="Открыть">
                      <Maximize2 size={24} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                  <ImageIcon size={32} />
                  <span className="text-xs mt-2">Нет фото</span>
                </div>
              )}
            </div>
            
            {/* Date Display */}
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-auto">
              <Clock size={10} />
              <span>{formatDate(data.createdAt)}</span>
            </div>
          </div>

          {/* Right: Content & Testing Area */}
          <div className="flex-grow flex flex-col min-w-0">
            {/* Header: Category, Title, Delete */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex flex-col relative flex-grow mr-4 min-w-0">
                
                {/* Editable Category */}
                <div 
                  className="group relative inline-flex items-center gap-1 mb-1 cursor-pointer"
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 200)}
                  tabIndex={0}
                >
                  <span className="text-xs text-indigo-400 font-medium uppercase tracking-wider hover:text-indigo-300 transition-colors truncate">
                    {data.category}
                  </span>
                  <Edit2 size={10} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  
                  {/* Category Dropdown */}
                  {showCategoryDropdown && (
                    <div className="absolute top-full left-0 mt-1 z-20 bg-slate-800 border border-slate-600 rounded-lg shadow-xl w-64 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                       <div className="px-3 py-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider border-b border-slate-700/50 mb-1">
                         Сменить категорию
                       </div>
                       {VALID_CATEGORIES.map(cat => (
                         <div 
                           key={cat}
                           className={`px-3 py-2 text-xs hover:bg-indigo-600 hover:text-white cursor-pointer transition-colors ${data.category === cat ? 'bg-indigo-500/10 text-indigo-300' : 'text-slate-300'}`}
                           onClick={(e) => {
                             e.stopPropagation();
                             onCategoryUpdate(data.id, cat);
                             setShowCategoryDropdown(false);
                           }}
                         >
                           {cat}
                         </div>
                       ))}
                    </div>
                  )}
                </div>

                <h3 className="text-lg font-semibold text-white truncate w-full" title={data.shortTitle}>
                  {data.shortTitle}
                </h3>
              </div>
              
              <div className="flex items-center gap-1 flex-shrink-0">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(data);
                  }}
                  className="text-slate-500 hover:text-white hover:bg-slate-700 rounded p-1.5 transition-all"
                  title="Редактировать карточку"
                >
                  <Pencil size={18} />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent any parent clicks
                    onDelete(data.id);
                  }}
                  className="text-slate-500 hover:text-red-400 hover:bg-slate-700/50 rounded p-1.5 transition-all"
                  title="Удалить"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {/* Note Section (If exists) */}
            {data.note && (
              <div className="mb-3 px-3 py-2 bg-yellow-500/5 border border-yellow-500/20 rounded-lg text-xs text-yellow-200/80 flex items-start gap-2">
                <StickyNote size={14} className="mt-0.5 text-yellow-500/50 flex-shrink-0" />
                <span className="whitespace-pre-wrap leading-relaxed break-words">{data.note}</span>
              </div>
            )}

            {/* Variant Tabs */}
            <div className="flex flex-wrap gap-2 mb-3">
              {[GenderVariant.Female, GenderVariant.Male, GenderVariant.Unisex].map((variant) => (
                <button
                  key={variant}
                  onClick={() => setActiveVariant(variant)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    activeVariant === variant
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {variant === GenderVariant.Female ? 'Девушка' : 
                   variant === GenderVariant.Male ? 'Парень' : 'Унисекс'}
                </button>
              ))}
            </div>

            {/* SPLIT CONTAINER: Prompt Text (Left) + Test Area (Right) */}
            <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 flex-grow grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-700/50">
              
              {/* Left Column: Text */}
              <div className="p-3 lg:col-span-2 flex flex-col relative group">
                <p className="text-sm text-slate-300 font-mono leading-relaxed break-words whitespace-pre-wrap flex-grow">
                  {currentPromptText}
                </p>
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleCopy}
                    className="p-2 rounded-md bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all border border-slate-600 flex items-center gap-2 text-xs"
                    title="Копировать"
                  >
                    {copied ? (
                      <>
                        <Check size={14} className={`text-green-400 transition-transform duration-300 ${copyAnim ? 'scale-150' : 'scale-100'}`} />
                        <span className="text-green-400">Скопировано</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} className={`transition-transform duration-300 ${copyAnim ? 'scale-125' : 'scale-100'}`} />
                        <span>Копировать</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Column: Test Lab */}
              <div className="p-3 bg-slate-900/80 flex flex-col gap-3">
                 <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                   Тест (Gemini 3 Pro)
                 </div>
                 
                 {/* Reference Image Uploader */}
                 <div className="relative group/upload">
                   {testReferenceImage ? (
                     <div className="relative w-full h-32 rounded-lg overflow-hidden border border-slate-600 bg-black/50">
                       <img src={testReferenceImage} className="w-full h-full object-cover opacity-80" alt="ref" />
                       <button 
                         onClick={() => setTestReferenceImage(null)}
                         className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-red-500/80 transition-colors"
                       >
                         <X size={12} />
                       </button>
                       <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[10px] text-center text-white py-0.5">
                         Референс
                       </div>
                     </div>
                   ) : (
                     <label className="w-full h-24 border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-colors">
                       <Upload size={16} className="text-slate-500 mb-1" />
                       <span className="text-[10px] text-slate-400 text-center px-2">Загрузить фото для теста</span>
                       <input type="file" accept="image/*" className="hidden" onChange={handleRefUpload} />
                     </label>
                   )}
                 </div>

                 {/* Controls: Generate Button + Counter + Aspect Ratio Selector */}
                 <div className="flex gap-2 items-center">
                   <button
                     onClick={handleTestGeneration}
                     disabled={isGenerating}
                     className={`flex-grow py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                       isGenerating 
                       ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                       : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'
                     }`}
                   >
                     {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
                     {isGenerating ? 'Generating...' : 'Тест'}
                   </button>

                   {/* Usage Counter */}
                   <div className="h-full px-2 bg-slate-800 border border-slate-600 rounded-lg flex items-center justify-center text-[10px] text-slate-400 font-mono min-w-[30px]" title="Количество успешных генераций">
                     {data.usageCount || 0}
                   </div>
                   
                   <div className="relative w-20 flex-shrink-0">
                     <Ratio size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                     <select
                       value={aspectRatio}
                       onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                       className="w-full h-full bg-slate-800 border border-slate-600 rounded-lg pl-6 pr-1 text-xs text-slate-300 focus:border-indigo-500 outline-none appearance-none cursor-pointer hover:bg-slate-700 py-2"
                       title="Соотношение сторон"
                     >
                       {aspectRatioOptions.map(ratio => (
                         <option key={ratio} value={ratio}>{ratio}</option>
                       ))}
                     </select>
                   </div>
                 </div>

                 {/* Loading Indicator */}
                 {isGenerating && (
                   <div className="mt-2 h-40 w-full bg-slate-800/50 rounded-lg border border-slate-700/50 flex flex-col items-center justify-center animate-pulse">
                     <Loader2 size={24} className="text-emerald-500 animate-spin mb-2" />
                     <span className="text-[10px] text-slate-400 font-medium">Создание изображения...</span>
                   </div>
                 )}

                 {/* Result Area */}
                 {generatedImage && !isGenerating && (
                   <div className="mt-2 animate-in fade-in zoom-in duration-300">
                     <div 
                       className="relative w-full h-40 rounded-lg overflow-hidden border border-emerald-500/50 shadow-lg group/result cursor-pointer" 
                       onClick={() => setActiveModalImage(generatedImage)}
                     >
                       <img src={generatedImage} className="w-full h-full object-cover" alt="Generated" />
                       <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/result:bg-black/30 transition-colors">
                         <Maximize2 className="text-white opacity-0 group-hover/result:opacity-100 drop-shadow-md" size={20} />
                       </div>
                     </div>
                     <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        // Download trigger
                        const link = document.createElement('a');
                        link.href = generatedImage;
                        link.download = `generated_${data.id}.png`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="block w-full text-center text-[10px] text-emerald-400 mt-1 hover:underline"
                    >
                       Скачать результат
                     </button>
                   </div>
                 )}
                 
                 {genError && (
                   <div className="text-[10px] text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20 break-words">
                     {genError}
                   </div>
                 )}
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Advanced Full Screen Image Modal */}
      {activeModalImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center overflow-hidden animate-in fade-in duration-200"
          onWheel={handleWheel}
        >
          {/* Toolbar */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-full px-4 py-2 shadow-2xl backdrop-blur-md">
             <button onClick={handleZoomOut} className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-full transition-colors" title="Уменьшить">
               <ZoomOut size={20} />
             </button>
             <span className="text-xs text-slate-400 w-12 text-center select-none">{Math.round(zoomLevel * 100)}%</span>
             <button onClick={handleZoomIn} className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-full transition-colors" title="Увеличить">
               <ZoomIn size={20} />
             </button>
             <div className="w-px h-6 bg-slate-600 mx-1"></div>
             <button onClick={handleResetZoom} className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-full transition-colors" title="Сбросить">
               <RotateCcw size={20} />
             </button>
             <button onClick={handleDownloadImage} className="p-2 text-indigo-400 hover:text-white hover:bg-indigo-600 rounded-full transition-colors" title="Скачать">
               <Download size={20} />
             </button>
             <div className="w-px h-6 bg-slate-600 mx-1"></div>
             <button 
               onClick={() => setActiveModalImage(null)} 
               className="p-2 text-red-400 hover:text-white hover:bg-red-600 rounded-full transition-colors" 
               title="Закрыть"
              >
               <X size={20} />
             </button>
          </div>

          {/* Image Container */}
          <div 
            className={`w-full h-full flex items-center justify-center ${zoomLevel > 1 ? 'cursor-move' : 'cursor-default'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img 
              src={activeModalImage} 
              alt="Full view" 
              className="max-w-none transition-transform duration-75 ease-linear select-none"
              style={{ 
                transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel})`,
                maxHeight: zoomLevel === 1 ? '90vh' : 'none',
                maxWidth: zoomLevel === 1 ? '90vw' : 'none',
              }}
              draggable={false}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default PromptCard;
