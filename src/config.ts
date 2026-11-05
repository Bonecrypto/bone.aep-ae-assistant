declare const __APP_VERSION__: string;
declare const __BUILD__: string;

/** Версия и номер сборки (номер — из GitHub Actions, локально 0). */
export const VERSION = __APP_VERSION__;
export const BUILD = Number(__BUILD__) || 0;

/** Репозиторий, где лежат релизы для автообновления. */
export const REPO = "dukost42-byte/ae-assistant";
export const REPO_URL = `https://github.com/${REPO}`;
