// --- ЛОГИКА ПРОВЕРКИ ДУБЛИКАТОВ (С ОТЛАДКОЙ) ---
  const checkAndConfirmDuplicate = (text: string): boolean => {
    // 1. Проверка длины
    if (text.length < 10) {
        console.log("❌ Текст слишком короткий для проверки (<10 символов)");
        return true; 
    }

    let maxSimilarity = 0;
    let match: PromptData | null = null;

    console.log("🔍 Начинаю поиск дубликатов для:", text);

    for (const p of prompts) {
      const sim1 = compareStrings(text, p.originalPrompt);
      const sim2 = compareStrings(text, p.variants.maleEn || '');
      
      const currentMax = Math.max(sim1, sim2);

      // Логируем только если сходство хоть сколько-то значимое (> 30%)
      if (currentMax > 0.3) {
          console.log(`🧐 Сравнение с "${p.shortTitle}": ${Math.round(currentMax * 100)}%`);
      }

      if (currentMax > maxSimilarity) {
        maxSimilarity = currentMax;
        match = p;
      }
      if (maxSimilarity > 0.95) break; 
    }

    console.log(`🏁 ИТОГ: Максимальное сходство ${Math.round(maxSimilarity * 100)}%`);

    // Если схожесть > 60%
    if (maxSimilarity > 0.60 && match) {
        console.log("⚠️ ВЫЗЫВАЮ ОКНО CONFIRM");
        
        const userChoice = window.confirm(
            `⚠️ НАЙДЕН ПОХОЖИЙ ПРОМПТ!\n\n` +
            `Название: "${match.shortTitle}"\n` +
            `Сходство: ${Math.round(maxSimilarity * 100)}%\n\n` +
            `Нажмите "ОК", чтобы создать дубликат.\n` +
            `Нажмите "Отмена", чтобы перейти к существующему.`
        );

        if (userChoice) {
            console.log("✅ Пользователь нажал ОК (Создать дубль)");
            return true; 
        } else {
            console.log("❌ Пользователь нажал Отмена");
            setView('list');
            setSearchQuery(match.shortTitle);
            clearCreateForm();
            return false; 
        }
    }

    console.log("✅ Дубликатов не найдено (или процент ниже 60%)");
    return true; 
  };
