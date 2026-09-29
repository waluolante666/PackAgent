/* ================= 视图切换 ================= */
const tabs = document.querySelectorAll('.tab');
const views = document.querySelectorAll('.view');

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.remove('active'));
    views.forEach((v) => v.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('view-' + tab.dataset.tab).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

/* ================= 工具 ================= */
const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function copyText(text, btn) {
  const done = () => {
    const old = btn.textContent;
    btn.textContent = '已复制';
    setTimeout(() => (btn.textContent = old), 1400);
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done);
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    document.body.removeChild(ta);
  }
}

/* ================= 智能体运行 ================= */
const output = document.getElementById('agentOutput');
const runBtn = document.getElementById('runBtn');

function readCtx() {
  return {
    requirement: document.getElementById('req').value.trim(),
    productName: document.getElementById('productName').value.trim() || '产品名',
    industry: document.getElementById('industry').value,
    priceTier: document.getElementById('priceTier').value,
    structure: document.getElementById('structure').value,
  };
}

function chainHTML(steps) {
  return `<div class="chain"><div class="chain-title">智能体推理链路</div><div class="chain-steps">${steps
    .map(
      (s, i) => `
      <div class="chain-step ${s.state || 'done'}" style="animation-delay:${i * 90}ms">
        <div class="step-idx">${i + 1}</div>
        <div class="step-body">
          <div class="step-title">${esc(s.title)}</div>
          <div class="step-desc">${s.desc}</div>
        </div>
      </div>`
    )
    .join('')}</div></div>`;
}

function scoreHTML(intent) {
  const max = Math.max(intent.guofeng, intent.modern, 1);
  return `<div class="score-row">
    <div class="score-item">
      <div class="score-label"><span>国风非遗体系权重</span><b>${intent.guofeng}</b></div>
      <div class="score-bar"><div class="score-fill g" style="width:${(intent.guofeng / max) * 100}%"></div></div>
    </div>
    <div class="score-item">
      <div class="score-label"><span>现代产业体系权重</span><b>${intent.modern}</b></div>
      <div class="score-bar"><div class="score-fill m" style="width:${(intent.modern / max) * 100}%"></div></div>
    </div>
  </div>`;
}

function planHTML(plan, productName, idx) {
  const isG = plan.mode === 'guofeng';
  const cls = plan.mode;

  const refChips =
    plan.refImages && plan.refImages.length
      ? `<div class="ref-chips">${plan.refImages
          .map(
            (r) => `<span class="ref-chip ${r.kind}">
          <img src="${esc(r.path)}" alt="" />
          <span>${esc(r.id)} ${esc(r.kind === 'reference' ? '· 参考图' : '· 素材')}</span>
        </span>`
          )
          .join('')}</div>`
      : '<p class="txt-sm">本模式暂无可用参考图：团队参考图需先在「素材标注」页标注体系归属。</p>';

  const swatches = plan.palette.swatches
    .map(
      (s) => `<div class="swatch">
        <div class="swatch-color" style="background:${s.hex}"></div>
        <div class="swatch-meta"><span class="swatch-hex">${esc(s.hex)}</span>${esc(s.role)}</div>
      </div>`
    )
    .join('');

  const matLinks = plan.materials
    .map((m) => `<button class="mat-link" data-mat="${m.id}">${esc(m.id)} · ${esc(m.name)}</button>`)
    .join('');

  const specs = plan.specs
    .map((s) => `<button class="mat-link" data-mat="${s.id}">${esc(s.id)} · ${esc(s.name)}</button>`)
    .join('');

  return `<div class="plan ${cls}">
    <div class="plan-head ${cls}">
      <h3>${esc(plan.title)}</h3>
      <span class="plan-badge">${esc(plan.modeLabel)}</span>
    </div>
    <div class="plan-body">

      <p class="plan-position">${esc(plan.positioning)}</p>

      <div class="plan-block">
        <div class="block-label">配色方案 · ${esc(plan.palette.name)}</div>
        <div class="swatches">${swatches}</div>
        <p class="txt-sm" style="margin-top:8px">${esc(plan.palette.note)}</p>
      </div>

      <div class="plan-block">
        <div class="block-label">主视觉与纹理</div>
        <p class="txt">${esc(plan.visual.usage)}</p>
        <p class="txt-sm" style="margin-top:6px">${esc(plan.texture.apply)}</p>
      </div>

      <div class="plan-block">
        <div class="block-label">版式规则 · ${esc(plan.layout.main)}</div>
        <ul class="rules">${plan.layout.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      </div>

      <div class="plan-block">
        <div class="block-label">字体</div>
        <div class="chips">
          <span class="chip-sm">标题 ${esc(plan.typography.title)}</span>
          <span class="chip-sm">正文 ${esc(plan.typography.body)}</span>
        </div>
        <p class="txt-sm" style="margin-top:6px">${esc(plan.typography.note)}</p>
      </div>

      <div class="plan-block">
        <div class="block-label">工艺建议</div>
        <div class="chips">${plan.craft.map((c) => `<span class="chip-sm">${esc(c)}</span>`).join('')}</div>
      </div>

      <div class="plan-block">
        <div class="block-label">尺寸与材质规格</div>
        <ul class="rules">${plan.dimensions.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      </div>

      <div class="plan-block">
        <div class="block-label">须遵守的印刷与合规规范</div>
        <div class="mat-links">${specs}</div>
      </div>

      <div class="plan-block">
        <div class="block-label">风险提示</div>
        ${plan.risks.map((r) => `<div class="risk-item">${esc(r)}</div>`).join('')}
      </div>

      <div class="plan-block">
        <div class="block-label">本方案调用的素材（可溯源）</div>
        <div class="mat-links">${matLinks}</div>
      </div>

      <div class="plan-block">
        <div class="block-label">AI 生图提示词</div>
        <div class="prompt-lang">中文提示词</div>
        <div class="prompt-box" data-prompt-cn>${esc(plan.prompt.cn)}</div>
        <div class="prompt-lang">English prompt</div>
        <div class="prompt-box" data-prompt-en>${esc(plan.prompt.en)}</div>
        <p class="txt-sm" style="margin-bottom:8px">${esc(plan.prompt.negative)}</p>
        <div style="display:flex;gap:8px">
          <button class="copy-btn" data-copy="cn">复制中文提示词</button>
          <button class="copy-btn" data-copy="en">复制英文提示词</button>
        </div>
      </div>

      <div class="plan-block">
        <div class="block-label">参数预览 · 由本方案参数实时渲染（离线可用）</div>
        <div class="preview-box">${window.buildPreviewSVG(plan, productName)}</div>
        <p class="txt-sm">这是参数示意：配色取本方案色卡、纹样取检索到的素材、版式取体系规则、尺寸取规格。换需求判定一变，图就变。真正的<strong>设计图</strong>要用下方按钮调模型生成。</p>
      </div>

      <div class="plan-block">
        <div class="block-label">调用模型生成设计图（图生图）</div>
        <div class="ref-block">
          <div class="ref-label">将作为参考图传入模型</div>
          ${refChips}
        </div>
        <button class="gen-btn ${cls}" data-gen="${idx}">生成设计图</button>
        <div class="gen-result" id="genResult-${idx}"></div>
      </div>

    </div>
  </div>`;
}

function run() {
  const ctx = readCtx();
  const modeSel = document.getElementById('mode').value;

  const result = window.runAgent(ctx);
  let intent = result.intent;
  let plans = result.plans;

  // 手动强制模式
  if (modeSel !== 'auto') {
    const p = window.runAgent({ ...ctx, mode: modeSel });
    plans = [p.plans.find((x) => x.mode === modeSel)];
    intent = { ...intent, mode: modeSel, reason: `已手动锁定为${modeSel === 'guofeng' ? '国风' : '现代'}模式，跳过自动判定。` };
  }

  const modeText =
    intent.mode === 'dual' ? '双方案（风格边界模糊）' : intent.mode === 'guofeng' ? '国风非遗体系' : '现代产业体系';

  const steps = [
    {
      title: '需求解析',
      desc: `行业「${ctx.industry}」· 价位「${ctx.priceTier}」· 结构「${ctx.structure}」${intent.signals.length ? `，命中关键词 ${intent.signals.map((s) => s.kw).join('、')}` : '，未命中明确风格关键词'}`,
    },
    {
      title: '模式判定',
      desc: `判定结果：${modeText}，置信度 ${Math.round(intent.confidence * 100)}%。${intent.reason}`,
      state: intent.mode === 'dual' ? 'warn' : 'done',
    },
    {
      title: '素材检索',
      desc: plans
        .map(
          (p) =>
            `${p.modeLabel}命中 ${p.retrieved.length} 条素材${p.retrieved.length ? '：' + p.retrieved.slice(0, 3).map((r) => r.name).join('、') + ' 等' : ''}`
        )
        .join('；'),
    },
    {
      title: '方案生成',
      desc: `已输出 ${plans.length} 套可执行设计简报，含配色、纹样、版式、字体、工艺、尺寸规格、印刷与合规规范，以及可复制的生图提示词。`,
    },
    {
      title: '效果图渲染',
      desc: `按本方案参数实时渲染包装效果图：配色取色卡、纹样取检索到的素材、版式取体系规则、尺寸取规格参数。参数一变，图就变。`,
    },
  ];

  output.innerHTML =
    chainHTML(steps) +
    scoreHTML(intent) +
    `<div class="plans ${plans.length > 1 ? 'dual' : ''}" style="margin-top:18px">${plans
      .map((p, i) => planHTML(p, ctx.productName, i))
      .join('')}</div>`;

  window.__lastPlans = plans;
  window.__lastCtx = ctx;
  bindPlanEvents(output);
}

/* ================= 调用模型生成设计图 ================= */
async function generateDesign(idx, btn) {
  const plan = (window.__lastPlans || [])[idx];
  const ctx = window.__lastCtx || {};
  if (!plan) return;
  const box = document.getElementById('genResult-' + idx);
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = '生成中…';
  box.innerHTML = '<p class="txt-sm">正在调用图像模型，参考图 + 提示词已提交，通常需要十几秒…</p>';

  const payload = {
    mode: plan.mode,
    productName: ctx.productName || '',
    prompt: plan.prompt.cn,
    englishPrompt: plan.prompt.en,
    refs: (plan.refImages || []).map((r) => r.path),
    size: '1024x1024',
    palette: plan.palette.swatches.map((s) => s.hex),
    layout: plan.layout.main,
    dimensions: plan.dimensions.outer,
    tag: `${plan.mode}_${ctx.productName || 'design'}`,
  };

  let data = null;
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    data = await res.json();
  } catch (e) {
    data = null;
  }

  btn.disabled = false;
  btn.textContent = old;

  if (data && data.ok && data.url) {
    box.innerHTML = `<div class="gen-img-box"><img src="${esc(data.url)}" alt="生成的设计图" /></div>
      <p class="txt-sm">设计图已生成并保存到 <code>${esc(data.file)}</code>。参考图：${(plan.refImages || [])
        .map((r) => esc(r.id))
        .join('、') || '无'}</p>`;
    renderGallery();
    return;
  }

  // 未配置 / 失败 → 给任务包
  const task = (data && data.task) || payload;
  const taskText = JSON.stringify(task, null, 2);
  box.innerHTML = `<div class="gen-fallback">
      <p class="txt-sm"><strong>${data && data.error ? '调用失败' : '未配置 API Key'}</strong>：${esc(
        (data && data.hint) || '需要启动本地服务并填写 API Key。'
      )}</p>
      <p class="txt-sm">下面是本次的<strong>生成任务包</strong>，复制后交给 AI 助手即可代跑（会带上参考图与提示词）。</p>
      <div class="prompt-box" style="max-height:180px;overflow:auto">${esc(taskText)}</div>
      <button class="copy-btn" data-copytask="${idx}">复制任务包</button>
    </div>`;
  box.querySelector('[data-copytask]').addEventListener('click', (ev) => copyText(taskText, ev.target));
}

function bindPlanEvents(scope) {
  scope.querySelectorAll('.mat-link').forEach((b) => {
    b.addEventListener('click', () => openModal(b.dataset.mat));
  });
  scope.querySelectorAll('.copy-btn').forEach((b) => {
    if (b.dataset.copy) {
      b.addEventListener('click', () => {
        const key = b.dataset.copy;
        const p = b.closest('.plan').querySelector(`[data-prompt-${key}]`);
        copyText(p.textContent, b);
      });
    }
  });
  scope.querySelectorAll('[data-gen]').forEach((b) => {
    b.addEventListener('click', () => generateDesign(Number(b.dataset.gen), b));
  });
}

runBtn.addEventListener('click', run);

document.querySelectorAll('.preset').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.getElementById('req').value = btn.dataset.req;
    document.getElementById('industry').value = btn.dataset.ind;
    document.getElementById('priceTier').value = btn.dataset.price;
    document.getElementById('mode').value = 'auto';
    run();
  });
});

/* ================= 模型接入配置 ================= */
const cfgToggle = document.getElementById('cfgToggle');
const cfgBody = document.getElementById('cfgBody');
const cfgState = document.getElementById('cfgState');

cfgToggle.addEventListener('click', () => {
  cfgBody.style.display = cfgBody.style.display === 'none' ? 'block' : 'none';
});

function setCfgState(text, kind) {
  cfgState.textContent = text;
  cfgState.className = 'cfg-state ' + (kind || '');
}

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    if (cfg.apiBase) document.getElementById('cfgApiBase').value = cfg.apiBase;
    if (cfg.model) document.getElementById('cfgModel').value = cfg.model;
    if (cfg.mode) document.getElementById('cfgMode').value = cfg.mode;
    if (cfg.hasKey) document.getElementById('cfgApiKey').value = cfg.apiKey || '';
    setCfgState(cfg.hasKey ? '已配置 Key' : '未配置 Key', cfg.hasKey ? 'on' : '');
    window.__serverUp = true;
  } catch (e) {
    // 未启动本地服务（直接双击 index.html 打开的情况）
    setCfgState('未连接本地服务', 'warn');
    window.__serverUp = false;
  }
}

document.getElementById('cfgSave').addEventListener('click', async () => {
  const btn = document.getElementById('cfgSave');
  const payload = {
    apiBase: document.getElementById('cfgApiBase').value.trim(),
    model: document.getElementById('cfgModel').value.trim(),
    apiKey: document.getElementById('cfgApiKey').value.trim(),
    mode: document.getElementById('cfgMode').value,
  };
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await res.json();
    setCfgState(payload.apiKey ? '已配置 Key' : '未配置 Key', payload.apiKey ? 'on' : '');
    btn.textContent = '已保存';
    setTimeout(() => (btn.textContent = '保存配置'), 1400);
  } catch (e) {
    btn.textContent = '保存失败（需先启动服务）';
    setTimeout(() => (btn.textContent = '保存配置'), 1800);
  }
});

/* ================= 参考素材标注 ================= */
const tagGrid = document.getElementById('tagGrid');
const tagStat = document.getElementById('tagStat');

function renderTagPage() {
  window.applyRefTags();
  const refs = window.ALL_ITEMS.filter((i) => i.zone === 'reference');
  const tagged = refs.filter((r) => !r.pending);
  const g = tagged.filter((r) => r.system === 'guofeng').length;
  const m = tagged.filter((r) => r.system === 'modern').length;

  tagStat.innerHTML = `
    <div class="stat-cell"><b>${refs.length}</b><span>参考图总数</span></div>
    <div class="stat-cell ok"><b>${tagged.length}</b><span>已标注</span></div>
    <div class="stat-cell g"><b>${g}</b><span>归入国风</span></div>
    <div class="stat-cell m"><b>${m}</b><span>归入现代</span></div>
    <div class="stat-cell warn"><b>${refs.length - tagged.length}</b><span>待标注</span></div>`;

  tagGrid.innerHTML = refs
    .map((r) => {
      const state = r.pending ? (r.skipped ? 'skip' : '') : r.system === 'guofeng' ? 'g' : 'm';
      const stateText = r.pending
        ? r.skipped
          ? '已跳过'
          : '未标注'
        : r.system === 'guofeng'
        ? '国风非遗'
        : '现代商业';
      return `<div class="tag-card ${state}" data-id="${r.id}">
        <div class="tag-thumb" style="background-image:url('${esc(r.image)}')" data-open="${r.id}"></div>
        <div class="tag-card-body">
          <div class="tag-card-top">
            <span class="mat-id">${esc(r.id)}</span>
            <span class="tag-state ${state}">${stateText}</span>
          </div>
          <div class="tag-btns">
            <button class="tag-btn g" data-act="guofeng" data-id="${r.id}">国风</button>
            <button class="tag-btn m" data-act="modern" data-id="${r.id}">现代</button>
            <button class="tag-btn skip" data-act="skip" data-id="${r.id}">跳过</button>
          </div>
          <input class="tag-input" data-taginput="${r.id}" value="${esc(
            r.pending ? '' : (r.tags || []).join('、')
          )}" placeholder="补充标签，逗号分隔：礼盒、茶叶、插画…" />
        </div>
      </div>`;
    })
    .join('');

  tagGrid.querySelectorAll('.tag-thumb').forEach((el) => {
    el.addEventListener('click', () => openModal(el.dataset.open));
  });
  tagGrid.querySelectorAll('[data-act]').forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.dataset.id;
      if (b.dataset.act === 'skip') {
        window.saveRefTag(id, 'skip', []);
      } else {
        const input = tagGrid.querySelector(`[data-taginput="${id}"]`);
        const tags = input.value.split(/[、,，\s]+/).filter(Boolean);
        window.saveRefTag(id, b.dataset.act, tags);
      }
      renderTagPage();
      run(); // 标注变化后重跑智能体，刷新参考图
    });
  });
  tagGrid.querySelectorAll('[data-taginput]').forEach((el) => {
    el.addEventListener('change', () => {
      const id = el.dataset.taginput;
      const cur = window.loadRefTags()[id];
      if (cur && cur.system && cur.system !== 'skip') {
        window.saveRefTag(id, cur.system, el.value.split(/[、,，\s]+/).filter(Boolean));
        renderTagPage();
      }
    });
  });
}

document.getElementById('tabs').addEventListener('click', (e) => {
  if (e.target.dataset && e.target.dataset.tab === 'tag') renderTagPage();
});

/* ================= 生成产出画廊 ================= */
async function renderGallery() {
  const box = document.getElementById('genGallery');
  if (!box) return;
  let files = [];
  try {
    const res = await fetch('/api/outputs');
    const d = await res.json();
    files = d.files || [];
  } catch (e) {
    files = [];
  }
  if (!files.length) {
    files = ['outputs/gen_tea_guofeng.png', 'outputs/gen_tea_modern.png'];
  }
  box.innerHTML = files
    .map(
      (f) => `<figure class="gal-item">
        <img src="${esc(f)}" alt="模型生成的设计图" />
        <figcaption>${esc(f.split('/').pop())}</figcaption>
      </figure>`
    )
    .join('');
}

/* ================= 素材数据库 ================= */
const dbGrid = document.getElementById('dbGrid');
const dbCount = document.getElementById('dbCount');
let dbState = { q: '', zone: 'all', type: 'all' };

function renderDB() {
  const { q, zone, type } = dbState;
  let items = window.ALL_ITEMS.filter((i) => (zone === 'all' || i.zone === zone) && (type === 'all' || i.type === type));

  if (q.trim()) {
    const scored = window.retrieve(q, zone === 'all' ? null : zone, 999);
    const ids = new Set(scored.map((s) => s.id));
    if (zone !== 'all' || type !== 'all') {
      items = items.filter((i) => ids.has(i.id));
    } else {
      items = scored;
    }
  }

  const refs = window.ALL_ITEMS.filter((i) => i.zone === 'reference');
  const refDone = refs.filter((i) => !i.pending).length;
  dbCount.textContent = q.trim()
    ? `检索「${q}」→ 命中 ${items.length} 条素材`
    : `共 ${items.length} 条素材 · 国风分区 ${window.ALL_ITEMS.filter((i) => i.zone === 'guofeng').length} 条 / 现代分区 ${window.ALL_ITEMS.filter(
        (i) => i.zone === 'modern'
      ).length} 条 · 团队参考图 ${refs.length} 张（已标注 ${refDone} 张）`;

  if (!items.length) {
    dbGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h3>没有匹配的素材</h3><p>换个关键词试试，比如「靛蓝」「礼盒」「极简」「印刷」。</p></div>`;
    return;
  }

  dbGrid.innerHTML = items
    .map(
      (it) => `<div class="mat-card ${it.zone} ${it.image ? 'has-img' : ''}" data-mat="${it.id}">
      <div class="mat-card-strip"></div>
      ${
        it.image
          ? `<div class="mat-thumb" style="background-image:url('${esc(it.image)}')"><span class="thumb-tag">素材图</span></div>`
          : ''
      }
      <div class="mat-card-body">
        <div class="mat-card-top">
          <span class="mat-id">${esc(it.id)}</span>
          <span class="mat-type">${esc(window.TYPE_LABEL[it.type] || it.type)}</span>
        </div>
        <div class="mat-name">${esc(it.name)}</div>
        <div class="mat-desc">${esc(it.desc)}</div>
        ${
          it.colors
            ? `<div class="mat-colors">${it.colors.map((c) => `<div class="mat-color-dot" style="background:${c}" title="${c}"></div>`).join('')}</div>`
            : ''
        }
        <div class="mat-tags">${(it.tags || []).slice(0, 4).map((t) => `<span class="mat-tag">${esc(t)}</span>`).join('')}</div>
      </div>
    </div>`
    )
    .join('');

  dbGrid.querySelectorAll('.mat-card').forEach((c) => {
    c.addEventListener('click', () => openModal(c.dataset.mat));
  });
}

let searchTimer;
document.getElementById('dbSearch').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    dbState.q = e.target.value;
    renderDB();
  }, 180);
});

document.getElementById('dbZoneFilter').addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  document.querySelectorAll('#dbZoneFilter .chip').forEach((c) => c.classList.remove('active'));
  b.classList.add('active');
  dbState.zone = b.dataset.zone;
  renderDB();
});

document.getElementById('dbTypeFilter').addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  document.querySelectorAll('#dbTypeFilter .chip').forEach((c) => c.classList.remove('active'));
  b.classList.add('active');
  dbState.type = b.dataset.type;
  renderDB();
});

/* ================= 素材详情弹层 ================= */
const mask = document.getElementById('modalMask');
const modal = document.getElementById('modal');

function openModal(id) {
  const it = window.findById(id);
  if (!it) return;
  const zoneLabel = it.zone === 'guofeng' ? '国风非遗分区' : '现代产业分区';

  modal.innerHTML = `
    <div class="modal-head">
      <div>
        <h3>${esc(it.name)}</h3>
        <span class="mat-id">${esc(it.id)}</span>
        <span class="mat-type">${esc(window.TYPE_LABEL[it.type] || it.type)}</span>
        <span class="mat-type">${esc(zoneLabel)}</span>
      </div>
      <button class="modal-close" id="modalClose">×</button>
    </div>
    <div class="modal-body">
      ${it.image ? `<div class="modal-img"><img src="${esc(it.image)}" alt="${esc(it.name)}" /></div>` : ''}
      <div class="modal-section"><h4>说明</h4><p class="txt">${esc(it.desc)}</p></div>
      ${it.usage ? `<div class="modal-section"><h4>适用场景</h4><p class="txt">${esc(it.usage)}</p></div>` : ''}
      ${
        it.params
          ? `<div class="modal-section"><h4>结构化参数</h4>${it.params
              .map((p) => `<div class="param-row"><span class="param-k">${esc(p.k)}</span><span class="param-v">${esc(p.v)}</span></div>`)
              .join('')}</div>`
          : ''
      }
      ${
        it.colors
          ? `<div class="modal-section"><h4>色值</h4><div class="mat-colors">${it.colors
              .map((c) => `<div class="mat-color-dot" style="background:${c};width:34px;height:34px" title="${c}"></div>`)
              .join('')}</div><p class="txt-sm" style="margin-top:6px">${it.colors.join(' / ')}</p></div>`
          : ''
      }
      <div class="modal-section"><h4>检索标签</h4><div class="mat-tags">${(it.tags || []).map((t) => `<span class="mat-tag">${esc(t)}</span>`).join('')}</div></div>
      ${it.source ? `<div class="modal-section"><h4>来源 / 依据</h4><p class="source-line">${esc(it.source)}</p></div>` : ''}
    </div>`;

  mask.classList.add('show');
  document.getElementById('modalClose').addEventListener('click', () => mask.classList.remove('show'));
}

mask.addEventListener('click', (e) => {
  if (e.target === mask) mask.classList.remove('show');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') mask.classList.remove('show');
});

/* 案例页中的纹样素材按钮 → 打开素材详情 */
document.querySelectorAll('.pattern-links .mat-link').forEach((b) => {
  b.addEventListener('click', () => openModal(b.dataset.mat));
});

/* ================= 案例验证 ================= */
function renderCases() {
  const cases = [
    {
      ctx: { requirement: '武义武阳春雨茶礼盒，100g 春茶，面向商务馈赠，有文化底蕴', industry: '茶', priceTier: '高端', structure: '中式天地盖硬纸礼盒', mode: 'guofeng' },
      img: 'assets/case_tea_guofeng.png',
      tag: '国风非遗体系',
    },
    {
      ctx: { requirement: '武阳春雨茶，电商渠道，简约扁平，控制成本，可系列化', industry: '茶', priceTier: '平价', structure: '简洁天地盖纸盒', mode: 'modern' },
      img: 'assets/case_tea_modern.png',
      tag: '现代产业体系',
    },
  ];

  document.getElementById('caseGrid').innerHTML = cases
    .map((c) => {
      const plan = window.runAgent(c.ctx).plans[0];
      const cls = plan.mode;
      const sw = plan.palette.swatches.map((s) => s.hex).join(' / ');
      return `<div class="case-card">
        <img class="case-img" src="${c.img}" alt="${esc(plan.title)}" />
        <div class="case-card-body">
          <span class="case-tag ${cls}">${esc(c.tag)}</span>
          <h3>${esc(plan.title)}</h3>
          <p>${esc(plan.positioning)}</p>
          <div class="case-specs">
            <div class="case-spec"><b>配色</b><span>${esc(sw)}</span></div>
            <div class="case-spec"><b>${plan.mode === 'guofeng' ? '主纹样' : '视觉策略'}</b><span>${esc(plan.visual.pattern.name)}</span></div>
            <div class="case-spec"><b>版式</b><span>${esc(plan.layout.main)}</span></div>
            <div class="case-spec"><b>尺寸</b><span>${esc(plan.dimensions.outer)}</span></div>
            <div class="case-spec"><b>工艺</b><span>${esc(plan.craft.slice(0, 3).join('、'))}</span></div>
          </div>
        </div>
      </div>`;
    })
    .join('');
}

/* ================= 初始化 ================= */
renderDB();
renderCases();
run();
loadConfig();
renderTagPage();
renderGallery();
