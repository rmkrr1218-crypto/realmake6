(() => {
  "use strict";

  // 画面要素を取得する
  const canvas = document.getElementById("editorCanvas");
  const context = canvas.getContext("2d");
  const simulator = document.querySelector(".simulator");
  const workspace = document.querySelector(".workspace");
  const imageInput = document.getElementById("imageInput");
  const emptyState = document.getElementById("emptyState");
  const samplePhotoButton = document.getElementById("samplePhotoButton");
  const sampleNotice = document.getElementById("sampleNotice");
  const switchPhotoButton = document.getElementById("switchPhotoButton");
  const statusText = document.getElementById("statusText");
  const brushHint = document.getElementById("brushHint");
  const colorStatus = document.getElementById("colorStatus");
  const colorHint = document.getElementById("colorHint");
  const saveHint = document.getElementById("saveHint");
  const consultSaveButton = document.getElementById("consultSaveButton");
  const consultStatus = document.getElementById("color-consult-status");
  const savePreview = document.getElementById("savePreview");
  const savePreviewImage = document.getElementById("savePreviewImage");
  const saveDebug = document.getElementById("saveDebug");
  const saveDebugSecure = document.getElementById("saveDebugSecure");
  const saveDebugProtocol = document.getElementById("saveDebugProtocol");
  const saveDebugShare = document.getElementById("saveDebugShare");
  const saveDebugCanShare = document.getElementById("saveDebugCanShare");
  const saveDebugFileShare = document.getElementById("saveDebugFileShare");
  const saveDebugError = document.getElementById("saveDebugError");
  const strengthInput = document.getElementById("strengthInput");
  const brightnessInput = document.getElementById("brightnessInput");
  const strengthValue = document.getElementById("strengthValue");
  const brightnessValue = document.getElementById("brightnessValue");
  const debugColorName = document.getElementById("debugColorName");
  const debugColorHex = document.getElementById("debugColorHex");
  const debugColorSwatch = document.getElementById("debugColorSwatch");
  const autoSelectStatus = document.getElementById("autoSelectStatus");
  const colorChoices = [...document.querySelectorAll(".color-choice")];
  const colorGroupToggles = [...document.querySelectorAll(".color-group-toggle")];
  const buttons = {
    rotate: document.getElementById("rotateButton"), zoomOut: document.getElementById("zoomOutButton"), zoomIn: document.getElementById("zoomInButton"), fit: document.getElementById("fitButton"),
    auto: document.getElementById("autoSelectButton"), pan: document.getElementById("panButton"), paint: document.getElementById("paintButton"), erase: document.getElementById("eraseButton"),
    small: document.getElementById("brushSmallButton"), medium: document.getElementById("brushMediumButton"), large: document.getElementById("brushLargeButton"),
    undo: document.getElementById("undoBrushButton"), clear: document.getElementById("clearBrushButton"), resetColor: document.getElementById("resetColorButton"), resetAll: document.getElementById("resetAllButton"),
    before: document.getElementById("beforeButton"), after: document.getElementById("afterButton"), save: document.getElementById("saveButton"),
    presentation: document.getElementById("presentationButton"), editReturn: document.getElementById("editReturnButton"),
  };

  // マスクは画像座標で保持するため、拡大・回転・写真移動後も塗った位置がずれない
  const state = {
    image: null, imageVersion: 0, rotation: 0, zoom: 1, panX: 0, panY: 0,
    tool: "auto", brushSize: "medium", brushCursor: null,
    mask: null, overlay: null, maskRevision: 0, anchorRevision: 0, selectionExists: false, autoSelectCount: 0, autoNotice: "", history: [], activeStroke: null,
    pointers: new Map(), gesture: null, hasPointerInput: false,
    selectedColor: null, previewMode: "before", colorStrength: 100, colorBrightness: 0, presentationMode: false, savePreviewUrl: null, saveNotice: "", isSample: false,
    renderCache: { originalSignature: "", simulationSignature: "", colorizedSignature: "", original: document.createElement("canvas"), simulation: document.createElement("canvas"), colorized: document.createElement("canvas") },
  };
  const MIN_ZOOM = 0.35;
  const MAX_ZOOM = 6;
  // スマホ写真（4000px級）でも窓まわりの境界がギザつきにくい解像度。上げすぎると自動選択が重くなる。
  const MASK_MAX_SIDE = 1536;
  const MAX_HISTORY = 8;
  // 外壁が分かれている写真でも補えるよう、自動選択は初回を含め最大5回まで追加できる
  const MAX_AUTO_SELECT = 5;
  // iPhoneでも初期の「中」が指で追いやすい太さにする
  const BRUSH_DIAMETERS = { small: 6, medium: 15, large: 23 };
  const SAMPLE_IMAGE_URL = "sample-house.jpg";

  // Canvasを端末の解像度に合わせる
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  // 回転・拡大・移動を含む画像の表示変換
  function getTransform() {
    if (!state.image || !canvas.clientWidth || !canvas.clientHeight) return null;
    const quarterTurn = Math.abs(state.rotation % 180) === 90;
    const rotatedWidth = quarterTurn ? state.image.naturalHeight : state.image.naturalWidth;
    const rotatedHeight = quarterTurn ? state.image.naturalWidth : state.image.naturalHeight;
    return { centerX: canvas.clientWidth / 2 + state.panX, centerY: canvas.clientHeight / 2 + state.panY, scale: Math.min(canvas.clientWidth / rotatedWidth, canvas.clientHeight / rotatedHeight) * 0.92 * state.zoom, angle: state.rotation * Math.PI / 180 };
  }
  function screenToImage(point) {
    const t = getTransform();
    if (!t) return null;
    const dx = point.x - t.centerX; const dy = point.y - t.centerY;
    const cos = Math.cos(-t.angle); const sin = Math.sin(-t.angle);
    return { x: (dx * cos - dy * sin) / t.scale + state.image.naturalWidth / 2, y: (dx * sin + dy * cos) / t.scale + state.image.naturalHeight / 2 };
  }
  function imageToScreen(point) {
    const t = getTransform();
    if (!t) return null;
    const dx = (point.x - state.image.naturalWidth / 2) * t.scale; const dy = (point.y - state.image.naturalHeight / 2) * t.scale;
    return { x: dx * Math.cos(t.angle) - dy * Math.sin(t.angle) + t.centerX, y: dx * Math.sin(t.angle) + dy * Math.cos(t.angle) + t.centerY };
  }
  function inImage(point) { return point && point.x >= 0 && point.y >= 0 && point.x <= state.image.naturalWidth && point.y <= state.image.naturalHeight; }
  function canvasPoint(event) { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  // ブラシ用の高精細マスクと半透明グリーン表示レイヤーを作る
  function ensureMask() {
    if (!state.image) return false;
    if (state.mask) return true;
    const scale = Math.min(1, MASK_MAX_SIDE / Math.max(state.image.naturalWidth, state.image.naturalHeight));
    const width = Math.max(1, Math.round(state.image.naturalWidth * scale));
    const height = Math.max(1, Math.round(state.image.naturalHeight * scale));
    state.mask = document.createElement("canvas"); state.mask.width = width; state.mask.height = height;
    state.overlay = document.createElement("canvas"); state.overlay.width = width; state.overlay.height = height;
    return true;
  }
  function hasSelection() { return Boolean(state.mask && state.selectionExists); }
  // マスクと自動選択回数を一組で履歴へ残し、「1つ戻る」後も表示と実態を一致させる
  function pushHistory(snapshot) {
    state.history.push({ mask: snapshot, autoSelectCount: state.autoSelectCount });
    if (state.history.length > MAX_HISTORY) state.history.shift();
  }
  function maskContainsPixels() {
    if (!state.mask) return false;
    const pixels = state.mask.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, state.mask.width, state.mask.height).data;
    for (let index = 3; index < pixels.length; index += 4) if (pixels[index]) return true;
    return false;
  }
  function maskPoint(point) { return { x: point.x / state.image.naturalWidth * state.mask.width, y: point.y / state.image.naturalHeight * state.mask.height }; }
  function brushRadius() {
    const t = getTransform();
    return Math.max(1, (BRUSH_DIAMETERS[state.brushSize] / 2) / t.scale * state.mask.width / state.image.naturalWidth);
  }

  // 1ストロークの開始時だけマスクを保存し、「1つ戻る」を軽量かつ確実にする
  function beginStroke() {
    if (!ensureMask() || state.activeStroke) return;
    const maskContext = state.mask.getContext("2d", { willReadFrequently: true });
    state.activeStroke = { snapshot: maskContext.getImageData(0, 0, state.mask.width, state.mask.height), changed: false };
  }
  function finishStroke() {
    if (!state.activeStroke) return;
    if (state.activeStroke.changed) {
      pushHistory(state.activeStroke.snapshot);
      state.selectionExists = maskContainsPixels();
      // 自動選択とブラシ追加の表示を、同じ1枚のマスクから作り直して色むらをなくす
      rebuildOverlay();
      // なぞり中は色変換キャッシュを使い回し、ストローク完了時にだけ平均明度基準(anchor)を取り直す
      state.anchorRevision += 1;
    }
    state.activeStroke = null;
    // なぞり終わったら点線のカーソル円を消し、塗り上がりだけを見せる
    state.brushCursor = null;
    updateUI(); draw();
  }

  // 線分を細かな円で補間して、速くなぞってもすき間ができにくい自然な軌跡にする
  function paintSegment(fromImage, toImage) {
    if (!inImage(fromImage) && !inImage(toImage)) return;
    if (!ensureMask()) return;
    beginStroke();
    const from = maskPoint({ x: Math.min(state.image.naturalWidth, Math.max(0, fromImage.x)), y: Math.min(state.image.naturalHeight, Math.max(0, fromImage.y)) });
    const to = maskPoint({ x: Math.min(state.image.naturalWidth, Math.max(0, toImage.x)), y: Math.min(state.image.naturalHeight, Math.max(0, toImage.y)) });
    const radius = brushRadius();
    const steps = Math.max(1, Math.ceil(distance(from, to) / Math.max(1, radius * 0.42)));
    const erase = state.tool === "erase";
    const maskContext = state.mask.getContext("2d");
    // 追加・消去は必ず自動選択と同じmaskだけを更新する。表示用の緑レイヤーはこのmaskから再生成する。
    maskContext.save();
    maskContext.globalCompositeOperation = erase ? "destination-out" : "source-over";
    maskContext.fillStyle = "#ffffff";
    for (let step = 0; step <= steps; step += 1) {
      const ratio = step / steps;
      maskContext.beginPath();
      maskContext.arc(from.x + (to.x - from.x) * ratio, from.y + (to.y - from.y) * ratio, radius, 0, Math.PI * 2);
      maskContext.fill();
    }
    maskContext.restore();
    state.maskRevision += 1;
    state.activeStroke.changed = true;
    state.brushCursor = toImage;
    // 色を選んだ後も、塗る・消す中は同じマスクから薄い緑の確認表示を更新する
    rebuildOverlay();
    draw();
  }
  function clearSelection() {
    if (!state.mask) return;
    const maskContext = state.mask.getContext("2d", { willReadFrequently: true });
    pushHistory(maskContext.getImageData(0, 0, state.mask.width, state.mask.height));
    maskContext.clearRect(0, 0, state.mask.width, state.mask.height);
    state.overlay.getContext("2d").clearRect(0, 0, state.overlay.width, state.overlay.height);
    state.maskRevision = 0; state.anchorRevision += 1; state.selectionExists = false; state.autoSelectCount = 0; state.autoNotice = ""; state.brushCursor = null;
    updateUI(); draw();
  }
  function rebuildOverlay() {
    if (!state.mask) return;
    const source = state.mask.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, state.mask.width, state.mask.height);
    const target = state.overlay.getContext("2d");
    const data = target.createImageData(state.mask.width, state.mask.height);
    for (let i = 0; i < source.data.length; i += 4) { if (source.data[i + 3]) { data.data[i] = 23; data.data[i + 1] = 160; data.data[i + 2] = 116; data.data[i + 3] = 90; } }
    target.putImageData(data, 0, 0);
  }
  function undoStroke() {
    const entry = state.history.pop();
    if (!entry || !state.mask) return;
    const snapshot = entry.mask || entry;
    state.mask.getContext("2d").putImageData(snapshot, 0, 0);
    state.autoSelectCount = Number.isInteger(entry.autoSelectCount) ? entry.autoSelectCount : state.autoSelectCount;
    rebuildOverlay(); state.maskRevision += 1; state.anchorRevision += 1; state.selectionExists = maskContainsPixels(); state.brushCursor = null;
    updateUI(); draw();
  }

  // 3x3の膨張・収縮でサイディング柄などの細かな切れ目を閉じる（closing）
  function dilate(binary, width, height) {
    const output = new Uint8Array(binary.length);
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!binary[index]) continue;
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        const nextX = x + offsetX, nextY = y + offsetY;
        if (nextX >= 0 && nextY >= 0 && nextX < width && nextY < height) output[nextY * width + nextX] = 1;
      }
    }
    return output;
  }
  function erode(binary, width, height) {
    const output = new Uint8Array(binary.length);
    for (let y = 1; y < height - 1; y += 1) for (let x = 1; x < width - 1; x += 1) {
      let filled = true;
      for (let offsetY = -1; offsetY <= 1 && filled; offsetY += 1) for (let offsetX = -1; offsetX <= 1; offsetX += 1) if (!binary[(y + offsetY) * width + x + offsetX]) { filled = false; break; }
      if (filled) output[y * width + x] = 1;
    }
    return output;
  }
  // 外周につながらない小さな穴だけを埋め、窓・玄関など大きな未選択領域は残す
  function fillSmallHoles(binary, width, height, maximumArea) {
    const visited = new Uint8Array(binary.length);
    const queue = new Int32Array(binary.length);
    for (let start = 0; start < binary.length; start += 1) {
      if (binary[start] || visited[start]) continue;
      let head = 0, tail = 1, touchesEdge = false;
      queue[0] = start; visited[start] = 1;
      while (head < tail) {
        const index = queue[head++], x = index % width, y = Math.floor(index / width);
        if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesEdge = true;
        if (x > 0 && !binary[index - 1] && !visited[index - 1]) { visited[index - 1] = 1; queue[tail++] = index - 1; }
        if (x < width - 1 && !binary[index + 1] && !visited[index + 1]) { visited[index + 1] = 1; queue[tail++] = index + 1; }
        if (y > 0 && !binary[index - width] && !visited[index - width]) { visited[index - width] = 1; queue[tail++] = index - width; }
        if (y < height - 1 && !binary[index + width] && !visited[index + width]) { visited[index + width] = 1; queue[tail++] = index + width; }
      }
      if (!touchesEdge && tail <= maximumArea) for (let item = 0; item < tail; item += 1) binary[queue[item]] = 1;
    }
    return binary;
  }
  // 小さな孤立選択を落として、壁面を滑らかな一つの選択範囲へ近づける
  function removeSmallIslands(binary, width, height, minimumArea) {
    const visited = new Uint8Array(binary.length);
    const queue = new Int32Array(binary.length);
    for (let start = 0; start < binary.length; start += 1) {
      if (!binary[start] || visited[start]) continue;
      let head = 0, tail = 1;
      queue[0] = start; visited[start] = 1;
      while (head < tail) {
        const index = queue[head++], x = index % width, y = Math.floor(index / width);
        if (x > 0 && binary[index - 1] && !visited[index - 1]) { visited[index - 1] = 1; queue[tail++] = index - 1; }
        if (x < width - 1 && binary[index + 1] && !visited[index + 1]) { visited[index + 1] = 1; queue[tail++] = index + 1; }
        if (y > 0 && binary[index - width] && !visited[index - width]) { visited[index - width] = 1; queue[tail++] = index - width; }
        if (y < height - 1 && binary[index + width] && !visited[index + width]) { visited[index + width] = 1; queue[tail++] = index + width; }
      }
      if (tail < minimumArea) for (let item = 0; item < tail; item += 1) binary[queue[item]] = 0;
    }
    return binary;
  }
  function smoothAutoMask(binary, width, height) {
    // closingの幅と面積しきい値はマスク解像度に比例させ、MASK_MAX_SIDEを変えても平滑化の見た目が変わらないようにする（基準は1024px）
    const scale = Math.max(width, height) / 1024;
    const closing = Math.max(2, Math.round(3 * scale));
    let smoothed = binary;
    // サイディング柄の点・細線の抜けを壁面としてつなげる。
    for (let iteration = 0; iteration < closing; iteration += 1) smoothed = dilate(smoothed, width, height);
    for (let iteration = 0; iteration < closing; iteration += 1) smoothed = erode(smoothed, width, height);
    // 数ピクセル〜小さな面の穴だけを埋める。窓・玄関など大きな未選択領域は残す。
    smoothed = fillSmallHoles(smoothed, width, height, Math.round(2600 * scale * scale));
    return removeSmallIslands(smoothed, width, height, Math.round(64 * scale * scale));
  }

  // タップ地点からつながる、近い色・明るさの画素だけをたどって外壁候補を選ぶ
  // AI推論ではなく端末内だけで動く色・明るさベースの簡易領域選択。結果はブラシで補正できる。
  function autoSelectAt(imagePoint) {
    if (!inImage(imagePoint) || !ensureMask() || state.autoSelectCount >= MAX_AUTO_SELECT) return;
    const maskContext = state.mask.getContext("2d", { willReadFrequently: true });
    const snapshot = maskContext.getImageData(0, 0, state.mask.width, state.mask.height);
    const sample = document.createElement("canvas");
    sample.width = state.mask.width; sample.height = state.mask.height;
    const sampleContext = sample.getContext("2d", { willReadFrequently: true });
    sampleContext.drawImage(state.image, 0, 0, sample.width, sample.height);
    const source = sampleContext.getImageData(0, 0, sample.width, sample.height);
    const width = state.mask.width, height = state.mask.height, total = width * height;
    const seed = maskPoint(imagePoint);
    const seedX = Math.max(0, Math.min(width - 1, Math.floor(seed.x)));
    const seedY = Math.max(0, Math.min(height - 1, Math.floor(seed.y)));
    const seedIndex = seedY * width + seedX;
    const seedOffset = seedIndex * 4;
    const seedRed = source.data[seedOffset], seedGreen = source.data[seedOffset + 1], seedBlue = source.data[seedOffset + 2];
    const seedLuma = seedRed * .299 + seedGreen * .587 + seedBlue * .114;
    // 2・3回目は、すでに選んだ外壁と大きく異なる場所を止める。空・屋根・窓などを広く追加しにくくするための安全判定。
    if (state.autoSelectCount > 0) {
      let redTotal = 0, greenTotal = 0, blueTotal = 0, existingPixels = 0;
      for (let index = 0; index < total; index += 1) if (snapshot.data[index * 4 + 3]) {
        const offset = index * 4; redTotal += source.data[offset]; greenTotal += source.data[offset + 1]; blueTotal += source.data[offset + 2]; existingPixels += 1;
      }
      if (existingPixels) {
        const referenceRed = redTotal / existingPixels, referenceGreen = greenTotal / existingPixels, referenceBlue = blueTotal / existingPixels;
        const referenceLuma = referenceRed * .299 + referenceGreen * .587 + referenceBlue * .114;
        const referenceDifference = Math.hypot(seedRed - referenceRed, seedGreen - referenceGreen, seedBlue - referenceBlue);
        if (referenceDifference > 125 || Math.abs(seedLuma - referenceLuma) > 88) { state.autoNotice = "外壁らしい場所をタップしてください。窓・空・屋根などは追加しません。"; updateUI(); return; }
      }
    }
    const visited = new Uint8Array(total);
    const selected = new Uint8Array(total);
    const queue = new Int32Array(total);
    let head = 0, tail = 1;
    queue[0] = seedIndex; visited[seedIndex] = 1;

    while (head < tail) {
      const index = queue[head++];
      const offset = index * 4;
      const red = source.data[offset], green = source.data[offset + 1], blue = source.data[offset + 2];
      const lumaDifference = Math.abs((red * .299 + green * .587 + blue * .114) - seedLuma);
      const colorDifference = Math.hypot(red - seedRed, green - seedGreen, blue - seedBlue);
      // 色と明るさの両方が近い場所だけに限定し、窓など極端に暗い部分へ広がりにくくする
      if (colorDifference > 74 || lumaDifference > 58) continue;
      selected[index] = 1;
      const x = index % width;
      if (x > 0 && !visited[index - 1]) { visited[index - 1] = 1; queue[tail++] = index - 1; }
      if (x < width - 1 && !visited[index + 1]) { visited[index + 1] = 1; queue[tail++] = index + 1; }
      if (index >= width && !visited[index - width]) { visited[index - width] = 1; queue[tail++] = index - width; }
      if (index < total - width && !visited[index + width]) { visited[index + width] = 1; queue[tail++] = index + width; }
    }

    const smoothed = smoothAutoMask(selected, width, height);
    const result = maskContext.createImageData(width, height);
    let addedPixels = 0;
    for (let index = 0; index < total; index += 1) if (smoothed[index] || snapshot.data[index * 4 + 3]) {
      const offset = index * 4;
      result.data[offset] = 255; result.data[offset + 1] = 255; result.data[offset + 2] = 255; result.data[offset + 3] = 255;
      if (smoothed[index] && !snapshot.data[offset + 3]) addedPixels += 1;
    }
    // すでに選択済みの場所を押しても、マスクも回数も増やさない。
    if (!addedPixels) { state.autoNotice = "この場所はすでに選択されています。別の外壁部分をタップしてください。"; updateUI(); return; }
    maskContext.putImageData(result, 0, 0);
    rebuildOverlay();
    pushHistory(snapshot);
    state.anchorRevision += 1;
    state.autoSelectCount += 1;
    state.autoNotice = "";
    state.maskRevision += 1;
    state.selectionExists = maskContainsPixels();
    state.brushCursor = null;
    updateUI(); draw();
  }

  function hexToHsl(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), lightness = (max + min) / 2, delta = max - min;
    if (!delta) return { hue: 0, saturation: 0, lightness };
    const saturation = delta / (1 - Math.abs(2 * lightness - 1));
    let hue = max === r ? (g - b) / delta % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    hue = Math.round(hue * 60); if (hue < 0) hue += 360;
    return { hue, saturation, lightness };
  }
  function hexToRgb(hex) { return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]; }
  function hslToRgb(hue, saturation, lightness) {
    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const segment = hue / 60, middle = chroma * (1 - Math.abs(segment % 2 - 1)), match = lightness - chroma / 2;
    let red = 0, green = 0, blue = 0;
    if (segment < 1) [red, green] = [chroma, middle]; else if (segment < 2) [red, green] = [middle, chroma]; else if (segment < 3) [green, blue] = [chroma, middle]; else if (segment < 4) [green, blue] = [middle, chroma]; else if (segment < 5) [red, blue] = [middle, chroma]; else [red, blue] = [chroma, middle];
    return [Math.round((red + match) * 255), Math.round((green + match) * 255), Math.round((blue + match) * 255)];
  }
  // パレットのHEXを基準色として直接使い、元写真は陰影係数だけに限定する
  function applyPaint(context2d) {
    const selected = hexToHsl(state.selectedColor.value);
    const strength = state.colorStrength / 100;
    // 濃さを下げる場合も元写真には混ぜず、選択色の彩度だけを調整する
    const base = strength === 1 ? hexToRgb(state.selectedColor.value) : hslToRgb(selected.hue, Math.max(.03, selected.saturation * strength), selected.lightness);
    // 選択範囲の平均明るさを基準(anchor)にして、元写真との明暗「比率」を見本色へ写す。
    // 壁の平均的な面はほぼ見本色そのままになり、サイディングの溝・軒の影は比率分だけ暗く残るため、固定基準のときのようにテクスチャが上限クランプで潰れない。
    const baseLuma = (base[0] * .299 + base[1] * .587 + base[2] * .114) / 255;
    const clampRange = baseLuma < .35 ? { min: .66, max: 1.04 } : baseLuma < .55 ? { min: .68, max: 1.07 } : { min: .72, max: 1.10 };
    const pixels = context2d.getImageData(0, 0, context2d.canvas.width, context2d.canvas.height);
    const maskData = state.mask.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, state.mask.width, state.mask.height).data;
    let lumaSum = 0, lumaCount = 0;
    for (let offset = 0; offset < pixels.data.length; offset += 4) if (maskData[offset + 3]) {
      lumaSum += pixels.data[offset] * .299 + pixels.data[offset + 1] * .587 + pixels.data[offset + 2] * .114; lumaCount += 1;
    }
    const anchorLuma = lumaCount ? Math.max(.15, lumaSum / lumaCount / 255) : .55;
    for (let offset = 0; offset < pixels.data.length; offset += 4) {
      if (!pixels.data[offset + 3]) continue;
      const sourceLuma = (pixels.data[offset] * .299 + pixels.data[offset + 1] * .587 + pixels.data[offset + 2] * .114) / 255;
      // 比率をそのまま使うと逆光写真で暗くなりすぎるため0.85倍に和らげ、明るさスライダーは従来通り加算する
      const shade = Math.max(clampRange.min, Math.min(clampRange.max, 1 + (sourceLuma / anchorLuma - 1) * .85 + state.colorBrightness / 100 * .18));
      pixels.data[offset] = Math.round(base[0] * shade); pixels.data[offset + 1] = Math.round(base[1] * shade); pixels.data[offset + 2] = Math.round(base[2] * shade);
    }
    context2d.putImageData(pixels, 0, 0);
  }
  // 選択カラーだけで作った画像をキャッシュし、ブラシ追加中も軽く即時反映する
  function ensureColorizedSource() {
    if (!state.selectedColor || !ensureMask()) return null;
    const signature = JSON.stringify([state.imageVersion, state.selectedColor, state.colorStrength, state.colorBrightness, state.mask.width, state.mask.height, state.anchorRevision]);
    if (signature === state.renderCache.colorizedSignature) return state.renderCache.colorized;
    const colorized = state.renderCache.colorized;
    colorized.width = state.mask.width; colorized.height = state.mask.height;
    const colorizedContext = colorized.getContext("2d", { willReadFrequently: true });
    colorizedContext.drawImage(state.image, 0, 0, colorized.width, colorized.height);
    applyPaint(colorizedContext);
    state.renderCache.colorizedSignature = signature;
    return colorized;
  }
  function drawBase(target) {
    const t = getTransform();
    target.save(); target.translate(t.centerX, t.centerY); target.rotate(t.angle); target.scale(t.scale, t.scale);
    target.drawImage(state.image, -state.image.naturalWidth / 2, -state.image.naturalHeight / 2); target.restore();
  }
  // 選択色で色相を統一した画像を、同じ1枚のmask部分だけに重ねる
  function drawPaintMask(target, logicalWidth, logicalHeight) {
    if (!state.selectedColor || !hasSelection()) return;
    const colorized = ensureColorizedSource();
    if (!colorized) return;
    const backingScale = Math.max(1, target.getTransform().a || 1);
    const layer = document.createElement("canvas"); layer.width = Math.round(logicalWidth * backingScale); layer.height = Math.round(logicalHeight * backingScale);
    const layerContext = layer.getContext("2d"); layerContext.setTransform(backingScale, 0, 0, backingScale, 0, 0);
    const t = getTransform();
    layerContext.save(); layerContext.translate(t.centerX, t.centerY); layerContext.rotate(t.angle); layerContext.scale(t.scale, t.scale);
    layerContext.drawImage(colorized, -state.image.naturalWidth / 2, -state.image.naturalHeight / 2, state.image.naturalWidth, state.image.naturalHeight);
    layerContext.restore();
    layerContext.save(); layerContext.globalCompositeOperation = "destination-in"; layerContext.globalAlpha = 1;
    layerContext.translate(t.centerX, t.centerY); layerContext.rotate(t.angle); layerContext.scale(t.scale, t.scale);
    layerContext.drawImage(state.mask, -state.image.naturalWidth / 2, -state.image.naturalHeight / 2, state.image.naturalWidth, state.image.naturalHeight);
    layerContext.restore();
    target.save(); target.globalCompositeOperation = "source-over"; target.globalAlpha = 1;
    target.drawImage(layer, 0, 0, layer.width, layer.height, 0, 0, logicalWidth, logicalHeight); target.restore();
  }
  function originalSignature() { return state.image ? JSON.stringify([canvas.width, canvas.height, state.imageVersion, state.rotation, state.zoom, state.panX, state.panY]) : ""; }
  function simulationSignature() { return JSON.stringify([originalSignature(), state.maskRevision, state.selectedColor, state.colorStrength, state.colorBrightness]); }
  function renderCache(targetCanvas, withPaint) {
    const width = canvas.clientWidth, height = canvas.clientHeight, ratio = width ? canvas.width / width : 1;
    targetCanvas.width = canvas.width; targetCanvas.height = canvas.height;
    const target = targetCanvas.getContext("2d"); target.setTransform(ratio, 0, 0, ratio, 0, 0); target.clearRect(0, 0, width, height);
    drawBase(target); if (withPaint) drawPaintMask(target, width, height);
  }
  function ensureCache() {
    const original = originalSignature(); if (original !== state.renderCache.originalSignature) { renderCache(state.renderCache.original, false); state.renderCache.originalSignature = original; }
    const simulation = simulationSignature(); if (simulation !== state.renderCache.simulationSignature) { renderCache(state.renderCache.simulation, true); state.renderCache.simulationSignature = simulation; }
  }
  function drawSelectionOverlay(opacity = 1) {
    if (!state.overlay) return;
    const t = getTransform(); context.save(); context.translate(t.centerX, t.centerY); context.rotate(t.angle); context.scale(t.scale, t.scale);
    context.globalAlpha = opacity;
    context.drawImage(state.overlay, -state.image.naturalWidth / 2, -state.image.naturalHeight / 2, state.image.naturalWidth, state.image.naturalHeight); context.restore();
  }
  // 塗装色を邪魔しない輪郭だけのブラシカーソル。色選択後の補正でも操作位置を確認できる。
  function drawBrushCursor() {
    if (!state.brushCursor || state.tool === "pan" || state.tool === "auto") return;
    const point = imageToScreen(state.brushCursor); context.save(); context.beginPath(); context.arc(point.x, point.y, BRUSH_DIAMETERS[state.brushSize] / 2, 0, Math.PI * 2); context.setLineDash([4, 3]); context.lineWidth = 1.5; context.strokeStyle = state.tool === "erase" ? "#d2534d" : "#176c5d"; context.stroke(); context.restore();
  }
  // 編集画面は選択範囲を緑で見せ、完成確認と保存では操作表示を描かない
  function draw() {
    const width = canvas.clientWidth, height = canvas.clientHeight; context.clearRect(0, 0, width, height); if (!state.image) return;
    ensureCache(); const showAfter = Boolean(state.selectedColor && state.previewMode === "after"); const visual = showAfter ? state.renderCache.simulation : state.renderCache.original;
    context.drawImage(visual, 0, 0, visual.width, visual.height, 0, 0, width, height);
    // 通常は塗装後の色をそのまま見せ、塗る・消す中だけ範囲を薄く示して編集先を分かりやすくする
    if (state.presentationMode) return;
    if (!state.selectedColor) drawSelectionOverlay();
    else if (state.tool === "paint" || state.tool === "erase") drawSelectionOverlay(.16);
    drawBrushCursor();
  }

  function resetView() { state.zoom = 1; state.panX = 0; state.panY = 0; }
  function setTool(tool) { state.tool = tool; state.brushCursor = null; simulator.classList.toggle("is-pan-mode", tool === "pan"); updateUI(); draw(); }
  function setBrushSize(size) { state.brushSize = size; updateUI(); draw(); }
  function changeZoom(multiplier) { if (!state.image) return; state.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.zoom * multiplier)); draw(); }

  // ボタンの状態と、初めての人向けの案内を現在の操作に合わせる
  function updateUI() {
    const hasImage = Boolean(state.image), selected = hasSelection();
    consultSaveButton.disabled = !hasImage;
    consultStatus.textContent = state.saveNotice || "画像は自動送信されません。保存した画像をLINEのトークに添付してください。";
    workspace.classList.toggle("has-image", hasImage); simulator.classList.toggle("has-image", hasImage); simulator.classList.toggle("is-pan-mode", state.tool === "pan");
    sampleNotice.hidden = !state.isSample;
    // 自動選択はタップだけで完了するため、写真の上でも縦スワイプでページをスクロールできるようにする（touch-action切替）
    simulator.classList.toggle("is-auto-mode", state.tool === "auto");
    [buttons.rotate, buttons.zoomOut, buttons.zoomIn, buttons.fit].forEach((button) => { button.disabled = !hasImage; });
    [[buttons.auto, "auto"], [buttons.pan, "pan"], [buttons.paint, "paint"], [buttons.erase, "erase"]].forEach(([button, tool]) => { const active = state.tool === tool; button.classList.toggle("is-selected", active); button.setAttribute("aria-pressed", String(active)); });
    [[buttons.small, "small"], [buttons.medium, "medium"], [buttons.large, "large"]].forEach(([button, size]) => { const active = state.brushSize === size; button.classList.toggle("is-selected", active); button.setAttribute("aria-pressed", String(active)); });
    buttons.undo.disabled = !state.history.length; buttons.clear.disabled = !selected; buttons.resetAll.disabled = !hasImage; buttons.presentation.disabled = !selected;
    colorChoices.forEach((choice) => { const active = state.selectedColor?.name === choice.dataset.colorName; choice.disabled = !selected; choice.classList.toggle("is-selected", active); choice.setAttribute("aria-pressed", String(active)); });
  buttons.before.disabled = !state.selectedColor; buttons.after.disabled = !state.selectedColor; buttons.resetColor.disabled = !state.selectedColor; strengthInput.disabled = !state.selectedColor; brightnessInput.disabled = !state.selectedColor;
  // 写真を選択したら、カラー未選択でも元画像をPNGとして保存できるようにする。
  buttons.save.disabled = !hasImage;
    buttons.before.classList.toggle("is-selected", state.previewMode === "before"); buttons.after.classList.toggle("is-selected", state.previewMode === "after"); buttons.before.setAttribute("aria-pressed", String(state.previewMode === "before")); buttons.after.setAttribute("aria-pressed", String(state.previewMode === "after"));
    strengthInput.value = String(state.colorStrength); brightnessInput.value = String(state.colorBrightness); strengthValue.textContent = `${state.colorStrength}%`; brightnessValue.textContent = state.colorBrightness > 0 ? `+${state.colorBrightness}` : String(state.colorBrightness);
    buttons.editReturn.hidden = !state.presentationMode;
    if (state.selectedColor) { debugColorName.textContent = state.selectedColor.name; debugColorHex.textContent = state.selectedColor.value.toUpperCase(); debugColorSwatch.style.background = state.selectedColor.value; }
    else { debugColorName.textContent = "未選択"; debugColorHex.textContent = "--"; debugColorSwatch.style.background = "transparent"; }
    const autoComplete = state.autoSelectCount >= MAX_AUTO_SELECT;
    // 自動選択の回数と残り回数を同じ場所に表示し、次にできる操作を迷わせない
    if (autoComplete) autoSelectStatus.innerHTML = `<strong>自動選択 ${MAX_AUTO_SELECT}/${MAX_AUTO_SELECT} 完了</strong><span>足りない部分は「塗る」「消す」で調整できます</span>`;
    else if (state.autoSelectCount > 0) autoSelectStatus.innerHTML = `<strong>自動選択 ${state.autoSelectCount}/${MAX_AUTO_SELECT}</strong><span>あと${MAX_AUTO_SELECT - state.autoSelectCount}回追加できます</span>`;
    else autoSelectStatus.innerHTML = `<strong>自動選択 0/${MAX_AUTO_SELECT}</strong><span>外壁をタップして始めましょう</span>`;
    brushHint.textContent = state.tool === "pan" ? "写真をドラッグして位置を調整できます。自動で選ぶときは「✨ 自動選択」に戻してください。" : state.tool === "erase" ? "薄い緑で見える範囲から、はみ出した部分をなぞって消せます。" : state.tool === "paint" ? "薄い緑の範囲に、足りない部分をなぞって追加できます。" : state.autoNotice || (autoComplete ? "自動選択は完了しました。足りない部分は「塗る」で調整できます。" : state.autoSelectCount ? `別の外壁部分をタップして追加できます（あと${MAX_AUTO_SELECT - state.autoSelectCount}回）。軒下の影が残った所は「塗る」でなぞってください。` : "外壁の中央をタップしてください。近い色・明るさの壁面を自動で選びます。軒下の影など暗い所は「塗る」で追加できます。");
    if (!selected) { colorStatus.textContent = "外壁中央をタップ"; colorHint.textContent = "「✨ 自動選択」で外壁の中央をタップすると、近い壁面を自動で選びます。"; }
    else if (!state.selectedColor) { colorStatus.textContent = "カラーを選択してください"; colorHint.textContent = "半透明の緑の範囲だけが色変更されます。"; }
    else { colorStatus.textContent = `${state.selectedColor.name}・${state.previewMode === "after" ? "塗装後" : "元の色"}`; colorHint.textContent = state.previewMode === "after" ? "追加・消去をしても、同じカラーが選択範囲全体へすぐ反映されます。" : "元の色の住宅写真を表示中です。"; }
    saveHint.textContent = state.saveNotice || (hasImage ? "画像を保存：緑の選択表示を含まない高画質PNGを保存できます。" : "写真を選択すると、シミュレーション画像を保存できます。");
    statusText.textContent = !hasImage ? "まずは住宅写真を選択してください。" : state.tool === "pan" ? "写真をドラッグして位置を調整できます。" : state.tool === "auto" ? autoComplete ? "自動選択は完了しました。必要に応じて「塗る」「消す」で調整してください。" : `色を変えたい外壁の中央をタップしてください（自動選択 ${state.autoSelectCount}/${MAX_AUTO_SELECT}）。` : selected ? "「塗る」「消す」で範囲を整えてから、カラーを選んでください。" : "まずは「✨ 自動選択」で外壁の中央をタップしてください。";
  }

  // FileReaderの結果でも、同一サイト内のサンプルURLでも同じ初期化を通す
  function loadImageFromSource(src, { isSample = false } = {}) {
    const image = new Image();
    image.onload = () => {
      clearSavePreview(); state.image = image; state.imageVersion += 1; state.rotation = 0; state.mask = null; state.overlay = null; state.maskRevision = 0; state.selectionExists = false; state.autoSelectCount = 0; state.autoNotice = ""; state.history = []; state.activeStroke = null;
      state.tool = "auto"; state.brushSize = "medium"; state.brushCursor = null; state.selectedColor = null; state.previewMode = "before"; state.colorStrength = 100; state.colorBrightness = 0; state.saveNotice = ""; state.isSample = isSample; resetView(); emptyState.hidden = true; updateUI(); requestAnimationFrame(resizeCanvas);
    };
    image.onerror = () => {
      state.saveNotice = "写真を読み込めませんでした。別の写真でお試しください。";
      updateUI();
    };
    image.src = src;
  }

  // 写真の読込時に、古い選択・履歴・比較キャッシュをすべて初期化する
  imageInput.addEventListener("change", (event) => {
    const [file] = event.target.files; if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader(); reader.onload = () => loadImageFromSource(reader.result); reader.readAsDataURL(file); imageInput.value = "";
  });
  samplePhotoButton.addEventListener("click", () => loadImageFromSource(SAMPLE_IMAGE_URL, { isSample: true }));
  switchPhotoButton.addEventListener("click", () => imageInput.click());

  buttons.rotate.addEventListener("click", () => { state.rotation = (state.rotation + 90) % 360; draw(); });
  buttons.zoomIn.addEventListener("click", () => changeZoom(1.25)); buttons.zoomOut.addEventListener("click", () => changeZoom(.8)); buttons.fit.addEventListener("click", () => { resetView(); draw(); });
  buttons.auto.addEventListener("click", () => setTool("auto")); buttons.pan.addEventListener("click", () => setTool("pan")); buttons.paint.addEventListener("click", () => setTool("paint")); buttons.erase.addEventListener("click", () => setTool("erase"));
  [[buttons.small, "small"], [buttons.medium, "medium"], [buttons.large, "large"]].forEach(([button, size]) => button.addEventListener("click", () => setBrushSize(size)));
  buttons.undo.addEventListener("click", undoStroke); buttons.clear.addEventListener("click", clearSelection);
  buttons.resetAll.addEventListener("click", () => {
    if (!state.image) return;
    // 写真は残ることを明示して、選択範囲・色・写真調整の初期化を誤操作から守る
    if (!window.confirm("写真は残ります。選択範囲・色・写真の調整を最初からやり直しますか？")) return;
    state.mask = null; state.overlay = null; state.maskRevision = 0; state.anchorRevision = 0; state.selectionExists = false; state.autoSelectCount = 0; state.autoNotice = ""; state.history = []; state.selectedColor = null; state.previewMode = "before"; state.colorStrength = 100; state.colorBrightness = 0; state.rotation = 0; state.brushCursor = null; resetView(); updateUI(); draw();
  });
  buttons.resetColor.addEventListener("click", () => { state.selectedColor = null; state.previewMode = "before"; state.colorStrength = 100; state.colorBrightness = 0; updateUI(); draw(); });
  colorChoices.forEach((choice) => choice.addEventListener("click", () => { if (!hasSelection()) return; state.selectedColor = { name: choice.dataset.colorName, value: choice.dataset.color, tone: Number(choice.dataset.tone), blend: choice.dataset.blend || "color" }; state.previewMode = "after"; updateUI(); draw(); }));
  buttons.before.addEventListener("click", () => { if (!state.selectedColor) return; state.previewMode = "before"; updateUI(); draw(); }); buttons.after.addEventListener("click", () => { if (!state.selectedColor) return; state.previewMode = "after"; updateUI(); draw(); });
  strengthInput.addEventListener("input", () => { state.colorStrength = Number(strengthInput.value); updateUI(); draw(); }); brightnessInput.addEventListener("input", () => { state.colorBrightness = Number(brightnessInput.value); updateUI(); draw(); });
  colorGroupToggles.forEach((toggle) => toggle.addEventListener("click", () => { const group = toggle.closest(".color-group"); const collapsed = group.classList.toggle("is-collapsed"); toggle.setAttribute("aria-expanded", String(!collapsed)); }));

  // 完成確認では編集用の緑表示を外し、色変更後の写真だけを大きく表示する
  function setPresentation(enabled) { if (enabled && !hasSelection()) return; state.presentationMode = enabled; if (enabled && state.selectedColor) state.previewMode = "after"; simulator.classList.toggle("is-presentation", enabled); updateUI(); requestAnimationFrame(resizeCanvas); }
  buttons.presentation.addEventListener("click", () => setPresentation(true)); buttons.editReturn.addEventListener("click", () => setPresentation(false));

  // 保存用Canvasには選択マスクやブラシ円を描かず、写真とカラー結果だけをPNG出力する
  function createPngCanvas() {
    if (!state.image) return null; const width = canvas.clientWidth, height = canvas.clientHeight; const scale = Math.max(window.devicePixelRatio || 1, Math.min(4, Math.max(state.image.naturalWidth / width, state.image.naturalHeight / height)));
    const output = document.createElement("canvas"); output.width = Math.round(width * scale); output.height = Math.round(height * scale); const outputContext = output.getContext("2d"); outputContext.setTransform(scale, 0, 0, scale, 0, 0); outputContext.clearRect(0, 0, width, height); drawBase(outputContext); drawPaintMask(outputContext, width, height); return output;
  }

  // CanvasからPNG Blobを作り、iPhoneの共有シート・PC保存の両方で同じ画像を使う
  function createPngBlob() {
    const output = createPngCanvas();
    if (!output) return Promise.reject(new Error("保存する画像を作成できませんでした。"));
    return new Promise((resolve, reject) => output.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG Blobの作成に失敗しました。"));
    }, "image/png"));
  }

  function isIosDevice() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }

  // iPhoneのファイル共有はHTTPSのセキュアコンテキストだけで行う。HTTPでは共有APIを一切呼ばない。
  function isSecureShareContext() { return window.isSecureContext === true && location.protocol === "https:"; }
  function describeError(error) { return error ? `${error.name || "Error"}: ${error.message || "詳細はconsoleを確認してください。"}` : "なし"; }

  // 保存時の接続・API対応状況を、必要なときだけ画面内で確認できるようにする
  function updateSaveDebug(capabilities, error = null) {
    saveDebug.hidden = false;
    saveDebugSecure.textContent = String(capabilities.secureContext);
    saveDebugProtocol.textContent = capabilities.protocol;
    saveDebugShare.textContent = String(capabilities.shareAvailable);
    saveDebugCanShare.textContent = String(capabilities.canShareAvailable);
    saveDebugFileShare.textContent = capabilities.fileSharePossible ? "可能" : "不可";
    saveDebugError.textContent = describeError(error || capabilities.error);
    if (error || capabilities.error) saveDebug.open = true;
  }
  function setSaveNotice(message, capabilities, error = null) {
    state.saveNotice = message;
    saveHint.textContent = message;
    consultStatus.textContent = message;
    if (capabilities) updateSaveDebug(capabilities, error);
  }
  function clearSavePreview() {
    if (state.savePreviewUrl) URL.revokeObjectURL(state.savePreviewUrl);
    state.savePreviewUrl = null;
    savePreviewImage.removeAttribute("src");
    savePreview.hidden = true;
  }
  // 共有できないiPhoneでは、別タブを開かず画面内にPNGそのものを表示する
  function showPngPreview(blob) {
    clearSavePreview();
    state.savePreviewUrl = URL.createObjectURL(blob);
    savePreviewImage.src = state.savePreviewUrl;
    savePreview.hidden = false;
  }
  function getShareCapabilities(file = null) {
    const capabilities = {
      secureContext: isSecureShareContext(), protocol: location.protocol,
      shareAvailable: typeof navigator.share === "function", canShareAvailable: typeof navigator.canShare === "function",
      fileSharePossible: false, error: null,
    };
    if (!capabilities.secureContext || !file || !capabilities.shareAvailable || !capabilities.canShareAvailable) return capabilities;
    try { capabilities.fileSharePossible = navigator.canShare({ files: [file] }); }
    catch (error) { capabilities.error = error; console.error("Web Share APIの対応確認に失敗しました。", error); }
    return capabilities;
  }

  // iPhone Safari / Chromeでは、HTTPS上でだけPNG Fileを共有シートへ渡す
  async function saveForIos(blob) {
    const file = typeof File === "function" ? new File([blob], "real-make-exterior-simulation.png", { type: "image/png" }) : null;
    const capabilities = getShareCapabilities(file);
    const shareData = file ? { files: [file], title: "Real Make 外壁カラーシミュレーター", text: "外壁カラーシミュレーション画像" } : null;
    if (!capabilities.fileSharePossible || !shareData) {
      showPngPreview(blob);
      const message = capabilities.error ? "画像共有を利用できないため、保存用PNGを表示しました。画像を長押しして「写真に保存」を選んでください。" : "この端末ではファイル共有を利用できないため、保存用PNGを表示しました。画像を長押しして「写真に保存」を選んでください。";
      setSaveNotice(message, capabilities, capabilities.error);
      return;
    }
    try {
      // 保存ボタンの操作から開始した処理内で共有を呼び、Safariのユーザー操作制限を避ける
      await navigator.share(shareData);
      clearSavePreview();
      setSaveNotice("共有シートを開きました。「写真に保存」「ファイルに保存」やLINE共有を選べます。", capabilities);
    } catch (error) {
      if (error?.name === "AbortError") { setSaveNotice("共有をキャンセルしました。もう一度「画像を保存」を押すと共有できます。", capabilities); return; }
      console.error("PNG共有に失敗したため、画面内プレビューを表示します。", error);
      showPngPreview(blob);
      setSaveNotice("画像共有に失敗したため、保存用PNGを表示しました。画像を長押しして「写真に保存」を選んでください。", capabilities, error);
    }
  }

  consultSaveButton.addEventListener("click", () => buttons.save.click());
  buttons.save.addEventListener("click", async () => {
    if (!state.image) return;
    // ローカルHTTPではWeb Share APIを使わず、公開後のHTTPS環境で使えることを明確に案内する
    if (isIosDevice() && !isSecureShareContext()) {
      const capabilities = getShareCapabilities();
      clearSavePreview();
      setSaveNotice("現在は動作確認用の接続のため、iPhoneの画像保存を利用できません。公開後のHTTPS環境で保存できます。", capabilities);
      return;
    }
    try {
      // このクリック処理の中でBlob生成と共有・保存を開始する
      const blob = await createPngBlob();
      if (isIosDevice()) { await saveForIos(blob); return; }
      // PC・Mac Safariは通常のPNGダウンロードを使う
      const objectUrl = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = objectUrl; link.download = "real-make-exterior-simulation.png"; document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      state.saveNotice = "画像のダウンロードを開始しました。保存先を確認して、LINEのトークに画像を添付してください。"; saveHint.textContent = state.saveNotice; consultStatus.textContent = state.saveNotice;
    } catch (error) {
      console.error("PNG保存に失敗しました。", error);
      const capabilities = getShareCapabilities();
      setSaveNotice("画像を保存できませんでした。もう一度お試しください。", capabilities, error);
    }
  });

  // 写真移動・自動選択・ブラシ補正をモードで明確に分離し、二本指は常にピンチ拡大・縮小として扱う
  canvas.addEventListener("pointerdown", (event) => {
    if (!state.image || state.presentationMode) return; state.hasPointerInput = true; event.preventDefault(); const point = canvasPoint(event); try { canvas.setPointerCapture(event.pointerId); } catch (_) { /* 非対応端末は通常のPointer処理を継続 */ }
    const pointer = { ...point, previous: point, start: point, moved: false, pinching: state.pointers.size > 0 }; state.pointers.set(event.pointerId, pointer);
    if (state.pointers.size === 1) {
      if (state.tool === "pan") state.gesture = { type: "pan", startX: state.panX, startY: state.panY };
      else if (state.tool === "auto") state.gesture = { type: "auto" };
      else { state.gesture = { type: "brush" }; const imagePoint = screenToImage(point); if (inImage(imagePoint)) paintSegment(imagePoint, imagePoint); }
    }
    else if (state.pointers.size === 2) { finishStroke(); const [first, second] = [...state.pointers.values()]; first.pinching = true; second.pinching = true; state.gesture = { type: "pinch", distance: distance(first, second), zoom: state.zoom }; }
  });
  canvas.addEventListener("pointermove", (event) => {
    const pointer = state.pointers.get(event.pointerId); if (!pointer) return; const point = canvasPoint(event); pointer.x = point.x; pointer.y = point.y;
    if (state.pointers.size === 2 && state.gesture?.type === "pinch") { const [first, second] = [...state.pointers.values()]; state.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.gesture.zoom * distance(first, second) / state.gesture.distance)); draw(); return; }
    if (state.pointers.size !== 1) return;
    if (state.gesture?.type === "pan") { const dx = point.x - pointer.start.x, dy = point.y - pointer.start.y; if (Math.hypot(dx, dy) > 6) { pointer.moved = true; state.panX = state.gesture.startX + dx; state.panY = state.gesture.startY + dy; draw(); } }
    else if (state.gesture?.type === "brush") { const previousImage = screenToImage(pointer.previous); const currentImage = screenToImage(point); if (previousImage && currentImage) { paintSegment(previousImage, currentImage); pointer.moved = true; } pointer.previous = point; }
    else if (state.gesture?.type === "auto" && Math.hypot(point.x - pointer.start.x, point.y - pointer.start.y) > 8) pointer.moved = true;
  });
  function finishPointer(event) {
    const pointer = state.pointers.get(event.pointerId); if (!pointer) return; const wasOnly = state.pointers.size === 1;
    if (wasOnly && state.gesture?.type === "brush") finishStroke();
    // 自動選択はタップ完了時だけ実行するため、ピンチやドラッグと競合しない
    if (wasOnly && state.gesture?.type === "auto" && !pointer.moved && event.type === "pointerup") { const imagePoint = screenToImage({ x: pointer.x, y: pointer.y }); autoSelectAt(imagePoint); }
    state.pointers.delete(event.pointerId);
    if (state.pointers.size === 1) { const remaining = [...state.pointers.values()][0]; remaining.start = { x: remaining.x, y: remaining.y }; remaining.previous = { x: remaining.x, y: remaining.y }; state.gesture = { type: "idle" }; } else if (!state.pointers.size) state.gesture = null;
  }
  canvas.addEventListener("pointerup", finishPointer); canvas.addEventListener("pointercancel", finishPointer);
  // Pointer Events非対応の古い環境にも、自動選択と補正ブラシの最低限の操作を残す
  canvas.addEventListener("click", (event) => { if (!state.image || state.presentationMode || state.hasPointerInput || state.tool === "pan") return; const imagePoint = screenToImage(canvasPoint(event)); if (!inImage(imagePoint)) return; if (state.tool === "auto") autoSelectAt(imagePoint); else { paintSegment(imagePoint, imagePoint); finishStroke(); } });
  window.addEventListener("resize", resizeCanvas);
  updateUI(); resizeCanvas();
})();
