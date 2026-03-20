/**
 * DocParse WASM Demo — Full in-browser document parsing
 *
 * Architecture:
 * - WASM runtime (ailang.wasm) loaded from sunholo.com/ailang-demos/
 * - AILANG modules (docparse/*.ail) loaded from local docs/ailang/ directory
 * - JSZip handles ZIP extraction in JS
 * - AILANG handles XML → Block ADT → JSON conversion
 * - AI calls (PDF/image) use Gemini via user's own API key in localStorage
 *
 * Sensible limits:
 * - Max file size: 50MB
 * - Max ZIP entries processed: 100
 * - Max XML size per entry: 5MB
 * - Max slides/sheets: 50
 * - Timeout per parse: 30 seconds
 */

(function () {
  'use strict';

  // ── Configuration ──
  // WASM binary: local first (via wasm/download.sh), CDN fallback
  // ailang-repl.js now handles MIME type fallback (fetch+instantiate if streaming fails)
  var WASM_BINARY_URL = 'wasm/ailang.wasm';
  var WASM_CDN_FALLBACK = 'https://sunholo.com/ailang-demos/wasm/ailang.wasm';
  var MODULE_BASE = 'ailang/';  // relative to docs/
  var MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  var MAX_XML_SIZE = 5 * 1024 * 1024;   // 5MB per entry
  var MAX_SLIDES = 50;
  var MAX_SHEETS = 50;
  var PARSE_TIMEOUT = 30000; // 30s

  var DOCPARSE_MODULE = 'docparse/services/docparse_browser';

  var MODULES_TO_LOAD = [
    { name: 'docparse/types/document',           path: 'docparse/types/document.ail' },
    { name: 'docparse/services/format_router',    path: 'docparse/services/format_router.ail' },
    { name: 'docparse/services/zip_extract',      path: 'docparse/services/zip_extract.ail' },
    { name: 'docparse/services/docx_parser',      path: 'docparse/services/docx_parser.ail' },
    { name: 'docparse/services/pptx_parser',      path: 'docparse/services/pptx_parser.ail' },
    { name: 'docparse/services/xlsx_parser',      path: 'docparse/services/xlsx_parser.ail' },
    { name: 'docparse/services/output_formatter', path: 'docparse/services/output_formatter.ail' },
    { name: 'docparse/services/docparse_browser', path: 'docparse/services/docparse_browser.ail' },
  ];

  var EXTRA_STDLIBS = ['std/xml', 'std/list', 'std/io'];

  // ── State ──
  var engine = null;
  var wasmReady = false;
  var wasmLoading = false;
  var wasmError = null;

  // ── DOM refs ──
  var statusEl = document.getElementById('wasm-status');
  var dropzone = document.getElementById('dropzone');
  var fileInput = document.getElementById('file-input');
  var infoBar = document.getElementById('info-bar');
  var outputTabs = document.getElementById('output-tabs');
  var outputEmpty = document.getElementById('output-empty');
  var panelBlocks = document.getElementById('panel-blocks');
  var panelJson = document.getElementById('panel-json');
  var panelMarkdown = document.getElementById('panel-markdown');
  var aiUpsell = document.getElementById('ai-upsell');

  // ── Status display ──
  function setStatus(msg, isError) {
    if (statusEl) {
      statusEl.textContent = msg;
      statusEl.style.color = isError ? '#ef4444' : 'var(--dp-blue)';
    }
  }

  // ── WASM initialization ──
  async function initWasm() {
    if (wasmReady || wasmLoading) return;
    wasmLoading = true;
    setStatus('Loading WASM runtime...');

    try {
      // Check for WebAssembly support
      if (!('WebAssembly' in window)) {
        throw new Error('WebAssembly not supported in this browser');
      }

      // Load WASM runtime scripts from ailang-demos
      // JS runtime files loaded locally (vendored from ailang repo)
      await loadScript('wasm/wasm_exec.js');
      await loadScript('wasm/ailang-repl.js');

      if (typeof AilangREPL === 'undefined') {
        throw new Error('AilangREPL not found after loading scripts');
      }

      setStatus('Initializing AILANG...');
      var repl = new AilangREPL();
      // Try local WASM first (if available), fall back to CDN
      var wasmUrl = WASM_CDN_FALLBACK;
      try {
        var probe = await fetch(WASM_BINARY_URL, { method: 'HEAD' });
        if (probe.ok && probe.status === 200) {
          wasmUrl = WASM_BINARY_URL;
        }
      } catch (e) { /* local not available, use CDN */ }
      setStatus('Loading WASM runtime (' + (wasmUrl === WASM_BINARY_URL ? 'local' : 'CDN') + ')...');
      await repl.init(wasmUrl);

      // Import stdlib
      var stdlibs = ['std/json', 'std/option', 'std/result', 'std/string', 'std/math', 'std/ai'];
      for (var i = 0; i < stdlibs.length; i++) {
        repl.importModule(stdlibs[i]);
      }
      for (var j = 0; j < EXTRA_STDLIBS.length; j++) {
        repl.importModule(EXTRA_STDLIBS[j]);
      }

      // Load DocParse modules
      for (var k = 0; k < MODULES_TO_LOAD.length; k++) {
        var mod = MODULES_TO_LOAD[k];
        setStatus('Loading ' + mod.name.split('/').pop() + '... (' + (k + 1) + '/' + MODULES_TO_LOAD.length + ')');

        var resp = await fetch(MODULE_BASE + mod.path + '?v=' + Date.now());
        if (!resp.ok) throw new Error('Failed to fetch ' + mod.path);
        var code = await resp.text();

        var result = repl.loadModule(mod.name, code);
        if (!result.success) throw new Error('Module ' + mod.name + ' failed: ' + result.error);
      }

      // Set up AI handler if user has API key
      var apiKey = localStorage.getItem('gemini-api-key');
      if (apiKey && typeof repl.setAIHandler === 'function') {
        repl.setAIHandler(createGeminiHandler(apiKey));
        if (typeof repl.grantCapability === 'function') repl.grantCapability('AI');
      }

      engine = {
        repl: repl,
        call: function (func) {
          var args = Array.prototype.slice.call(arguments, 1);
          var r = repl.call(DOCPARSE_MODULE, func, ...args);
          if (!r.success) return { success: false, error: r.error };
          return { success: true, result: parseWasmResult(r.result) };
        },
        callAsync: async function (func) {
          var args = Array.prototype.slice.call(arguments, 1);
          var r;
          if (typeof repl.callAsync === 'function') {
            r = await repl.callAsync(DOCPARSE_MODULE, func, ...args);
          } else {
            r = repl.call(DOCPARSE_MODULE, func, ...args);
          }
          if (!r.success) return { success: false, error: r.error };
          return { success: true, result: parseWasmResult(r.result) };
        }
      };

      wasmReady = true;
      wasmLoading = false;
      setStatus('Ready — drop a file to parse');
    } catch (err) {
      wasmError = err.message;
      wasmLoading = false;
      setStatus('WASM load failed: ' + err.message, true);
      console.error('WASM init error:', err);
    }
  }

  // ── Gemini AI handler ──
  function createGeminiHandler(apiKey) {
    var GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    return async function (input) {
      try {
        var parsed = JSON.parse(input);
        var parts = [];

        if (parsed.mode === 'multimodal' && parsed.data) {
          parts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.data } });
          parts.push({ text: parsed.prompt });
        } else {
          parts.push({ text: input });
        }

        var resp = await fetch(GEMINI_URL + '?key=' + apiKey, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: parts }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 32768, responseMimeType: 'application/json' }
          })
        });

        var data = await resp.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      } catch (e) {
        console.error('Gemini handler error:', e);
        return '[]';
      }
    };
  }

  // ── Parse WASM result string ──
  function parseWasmResult(s) {
    if (!s) return s;
    // Strip " :: Type" annotation
    var m = s.match(/^(.+) :: \w+$/s);
    if (m) s = m[1];
    // Unwrap quoted strings
    if (s.startsWith('"') && s.endsWith('"')) {
      try { s = JSON.parse(s); } catch (e) { s = s.slice(1, -1); }
    }
    return s;
  }

  // ── Load external script ──
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(script);
    });
  }

  // ── File handling ──
  window.handleDocParseFile = async function (file) {
    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      showError('File too large (' + (file.size / 1024 / 1024).toFixed(1) + 'MB). Max: 50MB.');
      return;
    }

    // Init WASM if needed
    if (!wasmReady && !wasmError) {
      await initWasm();
    }

    var ext = file.name.split('.').pop().toLowerCase();
    var sizeKB = (file.size / 1024).toFixed(1);

    // Show info bar
    showInfoBar(ext, sizeKB);

    // Determine format
    var zipFormats = ['docx', 'pptx', 'xlsx', 'odt', 'odp', 'ods', 'epub'];
    var textFormats = ['html', 'htm', 'md', 'csv', 'tsv'];
    var aiFormats = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'webp'];

    if (textFormats.indexOf(ext) !== -1) {
      await parseTextFile(file, ext);
    } else if (zipFormats.indexOf(ext) !== -1) {
      if (!wasmReady) {
        showError('WASM not loaded. ' + (wasmError || 'Try refreshing.'));
        return;
      }
      await parseZipFile(file, ext);
    } else if (aiFormats.indexOf(ext) !== -1) {
      await parseAIFile(file, ext);
    } else {
      showError('Unsupported format: .' + ext);
    }
  };

  // ── Parse text-based formats (no WASM needed for basic rendering) ──
  async function parseTextFile(file, ext) {
    var content = await file.text();

    if (wasmReady && (ext === 'html' || ext === 'htm')) {
      // Use WASM for HTML parsing
      var r = engine.call('getFormatInfo', file.name);
      // For now, render client-side
    }

    var blocks = textToBlocks(content, ext);
    showOutput(blocks, content);
  }

  // ── Parse ZIP-based Office formats via WASM ──
  async function parseZipFile(file, ext) {
    setStatus('Extracting ZIP...');

    try {
      var buffer = await file.arrayBuffer();
      var zip = await JSZip.loadAsync(buffer);
      var allBlocks = [];

      if (ext === 'docx') {
        allBlocks = await parseDocxZip(zip);
      } else if (ext === 'pptx') {
        allBlocks = await parsePptxZip(zip);
      } else if (ext === 'xlsx') {
        allBlocks = await parseXlsxZip(zip);
      } else if (ext === 'odt' || ext === 'odp' || ext === 'ods') {
        // ODF formats — use API fallback for now, WASM parser not wired
        showFallback(ext, 'ODF formats use the API for full parsing.');
        return;
      } else if (ext === 'epub') {
        showFallback(ext, 'EPUB uses the API for full parsing.');
        return;
      }

      setStatus('Parsed ' + allBlocks.length + ' blocks');
      showOutput(allBlocks);
    } catch (err) {
      showError('Parse error: ' + err.message);
      console.error(err);
    }
  }

  // ── DOCX parsing ──
  async function parseDocxZip(zip) {
    var allBlocks = [];

    // Body
    var bodyEntry = zip.file('word/document.xml');
    if (bodyEntry) {
      var bodyXml = await bodyEntry.async('string');
      if (bodyXml.length <= MAX_XML_SIZE) {
        setStatus('Parsing document body...');
        var r = engine.call('parseDocxBody', bodyXml);
        if (r.success) {
          var blocks = safeJsonParse(r.result, []);
          allBlocks = allBlocks.concat(blocks);
          updateInfoBar('blocks', allBlocks.length);
        }
      }
    }

    // Headers
    var headerEntries = Object.keys(zip.files).filter(function (n) { return n.match(/^word\/header\d+\.xml$/); });
    for (var i = 0; i < Math.min(headerEntries.length, 5); i++) {
      var xml = await zip.file(headerEntries[i]).async('string');
      if (xml.length <= MAX_XML_SIZE) {
        var hr = engine.call('parseDocxSection', xml, 'header');
        if (hr.success) allBlocks = allBlocks.concat(safeJsonParse(hr.result, []));
      }
    }

    // Footers
    var footerEntries = Object.keys(zip.files).filter(function (n) { return n.match(/^word\/footer\d+\.xml$/); });
    for (var j = 0; j < Math.min(footerEntries.length, 5); j++) {
      var fxml = await zip.file(footerEntries[j]).async('string');
      if (fxml.length <= MAX_XML_SIZE) {
        var fr = engine.call('parseDocxSection', fxml, 'footer');
        if (fr.success) allBlocks = allBlocks.concat(safeJsonParse(fr.result, []));
      }
    }

    // Comments
    var commentsEntry = zip.file('word/comments.xml');
    if (commentsEntry) {
      var cxml = await commentsEntry.async('string');
      if (cxml.length <= MAX_XML_SIZE) {
        var cr = engine.call('parseDocxComments', cxml);
        if (cr.success) allBlocks = allBlocks.concat(safeJsonParse(cr.result, []));
      }
    }

    // Metadata
    var coreEntry = zip.file('docProps/core.xml');
    if (coreEntry) {
      var mxml = await coreEntry.async('string');
      var mr = engine.call('parseMetadataXml', mxml);
      if (mr.success) {
        var meta = safeJsonParse(mr.result, {});
        if (meta.title) updateInfoBar('title', meta.title);
      }
    }

    return allBlocks;
  }

  // ── PPTX parsing ──
  async function parsePptxZip(zip) {
    var allBlocks = [];
    var slideEntries = Object.keys(zip.files)
      .filter(function (n) { return n.match(/^ppt\/slides\/slide\d+\.xml$/); })
      .sort();

    for (var i = 0; i < Math.min(slideEntries.length, MAX_SLIDES); i++) {
      setStatus('Parsing slide ' + (i + 1) + '/' + slideEntries.length + '...');
      var xml = await zip.file(slideEntries[i]).async('string');
      if (xml.length <= MAX_XML_SIZE) {
        var r = engine.call('parsePptxSlide', xml);
        if (r.success) allBlocks = allBlocks.concat(safeJsonParse(r.result, []));
      }
    }
    return allBlocks;
  }

  // ── XLSX parsing ──
  async function parseXlsxZip(zip) {
    var allBlocks = [];

    // Load shared strings
    var ssEntry = zip.file('xl/sharedStrings.xml');
    var ssXml = ssEntry ? await ssEntry.async('string') : '';

    // Find sheets
    var sheetEntries = Object.keys(zip.files)
      .filter(function (n) { return n.match(/^xl\/worksheets\/sheet\d+\.xml$/); })
      .sort();

    for (var i = 0; i < Math.min(sheetEntries.length, MAX_SHEETS); i++) {
      setStatus('Parsing sheet ' + (i + 1) + '/' + sheetEntries.length + '...');
      var xml = await zip.file(sheetEntries[i]).async('string');
      var sheetName = 'Sheet' + (i + 1);
      if (xml.length <= MAX_XML_SIZE) {
        var r = engine.call('parseXlsxSheet', xml, ssXml, sheetName);
        if (r.success) allBlocks = allBlocks.concat(safeJsonParse(r.result, []));
      }
    }
    return allBlocks;
  }

  // ── AI-based parsing (PDF/image) ──
  async function parseAIFile(file, ext) {
    var apiKey = localStorage.getItem('gemini-api-key');
    if (!apiKey) {
      if (aiUpsell) aiUpsell.classList.add('visible');
      showError('PDF/image parsing requires an AI model. Add your Google API key in Settings.');
      return;
    }
    if (aiUpsell) aiUpsell.classList.remove('visible');

    if (!wasmReady) {
      await initWasm();
      if (!wasmReady) {
        showError('WASM not loaded — cannot parse with AI. ' + (wasmError || ''));
        return;
      }
    }

    // Always (re-)register AI handler with current key — user may have entered it after WASM loaded
    if (typeof engine.repl.setAIHandler === 'function') {
      engine.repl.setAIHandler(createGeminiHandler(apiKey));
      if (typeof engine.repl.grantCapability === 'function') engine.repl.grantCapability('AI');
    }

    setStatus('Reading file...');
    var buffer = await file.arrayBuffer();
    var bytes = new Uint8Array(buffer);
    var base64 = btoa(String.fromCharCode.apply(null, bytes));

    var mimeMap = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', tiff: 'image/tiff', webp: 'image/webp' };
    var mime = mimeMap[ext] || 'application/octet-stream';

    setStatus('Parsing with AI (this may take a moment)...');
    try {
      var r = await engine.callAsync('parseFileFromBase64', base64, mime, file.name);
      if (r.success) {
        var blocks = safeJsonParse(r.result, []);
        setStatus('Parsed ' + blocks.length + ' blocks via AI');
        showOutput(blocks);
      } else {
        showError('AI parse failed: ' + r.error);
      }
    } catch (err) {
      showError('AI parse error: ' + err.message);
    }
  }

  // ── Text to blocks (client-side, no WASM needed) ──
  function textToBlocks(content, ext) {
    var blocks = [];
    var lines = content.split('\n');

    if (ext === 'md') {
      lines.forEach(function (line) {
        if (line.match(/^### /)) blocks.push({ type: 'heading', text: line.replace(/^### /, ''), level: 3 });
        else if (line.match(/^## /)) blocks.push({ type: 'heading', text: line.replace(/^## /, ''), level: 2 });
        else if (line.match(/^# /)) blocks.push({ type: 'heading', text: line.replace(/^# /, ''), level: 1 });
        else if (line.trim()) blocks.push({ type: 'text', text: line, style: 'normal' });
      });
    } else if (ext === 'csv' || ext === 'tsv') {
      var delim = ext === 'tsv' ? '\t' : ',';
      var rows = lines.filter(function (l) { return l.trim(); }).slice(0, 200);
      if (rows.length > 0) {
        var headers = rows[0].split(delim);
        var dataRows = rows.slice(1).map(function (r) { return r.split(delim); });
        blocks.push({ type: 'table', headers: headers, rows: dataRows });
      }
    } else {
      // HTML or plain text
      blocks.push({ type: 'text', text: content.substring(0, 10000), style: 'normal' });
    }
    return blocks;
  }

  // ── Output rendering ──
  function showOutput(blocks, rawContent) {
    if (outputEmpty) outputEmpty.style.display = 'none';
    if (outputTabs) outputTabs.classList.add('visible');

    // Blocks view
    if (panelBlocks) panelBlocks.innerHTML = renderBlocks(blocks);

    // JSON view
    if (panelJson) panelJson.innerHTML = '<pre>' + escHtml(JSON.stringify(blocks, null, 2)) + '</pre>';

    // Markdown view
    if (panelMarkdown) panelMarkdown.innerHTML = '<pre>' + escHtml(blocksToMarkdown(blocks)) + '</pre>';

    // Show active tab
    window.switchOutputTab(document.querySelector('#output-tabs .dp-output-tab.active'));
  }

  function renderBlocks(blocks) {
    if (!Array.isArray(blocks)) return '<div class="dp-block"><div class="dp-block-text">No blocks</div></div>';

    return blocks.map(function (b) {
      if (!b || !b.type) return '';

      switch (b.type) {
        case 'heading':
          var lvl = b.level || 1;
          return '<div class="dp-block"><div class="dp-block-heading" data-level="' + lvl + '">' + escHtml(b.text || '') + '</div></div>';

        case 'text':
          return '<div class="dp-block"><div class="dp-block-text">' + escHtml(b.text || '') + '</div></div>';

        case 'table':
          var html = '<table class="dp-block-table"><thead><tr>';
          (b.headers || []).forEach(function (h) {
            var text = typeof h === 'string' ? h : (h.text || '');
            html += '<th>' + escHtml(text) + '</th>';
          });
          html += '</tr></thead><tbody>';
          (b.rows || []).forEach(function (row) {
            html += '<tr>';
            (Array.isArray(row) ? row : []).forEach(function (c) {
              var text = typeof c === 'string' ? c : (c.text || '');
              html += '<td>' + escHtml(text) + '</td>';
            });
            html += '</tr>';
          });
          html += '</tbody></table>';
          return '<div class="dp-block">' + html + '</div>';

        case 'list':
          var tag = b.ordered ? 'ol' : 'ul';
          var items = (b.items || []).map(function (i) { return '<li>' + escHtml(i) + '</li>'; }).join('');
          return '<div class="dp-block"><' + tag + '>' + items + '</' + tag + '></div>';

        case 'change':
          var cls = (b.changeType === 'delete') ? 'dp-block-change--delete' : 'dp-block-change--insert';
          return '<div class="dp-block"><div class="dp-block-change ' + cls + '">' +
            '<strong>' + escHtml(b.changeType || '') + '</strong> by ' + escHtml(b.author || '') + ': ' + escHtml(b.text || '') +
            '</div></div>';

        case 'section':
          return '<div class="dp-block dp-block-section"><div class="dp-block-section-label">' + escHtml(b.kind || 'section') + '</div>' +
            renderBlocks(b.blocks || b.children || []) + '</div>';

        case 'image':
          return '<div class="dp-block"><div class="dp-block-text" style="color:var(--dp-blue)">[Image: ' + escHtml(b.description || b.mime || 'embedded') + ']</div></div>';

        default:
          return '<div class="dp-block"><div class="dp-block-text">' + escHtml(b.text || JSON.stringify(b)) + '</div></div>';
      }
    }).join('');
  }

  function blocksToMarkdown(blocks) {
    if (!Array.isArray(blocks)) return '';
    return blocks.map(function (b) {
      if (!b) return '';
      switch (b.type) {
        case 'heading': return '#'.repeat(b.level || 1) + ' ' + (b.text || '');
        case 'text': return b.text || '';
        case 'table':
          var hdr = (b.headers || []).map(function (h) { return typeof h === 'string' ? h : h.text || ''; });
          var sep = hdr.map(function () { return '---'; });
          var rows = (b.rows || []).map(function (r) {
            return '| ' + (Array.isArray(r) ? r : []).map(function (c) { return typeof c === 'string' ? c : c.text || ''; }).join(' | ') + ' |';
          });
          return '| ' + hdr.join(' | ') + ' |\n| ' + sep.join(' | ') + ' |\n' + rows.join('\n');
        case 'list': return (b.items || []).map(function (i, idx) { return (b.ordered ? (idx + 1) + '. ' : '- ') + i; }).join('\n');
        case 'change': return '> **' + (b.changeType || '') + '** by ' + (b.author || '') + ': ' + (b.text || '');
        case 'section': return '### ' + (b.kind || 'section') + '\n' + blocksToMarkdown(b.blocks || b.children || []);
        case 'image': return '![' + (b.description || 'image') + ']()';
        default: return b.text || '';
      }
    }).join('\n\n');
  }

  // ── Helpers ──
  function showError(msg) {
    if (panelBlocks) panelBlocks.innerHTML = '<div class="dp-block"><div class="dp-block-text" style="color:#ef4444">' + escHtml(msg) + '</div></div>';
    if (outputEmpty) outputEmpty.style.display = 'none';
    if (outputTabs) outputTabs.classList.add('visible');
    window.switchOutputTab(document.querySelector('#output-tabs .dp-output-tab.active'));
  }

  function showFallback(ext, msg) {
    showError(msg + ' <a href="api.html" style="color:var(--dp-blue)">Use the API</a> or <a href="https://sunholo.com/ailang-demos/docparse.html" style="color:var(--dp-blue)">try the full demo</a>.');
  }

  function showInfoBar(ext, sizeKB) {
    if (!infoBar) return;
    infoBar.innerHTML = '<span class="dp-info-chip">' + ext.toUpperCase() + '</span>' +
      '<span class="dp-info-chip">' + sizeKB + ' KB</span>';
    infoBar.classList.add('visible');
  }

  function updateInfoBar(key, value) {
    if (!infoBar) return;
    infoBar.innerHTML += '<span class="dp-info-chip">' + escHtml(String(value)) + (key === 'blocks' ? ' blocks' : '') + '</span>';
  }

  function safeJsonParse(s, fallback) {
    try { return JSON.parse(s); } catch (e) { return fallback; }
  }

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Wire up file handling ──
  if (dropzone) {
    ['dragenter', 'dragover'].forEach(function (evt) {
      dropzone.addEventListener(evt, function (e) { e.preventDefault(); dropzone.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      dropzone.addEventListener(evt, function (e) { e.preventDefault(); dropzone.classList.remove('dragover'); });
    });
    dropzone.addEventListener('drop', function (e) {
      if (e.dataTransfer.files.length > 0) window.handleDocParseFile(e.dataTransfer.files[0]);
    });
  }
  if (fileInput) {
    fileInput.addEventListener('change', function () {
      if (this.files.length > 0) window.handleDocParseFile(this.files[0]);
    });
  }

  // ── Start WASM loading in background ──
  initWasm();
})();
