/**
 * 包装效果图渲染器
 *
 * 关键：效果图不是预先存好的静态图，而是由智能体本次生成的方案参数
 * （配色 + 纹样 + 版式 + 尺寸）实时渲染出来的。
 * 换一个需求 → 模式判定不同 → 素材不同 → 这张图就变。
 */

/* 纹样素材 → 图片资产 */
const PATTERN_ASSETS = {
  'GF-P-01': 'assets/pattern_lanjiaxie.png',
  'GF-P-02': 'assets/pattern_lanjiaxie.png',
  'GF-P-03': 'assets/pattern_shuangyu.png',
  'GF-P-04': 'assets/pattern_lianzhi.png',
  'GF-P-06': 'assets/pattern_huibian.png',
  'GF-P-08': 'assets/pattern_lianzhi.png',
};

const TEXTURE_ASSETS = {
  'GF-T-02': 'assets/texture_indigo.png',
};

/* 计算亮度，决定叠字用深色还是浅色 */
function luminance(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return 0.9;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const onColor = (hex) => (luminance(hex) > 0.55 ? '#2B2B2B' : '#FFFFFF');

function shade(hex, amount) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r + 255 * amount)));
  g = Math.max(0, Math.min(255, Math.round(g + 255 * amount)));
  b = Math.max(0, Math.min(255, Math.round(b + 255 * amount)));
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

const escXml = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

/**
 * @param {object} plan  智能体生成的方案
 * @param {string} productName 产品名称
 * @returns {string} SVG 字符串
 */
function buildPreviewSVG(plan, productName) {
  const isG = plan.mode === 'guofeng';
  const sw = plan.palette.swatches || [];
  const base = sw[0] ? sw[0].hex : '#1B3A57';
  const second = sw[1] ? sw[1].hex : (isG ? '#EAF0F4' : '#2B2B2B');
  const accent = plan.palette.accentHex || (isG ? '#A8351A' : '#4A7C59');
  const gold = plan.palette.goldHex || '#E0A93B';
  const title = (productName || '产品名').slice(0, 8);
  const fg = onColor(base);

  // 盒体几何
  const fx = 110, fy = 168, fw = 300, fh = 200, d = 44;
  const topFace = `${fx},${fy} ${fx + d},${fy - d} ${fx + fw + d},${fy - d} ${fx + fw},${fy}`;
  const rightFace = `${fx + fw},${fy} ${fx + fw + d},${fy - d} ${fx + fw + d},${fy + fh - d} ${fx + fw},${fy + fh}`;

  const patternSrc = PATTERN_ASSETS[plan.visual.pattern && plan.visual.pattern.id];
  const textureSrc = TEXTURE_ASSETS[plan.texture.item && plan.texture.item.id];

  // 主视觉区（国风：纹样满铺 + 描金边框 + 竖排题签；现代：留白 + 左对齐网格 + 单色块）
  let faceContent = '';

  if (isG) {
    const patImg = patternSrc
      ? `<image href="${patternSrc}" x="${fx + 14}" y="${fy + 14}" width="${fw - 28}" height="${fh - 28}"
           preserveAspectRatio="xMidYMid slice" opacity="0.92" clip-path="url(#faceClip)" />`
      : '';
    faceContent += patImg;

    // 回纹双线边框
    faceContent += `<rect x="${fx + 10}" y="${fy + 10}" width="${fw - 20}" height="${fh - 20}" fill="none" stroke="${gold}" stroke-width="1.6" opacity="0.9" />`;
    faceContent += `<rect x="${fx + 16}" y="${fy + 16}" width="${fw - 32}" height="${fh - 32}" fill="none" stroke="${gold}" stroke-width="0.7" opacity="0.55" />`;

    // 竖排题签（中轴对称，右置）
    const tx = fx + fw - 46;
    let ty = fy + 44;
    faceContent += `<rect x="${tx - 17}" y="${fy + 26}" width="34" height="${Math.min(title.length, 6) * 26 + 16}"
        fill="${base}" opacity="0.82" rx="2" />`;
    faceContent += `<rect x="${tx - 17}" y="${fy + 26}" width="34" height="${Math.min(title.length, 6) * 26 + 16}"
        fill="none" stroke="${gold}" stroke-width="0.8" opacity="0.7" rx="2" />`;
    [...title].slice(0, 6).forEach((ch) => {
      faceContent += `<text x="${tx}" y="${ty}" font-size="21" fill="${gold}" text-anchor="middle"
        font-family="'Noto Serif SC','Songti SC',serif" letter-spacing="2">${escXml(ch)}</text>`;
      ty += 26;
    });

    // 朱砂印章
    const sx = fx + fw - 62, sy = fy + fh - 58;
    faceContent += `<rect x="${sx}" y="${sy}" width="30" height="30" rx="3" fill="${accent}" opacity="0.95" />`;
    faceContent += `<text x="${sx + 15}" y="${sy + 21}" font-size="15" fill="#FFF" text-anchor="middle"
      font-family="'Noto Serif SC','Songti SC',serif">印</text>`;
  } else {
    // 现代：底部单色块 + 左对齐网格文字
    faceContent += `<rect x="${fx}" y="${fy + fh - 12}" width="${fw}" height="12" fill="${accent}" opacity="0.9" />`;
    faceContent += `<rect x="${fx + 28}" y="${fy + 52}" width="46" height="5" fill="${accent}" />`;
    faceContent += `<text x="${fx + 28}" y="${fy + 44}" font-size="27" font-weight="700" fill="${fg}"
      font-family="'Noto Sans SC','PingFang SC',sans-serif" letter-spacing="1">${escXml(title)}</text>`;
    faceContent += `<text x="${fx + 28}" y="${fy + 78}" font-size="12" fill="${fg}" opacity="0.62"
      font-family="'Noto Sans SC','PingFang SC',sans-serif">${escXml(plan.modeLabel)}</text>`;

    // 网格辅助线（体现左对齐网格系统）
    for (let i = 1; i <= 3; i++) {
      faceContent += `<line x1="${fx + 28}" y1="${fy + 96 + i * 15}" x2="${fx + fw - 60}" y2="${fy + 96 + i * 15}"
        stroke="${fg}" stroke-width="0.6" opacity="0.12" />`;
    }
    faceContent += `<rect x="${fx + fw - 58}" y="${fy + 26}" width="34" height="34" rx="4" fill="${accent}" opacity="0.16" />`;
  }

  const dimText = plan.dimensions ? plan.dimensions.outer : '';

  return `<svg viewBox="0 0 560 440" width="100%" role="img" aria-label="包装效果图预览" class="preview-svg">
    <defs>
      <clipPath id="faceClip">
        <rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" />
      </clipPath>
      <linearGradient id="topShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.30" />
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.05" />
      </linearGradient>
    </defs>

    <!-- 投影 -->
    <ellipse cx="${fx + fw / 2 + 12}" cy="${fy + fh + 22}" rx="${fw / 2 + 20}" ry="16" fill="#1B3A57" opacity="0.10" />

    <!-- 顶面 -->
    <polygon points="${topFace}" fill="${shade(base, 0.14)}" />
    <polygon points="${topFace}" fill="url(#topShade)" />

    <!-- 右侧面 -->
    <polygon points="${rightFace}" fill="${shade(base, -0.16)}" />

    <!-- 正面 -->
    <rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="${base}" />
    ${textureSrc ? `<image href="${textureSrc}" x="${fx}" y="${fy}" width="${fw}" height="${fh}"
        preserveAspectRatio="xMidYMid slice" opacity="0.18" clip-path="url(#faceClip)" />` : ''}
    <g clip-path="url(#faceClip)">${faceContent}</g>
    <rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="none" stroke="rgba(0,0,0,0.16)" stroke-width="1" />

    <!-- 尺寸标注 -->
    <line x1="${fx}" y1="${fy + fh + 34}" x2="${fx + fw}" y2="${fy + fh + 34}" stroke="#9A9A9A" stroke-width="1" />
    <line x1="${fx}" y1="${fy + fh + 29}" x2="${fx}" y2="${fy + fh + 39}" stroke="#9A9A9A" stroke-width="1" />
    <line x1="${fx + fw}" y1="${fy + fh + 29}" x2="${fx + fw}" y2="${fy + fh + 39}" stroke="#9A9A9A" stroke-width="1" />
    <text x="${fx + fw / 2}" y="${fy + fh + 52}" font-size="13" fill="#6B6B6B" text-anchor="middle"
      font-family="'JetBrains Mono',Consolas,monospace">${escXml(dimText)}</text>

    <!-- 体系标签 -->
    <rect x="20" y="24" width="112" height="26" rx="13" fill="${isG ? '#1B3A57' : '#4A7C59'}" />
    <text x="76" y="41" font-size="12" fill="#FFFFFF" text-anchor="middle"
      font-family="'Noto Sans SC','PingFang SC',sans-serif">${escXml(plan.modeLabel)}</text>
    <text x="20" y="72" font-size="12" fill="#9A9A9A"
      font-family="'Noto Sans SC','PingFang SC',sans-serif">主纹：${escXml((plan.visual.pattern && plan.visual.pattern.name) || '—')}</text>
  </svg>`;
}

if (typeof window !== 'undefined') window.buildPreviewSVG = buildPreviewSVG;
