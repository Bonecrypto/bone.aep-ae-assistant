import { useState } from "react";
import { complete, chatConfig, ChatError } from "../chat/client";
import { PROVIDERS, type ProviderId } from "../chat/providers";
import { BUILD, REPO_URL, VERSION } from "../config";
import { openUrl } from "../lib/cep";
import { setPrefs, setStatus, usePrefs } from "../lib/store";
import { canSelfUpdate, fetchReleases, installRelease, isCurrent, isNewer, type Release } from "../lib/update";
import { Btn, Row, Seg } from "../ui/ui";
import { clearLog, getLog, report } from "../lib/errorlog";
import { isMac } from "../lib/platform";
import { STT, type SttProvider } from "../lib/stt";
import { copyText } from "../lib/clipboard";
import { callHost } from "../lib/cep";

const ACCENTS = ["#9f18ec", "#0a84ff", "#ff6b2c", "#e0245e", "#30b06f", "#6e5cff", "#c8a24a"];

export function SettingsSection() {
  const p = usePrefs();
  const def = PROVIDERS[p.chatProvider];
  const [testing, setTesting] = useState("");
  const [releases, setReleases] = useState<Release[] | null>(null);
  const [updMsg, setUpdMsg] = useState("");

  const test = async () => {
    setTesting("Проверяю…");
    try {
      const r = await complete([{ role: "user", content: "Ответь одним словом: работает" }], []);
      setTesting(`Связь есть: «${(r.content ?? "").trim().slice(0, 40)}»`);
    } catch (e) {
      setTesting(e instanceof ChatError ? e.message : String(e));
    }
  };

  const check = async () => {
    setUpdMsg("Проверяю…");
    try {
      const list = await fetchReleases();
      setReleases(list);
      const newest = list.find(isNewer);
      setUpdMsg(list.length === 0 ? "Релизов пока нет." : newest ? `Доступна версия ${newest.version} (сборка ${newest.build}).` : "У вас последняя версия.");
    } catch (e) {
      setUpdMsg(String((e as Error).message ?? e));
    }
  };

  const install = async (r: Release) => {
    if (!canSelfUpdate() || !r.zipUrl) { openUrl(r.zipUrl ?? r.pageUrl); setUpdMsg(`Скачайте архив, закройте AE и запустите ${isMac ? "install.command" : "install.cmd"}.`); return; }
    try {
      await installRelease(r, (s) => { setUpdMsg(s); setStatus({ kind: "busy", text: s }); });
    } catch (e) {
      setUpdMsg(`Не получилось обновить автоматически: ${(e as Error).message}. Скачайте архив вручную.`);
      openUrl(r.zipUrl);
    }
  };

  return (
    <section className="section settings">
      <div className="panel">
        <div className="panel-title">Оформление</div>
        <div className="swatches">
          {ACCENTS.map((c) => <button key={c} className={`swatch${p.accent === c ? " on" : ""}`} style={{ background: c }} title={c} onClick={() => setPrefs({ accent: c })} />)}
        </div>
        <Seg value={p.theme} onChange={(v) => setPrefs({ theme: v })} options={[{ value: "dark", label: "Тёмная" }, { value: "light", label: "Светлая" }]} />
        <label className="toggle" title="Колонка слева: избранное (звёздочки) и частые действия">
          <input type="checkbox" checked={p.dock} onChange={(e) => setPrefs({ dock: e.target.checked })} />
          <span className="switch" /> Панель быстрого доступа слева
        </label>
      </div>

      <div className="panel">
        <div className="panel-title">Как ставить анимации</div>
        <Seg value={p.animControl} onChange={(v) => setPrefs({ animControl: v })} options={[
          { value: "tr", label: "TR In / TR Out", hint: "Как в Animation Composer: появление — от начала слоя до маркера «TR In», исчезание — от «TR Out» до конца слоя" },
          { value: "marker", label: "Полоса с длительностью", hint: "Маркер-полоса от начала анимации: тянешь конец — меняется длительность" },
          { value: "keys", label: "Ключи", hint: "Обычные ключевые кадры — можно править график скорости" },
        ]} />
        <div className="panel-hint">
          {p.animControl === "tr"
            ? "Появление идёт от начала слоя до маркера «TR In», исчезание — от «TR Out» до конца слоя. Все анимации слоя слушают один маркер: двигаешь его — меняется длительность всех сразу."
            : p.animControl === "marker"
              ? "Переходы, текст и тряска ставят маркер-полосу: двигаешь — сдвигается, тянешь конец — меняется длительность, удаляешь — анимации нет."
              : "Переходы слоёв ставятся ключами. Текст и тряска всё равно управляются маркером."}
          {" "}Каскад по нескольким слоям всегда ставится полосой — у каждого слоя свой сдвиг.
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">ИИ-модель для чата</div>
        <Seg value={p.chatProvider} onChange={(v: ProviderId) => setPrefs({ chatProvider: v, chatModel: "", chatBaseUrl: "" })}
          options={(Object.keys(PROVIDERS) as ProviderId[]).map((id) => ({ value: id, label: PROVIDERS[id].title, hint: PROVIDERS[id].hint }))} />
        <div className="panel-hint">{def.hint}</div>
        <label className="field"><span>Модель</span>
          <input value={p.chatModel} placeholder={def.model || "название модели"} onChange={(e) => setPrefs({ chatModel: e.target.value.trim() })} /></label>
        {(p.chatProvider === "custom" || p.chatProvider === "ollama") && (
          <label className="field"><span>Адрес</span>
            <input value={p.chatBaseUrl} placeholder={def.baseUrl || "https://…/v1"} onChange={(e) => setPrefs({ chatBaseUrl: e.target.value.trim() })} /></label>
        )}
        {p.chatProvider !== "ollama" && (
          <label className="field"><span>Ключ</span>
            <input type="password" value={p.chatKey} placeholder={def.needsKey ? "вставьте API-ключ" : "если нужен"} onChange={(e) => setPrefs({ chatKey: e.target.value.trim() })} autoComplete="off" /></label>
        )}
        <Row between>
          {def.keyUrl ? <button className="link" onClick={() => openUrl(def.keyUrl!)}>Где взять ключ?</button> : <span />}
          <Btn onClick={test}>Проверить связь</Btn>
        </Row>
        {testing && <div className="panel-hint">{testing}</div>}
        <div className="panel-hint small">Ключ хранится только в этой панели на вашем компьютере. Сейчас: {chatConfig().baseUrl || "адрес не задан"}</div>
      </div>

      <div className="panel">
        <div className="panel-title">Субтитры — распознавание речи</div>
        <Seg value={p.sttProvider} onChange={(v: SttProvider) => setPrefs({ sttProvider: v, sttModel: "", sttBaseUrl: "" })}
          options={(Object.keys(STT) as SttProvider[]).map((id) => ({ value: id, label: STT[id].title, hint: STT[id].hint }))} />
        <div className="panel-hint">{STT[p.sttProvider].hint}</div>
        {p.sttProvider === "custom" && (
          <label className="field"><span>Адрес</span><input value={p.sttBaseUrl} placeholder="https://…/v1" onChange={(e) => setPrefs({ sttBaseUrl: e.target.value.trim() })} /></label>
        )}
        <label className="field"><span>Модель</span><input value={p.sttModel} placeholder={STT[p.sttProvider].model} onChange={(e) => setPrefs({ sttModel: e.target.value.trim() })} /></label>
        <label className="field"><span>Ключ</span><input type="password" value={p.sttKey} placeholder="API-ключ" autoComplete="off" onChange={(e) => setPrefs({ sttKey: e.target.value.trim() })} /></label>
        {STT[p.sttProvider].keyUrl && <button className="link" onClick={() => openUrl(STT[p.sttProvider].keyUrl!)}>Где взять ключ?</button>}
      </div>

      <ErrorLog />

      <div className="panel">
        <div className="panel-title">Обновления</div>
        <div className="panel-hint">Версия {VERSION}{BUILD ? `, сборка ${BUILD}` : " (локальная сборка)"}</div>
        <Row between>
          <button className="link" onClick={() => openUrl(`${REPO_URL}/releases`)}>Все релизы</button>
          <Btn primary onClick={check}>Проверить</Btn>
        </Row>
        {updMsg && <div className="panel-hint">{updMsg}</div>}
        {releases && releases.length > 0 && (
          <div className="releases">
            {releases.slice(0, 5).map((r) => (
              <div key={r.tag} className="release">
                <span>{r.version}{r.build ? ` · ${r.build}` : ""} <em>{r.date}</em></span>
                {isCurrent(r) ? <em>установлена</em> : <button className="link" onClick={() => install(r)}>{isNewer(r) ? "Обновить" : "Откатить"}</button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** Журнал ошибок: последние неудачные действия с параметрами и ответом AE — копируется одной кнопкой. */
function ErrorLog() {
  const [, setTick] = useState(0);
  const log = getLog();
  const copy = async () => {
    const r = await callHost("system.ping");
    copyText(report(r.ok ? String(r.appVersion) : "нет связи"));
  };
  return (
    <div className="panel">
      <div className="panel-title">Журнал ошибок <span className="hint">· {log.length ? `${log.length} записей` : "пусто"}</span></div>
      {log.slice(0, 4).map((e, i) => <div key={i} className="log-row" title={`${e.args}${e.host ? `\nAE: ${e.host}` : ""}`}><em>{e.at.slice(11)}</em> {e.tool}: {e.message}</div>)}
      <div className="panel-hint small">Если что-то не работает — нажмите «Скопировать отчёт» и пришлите текст разработчику.</div>
      <Row between>
        <button className="link" onClick={() => { clearLog(); setTick((t) => t + 1); }}>Очистить</button>
        <Btn onClick={copy}>Скопировать отчёт</Btn>
      </Row>
    </div>
  );
}
