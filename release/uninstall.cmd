@echo off
chcp 65001 >nul
setlocal
title AE Assistant — удаление

set "DEST=%APPDATA%\Adobe\CEP\extensions\com.aeassistant.panel"
if not exist "%DEST%" (
  echo AE Assistant не установлен.
  pause
  exit /b 0
)
rmdir /s /q "%DEST%"
echo Готово: AE Assistant удалён. Режим разработчика CEP оставлен включённым — им могут пользоваться другие панели.
pause
