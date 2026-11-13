import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const I = (d: JSX.Element) => (p: P) => <svg {...base} {...p}>{d}</svg>;

export const IconSparkles = I(<><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></>);
export const IconCurve = I(<><path d="M4 20C10 20 9 4 20 4" /><circle cx="4" cy="20" r="1.6" /><circle cx="20" cy="4" r="1.6" /></>);
export const IconBraces = I(<><path d="M8 4c-2 0-2 1.5-2 3v2c0 1.5-1 3-2 3 1 0 2 1.5 2 3v2c0 1.5 0 3 2 3" /><path d="M16 4c2 0 2 1.5 2 3v2c0 1.5 1 3 2 3-1 0-2 1.5-2 3v2c0 1.5 0 3-2 3" /></>);
export const IconPlus = I(<><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M12 8v8M8 12h8" /></>);
export const IconText = I(<><path d="M5 6V5h14v1M12 5v14M9 19h6" /></>);
export const IconWrench = I(<><path d="M14.5 6.5a4 4 0 0 0 5 5L12 19l-3 1 1-3 7.5-7.5" /><path d="M14.5 6.5L9 12" /><path d="M15 3a4 4 0 0 1 6 6" /></>);
export const IconChat = I(<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />);
export const IconGear = I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>);
export const IconSearch = I(<><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>);
export const IconSend = I(<path d="M5 12h13M12 5l7 7-7 7" />);
export const IconStar = I(<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.8z" />);
export const IconDownload = I(<><path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 20h14" /></>);
export const IconLayers = I(<><rect x="3" y="7" width="12" height="12" rx="3" /><path d="M8 4h9a3 3 0 0 1 3 3v9" /></>);
export const IconWave = I(<path d="M2 12h3l2-6 4 12 3-9 2 3h6" />);
export const IconFolder = I(<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />);
export const IconProject = I(<><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M12 10v6M9 13h6" /></>);
