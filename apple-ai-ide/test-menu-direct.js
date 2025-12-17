// ПРОСТОЙ ТЕСТ МЕНЮ - скопируйте и вставьте в консоль
// Этот скрипт проверит, работает ли меню и найдет проблему

console.log('=== ТЕСТ МЕНЮ "НОВЫЙ ПРОЕКТ" ===\n');

// Шаг 1: Найти кнопку меню
const menuBtn = document.querySelector('[data-menu-button]');
console.log('1. Кнопка меню найдена:', !!menuBtn);

if (!menuBtn) {
  console.error('❌ Кнопка меню не найдена! Проверьте, что приложение загрузилось.');
} else {
  console.log('   Класс:', menuBtn.className);
  console.log('   Стили:', window.getComputedStyle(menuBtn).display);
  
  // Шаг 2: Кликнуть на кнопку
  console.log('\n2. Кликаю на кнопку меню...');
  menuBtn.click();
  
  setTimeout(() => {
    // Шаг 3: Проверить, открылось ли меню
    const menu = document.querySelector('[data-menu-dropdown]');
    console.log('3. Меню открыто:', !!menu);
    
    if (!menu) {
      console.error('❌ Меню не открылось!');
      console.log('   Возможные причины:');
      console.log('   - Overlay блокирует клики');
      console.log('   - Обработчик событий не работает');
      console.log('   - React состояние не обновляется');
    } else {
      console.log('   ✓ Меню найдено');
      const items = menu.querySelectorAll('button');
      console.log('   Элементов в меню:', items.length);
      
      // Шаг 4: Найти "Новый проект"
      const newProjectBtn = Array.from(items).find(btn => 
        btn.textContent && btn.textContent.includes('Новый проект')
      );
      
      console.log('\n4. Элемент "Новый проект" найден:', !!newProjectBtn);
      
      if (!newProjectBtn) {
        console.error('❌ Элемент "Новый проект" не найден!');
        console.log('   Найденные элементы:');
        items.forEach((item, i) => {
          console.log(`     ${i + 1}. "${item.textContent?.trim() || '(пусто)'}"`);
        });
      } else {
        console.log('   Текст:', newProjectBtn.textContent.trim());
        
        // Шаг 5: Кликнуть на "Новый проект"
        console.log('\n5. Кликаю на "Новый проект"...');
        
        // Добавляем обработчик для отслеживания
        const clickHandler = (e) => {
          console.log('   ✓ Событие click сработало на элементе');
        };
        newProjectBtn.addEventListener('click', clickHandler);
        
        // Создаем событие клика
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
          button: 0
        });
        
        newProjectBtn.dispatchEvent(clickEvent);
        
        setTimeout(() => {
          // Шаг 6: Проверить, открылся ли диалог
          const dialog = Array.from(document.querySelectorAll('*')).find(el => 
            el.textContent && el.textContent.includes('Создать новый проект')
          );
          
          console.log('\n6. Диалог открыт:', !!dialog);
          
          if (dialog) {
            console.log('   ✓ Диалог найден!');
            console.log('   Видимо:', window.getComputedStyle(dialog).display !== 'none');
            console.log('   z-index:', window.getComputedStyle(dialog).zIndex);
          } else {
            console.error('   ❌ Диалог НЕ открылся!');
            console.log('\n   Проверьте консоль на наличие:');
            console.log('   - "=== Новый проект ACTION CALLED ==="');
            console.log('   - "=== handleNewProject CALLED ==="');
            console.log('   - Ошибок (красные сообщения)');
          }
          
          // Удаляем обработчик
          newProjectBtn.removeEventListener('click', clickHandler);
          
          console.log('\n=== КОНЕЦ ТЕСТА ===');
          console.log('\n📋 Скопируйте весь вывод выше и предоставьте его');
        }, 1000);
      }
    }
  }, 500);
}
