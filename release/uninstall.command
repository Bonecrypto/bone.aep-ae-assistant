#!/bin/bash
# AE Assistant — удаление на macOS.
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/com.aeassistant.panel"
if [ ! -d "$DEST" ]; then echo "AE Assistant не установлен."; else rm -rf "$DEST"; echo "Готово: AE Assistant удалён. Режим разработчика CEP оставлен — им могут пользоваться другие панели."; fi
read -n 1 -s -r -p "Нажми любую клавишу…"
echo
