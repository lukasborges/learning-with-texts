import logoUrl from '../../../img/lwt_icon_big.png';
import { createLibraryGateway } from './gateways/create_library_gateway';
import type {
  LibraryText,
  ReadingText,
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
const gateway = createLibraryGateway();

function createField(labelText: string, control: HTMLElement): HTMLLabelElement {
  const label = document.createElement('label');
  const caption = document.createElement('span');
  caption.textContent = labelText;
  label.append(caption, control);
  return label;
}

function createImportPanel(message = '', editingText?: TextDetails): HTMLElement {
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
  actions.append(submit, cancel);
  form.append(
    createField('Language', language),
    createField('Title', title),
    createField('Load a .txt file', file),
    contentField,
    createField('Source URL (optional)', sourceUri),
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
  const reading = await gateway.getReadingText(textId);
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

  const guide = document.createElement('aside');
  guide.className = 'reading-guide';
  const guideText = document.createElement('p');
  guideText.textContent =
    'Click a term to edit its status, translation, and romanization.';
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

    void gateway
      .getTermDetails(textId, normalized)
      .then((term) => {
        if (request !== editorRequest) {
          return;
        }

        const heading = document.createElement('h2');
        heading.textContent = term.displayText;
        const normalizedLabel = document.createElement('p');
        normalizedLabel.className = 'term-editor__normalized';
        normalizedLabel.textContent = term.normalized;

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
          actions,
          feedback
        );
        editor.replaceChildren(heading, normalizedLabel, form);
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
  for (const sentence of reading.sentences) {
    const paragraph = document.createElement('p');
    paragraph.dataset.position = String(sentence.position);
    for (const item of sentence.items) {
      if (!item.isWord) {
        paragraph.append(document.createTextNode(item.surface));
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
  const queue = await gateway.listReviewTerms(20);
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
            showCard();
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

function createTextCard(text: LibraryText): HTMLElement {
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
  details.textContent =
    text.totalTerms > 0
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
  actions.append(button, editButton, deleteButton);

  card.append(heading, language);
  if (text.totalTerms > 0) {
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
  const [texts, editingText] = await Promise.all([
    gateway.listTexts(),
    editingId === undefined ? Promise.resolve(undefined) : gateway.getText(editingId)
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
  libraryHeading.textContent = 'Library';
  const reviewButton = document.createElement('button');
  reviewButton.type = 'button';
  reviewButton.className = 'review-start';
  reviewButton.textContent = 'Review terms';
  reviewButton.addEventListener('click', () => {
    void renderReview().catch((error: unknown) => {
      window.alert(error instanceof Error ? error.message : String(error));
    });
  });
  const libraryHeader = document.createElement('div');
  libraryHeader.className = 'library-header';
  libraryHeader.append(libraryHeading, reviewButton);

  const library = document.createElement('section');
  library.className = 'library-grid';
  library.setAttribute('aria-label', 'Text library');
  if (texts.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'Your local library is empty. Use the form above to add a text.';
    library.append(emptyState);
  } else {
    library.append(...texts.map(createTextCard));
  }

  shell.append(
    header,
    notice,
    createImportPanel(message, editingText),
    libraryHeader,
    library
  );
  applicationRoot.replaceChildren(shell);
}

void render();
