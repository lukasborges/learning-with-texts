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
  selectedIds: readonly number[]
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
    const emptyMessage = document.createElement('small');
    emptyMessage.textContent = 'Create a tag from the Tags screen first.';
    element.append(emptyMessage);
  }

  return {
    element,
    selected: () =>
      checkboxes.filter(({ checked }) => checked).map(({ value }) => Number(value))
  };
}
