@echo off
chcp 65001 >nul
setlocal
title AE Assistant — установка

set "ID=com.aeassistant.panel"
set "SRC=%~dp0%ID%"
set "DEST=%APPDATA%\Adobe\CEP\extensions\%ID%"

if not exist "%SRC%\CSXS\manifest.xml" (
  echo [!] Не найдена папка %ID% рядом с install.cmd.
  echo     Распакуй архив целиком и запусти install.cmd из распакованной папки.
  pause
  exit /b 1
)

echo Включаю режим разработчика CEP...
for %%V in (11 12 13) do reg add "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul

echo Копирую панель в %DEST%
if exist "%DEST%" rmdir /s /q "%DEST%"
xcopy "%SRC%" "%DEST%\" /e /i /h /q /y >nul
if errorlevel 1 (
  echo [!] Не удалось скопировать файлы. Закрой After Effects и запусти install.cmd ещё раз.
  pause
  exit /b 1
)

echo.
echo Готово. Перезапусти After Effects и открой: Window -^> Extensions -^> AE Assistant
pause
