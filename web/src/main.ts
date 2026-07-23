import addIconSvg from '../assets/icons/list-add-symbolic.svg?raw';
import alarmIconSvg from '../assets/icons/alarm-symbolic.svg?raw';
import audioIconSvg from '../assets/icons/audio-x-generic-symbolic.svg?raw';
import audioVolumeHighIconSvg from '../assets/icons/audio-volume-high-symbolic.svg?raw';
import audioVolumeMutedIconSvg from '../assets/icons/audio-volume-muted-symbolic.svg?raw';
import checkedIconSvg from '../assets/icons/checkbox-checked-symbolic.svg?raw';
import dictionaryIconSvg from '../assets/icons/accessories-dictionary-symbolic.svg?raw';
import informationIconSvg from '../assets/icons/dialog-information-symbolic.svg?raw';
import documentOpenIconSvg from '../assets/icons/document-open-symbolic.svg?raw';
import documentPropertiesIconSvg from '../assets/icons/document-properties-symbolic.svg?raw';
import documentSaveIconSvg from '../assets/icons/document-save-symbolic.svg?raw';
import homeIconSvg from '../assets/icons/go-home-symbolic.svg?raw';
import libraryIconSvg from '../assets/icons/view-grid-symbolic.svg?raw';
import menuIconSvg from '../assets/icons/open-menu-symbolic.svg?raw';
import languageIconSvg from '../assets/icons/preferences-desktop-locale-symbolic.svg?raw';
import mediaPauseIconSvg from '../assets/icons/media-playback-pause-symbolic.svg?raw';
import mediaPlayIconSvg from '../assets/icons/media-playback-start-symbolic.svg?raw';
import mediaSeekBackwardIconSvg from '../assets/icons/media-seek-backward-symbolic.svg?raw';
import mediaSeekForwardIconSvg from '../assets/icons/media-seek-forward-symbolic.svg?raw';
import reviewIconSvg from '../assets/icons/view-refresh-symbolic.svg?raw';
import searchIconSvg from '../assets/icons/system-search-symbolic.svg?raw';
import starredIconSvg from '../assets/icons/starred-symbolic.svg?raw';
import vocabularyIconSvg from '../assets/icons/view-list-symbolic.svg?raw';
import windowCloseIconSvg from '../assets/icons/window-close-symbolic.svg?raw';
import windowMaximizeIconSvg from '../assets/icons/window-maximize-symbolic.svg?raw';
import windowMinimizeIconSvg from '../assets/icons/window-minimize-symbolic.svg?raw';
import windowRestoreIconSvg from '../assets/icons/window-restore-symbolic.svg?raw';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';
import { createLibraryGateway } from './gateways/create_library_gateway';
import type {
  AppSettings,
  LibraryText,
  ReadingText,
  Tag,
  TermStatus,
  TextDetails,
  VocabularyTerm
} from './domain/library';
import { recommendedDictionaryTemplates } from './ui/dictionaries';
import { createField, createPager, createTagSelector } from './ui/elements';
import {
  arrayBufferToBase64,
  audioImportError,
  buildExternalLookupUrl,
  detectAudioType,
  formatPlaybackTime,
  textImportError
} from './ui/media';
import { termStatusLabel } from './ui/term_status';
import {
  googleTranslateTemplate,
  supportedTranslationLanguages,
  translationLanguageFromTemplate
} from './ui/translations';
import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Desktop application root was not found');
}

const applicationRoot = app;
type WindowResizeDirection = Parameters<
  ReturnType<typeof getCurrentWindow>['startResizeDragging']
>[0];
const usesNativeDatabase = import.meta.env.MODE === 'tauri';
const updatesEnabled = usesNativeDatabase && import.meta.env.VITE_LWT_UPDATES_ENABLED === 'true';
const gateway = createLibraryGateway();
let showingArchivedTexts = false;
let libraryPage = 0;
let tagPage = 0;
let addingText = false;
let pendingLanguage = '';
let libraryQuery = '';
let libraryLanguage = '';
let librarySort: 'recent' | 'title' | 'progress' = 'recent';
let screenKeyboardController: AbortController | undefined;
let selectedLanguageId: number | undefined;
let lookupWindow: WebviewWindow | undefined;
let playbackRatePreference = 1;

async function openExternalLookup(url: string, title: string): Promise<void> {
  if (usesNativeDatabase) {
    if (lookupWindow) {
      await lookupWindow.close().catch(() => undefined);
    }
    const childWindow = new WebviewWindow('external-lookup', {
      url,
      title,
      parent: getCurrentWindow(),
      center: true,
      width: 960,
      height: 720,
      minWidth: 640,
      minHeight: 480,
      resizable: true,
      decorations: true,
      focus: true,
      skipTaskbar: true,
      preventOverflow: { width: 48, height: 48 }
    });
    lookupWindow = childWindow;
    await new Promise<void>((resolve, reject) => {
      void childWindow.once('tauri://created', () => {
        resolve();
      });
      void childWindow.once<string>('tauri://error', (event) => {
        lookupWindow = undefined;
        reject(new Error(event.payload || 'Could not open the dictionary window.'));
      });
      void childWindow.once('tauri://destroyed', () => {
        if (lookupWindow === childWindow) {
          lookupWindow = undefined;
        }
      });
    });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

const adwaitaIconMarkup = {
  add: addIconSvg,
  alarm: alarmIconSvg,
  audio: audioIconSvg,
  'audio-volume-high': audioVolumeHighIconSvg,
  'audio-volume-muted': audioVolumeMutedIconSvg,
  checked: checkedIconSvg,
  dictionary: dictionaryIconSvg,
  information: informationIconSvg,
  'document-open': documentOpenIconSvg,
  'document-properties': documentPropertiesIconSvg,
  'document-save': documentSaveIconSvg,
  home: homeIconSvg,
  library: libraryIconSvg,
  menu: menuIconSvg,
  language: languageIconSvg,
  pause: mediaPauseIconSvg,
  play: mediaPlayIconSvg,
  review: reviewIconSvg,
  'seek-backward': mediaSeekBackwardIconSvg,
  'seek-forward': mediaSeekForwardIconSvg,
  search: searchIconSvg,
  starred: starredIconSvg,
  vocabulary: vocabularyIconSvg,
  'window-close': windowCloseIconSvg,
  'window-maximize': windowMaximizeIconSvg,
  'window-minimize': windowMinimizeIconSvg,
  'window-restore': windowRestoreIconSvg
} as const;

type AdwaitaIcon = keyof typeof adwaitaIconMarkup;

function createAdwaitaIcon(name: AdwaitaIcon): SVGSVGElement {
  const parsed = new DOMParser().parseFromString(
    adwaitaIconMarkup[name],
    'image/svg+xml'
  ).documentElement;
  if (!(parsed instanceof SVGSVGElement)) {
    throw new Error(`Adwaita icon “${name}” could not be parsed`);
  }
  const icon = document.importNode(parsed, true);
  icon.setAttribute('class', `adw-icon adw-icon--${name}`);
  icon.removeAttribute('width');
  icon.removeAttribute('height');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  return icon;
}

const commonLearningLanguages = [
  'Arabic',
  'Chinese',
  'Dutch',
  'English',
  'French',
  'German',
  'Italian',
  'Japanese',
  'Korean',
  'Polish',
  'Portuguese',
  'Russian',
  'Spanish',
  'Swedish',
  'Turkish',
  'Ukrainian'
] as const;

function createLanguageNameControl(): {
  element: HTMLElement;
  trigger: HTMLButtonElement;
  customInput: HTMLInputElement;
  value: () => string;
  reset: () => void;
  reportValidity: () => boolean;
} {
  const element = document.createElement('div');
  element.className = 'language-name-control';
  const hiddenInput = document.createElement('input');
  hiddenInput.type = 'hidden';
  hiddenInput.name = 'language';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'language-name-trigger';
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  const triggerLabel = document.createElement('span');
  triggerLabel.textContent = 'Choose a language';
  const chevron = document.createElement('span');
  chevron.className = 'language-name-trigger__chevron';
  chevron.setAttribute('aria-hidden', 'true');
  trigger.append(triggerLabel, chevron);
  const menu = document.createElement('div');
  menu.className = 'language-name-menu';
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  let selectedValue = '';
  const optionButtons: HTMLButtonElement[] = [];

  const customInput = document.createElement('input');
  customInput.name = 'customLanguage';
  customInput.maxLength = 40;
  customInput.placeholder = 'Enter the language name';
  customInput.autocomplete = 'off';
  customInput.hidden = true;
  const updateCustomState = (focus = true): void => {
    const custom = selectedValue === '__other__';
    customInput.hidden = !custom;
    customInput.required = custom;
    if (custom && focus) {
      customInput.focus();
    } else {
      if (!custom) {
        customInput.value = '';
      }
    }
  };

  const setOpen = (open: boolean): void => {
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    element.classList.toggle('is-open', open);
  };
  const selectLanguage = (value: string, label: string): void => {
    selectedValue = value;
    hiddenInput.value = value;
    triggerLabel.textContent = label;
    trigger.classList.add('has-value');
    trigger.classList.remove('is-invalid');
    trigger.removeAttribute('aria-invalid');
    optionButtons.forEach((option) => {
      option.setAttribute('aria-selected', String(option.dataset.value === value));
    });
    setOpen(false);
    updateCustomState();
    element.dispatchEvent(new Event('languagechange'));
    if (value !== '__other__') {
      trigger.focus();
    }
  };
  for (const [value, label] of [
    ...commonLearningLanguages.map((name) => [name, name] as const),
    ['__other__', 'Other language…'] as const
  ]) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'language-name-option';
    option.dataset.value = value;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', 'false');
    option.textContent = label;
    option.addEventListener('click', () => selectLanguage(value, label));
    optionButtons.push(option);
    menu.append(option);
  }
  trigger.addEventListener('click', () => {
    const open = menu.hidden === true;
    setOpen(open);
    if (open) {
      window.setTimeout(() => {
        (
          optionButtons.find(({ dataset }) => dataset.value === selectedValue) ??
          optionButtons[0]
        )?.focus();
      });
    }
  });
  const moveOptionFocus = (direction: 1 | -1): void => {
    const index = Math.max(0, optionButtons.indexOf(document.activeElement as HTMLButtonElement));
    optionButtons[
      (index + direction + optionButtons.length) % optionButtons.length
    ]?.focus();
  };
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveOptionFocus(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      trigger.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      optionButtons[event.key === 'Home' ? 0 : optionButtons.length - 1]?.focus();
    }
  });
  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      optionButtons[event.key === 'ArrowDown' ? 0 : optionButtons.length - 1]?.focus();
    }
  });
  element.addEventListener('focusout', () => {
    window.setTimeout(() => {
      if (!element.contains(document.activeElement)) {
        setOpen(false);
      }
    });
  });
  customInput.addEventListener('input', () => {
    hiddenInput.value = customInput.value.trim();
  });
  element.append(hiddenInput, trigger, menu, customInput);
  return {
    element,
    trigger,
    customInput,
    value: () =>
      selectedValue === '__other__' ? customInput.value.trim() : selectedValue,
    reset: () => {
      selectedValue = '';
      hiddenInput.value = '';
      triggerLabel.textContent = 'Choose a language';
      trigger.classList.remove('has-value', 'is-invalid');
      trigger.removeAttribute('aria-invalid');
      customInput.value = '';
      optionButtons.forEach((option) => option.setAttribute('aria-selected', 'false'));
      setOpen(false);
      updateCustomState(false);
    },
    reportValidity: () => {
      if (!selectedValue) {
        trigger.classList.add('is-invalid');
        trigger.setAttribute('aria-invalid', 'true');
        trigger.focus();
        return false;
      }
      return customInput.hidden === true || customInput.reportValidity();
    }
  };
}

function applyRecommendedDictionaries(
  language: string,
  nativeLanguage: string,
  primary: HTMLInputElement,
  secondary: HTMLInputElement,
  summary: HTMLElement
): void {
  const recommendations = recommendedDictionaryTemplates(language, nativeLanguage);
  primary.value = recommendations.primaryUrl;
  secondary.value = recommendations.secondaryUrl;
  summary.textContent = `Recommended: ${recommendations.primaryName} and ${recommendations.secondaryName}. Both templates can be edited.`;
}

function createCombobox(select: HTMLSelectElement): HTMLElement {
  const element = document.createElement('div');
  element.className = 'app-combobox';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'app-combobox__trigger';
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  const accessibleName = select.getAttribute('aria-label');
  if (accessibleName) {
    trigger.setAttribute('aria-label', accessibleName);
  }
  const label = document.createElement('span');
  const chevron = document.createElement('span');
  chevron.className = 'app-combobox__chevron';
  chevron.setAttribute('aria-hidden', 'true');
  trigger.append(label, chevron);
  const menu = document.createElement('div');
  menu.className = 'app-combobox__menu';
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  const optionButtons: HTMLButtonElement[] = [];

  const setOpen = (open: boolean): void => {
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    element.classList.toggle('is-open', open);
  };
  const sync = (): void => {
    const selected = select.selectedOptions[0];
    label.textContent = selected?.textContent ?? '';
    trigger.disabled = select.disabled;
    optionButtons.forEach((option) => {
      option.setAttribute('aria-selected', String(option.dataset.value === select.value));
    });
  };
  for (const sourceOption of select.options) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'app-combobox__option';
    option.dataset.value = sourceOption.value;
    option.setAttribute('role', 'option');
    option.disabled = sourceOption.disabled;
    option.textContent = sourceOption.textContent;
    option.addEventListener('click', () => {
      select.value = sourceOption.value;
      sync();
      setOpen(false);
      select.dispatchEvent(new Event('change', { bubbles: true }));
      trigger.focus();
    });
    optionButtons.push(option);
    menu.append(option);
  }
  trigger.addEventListener('click', () => {
    const open = menu.hidden === true;
    setOpen(open);
    if (open) {
      window.setTimeout(() => {
        (
          optionButtons.find(({ dataset }) => dataset.value === select.value) ??
          optionButtons.find(({ disabled }) => !disabled)
        )?.focus();
      });
    }
  });
  const enabledOptions = (): HTMLButtonElement[] =>
    optionButtons.filter(({ disabled }) => !disabled);
  menu.addEventListener('keydown', (event) => {
    const options = enabledOptions();
    const current = Math.max(0, options.indexOf(document.activeElement as HTMLButtonElement));
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      options[(current + direction + options.length) % options.length]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      trigger.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      options[event.key === 'Home' ? 0 : options.length - 1]?.focus();
    }
  });
  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      const options = enabledOptions();
      options[event.key === 'ArrowDown' ? 0 : options.length - 1]?.focus();
    }
  });
  element.addEventListener('focusout', () => {
    window.setTimeout(() => {
      if (!element.contains(document.activeElement)) {
        setOpen(false);
      }
    });
  });
  select.addEventListener('change', sync);
  select.hidden = true;
  select.classList.add('app-combobox__native');
  element.append(select, trigger, menu);
  sync();
  return element;
}

function createTranslationLanguageControl(): {
  element: HTMLElement;
  select: HTMLSelectElement;
} {
  const select = document.createElement('select');
  select.name = 'translationLanguage';
  select.required = true;
  select.setAttribute('aria-label', 'Native language');
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Choose a language';
  placeholder.disabled = true;
  placeholder.selected = true;
  select.append(placeholder);
  for (const language of supportedTranslationLanguages) {
    const option = document.createElement('option');
    option.value = language;
    option.textContent = language;
    select.append(option);
  }
  const element = createCombobox(select);
  element.classList.add('translation-language-control');
  return { element, select };
}

function createImportPanel(
  message = '',
  editingText?: TextDetails,
  tags: readonly Tag[] = [],
  selectedTagIds: readonly number[] = [],
  defaultLanguage = '',
  configuredLanguages: readonly string[] = []
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

  const selectedLanguage = editingText?.language ?? defaultLanguage;
  const languageLocked = editingText === undefined && selectedLanguage !== '';
  let language: HTMLInputElement | HTMLSelectElement;
  let languageControl: HTMLElement;
  if (languageLocked) {
    const inheritedLanguage = document.createElement('input');
    inheritedLanguage.type = 'hidden';
    inheritedLanguage.name = 'language';
    inheritedLanguage.value = selectedLanguage;
    language = inheritedLanguage;
    languageControl = inheritedLanguage;
    form.classList.add('text-form--language-locked');
  } else {
    const languageSelect = document.createElement('select');
    languageSelect.name = 'language';
    languageSelect.required = true;
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Choose a language';
    placeholder.disabled = true;
    languageSelect.append(placeholder);
    for (const languageName of configuredLanguages) {
      const option = document.createElement('option');
      option.value = languageName;
      option.textContent = languageName;
      languageSelect.append(option);
    }
    languageSelect.value = selectedLanguage;
    language = languageSelect;
    languageControl = createField('Language', createCombobox(languageSelect));
  }

  const title = document.createElement('input');
  title.name = 'title';
  title.required = true;
  title.maxLength = 200;
  title.value = editingText?.title ?? '';

  const file = document.createElement('input');
  file.type = 'file';
  file.className = 'file-picker__input';
  file.accept = '.txt,text/plain';
  const fileField = document.createElement('div');
  fileField.className = 'text-form__file-field';
  const fileCaption = document.createElement('span');
  fileCaption.className = 'text-form__field-caption';
  fileCaption.textContent = 'Load a .txt file';
  const filePicker = document.createElement('label');
  filePicker.className = 'file-picker';
  const fileIcon = document.createElement('span');
  fileIcon.className = 'file-picker__icon';
  fileIcon.append(createAdwaitaIcon('document-open'));
  const fileCopy = document.createElement('span');
  fileCopy.className = 'file-picker__copy';
  const fileTitle = document.createElement('strong');
  fileTitle.textContent = 'Choose a text file';
  const fileHelp = document.createElement('small');
  fileHelp.textContent = 'Click or drop · UTF-8 plain text · maximum 65 KB';
  fileCopy.append(fileTitle, fileHelp);
  const fileName = document.createElement('span');
  fileName.className = 'file-picker__name';
  fileName.textContent = 'Browse…';
  filePicker.append(file, fileIcon, fileCopy, fileName);
  fileField.append(fileCaption, filePicker);

  const audioFile = document.createElement('input');
  audioFile.type = 'file';
  audioFile.className = 'file-picker__input audio-file-input';
  const audioField = document.createElement('div');
  audioField.className = 'text-form__file-field text-form__audio-field';
  const audioCaption = document.createElement('span');
  audioCaption.className = 'text-form__field-caption';
  audioCaption.textContent = editingText?.hasAudio
    ? 'Replace audio (optional)'
    : 'Audio file (optional)';
  const audioPicker = document.createElement('label');
  audioPicker.className = 'file-picker file-picker--audio';
  const audioIcon = document.createElement('span');
  audioIcon.className = 'file-picker__icon';
  audioIcon.append(createAdwaitaIcon('audio'));
  const audioCopy = document.createElement('span');
  audioCopy.className = 'file-picker__copy';
  const audioTitle = document.createElement('strong');
  audioTitle.textContent = editingText?.hasAudio
    ? 'Choose a replacement audio file'
    : 'Choose an audio file';
  const audioHelp = document.createElement('small');
  audioHelp.textContent = 'Click or drop · MP3, M4A, OGG, WAV, WebM or FLAC · maximum 50 MB';
  audioCopy.append(audioTitle, audioHelp);
  const audioName = document.createElement('span');
  audioName.className = 'file-picker__name';
  audioName.textContent = editingText?.hasAudio ? 'Audio saved' : 'Browse…';
  audioPicker.classList.toggle('has-saved-file', editingText?.hasAudio === true);
  audioPicker.append(audioFile, audioIcon, audioCopy, audioName);
  audioField.append(audioCaption, audioPicker);

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
  const tagSelector = createTagSelector(tags, selectedTagIds, () => navigate(renderTags));

  const contentHelp = document.createElement('small');
  contentHelp.textContent = 'Maximum: 65,000 bytes. Soft hyphens are removed when saved.';

  const status = document.createElement('p');
  status.className = 'form-status';
  status.setAttribute('role', 'status');
  status.textContent = message;

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'primary-action';
  submit.textContent = editingText ? 'Save changes' : 'Save to library';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'button-secondary';
  cancel.textContent = editingText ? 'Cancel editing' : 'Cancel';
  cancel.addEventListener('click', () => {
    addingText = false;
    pendingLanguage = '';
    void render();
  });

  const removeAudio = document.createElement('button');
  removeAudio.type = 'button';
  removeAudio.className = 'button-secondary remove-audio';
  removeAudio.textContent = 'Remove saved audio';
  removeAudio.hidden = !editingText?.hasAudio;
  removeAudio.addEventListener('click', () => {
    if (
      !editingText ||
      !window.confirm(
        'Remove the saved audio from this text? The text and learning progress will be kept.'
      )
    ) {
      return;
    }
    removeAudio.disabled = true;
    status.className = 'form-status';
    status.textContent = 'Removing audio…';
    void gateway
      .removeTextAudio(editingText.id)
      .then(() => render('Saved audio was removed.', editingText.id))
      .catch((error: unknown) => {
        removeAudio.disabled = false;
        status.className = 'form-status form-status--error';
        status.textContent = error instanceof Error ? error.message : String(error);
      });
  });

  const enableFileDrop = (
    picker: HTMLElement,
    receiveFile: (selectedFile: File) => void
  ): void => {
    let dragDepth = 0;
    picker.addEventListener('dragenter', (event) => {
      event.preventDefault();
      dragDepth += 1;
      picker.classList.add('is-drag-over');
    });
    picker.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
    });
    picker.addEventListener('dragleave', () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) {
        picker.classList.remove('is-drag-over');
      }
    });
    picker.addEventListener('drop', (event) => {
      event.preventDefault();
      event.stopPropagation();
      dragDepth = 0;
      picker.classList.remove('is-drag-over');
      const droppedFile = event.dataTransfer?.files[0];
      if (droppedFile) {
        receiveFile(droppedFile);
      }
    });
  };

  let handledTextFile: File | undefined;
  const loadTextFile = (selectedFile: File | undefined): void => {
    if (!selectedFile || selectedFile === handledTextFile) {
      return;
    }
    handledTextFile = selectedFile;
    const importError = textImportError(selectedFile);
    if (importError) {
      file.value = '';
      handledTextFile = undefined;
      fileTitle.textContent = 'Choose a text file';
      fileName.textContent = 'Browse…';
      filePicker.classList.remove('has-file');
      status.className = 'form-status form-status--error';
      status.textContent = importError;
      return;
    }
    fileTitle.textContent = 'Text file selected';
    fileName.textContent = selectedFile.name;
    filePicker.classList.add('has-file');

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
        file.value = '';
        handledTextFile = undefined;
        fileTitle.textContent = 'Choose a text file';
        fileName.textContent = 'Browse…';
        filePicker.classList.remove('has-file');
        status.className = 'form-status form-status--error';
        status.textContent = 'The selected file could not be read.';
      });
  };
  file.addEventListener('input', () => loadTextFile(file.files?.[0]));
  file.addEventListener('change', () => loadTextFile(file.files?.[0]));
  enableFileDrop(filePicker, loadTextFile);

  let selectedAudioFile: File | undefined;
  const selectAudioFile = (selectedAudio: File | undefined): void => {
    if (!selectedAudio) {
      return;
    }
    const importError = audioImportError(selectedAudio);
    if (importError) {
      audioFile.value = '';
      selectedAudioFile = undefined;
      audioName.textContent = editingText?.hasAudio ? 'Audio saved' : 'Browse…';
      audioPicker.classList.remove('has-file');
      status.className = 'form-status form-status--error';
      status.textContent = importError;
      return;
    }
    selectedAudioFile = selectedAudio;
    audioName.textContent = selectedAudio.name;
    audioPicker.classList.add('has-file');
    status.className = 'form-status';
    status.textContent = `${selectedAudio.name} selected. It will be saved with the text.`;
  };
  audioFile.addEventListener('input', () => selectAudioFile(audioFile.files?.[0]));
  audioFile.addEventListener('change', () => selectAudioFile(audioFile.files?.[0]));
  enableFileDrop(audioPicker, selectAudioFile);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
      return;
    }
    const selectedAudio = selectedAudioFile;
    if (selectedAudio) {
      const importError = audioImportError(selectedAudio);
      if (importError) {
        status.className = 'form-status form-status--error';
        status.textContent = importError;
        return;
      }
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
        if (!selectedAudio) {
          return saved;
        }
        status.textContent = 'Saving audio…';
        await gateway.saveTextAudio({
          textId: saved.id,
          fileName: selectedAudio.name,
          mediaType: detectAudioType(selectedAudio),
          dataBase64: arrayBufferToBase64(await selectedAudio.arrayBuffer())
        });
        return saved;
      })
      .then((saved) => {
        addingText = false;
        pendingLanguage = '';
        return render(
          editingText
            ? `“${saved.title}” was updated.`
            : `“${saved.title}” was added to the library.`
        );
      })
      .catch((error: unknown) => {
        submit.disabled = false;
        status.className = 'form-status form-status--error';
        status.textContent = error instanceof Error ? error.message : String(error);
      });
  });

  const contentField = createField('Text', content);
  contentField.className = 'text-form__content';
  contentField.append(contentHelp);
  const titleField = createField('Title', title);
  if (languageLocked) {
    titleField.classList.add('text-form__title--wide');
  }
  const actions = document.createElement('div');
  actions.className = 'text-form__actions';
  actions.append(submit, cancel, removeAudio);
  form.append(
    languageControl,
    titleField,
    fileField,
    audioField,
    contentField,
    createField('Source URL (optional)', sourceUri),
    tagSelector.element,
    actions,
    status
  );
  panel.append(heading, description, form);
  return panel;
}

function updateTermButton(button: HTMLButtonElement, status: TermStatus): void {
  const label = termStatusLabel(status);
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

function createAudioPlayer(source: string, label: string): HTMLElement {
  const player = document.createElement('div');
  player.className = 'audio-player';
  player.setAttribute('role', 'group');
  player.setAttribute('aria-label', label);

  const media = document.createElement('audio');
  media.className = 'audio-player__media';
  media.preload = 'metadata';
  media.src = source;
  media.setAttribute('aria-label', label);

  const createControl = (
    className: string,
    accessibleLabel: string,
    icon: AdwaitaIcon
  ): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `audio-player__button ${className}`;
    button.title = accessibleLabel;
    button.setAttribute('aria-label', accessibleLabel);
    button.append(createAdwaitaIcon(icon));
    return button;
  };

  const transport = document.createElement('div');
  transport.className = 'audio-player__transport';
  const rewind = createControl('audio-player__seek', 'Go back 10 seconds', 'seek-backward');
  const rewindAmount = document.createElement('span');
  rewindAmount.className = 'audio-player__seek-amount';
  rewindAmount.textContent = '10';
  rewind.append(rewindAmount);
  const play = createControl('audio-player__play', 'Play', 'play');
  const forward = createControl('audio-player__seek', 'Go forward 10 seconds', 'seek-forward');
  const forwardAmount = document.createElement('span');
  forwardAmount.className = 'audio-player__seek-amount';
  forwardAmount.textContent = '10';
  forward.append(forwardAmount);
  transport.append(rewind, play, forward);

  const timeline = document.createElement('div');
  timeline.className = 'audio-player__timeline';
  const seek = document.createElement('input');
  seek.type = 'range';
  seek.min = '0';
  seek.max = '0';
  seek.step = '0.1';
  seek.value = '0';
  seek.setAttribute('aria-label', 'Audio position');
  const time = document.createElement('div');
  time.className = 'audio-player__time';
  const currentTime = document.createElement('span');
  currentTime.textContent = '0:00';
  const duration = document.createElement('span');
  duration.textContent = '0:00';
  time.append(currentTime, duration);
  timeline.append(seek, time);

  const speedSelect = document.createElement('select');
  speedSelect.setAttribute('aria-label', 'Playback speed');
  for (const rate of [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]) {
    const option = document.createElement('option');
    option.value = String(rate);
    option.textContent = `${rate}×`;
    speedSelect.append(option);
  }
  speedSelect.value = String(playbackRatePreference);
  const speed = createCombobox(speedSelect);
  speed.classList.add('audio-player__speed');

  const volume = document.createElement('div');
  volume.className = 'audio-player__volume';
  const mute = createControl('audio-player__mute', 'Mute', 'audio-volume-high');
  const volumeLevel = document.createElement('input');
  volumeLevel.type = 'range';
  volumeLevel.min = '0';
  volumeLevel.max = '1';
  volumeLevel.step = '0.05';
  volumeLevel.value = '1';
  volumeLevel.setAttribute('aria-label', 'Volume');
  volume.append(mute, volumeLevel);

  const feedback = document.createElement('span');
  feedback.className = 'sr-only';
  feedback.setAttribute('role', 'status');

  const syncPlayState = (): void => {
    const playing = !media.paused && !media.ended;
    play.replaceChildren(createAdwaitaIcon(playing ? 'pause' : 'play'));
    play.title = playing ? 'Pause' : 'Play';
    play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  };
  const syncTimeline = (): void => {
    const mediaDuration = Number.isFinite(media.duration) ? media.duration : 0;
    seek.max = String(mediaDuration);
    seek.value = String(Math.min(media.currentTime, mediaDuration));
    currentTime.textContent = formatPlaybackTime(media.currentTime);
    duration.textContent = formatPlaybackTime(mediaDuration);
    seek.setAttribute(
      'aria-valuetext',
      `${formatPlaybackTime(media.currentTime)} of ${formatPlaybackTime(mediaDuration)}`
    );
  };
  const syncVolumeState = (): void => {
    const muted = media.muted || media.volume === 0;
    mute.replaceChildren(
      createAdwaitaIcon(muted ? 'audio-volume-muted' : 'audio-volume-high')
    );
    mute.title = muted ? 'Unmute' : 'Mute';
    mute.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
  };
  const moveBy = (seconds: number): void => {
    const upperBound = Number.isFinite(media.duration)
      ? media.duration
      : Math.max(0, media.currentTime + seconds);
    media.currentTime = Math.min(upperBound, Math.max(0, media.currentTime + seconds));
    syncTimeline();
  };

  media.playbackRate = playbackRatePreference;
  play.addEventListener('click', () => {
    if (media.paused || media.ended) {
      void media.play().catch(() => {
        feedback.textContent = 'The audio could not be played.';
      });
    } else {
      media.pause();
    }
  });
  rewind.addEventListener('click', () => moveBy(-10));
  forward.addEventListener('click', () => moveBy(10));
  seek.addEventListener('input', () => {
    media.currentTime = Number(seek.value);
    syncTimeline();
  });
  speedSelect.addEventListener('change', () => {
    playbackRatePreference = Number(speedSelect.value);
    media.playbackRate = playbackRatePreference;
    feedback.textContent = `Playback speed set to ${speedSelect.value} times.`;
  });
  mute.addEventListener('click', () => {
    media.muted = !media.muted;
    syncVolumeState();
  });
  volumeLevel.addEventListener('input', () => {
    media.volume = Number(volumeLevel.value);
    media.muted = media.volume === 0;
    syncVolumeState();
  });
  media.addEventListener('loadedmetadata', syncTimeline);
  media.addEventListener('durationchange', syncTimeline);
  media.addEventListener('timeupdate', syncTimeline);
  media.addEventListener('play', syncPlayState);
  media.addEventListener('pause', syncPlayState);
  media.addEventListener('ended', syncPlayState);

  player.append(media, transport, timeline, speed, volume, feedback);
  return player;
}

async function renderReading(textId: number): Promise<void> {
  const [reading, tags, audio] = await Promise.all([
    gateway.getReadingText(textId),
    gateway.listTags(),
    gateway.getTextAudio(textId)
  ]);
  const shell = document.createElement('main');
  shell.className = 'shell reading-shell';

  const finishButtons: HTMLButtonElement[] = [];
  const createFinishButton = (placement: 'header'): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `finish-lesson primary-button finish-lesson--${placement}`;
    button.append(createAdwaitaIcon('checked'), document.createTextNode('Finish lesson'));
    finishButtons.push(button);
    return button;
  };
  const setFinishState = (label: string, disabled: boolean): void => {
    finishButtons.forEach((button) => {
      button.disabled = disabled;
      button.replaceChildren(createAdwaitaIcon('checked'), document.createTextNode(label));
    });
  };

  const header = document.createElement('header');
  header.className = 'reading-header';
  const titleRow = document.createElement('div');
  titleRow.className = 'reading-title-row';
  const titleCopy = document.createElement('div');
  titleCopy.className = 'reading-title-group';
  const title = document.createElement('h1');
  title.textContent = reading.title;
  const language = document.createElement('p');
  language.className = 'eyebrow';
  language.textContent = reading.language.toLocaleUpperCase();
  titleCopy.append(language, title);
  const headerActions = document.createElement('div');
  headerActions.className = 'reading-header__actions';
  const finish = createFinishButton('header');
  headerActions.append(finish);
  titleRow.append(titleCopy, headerActions);
  const progress = document.createElement('div');
  progress.className = 'reading-progress';
  const meter = document.createElement('progress');
  const progressLabel = document.createElement('p');
  progressLabel.className = 'reading-progress-label';
  updateReadingProgress(reading, reading.knownTerms, meter, progressLabel);
  progress.append(meter, progressLabel);
  header.append(titleRow, progress);
  if (audio) {
    const audioPanel = document.createElement('section');
    audioPanel.className = 'reading-audio';
    const audioIdentity = document.createElement('div');
    audioIdentity.className = 'reading-audio__identity';
    const audioPanelIcon = document.createElement('span');
    audioPanelIcon.className = 'reading-audio__icon';
    audioPanelIcon.append(createAdwaitaIcon('audio'));
    const audioCopy = document.createElement('div');
    const audioLabel = document.createElement('strong');
    audioLabel.textContent = 'Lesson audio';
    const audioFileName = document.createElement('span');
    audioFileName.textContent = audio.fileName;
    audioCopy.append(audioLabel, audioFileName);
    audioIdentity.append(audioPanelIcon, audioCopy);
    const player = createAudioPlayer(
      `data:${audio.mediaType};base64,${audio.dataBase64}`,
      `Audio for ${reading.title}`
    );
    audioPanel.append(audioIdentity, player);
    header.append(audioPanel);
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
  expressionControls.append(expressionToggle, expressionStatus);
  const expressionList = document.createElement('div');
  expressionList.className = 'expression-list';
  expressionList.setAttribute('role', 'list');
  expressionList.setAttribute('aria-label', 'Saved expressions');
  const expressionCarousel = document.createElement('div');
  expressionCarousel.className = 'expression-carousel';
  expressionCarousel.hidden = true;
  const previousExpressions = document.createElement('button');
  previousExpressions.type = 'button';
  previousExpressions.className = 'expression-carousel__previous';
  previousExpressions.setAttribute('aria-label', 'Previous expressions');
  previousExpressions.textContent = '‹';
  const nextExpressions = document.createElement('button');
  nextExpressions.type = 'button';
  nextExpressions.className = 'expression-carousel__next';
  nextExpressions.setAttribute('aria-label', 'Next expressions');
  nextExpressions.textContent = '›';
  expressionCarousel.append(previousExpressions, expressionList, nextExpressions);
  const updateExpressionCarousel = (): void => {
    const hasOverflow = expressionList.scrollWidth > expressionList.clientWidth + 1;
    expressionCarousel.classList.toggle('has-overflow', hasOverflow);
    previousExpressions.disabled = expressionList.scrollLeft <= 1;
    nextExpressions.disabled =
      !hasOverflow ||
      expressionList.scrollLeft + expressionList.clientWidth >=
        expressionList.scrollWidth - 1;
  };
  const scrollExpressions = (direction: -1 | 1): void => {
    expressionList.scrollBy({
      left: direction * Math.max(160, expressionList.clientWidth * 0.75),
      behavior: 'smooth'
    });
  };
  previousExpressions.addEventListener('click', () => scrollExpressions(-1));
  nextExpressions.addEventListener('click', () => scrollExpressions(1));
  expressionList.addEventListener('scroll', updateExpressionCarousel);
  const expressionResizeObserver = new ResizeObserver(() => {
    if (!expressionList.isConnected) {
      expressionResizeObserver.disconnect();
      return;
    }
    updateExpressionCarousel();
  });
  expressionResizeObserver.observe(expressionList);
  guide.append(expressionControls, expressionCarousel);

  const termButtons = new Map<string, HTMLButtonElement[]>();
  const positionButtons = new Map<string, HTMLButtonElement>();
  const editor = document.createElement('dialog');
  editor.className = 'term-editor';
  const addEditorCloseButton = (): void => {
    const closeEditor = document.createElement('button');
    closeEditor.type = 'button';
    closeEditor.className = 'term-editor__close';
    closeEditor.setAttribute('aria-label', 'Close term editor');
    closeEditor.append(createAdwaitaIcon('window-close'));
    closeEditor.addEventListener('click', () => editor.close());
    editor.prepend(closeEditor);
  };
  let editorRequest = 0;

  const openTermEditor = (normalized: string): void => {
    const request = ++editorRequest;
    editor.replaceChildren();
    const loading = document.createElement('p');
    loading.textContent = 'Loading term…';
    editor.append(loading);
    addEditorCloseButton();
    if (!editor.open) {
      editor.showModal();
    }

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
        const lookupFeedback = document.createElement('p');
        lookupFeedback.className = 'term-editor__lookup-error form-status--error';
        lookupFeedback.hidden = true;
        lookupFeedback.setAttribute('role', 'alert');
        for (const [label, template, iconName, windowTitle] of [
          ['Look up in dictionary', reading.dictionaryUri1, 'dictionary', 'Dictionary'],
          [
            'Look up in secondary dictionary',
            reading.dictionaryUri2,
            'dictionary',
            'Secondary dictionary'
          ],
          [
            term.wordCount > 1 ? 'Translate expression' : 'Translate word',
            reading.googleTranslateUri,
            'language',
            'Translation'
          ]
        ] as const) {
          const url = buildExternalLookupUrl(template, term.normalized);
          if (!url) {
            continue;
          }
          const link = document.createElement('a');
          link.className = 'secondary-button term-editor__lookup';
          link.href = url;
          link.rel = 'external noreferrer';
          const linkLabel = document.createElement('span');
          linkLabel.textContent = label;
          link.append(createAdwaitaIcon(iconName), linkLabel);
          link.addEventListener('click', (event) => {
            event.preventDefault();
            lookupFeedback.hidden = true;
            void openExternalLookup(url, `${windowTitle} — ${term.displayText}`).catch(
              (error: unknown) => {
                lookupFeedback.textContent =
                  error instanceof Error
                    ? error.message
                    : 'Could not open the external dictionary.';
                lookupFeedback.hidden = false;
              }
            );
          });
          lookupLinks.append(link);
        }
        lookupLinks.append(lookupFeedback);

        const form = document.createElement('form');
        form.className = 'term-editor__form';
        const status = document.createElement('select');
        for (const [value, label] of [
          [1, 'Learning 1'],
          [2, 'Learning 2'],
          [3, 'Learning 3'],
          [4, 'Learning 4'],
          [5, 'Known'],
          [98, 'Ignored'],
          [99, 'Well Known']
        ] as const) {
          const option = document.createElement('option');
          option.value = String(value);
          option.textContent = label;
          status.append(option);
        }
        status.value = String(term.status === 0 ? 1 : term.status);

        const translation = document.createElement('textarea');
        translation.rows = 3;
        translation.maxLength = 500;
        translation.value = term.translation;
        const romanization = document.createElement('input');
        romanization.maxLength = 100;
        romanization.value = term.romanization;
        const tagSelector = createTagSelector(tags, assignedTagIds, () => navigate(renderTags));

        const actions = document.createElement('div');
        actions.className = 'term-editor__actions';
        const save = document.createElement('button');
        save.type = 'submit';
        save.className = 'primary-action';
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
              status: Number(status.value) as 1 | 2 | 3 | 4 | 5 | 98 | 99,
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
              status.dispatchEvent(new Event('change'));
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
          createField('Status', createCombobox(status)),
          createField('Translation', translation),
          createField('Romanization (optional)', romanization),
          tagSelector.element,
          actions,
          feedback
        );
        editor.replaceChildren(heading, normalizedLabel, lookupLinks, form);
        addEditorCloseButton();
      })
      .catch((error: unknown) => {
        if (request === editorRequest) {
          const message = document.createElement('p');
          message.className = 'form-status form-status--error';
          message.textContent = error instanceof Error ? error.message : String(error);
          editor.replaceChildren(message);
          addEditorCloseButton();
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
    chip.setAttribute('role', 'listitem');
    chip.textContent = displayText;
    chip.addEventListener('click', () => openTermEditor(normalized));
    expressionList.append(chip);
    expressionCarousel.hidden = false;
    window.requestAnimationFrame(updateExpressionCarousel);
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
      : '';
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
    const sentenceText = sentence.items
      .map(({ surface }) => surface)
      .join('')
      .trim();
    const sentenceTranslationUrl = buildExternalLookupUrl(
      reading.googleTranslateUri,
      sentenceText
    );
    if (sentenceTranslationUrl) {
      const sentenceActions = document.createElement('span');
      sentenceActions.className = 'reading-sentence__actions';
      const translateSentence = document.createElement('button');
      translateSentence.type = 'button';
      translateSentence.className = 'reading-sentence__translate';
      translateSentence.append(
        createAdwaitaIcon('language'),
        document.createTextNode('Translate sentence')
      );
      const translationStatus = document.createElement('span');
      translationStatus.className = 'sr-only';
      translationStatus.setAttribute('role', 'status');
      translateSentence.addEventListener('click', () => {
        translateSentence.disabled = true;
        void openExternalLookup(
          sentenceTranslationUrl,
          `Translation — Sentence ${sentence.position}`
        )
          .catch((error: unknown) => {
            translationStatus.textContent =
              error instanceof Error ? error.message : 'Could not open the translation window.';
          })
          .finally(() => {
            translateSentence.disabled = false;
          });
      });
      sentenceActions.append(translateSentence, translationStatus);
      paragraph.append(sentenceActions);
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

  const workspace = document.createElement('div');
  workspace.className = 'reading-workspace';
  const studyColumn = document.createElement('div');
  studyColumn.className = 'reading-study';
  studyColumn.append(article);
  workspace.append(studyColumn, editor);

  const completionNotice = document.createElement('div');
  completionNotice.className = 'completion-notice';
  completionNotice.setAttribute('role', 'status');
  completionNotice.hidden = true;

  const finishLesson = (): void => {
    setFinishState('Finishing…', true);
    const originallyUnknown = [...termButtons.entries()]
      .filter(([, buttons]) => buttons[0]?.dataset.status === '0')
      .map(([normalized]) => normalized);
    void gateway
      .finishLesson(textId)
      .then((outcome) => {
        originallyUnknown.forEach((normalized) => {
          termButtons.get(normalized)?.forEach((button) => updateTermButton(button, 99));
        });
        updateReadingProgress(reading, outcome.knownTerms, meter, progressLabel);
        setFinishState('Lesson finished', true);
        const message = document.createElement('span');
        message.textContent = `${outcome.markedKnown} unmarked ${
          outcome.markedKnown === 1 ? 'word was' : 'words were'
        } set to Well Known. Learning terms stayed in Vocabulary.`;
        const undo = document.createElement('button');
        undo.type = 'button';
        undo.textContent = 'Undo';
        undo.addEventListener('click', () => {
          undo.disabled = true;
          void gateway
            .undoFinishLesson({ completionId: outcome.completionId })
            .then((undone) => {
              if (undone.revertedTerms !== originallyUnknown.length) {
                return renderReading(textId);
              }
              originallyUnknown.forEach((normalized) => {
                termButtons.get(normalized)?.forEach((button) => updateTermButton(button, 0));
              });
              updateReadingProgress(reading, undone.knownTerms, meter, progressLabel);
              setFinishState('Finish lesson', false);
              completionNotice.textContent = 'Lesson completion undone.';
              window.setTimeout(() => {
                completionNotice.hidden = true;
              }, 800);
              return undefined;
            })
            .catch((error: unknown) => {
              undo.disabled = false;
              completionNotice.textContent =
                error instanceof Error ? error.message : String(error);
            });
        });
        completionNotice.replaceChildren(message, undo);
        completionNotice.hidden = false;
      })
      .catch((error: unknown) => {
        setFinishState('Finish lesson', false);
        completionNotice.textContent = error instanceof Error ? error.message : String(error);
        completionNotice.hidden = false;
      });
  };
  finishButtons.forEach((button) => button.addEventListener('click', finishLesson));

  const fixedHeader = document.createElement('section');
  fixedHeader.className = 'reading-fixed-header';
  fixedHeader.append(header, guide);
  shell.append(fixedHeader, workspace, completionNotice);
  mountScreen(shell, 'reader', reading.language);
}

function detailedStatusLabel(status: TermStatus): string {
  if (status >= 1 && status <= 5) {
    return status === 5 ? 'Known' : `Learning ${status}`;
  }
  if (status === 98) {
    return 'Ignored';
  }
  if (status === 99) {
    return 'Well Known';
  }
  return 'Unknown';
}

function appendHighlightedContext(
  target: HTMLElement,
  context: string | undefined,
  term: string
): void {
  if (!context) {
    target.textContent = 'No sentence context available.';
    return;
  }
  const index = context.toLocaleLowerCase().indexOf(term.toLocaleLowerCase());
  if (index < 0) {
    target.textContent = context;
    return;
  }
  const mark = document.createElement('mark');
  mark.textContent = context.slice(index, index + term.length);
  target.append(
    document.createTextNode(context.slice(0, index)),
    mark,
    document.createTextNode(context.slice(index + term.length))
  );
}

async function renderVocabulary(): Promise<void> {
  const terms = await gateway.listVocabularyTerms();
  const shell = document.createElement('main');
  shell.className = 'shell vocabulary-shell';
  const heading = document.createElement('div');
  heading.className = 'page-heading';
  const headingCopy = document.createElement('div');
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'VOCABULARY';
  const title = document.createElement('h1');
  title.textContent = 'Words and expressions';
  const description = document.createElement('p');
  description.textContent = 'Browse, edit, and review every saved term in your local library.';
  headingCopy.append(eyebrow, title, description);
  const review = document.createElement('button');
  review.type = 'button';
  review.className = 'primary-action';
  review.textContent = 'Review due terms';
  review.addEventListener('click', () => navigate(renderReview));
  heading.append(headingCopy, review);

  const metrics = document.createElement('section');
  metrics.className = 'metric-row';
  for (const [value, label, alert] of [
    [terms.length, 'saved terms', false],
    [terms.filter(({ status }) => status >= 1 && status <= 4).length, 'learning', false],
    [terms.filter(({ status }) => status === 5 || status === 99).length, 'known', false],
    [
      terms.filter(
        ({ status, nextReviewAt }) =>
          status >= 1 &&
          status <= 5 &&
          (!nextReviewAt || new Date(nextReviewAt).getTime() <= Date.now())
      ).length,
      'due for review',
      true
    ]
  ] as const) {
    const card = document.createElement('article');
    if (alert) {
      card.className = 'metric-alert';
    }
    const strong = document.createElement('strong');
    strong.textContent = String(value);
    const span = document.createElement('span');
    span.textContent = label;
    card.append(strong, span);
    metrics.append(card);
  }

  const card = document.createElement('section');
  card.className = 'vocabulary-card';
  const toolbar = document.createElement('div');
  toolbar.className = 'library-toolbar';
  const searchLabel = document.createElement('label');
  searchLabel.className = 'search-field';
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Term, translation, or source text…';
  search.setAttribute('aria-label', 'Search vocabulary');
  searchLabel.append(createAdwaitaIcon('search'), search);
  const language = document.createElement('select');
  language.setAttribute('aria-label', 'Filter vocabulary by language');
  const allLanguages = document.createElement('option');
  allLanguages.value = '';
  allLanguages.textContent = 'All languages';
  language.append(allLanguages);
  for (const name of [...new Set(terms.map((term) => term.language))].sort()) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    language.append(option);
  }
  const status = document.createElement('select');
  status.setAttribute('aria-label', 'Filter vocabulary by status');
  for (const [value, label] of [
    ['', 'All statuses'],
    ['learning', 'Learning'],
    ['known', 'Known'],
    ['ignored', 'Ignored']
  ] as const) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    status.append(option);
  }
  toolbar.append(searchLabel, createCombobox(language), createCombobox(status));

  const resultBar = document.createElement('div');
  resultBar.className = 'bulk-bar';
  const resultCount = document.createElement('span');
  resultBar.append(resultCount);
  const tableWrap = document.createElement('div');
  tableWrap.className = 'term-table-wrap';
  const table = document.createElement('table');
  table.className = 'term-table';
  const tableHead = document.createElement('thead');
  tableHead.innerHTML =
    '<tr><th>Term</th><th>Translation</th><th>Context</th><th>Status</th><th>Next review</th><th><span class="sr-only">Actions</span></th></tr>';
  const tableBody = document.createElement('tbody');
  table.append(tableHead, tableBody);
  tableWrap.append(table);

  let editorDialog: HTMLDialogElement | undefined;
  const openEditor = (term: VocabularyTerm): void => {
    editorDialog?.remove();
    const dialog = document.createElement('dialog');
    dialog.className = 'editor-dialog vocabulary-editor-dialog';
    const form = document.createElement('form');
    form.className = 'vocabulary-editor';
    const header = document.createElement('div');
    header.className = 'vocabulary-editor__header';
    const headerCopy = document.createElement('div');
    const kicker = document.createElement('p');
    kicker.className = 'eyebrow';
    kicker.textContent = term.language.toLocaleUpperCase();
    const editorTitle = document.createElement('h2');
    editorTitle.textContent = term.displayText;
    const source = document.createElement('p');
    source.textContent = term.sourceTitle
      ? `From “${term.sourceTitle}”`
      : 'Saved vocabulary term';
    headerCopy.append(kicker, editorTitle, source);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'dialog-close';
    close.textContent = 'Close';
    close.addEventListener('click', () => dialog.close());
    header.append(headerCopy, close);

    const context = document.createElement('p');
    context.className = 'vocabulary-editor__context';
    appendHighlightedContext(context, term.context, term.displayText);
    const statusSelect = document.createElement('select');
    statusSelect.name = 'status';
    for (const value of [1, 2, 3, 4, 5, 99, 98] as const) {
      const option = document.createElement('option');
      option.value = String(value);
      option.textContent = detailedStatusLabel(value);
      option.selected = term.status === value;
      statusSelect.append(option);
    }
    const translation = document.createElement('textarea');
    translation.name = 'translation';
    translation.maxLength = 500;
    translation.rows = 3;
    translation.value = term.translation;
    const romanization = document.createElement('input');
    romanization.name = 'romanization';
    romanization.maxLength = 100;
    romanization.value = term.romanization;
    const actions = document.createElement('div');
    actions.className = 'dialog-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => dialog.close());
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'primary-action';
    save.textContent = 'Save term';
    actions.append(cancel, save);
    const feedback = document.createElement('p');
    feedback.className = 'form-status';
    feedback.setAttribute('role', 'status');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      save.disabled = true;
      feedback.className = 'form-status';
      feedback.textContent = 'Saving term…';
      void gateway
        .updateVocabularyTerm({
          id: term.id,
          status: Number(statusSelect.value) as Exclude<TermStatus, 0>,
          translation: translation.value,
          romanization: romanization.value
        })
        .then(() => {
          dialog.close();
          return renderVocabulary();
        })
        .catch((error: unknown) => {
          save.disabled = false;
          feedback.className = 'form-status form-status--error';
          feedback.textContent = error instanceof Error ? error.message : String(error);
        });
    });
    form.append(
      header,
      context,
      createField('Learning status', createCombobox(statusSelect)),
      createField('Translation', translation),
      createField('Romanization (optional)', romanization),
      actions,
      feedback
    );
    dialog.append(form);
    shell.append(dialog);
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    editorDialog = dialog;
    dialog.showModal();
  };

  const renderRows = (): void => {
    const query = search.value.trim().toLocaleLowerCase();
    const filtered = terms.filter((term) => {
      const matchesQuery =
        query === '' ||
        `${term.displayText} ${term.translation} ${term.sourceTitle ?? ''}`
          .toLocaleLowerCase()
          .includes(query);
      const matchesLanguage = language.value === '' || term.language === language.value;
      const matchesStatus =
        status.value === '' ||
        (status.value === 'learning' && term.status >= 1 && term.status <= 4) ||
        (status.value === 'known' && (term.status === 5 || term.status === 99)) ||
        (status.value === 'ignored' && term.status === 98);
      return matchesQuery && matchesLanguage && matchesStatus;
    });
    resultCount.textContent = `${filtered.length} ${
      filtered.length === 1 ? 'result' : 'results'
    }`;
    tableBody.replaceChildren();
    if (filtered.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 6;
      cell.className = 'table-empty';
      cell.textContent =
        terms.length === 0
          ? 'No saved terms yet. Select a word while reading to build your vocabulary.'
          : 'No terms match these filters.';
      row.append(cell);
      tableBody.append(row);
      return;
    }
    for (const term of filtered) {
      const row = document.createElement('tr');
      const termCell = document.createElement('td');
      const termName = document.createElement('strong');
      termName.textContent = term.displayText;
      const termMeta = document.createElement('span');
      termMeta.textContent = `${term.language} · ${term.occurrenceCount} ${
        term.occurrenceCount === 1 ? 'occurrence' : 'occurrences'
      }`;
      termCell.append(termName, termMeta);
      const translationCell = document.createElement('td');
      translationCell.textContent = term.translation || 'No translation';
      const contextCell = document.createElement('td');
      contextCell.className = 'term-context';
      appendHighlightedContext(contextCell, term.context, term.displayText);
      if (term.sourceTitle) {
        const source = document.createElement('span');
        source.textContent = term.sourceTitle;
        contextCell.append(source);
      }
      const statusCell = document.createElement('td');
      const statusPill = document.createElement('span');
      statusPill.className = `status-pill ${
        term.status >= 1 && term.status <= 4
          ? 'status-pill--learning'
          : term.status === 98
            ? 'status-pill--ignored'
            : 'status-pill--known'
      }`;
      statusPill.textContent = detailedStatusLabel(term.status);
      statusCell.append(statusPill);
      const reviewCell = document.createElement('td');
      reviewCell.textContent =
        term.status === 98 || term.status === 99
          ? '—'
          : !term.nextReviewAt || new Date(term.nextReviewAt).getTime() <= Date.now()
            ? 'Now'
            : new Date(term.nextReviewAt).toLocaleDateString();
      const actionCell = document.createElement('td');
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'term-edit-button';
      edit.textContent = 'Edit';
      edit.setAttribute('aria-label', `Edit ${term.displayText}`);
      edit.addEventListener('click', () => openEditor(term));
      actionCell.append(edit);
      row.append(termCell, translationCell, contextCell, statusCell, reviewCell, actionCell);
      tableBody.append(row);
    }
  };
  search.addEventListener('input', renderRows);
  language.addEventListener('change', renderRows);
  status.addEventListener('change', renderRows);
  renderRows();
  card.append(toolbar, resultBar, tableWrap);
  shell.append(heading, metrics, card);
  mountScreen(shell, 'vocabulary', language.value || 'All languages');
}

function reviewInterval(status: TermStatus, rating: 0 | 1 | 2 | 3): string {
  if (rating === 0) return '10 min';
  if (rating === 1) return '1 day';
  if (rating === 3) return '30 days';
  const nextStatus = Math.min(Math.max(status, 1) + 1, 5);
  const days = 1 << Math.min(nextStatus - 1, 5);
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

async function renderReview(): Promise<void> {
  const [queue, settings] = await Promise.all([
    gateway.listReviewTerms(20),
    gateway.appSettings()
  ]);
  const shell = document.createElement('main');
  shell.className = 'shell review-shell review-shell--focused';
  const toolbar = document.createElement('header');
  toolbar.className = 'review-header';
  const headerSpacer = document.createElement('span');
  headerSpacer.className = 'review-header__spacer';
  const heading = document.createElement('h1');
  heading.textContent = 'Review terms';
  heading.className = 'sr-only';
  const progressCopy = document.createElement('div');
  progressCopy.className = 'review-progress-copy';
  const progressLabel = document.createElement('span');
  progressLabel.className = 'review-counter';
  const progress = document.createElement('progress');
  progress.max = Math.max(queue.length, 1);
  progress.value = 0;
  progressCopy.append(progressLabel, progress);
  const end = document.createElement('button');
  end.type = 'button';
  end.textContent = 'End session';
  end.addEventListener('click', () => void renderHome());
  toolbar.append(headerSpacer, progressCopy, end);
  const session = document.createElement('section');
  session.className = 'review-card review-stage';
  const footer = document.createElement('footer');
  footer.className = 'review-footer';
  const estimate = document.createElement('span');
  estimate.textContent = `${queue.length} ${
    queue.length === 1 ? 'term' : 'terms'
  } · about ${Math.max(1, Math.ceil(queue.length / 2))} minutes`;
  const shortcutHelp = document.createElement('span');
  shortcutHelp.textContent = 'Space to reveal · 1–4 to rate';
  footer.append(estimate, shortcutHelp);
  shell.append(toolbar, heading, session, footer);
  mountScreen(shell, 'review');

  let current = 0;
  let revealCurrent: (() => void) | undefined;
  let rateCurrent: ((rating: 0 | 1 | 2 | 3) => void) | undefined;
  const showCard = (): void => {
    const term = queue[current];
    session.replaceChildren();
    session.classList.toggle('review-stage--empty', !term);
    progress.value = current;
    progressLabel.textContent = queue.length === 0 ? 'Review' : `${current + 1} of ${queue.length}`;
    revealCurrent = undefined;
    rateCurrent = undefined;
    if (!term) {
      const done = document.createElement('h2');
      done.textContent = queue.length === 0 ? 'No terms are due' : 'Review complete';
      const message = document.createElement('p');
      message.textContent =
        queue.length === 0
          ? 'Save terms while reading to add them to the review queue.'
          : `${queue.length} terms reviewed in this session.`;
      session.append(done, message);
      progress.value = queue.length;
      progressLabel.textContent =
        queue.length === 0 ? 'Nothing due' : `${queue.length} of ${queue.length}`;
      return;
    }

    const mode = document.createElement('p');
    mode.className = 'eyebrow';
    mode.textContent = `RECOGNITION · ${term.language.toLocaleUpperCase()}`;
    const termHeading = document.createElement('h2');
    termHeading.textContent = term.displayText;
    const context = document.createElement('p');
    context.className = 'review-context';
    appendHighlightedContext(context, term.context, term.displayText);
    const source = document.createElement('p');
    source.className = 'review-source';
    source.textContent = term.sourceTitle ? `From “${term.sourceTitle}”` : '';
    source.hidden = !term.sourceTitle;
    const answer = document.createElement('div');
    answer.className = 'review-answer';
    answer.hidden = true;
    const answerLabel = document.createElement('span');
    answerLabel.textContent = 'Translation';
    const translation = document.createElement('p');
    translation.textContent = term.translation || 'No translation saved';
    const romanization = document.createElement('p');
    romanization.textContent = term.romanization;
    romanization.hidden = term.romanization === '';
    answer.append(answerLabel, translation, romanization);

    const reveal = document.createElement('button');
    reveal.type = 'button';
    reveal.className = 'review-reveal';
    reveal.textContent = 'Show answer';
    reveal.dataset.shortcut = 'Space';
    const ratings = document.createElement('div');
    ratings.className = 'review-ratings';
    ratings.hidden = true;
    const submitRating = (rating: 0 | 1 | 2 | 3): void => {
      ratings.querySelectorAll('button').forEach((candidate) => {
        candidate.disabled = true;
      });
      rateCurrent = undefined;
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
          rateCurrent = submitRating;
        });
    };
    for (const [label, rating, key] of [
      ['Again', 0, '1'],
      ['Hard', 1, '2'],
      ['Good', 2, '3'],
      ['Easy', 3, '4']
    ] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.dataset.key = key;
      button.dataset.interval = reviewInterval(term.status, rating);
      button.setAttribute(
        'aria-label',
        `${key}, ${label}, next review ${reviewInterval(term.status, rating)}`
      );
      button.addEventListener('click', () => submitRating(rating));
      ratings.append(button);
    }
    const revealAnswer = (): void => {
      answer.hidden = false;
      ratings.hidden = false;
      reveal.hidden = true;
      revealCurrent = undefined;
      rateCurrent = submitRating;
    };
    revealCurrent = revealAnswer;
    reveal.addEventListener('click', revealAnswer);
    session.append(mode, termHeading, context, source, reveal, answer, ratings);
  };
  showCard();

  screenKeyboardController = new AbortController();
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (event.code === 'Space' && revealCurrent) {
        event.preventDefault();
        revealCurrent();
        return;
      }
      const rating = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(event.code);
      if (rating >= 0 && rateCurrent) {
        event.preventDefault();
        rateCurrent(rating as 0 | 1 | 2 | 3);
      }
    },
    { signal: screenKeyboardController.signal }
  );
}

async function renderStatistics(): Promise<void> {
  const statistics = await gateway.reviewStatistics();
  const shell = document.createElement('main');
  shell.className = 'shell statistics-shell';
  const heading = document.createElement('h1');
  heading.textContent = 'Learning statistics';

  const cards = document.createElement('section');
  cards.className = 'statistics-cards';
  for (const [label, value, icon, alert] of [
    ['Saved terms', statistics.totalTerms, 'vocabulary', false],
    ['Learning', statistics.learningTerms, 'review', false],
    ['Known', statistics.knownTerms, 'checked', false],
    ['Due now', statistics.dueTerms, 'alarm', true],
    ['Reviews today', statistics.reviewsToday, 'review', false],
    [
      'Accuracy today',
      statistics.reviewsToday === 0
        ? '—'
        : `${Math.round((statistics.correctToday / statistics.reviewsToday) * 100)}%`,
      'starred',
      false
    ]
  ] as const satisfies ReadonlyArray<
    readonly [string, string | number, AdwaitaIcon, boolean]
  >) {
    const card = document.createElement('article');
    if (alert) {
      card.className = 'metric-alert';
    }
    const iconElement = document.createElement('span');
    iconElement.className = 'statistics-card__icon';
    iconElement.append(createAdwaitaIcon(icon));
    const valueElement = document.createElement('strong');
    valueElement.textContent = String(value);
    const labelElement = document.createElement('span');
    labelElement.textContent = label;
    card.append(iconElement, valueElement, labelElement);
    cards.append(card);
  }

  const insight = document.createElement('section');
  insight.className = 'score-comparison statistics-insight';
  const insightCopy = document.createElement('div');
  const insightHeading = document.createElement('h2');
  insightHeading.textContent =
    statistics.dueTerms > 0 ? 'Keep today’s momentum' : 'You are caught up';
  const insightText = document.createElement('p');
  const weeklyAccuracy =
    statistics.reviewsLast7Days === 0
      ? 'No reviews completed this week yet.'
      : `${statistics.reviewsLast7Days} reviews this week · ${Math.round(
          (statistics.correctLast7Days / statistics.reviewsLast7Days) * 100
        )}% recalled.`;
  insightText.textContent =
    statistics.dueTerms > 0
      ? `${statistics.dueTerms} ${
          statistics.dueTerms === 1 ? 'term is' : 'terms are'
        } ready now. ${weeklyAccuracy}`
      : weeklyAccuracy;
  insightCopy.append(insightHeading, insightText);
  if (statistics.dueTerms > 0) {
    const startReview = document.createElement('button');
    startReview.type = 'button';
    startReview.className = 'primary-action';
    startReview.textContent = 'Review due terms';
    startReview.addEventListener('click', () => navigate(renderReview));
    insight.append(insightCopy, startReview);
  } else {
    insight.append(insightCopy);
  }

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
  if (statistics.languages.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent =
      'No learning statistics yet. Save a term while reading to start tracking progress.';
    shell.append(heading, cards, insight, empty);
  } else {
    shell.append(heading, cards, insight, table);
  }
  mountScreen(shell, 'statistics');
}

async function renderLanguages(): Promise<void> {
  const languages = await gateway.listLanguages();
  const shell = document.createElement('main');
  shell.className = 'shell language-shell';
  const heading = document.createElement('h1');
  heading.textContent = 'Language settings';
  const introduction = document.createElement('p');
  introduction.className = 'language-introduction';
  introduction.textContent =
    'Add learning languages and configure how their texts are read, parsed, and looked up.';
  const languagePicker = document.createElement('div');
  languagePicker.className = 'language-picker';
  const pickerCopy = document.createElement('div');
  const pickerLabel = document.createElement('strong');
  pickerLabel.textContent = 'Language';
  const pickerHelp = document.createElement('span');
  pickerHelp.textContent = 'Edit one language at a time.';
  pickerCopy.append(pickerLabel, pickerHelp);
  const picker = document.createElement('select');
  picker.setAttribute('aria-label', 'Language to configure');
  if (
    selectedLanguageId === undefined ||
    !languages.some(({ id }) => id === selectedLanguageId)
  ) {
    selectedLanguageId = languages[0]?.id;
  }
  for (const language of languages) {
    const option = document.createElement('option');
    option.value = String(language.id);
    option.textContent = `${language.name} · ${language.textCount} ${
      language.textCount === 1 ? 'text' : 'texts'
    }`;
    option.selected = language.id === selectedLanguageId;
    picker.append(option);
  }
  picker.disabled = languages.length === 0;
  picker.addEventListener('change', () => {
    selectedLanguageId = Number(picker.value);
    void renderLanguages();
  });
  const pickerActions = document.createElement('div');
  pickerActions.className = 'language-picker__actions';
  const addLanguage = document.createElement('button');
  addLanguage.type = 'button';
  addLanguage.className = 'primary-action';
  addLanguage.append(createAdwaitaIcon('add'), document.createTextNode('Add language'));
  pickerActions.append(createCombobox(picker), addLanguage);
  languagePicker.append(pickerCopy, pickerActions);

  const addLanguageDialog = document.createElement('dialog');
  addLanguageDialog.className = 'language-add-dialog';
  const addLanguageForm = document.createElement('form');
  addLanguageForm.className = 'language-add-form';
  const addLanguageHeading = document.createElement('h2');
  addLanguageHeading.textContent = 'Add a learning language';
  const addLanguageDescription = document.createElement('p');
  addLanguageDescription.textContent =
    'Choose the learning and translation languages. Recommended lookup services remain editable.';
  const newLanguageName = createLanguageNameControl();
  const newTranslationLanguage = createTranslationLanguageControl();
  const newLanguageDictionary = document.createElement('input');
  newLanguageDictionary.type = 'url';
  newLanguageDictionary.maxLength = 1_000;
  newLanguageDictionary.placeholder = 'https://dictionary.example/?q=###';
  const newLanguageDictionary2 = document.createElement('input');
  newLanguageDictionary2.type = 'url';
  newLanguageDictionary2.maxLength = 1_000;
  newLanguageDictionary2.placeholder = 'https://another-dictionary.example/?q=###';
  const newLanguageRecommendations = document.createElement('small');
  newLanguageRecommendations.className = 'dictionary-recommendation-copy';
  const refreshNewLanguageRecommendations = (): void => {
    applyRecommendedDictionaries(
      newLanguageName.value(),
      newTranslationLanguage.select.value,
      newLanguageDictionary,
      newLanguageDictionary2,
      newLanguageRecommendations
    );
  };
  newLanguageName.element.addEventListener(
    'languagechange',
    refreshNewLanguageRecommendations
  );
  newTranslationLanguage.select.addEventListener(
    'change',
    refreshNewLanguageRecommendations
  );
  const addLanguageFeedback = document.createElement('p');
  addLanguageFeedback.className = 'form-status';
  addLanguageFeedback.setAttribute('role', 'status');
  const addLanguageActions = document.createElement('div');
  addLanguageActions.className = 'dialog-actions';
  const cancelAddLanguage = document.createElement('button');
  cancelAddLanguage.type = 'button';
  cancelAddLanguage.textContent = 'Cancel';
  cancelAddLanguage.addEventListener('click', () => addLanguageDialog.close());
  const saveLanguage = document.createElement('button');
  saveLanguage.type = 'submit';
  saveLanguage.className = 'primary-action';
  saveLanguage.textContent = 'Add language';
  addLanguageActions.append(cancelAddLanguage, saveLanguage);
  addLanguageForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!newLanguageName.reportValidity() || !addLanguageForm.reportValidity()) {
      return;
    }
    saveLanguage.disabled = true;
    cancelAddLanguage.disabled = true;
    addLanguageFeedback.className = 'form-status';
    addLanguageFeedback.textContent = 'Adding language…';
    void gateway
      .createLanguage({
        name: newLanguageName.value(),
        dictionaryUri1: newLanguageDictionary.value,
        dictionaryUri2: newLanguageDictionary2.value,
        googleTranslateUri: googleTranslateTemplate(
          newLanguageName.value(),
          newTranslationLanguage.select.value
        )
      })
      .then((created) => {
        selectedLanguageId = created.id;
        addLanguageDialog.close();
        return renderLanguages();
      })
      .catch((error: unknown) => {
        saveLanguage.disabled = false;
        cancelAddLanguage.disabled = false;
        addLanguageFeedback.className = 'form-status form-status--error';
        addLanguageFeedback.textContent =
          error instanceof Error ? error.message : String(error);
      });
  });
  addLanguageForm.append(
    addLanguageHeading,
    addLanguageDescription,
    createField('Language you are learning', newLanguageName.element),
    createField('Your native language', newTranslationLanguage.element),
    createField('Primary dictionary URL (optional)', newLanguageDictionary),
    createField('Secondary dictionary URL (optional)', newLanguageDictionary2),
    newLanguageRecommendations,
    addLanguageFeedback,
    addLanguageActions
  );
  addLanguageDialog.append(addLanguageForm);
  addLanguage.addEventListener('click', () => {
    newLanguageName.reset();
    newTranslationLanguage.select.value = '';
    newTranslationLanguage.select.dispatchEvent(new Event('change'));
    newLanguageDictionary.value = '';
    newLanguageDictionary2.value = '';
    newLanguageRecommendations.textContent = '';
    addLanguageFeedback.textContent = '';
    addLanguageDialog.showModal();
    newLanguageName.trigger.focus();
  });
  const grid = document.createElement('section');
  grid.className = 'language-grid';

  for (const language of languages) {
    if (language.id !== selectedLanguageId) {
      continue;
    }
    const form = document.createElement('form');
    form.className = 'language-card';
    const cardHeader = document.createElement('header');
    cardHeader.className = 'language-card__header';
    const cardIdentity = document.createElement('div');
    cardIdentity.className = 'language-card__identity';
    const cardIcon = document.createElement('span');
    cardIcon.className = 'language-card__icon';
    cardIcon.append(createAdwaitaIcon('language'));
    const cardTitle = document.createElement('div');
    const name = document.createElement('h2');
    name.textContent = language.name;
    const count = document.createElement('p');
    count.textContent = `${language.textCount} ${language.textCount === 1 ? 'text' : 'texts'}`;
    cardTitle.append(name, count);
    cardIdentity.append(cardIcon, cardTitle);
    const configuredBadge = document.createElement('span');
    configuredBadge.className = 'language-card__badge';
    configuredBadge.textContent = 'Learning language';
    cardHeader.append(cardIdentity, configuredBadge);
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

    const createSettingsSection = (
      title: string,
      description: string,
      icon: AdwaitaIcon,
      fields: readonly HTMLElement[],
      modifier = ''
    ): HTMLElement => {
      const section = document.createElement('section');
      section.className = `language-settings-group${modifier ? ` ${modifier}` : ''}`;
      const sectionHeader = document.createElement('header');
      sectionHeader.className = 'language-settings-group__header';
      const sectionIcon = document.createElement('span');
      sectionIcon.className = 'language-settings-group__icon';
      sectionIcon.append(createAdwaitaIcon(icon));
      const sectionCopy = document.createElement('div');
      const sectionTitle = document.createElement('h3');
      sectionTitle.textContent = title;
      const sectionDescription = document.createElement('p');
      sectionDescription.textContent = description;
      sectionCopy.append(sectionTitle, sectionDescription);
      sectionHeader.append(sectionIcon, sectionCopy);
      const sectionFields = document.createElement('div');
      sectionFields.className = 'language-settings-group__fields';
      sectionFields.append(...fields);
      section.append(sectionHeader, sectionFields);
      return section;
    };

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
    save.className = 'primary-action';
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
    const nativeLanguage =
      translationLanguageFromTemplate(language.googleTranslateUri) ?? '';
    const recommended = recommendedDictionaryTemplates(language.name, nativeLanguage);
    const recommendationRow = document.createElement('div');
    recommendationRow.className = 'dictionary-recommendation';
    const recommendationCopy = document.createElement('span');
    recommendationCopy.textContent = `Recommended for ${language.name}${
      nativeLanguage ? ` with ${nativeLanguage} as your native language` : ''
    }: ${recommended.primaryName} and ${recommended.secondaryName}.`;
    const useRecommended = document.createElement('button');
    useRecommended.type = 'button';
    useRecommended.className = 'secondary-button';
    useRecommended.append(
      createAdwaitaIcon('dictionary'),
      document.createTextNode('Use recommended')
    );
    useRecommended.addEventListener('click', () => {
      dictionary1.value = recommended.primaryUrl;
      dictionary2.value = recommended.secondaryUrl;
      feedback.className = 'form-status';
      feedback.textContent =
        'Recommended dictionary templates selected. Save settings to apply.';
    });
    recommendationRow.append(recommendationCopy, useRecommended);
    const dictionaryGroup = createSettingsSection(
      'Dictionaries and translation',
      'Use ### where the selected word or expression should be inserted.',
      'dictionary',
      [
        createField('Primary dictionary URL template', dictionary1),
        createField('Secondary dictionary URL template', dictionary2),
        createField('Translation URL template', googleTranslate),
        recommendationRow
      ]
    );
    const readingGroup = createSettingsSection(
      'Reading and export',
      'Adjust text display and the format copied from your vocabulary.',
      'document-properties',
      [
        createField('Reading text size (%)', textSize),
        createField('Term export template', exportTemplate)
      ],
      'language-settings-group--reading'
    );
    const parsingGroup = createSettingsSection(
      'Text parsing',
      'Control sentence boundaries and scripts with special spacing or direction.',
      'language',
      [terminatorField, substitutionField, options],
      'language-settings-group--parsing'
    );
    const footer = document.createElement('footer');
    footer.className = 'language-card__footer';
    footer.append(feedback, save);
    form.append(cardHeader, dictionaryGroup, readingGroup, parsingGroup, footer);
    grid.append(form);
  }

  if (languages.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No learning languages yet. Use Add language to create one.';
    grid.append(empty);
  }
  const warning = document.createElement('aside');
  warning.className = 'migration-notice language-warning';
  const warningIcon = document.createElement('span');
  warningIcon.className = 'language-warning__icon';
  warningIcon.append(createAdwaitaIcon('information'));
  const warningCopy = document.createElement('div');
  const warningTitle = document.createElement('strong');
  warningTitle.textContent = 'Parsing changes affect existing texts';
  const warningDescription = document.createElement('span');
  warningDescription.textContent =
    'Saved terms remain, but changing parsing rules rebuilds text positions and clears compound-expression positions for this language.';
  warningCopy.append(warningTitle, warningDescription);
  warning.append(warningIcon, warningCopy);
  shell.append(heading, introduction, languagePicker, warning, grid, addLanguageDialog);
  mountScreen(
    shell,
    'languages',
    languages.find(({ id }) => id === selectedLanguageId)?.name ?? 'All languages'
  );
}

async function renderAppSettings(): Promise<void> {
  const settings = await gateway.appSettings();
  const shell = document.createElement('main');
  shell.className = 'shell settings-shell';
  const heading = document.createElement('h1');
  heading.textContent = 'Application settings';
  const introduction = document.createElement('p');
  introduction.className = 'language-introduction';
  introduction.textContent =
    'Choose how your library is displayed and how review sessions behave on this device.';
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
  const reviewDelaySeconds = numberInput(settings.reviewDelayMs / 1_000, 0, 10);
  reviewDelaySeconds.step = '0.05';
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
  save.className = 'primary-action';
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
      reviewDelayMs: Math.round(Number(reviewDelaySeconds.value) * 1_000)
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
    createField('Pause after a review rating (seconds)', reviewDelaySeconds),
    showWordCountsLabel,
    save,
    feedback
  );
  const note = document.createElement('aside');
  note.className = 'preferences-note';
  const noteIcon = document.createElement('span');
  noteIcon.className = 'preferences-note__icon';
  noteIcon.append(createAdwaitaIcon('information'));
  const noteCopy = document.createElement('div');
  const noteTitle = document.createElement('strong');
  noteTitle.textContent = 'Stored locally';
  const noteDescription = document.createElement('span');
  noteDescription.textContent =
    'These preferences apply only to this device and are included in your backups.';
  noteCopy.append(noteTitle, noteDescription);
  note.append(noteIcon, noteCopy);
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
  checkForUpdates.className = 'primary-action';
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
  shell.append(heading, introduction, form, updateCard, note);
  mountScreen(shell, 'settings');
}

async function renderTags(message = ''): Promise<void> {
  const [tags, settings] = await Promise.all([gateway.listTags(), gateway.appSettings()]);
  const shell = document.createElement('main');
  shell.className = 'shell tag-shell';
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
  submit.className = 'primary-action';
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
  shell.append(heading, description, form, list);
  mountScreen(shell, 'tags');
}

async function renderDataManagement(): Promise<void> {
  const shell = document.createElement('main');
  shell.className = 'shell data-shell';
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
  const exportHeader = document.createElement('div');
  exportHeader.className = 'data-card__header';
  const exportIcon = document.createElement('span');
  exportIcon.className = 'data-card__icon';
  exportIcon.append(createAdwaitaIcon('document-save'));
  const exportHeading = document.createElement('h2');
  exportHeading.textContent = 'Export backup';
  exportHeader.append(exportIcon, exportHeading);
  const exportDescription = document.createElement('p');
  exportDescription.textContent = 'Download a complete, versioned snapshot of the local library.';
  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.className = 'primary-action';
  exportButton.append(
    createAdwaitaIcon('document-save'),
    document.createTextNode('Download backup')
  );
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
  exportCard.append(exportHeader, exportDescription, exportButton, exportStatus);

  const restoreCard = document.createElement('article');
  restoreCard.className = 'data-card';
  const restoreHeader = document.createElement('div');
  restoreHeader.className = 'data-card__header';
  const restoreIcon = document.createElement('span');
  restoreIcon.className = 'data-card__icon';
  restoreIcon.append(createAdwaitaIcon('document-open'));
  const restoreHeading = document.createElement('h2');
  restoreHeading.textContent = 'Restore backup';
  restoreHeader.append(restoreIcon, restoreHeading);
  const restoreDescription = document.createElement('p');
  restoreDescription.textContent =
    'Select an LWT desktop JSON backup. Restoring replaces the current local library.';
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'application/json,.json';
  file.className = 'file-picker__input';
  const restoreFileField = document.createElement('div');
  restoreFileField.className = 'text-form__file-field';
  const restoreFileCaption = document.createElement('span');
  restoreFileCaption.className = 'text-form__field-caption';
  restoreFileCaption.textContent = 'Backup file';
  const restoreFilePicker = document.createElement('label');
  restoreFilePicker.className = 'file-picker';
  const restoreFileIcon = document.createElement('span');
  restoreFileIcon.className = 'file-picker__icon';
  restoreFileIcon.append(createAdwaitaIcon('document-open'));
  const restoreFileCopy = document.createElement('span');
  restoreFileCopy.className = 'file-picker__copy';
  const restoreFileTitle = document.createElement('strong');
  restoreFileTitle.textContent = 'Choose a backup file';
  const restoreFileHelp = document.createElement('small');
  restoreFileHelp.textContent = 'LWT desktop backup · JSON';
  restoreFileCopy.append(restoreFileTitle, restoreFileHelp);
  const restoreFileName = document.createElement('span');
  restoreFileName.className = 'file-picker__name';
  restoreFileName.textContent = 'Browse…';
  restoreFilePicker.append(file, restoreFileIcon, restoreFileCopy, restoreFileName);
  restoreFileField.append(restoreFileCaption, restoreFilePicker);
  const restoreButton = document.createElement('button');
  restoreButton.type = 'button';
  restoreButton.className = 'primary-action';
  restoreButton.append(
    createAdwaitaIcon('document-open'),
    document.createTextNode('Restore selected backup')
  );
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
    restoreFileName.textContent = selected.name;
    restoreFilePicker.classList.add('has-file');
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
        restoreStatus.textContent = `Restored ${summary.texts} texts (${summary.archivedTexts} archived), ${summary.terms} terms, ${summary.tags} tags, ${summary.media} legacy media items, and ${summary.reviews} reviews.${warningText}`;
        selectedPayload = '';
        file.value = '';
        restoreFileName.textContent = 'Browse…';
        restoreFilePicker.classList.remove('has-file');
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
    restoreHeader,
    restoreDescription,
    restoreFileField,
    restoreButton,
    restoreStatus
  );
  grid.append(exportCard, restoreCard);
  shell.append(heading, introduction, grid);
  mountScreen(shell, 'backup');
}

type BookCoverTone = 'blue' | 'amber' | 'rose';

function bookCoverTone(text: LibraryText): BookCoverTone {
  const tones: readonly BookCoverTone[] = ['blue', 'amber', 'rose'];
  return tones[Math.abs(text.id - 1) % tones.length] ?? 'blue';
}

function languageCode(language: string): string {
  const knownCodes: Readonly<Record<string, string>> = {
    arabic: 'AR',
    chinese: 'ZH',
    english: 'EN',
    french: 'FR',
    german: 'DE',
    italian: 'IT',
    japanese: 'JA',
    portuguese: 'PT',
    spanish: 'ES'
  };
  const normalized = language.trim().toLocaleLowerCase();
  return knownCodes[normalized] ?? [...language.trim()].slice(0, 2).join('').toLocaleUpperCase();
}

function createBookCover(text: LibraryText, featured = false): HTMLElement {
  const cover = document.createElement('div');
  cover.className = `book-cover book-cover--${bookCoverTone(text)}`;
  cover.setAttribute('aria-hidden', 'true');
  const identity = document.createElement('div');
  identity.className = 'book-cover__identity';
  const code = document.createElement('strong');
  code.textContent = languageCode(text.language);
  const label = document.createElement('span');
  label.textContent = featured ? 'CURRENT READING' : text.language.toLocaleUpperCase();
  const terms = document.createElement('small');
  terms.textContent = `${text.totalTerms} ${text.totalTerms === 1 ? 'TERM' : 'TERMS'}`;
  identity.append(code, label, terms);
  cover.append(identity);
  return cover;
}

function createProgressRow(progress: number): HTMLElement {
  const row = document.createElement('div');
  row.className = 'progress-row progress-row--small';
  const track = document.createElement('div');
  track.className = 'progress-track';
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-label', 'Known terms');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  track.setAttribute('aria-valuenow', String(progress));
  const fill = document.createElement('span');
  fill.style.width = `${progress}%`;
  const value = document.createElement('strong');
  value.textContent = `${progress}%`;
  track.append(fill);
  row.append(track, value);
  return row;
}

function createTextCard(text: LibraryText, showWordCounts: boolean): HTMLElement {
  const card = document.createElement('article');
  card.className = 'text-card book-card';

  const progress =
    text.totalTerms > 0 ? Math.round((text.knownTerms / text.totalTerms) * 100) : 0;
  const heading = document.createElement('h2');
  heading.textContent = text.title;

  const language = document.createElement('span');
  language.className = 'text-card__language chip';
  language.textContent = text.language;
  const meta = document.createElement('div');
  meta.className = 'card-meta';

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
  button.className = 'card-link';
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

  const moreActions = document.createElement('details');
  moreActions.className = 'text-card__menu';
  const moreSummary = document.createElement('summary');
  moreSummary.className = 'ghost-icon';
  moreSummary.setAttribute('aria-label', `More options for ${text.title}`);
  moreSummary.textContent = '•••';
  const menuPanel = document.createElement('div');
  menuPanel.className = 'text-card__menu-popup';
  menuPanel.append(editButton, archiveButton, deleteButton);
  moreActions.append(moreSummary, menuPanel);
  meta.append(language, moreActions);

  const actions = document.createElement('div');
  actions.className = 'text-card__actions';
  if (!text.archived) {
    actions.append(button);
  }

  const body = document.createElement('div');
  body.className = 'book-card__body';
  body.append(meta, heading, details);
  if (showWordCounts && text.totalTerms > 0) {
    body.append(createProgressRow(progress));
  }
  body.append(actions);
  card.append(createBookCover(text), body);
  return card;
}

type AppScreen =
  | 'home'
  | 'library'
  | 'vocabulary'
  | 'review'
  | 'settings'
  | 'statistics'
  | 'languages'
  | 'tags'
  | 'backup'
  | 'reader';

function navigate(destination: () => Promise<void>): void {
  void destination().catch((error: unknown) => {
    window.alert(error instanceof Error ? error.message : String(error));
  });
}

function createViewButton(
  active: AppScreen,
  screen: AppScreen,
  label: string,
  icon: 'home' | 'library' | 'vocabulary' | 'review',
  destination: () => Promise<void>
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `view-switcher__button${active === screen ? ' is-active' : ''}`;
  button.setAttribute('aria-label', label);
  if (active === screen) {
    button.setAttribute('aria-current', 'page');
  }
  const iconElement = createAdwaitaIcon(icon);
  iconElement.classList.add('view-switcher__icon');
  const text = document.createElement('span');
  text.textContent = label;
  button.append(iconElement, text);
  button.addEventListener('click', () => navigate(destination));
  return button;
}

function mountScreen(
  content: HTMLElement,
  active: AppScreen,
  activeLanguage = 'All languages'
): void {
  screenKeyboardController?.abort();
  screenKeyboardController = undefined;
  content.classList.add('screen');
  const frame = document.createElement('div');
  frame.className = 'adw-window';
  const nativeWindow = usesNativeDatabase ? getCurrentWindow() : undefined;
  if (nativeWindow) {
    const resizeHandles = [
      ['North', 'north'],
      ['NorthEast', 'north-east'],
      ['East', 'east'],
      ['SouthEast', 'south-east'],
      ['South', 'south'],
      ['SouthWest', 'south-west'],
      ['West', 'west'],
      ['NorthWest', 'north-west']
    ] as const satisfies ReadonlyArray<readonly [WindowResizeDirection, string]>;
    for (const [direction, position] of resizeHandles) {
      const handle = document.createElement('div');
      handle.className = `window-resize-handle window-resize-handle--${position}`;
      handle.setAttribute('aria-hidden', 'true');
      handle.addEventListener('mousedown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        void nativeWindow.startResizeDragging(direction);
      });
      frame.append(handle);
    }
  }

  const headerbar = document.createElement('header');
  headerbar.className = 'adw-headerbar';
  if (nativeWindow) {
    headerbar.setAttribute('data-tauri-drag-region', '');
    const isInteractive = (target: EventTarget | null): boolean =>
      target instanceof Element &&
      Boolean(target.closest('button, summary, details, nav, input, select, a'));
    headerbar.addEventListener('mousedown', (event) => {
      if (event.button === 0 && !isInteractive(event.target)) {
        void nativeWindow.startDragging();
      }
    });
    headerbar.addEventListener('dblclick', (event) => {
      if (!isInteractive(event.target)) {
        void nativeWindow.toggleMaximize();
      }
    });
  }
  const headerLeft = document.createElement('div');
  headerLeft.className = 'headerbar-controls';
  const primaryMenu = document.createElement('details');
  primaryMenu.className = 'primary-menu';
  const primaryMenuButton = document.createElement('summary');
  primaryMenuButton.className = 'headerbar-button';
  primaryMenuButton.setAttribute('aria-label', 'Main menu');
  primaryMenuButton.title = 'Main menu';
  const primaryMenuIcon = createAdwaitaIcon('menu');
  primaryMenuButton.append(primaryMenuIcon);
  const menuPopup = document.createElement('div');
  menuPopup.className = 'primary-menu__popup';
  const addMenuSection = (label: string): void => {
    const section = document.createElement('span');
    section.className = 'primary-menu__section';
    section.textContent = label;
    menuPopup.append(section);
  };
  const addMenuItem = (label: string, destination: () => Promise<void>): void => {
    const item = document.createElement('button');
    item.type = 'button';
    item.textContent = label;
    item.addEventListener('click', () => {
      primaryMenu.open = false;
      navigate(destination);
    });
    menuPopup.append(item);
  };
  addMenuSection('Data');
  addMenuItem('Backup and Restore…', renderDataManagement);
  addMenuSection('Organize');
  addMenuItem('Tags…', renderTags);
  addMenuItem('Statistics', renderStatistics);
  addMenuItem('Preferences…', renderAppSettings);
  const localMenuNote = document.createElement('span');
  localMenuNote.className = 'primary-menu__note';
  localMenuNote.textContent = 'Local and available offline';
  menuPopup.append(localMenuNote);
  primaryMenu.append(primaryMenuButton, menuPopup);

  const addText = document.createElement('button');
  addText.type = 'button';
  addText.className = 'headerbar-button';
  addText.title = 'Add text';
  addText.setAttribute('aria-label', 'Add text');
  const addTextIcon = createAdwaitaIcon('add');
  addText.append(addTextIcon);
  addText.addEventListener('click', () => {
    pendingLanguage = activeLanguage === 'All languages' ? '' : activeLanguage;
    addingText = true;
    navigate(render);
  });
  headerLeft.append(primaryMenu, addText);

  const viewSwitcher = document.createElement('nav');
  viewSwitcher.className = 'view-switcher';
  viewSwitcher.setAttribute('aria-label', 'Primary navigation');
  const homeView = createViewButton(active, 'home', 'Home', 'home', renderHome);
  const libraryView = createViewButton(active, 'library', 'Library', 'library', render);
  const vocabularyView = createViewButton(
    active,
    'vocabulary',
    'Vocabulary',
    'vocabulary',
    renderVocabulary
  );
  const reviewView = createViewButton(active, 'review', 'Review', 'review', renderReview);
  const reviewBadge = document.createElement('span');
  reviewBadge.className = 'view-switcher__badge';
  reviewBadge.hidden = true;
  reviewView.append(reviewBadge);
  void gateway.reviewStatistics().then((statistics) => {
    if (statistics.dueTerms > 0) {
      reviewBadge.textContent = String(statistics.dueTerms);
      reviewBadge.hidden = false;
    }
  });
  viewSwitcher.append(homeView, libraryView, vocabularyView, reviewView);

  const headerRight = document.createElement('div');
  headerRight.className = 'headerbar-controls headerbar-controls--end';
  const language = document.createElement('button');
  language.type = 'button';
  language.className = 'headerbar-language';
  language.title = 'Manage languages';
  const languageCode = document.createElement('span');
  languageCode.textContent =
    activeLanguage === 'All languages' ? '—' : activeLanguage.slice(0, 2).toUpperCase();
  const languageLabel = document.createElement('span');
  languageLabel.textContent = activeLanguage;
  language.append(languageCode, languageLabel);
  language.addEventListener('click', () => navigate(renderLanguages));
  const searchButton = document.createElement('button');
  searchButton.type = 'button';
  searchButton.className = 'headerbar-button';
  searchButton.title = 'Open library search';
  searchButton.setAttribute('aria-label', 'Open library search');
  const searchIcon = createAdwaitaIcon('search');
  searchButton.append(searchIcon);
  searchButton.addEventListener('click', () => navigate(render));
  headerRight.append(language, searchButton);
  if (nativeWindow) {
    const separator = document.createElement('span');
    separator.className = 'window-controls__separator';
    const windowControls = document.createElement('div');
    windowControls.className = 'window-controls';
    const createWindowButton = (
      label: string,
      icon: 'minimize' | 'maximize' | 'restore' | 'close',
      action: () => Promise<void>
    ): HTMLButtonElement => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `window-control${
        icon === 'close' ? ' window-control--close' : ''
      }`;
      button.title = label;
      button.setAttribute('aria-label', label);
      const iconElement = createAdwaitaIcon(`window-${icon}`);
      button.append(iconElement);
      button.addEventListener('click', () => {
        void action().catch((error: unknown) => {
          window.alert(error instanceof Error ? error.message : String(error));
        });
      });
      return button;
    };
    const minimize = createWindowButton('Minimize window', 'minimize', () =>
      nativeWindow.minimize()
    );
    const maximize = createWindowButton('Maximize window', 'maximize', () =>
      nativeWindow.toggleMaximize()
    );
    const updateMaximizeButton = (maximized: boolean): void => {
      maximize.title = maximized ? 'Restore window' : 'Maximize window';
      maximize.setAttribute('aria-label', maximize.title);
      const iconName = `window-${maximized ? 'restore' : 'maximize'}` as const;
      maximize.firstElementChild?.replaceWith(createAdwaitaIcon(iconName));
      frame.classList.toggle('is-maximized', maximized);
    };
    maximize.addEventListener('click', () => {
      window.setTimeout(() => {
        void nativeWindow.isMaximized().then(updateMaximizeButton);
      }, 80);
    });
    void nativeWindow.isMaximized().then(updateMaximizeButton);
    const close = createWindowButton('Close window', 'close', () => nativeWindow.close());
    windowControls.append(minimize, maximize, close);
    headerRight.append(separator, windowControls);
  }
  headerbar.append(headerLeft, viewSwitcher, headerRight);

  const body = document.createElement('div');
  body.className = 'adw-body';
  const workArea = document.createElement('div');
  workArea.className = 'adw-workspace';
  workArea.classList.toggle('adw-workspace--reader', active === 'reader');
  workArea.append(content);
  body.append(workArea);

  const mobileNav = document.createElement('nav');
  mobileNav.className = 'bottom-nav';
  mobileNav.setAttribute('aria-label', 'Mobile primary navigation');
  for (const [screen, label, icon, destination] of [
    ['home', 'Home', 'home', renderHome],
    ['library', 'Library', 'library', render],
    ['vocabulary', 'Words', 'vocabulary', renderVocabulary],
    ['review', 'Review', 'review', renderReview]
  ] as const) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = active === screen ? 'is-active' : '';
    const iconElement = createAdwaitaIcon(icon);
    const text = document.createElement('span');
    text.textContent = label;
    button.append(iconElement, text);
    button.addEventListener('click', () => navigate(destination));
    mobileNav.append(button);
  }
  frame.append(headerbar, body, mobileNav);
  applicationRoot.replaceChildren(frame);
}

function createHomeTextCard(text: LibraryText): HTMLElement {
  const card = document.createElement('article');
  card.className = 'home-text-card book-card';
  const progress =
    text.totalTerms > 0 ? Math.round((text.knownTerms / text.totalTerms) * 100) : 0;
  const body = document.createElement('div');
  body.className = 'book-card__body';
  const meta = document.createElement('div');
  meta.className = 'card-meta';
  const language = document.createElement('span');
  language.className = 'chip';
  language.textContent = text.language;
  meta.append(language);
  const heading = document.createElement('h3');
  heading.textContent = text.title;
  const details = document.createElement('p');
  details.textContent = text.totalTerms
    ? `${text.lastOpened || 'Added recently'} · ${text.totalTerms} terms`
    : 'No terms detected';
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'card-link';
  open.textContent = text.lastOpened ? 'Continue reading →' : 'Open text →';
  open.addEventListener('click', () => void renderReading(text.id));
  body.append(meta, heading, details);
  if (text.totalTerms > 0) {
    body.append(createProgressRow(progress));
  }
  body.append(open);
  card.append(createBookCover(text), body);
  return card;
}

async function renderHome(): Promise<void> {
  const [texts, languages, statistics] = await Promise.all([
    gateway.listTexts(),
    gateway.listLanguages(),
    gateway.reviewStatistics()
  ]);
  const shell = document.createElement('main');
  shell.className = 'shell home-shell';
  if (languages.length === 0) {
    const introduction = document.createElement('section');
    introduction.className = 'first-use first-use-state';
    const introductionHeading = document.createElement('div');
    introductionHeading.className = 'first-use-heading';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'WELCOME TO LEARNING WITH TEXTS';
    const heading = document.createElement('h1');
    heading.textContent = 'Set up the language you want to learn';
    const description = document.createElement('p');
    description.textContent =
      'Choose the language you are learning and your native language. Recommended dictionaries and translation will be configured for you.';
    introductionHeading.append(eyebrow, heading, description);

    const form = document.createElement('form');
    form.className = 'first-language-form first-language-card';
    const language = createLanguageNameControl();
    const translationLanguage = createTranslationLanguageControl();
    const dictionary = document.createElement('input');
    dictionary.type = 'url';
    dictionary.maxLength = 1000;
    dictionary.placeholder = 'https://dictionary.example/search?q=###';
    const dictionary2 = document.createElement('input');
    dictionary2.type = 'url';
    dictionary2.maxLength = 1000;
    dictionary2.placeholder = 'https://another-dictionary.example/search?q=###';
    const help = document.createElement('small');
    help.className = 'dictionary-recommendation-copy';
    const refreshRecommendations = (): void => {
      applyRecommendedDictionaries(
        language.value(),
        translationLanguage.select.value,
        dictionary,
        dictionary2,
        help
      );
    };
    language.element.addEventListener('languagechange', refreshRecommendations);
    translationLanguage.select.addEventListener('change', refreshRecommendations);
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'primary-button';
    submit.textContent = 'Save language and add your first text';
    const status = document.createElement('p');
    status.className = 'form-status';
    status.setAttribute('role', 'status');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!language.reportValidity() || !form.reportValidity()) {
        return;
      }
      submit.disabled = true;
      status.textContent = 'Saving language…';
      void gateway
        .createLanguage({
          name: language.value(),
          dictionaryUri1: dictionary.value,
          dictionaryUri2: dictionary2.value,
          googleTranslateUri: googleTranslateTemplate(
            language.value(),
            translationLanguage.select.value
          )
        })
        .then((saved) => {
          pendingLanguage = saved.name;
          addingText = true;
          return render();
        })
        .catch((error: unknown) => {
          submit.disabled = false;
          status.className = 'form-status form-status--error';
          status.textContent = error instanceof Error ? error.message : String(error);
        });
    });
    const formHeading = document.createElement('div');
    formHeading.className = 'first-language-card__heading';
    const formHeadingCopy = document.createElement('div');
    const step = document.createElement('p');
    step.className = 'eyebrow';
    step.textContent = 'STEP 1 OF 2';
    const formTitle = document.createElement('h2');
    formTitle.textContent = 'Language details';
    const requirement = document.createElement('span');
    requirement.textContent = 'Both languages are required';
    formHeadingCopy.append(step, formTitle);
    formHeading.append(formHeadingCopy, requirement);

    const fields = document.createElement('div');
    fields.className = 'dialog-grid';
    const languageField = createField('Language you are learning', language.element);
    const translationLanguageField = createField(
      'Your native language',
      translationLanguage.element
    );
    const dictionaryField = createField('Primary dictionary URL (optional)', dictionary);
    const dictionary2Field = createField('Secondary dictionary URL (optional)', dictionary2);
    help.classList.add('dictionary-recommendation-copy--wide');
    fields.append(
      languageField,
      translationLanguageField,
      dictionaryField,
      dictionary2Field,
      help
    );

    const footer = document.createElement('div');
    footer.className = 'first-language-card__footer';
    const footerNote = document.createElement('span');
    footerNote.textContent =
      'Dictionaries, translation, and advanced language rules can be changed later in Preferences.';
    footer.append(footerNote, submit);
    form.append(formHeading, fields, footer, status);

    const steps = document.createElement('div');
    steps.className = 'first-use-steps';
    for (const [number, title, copy] of [
      [
        '1',
        'Choose your languages',
        'Set the language you are learning and your native language.'
      ],
      ['2', 'Add your first text', 'Paste or upload content that matches your interests.'],
      ['3', 'Read and review', 'Save unfamiliar terms and return to them in Review.']
    ] as const) {
      const card = document.createElement('article');
      const numberElement = document.createElement('span');
      numberElement.textContent = number;
      const cardCopy = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = title;
      const paragraph = document.createElement('p');
      paragraph.textContent = copy;
      cardCopy.append(strong, paragraph);
      card.append(numberElement, cardCopy);
      steps.append(card);
    }

    introduction.append(introductionHeading, form, steps);
    shell.append(introduction);
    mountScreen(shell, 'home');
    return;
  }

  const activeTexts = texts.filter(({ archived }) => !archived);
  const featured = activeTexts.find(({ lastOpened, completedAt }) => lastOpened && !completedAt);
  const recent = activeTexts.filter(({ id }) => id !== featured?.id).slice(0, 3);
  const headingRow = document.createElement('div');
  headingRow.className = 'home-heading page-heading';
  const headingGroup = document.createElement('div');
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })
    .format(new Date())
    .toLocaleUpperCase();
  const heading = document.createElement('h1');
  heading.textContent = featured ? 'Pick up where you left off' : 'Start your next reading';
  const description = document.createElement('p');
  description.textContent = 'Your content and most important reviews are ready here.';
  headingGroup.append(eyebrow, heading, description);
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'primary-action primary-button';
  const addLabel = document.createElement('span');
  addLabel.textContent = 'Add content';
  add.append(createAdwaitaIcon('add'), addLabel);
  add.addEventListener('click', () => {
    pendingLanguage = languages[0]?.name ?? '';
    addingText = true;
    void render();
  });
  headingRow.append(headingGroup, add);
  shell.append(headingRow);

  const dashboard = document.createElement('section');
  dashboard.className = 'home-dashboard next-actions';
  const continueCard = document.createElement('article');
  continueCard.className = 'continue-card';
  if (featured) {
    const content = document.createElement('div');
    content.className = 'continue-content';
    const cardMeta = document.createElement('div');
    cardMeta.className = 'card-meta';
    const language = document.createElement('span');
    language.className = 'chip';
    language.textContent = featured.language;
    cardMeta.append(language);
    const summary = document.createElement('div');
    const label = document.createElement('p');
    label.className = 'section-kicker';
    label.textContent = 'CONTINUE READING';
    const title = document.createElement('h2');
    title.textContent = featured.title;
    const meta = document.createElement('p');
    meta.textContent = featured.lastOpened
      ? `Last studied ${featured.lastOpened.toLocaleLowerCase()}`
      : 'Ready to continue';
    summary.append(label, title, meta);
    const progress =
      featured.totalTerms > 0
        ? Math.round((featured.knownTerms / featured.totalTerms) * 100)
        : 0;
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'primary-button';
    open.textContent = 'Continue reading →';
    open.addEventListener('click', () => void renderReading(featured.id));
    content.append(cardMeta, summary, createProgressRow(progress), open);
    continueCard.append(createBookCover(featured, true), content);
  } else {
    continueCard.classList.add('continue-card--empty');
    const content = document.createElement('div');
    content.className = 'continue-content';
    const label = document.createElement('p');
    label.className = 'section-kicker';
    label.textContent = activeTexts.length === 0 ? 'YOUR FIRST READING' : 'CONTINUE READING';
    const title = document.createElement('h2');
    title.textContent = activeTexts.length === 0 ? 'No text added to your library' : 'No reading in progress';
    const message = document.createElement('p');
    message.textContent =
      activeTexts.length === 0
        ? 'Add a text you care about and start learning from real context.'
        : 'Open a text from your library to make it your current reading.';
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'primary-button';
    action.textContent = activeTexts.length === 0 ? 'Add your first text →' : 'Choose a text →';
    action.addEventListener('click', () => {
      if (activeTexts.length === 0) {
        pendingLanguage = languages[0]?.name ?? '';
        addingText = true;
      }
      void render();
    });
    content.append(label, title, message, action);
    continueCard.append(content);
  }
  const reviewCard = document.createElement('article');
  reviewCard.className = 'review-summary';
  const reviewIcon = document.createElement('div');
  reviewIcon.className = 'review-summary__icon';
  reviewIcon.append(createAdwaitaIcon('review'));
  const reviewCopy = document.createElement('div');
  const reviewLabel = document.createElement('p');
  reviewLabel.className = 'section-kicker';
  reviewLabel.textContent = "TODAY'S REVIEW";
  const reviewTitle = document.createElement('h2');
  const reviewCount = document.createElement('strong');
  reviewCount.textContent = String(statistics.dueTerms);
  reviewTitle.append(reviewCount, ` ${statistics.dueTerms === 1 ? 'term is' : 'terms are'} due now`);
  const reviewDescription = document.createElement('p');
  reviewDescription.textContent =
    statistics.dueTerms === 0
      ? 'You are caught up. Saved learning terms will appear here.'
      : `About ${Math.max(1, Math.ceil(statistics.dueTerms / 2))} minutes · from your saved vocabulary`;
  reviewCopy.append(reviewLabel, reviewTitle, reviewDescription);
  const reviewPreview = document.createElement('div');
  reviewPreview.className = 'review-preview';
  for (const preview of statistics.dueTerms === 0
    ? ['No terms due']
    : ['Due now', 'Short session', `${statistics.dueTerms} saved`]) {
    const chip = document.createElement('span');
    chip.textContent = preview;
    reviewPreview.append(chip);
  }
  const reviewAction = document.createElement('button');
  reviewAction.type = 'button';
  reviewAction.className = 'secondary-button';
  reviewAction.textContent = statistics.dueTerms === 0 ? 'Open review' : 'Start review →';
  reviewAction.addEventListener('click', () => void renderReview());
  reviewCard.append(reviewIcon, reviewCopy, reviewPreview, reviewAction);
  dashboard.append(continueCard, reviewCard);
  shell.append(dashboard);

  const recentSection = document.createElement('section');
  recentSection.className = 'recent-section library-section';
  const recentHeader = document.createElement('div');
  recentHeader.className = 'library-header section-heading';
  const recentCopy = document.createElement('div');
  const recentTitle = document.createElement('h2');
  recentTitle.textContent = 'Recently studied';
  const recentDescription = document.createElement('p');
  recentDescription.textContent = 'Recently studied or added · excludes the featured text';
  recentCopy.append(recentTitle, recentDescription);
  const viewLibrary = document.createElement('button');
  viewLibrary.type = 'button';
  viewLibrary.className = 'secondary-button compact';
  viewLibrary.textContent = 'View library →';
  viewLibrary.addEventListener('click', () => void render());
  recentHeader.append(recentCopy, viewLibrary);
  const recentGrid = document.createElement('div');
  recentGrid.className = 'recent-grid book-grid';
  if (recent.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = activeTexts.length === 0
      ? 'No text has been added to the library yet.'
      : 'No other recent texts yet.';
    recentGrid.append(empty);
  } else {
    recentGrid.append(...recent.map(createHomeTextCard));
  }
  recentSection.append(recentHeader, recentGrid);
  shell.append(recentSection);
  mountScreen(shell, 'home', languages[0]?.name ?? 'All languages');
}

async function render(message = '', editingId?: number): Promise<void> {
  const [texts, editingText, tags, selectedTagIds, settings, languages] = await Promise.all([
    gateway.listTexts(),
    editingId === undefined ? Promise.resolve(undefined) : gateway.getText(editingId),
    gateway.listTags(),
    editingId === undefined ? Promise.resolve([]) : gateway.listTextTagIds(editingId),
    gateway.appSettings(),
    gateway.listLanguages()
  ]);

  const shell = document.createElement('main');
  shell.className = 'shell';


  const libraryHeading = document.createElement('h2');
  libraryHeading.className = 'section-title';
  libraryHeading.textContent = showingArchivedTexts ? 'Archived texts' : 'Library';
  const libraryEyebrow = document.createElement('p');
  libraryEyebrow.className = 'eyebrow';
  libraryEyebrow.textContent = 'COLLECTION';
  const libraryDescription = document.createElement('p');
  libraryDescription.textContent = 'Browse and manage all of your active and archived texts.';
  const libraryHeadingCopy = document.createElement('div');
  libraryHeadingCopy.append(libraryEyebrow, libraryHeading, libraryDescription);
  const addTextButton = document.createElement('button');
  addTextButton.type = 'button';
  addTextButton.className = 'primary-action primary-button';
  const addTextLabel = document.createElement('span');
  addTextLabel.textContent = 'Add content';
  addTextButton.append(createAdwaitaIcon('add'), addTextLabel);
  addTextButton.addEventListener('click', () => {
    addingText = true;
    pendingLanguage =
      libraryLanguage || (texts.find(({ archived }) => !archived)?.language ?? '');
    void render();
  });
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
  const libraryActions = document.createElement('div');
  libraryActions.className = 'library-actions';
  libraryActions.append(addTextButton, archiveViewButton);
  const libraryHeader = document.createElement('div');
  libraryHeader.className = 'library-header page-heading';
  libraryHeader.append(libraryHeadingCopy, libraryActions);

  const collectionHeading = document.createElement('div');
  collectionHeading.className = 'section-heading library-page-heading';
  const collectionCopy = document.createElement('div');
  const collectionTitle = document.createElement('h3');
  collectionTitle.textContent = showingArchivedTexts ? 'All archived texts' : 'All texts';
  const collectionCount = document.createElement('p');
  const activeCount = texts.filter(({ archived }) => !archived).length;
  const archivedCount = texts.filter(({ archived }) => archived).length;
  collectionCount.textContent = `${activeCount} active · ${archivedCount} archived`;
  collectionCopy.append(collectionTitle, collectionCount);
  collectionHeading.append(collectionCopy);

  const libraryToolbar = document.createElement('form');
  libraryToolbar.className = 'library-toolbar';
  libraryToolbar.setAttribute('role', 'search');
  const search = document.createElement('input');
  search.type = 'search';
  search.value = libraryQuery;
  search.placeholder = 'Search title or language…';
  search.setAttribute('aria-label', 'Search library');
  const searchField = document.createElement('label');
  searchField.className = 'search-field';
  searchField.append(createAdwaitaIcon('search'), search);
  const languageFilter = document.createElement('select');
  languageFilter.setAttribute('aria-label', 'Filter library by language');
  const allLanguages = document.createElement('option');
  allLanguages.value = '';
  allLanguages.textContent = 'All languages';
  languageFilter.append(allLanguages);
  for (const name of [...new Set(texts.map((text) => text.language))].sort()) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    languageFilter.append(option);
  }
  languageFilter.value = libraryLanguage;
  const sort = document.createElement('select');
  sort.setAttribute('aria-label', 'Sort library');
  for (const [value, label] of [
    ['recent', 'Recently studied or added'],
    ['title', 'Title'],
    ['progress', 'Learning progress']
  ] as const) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    sort.append(option);
  }
  sort.value = librarySort;
  const applyFilters = document.createElement('button');
  applyFilters.type = 'submit';
  applyFilters.className = 'filter-button';
  applyFilters.textContent = 'Apply';
  libraryToolbar.addEventListener('submit', (event) => {
    event.preventDefault();
    libraryQuery = search.value.trim();
    libraryLanguage = languageFilter.value;
    librarySort = sort.value as typeof librarySort;
    libraryPage = 0;
    void render();
  });
  languageFilter.addEventListener('change', () => applyFilters.click());
  sort.addEventListener('change', () => applyFilters.click());
  libraryToolbar.append(
    searchField,
    createCombobox(languageFilter),
    createCombobox(sort),
    applyFilters
  );

  const library = document.createElement('section');
  library.className = 'library-grid';
  library.setAttribute('aria-label', showingArchivedTexts ? 'Archived texts' : 'Text library');
  const normalizedQuery = libraryQuery.toLocaleLowerCase();
  const visibleTexts = texts
    .filter(({ archived }) => archived === showingArchivedTexts)
    .filter(
      (text) =>
        (libraryLanguage === '' || text.language === libraryLanguage) &&
        (normalizedQuery === '' ||
          `${text.title} ${text.language}`.toLocaleLowerCase().includes(normalizedQuery))
    )
    .slice()
    .sort((left, right) => {
      if (librarySort === 'title') {
        return left.title.localeCompare(right.title);
      }
      if (librarySort === 'progress') {
        const leftProgress = left.totalTerms === 0 ? 0 : left.knownTerms / left.totalTerms;
        const rightProgress = right.totalTerms === 0 ? 0 : right.knownTerms / right.totalTerms;
        return rightProgress - leftProgress;
      }
      return 0;
    });
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
      : 'Your local library is empty. Add your first text to begin.';
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

  let editorDialog: HTMLDialogElement | undefined;
  if (addingText || editingText) {
    editorDialog = document.createElement('dialog');
    editorDialog.className = 'editor-dialog';
    editorDialog.append(
      createImportPanel(
        message,
        editingText,
        tags,
        selectedTagIds,
        pendingLanguage,
        languages.map(({ name }) => name)
      )
    );
    shell.append(editorDialog);
  } else if (message) {
    const feedback = document.createElement('p');
    feedback.className = 'library-feedback';
    feedback.setAttribute('role', 'status');
    feedback.textContent = message;
    shell.append(feedback);
  }
  shell.append(libraryHeader, collectionHeading, libraryToolbar, library);
  mountScreen(
    shell,
    'library',
    editingText?.language ??
      (libraryLanguage ||
        texts.find(({ archived }) => !archived)?.language ||
        'All languages')
  );
  editorDialog?.showModal();
}

void renderHome();
