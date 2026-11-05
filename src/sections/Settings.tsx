import { useState } from "react";
import { complete, chatConfig, ChatError } from "../chat/client";
import { PROVIDERS, type ProviderId } from "../chat/providers";
import { BUILD, REPO_URL, VERSION } from "../config";
import { openUrl } from "../lib/cep";
import { setPrefs, setStatus, usePrefs } from "../lib/store";
import { canSelfUpdate, fetchReleases, installRelease, isCurrent, isNewer, type Release } from "../lib/update";
import { Btn, Row, Seg } from "../ui/ui";
import { BRAND_ACCENTS, BrandLogo } from "../ui/Brand";

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
    if (!canSelfUpdate() || !r.zipUrl) { openUrl(r.zipUrl ?? r.pageUrl); setUpdMsg("Скачайте архив, закройте AE и запустите install.cmd."); return; }
    try {
      await installRelease(r, (s) => { setUpdMsg(s); setStatus({ kind: "busy", text: s }); });
    } catch (e) {
      setUpdMsg(`Не получилось обновить автоматически: ${(e as Error).message}. Скачайте архив вручную.`);
      openUrl(r.zipUrl);
    }
  };

  const accentName = BRAND_ACCENTS.find((a) => a.hex === p.accent)?.name ?? p.accent;
  return (
    <section className="section settings">
      <div className="panel brand-panel">
        <BrandLogo />
        <button className="link" onClick={() => openUrl("https://boneaep.com")}>boneaep.com</button>
      </div>
      <div className="panel">
        <div className="panel-title">Оформление <span className="hint">· {accentName}</span></div>
        <div className="swatches">
          {BRAND_ACCENTS.map((c) => <button key={c.hex} className={`swatch${p.accent === c.hex ? " on" : ""}`} style={{ background: c.hex }} title={c.name} onClick={() => setPrefs({ accent: c.hex })} />)}
        </div>
        <Seg value={p.theme} onChange={(v) => setPrefs({ theme: v })} options={[{ value: "dark", label: "Тёмная" }, { value: "light", label: "Светлая" }]} />
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
