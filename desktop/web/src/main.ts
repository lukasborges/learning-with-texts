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

function nextStatus(status: TermStatus): TermStatus {
  if (status === 0) {
    return 1;
  }
  if (status >= 1 && status <= 4) {
    return 5;
  }
  if (status === 5 || status === 99) {
    return 98;
  }
  return 0;
}

function updateTermButton(button: HTMLButtonElement, status: TermStatus): void {
  const label = statusLabel(status);
  button.dataset.status = String(status);
  button.className = `reading-term reading-term--${label.toLocaleLowerCase()}`;
  button.title = `${label}. Click to change status.`;
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
    'Click a term to cycle through Unknown, Learning, Known, and Ignored.';
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

  const termButtons = new Map<string, HTMLButtonElement[]>();
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
      button.addEventListener('click', () => {
        const currentStatus = Number(button.dataset.status) as TermStatus;
        const status = nextStatus(currentStatus);
        const buttons = termButtons.get(item.normalized) ?? [button];
        buttons.forEach((matchingButton) => {
          matchingButton.disabled = true;
        });
        void gateway
          .setTermStatus({ textId, normalized: item.normalized, status })
          .then((progress) => {
            buttons.forEach((matchingButton) => {
              updateTermButton(matchingButton, progress.status);
            });
            updateReadingProgress(reading, progress.knownTerms, meter, progressLabel);
          })
          .catch((error: unknown) => {
            window.alert(error instanceof Error ? error.message : String(error));
          })
          .finally(() => {
            buttons.forEach((matchingButton) => {
              matchingButton.disabled = false;
            });
          });
      });
      paragraph.append(button);
    }
    article.append(paragraph);
  }

  shell.append(toolbar, header, guide, article);
  applicationRoot.replaceChildren(shell);
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
    libraryHeading,
    library
  );
  applicationRoot.replaceChildren(shell);
}

void render();
