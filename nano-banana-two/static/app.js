/* ─────────────────────────────────────────────────────────
   MOKSHA AI · Nano Banana 2 Studio
   Frontend state + API integration
───────────────────────────────────────────────────────── */

// ── State ──────────────────────────────────────────────────
const S = {
  aspectRatio:  'auto',
  resolution:   '1K',
  numImages:    1,
  outputFormat: 'png',
  useWebSearch: false,
  refImages:    [],   // [{data: base64, mimeType, previewUrl, name}]
  model:        'nb2',
  generating:   false,

  // Lightbox navigation
  lbList:  [],        // [{src, filename, meta}]
  lbIdx:   0,
  lbOpen:  false,
};

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkStatus();
  setupDragDrop();
  setupKeyboard();
  loadLibraryCount();
});

async function checkStatus() {
  try {
    const r    = await fetch('/status');
    const data = await r.json();

    const tag = document.getElementById('modelTag');
    if (tag && data.model) tag.textContent = data.model;

    if (!data.api_key_set) {
      document.getElementById('apiBanner').style.display = 'block';
    }
  } catch (_) { /* server not ready yet */ }
}

// ── Prompt ─────────────────────────────────────────────────
function clearPrompt() {
  document.getElementById('prompt').value = '';
  document.getElementById('prompt').focus();
}

// ── Aspect Ratio ───────────────────────────────────────────
function setAspect(ratio, btn) {
  S.aspectRatio = ratio;
  document.querySelectorAll('.aspect-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── Generic pill group ─────────────────────────────────────
function setPill(type, value, btn) {
  if (type === 'res')   S.resolution   = value;
  if (type === 'fmt')   S.outputFormat = value;
  if (type === 'model') S.model        = value;
  btn.parentElement.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
}

// ── Image count ────────────────────────────────────────────
function adjustImages(delta) {
  S.numImages = Math.max(1, Math.min(8, S.numImages + delta));
  document.getElementById('imgCount').textContent = S.numImages;
}

// ── Seed ───────────────────────────────────────────────────
function randomSeed() {
  const s = Math.floor(Math.random() * 2147483647);
  document.getElementById('seed').value = s;
}

// ── Web search toggle ──────────────────────────────────────
function toggleSearch() {
  S.useWebSearch = !S.useWebSearch;
  document.getElementById('searchToggle').classList.toggle('on', S.useWebSearch);
}

// ── Reference images (multi) ────────────────────────────────
const MAX_REF = 8;
const MAX_PX  = 1280;

function setupDragDrop() {
  const zone  = document.getElementById('dropZone');
  const input = document.getElementById('fileInput');

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    // Library image drag-in
    const libUrl = e.dataTransfer.getData('application/x-moksha-lib');
    if (libUrl) { fetchUrlAsRef(libUrl); return; }
    loadRefFiles(Array.from(e.dataTransfer.files));
  });
  input.addEventListener('change', e => {
    loadRefFiles(Array.from(e.target.files));
    input.value = ''; // reset so same file can be re-added after removal
  });
}

function loadRefFiles(files) {
  const remaining = MAX_REF - S.refImages.length;
  if (remaining <= 0) return;
  files = files.filter(f => f.type.startsWith('image/')).slice(0, remaining);
  files.forEach(f => loadOneRef(f));
}

function loadOneRef(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > MAX_PX || h > MAX_PX) {
        const scale = MAX_PX / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const mime       = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const previewUrl = canvas.toDataURL(mime);
      const b64        = previewUrl.split(',')[1];
      const id         = Date.now() + '_' + Math.random();

      S.refImages.push({ id, data: b64, mimeType: mime, previewUrl, name: file.name });
      renderRefThumbs();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function removeRef(id) {
  S.refImages = S.refImages.filter(r => r.id !== id);
  renderRefThumbs();
}

async function fetchUrlAsRef(url) {
  try {
    const blob = await (await fetch(url)).blob();
    loadOneRef(new File([blob], url.split('/').pop(), { type: blob.type }));
  } catch (e) { console.warn('Could not load library image as reference:', e); }
}

function clearRef() {
  S.refImages = [];
  renderRefThumbs();
}

function renderRefThumbs() {
  const thumbsEl    = document.getElementById('refThumbs');
  const clearBtn    = document.getElementById('clearRefBtn');
  const dropContent = document.getElementById('dropContent');

  if (S.refImages.length === 0) {
    thumbsEl.style.display  = 'none';
    clearBtn.style.display  = 'none';
    if (dropContent) dropContent.style.display = 'flex';
    return;
  }

  if (dropContent) dropContent.style.display = S.refImages.length >= MAX_REF ? 'none' : 'flex';
  thumbsEl.style.display = 'flex';
  clearBtn.style.display = 'block';

  thumbsEl.innerHTML = S.refImages.map(r => `
    <div class="ref-thumb">
      <img src="${r.previewUrl}" alt="${r.name}" title="${r.name}">
      <button class="ref-thumb-remove" onclick="removeRef('${r.id}')" title="Remove">✕</button>
    </div>
  `).join('');
}

// ── Status bar ─────────────────────────────────────────────
function showStatus(type, html) {
  const bar = document.getElementById('statusBar');
  bar.className = `status-bar ${type}`;
  bar.innerHTML = type === 'loading'
    ? `<div class="spinner"></div>${html}`
    : html;
  bar.style.display = 'flex';
}
function hideStatus() {
  document.getElementById('statusBar').style.display = 'none';
}

// ── Tab switching ──────────────────────────────────────────
function switchTab(tab) {
  const isLib = tab === 'library';
  document.getElementById('generateView').style.display = isLib ? 'none' : 'flex';
  document.getElementById('libraryView').style.display  = isLib ? 'block' : 'none';
  document.getElementById('tabGenerate').classList.toggle('active', !isLib);
  document.getElementById('tabLibrary').classList.toggle('active',  isLib);
  if (isLib) loadLibrary();
}

// ── Library ────────────────────────────────────────────────
async function loadLibraryCount() {
  try {
    const r       = await fetch('/gallery');
    const entries = await r.json();
    updateLibBadge(entries.length);
  } catch (_) {}
}

function updateLibBadge(count) {
  const badge = document.getElementById('libCount');
  if (!badge) return;
  badge.textContent    = count;
  badge.style.display  = count > 0 ? 'inline-block' : 'none';
}

async function loadLibrary() {
  const grid = document.getElementById('libraryGrid');
  grid.innerHTML = '<div class="lib-loading">Loading library…</div>';

  try {
    const r       = await fetch('/gallery');
    const entries = await r.json();
    updateLibBadge(entries.length);

    if (entries.length === 0) {
      grid.innerHTML = `
        <div class="lib-empty">
          <div class="empty-glyph">◈</div>
          <div>No images yet — generate something!</div>
        </div>`;
      return;
    }

    // Build the list for lightbox navigation
    const lbList = entries.map(e => ({
      src:      `/outputs/${e.filename}`,
      filename: e.filename,
      meta:     `${e.resolution || ''} · ${e.aspectRatio || ''} · ${(e.outputFormat || 'png').toUpperCase()}`,
    }));

    grid.innerHTML = entries.map((e, i) => {
      const d       = new Date(e.timestamp);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const prompt  = (e.prompt || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const snippet = prompt.length > 90 ? prompt.substring(0, 90) + '…' : prompt;
      const meta    = `${e.resolution || ''} · ${e.aspectRatio || ''}`;
      return `
        <div class="lib-card" data-idx="${i}">
          <img src="/outputs/${e.filename}" alt="Generated image" loading="lazy">
          <div class="lib-card-info">
            <div class="lib-prompt">${snippet || '<em style="opacity:.5">no prompt</em>'}</div>
            <div class="lib-meta">${dateStr} · ${timeStr}${meta ? ' · ' + meta : ''}</div>
          </div>
        </div>`;
    }).join('');

    // Attach click handlers with the full list for nav
    grid.querySelectorAll('.lib-card').forEach(card => {
      const imgSrc = card.querySelector('img').src;
      card.draggable = true;
      card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('application/x-moksha-lib', imgSrc);
        e.dataTransfer.effectAllowed = 'copy';
      });
      card.addEventListener('click', () => {
        openLightboxAt(lbList, parseInt(card.dataset.idx, 10));
      });
    });

  } catch (err) {
    grid.innerHTML = `<div class="lib-empty">Error loading library: ${err.message}</div>`;
  }
}

// ── Generate ───────────────────────────────────────────────
async function generate() {
  const prompt = document.getElementById('prompt').value.trim();
  if (!prompt) {
    showStatus('error', '⚠ Please enter a prompt');
    setTimeout(hideStatus, 3000);
    return;
  }

  const batchId  = 'batch_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  const count    = S.numImages;
  const meta     = `${S.resolution} · ${S.aspectRatio} · ${S.outputFormat.toUpperCase()}`;
  const seed     = document.getElementById('seed').value;

  // Insert placeholder at top of gallery
  const gallery  = document.getElementById('gallery');
  const empty    = gallery.querySelector('.empty-state');
  if (empty) empty.remove();

  const placeholder = document.createElement('div');
  placeholder.id        = batchId;
  placeholder.className = 'batch-placeholder';
  placeholder.innerHTML = `
    <div class="gen-header">
      <span class="gen-count gen-pending">
        <span class="spinner-dot"></span>
        Generating ${count === 1 ? '1 image' : count + ' images'}…
      </span>
      <span class="gen-meta">${meta}</span>
    </div>
    <div class="img-grid">
      ${'<div class="img-card-skeleton"></div>'.repeat(count)}
    </div>`;
  gallery.prepend(placeholder);

  try {
    const resp = await fetch('/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        prompt,
        aspectRatio:     S.aspectRatio,
        resolution:      S.resolution,
        numImages:       count,
        seed:            seed ? Number(seed) : null,
        outputFormat:    S.outputFormat,
        useWebSearch:    S.useWebSearch,
        referenceImages: S.refImages.map(r => ({ data: r.data, mimeType: r.mimeType })),
        model:           S.model,
      }),
    });

    const data = await resp.json();
    if (!resp.ok || data.error) throw new Error(data.error || `Server error ${resp.status}`);
    if (!data.images?.length)   throw new Error('No images returned. Try adjusting your prompt.');

    // Swap placeholder for real images
    const el = document.getElementById(batchId);
    if (el) el.replaceWith(buildBatchEl(batchId, data.images, meta));
    loadLibraryCount();

  } catch (err) {
    const el = document.getElementById(batchId);
    if (el) el.innerHTML = `
      <div class="gen-header">
        <span class="gen-count gen-error">✕ ${err.message}</span>
        <span class="gen-meta">${meta}</span>
      </div>`;
  }
}

// ── Build a completed batch element ────────────────────────
function buildBatchEl(batchId, images, meta) {
  const lbList = images.map((img, i) => {
    const mime = img.mimeType || 'image/png';
    const ext  = mime.split('/')[1] || 'png';
    return {
      src:      `data:${mime};base64,${img.data}`,
      filename: `moksha_nb2_${Date.now()}_${i + 1}.${ext}`,
      meta:     `${meta} · #${i + 1}`,
    };
  });

  const wrap = document.createElement('div');
  wrap.id    = batchId;

  const header = document.createElement('div');
  header.className = 'gen-header';
  header.innerHTML = `
    <span class="gen-count">${images.length} image${images.length > 1 ? 's' : ''}</span>
    <span class="gen-meta">${meta}</span>`;

  const grid = document.createElement('div');
  grid.className = 'img-grid';

  images.forEach((img, i) => {
    const { src, filename } = lbList[i];
    const card = document.createElement('div');
    card.className = 'img-card';
    card.innerHTML = `
      <img src="${src}" alt="Generated ${i + 1}" loading="lazy">
      <div class="img-card-footer">
        <span class="img-meta">#${i + 1} · ${S.resolution}</span>
        <button class="dl-btn" onclick="event.stopPropagation(); downloadImage('${src}','${filename}')">↓ Save</button>
      </div>`;
    card.draggable = true;
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('application/x-moksha-lib', src);
      e.dataTransfer.effectAllowed = 'copy';
    });
    card.addEventListener('click', () => openLightboxAt(lbList, i));
    grid.appendChild(card);
  });

  wrap.appendChild(header);
  wrap.appendChild(grid);
  return wrap;
}

// ── Download ───────────────────────────────────────────────
function downloadImage(src, filename) {
  const a = document.createElement('a');
  a.href     = src;
  a.download = filename;
  a.click();
}

// ── Lightbox ───────────────────────────────────────────────
function openLightboxAt(list, idx) {
  S.lbList = list;
  S.lbIdx  = Math.max(0, Math.min(idx, list.length - 1));
  S.lbOpen = true;
  _renderLbItem();
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function _renderLbItem() {
  const item = S.lbList[S.lbIdx];
  if (!item) return;

  document.getElementById('lightboxImg').src = item.src;
  document.getElementById('lightboxMeta').textContent = item.meta || '';
  document.getElementById('lightboxDl').onclick = e => {
    e.stopPropagation();
    downloadImage(item.src, item.filename);
  };

  // Position counter
  const pos = document.getElementById('lbPos');
  if (pos) pos.textContent = S.lbList.length > 1 ? `${S.lbIdx + 1} / ${S.lbList.length}` : '';

  // Prev/next visibility
  const prevBtn = document.getElementById('lbPrev');
  const nextBtn = document.getElementById('lbNext');
  if (prevBtn) {
    prevBtn.style.display    = S.lbList.length > 1 ? 'flex' : 'none';
    prevBtn.style.visibility = S.lbIdx > 0 ? 'visible' : 'hidden';
  }
  if (nextBtn) {
    nextBtn.style.display    = S.lbList.length > 1 ? 'flex' : 'none';
    nextBtn.style.visibility = S.lbIdx < S.lbList.length - 1 ? 'visible' : 'hidden';
  }
}

function lbNav(dir) {
  const newIdx = S.lbIdx + dir;
  if (newIdx < 0 || newIdx >= S.lbList.length) return;
  S.lbIdx = newIdx;
  _renderLbItem();
}

function closeLightbox(e) {
  if (e && e.target !== document.getElementById('lightbox') &&
      !e.target.classList.contains('lb-close')) return;
  S.lbOpen = false;
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

// ── Keyboard shortcuts ─────────────────────────────────────
function setupKeyboard() {
  document.addEventListener('keydown', e => {
    // ⌘/Ctrl + Enter → Generate
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      generate();
      return;
    }

    // Lightbox navigation
    if (!S.lbOpen) return;
    if (e.key === 'ArrowLeft')  { e.preventDefault(); lbNav(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); lbNav(1);  }
    if (e.key === 'Escape') {
      S.lbOpen = false;
      document.getElementById('lightbox').classList.remove('open');
      document.body.style.overflow = '';
    }
  });
}
