import type { Tag } from '../domain/library';

export function createField(labelText: string, control: HTMLElement): HTMLLabelElement {
  const label = document.createElement('label');
  const caption = document.createElement('span');
  caption.textContent = labelText;
  label.append(caption, control);
  return label;
}

export function createPager(
  total: number,
  page: number,
  pageSize: number,
  onPage: (page: number) => void
): HTMLElement {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const controls = document.createElement('nav');
  controls.className = 'pager';
  controls.setAttribute('aria-label', 'Pagination');

  const previous = document.createElement('button');
  previous.type = 'button';
  previous.textContent = '← Previous';
  previous.disabled = page <= 0;
  previous.addEventListener('click', () => onPage(Math.max(0, page - 1)));

  const pageLabel = document.createElement('span');
  pageLabel.textContent = `Page ${page + 1} of ${pageCount}`;

  const next = document.createElement('button');
  next.type = 'button';
  next.textContent = 'Next →';
  next.disabled = page + 1 >= pageCount;
  next.addEventListener('click', () => onPage(Math.min(pageCount - 1, page + 1)));

  controls.append(previous, pageLabel, next);
  return controls;
}

export function createTagSelector(
  tags: readonly Tag[],
  selectedIds: readonly number[],
  onOpenTags?: () => void
): { element: HTMLElement; selected: () => number[] } {
  const element = document.createElement('fieldset');
  element.className = 'tag-selector';

  const legend = document.createElement('legend');
  legend.textContent = 'Tags';
  element.append(legend);

  const selectedIdsSet = new Set(selectedIds);
  const checkboxes = tags.map((tag) => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = String(tag.id);
    checkbox.checked = selectedIdsSet.has(tag.id);
    label.append(checkbox, document.createTextNode(tag.name));
    element.append(label);
    return checkbox;
  });

  if (tags.length === 0) {
    const emptyAction = document.createElement('button');
    emptyAction.type = 'button';
    emptyAction.className = 'tag-selector__empty-action';
    const emptyIcon = document.createElement('span');
    emptyIcon.className = 'tag-selector__empty-icon';
    emptyIcon.setAttribute('aria-hidden', 'true');
    emptyIcon.textContent = '+';
    const emptyCopy = document.createElement('span');
    const emptyTitle = document.createElement('strong');
    emptyTitle.textContent = 'No tags yet';
    const emptyDescription = document.createElement('small');
    emptyDescription.textContent = 'Tags are optional';
    emptyCopy.append(emptyTitle, emptyDescription);
    emptyAction.append(emptyIcon, emptyCopy);

    const dialog = document.createElement('dialog');
    dialog.className = 'tag-help-dialog';
    const dialogTitle = document.createElement('h2');
    dialogTitle.textContent = 'No tags have been created';
    const dialogDescription = document.createElement('p');
    dialogDescription.textContent =
      'Tags are optional. You can save this item now or create tags to organize your library.';
    const actions = document.createElement('div');
    actions.className = 'tag-help-dialog__actions';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Not now';
    close.addEventListener('click', () => dialog.close());
    actions.append(close);
    if (onOpenTags) {
      const openTags = document.createElement('button');
      openTags.type = 'button';
      openTags.className = 'primary-action';
      openTags.textContent = 'Open Tags';
      openTags.addEventListener('click', () => {
        dialog.close();
        onOpenTags();
      });
      actions.append(openTags);
    }
    dialog.append(dialogTitle, dialogDescription, actions);
    emptyAction.addEventListener('click', () => dialog.showModal());
    element.append(emptyAction, dialog);
  }

  return {
    element,
    selected: () =>
      checkboxes.filter(({ checked }) => checked).map(({ value }) => Number(value))
  };
}
