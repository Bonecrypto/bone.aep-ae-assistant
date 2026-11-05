# AE Assistant

Панель для Adobe After Effects: ИИ-чат и быстрые действия над композицией.
Сейчас: каркас CEP-панели, кнопка «Влёт слева» и чат-заглушка, которая отвечает «привет».

## Почему CEP, а не UXP
В After Effects (26.x, осень 2026) UXP даёт только скриптовые API в превью, готовой системы панелей нет.
Поэтому панель — CEP (React + TypeScript + Vite), действия — ExtendScript (`host/*.jsx`).
Переход на UXP — когда Adobe выпустит панели для AE в стабильной версии.

## Установка
Для пользователей — [INSTALL.md](INSTALL.md): скачать архив, запустить `install.cmd`.

## Установка для разработки (Windows)
Нужны Node.js 20+ и After Effects 2022 (22.0) или новее.

```bash
npm install
npm run build
npm run install:dev
```

`install:dev` включает `PlayerDebugMode` для CEP 11–13 (разрешает неподписанные панели)
и копирует сборку в `%APPDATA%\Adobe\CEP\extensions\com.aeassistant.panel`.
Затем перезапустите AE → **Окно → Расширения → AE Assistant**.

Отладка панели (DevTools): откройте в Chrome `http://localhost:8860`.

## Проверка в AE
1. Создайте композицию, добавьте пару слоёв, выделите их.
2. Поставьте указатель времени туда, где слой должен оказаться на месте.
3. Нажмите «Влёт слева» → на позиции появятся 2 ключа (0,6 с) с ease.
4. Один **Ctrl+Z** отменяет всё действие.

## Команды
| Команда | Что делает |
|---|---|
| `npm run dev` | панель в браузере (без AE, ответы AE имитируются) |
| `npm run build` | проверка типов + проверка host-скриптов + сборка в `dist/com.aeassistant.panel` |
| `npm test` | прогон `host/*.jsx` на имитации объектов AE |
| `npm run install:dev` | установка сборки в папку расширений CEP |
| `npm run package` | архив для релиза `dist/release/AE-Assistant-<версия>-win.zip` |

## Структура
```
cep/CSXS/manifest.xml   манифест CEP-расширения
host/index.jsx          ExtendScript: AEA.run("<tool>", {...}) → JSON
src/lib/cep.ts          мост панель → AE (evalScript)
src/tools/              инструменты: { name, description, inputSchema, mutates, run }
src/tools/ae/flyIn.ts   «Влёт слева»
src/chat/provider.ts    провайдер чата (пока заглушка)
src/App.tsx             интерфейс
```

### Как добавить возможность
1. Функция в `host/index.jsx`: `tools["ae.xxx"] = function (args) {...}` внутри
   `app.beginUndoGroup(args.undoName)` / `finally { app.endUndoGroup() }`.
2. Модуль `src/tools/ae/xxx.ts` с `description` для модели и понятными ошибками.
3. Строка в `src/tools/registry.ts`.

### Правила для host-скриптов
- Только ES3 (`var`, без `=>`, `let`, шаблонных строк) и только ASCII в коде:
  русские тексты (имена undo, сообщения) приходят из панели. `npm run build` это проверяет.
- Методы сверяются с [AE Scripting Guide](https://ae-scripting.docsforadobe.dev/).
