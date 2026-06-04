(function () {
  var root = document.querySelector('[data-writer]');
  if (!root) {
    return;
  }

  var draftKey = 'planck-blog-writer-draft-v1';
  var fields = {
    title: root.querySelector('[data-writer-field="title"]'),
    body: root.querySelector('[data-writer-field="body"]'),
    visibility: root.querySelector('[data-writer-field="visibility"]'),
    date: root.querySelector('[data-writer-field="date"]'),
    category: root.querySelector('[data-writer-field="category"]'),
    tags: root.querySelector('[data-writer-field="tags"]'),
    slug: root.querySelector('[data-writer-field="slug"]')
  };
  var status = root.querySelector('[data-writer-status]');
  var fileName = root.querySelector('[data-writer-file-name]');
  var preview = root.querySelector('[data-writer-preview]');
  var saveTimer;

  var templates = {
    study: [
      '## 오늘 공부한 것',
      '',
      '- ',
      '',
      '## 핵심 개념',
      '',
      '- ',
      '',
      '## 예제 코드',
      '',
      '```text',
      '',
      '```',
      '',
      '## 헷갈린 부분',
      '',
      '- ',
      '',
      '## 다음에 할 것',
      '',
      '- '
    ].join('\n'),
    concept: [
      '## 정의',
      '',
      '',
      '## 왜 필요한가',
      '',
      '',
      '## 동작 방식',
      '',
      '',
      '## 예시',
      '',
      '```text',
      '',
      '```',
      '',
      '## 정리',
      '',
      '- '
    ].join('\n'),
    trouble: [
      '## 문제 상황',
      '',
      '',
      '## 원인',
      '',
      '',
      '## 해결',
      '',
      '',
      '## 배운 점',
      '',
      '- '
    ].join('\n')
  };

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function nowValue() {
    var now = new Date();
    return [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate())
    ].join('-') + 'T' + [
      pad(now.getHours()),
      pad(now.getMinutes())
    ].join(':');
  }

  function dateFromField() {
    return fields.date.value ? new Date(fields.date.value) : new Date();
  }

  function frontMatterDate(date) {
    var offset = -date.getTimezoneOffset();
    var sign = offset >= 0 ? '+' : '-';
    var abs = Math.abs(offset);

    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join('-') + ' ' + [
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds())
    ].join(':') + ' ' + sign + pad(Math.floor(abs / 60)) + pad(abs % 60);
  }

  function datePrefix(date) {
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join('-');
  }

  function timeSuffix(date) {
    return [pad(date.getHours()), pad(date.getMinutes())].join('');
  }

  function slugify(value, date) {
    var slug = (value || '')
      .trim()
      .toLowerCase()
      .replace(/[^\w\s가-힣-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return slug || 'study-note-' + timeSuffix(date);
  }

  function parseList(value) {
    return (value || '')
      .split(',')
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
  }

  function escapeYaml(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function buildMarkdown() {
    var date = dateFromField();
    var title = fields.title.value.trim() || '제목 없음';
    var category = fields.category.value.trim();
    var tags = parseList(fields.tags.value);
    var markdown = [
      '---',
      'layout: post',
      'title: "' + escapeYaml(title) + '"',
      'date: ' + frontMatterDate(date)
    ];

    if (category) {
      markdown.push('categories:');
      markdown.push('  - ' + category);
    }

    if (tags.length) {
      markdown.push('tags:');
      tags.forEach(function (tag) {
        markdown.push('  - ' + tag);
      });
    }

    markdown.push('published: ' + (fields.visibility.value === 'published' ? 'true' : 'false'));
    markdown.push('read_time: true');
    markdown.push('---');
    markdown.push('');
    markdown.push(fields.body.value.trim());

    return markdown.join('\n') + '\n';
  }

  function currentFileName() {
    var date = dateFromField();
    var slug = fields.slug.value.trim() || slugify(fields.title.value, date);
    return datePrefix(date) + '-' + slug + '.md';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function inlineMarkdown(value) {
    return escapeHtml(value)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  }

  function renderPreview(markdown) {
    var lines = markdown.split('\n');
    var html = [];
    var inCode = false;
    var listOpen = false;

    function closeList() {
      if (listOpen) {
        html.push('</ul>');
        listOpen = false;
      }
    }

    lines.forEach(function (line) {
      if (line.indexOf('```') === 0) {
        closeList();
        if (inCode) {
          html.push('</code></pre>');
        } else {
          html.push('<pre><code>');
        }
        inCode = !inCode;
        return;
      }

      if (inCode) {
        html.push(escapeHtml(line) + '\n');
        return;
      }

      if (!line.trim()) {
        closeList();
        return;
      }

      if (/^###\s+/.test(line)) {
        closeList();
        html.push('<h3>' + inlineMarkdown(line.replace(/^###\s+/, '')) + '</h3>');
      } else if (/^##\s+/.test(line)) {
        closeList();
        html.push('<h2>' + inlineMarkdown(line.replace(/^##\s+/, '')) + '</h2>');
      } else if (/^#\s+/.test(line)) {
        closeList();
        html.push('<h1>' + inlineMarkdown(line.replace(/^#\s+/, '')) + '</h1>');
      } else if (/^-\s+/.test(line)) {
        if (!listOpen) {
          html.push('<ul>');
          listOpen = true;
        }
        html.push('<li>' + inlineMarkdown(line.replace(/^-\s+/, '')) + '</li>');
      } else if (/^>\s+/.test(line)) {
        closeList();
        html.push('<blockquote>' + inlineMarkdown(line.replace(/^>\s+/, '')) + '</blockquote>');
      } else {
        closeList();
        html.push('<p>' + inlineMarkdown(line) + '</p>');
      }
    });

    closeList();

    if (inCode) {
      html.push('</code></pre>');
    }

    return html.join('');
  }

  function setStatus(message) {
    status.textContent = message;
  }

  function collectDraft() {
    return {
      title: fields.title.value,
      body: fields.body.value,
      visibility: fields.visibility.value,
      date: fields.date.value,
      category: fields.category.value,
      tags: fields.tags.value,
      slug: fields.slug.value
    };
  }

  function saveDraft() {
    localStorage.setItem(draftKey, JSON.stringify(collectDraft()));
    setStatus('임시저장됨');
  }

  function scheduleSave() {
    setStatus('작성 중');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 350);
    updateOutput();
  }

  function updateOutput() {
    fileName.textContent = '_posts/' + currentFileName();
    preview.innerHTML = renderPreview(fields.body.value);
  }

  function loadDraft() {
    var raw = localStorage.getItem(draftKey);
    var draft = raw ? JSON.parse(raw) : {};

    fields.title.value = draft.title || '';
    fields.body.value = draft.body || templates.study;
    fields.visibility.value = draft.visibility || 'published';
    fields.date.value = draft.date || nowValue();
    fields.category.value = draft.category || '';
    fields.tags.value = draft.tags || '';
    fields.slug.value = draft.slug || '';

    updateOutput();
    setStatus(raw ? '임시저장됨' : '새 글');
  }

  function insertText(before, after) {
    var textarea = fields.body;
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var selected = textarea.value.slice(start, end);
    var next = textarea.value.slice(0, start) + before + selected + after + textarea.value.slice(end);

    textarea.value = next;
    textarea.focus();
    textarea.selectionStart = start + before.length;
    textarea.selectionEnd = start + before.length + selected.length;
    scheduleSave();
  }

  function downloadMarkdown() {
    var blob = new Blob([buildMarkdown()], { type: 'text/markdown;charset=utf-8' });
    var link = document.createElement('a');

    link.href = URL.createObjectURL(blob);
    link.download = currentFileName();
    link.click();
    URL.revokeObjectURL(link.href);
    setStatus('파일 생성됨');
  }

  function copyMarkdown() {
    var markdown = buildMarkdown();

    if (navigator.clipboard) {
      navigator.clipboard.writeText(markdown).then(function () {
        setStatus('복사됨');
      });
    } else {
      var helper = document.createElement('textarea');
      helper.value = markdown;
      document.body.appendChild(helper);
      helper.select();
      document.execCommand('copy');
      document.body.removeChild(helper);
      setStatus('복사됨');
    }
  }

  root.addEventListener('input', function (event) {
    if (event.target.matches('[data-writer-field]')) {
      scheduleSave();
    }
  });

  root.addEventListener('change', function (event) {
    if (event.target.matches('[data-writer-field]')) {
      scheduleSave();
    }
  });

  root.addEventListener('click', function (event) {
    var action = event.target.getAttribute('data-writer-action');
    var insertion = event.target.getAttribute('data-writer-insert');
    var template = event.target.getAttribute('data-writer-template');

    if (action === 'download') {
      downloadMarkdown();
    } else if (action === 'copy') {
      copyMarkdown();
    } else if (action === 'reset' && window.confirm('현재 글을 지우고 새 글을 시작할까요?')) {
      localStorage.removeItem(draftKey);
      fields.title.value = '';
      fields.body.value = templates.study;
      fields.visibility.value = 'published';
      fields.date.value = nowValue();
      fields.category.value = '';
      fields.tags.value = '';
      fields.slug.value = '';
      scheduleSave();
    } else if (insertion === 'h2') {
      insertText('\n## ', '\n');
    } else if (insertion === 'bold') {
      insertText('**', '**');
    } else if (insertion === 'list') {
      insertText('\n- ', '');
    } else if (insertion === 'quote') {
      insertText('\n> ', '');
    } else if (insertion === 'code') {
      insertText('\n```text\n', '\n```\n');
    } else if (template && (!fields.body.value.trim() || window.confirm('본문을 선택한 양식으로 바꿀까요?'))) {
      fields.body.value = templates[template];
      scheduleSave();
    }
  });

  loadDraft();
}());
