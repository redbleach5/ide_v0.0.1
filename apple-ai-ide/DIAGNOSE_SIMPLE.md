# Простая диагностика меню "Новый проект"

## Способ 1: Через F12 (самый простой)

1. **Откройте приложение в Electron**
2. **Нажмите `F12`** - откроется DevTools
3. Если F12 не работает, попробуйте:
   - Меню: **Вид** → **Инструменты разработчика**
   - Или запустите в браузере: `npm run browser` и нажмите `F12`
4. Перейдите на вкладку **Console**
5. Откройте файл `diagnose-in-app.js` и скопируйте **весь** его содержимое
6. Вставьте в консоль и нажмите `Enter`
7. Подождите 2-3 секунды
8. Скопируйте **весь** вывод (особенно блок "=== ДЛЯ КОПИРОВАНИЯ ===")
9. Предоставьте этот вывод

## Способ 2: Через браузер (если Electron не работает)

1. Запустите приложение в браузере:
   ```bash
   cd apple-ai-ide
   npm run browser
   ```
2. Откройте DevTools: `F12` или `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
3. Выполните шаги 4-9 из Способа 1

## Способ 3: Быстрая проверка (без скрипта)

Просто выполните в консоли:

```javascript
// 1. Найти кнопку меню
const btn = document.querySelector('[data-menu-button]');
console.log('Кнопка найдена:', !!btn);

// 2. Кликнуть на неё
if (btn) {
  btn.click();
  setTimeout(() => {
    const menu = document.querySelector('[data-menu-dropdown]');
    console.log('Меню открыто:', !!menu);
    
    // 3. Найти "Новый проект"
    if (menu) {
      const items = menu.querySelectorAll('button');
      const newProject = Array.from(items).find(b => b.textContent.includes('Новый проект'));
      console.log('"Новый проект" найден:', !!newProject);
      
      // 4. Кликнуть
      if (newProject) {
        newProject.click();
        setTimeout(() => {
          const dialog = Array.from(document.querySelectorAll('*')).find(el => 
            el.textContent && el.textContent.includes('Создать новый проект')
          );
          console.log('Диалог открыт:', !!dialog);
        }, 500);
      }
    }
  }, 500);
}
```

Скопируйте весь вывод и предоставьте его.

## Что делать, если ничего не работает?

1. **Проверьте консоль на ошибки** (красные сообщения)
2. **Сделайте скриншот** консоли с ошибками
3. **Опишите, что происходит**:
   - Меню открывается?
   - Клик на "Новый проект" работает?
   - Что-то происходит или ничего?
4. Предоставьте эту информацию
