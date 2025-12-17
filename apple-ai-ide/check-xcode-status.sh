#!/bin/bash

echo "🔍 Проверка статуса установки Xcode Command Line Tools..."
echo ""

# Проверяем процесс установки
if ps aux | grep -i "Install Command Line Developer Tools" | grep -v grep > /dev/null; then
    echo "⏳ Установка в процессе..."
    echo "   Процесс установки активен"
else
    echo "ℹ️  Процесс установки не найден"
fi

echo ""

# Проверяем установку через xcode-select
if xcode-select -p &>/dev/null; then
    echo "✅ Xcode Command Line Tools установлены!"
    echo "   Путь: $(xcode-select -p)"
    exit 0
else
    echo "❌ Xcode Command Line Tools еще не установлены"
    echo ""
    echo "Проверяем наличие инструментов в системе..."
    
    # Проверяем наличие базовых инструментов
    if command -v git &> /dev/null && command -v clang &> /dev/null && command -v make &> /dev/null; then
        echo "   ✓ git, clang, make найдены в системе"
        echo "   Но xcode-select не настроен"
    fi
    
    # Проверяем через pkgutil
    if pkgutil --pkg-info=com.apple.pkg.CLTools_Executables &>/dev/null; then
        echo "   ✓ Пакет Command Line Tools найден в системе"
    else
        echo "   ✗ Пакет Command Line Tools не найден"
    fi
    
    exit 1
fi

