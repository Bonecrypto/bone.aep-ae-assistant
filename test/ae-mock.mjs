// Упрощённая имитация объектной модели After Effects для тестов host-скрипта.
// Не заменяет проверку в настоящем AE, но ловит ошибки логики, undo-групп и ease.
import { bundleHost } from "../scripts/host-bundle.mjs";

export const PVT = { NO_VALUE: 6412, ThreeD_SPATIAL: 6413, ThreeD: 6414, TwoD_SPATIAL: 6415, TwoD: 6416, OneD: 6417, COLOR: 6418, SHAPE: 6421, TEXT_DOCUMENT: 6422, LAYER_INDEX: 6420 };
export const PT = { PROPERTY: 6812, INDEXED_GROUP: 6813, NAMED_GROUP: 6814 };
const LINEAR = 6612, BEZIER = 6613;

export class KeyframeEase { constructor(speed, influence) { if (influence < 0.1 || influence > 100) throw new Error("influence out of range"); this.speed = speed; this.influence = influence; } }
export class MarkerValue { constructor(comment) { this.comment = comment; this.duration = 0; this.label = 0; } }
export class Shape { constructor() { this.vertices = []; this.inTangents = []; this.outTangents = []; this.closed = true; } }

const dimsFor = (t) => (t === PVT.TwoD ? 2 : t === PVT.ThreeD ? 3 : 1);

export class Prop {
  constructor(name, value, type = PVT.OneD, matchName = name) {
    Object.assign(this, { name, matchName, value, propertyValueType: type, propertyType: PT.PROPERTY });
    this.keys = []; this.expression = ""; this.expressionEnabled = false; this.expressionError = "";
    this.canSetExpression = true; this.canVaryOverTime = true; this.dimensionsSeparated = false; this.selectedKeysList = [];
  }
  get numKeys() { return this.keys.length; }
  get selectedKeys() { return this.selectedKeysList; }
  setValue(v) { if (this.keys.length) throw new Error("setValue on keyframed property"); this.value = v; }
  valueAtTime(t) {
    if (!this.keys.length) return this.value;
    let v = this.keys[0].v; for (const k of this.keys) if (k.t <= t + 1e-9) v = k.v; return v;
  }
  setValueAtTime(t, v) {
    const n = dimsFor(this.propertyValueType);
    const e = () => Array.from({ length: n }, () => new KeyframeEase(0, 16.666));
    const i = this.keys.findIndex((k) => Math.abs(k.t - t) < 1e-9);
    const key = { t, v, inI: LINEAR, outI: LINEAR, inE: e(), outE: e() };
    if (i >= 0) this.keys[i] = key; else { this.keys.push(key); this.keys.sort((a, b) => a.t - b.t); }
  }
  nearestKeyIndex(t) { let best = 0; this.keys.forEach((k, i) => { if (Math.abs(k.t - t) < Math.abs(this.keys[best].t - t)) best = i; }); return best + 1; }
  key(i) { if (i < 1 || i > this.keys.length) throw new Error("bad key index " + i); return this.keys[i - 1]; }
  keyTime(i) { return this.key(i).t; }
  keyValue(i) { return this.key(i).v; }
  keyInInterpolationType(i) { return this.key(i).inI; }
  keyOutInterpolationType(i) { return this.key(i).outI; }
  setInterpolationTypeAtKey(i, a, b = a) { Object.assign(this.key(i), { inI: a, outI: b }); }
  keyInTemporalEase(i) { return this.key(i).inE; }
  keyOutTemporalEase(i) { return this.key(i).outE; }
  setTemporalEaseAtKey(i, a, b = a) {
    const n = dimsFor(this.propertyValueType);
    if (a.length !== n || b.length !== n) throw new Error(`ease dims: need ${n}, got ${a.length}/${b.length}`);
    Object.assign(this.key(i), { inE: a, outE: b });
  }
}

export class Group {
  constructor(matchName, children = [], { addable = {} } = {}) {
    this.matchName = matchName; this.name = matchName; this.propertyType = PT.NAMED_GROUP;
    this.children = children; this.addable = addable;
  }
  get numProperties() { return this.children.length; }
  property(n) { return typeof n === "number" ? this.children[n - 1] ?? null : this.children.find((c) => c.matchName === n || c.name === n) ?? null; }
  canAddProperty(m) { return m in this.addable; }
  addProperty(m) {
    if (!(m in this.addable)) throw new Error("cannot add " + m);
    const made = this.addable[m]();
    made.matchName = m; if (!made.name) made.name = m;
    this.children.push(made); return made;
  }
}

const many = (n, first = 0) => Array.from({ length: n }, (_, i) => new Prop("p" + (i + 1), i === 1 && first ? first : 0));
const effectFactory = (m) => () => new Group(m,
  m === "ADBE Drop Shadow" ? [new Prop("Color", [0, 0, 0, 1], PVT.COLOR), new Prop("Opacity", 127), new Prop("Direction", 135), new Prop("Distance", 5), new Prop("Softness", 0)]
  : m === "ADBE Geometry2" ? [new Prop("Anchor", [960, 540], PVT.TwoD_SPATIAL), new Prop("Position", [960, 540], PVT.TwoD_SPATIAL), ...many(10)]
  : m === "ADBE Tile" ? many(8) : m === "ADBE Gaussian Blur 2" ? many(3) : [new Prop(m + " value", 0)]);
const EFFECTS = ["ADBE Brightness & Contrast 2", "CC Light Sweep", "ADBE Noise", "ADBE Black&White", "ADBE CurvesCustom", "ADBE HUE SATURATION", "ADBE Geometry2", "ADBE Tile", "ADBE Gaussian Blur 2", "ADBE Slider Control", "ADBE Checkbox Control", "ADBE Layer Control", "ADBE Angle Control", "ADBE Glo2", "ADBE Gaussian Blur 2", "ADBE Tint", "ADBE Fill", "ADBE Drop Shadow"];

function transform(pos) {
  const p = new Prop("Position", [...pos], PVT.TwoD_SPATIAL, "ADBE Position");
  return new Group("ADBE Transform Group", [
    new Prop("Anchor Point", [0, 0], PVT.TwoD_SPATIAL, "ADBE Anchor Point"), p,
    new Prop("X Position", pos[0], PVT.OneD, "ADBE Position_0"), new Prop("Y Position", pos[1], PVT.OneD, "ADBE Position_1"),
    new Prop("Scale", [100, 100, 100], PVT.ThreeD, "ADBE Scale"), new Prop("Rotation", 0, PVT.OneD, "ADBE Rotate Z"),
    new Prop("Opacity", 100, PVT.OneD, "ADBE Opacity"),
  ]);
}

export class Layer {
  constructor({ name = "Слой", pos = [960, 540], locked = false, rect = { left: -100, top: -50, width: 200, height: 100 } } = {}) {
    Object.assign(this, { name, locked, rect, parent: null, threeDLayer: false, selected: true, label: 0, startTime: 0, inPoint: 0, outPoint: 10, nullLayer: false, adjustmentLayer: false, hasVideo: true, hasAudio: false, source: null });
    this.groups = { "ADBE Marker": Object.assign(new Prop("Marker", null, PVT.NO_VALUE, "ADBE Marker"), { canSetExpression: false }), "ADBE Transform Group": transform(pos), "ADBE Effect Parade": new Group("ADBE Effect Parade", [], { addable: Object.fromEntries(EFFECTS.map((m) => [m, effectFactory(m)])) }) };
    this.selectedProperties = [];
  }
  property(n) { return this.groups[n] ?? null; }
  sourceRectAtTime() { return this.rect; }
  setParentWithJump(p) { this.parent = p; }
  moveBefore(other) { this.movedBefore = other; }
  moveAfter(other) { if (this.comp) { const L = this.comp.list; L.splice(L.indexOf(this), 1); L.splice(L.indexOf(other) + 1, 0, this); } }
  moveToBeginning() { this.atTop = true; }
  remove() { this.removed = true; }
  get index() { return this.comp ? this.comp.list.indexOf(this) + 1 : 1; }
}

export function makeContext(activeItem) {
  const undo = [];
  class AVLayer extends Layer {}
  class TextLayer extends AVLayer {}
  class ShapeLayer extends AVLayer {}
  class CameraLayer extends Layer {}
  class LightLayer extends Layer {}
  class CompItem {
    constructor(layers = []) {
      Object.assign(this, { name: "Comp 1", width: 1920, height: 1080, pixelAspect: 1, duration: 10, frameRate: 25, frameDuration: 0.04, time: 1 });
      this.list = []; layers.forEach((l) => this.attach(l));
      this.markerProperty = new Prop("Marker", null, PVT.NO_VALUE, "ADBE Marker");
      const comp = this;
      this.layers = {
        addSolid(color, name) { const l = new AVLayer({ name }); l.solidColor = color; l.source = { mainSource: new SolidSource() }; l.groups["ADBE Mask Parade"] = new Group("ADBE Mask Parade", [], { addable: { "ADBE Mask Atom": () => { const g = new Group("ADBE Mask Atom", [new Prop("Mask Path", null, PVT.SHAPE, "ADBE Mask Shape"), new Prop("Feather", [0, 0], PVT.TwoD, "ADBE Mask Feather"), new Prop("Expansion", 0, PVT.OneD, "ADBE Mask Offset")]); g.inverted = false; return g; } } }); return comp.attach(l, true); },
        addNull() { const l = new AVLayer({ name: "Null" }); l.nullLayer = true; return comp.attach(l, true); },
        addCamera(name) { return comp.attach(new CameraLayer({ name }), true); },
        addShape() { const l = new ShapeLayer({ name: "Shape" }); l.groups["ADBE Root Vectors Group"] = vectorsGroup("ADBE Root Vectors Group"); return comp.attach(l, true); },
        precompose(idx, name) { comp.precomposed = { idx, name }; return { name }; },
        add(source) { const l = new AVLayer({ name: source.name }); l.source = source; return comp.attach(l, true); },
      };
    }
    attach(l, top = false) { l.comp = this; if (top) this.list.unshift(l); else this.list.push(l); return l; }
    get numLayers() { return this.list.length; }
    layer(i) { return this.list[i - 1]; }
    get selectedLayers() { return this.list.filter((l) => l.selected && !l.removed); }
  }
  class SolidSource {}
  // ---------- проект, папки, файлы, импорт ----------
  class FolderItem { constructor(name) { this.name = name; this.comment = ""; this.list = []; this._parent = null; }
    get numItems() { return this.list.length; } item(i) { return this.list[i - 1]; }
    get parentFolder() { return this._parent; } set parentFolder(f) { if (this._parent) this._parent.list = this._parent.list.filter((x) => x !== this); this._parent = f; f.list.push(this); } }
  class FootageItem { constructor(name) { this.name = name; this.comment = ""; this._parent = null; }
    get parentFolder() { return this._parent; } set parentFolder(f) { if (this._parent) this._parent.list = this._parent.list.filter((x) => x !== this); this._parent = f; f.list.push(this); } }
  const files = new Set();
  class File { constructor(p) { this.fsName = p; } get exists() { return files.has(this.fsName); } get parent() { return new Folder(this.fsName.replace(/[\\/][^\\/]*$/, "")); } }
  class Folder { constructor(p) { this.fsName = p; } get exists() { return files.has(this.fsName + "/"); } execute() { ctx.revealed = this.fsName; } }
  Folder.selectDialog = () => new Folder("C:/Библиотека");
  class ImportOptions { constructor(f) { this.file = f; } canImportAs() { return /\.aep$/i.test(this.file.fsName); } }
  const root = new FolderItem("root");
  function vectorsGroup(m) {
    return new Group(m, [], { addable: {
      "ADBE Vector Group": () => new Group("ADBE Vector Group", [vectorsGroup("ADBE Vectors Group")]),
      "ADBE Vector Shape - Group": () => new Group("", [new Prop("Path", null, PVT.SHAPE, "ADBE Vector Shape")]),
      "ADBE Vector Shape - Ellipse": () => new Group("", [new Prop("Size", [100, 100], PVT.TwoD, "ADBE Vector Ellipse Size")]),
      "ADBE Vector Shape - Rect": () => new Group("", [new Prop("Size", [100, 100], PVT.TwoD, "ADBE Vector Rect Size"), new Prop("Roundness", 0, PVT.OneD, "ADBE Vector Rect Roundness")]),
      "ADBE Vector Graphic - Fill": () => new Group("", [new Prop("Color", [1, 1, 1, 1], PVT.COLOR, "ADBE Vector Fill Color"), new Prop("Opacity", 100, PVT.OneD, "ADBE Vector Fill Opacity")]),
      "ADBE Vector Graphic - Stroke": () => new Group("", [new Prop("Color", [1, 1, 1, 1], PVT.COLOR, "ADBE Vector Stroke Color"), new Prop("Stroke Width", 2, PVT.OneD, "ADBE Vector Stroke Width"), new Prop("Line Cap", 1, PVT.NO_VALUE, "ADBE Vector Stroke Line Cap"), new Prop("Opacity", 100, PVT.OneD, "ADBE Vector Stroke Opacity")]),
      "ADBE Vector Filter - Trim": () => new Group("", [new Prop("Start", 0, PVT.OneD, "ADBE Vector Trim Start"), new Prop("End", 100, PVT.OneD, "ADBE Vector Trim End")]),
    } });
  }
  function makeText(name, doc) {
    const l = new TextLayer({ name });
    const docProp = new Prop("Source Text", doc, PVT.TEXT_DOCUMENT, "ADBE Text Document");
    const animators = new Group("ADBE Text Animators", [], { addable: { "ADBE Text Animator": () => new Group("", [
      new Group("ADBE Text Selectors", [], { addable: {
        "ADBE Text Selector": () => new Group("", [new Prop("Start", 0, PVT.OneD, "ADBE Text Percent Start"), new Prop("End", 100, PVT.OneD, "ADBE Text Percent End")]),
        "ADBE Text Expressible Selector": () => new Group("", [new Prop("Based On", 1, PVT.NO_VALUE, "ADBE Text Range Type2"), new Prop("Amount", [100, 100, 100], PVT.ThreeD, "ADBE Text Expressible Amount")]),
      } }),
      new Group("ADBE Text Animator Properties", [], { addable: Object.fromEntries(["ADBE Text Opacity", "ADBE Text Position 3D", "ADBE Text Scale 3D", "ADBE Text Blur", "ADBE Text Rotation", "ADBE Text Skew", "ADBE Text Tracking Amount"].map((m) => [m, () => new Prop(m, 0, PVT.OneD, m)])) }),
    ]) } });
    l.groups["ADBE Text Properties"] = new Group("ADBE Text Properties", [docProp, animators]);
    return l;
  }

  const ctx = {
    CompItem, AVLayer, TextLayer, ShapeLayer, CameraLayer, LightLayer, SolidSource, KeyframeEase, Shape, MarkerValue,
    FolderItem, FootageItem, File, Folder, ImportOptions, ImportAsType: { PROJECT: 1, FOOTAGE: 2 },
    PropertyValueType: PVT, PropertyType: PT,
    KeyframeInterpolationType: { LINEAR, BEZIER, HOLD: 6614 },
    app: { version: "26.5x89", project: { activeItem: null, numItems: 3, removeUnusedFootage: () => 2, rootFolder: root,
      items: { addFolder: (n) => { const f = new FolderItem(n); f.parentFolder = root; return f; } },
      importFile: (io) => {
        ctx.imports = (ctx.imports ?? 0) + 1;
        const base = io.file.fsName.split(/[\\/]/).pop().replace(/\.[^.]+$/, "");
        if (io.importAs === 1) {
          const f = new FolderItem(base + ".aep");
          const inner = new CompItem([]); inner.name = "Внутренняя"; inner.usedIn = [{}];
          const main = new CompItem([]); main.name = base; main.usedIn = []; main.markerProperty.setValueAtTime(0.5, null);
          f.list.push(inner, main); f.parentFolder = root; return f;
        }
        const it = new FootageItem(base); it.parentFolder = root; return it;
      } }, beginUndoGroup: (n) => undo.push("begin:" + n), endUndoGroup: () => undo.push("end") },
  };
  ctx.$ = { global: ctx };
  // host выполняется в том же «мире», что и тест: те же Array/Object, без vm-песочницы
  new Function(...Object.keys(ctx), bundleHost())(...Object.values(ctx));
  const comp = activeItem === null ? null : new CompItem(activeItem ?? []);
  ctx.app.project.activeItem = comp;
  return {
    ctx, comp, undo, makeText, Layer: AVLayer, files, root,
    run: (name, args) => JSON.parse(ctx.AEA.run(name, args)),
  };
}

/** Значения из песочницы -> обычные значения Node (для deepEqual). */
export const plain = (v) => JSON.parse(JSON.stringify(v));
