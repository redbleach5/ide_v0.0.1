/**
 * ПРОСТАЯ ДИАГНОСТИКА МЕНЮ - Запуск прямо в приложении
 * 
 * ИНСТРУКЦИЯ:
 * 1. Нажмите F12 в приложении (или используйте меню: Вид -> Инструменты разработчика)
 * 2. Если F12 не работает, запустите приложение в браузере: npm run browser
 * 3. Откройте консоль браузера (F12 или Cmd+Option+I на Mac)
 * 4. Скопируйте и вставьте этот скрипт в консоль
 * 5. Нажмите Enter
 * 6. Скопируйте весь вывод и предоставьте его
 */

(function() {
  const results = [];
  
  function log(msg, type = 'info') {
    const prefix = type === 'error' ? '✗' : type === 'success' ? '✓' : '•';
    const message = `${prefix} ${msg}`;
    results.push(message);
    console.log(message);
  }
  
  log('=== ДИАГНОСТИКА МЕНЮ "НОВЫЙ ПРОЕКТ" ===', 'info');
  log('', 'info');
  
  // 1. Базовая информация
  log('1. Среда выполнения:', 'info');
  log(`   Платформа: ${navigator.platform}`, 'info');
  log(`   Electron: ${typeof window.electronAPI !== 'undefined' ? 'Да' : 'Нет'}`, 
      typeof window.electronAPI !== 'undefined' ? 'success' : 'error');
  
  // 2. Поиск кнопки меню "Файл"
  log('', 'info');
  log('2. Поиск кнопки меню "Файл":', 'info');
  const menuButtons = document.querySelectorAll('[data-menu-button]');
  log(`   Найдено кнопок меню: ${menuButtons.length}`, 'info');
  
  const fileMenuBtn = Array.from(menuButtons)[0]; // Первая кнопка обычно "Файл"
  if (fileMenuBtn) {
    log('   Кнопка найдена', 'success');
    log(`   Класс: ${fileMenuBtn.className}`, 'info');
    
    // 3. Попытка открыть меню
    log('', 'info');
    log('3. Открытие меню:', 'info');
    fileMenuBtn.click();
    
    setTimeout(() => {
      const dropdown = document.querySelector('[data-menu-dropdown]');
      if (dropdown) {
        log('   Меню открыто', 'success');
        
        const items = dropdown.querySelectorAll('button');
        log(`   Элементов в меню: ${items.length}`, 'info');
        
        // 4. Поиск "Новый проект"
        log('', 'info');
        log('4. Поиск элемента "Новый проект":', 'info');
        const newProjectBtn = Array.from(items).find(btn => 
          btn.textContent && btn.textContent.includes('Новый проект')
        );
        
        if (newProjectBtn) {
          log('   Элемент найден', 'success');
          log(`   Текст: "${newProjectBtn.textContent.trim()}"`, 'info');
          
          // 5. Клик на "Новый проект"
          log('', 'info');
          log('5. Клик на "Новый проект":', 'info');
          newProjectBtn.click();
          
          setTimeout(() => {
            const dialog = Array.from(document.querySelectorAll('*')).find(el => 
              el.textContent && el.textContent.includes('Создать новый проект')
            );
            
            if (dialog) {
              log('   Диалог открыт', 'success');
            } else {
              log('   Диалог НЕ открылся', 'error');
              log('   Проверьте консоль на наличие ошибок', 'error');
            }
            
            // Финальный отчет
            log('', 'info');
            log('=== РЕЗУЛЬТАТЫ ===', 'info');
            log('', 'info');
            log('Скопируйте весь вывод выше и предоставьте для анализа', 'info');
            log('', 'info');
            
            // Вывод всех результатов одной строкой для копирования
            console.log('\n=== ДЛЯ КОПИРОВАНИЯ (весь вывод) ===');
            console.log(results.join('\n'));
            
          }, 500);
        } else {
          log('   Элемент "Новый проект" НЕ найден', 'error');
          log('   Найденные элементы:', 'info');
          items.forEach((item, i) => {
            log(`     ${i + 1}. ${item.textContent?.trim() || '(пусто)'}`, 'info');
          });
        }
      } else {
        log('   Меню НЕ открылось', 'error');
        log('   Возможные причины:', 'info');
        log('     - Overlay блокирует клики', 'info');
        log('     - Обработчик событий не работает', 'info');
        log('     - Проблема с React состоянием', 'info');
      }
    }, 500);
  } else {
    log('   Кнопка меню НЕ найдена', 'error');
    log('   Проверьте, что приложение загрузилось полностью', 'info');
  }
  
  return results;
})();
