#!/bin/bash

echo "Проверка установки Xcode Command Line Tools..."

# Проверяем установку
if xcode-select -p &>/dev/null; then
    echo "✓ Xcode Command Line Tools установлены!"
    echo "Путь: $(xcode-select -p)"
    echo ""
    echo "Пересборка нативных модулей..."
    cd "$(dirname "$0")"
    npm run rebuild-native
    if [ $? -eq 0 ]; then
        echo ""
        echo "✓ Пересборка завершена успешно!"
        echo "Терминал в IDE теперь должен работать."
    else
        echo ""
        echo "✗ Ошибка при пересборке. Проверьте вывод выше."
    fi
else
    echo "✗ Xcode Command Line Tools еще не установлены."
    echo "Дождитесь завершения установки через диалог системы."
    echo "Затем запустите этот скрипт снова: ./rebuild-after-xcode.sh"
fi

