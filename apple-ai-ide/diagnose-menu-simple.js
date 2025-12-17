/**
 * Упрощенный диагностический скрипт для меню
 * Скопируйте и вставьте в консоль браузера/Electron
 */

console.log('=== ДИАГНОСТИКА МЕНЮ ===\n');

// 1. Базовая информация
console.log('1. Информация о среде:');
console.log('   Platform:', navigator.platform);
console.log('   Electron API:', typeof window.electronAPI !== 'undefined' ? '✓ Доступен' : '✗ Недоступен');
if (window.electronAPI) {
  console.log('   Методы Electron API:', Object.keys(window.electronAPI).join(', '));
}

// 2. Поиск элементов меню
console.log('\n2. Поиск элементов меню:');
const menuButtons = document.querySelectorAll('[data-menu-button]');
console.log('   Кнопок меню найдено:', menuButtons.length);

const fileMenuButton = Array.from(menuButtons).find(btn => {
  const icon = btn.querySelector('svg');
  return icon || btn.textContent?.includes('Файл');
});

if (fileMenuButton) {
  console.log('   ✓ Кнопка "Файл" найдена');
  console.log('   Класс:', fileMenuButton.className);
  console.log('   Стили:', window.getComputedStyle(fileMenuButton).display);
  
  // Проверка обработчиков
  const reactKey = Object.keys(fileMenuButton).find(k => k.startsWith('__reactFiber'));
  if (reactKey) {
    console.log('   ✓ React компонент найден');
    try {
      const fiber = fileMenuButton[reactKey];
      if (fiber?.memoizedProps) {
        console.log('   Props:', Object.keys(fiber.memoizedProps));
      }
    } catch (e) {
      console.log('   Не удалось прочитать props');
    }
  }
} else {
  console.log('   ✗ Кнопка "Файл" не найдена');
}

// 3. Проверка выпадающего меню
console.log('\n3. Проверка выпадающего меню:');
const dropdown = document.querySelector('[data-menu-dropdown]');
if (dropdown) {
  console.log('   ✓ Выпадающее меню найдено');
  console.log('   Видимо:', window.getComputedStyle(dropdown).display !== 'none');
  console.log('   z-index:', window.getComputedStyle(dropdown).zIndex);
  
  // Поиск элемента "Новый проект"
  const items = dropdown.querySelectorAll('button');
  console.log('   Элементов меню:', items.length);
  
  const newProjectItem = Array.from(items).find(item => 
    item.textContent?.includes('Новый проект')
  );
  
  if (newProjectItem) {
    console.log('   ✓ Элемент "Новый проект" найден');
    console.log('   Текст:', newProjectItem.textContent.trim());
    console.log('   Класс:', newProjectItem.className);
  } else {
    console.log('   ✗ Элемент "Новый проект" не найден');
  }
} else {
  console.log('   ✗ Выпадающее меню не найдено (возможно, закрыто)');
}

// 4. Проверка диалога "Новый проект"
console.log('\n4. Проверка диалога "Новый проект":');
const dialog = document.querySelector('*') && Array.from(document.querySelectorAll('*')).find(el => 
  el.textContent?.includes('Создать новый проект') || 
  el.textContent?.includes('Новый проект')
);
if (dialog) {
  console.log('   ✓ Диалог найден');
  console.log('   Видимо:', window.getComputedStyle(dialog).display !== 'none');
} else {
  console.log('   ✗ Диалог не найден');
}

// 5. Проверка overlay
console.log('\n5. Проверка overlay:');
const overlays = Array.from(document.querySelectorAll('div')).filter(div => {
  const style = window.getComputedStyle(div);
  return style.position === 'fixed' && 
         style.zIndex && 
         parseInt(style.zIndex) < 1000 &&
         (div.style.inset === '0px' || (div.style.top === '0px' && div.style.left === '0px'));
});
console.log('   Overlay элементов найдено:', overlays.length);
overlays.forEach((overlay, i) => {
  console.log(`   Overlay ${i + 1}: z-index=${window.getComputedStyle(overlay).zIndex}, pointer-events=${window.getComputedStyle(overlay).pointerEvents}`);
});

// 6. Симуляция клика на кнопку "Файл"
console.log('\n6. Симуляция клика на кнопку "Файл":');
if (fileMenuButton) {
  console.log('   Отправка события click...');
  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window,
    button: 0
  });
  
  fileMenuButton.dispatchEvent(clickEvent);
  
  setTimeout(() => {
    const dropdownAfter = document.querySelector('[data-menu-dropdown]');
    console.log('   Результат:');
    console.log('   - Выпадающее меню открыто:', !!dropdownAfter);
    if (dropdownAfter) {
      console.log('   - Видимо:', window.getComputedStyle(dropdownAfter).display !== 'none');
      console.log('   - Элементов в меню:', dropdownAfter.querySelectorAll('button').length);
    }
    
    // 7. Симуляция клика на "Новый проект"
    if (dropdownAfter) {
      const newProjectBtn = Array.from(dropdownAfter.querySelectorAll('button')).find(btn => 
        btn.textContent?.includes('Новый проект')
      );
      
      if (newProjectBtn) {
        console.log('\n7. Симуляция клика на "Новый проект":');
        console.log('   Отправка события click...');
        
        const newProjectClick = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
          button: 0
        });
        
        newProjectBtn.dispatchEvent(newProjectClick);
        
        setTimeout(() => {
          const dialogAfter = Array.from(document.querySelectorAll('*')).find(el => 
            el.textContent?.includes('Создать новый проект')
          );
          console.log('   Результат:');
          console.log('   - Диалог открыт:', !!dialogAfter);
          if (dialogAfter) {
            console.log('   - Видимо:', window.getComputedStyle(dialogAfter).display !== 'none');
            console.log('   - z-index:', window.getComputedStyle(dialogAfter).zIndex);
          }
          
          console.log('\n=== КОНЕЦ ДИАГНОСТИКИ ===');
          console.log('\n📋 Скопируйте весь вывод выше и предоставьте для анализа.');
        }, 500);
      } else {
        console.log('\n7. Элемент "Новый проект" не найден в открытом меню');
        console.log('\n=== КОНЕЦ ДИАГНОСТИКИ ===');
      }
    } else {
      console.log('\n7. Меню не открылось после клика');
      console.log('\n=== КОНЕЦ ДИАГНОСТИКИ ===');
    }
  }, 500);
} else {
  console.log('   ✗ Кнопка "Файл" не найдена для симуляции');
  console.log('\n=== КОНЕЦ ДИАГНОСТИКИ ===');
}

// 8. Проверка ошибок в консоли
console.log('\n8. Проверьте консоль на наличие ошибок (красные сообщения)');
console.log('   Ищите сообщения с префиксом "===" для отладки');
