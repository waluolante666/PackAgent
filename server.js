/**
 * 包装设计 AI 智能体 · 本地服务
 *
 * 零依赖 Node HTTP 服务，做三件事：
 *   1. 静态托管前端页面与素材
 *   2. POST /api/generate —— 真正调用图像生成模型（图生图：素材库图片 + 提示词）
 *   3. 未配置 API 时，把「生成任务包」落盘到 tasks/，交给 AI 助手代跑
 *
 * 启动：node server.js   然后浏览器打开 http://127.0.0.1:8788
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = __dirname;
const PORT = process.env.PORT || 8788;
const CONFIG_FILE = path.join(ROOT, 'config.json');
const OUT_DIR = path.join(ROOT, 'outputs');
const TASK_DIR = path.join(ROOT, 'tasks');

[OUT_DIR, TASK_DIR].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

/* ---------------- 配置读写 ---------------- */
const DEFAULT_CONFIG = {
  apiBase: 'https://api.siliconflow.cn/v1',
  apiKey: '',
  model: 'Qwen/Qwen-Image-Edit',
  mode: 'generations',
  note: 'apiBase 填服务商的 OpenAI 兼容地址；mode=generations 走 JSON 提交（图以 base64 数组传入），mode=edits 走 multipart 表单。',
};

function readConfig() {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
  } catch (e) {
    return { ...DEFAULT_CONFIG };
  }
}

function writeConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

/* ---------------- 工具 ---------------- */
function body(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(b || '{}'));
      } catch (e) {
        resolve({});
      }
    });
  });
}

const send = (res, code, data, type) => {
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(typeof data === 'string' ? data : JSON.stringify(data));
};

function toDataUrl(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'image/png';
  const b64 = fs.readFileSync(filePath).toString('base64');
  return `data:${mime};base64,${b64}`;
}

function safeName(s) {
  return String(s || 'design').replace(/[^\w\u4e00-\u9fa5-]/g, '_').slice(0, 40);
}

/* ---------------- 真实调用图像模型 ---------------- */
async function callImageAPI(cfg, payload) {
  const { prompt, refs, size } = payload;

  // 参考图转 base64 dataURL
  const images = (refs || [])
    .map((r) => path.join(ROOT, r))
    .filter((p) => fs.existsSync(p))
    .slice(0, 3)
    .map(toDataUrl);

  let endpoint;
  let options;

  if (cfg.mode === 'edits') {
    // multipart 表单：部分服务商的图生图走这个口
    endpoint = `${cfg.apiBase.replace(/\/$/, '')}/images/edits`;
    const boundary = '----packagent' + Date.now();
    const parts = [];
    const push = (name, value) => parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    push('model', cfg.model);
    push('prompt', prompt);
    push('n', '1');
    if (size) push('size', size);
    (refs || []).slice(0, 1).forEach((r) => {
      const p = path.join(ROOT, r);
      if (!fs.existsSync(p)) return;
      const ext = path.extname(p).toLowerCase();
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="ref${ext}"\r\nContent-Type: ${MIME[ext] || 'image/png'}\r\n\r\n`));
      parts.push(fs.readFileSync(p));
      parts.push(Buffer.from('\r\n'));
    });
    parts.push(Buffer.from(`--${boundary}--\r\n`));
    options = {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: Buffer.concat(parts),
    };
  } else {
    // JSON：OpenAI 兼容 /images/generations，参考图以 image 数组传入
    endpoint = `${cfg.apiBase.replace(/\/$/, '')}/images/generations`;
    const bodyObj = { model: cfg.model, prompt, n: 1, size: size || '1024x1024' };
    if (images.length) bodyObj.image = images;
    options = {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj),
    };
  }

  const res = await fetch(endpoint, options);
  const text = await res.text();
  if (!res.ok) throw new Error(`API ${res.status}: ${text.slice(0, 300)}`);

  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error('返回不是 JSON: ' + text.slice(0, 200));
  }

  const item = (json.data && json.data[0]) || json;
  if (item.url) {
    const img = await fetch(item.url);
    return Buffer.from(await img.arrayBuffer());
  }
  if (item.b64_json) return Buffer.from(item.b64_json, 'base64');
  throw new Error('返回中没有图片数据：' + text.slice(0, 200));
}

/* ---------------- 任务包落盘（无 Key 时的代跑通道） ---------------- */
function writeTask(payload) {
  const id = `${Date.now()}_${safeName(payload.tag || payload.mode)}`;
  const task = {
    id,
    createdAt: new Date().toISOString(),
    mode: payload.mode,
    productName: payload.productName || '',
    prompt: payload.prompt,
    englishPrompt: payload.englishPrompt || '',
    refs: payload.refs || [],
    size: payload.size || '1024x1024',
    palette: payload.palette || [],
    layout: payload.layout || '',
    dimensions: payload.dimensions || '',
    status: 'pending',
  };
  fs.writeFileSync(path.join(TASK_DIR, `${id}.json`), JSON.stringify(task, null, 2), 'utf8');
  return task;
}

/* ---------------- 路由 ---------------- */
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' });
    return res.end();
  }

  // 配置
  if (pathname === '/api/config' && req.method === 'GET') {
    const cfg = readConfig();
    return send(res, 200, { ...cfg, apiKey: cfg.apiKey ? '••••••' + cfg.apiKey.slice(-4) : '', hasKey: !!cfg.apiKey });
  }
  if (pathname === '/api/config' && req.method === 'POST') {
    const b = await body(req);
    const cur = readConfig();
    const next = { ...cur, ...b };
    if (b.apiKey && b.apiKey.startsWith('••')) next.apiKey = cur.apiKey; // 未改动
    writeConfig(next);
    return send(res, 200, { ok: true });
  }

  // 生成设计图
  if (pathname === '/api/generate' && req.method === 'POST') {
    const b = await body(req);
    const cfg = readConfig();

    if (!cfg.apiKey) {
      const task = writeTask(b);
      return send(res, 200, { ok: false, needConfig: true, task, hint: '未配置 API Key，已生成任务包。可填入 Key 后重跑，或把任务包交给 AI 助手代跑。' });
    }

    try {
      const buf = await callImageAPI(cfg, b);
      const file = `${Date.now()}_${safeName(b.mode)}_${safeName(b.productName)}.png`;
      fs.writeFileSync(path.join(OUT_DIR, file), buf);
      return send(res, 200, { ok: true, file: `outputs/${file}`, url: `/outputs/${file}` });
    } catch (e) {
      const task = writeTask(b);
      return send(res, 200, { ok: false, error: String(e.message || e), task, hint: '调用失败，已保存任务包备用。' });
    }
  }

  // 历史产出
  if (pathname === '/api/outputs' && req.method === 'GET') {
    const files = fs.existsSync(OUT_DIR)
      ? fs.readdirSync(OUT_DIR).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f)).sort().reverse().map((f) => `outputs/${f}`)
      : [];
    return send(res, 200, { files });
  }

  // 任务列表
  if (pathname === '/api/tasks' && req.method === 'GET') {
    const files = fs.existsSync(TASK_DIR) ? fs.readdirSync(TASK_DIR).filter((f) => f.endsWith('.json')).sort().reverse() : [];
    return send(res, 200, { tasks: files.map((f) => `tasks/${f}`) });
  }

  // 静态文件
  let filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(ROOT)) return send(res, 403, { error: 'forbidden' });
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, { error: 'not found' });
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  纹缬 PackAgent 本地服务已启动');
  console.log(`  → http://127.0.0.1:${PORT}`);
  console.log(`  配置：${CONFIG_FILE}`);
  console.log(`  产出：${OUT_DIR}`);
  console.log('');
});
