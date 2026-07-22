import logoUrl from '../../../img/lwt_icon_big.png';
import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';
import { createLibraryGateway } from './gateways/create_library_gateway';
import type {
  AppSettings,
  LibraryText,
  ReadingText,
  Tag,
  TermStatus,
  TextDetails
} from './domain/library';
import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Desktop application root was not found');
}

const applicationRoot = app;
const usesNativeDatabase = import.meta.env.MODE === 'tauri';
const updatesEnabled = usesNativeDatabase && import.meta.env.VITE_LWT_UPDATES_ENABLED === 'true';
const gateway = createLibraryGateway();
let showingArchivedTexts = false;
let libraryPage = 0;
let tagPage = 0;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)));
  }
  return btoa(chunks.join(''));
}

function audioType(file: File): string {
  if (file.type) {
    return file.type.toLocaleLowerCase();
  }
  const extension = file.name.split('.').pop()?.toLocaleLowerCase();
  return (
    {
      mp3: 'audio/mpeg',
      m4a: 'audio/mp4',
      mp4: 'audio/mp4',
      ogg: 'audio/ogg',
      oga: 'audio/ogg',
      wav: 'audio/wav',
      webm: 'audio/webm',
      flac: 'audio/flac'
    }[extension ?? ''] ?? 'application/octet-stream'
  );
}

function externalLookupUrl(template: string | undefined, term: string): string | undefined {
  if (!template?.trim()) {
    return undefined;
  }
  try {
    const url = new URL(template.replaceAll('###', encodeURIComponent(term)));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function createField(labelText: string, control: HTMLElement): HTMLLabelElement {
  const label = document.createElement('label');
  const caption = document.createElement('span');
  caption.textContent = labelText;
  label.append(caption, control);
  return label;
}

function createPager(
  total: number,
  page: number,
  pageSize: number,
  onPage: (page: number) => void
): HTMLElement {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const controls = document.createElement('nav');
  controls.className = 'pager';
  controls.setAttribute('aria-label', 'Pagination');
  const previous = document.createElement('button');
  previous.type = 'button';
  previous.textContent = '← Previous';
  previous.disabled = page <= 0;
  previous.addEventListener('click', () => onPage(Math.max(0, page - 1)));
  const label = document.createElement('span');
  label.textContent = `Page ${page + 1} of ${pages}`;
  const next = document.createElement('button');
  next.type = 'button';
  next.textContent = 'Next →';
  next.disabled = page + 1 >= pages;
  next.addEventListener('click', () => onPage(Math.min(pages - 1, page + 1)));
  controls.append(previous, label, next);
  return controls;
}

function createTagSelector(
  tags: readonly Tag[],
  selectedIds: readonly number[]
): { element: HTMLElement; selected: () => number[] } {
  const element = document.createElement('fieldset');
  element.className = 'tag-selector';
  const legend = document.createElement('legend');
  legend.textContent = 'Tags';
  element.append(legend);
  const selected = new Set(selectedIds);
  const checkboxes = tags.map((tag) => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = String(tag.id);
    checkbox.checked = selected.has(tag.id);
    label.append(checkbox, document.createTextNode(tag.name));
    element.append(label);
    return checkbox;
  });
  if (tags.length === 0) {
    const empty = document.createElement('small');
    empty.textContent = 'Create a tag from the Tags screen first.';
    element.append(empty);
  }
  return {
    element,
    selected: () =>
      checkboxes.filter(({ checked }) => checked).map(({ value }) => Number(value))
  };
}

function createImportPanel(
  message = '',
  editingText?: TextDetails,
  tags: readonly Tag[] = [],
  selectedTagIds: readonly number[] = []
): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'import-panel';

  const heading = document.createElement('h2');
  heading.textContent = editingText ? 'Edit text' : 'Add a text';
  const description = document.createElement('p');
  description.textContent = editingText
    ? 'Update the text details and save your changes.'
    : 'Paste a text below or load a UTF-8 text file. Review the details before saving.';

  const form = document.createElement('form');
  form.className = 'text-form';

  const language = document.createElement('input');
  language.name = 'language';
  language.required = true;
  language.maxLength = 40;
  language.placeholder = 'e.g. English';
  language.autocomplete = 'off';
  language.value = editingText?.language ?? '';

  const title = document.createElement('input');
  title.name = 'title';
  title.required = true;
  title.maxLength = 200;
  title.value = editingText?.title ?? '';

  const file = document.createElement('input');
  file.type = 'file';
  file.accept = '.txt,text/plain';

  const audioFile = document.createElement('input');
  audioFile.type = 'file';
  audioFile.accept = '.mp3,.m4a,.mp4,.ogg,.oga,.wav,.webm,.flac,audio/*';

  const content = document.createElement('textarea');
  content.name = 'content';
  content.required = true;
  content.maxLength = 65_000;
  content.rows = 10;
  content.placeholder = 'Paste or type the text to study';
  content.value = editingText?.content ?? '';

  const sourceUri = document.createElement('input');
  sourceUri.name = 'sourceUri';
  sourceUri.type = 'url';
  sourceUri.maxLength = 1_000;
  sourceUri.placeholder = 'https://example.com/source';
  sourceUri.value = editingText?.sourceUri ?? '';
  const tagSelector = createTagSelector(tags, selectedTagIds);

  const contentHelp = document.createElement('small');
  contentHelp.textContent = 'Maximum: 65,000 bytes. Soft hyphens are removed when saved.';

  const status = document.createElement('p');
  status.className = 'form-status';
  status.setAttribute('role', 'status');
  status.textContent = message;

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = editingText ? 'Save changes' : 'Save to library';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'button-secondary';
  cancel.textContent = 'Cancel editing';
  cancel.hidden = !editingText;
  cancel.addEventListener('click', () => {
    void render();
  });

  const removeAudio = document.createElement('button');
  removeAudio.type = 'button';
  removeAudio.className = 'button-secondary';
  removeAudio.textContent = 'Remove saved audio';
  removeAudio.hidden = !editingText?.hasAudio;
  removeAudio.addEventListener('click', () => {
    if (!editingText) {
      return;
    }
    removeAudio.disabled = true;
    void gateway
      .removeTextAudio(editingText.id)
      .then(() => render('Saved audio was removed.', editingText.id))
      .catch((error: unknown) => {
        removeAudio.disabled = false;
        status.className = 'form-status form-status--error';
        status.textContent = error instanceof Error ? error.message : String(error);
      });
  });

  file.addEventListener('change', () => {
    const selectedFile = file.files?.[0];
    if (!selectedFile) {
      return;
    }

    void selectedFile
      .text()
      .then((fileContent) => {
        content.value = fileContent;
        if (title.value.trim() === '') {
          title.value = selectedFile.name.replace(/\.[^.]+$/, '');
        }
        status.className = 'form-status';
        status.textContent = `${selectedFile.name} loaded. Review it before saving.`;
      })
      .catch(() => {
        status.className = 'form-status form-status--error';
        status.textContent = 'The selected file could not be read.';
      });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
      return;
    }

    submit.disabled = true;
    status.className = 'form-status';
    status.textContent = 'Saving text…';

    const input = {
      language: language.value,
      title: title.value,
      content: content.value,
      sourceUri: sourceUri.value || undefined
    };
    const request = editingText
      ? gateway.updateText({ id: editingText.id, ...input })
      : gateway.createText(input);

    void request
      .then((saved) =>
        gateway.setTextTags({ textId: saved.id, tagIds: tagSelector.selected() }).then(() => saved)
      )
      .then(async (saved) => {
        const selectedAudio = audioFile.files?.[0];
        if (!selectedAudio) {
          return saved;
        }
        if (selectedAudio.size === 0 || selectedAudio.size > 50_000_000) {
          throw new Error('Audio must be between 1 byte and 50 MB');
        }
        await gateway.saveTextAudio({
          textId: saved.id,
          fileName: selectedAudio.name,
          mediaType: audioType(selectedAudio),
          dataBase64: arrayBufferToBase64(await selectedAudio.arrayBuffer())
        });
        return saved;
      })
      .then((saved) =>
        render(
          editingText
            ? `“${saved.title}” was updated.`
            : `“${saved.title}” was added to the library.`
        )
      )
      .catch((error: unknown) => {
        submit.disabled = false;
        status.className = 'form-status form-status--error';
        status.textContent = error instanceof Error ? error.message : String(error);
      });
  });

  const contentField = createField('Text', content);
  contentField.className = 'text-form__content';
  contentField.append(contentHelp);
  const actions = document.createElement('div');
  actions.className = 'text-form__actions';
  actions.append(submit, cancel, removeAudio);
  form.append(
    createField('Language', language),
    createField('Title', title),
    createField('Load a .txt file', file),
    createField(editingText?.hasAudio ? 'Replace audio (optional)' : 'Audio (optional)', audioFile),
    contentField,
    createField('Source URL (optional)', sourceUri),
    tagSelector.element,
    actions,
    status
  );
  panel.append(heading, description, form);
  return panel;
}

function statusLabel(status: TermStatus): string {
  if (status >= 1 && status <= 4) {
    return 'Learning';
  }
  if (status === 5 || status === 99) {
    return 'Known';
  }
  if (status === 98) {
    return 'Ignored';
  }
  return 'Unknown';
}

function updateTermButton(button: HTMLButtonElement, status: TermStatus): void {
  const label = statusLabel(status);
  button.dataset.status = String(status);
  button.className = `reading-term reading-term--${label.toLocaleLowerCase()}`;
  button.title = `${label}. Click to edit this term.`;
  button.setAttribute('aria-label', `${button.textContent ?? ''}: ${label}`);
}

function updateReadingProgress(
  reading: ReadingText,
  knownTerms: number,
  meter: HTMLProgressElement,
  label: HTMLElement
): void {
  meter.max = Math.max(1, reading.totalTerms);
  meter.value = knownTerms;
  label.textContent = `${knownTerms} of ${reading.totalTerms} unique terms known`;
}

async function renderReading(textId: number): Promise<void> {
  const [reading, tags, audio] = await Promise.all([
    gateway.getReadingText(textId),
    gateway.listTags(),
    gateway.getTextAudio(textId)
  ]);
  const shell = document.createElement('main');
  shell.className = 'shell reading-shell';

  const toolbar = document.createElement('div');
  toolbar.className = 'reading-toolbar';
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = '← Back to library';
  back.addEventListener('click', () => {
    void render();
  });
  toolbar.append(back);

  const header = document.createElement('header');
  header.className = 'reading-header';
  const title = document.createElement('h1');
  title.textContent = reading.title;
  const language = document.createElement('p');
  language.textContent = reading.language;
  const meter = document.createElement('progress');
  const progressLabel = document.createElement('p');
  progressLabel.className = 'reading-progress-label';
  updateReadingProgress(reading, reading.knownTerms, meter, progressLabel);
  header.append(title, language, meter, progressLabel);
  if (audio) {
    const player = document.createElement('audio');
    player.controls = true;
    player.preload = 'metadata';
    player.src = `data:${audio.mediaType};base64,${audio.dataBase64}`;
    player.setAttribute('aria-label', `Audio for ${reading.title}`);
    header.append(player);
  }

  const guide = document.createElement('aside');
  guide.className = 'reading-guide';
  const guideText = document.createElement('p');
  guideText.textContent =
    'Click a term to edit its status, translation, romanization, and tags.';
  const legend = document.createElement('div');
  legend.className = 'reading-legend';
  for (const [label, className] of [
    ['Unknown', 'unknown'],
    ['Learning', 'learning'],
    ['Known', 'known'],
    ['Ignored', 'ignored']
  ] as const) {
    const item = document.createElement('span');
    item.className = `reading-legend__item reading-term--${className}`;
    item.textContent = label;
    legend.append(item);
  }
  guide.append(guideText, legend);

  const expressionControls = document.createElement('div');
  expressionControls.className = 'expression-controls';
  const expressionToggle = document.createElement('button');
  expressionToggle.type = 'button';
  expressionToggle.textContent = 'Create expression';
  const expressionStatus = document.createElement('span');
  expressionStatus.textContent = 'Select expressions containing 2–9 terms.';
  expressionControls.append(expressionToggle, expressionStatus);
  const expressionList = document.createElement('div');
  expressionList.className = 'expression-list';
  guide.append(expressionControls, expressionList);

  const termButtons = new Map<string, HTMLButtonElement[]>();
  const positionButtons = new Map<string, HTMLButtonElement>();
  const editor = document.createElement('section');
  editor.className = 'term-editor';
  const editorPlaceholder = document.createElement('p');
  editorPlaceholder.textContent = 'Select a term in the text to open its editor.';
  editor.append(editorPlaceholder);
  let editorRequest = 0;

  const openTermEditor = (normalized: string): void => {
    const request = ++editorRequest;
    editor.replaceChildren();
    const loading = document.createElement('p');
    loading.textContent = 'Loading term…';
    editor.append(loading);

    void Promise.all([
      gateway.getTermDetails(textId, normalized),
      gateway.listTermTagIds(textId, normalized)
    ])
      .then(([term, assignedTagIds]) => {
        if (request !== editorRequest) {
          return;
        }

        const heading = document.createElement('h2');
        heading.textContent = term.displayText;
        const normalizedLabel = document.createElement('p');
        normalizedLabel.className = 'term-editor__normalized';
        normalizedLabel.textContent = term.normalized;
        const lookupLinks = document.createElement('div');
        lookupLinks.className = 'term-editor__lookups';
        for (const [label, template] of [
          ['Dictionary 1', reading.dictionaryUri1],
          ['Dictionary 2', reading.dictionaryUri2],
          ['Translate', reading.googleTranslateUri]
        ] as const) {
          const url = externalLookupUrl(template, term.normalized);
          if (!url) {
            continue;
          }
          const link = document.createElement('a');
          link.href = url;
          link.target = '_blank';
          link.rel = 'noreferrer';
          link.textContent = label;
          lookupLinks.append(link);
        }

        const form = document.createElement('form');
        form.className = 'term-editor__form';
        const status = document.createElement('select');
        for (const [value, label] of [
          [1, 'Learning'],
          [5, 'Known'],
          [98, 'Ignored']
        ] as const) {
          const option = document.createElement('option');
          option.value = String(value);
          option.textContent = label;
          status.append(option);
        }
        status.value = String(
          term.status >= 1 && term.status <= 4
            ? 1
            : term.status === 5 || term.status === 99
              ? 5
              : term.status === 98
                ? 98
                : 1
        );

        const translation = document.createElement('textarea');
        translation.rows = 3;
        translation.maxLength = 500;
        translation.value = term.translation;
        const romanization = document.createElement('input');
        romanization.maxLength = 100;
        romanization.value = term.romanization;
        const tagSelector = createTagSelector(tags, assignedTagIds);

        const actions = document.createElement('div');
        actions.className = 'term-editor__actions';
        const save = document.createElement('button');
        save.type = 'submit';
        save.textContent = 'Save term';
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'button-secondary';
        reset.textContent = 'Reset to unknown';
        const feedback = document.createElement('p');
        feedback.className = 'form-status';
        feedback.setAttribute('role', 'status');
        actions.append(save, reset);

        const applyStatus = (savedStatus: TermStatus, knownTerms: number): void => {
          if (term.wordCount === 1) {
            const buttons = termButtons.get(normalized) ?? [];
            buttons.forEach((button) => updateTermButton(button, savedStatus));
          }
          updateReadingProgress(reading, knownTerms, meter, progressLabel);
        };

        form.addEventListener('submit', (event) => {
          event.preventDefault();
          save.disabled = true;
          reset.disabled = true;
          feedback.className = 'form-status';
          feedback.textContent = 'Saving term…';
          void gateway
            .saveTerm({
              textId,
              normalized,
              status: Number(status.value) as 1 | 5 | 98,
              translation: translation.value,
              romanization: romanization.value
            })
            .then((saved) =>
              gateway
                .setTermTags({ textId, normalized, tagIds: tagSelector.selected() })
                .then(() => saved)
            )
            .then((saved) => {
              applyStatus(saved.term.status, saved.knownTerms);
              feedback.textContent = 'Term saved.';
            })
            .catch((error: unknown) => {
              feedback.className = 'form-status form-status--error';
              feedback.textContent = error instanceof Error ? error.message : String(error);
            })
            .finally(() => {
              save.disabled = false;
              reset.disabled = false;
            });
        });

        reset.addEventListener('click', () => {
          save.disabled = true;
          reset.disabled = true;
          feedback.className = 'form-status';
          feedback.textContent = 'Resetting term…';
          void gateway
            .setTermStatus({ textId, normalized, status: 0 })
            .then((progress) => {
              applyStatus(0, progress.knownTerms);
              if (term.wordCount > 1) {
                return renderReading(textId);
              }
              translation.value = '';
              romanization.value = '';
              status.value = '1';
              tagSelector.element
                .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
                .forEach((checkbox) => {
                  checkbox.checked = false;
                });
              feedback.textContent = 'Term reset to unknown.';
            })
            .catch((error: unknown) => {
              feedback.className = 'form-status form-status--error';
              feedback.textContent = error instanceof Error ? error.message : String(error);
            })
            .finally(() => {
              save.disabled = false;
              reset.disabled = false;
            });
        });

        form.append(
          createField('Status', status),
          createField('Translation', translation),
          createField('Romanization (optional)', romanization),
          tagSelector.element,
          actions,
          feedback
        );
        editor.replaceChildren(heading, normalizedLabel, lookupLinks, form);
      })
      .catch((error: unknown) => {
        if (request === editorRequest) {
          const message = document.createElement('p');
          message.className = 'form-status form-status--error';
          message.textContent = error instanceof Error ? error.message : String(error);
          editor.replaceChildren(message);
        }
      });
  };

  const addExpressionChip = (normalized: string, displayText: string): void => {
    if (expressionList.querySelector(`[data-normalized="${CSS.escape(normalized)}"]`)) {
      return;
    }
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.dataset.normalized = normalized;
    chip.textContent = displayText;
    chip.addEventListener('click', () => openTermEditor(normalized));
    expressionList.append(chip);
  };

  let expressionMode = false;
  let expressionStart:
    | { sentenceId: number; position: number; button: HTMLButtonElement }
    | undefined;
  expressionToggle.addEventListener('click', () => {
    expressionMode = !expressionMode;
    expressionStart?.button.classList.remove('reading-term--selected');
    expressionStart = undefined;
    expressionToggle.textContent = expressionMode ? 'Cancel expression' : 'Create expression';
    expressionStatus.textContent = expressionMode
      ? 'Select the first term, then the last term in the same sentence.'
      : 'Select expressions containing 2–9 terms.';
  });

  const article = document.createElement('article');
  article.className = 'reading-content';
  article.dir = reading.rightToLeft ? 'rtl' : 'ltr';
  article.style.fontSize = `${reading.textSize}%`;
  for (const sentence of reading.sentences) {
    const paragraph = document.createElement('p');
    paragraph.dataset.position = String(sentence.position);
    for (const item of sentence.items) {
      if (!item.isWord) {
        const separator = reading.removeSpaces ? item.surface.replace(/\s+/gu, '') : item.surface;
        if (separator) {
          paragraph.append(document.createTextNode(separator));
        }
        continue;
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.surface;
      updateTermButton(button, item.status);
      const matchingButtons = termButtons.get(item.normalized) ?? [];
      matchingButtons.push(button);
      termButtons.set(item.normalized, matchingButtons);
      positionButtons.set(`${sentence.id}:${item.position}`, button);
      button.addEventListener('click', () => {
        if (expressionMode) {
          if (!expressionStart) {
            expressionStart = { sentenceId: sentence.id, position: item.position, button };
            button.classList.add('reading-term--selected');
            expressionStatus.textContent = 'Now select the last term of the expression.';
            return;
          }
          if (expressionStart.sentenceId !== sentence.id) {
            expressionStatus.textContent = 'Both terms must be in the same sentence.';
            return;
          }
          const start = expressionStart;
          expressionToggle.disabled = true;
          void gateway
            .createExpression({
              textId,
              sentenceId: sentence.id,
              startPosition: start.position,
              endPosition: item.position
            })
            .then((created) => {
              for (let position = created.startPosition; position <= created.endPosition; position += 1) {
                positionButtons
                  .get(`${created.sentenceId}:${position}`)
                  ?.classList.add('reading-term--expression');
              }
              addExpressionChip(created.term.normalized, created.term.displayText);
              openTermEditor(created.term.normalized);
              expressionStatus.textContent = `Expression “${created.term.displayText}” created.`;
            })
            .catch((error: unknown) => {
              expressionStatus.textContent =
                error instanceof Error ? error.message : String(error);
            })
            .finally(() => {
              start.button.classList.remove('reading-term--selected');
              expressionStart = undefined;
              expressionMode = false;
              expressionToggle.disabled = false;
              expressionToggle.textContent = 'Create expression';
            });
          return;
        }
        openTermEditor(item.normalized);
      });
      paragraph.append(button);
    }
    article.append(paragraph);
  }

  for (const expression of reading.expressions) {
    addExpressionChip(expression.normalized, expression.displayText);
    for (let position = expression.startPosition; position <= expression.endPosition; position += 1) {
      positionButtons
        .get(`${expression.sentenceId}:${position}`)
        ?.classList.add('reading-term--expression');
    }
  }

  shell.append(toolbar, header, guide, editor, article);
  applicationRoot.replaceChildren(shell);
}

async function renderReview(): Promise<void> {
  const [queue, settings] = await Promise.all([
    gateway.listReviewTerms(20),
    gateway.appSettings()
  ]);
  const shell = document.createElement('main');
  shell.className = 'shell review-shell';
  const toolbar = document.createElement('div');
  toolbar.className = 'reading-toolbar';
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = '← Back to library';
  back.addEventListener('click', () => void render());
  toolbar.append(back);
  const heading = document.createElement('h1');
  heading.textContent = 'Review terms';
  const session = document.createElement('section');
  session.className = 'review-card';
  shell.append(toolbar, heading, session);
  applicationRoot.replaceChildren(shell);

  let current = 0;
  const showCard = (): void => {
    const term = queue[current];
    session.replaceChildren();
    if (!term) {
      const done = document.createElement('h2');
      done.textContent = queue.length === 0 ? 'No terms are due' : 'Review complete';
      const message = document.createElement('p');
      message.textContent =
        queue.length === 0
          ? 'Save terms while reading to add them to the review queue.'
          : `${queue.length} terms reviewed in this session.`;
      session.append(done, message);
      return;
    }

    const counter = document.createElement('p');
    counter.className = 'review-counter';
    counter.textContent = `${current + 1} of ${queue.length}`;
    const termHeading = document.createElement('h2');
    termHeading.textContent = term.displayText;
    const language = document.createElement('p');
    language.className = 'review-language';
    language.textContent = term.language;
    const answer = document.createElement('div');
    answer.className = 'review-answer';
    answer.hidden = true;
    const translation = document.createElement('p');
    translation.textContent = term.translation || 'No translation saved';
    const romanization = document.createElement('p');
    romanization.textContent = term.romanization;
    romanization.hidden = term.romanization === '';
    answer.append(translation, romanization);

    const reveal = document.createElement('button');
    reveal.type = 'button';
    reveal.className = 'review-reveal';
    reveal.textContent = 'Show answer';
    const ratings = document.createElement('div');
    ratings.className = 'review-ratings';
    ratings.hidden = true;
    for (const [label, rating] of [
      ['Again', 0],
      ['Hard', 1],
      ['Good', 2],
      ['Easy', 3]
    ] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', () => {
        ratings.querySelectorAll('button').forEach((candidate) => {
          candidate.disabled = true;
        });
        void gateway
          .recordReview({ termId: term.id, rating })
          .then(() => {
            current += 1;
            if (settings.reviewDelayMs > 0) {
              window.setTimeout(showCard, settings.reviewDelayMs);
            } else {
              showCard();
            }
          })
          .catch((error: unknown) => {
            window.alert(error instanceof Error ? error.message : String(error));
            ratings.querySelectorAll('button').forEach((candidate) => {
              candidate.disabled = false;
            });
          });
      });
      ratings.append(button);
    }
    reveal.addEventListener('click', () => {
      answer.hidden = false;
      ratings.hidden = false;
      reveal.hidden = true;
    });
    session.append(counter, termHeading, language, answer, reveal, ratings);
  };
  showCard();
}

async function renderStatistics(): Promise<void> {
  const statistics = await gateway.reviewStatistics();
  const shell = document.createElement('main');
  shell.className = 'shell statistics-shell';
  const toolbar = document.createElement('div');
  toolbar.className = 'reading-toolbar';
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = '← Back to library';
  back.addEventListener('click', () => void render());
  toolbar.append(back);
  const heading = document.createElement('h1');
  heading.textContent = 'Learning statistics';

  const cards = document.createElement('section');
  cards.className = 'statistics-cards';
  for (const [label, value] of [
    ['Saved terms', statistics.totalTerms],
    ['Learning', statistics.learningTerms],
    ['Known', statistics.knownTerms],
    ['Due now', statistics.dueTerms],
    ['Reviews today', statistics.reviewsToday],
    [
      'Accuracy today',
      statistics.reviewsToday === 0
        ? '—'
        : `${Math.round((statistics.correctToday / statistics.reviewsToday) * 100)}%`
    ]
  ] as const) {
    const card = document.createElement('article');
    const valueElement = document.createElement('strong');
    valueElement.textContent = String(value);
    const labelElement = document.createElement('span');
    labelElement.textContent = label;
    card.append(valueElement, labelElement);
    cards.append(card);
  }

  const comparison = document.createElement('section');
  comparison.className = 'score-comparison';
  const comparisonHeading = document.createElement('h2');
  comparisonHeading.textContent = 'Scheduler comparison';
  const comparisonText = document.createElement('p');
  comparisonText.textContent = `Current queue: ${statistics.dueTerms} due · Legacy PHP estimate: ${statistics.legacyDueToday} today and ${statistics.legacyDueTomorrow} tomorrow.`;
  const comparisonNote = document.createElement('p');
  comparisonNote.textContent =
    'The legacy estimate uses the original 2.4^status score formula. It is shown for parity analysis and does not change the current schedule.';
  comparison.append(comparisonHeading, comparisonText, comparisonNote);

  const table = document.createElement('table');
  table.className = 'statistics-table';
  const header = document.createElement('thead');
  header.innerHTML =
    '<tr><th>Language</th><th>Terms</th><th>Learning</th><th>Known</th><th>Reviews</th><th>Accuracy</th></tr>';
  const body = document.createElement('tbody');
  for (const language of statistics.languages) {
    const row = document.createElement('tr');
    const values = [
      language.language,
      language.totalTerms,
      language.learningTerms,
      language.knownTerms,
      language.reviews,
      language.reviews === 0
        ? '—'
        : `${Math.round((language.correctReviews / language.reviews) * 100)}%`
    ];
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = String(value);
      row.append(cell);
    }
    body.append(row);
  }
  table.append(header, body);
  shell.append(toolbar, heading, cards, comparison, table);
  applicationRoot.replaceChildren(shell);
}

async function renderLanguages(): Promise<void> {
  const languages = await gateway.listLanguages();
  const shell = document.createElement('main');
  shell.className = 'shell language-shell';
  const toolbar = document.createElement('div');
  toolbar.className = 'reading-toolbar';
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = '← Back to library';
  back.addEventListener('click', () => void render());
  toolbar.append(back);
  const heading = document.createElement('h1');
  heading.textContent = 'Language settings';
  const introduction = document.createElement('p');
  introduction.className = 'language-introduction';
  introduction.textContent =
    'Configure parsing and reading behavior for languages already used by your library.';
  const grid = document.createElement('section');
  grid.className = 'language-grid';

  for (const language of languages) {
    const form = document.createElement('form');
    form.className = 'language-card';
    const name = document.createElement('h2');
    name.textContent = language.name;
    const count = document.createElement('p');
    count.textContent = `${language.textCount} ${language.textCount === 1 ? 'text' : 'texts'}`;
    const dictionary1 = document.createElement('input');
    dictionary1.maxLength = 1_000;
    dictionary1.placeholder = 'https://dictionary.example/?q=###';
    dictionary1.value = language.dictionaryUri1;
    const dictionary2 = document.createElement('input');
    dictionary2.maxLength = 1_000;
    dictionary2.value = language.dictionaryUri2 ?? '';
    const googleTranslate = document.createElement('input');
    googleTranslate.maxLength = 1_000;
    googleTranslate.value = language.googleTranslateUri ?? '';
    const exportTemplate = document.createElement('textarea');
    exportTemplate.maxLength = 2_000;
    exportTemplate.rows = 3;
    exportTemplate.value = language.exportTemplate ?? '';
    const textSize = document.createElement('input');
    textSize.type = 'number';
    textSize.min = '25';
    textSize.max = '500';
    textSize.required = true;
    textSize.value = String(language.textSize);
    const terminators = document.createElement('input');
    terminators.maxLength = 500;
    terminators.placeholder = '.!?。！？';
    terminators.value = language.sentenceTerminators;
    const terminatorField = createField('Sentence-ending characters', terminators);
    const terminatorHelp = document.createElement('small');
    terminatorHelp.textContent = 'Leave empty for the Unicode-aware desktop defaults.';
    terminatorField.append(terminatorHelp);
    const substitutions = document.createElement('input');
    substitutions.maxLength = 500;
    substitutions.placeholder = "´='|`='|…=.";
    substitutions.value = language.characterSubstitutions;
    const substitutionField = createField('Character substitutions', substitutions);
    const substitutionHelp = document.createElement('small');
    substitutionHelp.textContent = 'Use from=to pairs separated by |.';
    substitutionField.append(substitutionHelp);

    const options = document.createElement('div');
    options.className = 'language-options';
    const checkboxes: Array<[string, HTMLInputElement]> = [
      ['Make each character a term', document.createElement('input')],
      ['Remove spaces while reading', document.createElement('input')],
      ['Right-to-left script', document.createElement('input')]
    ];
    const values = [
      language.splitEachCharacter,
      language.removeSpaces,
      language.rightToLeft
    ];
    checkboxes.forEach(([labelText, checkbox], index) => {
      checkbox.type = 'checkbox';
      checkbox.checked = values[index] ?? false;
      const label = document.createElement('label');
      label.append(checkbox, document.createTextNode(labelText));
      options.append(label);
    });
    const save = document.createElement('button');
    save.type = 'submit';
    save.textContent = 'Save settings';
    const feedback = document.createElement('p');
    feedback.className = 'form-status';
    feedback.setAttribute('role', 'status');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      save.disabled = true;
      feedback.className = 'form-status';
      feedback.textContent = 'Saving and reparsing affected texts…';
      void gateway
        .updateLanguage({
          id: language.id,
          dictionaryUri1: dictionary1.value,
          dictionaryUri2: dictionary2.value || undefined,
          googleTranslateUri: googleTranslate.value || undefined,
          exportTemplate: exportTemplate.value || undefined,
          textSize: Number(textSize.value),
          characterSubstitutions: substitutions.value,
          sentenceTerminators: terminators.value,
          splitEachCharacter: checkboxes[0]?.[1].checked ?? false,
          removeSpaces: checkboxes[1]?.[1].checked ?? false,
          rightToLeft: checkboxes[2]?.[1].checked ?? false
        })
        .then(() => {
          feedback.textContent = 'Language settings saved.';
        })
        .catch((error: unknown) => {
          feedback.className = 'form-status form-status--error';
          feedback.textContent = error instanceof Error ? error.message : String(error);
        })
        .finally(() => {
          save.disabled = false;
        });
    });
    form.append(
      name,
      count,
      createField('Primary dictionary URL template', dictionary1),
      createField('Secondary dictionary URL template', dictionary2),
      createField('Translation URL template', googleTranslate),
      createField('Reading text size (%)', textSize),
      createField('Term export template', exportTemplate),
      terminatorField,
      substitutionField,
      options,
      save,
      feedback
    );
    grid.append(form);
  }

  if (languages.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Add a text to create its language settings.';
    grid.append(empty);
  }
  const warning = document.createElement('aside');
  warning.className = 'migration-notice language-warning';
  warning.textContent =
    'Changing parsing rules reparses every text in that language. Saved terms remain, but compound-expression positions for those texts are cleared.';
  shell.append(toolbar, heading, introduction, warning, grid);
  applicationRoot.replaceChildren(shell);
}

async function renderAppSettings(): Promise<void> {
  const settings = await gateway.appSettings();
  const shell = document.createElement('main');
  shell.className = 'shell settings-shell';
  const toolbar = document.createElement('div');
  toolbar.className = 'reading-toolbar';
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = '← Back to library';
  back.addEventListener('click', () => void render());
  toolbar.append(back);
  const heading = document.createElement('h1');
  heading.textContent = 'Application settings';
  const introduction = document.createElement('p');
  introduction.className = 'language-introduction';
  introduction.textContent =
    'These preferences replace the legacy settings that still affect desktop workflows.';
  const form = document.createElement('form');
  form.className = 'settings-card';
  const numberInput = (value: number, min: number, max: number): HTMLInputElement => {
    const input = document.createElement('input');
    input.type = 'number';
    input.required = true;
    input.min = String(min);
    input.max = String(max);
    input.value = String(value);
    return input;
  };
  const libraryPageSize = numberInput(settings.libraryPageSize, 5, 500);
  const archivedPageSize = numberInput(settings.archivedPageSize, 5, 500);
  const tagPageSize = numberInput(settings.tagPageSize, 5, 500);
  const reviewDelayMs = numberInput(settings.reviewDelayMs, 0, 10_000);
  const showWordCounts = document.createElement('input');
  showWordCounts.type = 'checkbox';
  showWordCounts.checked = settings.showWordCounts;
  const showWordCountsLabel = document.createElement('label');
  showWordCountsLabel.className = 'settings-checkbox';
  showWordCountsLabel.append(
    showWordCounts,
    document.createTextNode('Show word counts and progress in the library')
  );
  const save = document.createElement('button');
  save.type = 'submit';
  save.textContent = 'Save settings';
  const feedback = document.createElement('p');
  feedback.className = 'form-status';
  feedback.setAttribute('role', 'status');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
      return;
    }
    const updated: AppSettings = {
      libraryPageSize: Number(libraryPageSize.value),
      archivedPageSize: Number(archivedPageSize.value),
      tagPageSize: Number(tagPageSize.value),
      showWordCounts: showWordCounts.checked,
      reviewDelayMs: Number(reviewDelayMs.value)
    };
    save.disabled = true;
    feedback.textContent = 'Saving settings…';
    void gateway
      .updateAppSettings(updated)
      .then(() => {
        libraryPage = 0;
        tagPage = 0;
        feedback.textContent = 'Application settings saved.';
      })
      .catch((error: unknown) => {
        feedback.className = 'form-status form-status--error';
        feedback.textContent = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        save.disabled = false;
      });
  });
  form.append(
    createField('Active texts per page', libraryPageSize),
    createField('Archived texts per page', archivedPageSize),
    createField('Tags per page', tagPageSize),
    createField('Delay after a review rating (milliseconds)', reviewDelayMs),
    showWordCountsLabel,
    save,
    feedback
  );
  const note = document.createElement('aside');
  note.className = 'migration-notice language-warning';
  note.textContent =
    'Legacy frame dimensions and mobile frame-set mode are intentionally omitted because the desktop interface is responsive. Term-table pagination, similar-term count, and annotation delimiters remain deferred until those legacy screens have desktop equivalents.';
  const updateCard = document.createElement('section');
  updateCard.className = 'settings-card update-card';
  updateCard.hidden = !updatesEnabled;
  const updateHeading = document.createElement('h2');
  updateHeading.textContent = 'Application updates';
  const updateDescription = document.createElement('p');
  updateDescription.textContent =
    'Check the signed stable release channel. An update is installed only after its cryptographic signature is verified.';
  const checkForUpdates = document.createElement('button');
  checkForUpdates.type = 'button';
  checkForUpdates.textContent = 'Check for updates';
  const updateStatus = document.createElement('p');
  updateStatus.className = 'form-status';
  updateStatus.setAttribute('role', 'status');
  checkForUpdates.addEventListener('click', () => {
    checkForUpdates.disabled = true;
    updateStatus.className = 'form-status';
    updateStatus.textContent = 'Checking the signed release channel…';
    void check()
      .then(async (update) => {
        if (!update) {
          updateStatus.textContent = 'This application is up to date.';
          return;
        }
        const accepted = window.confirm(
          `Version ${update.version} is available. Download, verify, and install it now?`
        );
        if (!accepted) {
          updateStatus.textContent = `Version ${update.version} is available.`;
          return;
        }
        updateStatus.textContent = `Downloading and verifying version ${update.version}…`;
        await update.downloadAndInstall();
        updateStatus.textContent = 'Update installed. Restarting…';
        await relaunch();
      })
      .catch((error: unknown) => {
        updateStatus.className = 'form-status form-status--error';
        updateStatus.textContent = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        checkForUpdates.disabled = false;
      });
  });
  updateCard.append(updateHeading, updateDescription, checkForUpdates, updateStatus);
  shell.append(toolbar, heading, introduction, form, updateCard, note);
  applicationRoot.replaceChildren(shell);
}

async function renderTags(message = ''): Promise<void> {
  const [tags, settings] = await Promise.all([gateway.listTags(), gateway.appSettings()]);
  const shell = document.createElement('main');
  shell.className = 'shell tag-shell';
  const toolbar = document.createElement('div');
  toolbar.className = 'reading-toolbar';
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = '← Back to library';
  back.addEventListener('click', () => void render());
  toolbar.append(back);
  const heading = document.createElement('h1');
  heading.textContent = 'Tags';
  const description = document.createElement('p');
  description.className = 'language-introduction';
  description.textContent = 'Create shared tags, then assign them while editing a text or term.';

  const form = document.createElement('form');
  form.className = 'tag-form';
  const name = document.createElement('input');
  name.required = true;
  name.maxLength = 20;
  const comment = document.createElement('input');
  comment.maxLength = 200;
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Create tag';
  const feedback = document.createElement('p');
  feedback.className = 'form-status';
  feedback.setAttribute('role', 'status');
  feedback.textContent = message;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
      return;
    }
    submit.disabled = true;
    feedback.textContent = 'Creating tag…';
    void gateway
      .createTag({ name: name.value, comment: comment.value })
      .then((created) => renderTags(`Tag “${created.name}” created.`))
      .catch((error: unknown) => {
        submit.disabled = false;
        feedback.className = 'form-status form-status--error';
        feedback.textContent = error instanceof Error ? error.message : String(error);
      });
  });
  form.append(
    createField('Name', name),
    createField('Comment (optional)', comment),
    submit,
    feedback
  );

  const list = document.createElement('section');
  list.className = 'tag-grid';
  if (tags.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No tags have been created yet.';
    list.append(empty);
  }
  const pageCount = Math.max(1, Math.ceil(tags.length / settings.tagPageSize));
  tagPage = Math.min(tagPage, pageCount - 1);
  const pageTags = tags.slice(
    tagPage * settings.tagPageSize,
    (tagPage + 1) * settings.tagPageSize
  );
  for (const tag of pageTags) {
    const card = document.createElement('article');
    card.className = 'tag-card';
    const tagName = document.createElement('h2');
    tagName.textContent = tag.name;
    const tagComment = document.createElement('p');
    tagComment.textContent = tag.comment || 'No comment';
    const counts = document.createElement('p');
    counts.textContent = `${tag.textCount} texts · ${tag.termCount} terms`;
    card.append(tagName, tagComment, counts);
    list.append(card);
  }
  if (tags.length > settings.tagPageSize) {
    list.append(
      createPager(tags.length, tagPage, settings.tagPageSize, (page) => {
        tagPage = page;
        void renderTags();
      })
    );
  }
  shell.append(toolbar, heading, description, form, list);
  applicationRoot.replaceChildren(shell);
}

async function renderDataManagement(): Promise<void> {
  const shell = document.createElement('main');
  shell.className = 'shell data-shell';
  const toolbar = document.createElement('div');
  toolbar.className = 'reading-toolbar';
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = '← Back to library';
  back.addEventListener('click', () => void render());
  toolbar.append(back);
  const heading = document.createElement('h1');
  heading.textContent = 'Backup and restore';
  const introduction = document.createElement('p');
  introduction.className = 'language-introduction';
  introduction.textContent =
    'Keep a portable JSON copy of your languages, texts, terms, expressions, and review history.';
  const grid = document.createElement('section');
  grid.className = 'data-grid';

  const exportCard = document.createElement('article');
  exportCard.className = 'data-card';
  const exportHeading = document.createElement('h2');
  exportHeading.textContent = 'Export backup';
  const exportDescription = document.createElement('p');
  exportDescription.textContent = 'Download a complete, versioned snapshot of the local library.';
  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.textContent = 'Download backup';
  const exportStatus = document.createElement('p');
  exportStatus.className = 'form-status';
  exportStatus.setAttribute('role', 'status');
  exportButton.addEventListener('click', () => {
    exportButton.disabled = true;
    exportStatus.className = 'form-status';
    exportStatus.textContent = 'Preparing backup…';
    void gateway
      .exportBackup()
      .then((payload) => {
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const download = document.createElement('a');
        download.href = url;
        download.download = `lwt-backup-${new Date().toISOString().slice(0, 10)}.json`;
        download.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
        exportStatus.textContent = 'Backup downloaded.';
      })
      .catch((error: unknown) => {
        exportStatus.className = 'form-status form-status--error';
        exportStatus.textContent = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        exportButton.disabled = false;
      });
  });
  exportCard.append(exportHeading, exportDescription, exportButton, exportStatus);

  const restoreCard = document.createElement('article');
  restoreCard.className = 'data-card';
  const restoreHeading = document.createElement('h2');
  restoreHeading.textContent = 'Restore backup';
  const restoreDescription = document.createElement('p');
  restoreDescription.textContent =
    'Select an LWT desktop JSON backup. Restoring replaces the current local library.';
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'application/json,.json';
  const restoreButton = document.createElement('button');
  restoreButton.type = 'button';
  restoreButton.textContent = 'Restore selected backup';
  restoreButton.disabled = true;
  const restoreStatus = document.createElement('p');
  restoreStatus.className = 'form-status';
  restoreStatus.setAttribute('role', 'status');
  let selectedPayload = '';
  file.addEventListener('change', () => {
    const selected = file.files?.[0];
    selectedPayload = '';
    restoreButton.disabled = true;
    if (!selected) {
      restoreStatus.textContent = '';
      return;
    }
    restoreStatus.className = 'form-status';
    restoreStatus.textContent = 'Reading backup…';
    void selected
      .text()
      .then((payload) => {
        selectedPayload = payload;
        restoreButton.disabled = false;
        restoreStatus.textContent = `${selected.name} is ready to restore.`;
      })
      .catch(() => {
        restoreStatus.className = 'form-status form-status--error';
        restoreStatus.textContent = 'The selected backup could not be read.';
      });
  });
  restoreButton.addEventListener('click', () => {
    if (
      !selectedPayload ||
      !window.confirm(
        'Restore this backup? The current local library will be replaced. This cannot be undone.'
      )
    ) {
      return;
    }
    restoreButton.disabled = true;
    file.disabled = true;
    restoreStatus.className = 'form-status';
    restoreStatus.textContent = 'Validating and restoring backup…';
    void gateway
      .restoreBackup(selectedPayload)
      .then((summary) => {
        const warningText =
          summary.warnings.length === 0 ? '' : ` Warnings: ${summary.warnings.join(' ')}`;
        restoreStatus.textContent = `Restored ${summary.texts} texts (${summary.archivedTexts} archived), ${summary.terms} terms, ${summary.tags} tags, ${summary.media} audio files, and ${summary.reviews} reviews.${warningText}`;
        selectedPayload = '';
        file.value = '';
      })
      .catch((error: unknown) => {
        restoreStatus.className = 'form-status form-status--error';
        restoreStatus.textContent = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        file.disabled = false;
        restoreButton.disabled = selectedPayload === '';
      });
  });
  restoreCard.append(
    restoreHeading,
    restoreDescription,
    createField('Backup file', file),
    restoreButton,
    restoreStatus
  );
  grid.append(exportCard, restoreCard);
  shell.append(toolbar, heading, introduction, grid);
  applicationRoot.replaceChildren(shell);
}

function createTextCard(text: LibraryText, showWordCounts: boolean): HTMLElement {
  const card = document.createElement('article');
  card.className = 'text-card';

  const progress =
    text.totalTerms > 0 ? Math.round((text.knownTerms / text.totalTerms) * 100) : 0;
  const heading = document.createElement('h2');
  heading.textContent = text.title;

  const language = document.createElement('p');
  language.className = 'text-card__language';
  language.textContent = text.language;

  const details = document.createElement('p');
  details.className = 'text-card__details';
  details.textContent = !showWordCounts
    ? text.lastOpened || 'Word counts hidden in Settings'
    : text.totalTerms > 0
      ? `${text.knownTerms} of ${text.totalTerms} terms known${
          text.lastOpened ? ` · ${text.lastOpened}` : ''
        }`
      : 'No terms detected';

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Open text';
  button.addEventListener('click', () => {
    void renderReading(text.id).catch((error: unknown) => {
      window.alert(error instanceof Error ? error.message : String(error));
    });
  });

  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.textContent = 'Edit';
  editButton.addEventListener('click', () => {
    void render('', text.id).catch((error: unknown) => {
      window.alert(error instanceof Error ? error.message : String(error));
    });
  });

  const archiveButton = document.createElement('button');
  archiveButton.type = 'button';
  archiveButton.textContent = text.archived ? 'Restore to library' : 'Archive';
  archiveButton.addEventListener('click', () => {
    const action = text.archived ? 'restore' : 'archive';
    if (!window.confirm(`${action === 'archive' ? 'Archive' : 'Restore'} “${text.title}”?`)) {
      return;
    }
    archiveButton.disabled = true;
    void gateway
      .setTextArchived({ id: text.id, archived: !text.archived })
      .then(() => render(`“${text.title}” was ${text.archived ? 'restored' : 'archived'}.`))
      .catch((error: unknown) => {
        archiveButton.disabled = false;
        window.alert(error instanceof Error ? error.message : String(error));
      });
  });

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'button-danger';
  deleteButton.textContent = 'Delete';
  deleteButton.addEventListener('click', () => {
    if (!window.confirm(`Delete “${text.title}”? This cannot be undone.`)) {
      return;
    }
    deleteButton.disabled = true;
    void gateway
      .deleteText(text.id)
      .then(() => render(`“${text.title}” was deleted.`))
      .catch((error: unknown) => {
        deleteButton.disabled = false;
        window.alert(error instanceof Error ? error.message : String(error));
      });
  });

  const actions = document.createElement('div');
  actions.className = 'text-card__actions';
  if (!text.archived) {
    actions.append(button);
  }
  actions.append(editButton, archiveButton, deleteButton);

  card.append(heading, language);
  if (showWordCounts && text.totalTerms > 0) {
    const meter = document.createElement('progress');
    meter.max = 100;
    meter.value = progress;
    meter.setAttribute('aria-label', `${progress}% known terms`);
    card.append(meter);
  }
  card.append(details, actions);
  return card;
}

async function render(message = '', editingId?: number): Promise<void> {
  const [texts, editingText, tags, selectedTagIds, settings] = await Promise.all([
    gateway.listTexts(),
    editingId === undefined ? Promise.resolve(undefined) : gateway.getText(editingId),
    gateway.listTags(),
    editingId === undefined ? Promise.resolve([]) : gateway.listTextTagIds(editingId),
    gateway.appSettings()
  ]);

  const shell = document.createElement('main');
  shell.className = 'shell';

  const header = document.createElement('header');
  header.className = 'app-header';

  const logo = document.createElement('img');
  logo.src = logoUrl;
  logo.alt = '';
  logo.width = 64;
  logo.height = 64;

  const titleGroup = document.createElement('div');
  const title = document.createElement('h1');
  title.textContent = 'Learning with Texts';
  const subtitle = document.createElement('p');
  subtitle.textContent = usesNativeDatabase
    ? 'Desktop foundation · local SQLite mode'
    : 'Desktop foundation · offline fixture mode';
  titleGroup.append(title, subtitle);
  header.append(logo, titleGroup);

  const notice = document.createElement('aside');
  notice.className = 'migration-notice';
  notice.textContent = usesNativeDatabase
    ? 'This shell is running without PHP or MySQL. Library data is loaded from the local SQLite database.'
    : 'This shell is running without PHP or MySQL. Data is currently read from a typed fixture gateway.';

  const libraryHeading = document.createElement('h2');
  libraryHeading.className = 'section-title';
  libraryHeading.textContent = showingArchivedTexts ? 'Archived texts' : 'Library';
  const archiveViewButton = document.createElement('button');
  archiveViewButton.type = 'button';
  archiveViewButton.className = 'review-start';
  archiveViewButton.textContent = showingArchivedTexts
    ? `Library (${texts.filter(({ archived }) => !archived).length})`
    : `Archive (${texts.filter(({ archived }) => archived).length})`;
  archiveViewButton.addEventListener('click', () => {
    showingArchivedTexts = !showingArchivedTexts;
    libraryPage = 0;
    void render().catch((error: unknown) => {
      window.alert(error instanceof Error ? error.message : String(error));
    });
  });
  const reviewButton = document.createElement('button');
  reviewButton.type = 'button';
  reviewButton.className = 'review-start';
  reviewButton.textContent = 'Review terms';
  reviewButton.addEventListener('click', () => {
    void renderReview().catch((error: unknown) => {
      window.alert(error instanceof Error ? error.message : String(error));
    });
  });
  const statisticsButton = document.createElement('button');
  statisticsButton.type = 'button';
  statisticsButton.className = 'review-start';
  statisticsButton.textContent = 'Statistics';
  statisticsButton.addEventListener('click', () => {
    void renderStatistics().catch((error: unknown) => {
      window.alert(error instanceof Error ? error.message : String(error));
    });
  });
  const languagesButton = document.createElement('button');
  languagesButton.type = 'button';
  languagesButton.className = 'review-start';
  languagesButton.textContent = 'Languages';
  languagesButton.addEventListener('click', () => {
    void renderLanguages().catch((error: unknown) => {
      window.alert(error instanceof Error ? error.message : String(error));
    });
  });
  const dataButton = document.createElement('button');
  dataButton.type = 'button';
  dataButton.className = 'review-start';
  dataButton.textContent = 'Backup';
  dataButton.addEventListener('click', () => {
    void renderDataManagement();
  });
  const tagsButton = document.createElement('button');
  tagsButton.type = 'button';
  tagsButton.className = 'review-start';
  tagsButton.textContent = 'Tags';
  tagsButton.addEventListener('click', () => {
    void renderTags().catch((error: unknown) => {
      window.alert(error instanceof Error ? error.message : String(error));
    });
  });
  const settingsButton = document.createElement('button');
  settingsButton.type = 'button';
  settingsButton.className = 'review-start';
  settingsButton.textContent = 'Settings';
  settingsButton.addEventListener('click', () => {
    void renderAppSettings().catch((error: unknown) => {
      window.alert(error instanceof Error ? error.message : String(error));
    });
  });
  const libraryActions = document.createElement('div');
  libraryActions.className = 'library-actions';
  libraryActions.append(
    archiveViewButton,
    settingsButton,
    dataButton,
    tagsButton,
    languagesButton,
    statisticsButton,
    reviewButton
  );
  const libraryHeader = document.createElement('div');
  libraryHeader.className = 'library-header';
  libraryHeader.append(libraryHeading, libraryActions);

  const library = document.createElement('section');
  library.className = 'library-grid';
  library.setAttribute('aria-label', showingArchivedTexts ? 'Archived texts' : 'Text library');
  const visibleTexts = texts.filter(({ archived }) => archived === showingArchivedTexts);
  const pageSize = showingArchivedTexts
    ? settings.archivedPageSize
    : settings.libraryPageSize;
  const pageCount = Math.max(1, Math.ceil(visibleTexts.length / pageSize));
  libraryPage = Math.min(libraryPage, pageCount - 1);
  const pageTexts = visibleTexts.slice(libraryPage * pageSize, (libraryPage + 1) * pageSize);
  if (visibleTexts.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = showingArchivedTexts
      ? 'The text archive is empty.'
      : 'Your local library is empty. Use the form above to add a text.';
    library.append(emptyState);
  } else {
    library.append(...pageTexts.map((text) => createTextCard(text, settings.showWordCounts)));
    if (visibleTexts.length > pageSize) {
      library.append(
        createPager(visibleTexts.length, libraryPage, pageSize, (page) => {
          libraryPage = page;
          void render();
        })
      );
    }
  }

  shell.append(
    header,
    notice,
    createImportPanel(message, editingText, tags, selectedTagIds),
    libraryHeader,
    library
  );
  applicationRoot.replaceChildren(shell);
}

void render();
