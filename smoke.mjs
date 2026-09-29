/* 冒烟测试：jsdom 加载线上页面，检查无 JS 报错、关键节点渲染正常 */
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const FILE = path.join(ROOT, 'index.html');
const url = pathToFileURL(FILE).href;

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push(String(e.message)));
vc.on('error', (...a) => errors.push(a.join(' ')));

const dom = await JSDOM.fromFile(FILE, {
  url,
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: vc,
});

await new Promise((r) => setTimeout(r, 2500));
const d = dom.window.document;

const q = (s) => d.querySelectorAll(s).length;
const report = {
  jsErrors: errors.length,
  errorSample: errors.slice(0, 3),
  chainSteps: q('.chain-step'),
  plans: q('.plan'),
  genBtns: q('[data-gen]'),
  refChips: q('.ref-chip'),
  previewSVG: q('.preview-box svg'),
  dbCards: q('.mat-card'),
  dbThumbs: q('.mat-thumb'),
  tagCards: q('.tag-card'),
  tagStatCells: q('.stat-cell'),
  cfgState: d.getElementById('cfgState')?.textContent,
  galleryItems: q('.gal-item'),
  caseCards: q('.case-card'),
};

// 模拟：点第一个「生成设计图」按钮（无 key → 应出现任务包）
const btn = d.querySelector('[data-gen]');
if (btn) btn.click();
await new Promise((r) => setTimeout(r, 1500));
report.afterGenClick = {
  fallbackBox: q('.gen-fallback'),
  taskPromptShown: (d.querySelector('.gen-fallback .prompt-box')?.textContent || '').slice(0, 60),
};

// 模拟：标注一张参考图为国风
const tagBtn = d.querySelector('.tag-btn.g');
if (tagBtn) tagBtn.click();
await new Promise((r) => setTimeout(r, 800));
report.afterTag = {
  statCells: q('.stat-cell'),
  taggedState: d.querySelector('.tag-state.g')?.textContent,
  refChips: q('.ref-chip'),
};

console.log(JSON.stringify(report, null, 2));
dom.window.close();
