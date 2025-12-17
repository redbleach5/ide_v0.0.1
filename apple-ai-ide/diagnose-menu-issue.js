/**
 * Диагностический скрипт для сбора информации о проблеме с меню "Новый проект"
 * 
 * Инструкция:
 * 1. Откройте DevTools в Electron (F12 или через меню)
 * 2. Перейдите на вкладку Console
 * 3. Скопируйте и вставьте весь этот скрипт в консоль
 * 4. Нажмите Enter
 * 5. Скопируйте весь вывод и предоставьте его
 */

(function diagnoseMenuIssue() {
  console.log('=== НАЧАЛО ДИАГНОСТИКИ МЕНЮ ===\n');
  
  const diagnostics = {
    timestamp: new Date().toISOString(),
    platform: navigator.platform,
    userAgent: navigator.userAgent,
    electronAvailable: typeof window !== 'undefined' && !!window.electronAPI,
    issues: [],
    info: {}
  };

  // 1. Проверка Electron API
  console.log('1. Проверка Electron API...');
  if (window.electronAPI) {
    diagnostics.info.electronAPI = {
      available: true,
      methods: Object.keys(window.electronAPI),
      hasShowOpenDialog: typeof window.electronAPI.showOpenDialog === 'function',
      hasCreateProject: typeof window.electronAPI.createProject === 'function',
      hasOnMenuAction: typeof window.electronAPI.onMenuAction === 'function'
    };
    console.log('✓ Electron API доступен');
  } else {
    diagnostics.issues.push('Electron API недоступен');
    console.log('✗ Electron API недоступен');
  }

  // 2. Поиск компонента MenuBarSimple в DOM
  console.log('\n2. Поиск компонента MenuBarSimple в DOM...');
  const menuButtons = document.querySelectorAll('[data-menu-button]');
  const menuDropdowns = document.querySelectorAll('[data-menu-dropdown]');
  const fileMenuButton = Array.from(menuButtons).find(btn => 
    btn.textContent?.includes('Файл') || btn.querySelector('svg')
  );
  
  diagnostics.info.dom = {
    menuButtonsCount: menuButtons.length,
    menuDropdownsCount: menuDropdowns.length,
    fileMenuButtonFound: !!fileMenuButton,
    fileMenuButtonInfo: fileMenuButton ? {
      textContent: fileMenuButton.textContent,
      className: fileMenuButton.className,
      style: window.getComputedStyle(fileMenuButton).cssText,
      hasOnClick: fileMenuButton.onclick !== null,
      eventListeners: getEventListeners(fileMenuButton)
    } : null
  };
  
  console.log(`Найдено кнопок меню: ${menuButtons.length}`);
  console.log(`Найдено выпадающих меню: ${menuDropdowns.length}`);
  console.log(`Кнопка "Файл" найдена: ${!!fileMenuButton}`);

  // 3. Проверка React компонентов через React DevTools (если доступны)
  console.log('\n3. Проверка React компонентов...');
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('✓ React DevTools доступны');
    diagnostics.info.reactDevTools = true;
  } else {
    console.log('✗ React DevTools недоступны (установите расширение)');
    diagnostics.info.reactDevTools = false;
  }

  // 4. Проверка обработчиков событий на кнопке меню
  console.log('\n4. Проверка обработчиков событий...');
  if (fileMenuButton) {
    // Попытка найти обработчики через различные методы
    const handlers = {
      onclick: fileMenuButton.onclick,
      addEventListener: 'function',
      reactProps: null
    };
    
    // Попытка получить React props через внутренние свойства
    try {
      const reactKey = Object.keys(fileMenuButton).find(key => 
        key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')
      );
      if (reactKey) {
        const fiber = fileMenuButton[reactKey];
        if (fiber && fiber.memoizedProps) {
          handlers.reactProps = {
            onClick: typeof fiber.memoizedProps.onClick === 'function',
            hasOnClick: !!fiber.memoizedProps.onClick
          };
        }
      }
    } catch (e) {
      console.log('Не удалось получить React props:', e.message);
    }
    
    diagnostics.info.eventHandlers = handlers;
    console.log('Обработчики событий:', handlers);
  }

  // 5. Симуляция клика для проверки
  console.log('\n5. Симуляция клика на кнопку "Файл"...');
  if (fileMenuButton) {
    try {
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      
      console.log('Отправка события click...');
      const beforeClick = {
        activeMenu: document.querySelector('[data-menu-dropdown]') !== null,
        dropdownVisible: document.querySelector('[data-menu-dropdown]')?.style.display !== 'none'
      };
      
      fileMenuButton.dispatchEvent(clickEvent);
      
      // Ждем немного для обработки события
      setTimeout(() => {
        const afterClick = {
          activeMenu: document.querySelector('[data-menu-dropdown]') !== null,
          dropdownVisible: document.querySelector('[data-menu-dropdown]')?.style.display !== 'none',
          dropdownElement: document.querySelector('[data-menu-dropdown]')
        };
        
        diagnostics.info.clickSimulation = {
          before: beforeClick,
          after: afterClick,
          dropdownOpened: afterClick.activeMenu !== beforeClick.activeMenu
        };
        
        console.log('Результат симуляции клика:', diagnostics.info.clickSimulation);
        
        // 6. Проверка элементов меню "Новый проект"
        console.log('\n6. Поиск элемента меню "Новый проект"...');
        const menuItems = document.querySelectorAll('[data-menu-dropdown] button');
        const newProjectItem = Array.from(menuItems).find(item => 
          item.textContent?.includes('Новый проект')
        );
        
        if (newProjectItem) {
          console.log('✓ Элемент "Новый проект" найден');
          diagnostics.info.newProjectItem = {
            found: true,
            textContent: newProjectItem.textContent,
            hasOnClick: newProjectItem.onclick !== null,
            className: newProjectItem.className,
            style: window.getComputedStyle(newProjectItem).cssText
          };
          
          // Симуляция клика на "Новый проект"
          console.log('\n7. Симуляция клика на "Новый проект"...');
          const newProjectClickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          
          const beforeNewProjectClick = {
            dialogVisible: document.querySelector('[data-new-project-dialog]') !== null ||
                          document.body.textContent.includes('Создать новый проект')
          };
          
          newProjectItem.dispatchEvent(newProjectClickEvent);
          
          setTimeout(() => {
            const afterNewProjectClick = {
              dialogVisible: document.querySelector('[data-new-project-dialog]') !== null ||
                            document.body.textContent.includes('Создать новый проект'),
              dialogElement: document.querySelector('[data-new-project-dialog]') || 
                            Array.from(document.querySelectorAll('*')).find(el => 
                              el.textContent?.includes('Создать новый проект')
                            )
            };
            
            diagnostics.info.newProjectClickSimulation = {
              before: beforeNewProjectClick,
              after: afterNewProjectClick,
              dialogOpened: afterNewProjectClick.dialogVisible !== beforeNewProjectClick.dialogVisible
            };
            
            console.log('Результат клика на "Новый проект":', diagnostics.info.newProjectClickSimulation);
            
            // 8. Проверка состояния React через глобальные переменные
            console.log('\n8. Проверка глобального состояния...');
            const globalState = {
              hasAppComponent: typeof window.__APP_STATE__ !== 'undefined',
              hasReactRoot: !!document.querySelector('#root')?._reactRootContainer,
              showNewProjectDialog: null
            };
            
            // Попытка найти состояние через React DevTools
            if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
              try {
                const root = document.querySelector('#root');
                if (root) {
                  const reactKey = Object.keys(root).find(key => 
                    key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')
                  );
                  if (reactKey) {
                    // Попытка найти состояние компонента App
                    let fiber = root[reactKey];
                    let depth = 0;
                    while (fiber && depth < 50) {
                      if (fiber.memoizedState) {
                        const state = fiber.memoizedState;
                        if (state && typeof state === 'object') {
                          // Ищем состояние showNewProjectDialog
                          if (state.showNewProjectDialog !== undefined) {
                            globalState.showNewProjectDialog = state.showNewProjectDialog;
                            break;
                          }
                        }
                      }
                      fiber = fiber.return || fiber.child;
                      depth++;
                    }
                  }
                }
              } catch (e) {
                console.log('Не удалось получить состояние React:', e.message);
              }
            }
            
            diagnostics.info.globalState = globalState;
            console.log('Глобальное состояние:', globalState);
            
            // 9. Проверка логов консоли
            console.log('\n9. Проверка последних логов...');
            diagnostics.info.consoleLogs = {
              note: 'Проверьте консоль на наличие ошибок и логов с префиксом "==="'
            };
            
            // 10. Финальный отчет
            console.log('\n=== ФИНАЛЬНЫЙ ОТЧЕТ ===');
            console.log(JSON.stringify(diagnostics, null, 2));
            console.log('\n=== КОНЕЦ ДИАГНОСТИКИ ===');
            console.log('\n📋 Скопируйте весь вывод выше (начиная с "=== НАЧАЛО ДИАГНОСТИКИ") и предоставьте его для анализа.');
            
          }, 500);
        } else {
          console.log('✗ Элемент "Новый проект" не найден в меню');
          diagnostics.issues.push('Элемент меню "Новый проект" не найден');
          console.log('\n=== ФИНАЛЬНЫЙ ОТЧЕТ ===');
          console.log(JSON.stringify(diagnostics, null, 2));
        }
      }, 500);
    } catch (e) {
      console.error('Ошибка при симуляции клика:', e);
      diagnostics.issues.push(`Ошибка симуляции клика: ${e.message}`);
    }
  } else {
    console.log('✗ Кнопка меню "Файл" не найдена');
    diagnostics.issues.push('Кнопка меню "Файл" не найдена в DOM');
    console.log('\n=== ФИНАЛЬНЫЙ ОТЧЕТ ===');
    console.log(JSON.stringify(diagnostics, null, 2));
  }
  
  // Вспомогательная функция для получения обработчиков событий
  function getEventListeners(element) {
    const listeners = {};
    if (window.getEventListeners) {
      try {
        return window.getEventListeners(element);
      } catch (e) {
        return { error: 'getEventListeners недоступен' };
      }
    }
    return { note: 'getEventListeners недоступен (Chrome DevTools)' };
  }
  
  // Возвращаем объект диагностики для дальнейшего использования
  return diagnostics;
})();
