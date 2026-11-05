# AE Assistant

Одна панель для Adobe After Effects вместо пачки плагинов: анимации, графики скорости, выражения,
элементы, текст, сервис, палитра команд (Ctrl+K) и ИИ-чат, который сам выполняет действия в проекте.

Установка для пользователей — [INSTALL.md](INSTALL.md): скачать архив из [последнего релиза](https://github.com/Bonecrypto/bone.aep-ae-assistant/releases/latest), запустить `install.cmd`.

## Почему CEP, а не UXP
В After Effects (26.x, осень 2026) UXP даёт только скриптовые API в превью, системы панелей нет.
Поэтому панель — CEP (React + TypeScript + Vite), действия — ExtendScript (`host/src/*.jsx`).

## Разработка (Windows)
Нужны Node.js 20+ и After Effects 2022 (22.0) или новее.

```bash
npm install
```
```bash
npm run build
```
```bash
npm run install:dev
```

Перезапустите AE → **Window → Extensions → AE Assistant**. DevTools панели: `http://localhost:8860`.

| Команда | Что делает |
|---|---|
| `npm run dev` | панель в браузере (без AE, ответы AE имитируются) |
| `npm test` | host-скрипт на имитации объектов AE |
| `npm run build` | типы + проверка host (ES3, ASCII) + сборка в `dist/com.aeassistant.panel` |
| `npm run package` | архив для релиза `dist/release/AE-Assistant-<версия>-win.zip` |
| `npm run install:dev` | установка сборки в папку расширений CEP |

## Релизы и обновления
GitHub Actions (`.github/workflows/release.yml`) на каждый push в `main` прогоняет тесты, собирает архив
и публикует релиз `v<версия>-b<номер сборки>`. Панель проверяет релизы при запуске, ставит обновление сама
(через Node.js в CEP) и даёт откатиться на прошлую сборку в настройках.

## Структура
```
cep/CSXS/manifest.xml       манифест CEP-расширения
host/src/*.jsx              ExtendScript, склеивается в host/index.jsx: AEA.run("<tool>", {...}) → JSON
  00_core                   JSON, undo-группы, ease-помощники
  10_animate 15_motion      переходы слоёв (несколько свойств, сдвиг между слоями, пружина, размытие)
  20_ease                   графики скорости (cubic-bezier ↔ KeyframeEase)
  30_expressions            выражения и ползунки-эффекты
  40_create 45_style        слои, эффекты, стили с параметрами
  50_text 55_textfx         стиль текста, анимация по буквам/словам/строкам (Expression Selector)
  60_elements 70_service    шейп-элементы, сервис
  65_scene                  переходы между сценами на склейке (корректирующий слой: Transform, Motion Tile, Blur)
  75_library                библиотека пользователя: импорт .aep/.ffx/медиа без дублей, выравнивание по маркеру
  80_info                   сводки для чата и строки состояния
src/presets/                пресеты вкладок: модель Preset {controls, preview, build} в types.ts, сводка в all.ts
src/lib/library.ts          сканирование папок библиотеки (Node), слежение за изменениями, «Новое»
src/ui/Browser.tsx          вкладка-браузер: список слева, превью, ползунки, «Применить»
src/tools/                  инструменты { name, description, inputSchema, mutates, run } — их видят кнопки и ИИ
src/tools/preset-tool.ts    ae.applyPreset — ИИ применяет любой пресет по имени
src/chat/                   OpenAI-совместимый клиент (OpenRouter / Gemini / Ollama) с вызовом инструментов
test/                       имитация AE, тесты host, тесты кода выражений на имитации движка выражений
```

### Как добавить пресет
Добавить объект в нужный `src/presets/*.ts`: `controls` (ползунки), `preview` (живое превью), `build` (какой инструмент и с какими аргументами).
Палитра Ctrl+K и чат (`ae.applyPreset`) подхватят его сами.

### Как добавить новую возможность в AE
1. Функция в `host/src/NN_*.jsx`: `tools["ae.xxx"] = function (args) { … undoable(args.undoName, function () { … }) … }`.
2. Инструмент в `src/tools/ae/*.ts` через `hostTool({...})` — с понятным `description` для модели.
3. Строка в `src/tools/registry.ts` (если нужен ИИ напрямую), тест в `test/host.test.mjs`.

### Правила для host-скриптов
- Только ES3 (`var`, без `=>`, `let`, шаблонных строк, `forEach`/`map`) и только ASCII в коде:
  русские тексты (имена undo, слоёв, эффектов) приходят из панели. `npm run build` это проверяет.
- Методы и matchName сверяются с [AE Scripting Guide](https://ae-scripting.docsforadobe.dev/).
