/**
 * 包装设计 AI 智能体 · 推理引擎
 *
 * 工作链路：
 *   需求解析 → 模式判定（国风 / 现代 / 双方案）→ 素材检索 → 设计方案生成 → 生图提示词输出
 *
 * 设计原则：智能体不直接「画图」，而是从两个分区的素材库中检索出可溯源的素材，
 * 按各自体系的设计规则组装成一份可执行的包装设计简报。
 */

/* ---------- 1. 风格信号词典 ---------- */
const GUOFENG_SIGNALS = {
  3: ['国风', '非遗', '蓝夹缬', '夹缬', '中式', '中国风', '国潮', '传统', '古典', '古风', '东方美学'],
  2: ['礼盒', '礼品', '伴手礼', '节庆', '中秋', '春节', '婚庆', '纹样', '书法', '印章', '文化', '匠心', '手作', '高端', '典雅'],
  1: ['茶', '文创', '特色', '地域', '吉祥', '质感', '收藏', '限量', '东方', '古法'],
};

const MODERN_SIGNALS = {
  3: ['现代', '极简', '简约', '扁平', '快消', '电商', '量产', '年轻', '潮流', '扁平化', '极简主义'],
  2: ['食品', '零食', '日化', '饮料', '化妆品', '数码', '快递', '货架', '系列化', '多sku', '标准化', '成本', '印刷', '环保', '可持续', '量产化'],
  1: ['效率', '批量', '打样', '转化', '便捷', '上架', '商超', '复购', '性价比'],
};

/* 行业对风格的先验倾向 */
const INDUSTRY_PRIOR = {
  文创: { guofeng: 1.2, modern: 0 },
  茶: { guofeng: 0.8, modern: 0.4 },
  礼品: { guofeng: 1.5, modern: 0 },
  农产品: { guofeng: 0.6, modern: 0.8 },
  食品: { guofeng: 0, modern: 1.2 },
  日化: { guofeng: 0, modern: 1.5 },
  饮料: { guofeng: 0, modern: 1.2 },
  数码: { guofeng: 0, modern: 1.5 },
  服装: { guofeng: 0.3, modern: 1 },
  其他: { guofeng: 0, modern: 0 },
};

/* 行业 / 结构 → 现代模式产业模板 */
function pickTemplate(industry, structure) {
  if (structure && (structure.includes('礼盒') || structure.includes('书型') || structure.includes('抽屉'))) {
    return findById('MD-T-05');
  }
  const map = {
    茶: 'MD-T-04',
    农产品: 'MD-T-04',
    食品: 'MD-T-01',
    日化: 'MD-T-02',
    饮料: 'MD-T-01',
    文创: 'MD-T-03',
    礼品: 'MD-T-05',
    数码: 'MD-T-03',
    服装: 'MD-T-03',
  };
  return findById(map[industry] || 'MD-T-01');
}

/* 行业 → 现代模式强调色 */
const INDUSTRY_ACCENT = {
  茶: { hex: '#4A7C59', name: '橄榄绿' },
  农产品: { hex: '#6B8E4E', name: '田野绿' },
  食品: { hex: '#C2703D', name: '暖橙' },
  日化: { hex: '#2E86AB', name: '清透蓝' },
  饮料: { hex: '#E8543F', name: '活力红' },
  文创: { hex: '#8A6A4F', name: '胡桃褐' },
  数码: { hex: '#111111', name: '纯黑' },
  礼品: { hex: '#C9A227', name: '哑金' },
  服装: { hex: '#8A8F98', name: '中性灰' },
  其他: { hex: '#4A7C59', name: '橄榄绿' },
};

/* ---------- 2. 需求解析与模式判定 ---------- */
function analyzeIntent(requirement, industry, priceTier) {
  const text = (requirement || '').toLowerCase();
  const signals = [];

  let guofeng = 0;
  let modern = 0;

  const scan = (dict, bucket) => {
    Object.keys(dict).forEach((w) => {
      dict[w].forEach((kw) => {
        if (text.includes(kw)) {
          const val = Number(w);
          bucket === 'g' ? (guofeng += val) : (modern += val);
          signals.push({ kw, weight: val, side: bucket === 'g' ? '国风' : '现代' });
        }
      });
    });
  };
  scan(GUOFENG_SIGNALS, 'g');
  scan(MODERN_SIGNALS, 'm');

  const prior = INDUSTRY_PRIOR[industry] || INDUSTRY_PRIOR['其他'];
  guofeng += prior.guofeng;
  modern += prior.modern;

  if (priceTier === '高端') guofeng += 0.8;
  if (priceTier === '平价') modern += 1.2;

  const diff = guofeng - modern;
  let mode;
  let confidence;
  if (Math.abs(diff) <= 1.5 && guofeng > 0 && modern > 0) {
    mode = 'dual';
    confidence = 0.55;
  } else if (diff > 0) {
    mode = 'guofeng';
    confidence = Math.min(0.98, 0.6 + diff * 0.08);
  } else {
    mode = 'modern';
    confidence = Math.min(0.98, 0.6 + Math.abs(diff) * 0.08);
  }
  if (guofeng === 0 && modern === 0) {
    mode = 'dual';
    confidence = 0.4;
  }

  return {
    mode,
    confidence,
    guofeng: Math.round(guofeng * 10) / 10,
    modern: Math.round(modern * 10) / 10,
    signals: signals.slice(0, 8),
    reason: buildReason(mode, guofeng, modern, industry, signals),
  };
}

function buildReason(mode, g, m, industry, signals) {
  const hit = signals
    .slice(0, 3)
    .map((s) => `${s.side}信号「${s.kw}」`)
    .join('、');
  if (mode === 'dual') {
    return `需求中同时出现国风与现代信号（${hit || '信号不足'}），两套体系权重接近（国风 ${g} / 现代 ${m}）。智能体判定为风格边界模糊，输出双方案供人工决策——这正是本项目要解决的「风格错乱」问题。`;
  }
  if (mode === 'guofeng') {
    return `国风权重 ${g} 明显高于现代 ${m}，触发关键词 ${hit || `行业「${industry}」先验倾向`}。进入国风模式，调用蓝夹缬非遗素材参数。`;
  }
  return `现代权重 ${m} 高于国风 ${g}，触发关键词 ${hit || `行业「${industry}」先验倾向`}。进入现代模式，调用商业包装规范与产业模板。`;
}

/* ---------- 3. 素材检索 ---------- */
function retrieve(query, zone, topN = 4) {
  const q = (query || '').toLowerCase();
  const words = q
    .split(/[\s，,。、;；:：\n]+/)
    .filter((w) => w.length > 0);
  const pool = zone && zone !== 'all' ? ALL_ITEMS.filter((i) => i.zone === zone) : ALL_ITEMS;

  const scored = pool
    .map((item) => {
      let score = 0;
      const haystack = [item.name, item.desc, item.usage, ...(item.tags || [])].join(' ').toLowerCase();
      // 整句命中
      if (haystack.includes(q) && q.length > 1) score += 6;
      // 分词命中
      words.forEach((w) => {
        if (w.length >= 2 && haystack.includes(w)) score += 3;
        (item.tags || []).forEach((t) => {
          if (t.includes(w) || w.includes(t)) score += 4;
        });
      });
      // 名称直接命中加权
      if (item.name.toLowerCase().includes(q)) score += 5;
      return { item, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topN).map((s) => ({
    ...s.item,
    matchScore: Math.min(0.99, 0.5 + s.score * 0.05),
  }));
}

function findById(id) {
  return ALL_ITEMS.find((i) => i.id === id);
}

/* 按模式检索：本分区素材 + 已标注到该体系的团队参考图 */
function retrieveForMode(query, mode, topN = 5) {
  const main = retrieve(query, mode, topN);
  const refs = retrieve(query, 'reference', 3).filter((r) => !r.pending && r.system === mode);
  return { main, refs };
}

/* 取出本模式可用的参考图（用于图生图），优先已标注的团队参考图，其次素材自带图 */
function pickRefImages(mode, limit = 3) {
  const out = [];
  const tagged = ALL_ITEMS.filter((i) => i.zone === 'reference' && !i.pending && i.system === mode && i.image);
  tagged.slice(0, limit).forEach((i) => out.push({ path: i.image, id: i.id, name: i.name, kind: 'reference' }));

  if (out.length < limit) {
    const owned = ALL_ITEMS.filter((i) => i.zone === mode && i.image && !i.pending);
    owned.slice(0, limit - out.length).forEach((i) => out.push({ path: i.image, id: i.id, name: i.name, kind: 'material' }));
  }
  return out;
}

/* 按类型在指定分区中取素材，可用 tags 做偏好排序 */
function pick(zone, type, preferTags = []) {
  const candidates = ALL_ITEMS.filter((i) => i.zone === zone && i.type === type);
  if (!candidates.length) return null;
  const ranked = candidates
    .map((c) => {
      const hit = preferTags.reduce((acc, t) => acc + ((c.tags || []).includes(t) ? 1 : 0), 0);
      return { c, hit };
    })
    .sort((a, b) => b.hit - a.hit);
  return ranked[0].hit > 0 ? ranked[0].c : candidates[0];
}

/* ---------- 4. 方案生成 ---------- */
function generatePlan(ctx) {
  const { requirement, industry, priceTier, structure, mode } = ctx;
  const tags = [industry, priceTier, structure].filter(Boolean);
  const accent = INDUSTRY_ACCENT[industry] || INDUSTRY_ACCENT['其他'];

  if (mode === 'guofeng') return buildGuofengPlan(ctx, tags, accent);
  return buildModernPlan(ctx, tags, accent);
}

function buildGuofengPlan(ctx, tags, accent) {
  const { industry, priceTier, structure } = ctx;
  const useColorful = priceTier === '高端' || priceTier === '收藏级';

  const palette = useColorful ? findById('GF-C-03') : findById('GF-C-01');
  const pattern = pick('guofeng', 'pattern', [industry, '礼盒', '茶', '对称']);
  const border = findById('GF-P-06');
  const texture = pick('guofeng', 'texture', [industry, '手工', '触感']);
  const layoutMain = findById('GF-L-01');
  const layoutText = findById('GF-L-02');
  const frame = findById('GF-L-03');
  const accentColor = findById('GF-C-04');
  const gold = findById('GF-C-05');
  const specPrint = findById('MD-S-01');
  const specLimit = findById('MD-S-03');

  return {
    mode: 'guofeng',
    modeLabel: '国风非遗体系',
    accent: palette.colors[0],
    title: '国风版 · 非遗文化表达方案',
    positioning: `以蓝夹缬非遗纹样为核心视觉资产，强调文化表达与礼品仪式感，适配${industry || '本品类'}的礼品 / 文创 / 特色农产品场景。`,
    palette: {
      name: palette.name,
      id: palette.id,
      swatches: (palette.colors || []).map((c, i) => ({
        hex: c,
        role: (palette.roles && palette.roles[i]) || (i === 0 ? '主色' : i === 1 ? '辅色' : '留白'),
      })),
      accentHex: accentColor.colors[0],
      goldHex: gold.colors[0],
      note: '强调色（朱砂）面积控制在 5% 以内，仅用于印章、点睛与细线。',
    },
    visual: {
      pattern,
      border,
      usage: `${pattern.name}作主视觉（占比 ${(pattern.params?.[0]?.v) || '40% – 55%'}），${border.name}包边框。`,
    },
    texture: { item: texture, apply: `${texture.name}通过${texture.params?.[0]?.v || '击凸工艺'}在纸面还原。` },
    layout: {
      main: layoutMain.name,
      text: layoutText.name,
      frame: frame.name,
      rules: ['主纹居中对称，中轴误差 ≤ 1mm', '品名竖排，字距加大至字号 0.3 – 0.5', '落款印章 12 – 20mm 见方', '四边留白 ≥ 12mm'],
    },
    typography: {
      title: '思源宋体 / 方正书宋（或书法定制体）',
      body: '思源黑体 Light',
      note: '标题用衬线体建立文化感，正文用无衬线保证法规信息可读。',
    },
    craft: useColorful
      ? ['彩色夹缬纹样（绀地红花，限量线）', '击凸还原雕版压痕', '烫香槟金描边', '手工纸内衬']
      : ['击凸（还原雕版压印肌理，0.3 – 0.6mm）', '烫金 / 烫香槟金描边纹样', '特种纸（含棉浆，120 – 250g）', '手工纸吊牌与内衬'],
    specs: [specPrint, specLimit].filter(Boolean),
    risks: useColorful
      ? ['彩色夹缬（红花染）成本显著高于单色靛蓝，仅建议限量线或高客单价产品', '纹样最小可读尺寸需 ≥ 120mm 宽，小规格包装不可用满版人物纹']
      : ['人物类纹样在小尺寸下会糊成一团，100g 以下小包装建议只用花卉 / 几何纹', '深靛底色建议走专色印刷，四色叠印容易偏色发灰'],
    dimensions: buildDimensions(structure, 'guofeng', industry),
    materials: [palette, pattern, border, texture, layoutMain, layoutText, accentColor].filter(Boolean),
  };
}

function buildModernPlan(ctx, tags, accent) {
  const { industry, priceTier, structure } = ctx;
  const isPremium = priceTier === '高端' || priceTier === '收藏级';
  const isSeries = (ctx.requirement || '').includes('系列') || (ctx.requirement || '').includes('多款');

  const basePalette = industry === '食品' || industry === '农产品' || industry === '茶' ? findById('MD-C-03') : findById('MD-C-01');
  const layout = isSeries
    ? findById('MD-L-04')
    : isPremium || industry === '文创'
    ? findById('MD-L-01')
    : findById('MD-L-02');
  const focus = findById('MD-L-03');
  const windowBox = findById('MD-L-05');
  const template = pickTemplate(industry, structure);
  const specPrint = findById('MD-S-01');
  const specColor = findById('MD-S-02');
  const specLimit = findById('MD-S-03');
  const specDie = findById('MD-S-04');

  return {
    mode: 'modern',
    modeLabel: '现代产业体系',
    accent: accent.hex,
    title: '现代版 · 产业商业化方案',
    positioning: `遵循现代审美与${industry || '本品类'}的量产、电商与货架逻辑，简约扁平、适配批量生产，不强行堆砌传统元素。`,
    palette: {
      name: basePalette.name,
      id: basePalette.id,
      swatches: [
        { hex: basePalette.colors[0], role: (basePalette.roles && basePalette.roles[0]) || '底色' },
        { hex: basePalette.colors[1] || '#FFFFFF', role: (basePalette.roles && basePalette.roles[1]) || '辅色' },
        { hex: accent.hex, role: `强调色（${accent.name}）` },
      ],
      accentHex: accent.hex,
      goldHex: null,
      note: `强调色面积 ≤ 12%，全品类统一色板，换 SKU 只换色块与文字，刀版不变。`,
    },
    visual: {
      pattern: focus,
      border: null,
      usage: `${layout.name}为骨架${isSeries ? '，配合模块化分栏实现系列化扩展' : ''}；如需建立信任感可叠加开窗结构。`,
    },
    texture: {
      item: windowBox,
      apply: structure && structure.includes('开窗') ? '采用开窗结构，开窗面积控制在盒面 20% – 35%。' : '以材质本身质感为主，不额外叠加装饰纹理。',
    },
    layout: {
      main: layout.name,
      text: '左基线网格，信息按「品名 → 卖点 → 规格 → 法规信息」四级排布',
      frame: null,
      rules: layout.params ? layout.params.map((p) => `${p.k}：${p.v}`) : ['保持 8pt 栅格对齐', '主视觉占比 25% – 35%'],
    },
    typography: {
      title: '思源黑体 Bold / Helvetica Neue',
      body: '思源黑体 Regular',
      note: '全篇同一无衬线字族，靠字重与字号拉开层级，不用装饰字体。',
    },
    craft: ['覆膜（哑膜 / 防油膜）', '局部 UV 提亮强调色块', '水性油墨（符合环保与出口要求）', '单一材质基材，便于回收'],
    specs: [specPrint, specColor, specLimit, specDie].filter(Boolean),
    risks: [
      '极简方案货架识别度依赖结构与材质，纯平面设计容易被同质化淹没',
      '法规信息区必须预留背面 ≥ 30% 版面，不能因为留白美学而压缩',
      'GB 23350 对层数与空隙率有强制上限，礼盒结构需在设计阶段核算',
    ],
    dimensions: buildDimensions(structure, 'modern', industry),
    materials: [basePalette, layout, focus, template, specPrint, specLimit].filter(Boolean),
  };
}

/* ---------- 4.5 尺寸与材质规格 ---------- */
const STRUCTURE_SPEC = {
  中式天地盖硬纸礼盒: { outer: '240 × 180 × 70 mm', material: '157g 铜版纸裱 2.5mm 灰板', note: '盖深 22mm，配绸布内衬与手工纸吊牌 60×100mm' },
  简洁天地盖纸盒: { outer: '200 × 140 × 60 mm', material: '300g 白卡纸 / E 瓦楞', note: '无内衬，可加纸浆模塑卡位' },
  书型盒: { outer: '260 × 210 × 55 mm', material: '157g 铜版纸裱 2.0mm 灰板', note: '磁吸开合，左侧书脊位 12mm' },
  抽屉盒: { outer: '220 × 160 × 65 mm', material: '300g 白卡纸 / 2.0mm 灰板', note: '抽拉阻尼靠公差控制，间隙 0.5mm' },
  开窗盒: { outer: '220 × 150 × 60 mm', material: '350g 白卡纸 + PET 窗片', note: '开窗面积占盒面 20% – 35%，削弱防潮与堆码强度需评估' },
  袋装: { outer: '180 × 260 mm（自立袋，底插角 60mm）', material: 'PET12 / AL7 / PE80 复合膜', note: '含拉链骨条与易撕口，顶部留 15mm 热封边' },
  瓶身标贴: { outer: '220 × 100 mm（缠绕标）', material: '80g 铜版不干胶 / 防水膜', note: '按瓶身周长 200mm + 搭口 20mm，文字避让转折线 ≥ 8mm' },
};

function buildDimensions(structure, mode, industry) {
  const s = STRUCTURE_SPEC[structure] || STRUCTURE_SPEC['简洁天地盖纸盒'];
  return {
    outer: s.outer,
    material: s.material,
    note: s.note,
    craft: { k: '印前通用', v: '出血 3mm / 分辨率 ≥ 300dpi / CMYK / 文字转曲' },
    rules: [
      `外尺寸：${s.outer}`,
      `材质：${s.material}`,
      `结构要点：${s.note}`,
      '印前：出血 3mm、分辨率 ≥ 300dpi、CMYK、文字转曲',
    ],
  };
}

/* ---------- 5. 生图提示词 ---------- */
function buildPrompt(ctx, plan) {
  const { requirement, industry, structure } = ctx;
  const product = requirement || `${industry || '产品'}包装`;
  const struct = structure || (plan.mode === 'guofeng' ? '中式天地盖硬纸礼盒' : '简洁天地盖纸盒');

  if (plan.mode === 'guofeng') {
    const p = plan.palette;
    const main = p.swatches[0]?.hex || '#1B3A57';
    const light = p.swatches[2]?.hex || p.swatches[1]?.hex || '#EAF0F4';
    return {
      cn: `${product}，${struct}，${plan.palette.name}配色（主色 ${main}，留白 ${light}），盒面采用${plan.visual.pattern.name}作${plan.layout.main}主视觉，回纹包边框，品名竖排配朱砂印章落款，${plan.texture.item.name}通过击凸工艺还原，烫金描边纹样，浅米色背景，柔和自然光，高端礼品质感，商业产品摄影。`,
      en: `Premium ${industry || 'product'} packaging, ${struct}, deep indigo (${main}) with off-white (${light}) resist-dyed traditional Chinese pattern, centered symmetrical composition, classic fret border frame, vertical typography with red seal stamp, embossed woodblock texture, gold foil outlines, warm beige background, soft natural lighting, high-end gift packaging product photography.`,
      negative: '避免：现代无衬线大标题、荧光撞色、卡通元素、杂乱满铺底纹、低分辨率。',
    };
  }

  const p = plan.palette;
  const bg = p.swatches[0]?.hex || '#F5F2EC';
  const accent = p.accentHex || '#4A7C59';
  return {
    cn: `${product}，${struct}，极简扁平风格，底色 ${bg}，单一强调色 ${accent}，${plan.layout.main}，大面积留白，无衬线字体横向排版，简洁几何图形，干净白色背景，柔和自然光，现代商业产品摄影，无任何传统纹样装饰。`,
    en: `Minimalist flat ${industry || 'product'} packaging, ${struct}, base color ${bg} with single accent color ${accent}, ${plan.layout.main}, generous whitespace, horizontal sans-serif typography, simple geometric shapes, clean white background, soft natural lighting, modern commercial product photography, no traditional ornament patterns.`,
    negative: '避免：传统纹样、书法字体、烫金边框、渐变背景、多余装饰元素。',
  };
}

/* ---------- 6. 对外主入口 ---------- */
function runAgent(ctx) {
  const intent = analyzeIntent(ctx.requirement, ctx.industry, ctx.priceTier);
  const modes = intent.mode === 'dual' ? ['guofeng', 'modern'] : [intent.mode];

  const plans = modes.map((mode) => {
    const plan = generatePlan({ ...ctx, mode });
    const hit = retrieveForMode(`${ctx.requirement} ${ctx.industry || ''}`, mode, 5);
    plan.prompt = buildPrompt(ctx, plan);
    plan.retrieved = hit.main;
    plan.refImages = pickRefImages(mode, 3);
    return plan;
  });

  return { intent, plans };
}

if (typeof window !== 'undefined') {
  window.runAgent = runAgent;
  window.retrieve = retrieve;
  window.retrieveForMode = retrieveForMode;
  window.pickRefImages = pickRefImages;
  window.findById = findById;
  window.INDUSTRY_ACCENT = INDUSTRY_ACCENT;
}
