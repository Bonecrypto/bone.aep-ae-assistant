#!/bin/bash
# AE Assistant — установка на macOS. Двойной клик (первый раз: правый клик → «Открыть»).
set -e
ID="com.aeassistant.panel"
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/$ID"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/$ID"

if [ ! -f "$SRC/CSXS/manifest.xml" ]; then
  echo "[!] Не найдена папка $ID рядом с install.command."
  echo "    Распакуй архив целиком и запусти install.command из распакованной папки."
  read -n 1 -s -r -p "Нажми любую клавишу…"; exit 1
fi

echo "Включаю режим разработчика CEP…"
for v in 11 12 13; do defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1; done

echo "Копирую панель в $DEST"
mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
cp -R "$SRC" "$DEST"
# файлы из скачанного архива помечены «из интернета» — снимаем метку, чтобы AE спокойно их загрузил
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true

echo
echo "Готово. Перезапусти After Effects и открой: Window → Extensions → AE Assistant"
read -n 1 -s -r -p "Нажми любую клавишу, чтобы закрыть окно…"
echo
