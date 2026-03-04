/* ─────────────────────────────────────────────────────────
   Kling Video Creator
   Frontend state + FAL.ai video generation
───────────────────────────────────────────────────────── */

// ── State ──────────────────────────────────────────────────
const S = {
  aspectRatio:     '16:9',
  duration:        '5',
  generateAudio:   true,
  cfgScale:        0.5,

  startImageFile:  null,   // File object
  startImageFalUrl: null,  // URL returned after FAL upload

  endImageFile:    null,
  endImageFalUrl:  null,

  // Reference elements: each { frontalFile, frontalFalUrl, refFiles:[3], refFalUrls:[3] }
  refElements:     [],

  generating:      false,

  // Video modal
  modalSrc:     null,
  modalFile:    null,
  modalMeta:    null,
};

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkStatus();
  setupDragDrop('startZone', 'startInput', 'start');
  setupDragDrop('endZone',   'endInput',   'end');
  setupKeyboard();
  loadLibraryCount();
  initSlider();
});

// ── API Status ─────────────────────────────────────────────
async function checkStatus() {
  try {
    const r    = await fetch('/status');
    const data = await r.json();
    const tag  = document.getElementById('modelTag');
    if (tag && data.model) tag.textContent = data.model;
    if (!data.api_key_set) {
      document.getElementById('apiBanner').style.display = 'block';
    }
  } catch (_) {}
}

// ── Prompt ─────────────────────────────────────────────────
function clearPrompt() {
  document.getElementById('prompt').value = '';
  document.getElementById('prompt').focus();
}

// ── Aspect Ratio ───────────────────────────────────────────
function setAspect(ratio, btn) {
  S.aspectRatio = ratio;
  document.querySelectorAll('[data-ratio]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── Duration ───────────────────────────────────────────────
function updateDuration(val) {
  S.duration = val;
  document.getElementById('durVal').textContent = val + 's';
}

// ── Audio toggle ───────────────────────────────────────────
function toggleAudio() {
  S.generateAudio = !S.generateAudio;
  document.getElementById('audioToggle').classList.toggle('on', S.generateAudio);
}

// ── CFG Slider ─────────────────────────────────────────────
function initSlider() {
  updateCfg(0.5);
}

function updateCfg(val) {
  S.cfgScale = parseFloat(val);
  document.getElementById('cfgVal').textContent = S.cfgScale.toFixed(2);
  // Update slider gradient fill
  const slider = document.getElementById('cfgSlider');
  if (slider) {
    const pct = (S.cfgScale * 100).toFixed(1) + '%';
    slider.style.background =
      `linear-gradient(to right, var(--gold-3) 0%, var(--gold-3) ${pct}, var(--border-mid) ${pct}, var(--border-mid) 100%)`;
  }
}

// ── Image Upload Zones ─────────────────────────────────────
function triggerUpload(slot) {
  document.getElementById(slot + 'Input').click();
}

function onFileSelect(e, slot) {
  const file = e.target.files[0];
  if (!file) return;
  setSlotFile(slot, file);
  // Reset input so same file can be re-selected after replace
  e.target.value = '';
}

function setSlotFile(slot, file) {
  if (slot === 'start') {
    S.startImageFile   = file;
    S.startImageFalUrl = null; // invalidate cached URL
  } else {
    S.endImageFile   = file;
    S.endImageFalUrl = null;
    document.getElementById('clearEndBtn').style.display = 'inline-block';
  }
  showUploadPreview(slot, file);
}

function showUploadPreview(slot, file) {
  const idle    = document.getElementById(slot + 'Idle');
  const preview = document.getElementById(slot + 'Preview');
  const thumb   = document.getElementById(slot + 'Thumb');
  const fname   = document.getElementById(slot + 'Fname');
  const fsize   = document.getElementById(slot + 'Fsize');

  idle.style.display = 'none';
  preview.classList.add('visible');

  const url = URL.createObjectURL(file);
  thumb.src = url;
  fname.textContent = file.name;
  fsize.textContent = formatBytes(file.size);
}

function clearEndImage() {
  S.endImageFile   = null;
  S.endImageFalUrl = null;

  const idle    = document.getElementById('endIdle');
  const preview = document.getElementById('endPreview');
  const thumb   = document.getElementById('endThumb');

  preview.classList.remove('visible');
  idle.style.display = 'flex';
  thumb.src = '';
  document.getElementById('clearEndBtn').style.display = 'none';
}

// ── Reference Elements ─────────────────────────────────────
function addRefElement() {
  if (S.refElements.length >= 3) return;
  S.refElements.push({
    frontalFile: null, frontalFalUrl: null,
    refFiles: [null, null, null], refFalUrls: [null, null, null],
  });
  renderRefElements();
}

function removeRefElement(idx) {
  S.refElements.splice(idx, 1);
  renderRefElements();
}

function renderRefElements() {
  const list   = document.getElementById('refElementsList');
  const addBtn = document.getElementById('addRefElemBtn');
  if (!list) return;

  list.innerHTML = S.refElements.map((elem, i) => `
    <div class="ref-elem-card">
      <div class="ref-elem-hdr">
        <span class="ref-elem-title">Element ${i + 1}</span>
        <button class="ghost-btn" onclick="removeRefElement(${i})">✕ Remove</button>
      </div>
      <div class="ctrl-subgroup">
        <div class="ctrl-sublabel">Frontal Image</div>
        <div class="upload-zone compact" onclick="triggerRefFrontal(${i})">
          <input type="file" id="refFrontalInput_${i}"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            style="display:none" onchange="onRefFrontalSelect(event,${i})">
          <div class="upload-idle"${elem.frontalFile ? ' style="display:none"' : ''}>
            <div class="upload-icon" style="font-size:16px">⬡</div>
            <div class="upload-text" style="font-size:11px">Drop or
              <button class="link-btn" onclick="event.stopPropagation();triggerRefFrontal(${i})">browse</button>
            </div>
          </div>
          <div class="upload-preview-wrap${elem.frontalFile ? ' visible' : ''}">
            <img class="upload-thumb" src="${elem.frontalFile ? URL.createObjectURL(elem.frontalFile) : ''}" alt="">
            <div class="upload-info">
              <div class="upload-fname">${elem.frontalFile ? elem.frontalFile.name : ''}</div>
              <div class="upload-fsize">${elem.frontalFile ? formatBytes(elem.frontalFile.size) : ''}</div>
            </div>
            <button class="upload-replace" onclick="event.stopPropagation();triggerRefFrontal(${i})">Replace</button>
          </div>
        </div>
      </div>
      <div class="ctrl-subgroup">
        <div class="ctrl-sublabel">Reference Images <span style="font-weight:400;opacity:.5">(up to 3)</span></div>
        <div class="ref-images-row">
          ${[0, 1, 2].map(j => `
            <div class="ref-img-slot" onclick="triggerRefImage(${i},${j})">
              <input type="file" id="refImgInput_${i}_${j}"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                style="display:none" onchange="onRefImageSelect(event,${i},${j})">
              ${elem.refFiles[j]
                ? `<img src="${URL.createObjectURL(elem.refFiles[j])}" alt="">
                   <button class="slot-remove" onclick="event.stopPropagation();clearRefImage(${i},${j})">✕</button>`
                : '<span class="slot-plus">+</span>'}
            </div>`).join('')}
        </div>
      </div>
    </div>`).join('');

  if (addBtn) {
    addBtn.disabled    = S.refElements.length >= 3;
    addBtn.textContent = S.refElements.length >= 3 ? '+ Add Element (max 3)' : '+ Add Element';
  }
}

function triggerRefFrontal(idx) {
  document.getElementById('refFrontalInput_' + idx).click();
}

function onRefFrontalSelect(e, idx) {
  const file = e.target.files[0];
  if (!file) return;
  S.refElements[idx].frontalFile   = file;
  S.refElements[idx].frontalFalUrl = null;
  e.target.value = '';
  renderRefElements();
}

function triggerRefImage(elemIdx, imgIdx) {
  document.getElementById('refImgInput_' + elemIdx + '_' + imgIdx).click();
}

function onRefImageSelect(e, elemIdx, imgIdx) {
  const file = e.target.files[0];
  if (!file) return;
  S.refElements[elemIdx].refFiles[imgIdx]   = file;
  S.refElements[elemIdx].refFalUrls[imgIdx] = null;
  e.target.value = '';
  renderRefElements();
}

function clearRefImage(elemIdx, imgIdx) {
  S.refElements[elemIdx].refFiles[imgIdx]   = null;
  S.refElements[elemIdx].refFalUrls[imgIdx] = null;
  renderRefElements();
}

function formatBytes(bytes) {
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1024*1024)  return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1024/1024).toFixed(1) + ' MB';
}

// ── Drag and Drop ──────────────────────────────────────────
function setupDragDrop(zoneId, inputId, slot) {
  const zone  = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  if (!zone || !input) return;

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setSlotFile(slot, file);
    }
  });
}

// ── Upload image to server → FAL CDN ──────────────────────
async function uploadToFal(file) {
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch('/upload', { method: 'POST', body: fd });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Upload failed');
  return d.url; // FAL CDN URL
}

// ── Status bar ─────────────────────────────────────────────
let timerInterval = null;

function showStatus(type, html, startTimer = false) {
  clearTimerInterval();
  const bar = document.getElementById('statusBar');
  bar.className = `status-bar ${type}`;

  if (startTimer) {
    let elapsed = 0;
    const timerSpan = `<span id="statusTimer" class="status-timer">0s</span>`;
    bar.innerHTML = type === 'loading'
      ? `<div class="spinner"></div>${html}${timerSpan}`
      : html;
    timerInterval = setInterval(() => {
      elapsed++;
      const el = document.getElementById('statusTimer');
      if (el) el.textContent = elapsed + 's';
    }, 1000);
  } else {
    bar.innerHTML = type === 'loading'
      ? `<div class="spinner"></div>${html}`
      : html;
  }

  bar.style.display = 'flex';
}

function hideStatus() {
  clearTimerInterval();
  document.getElementById('statusBar').style.display = 'none';
}

function clearTimerInterval() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

// ── Tab switching ──────────────────────────────────────────
function switchTab(tab) {
  const isLib = tab === 'library';
  document.getElementById('generateView').style.display = isLib ? 'none' : 'flex';
  document.getElementById('libraryView').style.display  = isLib ? 'block' : 'none';
  document.getElementById('tabGenerate').classList.toggle('active', !isLib);
  document.getElementById('tabLibrary').classList.toggle('active', isLib);
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
  badge.textContent   = count;
  badge.style.display = count > 0 ? 'inline-block' : 'none';
}

async function loadLibrary() {
  const grid = document.getElementById('libraryGrid');
  grid.innerHTML = '<div class="lib-loading">Loading library…</div>';

  try {
    const r       = await fetch('/gallery');
    const entries = await r.json();
    updateLibBadge(entries.length);

    if (!entries.length) {
      grid.innerHTML = `
        <div class="lib-empty">
          <div class="empty-glyph">◈</div>
          <div style="font-family:var(--font-brand);font-size:22px;font-style:italic;color:var(--text-2)">No videos yet</div>
          <div>Render something to fill your library.</div>
        </div>`;
      return;
    }

    grid.innerHTML = entries.map((e, i) => {
      const d       = new Date(e.timestamp);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const prompt  = (e.prompt || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const snippet = prompt.length > 80 ? prompt.slice(0, 80) + '…' : prompt;
      const ratioClass = ratioToCssClass(e.aspect_ratio);
      const meta    = `${e.aspect_ratio || ''} · ${e.duration || ''}s`;
      return `
        <div class="lib-card ${ratioClass}" data-idx="${i}"
             data-src="/outputs/${e.filename}"
             data-filename="${e.filename}"
             data-meta="${meta}"
             data-duration="${e.duration || ''}">
          <video src="/outputs/${e.filename}" muted preload="metadata" loop></video>
          <div class="lib-card-info">
            <div class="lib-prompt">${snippet || '<em style="opacity:.5">no prompt</em>'}</div>
            <div class="lib-meta">${dateStr} · ${timeStr}${meta ? ' · ' + meta : ''}</div>
          </div>
        </div>`;
    }).join('');

    // Hover to play + click to open modal
    grid.querySelectorAll('.lib-card').forEach(card => {
      const video = card.querySelector('video');
      card.addEventListener('mouseenter', () => video && video.play().catch(() => {}));
      card.addEventListener('mouseleave', () => { if (video) { video.pause(); video.currentTime = 0; } });
      card.addEventListener('click', () => {
        openVideoModal(
          card.dataset.src,
          card.dataset.filename,
          card.dataset.meta,
          card.dataset.duration,
        );
      });
    });

  } catch (err) {
    grid.innerHTML = `<div class="lib-empty">Error loading library: ${err.message}</div>`;
  }
}

function ratioToCssClass(ratio) {
  if (!ratio) return '';
  if (ratio === '9:16') return 'ratio-9-16';
  if (ratio === '1:1')  return 'ratio-1-1';
  return '';
}

// ── Generate ───────────────────────────────────────────────
async function generate() {
  if (S.generating) return;

  const prompt = document.getElementById('prompt').value.trim();

  if (!S.startImageFile) {
    showStatus('error', '⚠ Please upload a start frame image');
    setTimeout(hideStatus, 3500);
    return;
  }

  if (!prompt) {
    showStatus('error', '⚠ Please enter a prompt describing the motion');
    setTimeout(hideStatus, 3500);
    return;
  }

  S.generating = true;
  const btn   = document.getElementById('generateBtn');
  const label = document.getElementById('generateLabel');
  btn.disabled = true;
  label.textContent = 'Rendering…';

  const duration    = S.duration;
  const negPrompt   = document.getElementById('negativePrompt').value.trim()
                      || 'blur, distort, and low quality';
  const meta        = `${S.aspectRatio} · ${duration}s`;
  const ratioClass  = ratioToCssClass(S.aspectRatio);

  // Insert skeleton placeholder
  const gallery   = document.getElementById('gallery');
  const empty     = gallery.querySelector('.empty-state');
  if (empty) empty.remove();

  const batchId   = 'batch_' + Date.now();
  const skeleton  = document.createElement('div');
  skeleton.id     = batchId;
  skeleton.innerHTML = `
    <div class="gen-header">
      <span class="gen-count gen-pending">
        <span class="spinner-dot"></span>
        Rendering your scene…
      </span>
      <span class="gen-meta">${meta}</span>
    </div>
    <div class="video-grid">
      <div class="video-card-skeleton ${ratioClass}"></div>
    </div>`;
  gallery.prepend(skeleton);

  showStatus('loading', 'Rendering your scene with Kling V3 Pro…', true);

  try {
    // Upload start image to FAL if not already done
    if (!S.startImageFalUrl) {
      showStatus('loading', 'Uploading start frame to FAL…', true);
      S.startImageFalUrl = await uploadToFal(S.startImageFile);
    }

    // Upload end image if provided
    if (S.endImageFile && !S.endImageFalUrl) {
      showStatus('loading', 'Uploading end frame to FAL…', true);
      S.endImageFalUrl = await uploadToFal(S.endImageFile);
    }

    // Upload reference element images
    for (let i = 0; i < S.refElements.length; i++) {
      const elem = S.refElements[i];
      if (elem.frontalFile && !elem.frontalFalUrl) {
        showStatus('loading', `Uploading Element ${i+1} frontal image…`, true);
        elem.frontalFalUrl = await uploadToFal(elem.frontalFile);
      }
      for (let j = 0; j < 3; j++) {
        if (elem.refFiles[j] && !elem.refFalUrls[j]) {
          showStatus('loading', `Uploading Element ${i+1} reference ${j+1}…`, true);
          elem.refFalUrls[j] = await uploadToFal(elem.refFiles[j]);
        }
      }
    }

    showStatus('loading', 'Rendering your scene — this may take a minute…', true);

    // Build elements array (only elements with a frontal image)
    const elements = S.refElements
      .filter(e => e.frontalFalUrl)
      .map(e => ({
        image_url: e.frontalFalUrl,
        reference_image_urls: e.refFalUrls.filter(Boolean),
      }));

    const payload = {
      start_image_url: S.startImageFalUrl,
      end_image_url:   S.endImageFalUrl || null,
      prompt,
      duration,
      aspect_ratio:    S.aspectRatio,
      negative_prompt: negPrompt,
      cfg_scale:       S.cfgScale,
      generate_audio:  S.generateAudio,
      elements:        elements.length > 0 ? elements : undefined,
    };

    const resp = await fetch('/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    const data = await resp.json();
    if (!resp.ok || data.error) throw new Error(data.error || `Server error ${resp.status}`);

    // Replace skeleton with real video card
    const el = document.getElementById(batchId);
    if (el) el.replaceWith(buildVideoEl(batchId, data, meta, ratioClass));

    showStatus('success', `✓ Video rendered · ${meta}`);
    setTimeout(hideStatus, 4000);
    loadLibraryCount();

  } catch (err) {
    const el = document.getElementById(batchId);
    if (el) el.innerHTML = `
      <div class="gen-header">
        <span class="gen-count gen-error">✕ ${err.message}</span>
        <span class="gen-meta">${meta}</span>
      </div>`;
    showStatus('error', `✕ ${err.message}`);
    setTimeout(hideStatus, 6000);
  } finally {
    S.generating     = false;
    btn.disabled     = false;
    label.textContent = 'Render Scene';
  }
}

// ── Build a completed video element ────────────────────────
function buildVideoEl(batchId, data, meta, ratioClass) {
  const src      = data.video_url;
  const filename = data.filename || 'kling_video.mp4';
  const duration = data.duration || S.duration;

  const wrap     = document.createElement('div');
  wrap.id        = batchId;

  const header   = document.createElement('div');
  header.className = 'gen-header';
  header.innerHTML = `
    <span class="gen-count">Video rendered</span>
    <span class="gen-meta">${meta}</span>`;

  const grid     = document.createElement('div');
  grid.className = 'video-grid';

  const card     = document.createElement('div');
  card.className = `video-card ${ratioClass}`;

  const video    = document.createElement('video');
  video.src      = src;
  video.muted    = true;
  video.loop     = true;
  video.preload  = 'metadata';
  video.playsInline = true;

  const overlay  = document.createElement('div');
  overlay.className = 'video-play-overlay';

  const footer   = document.createElement('div');
  footer.className = 'video-card-footer';
  footer.innerHTML = `
    <span class="video-meta">${meta}</span>
    <button class="dl-btn" onclick="event.stopPropagation(); downloadVideo('${src}','${filename}')">↓ Save</button>`;

  card.appendChild(video);
  card.appendChild(overlay);
  card.appendChild(footer);

  // Hover to play
  card.addEventListener('mouseenter', () => {
    video.play().catch(() => {});
    card.classList.add('playing');
  });
  card.addEventListener('mouseleave', () => {
    video.pause();
    video.currentTime = 0;
    card.classList.remove('playing');
  });

  // Click to open modal
  card.addEventListener('click', () => {
    openVideoModal(src, filename, meta, duration);
  });

  grid.appendChild(card);
  wrap.appendChild(header);
  wrap.appendChild(grid);
  return wrap;
}

// ── Download ───────────────────────────────────────────────
function downloadVideo(src, filename) {
  const a = document.createElement('a');
  a.href     = src;
  a.download = filename;
  a.click();
}

// ── Video Modal ────────────────────────────────────────────
function openVideoModal(src, filename, meta, duration) {
  const modal = document.getElementById('videoModal');
  const video = document.getElementById('modalVideo');
  const vmMeta   = document.getElementById('vmMeta');
  const vmBadge  = document.getElementById('vmBadge');
  const vmDl     = document.getElementById('vmDl');

  video.src  = src;
  video.load();
  video.play().catch(() => {});

  vmMeta.textContent  = meta || '';
  vmBadge.textContent = duration ? duration + 's' : '';
  vmBadge.style.display = duration ? 'inline-block' : 'none';

  vmDl.onclick = e => {
    e.stopPropagation();
    downloadVideo(src, filename);
  };

  S.modalSrc  = src;
  S.modalFile = filename;
  S.modalMeta = meta;

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('videoModal') &&
      !e.target.classList.contains('vm-close')) return;

  const modal = document.getElementById('videoModal');
  const video = document.getElementById('modalVideo');
  video.pause();
  video.src = '';
  modal.classList.remove('open');
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
    // Escape → close modal
    if (e.key === 'Escape') {
      const modal = document.getElementById('videoModal');
      if (modal.classList.contains('open')) {
        const video = document.getElementById('modalVideo');
        video.pause();
        video.src = '';
        modal.classList.remove('open');
        document.body.style.overflow = '';
      }
    }
  });
}
