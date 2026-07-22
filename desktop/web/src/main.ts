import logoUrl from '../../../img/lwt_icon_big.png';
import { MockLibraryGateway } from './gateways/mock_library_gateway';
import type { LibraryText } from './domain/library';
import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Desktop application root was not found');
}

const applicationRoot = app;

function createTextCard(text: LibraryText): HTMLElement {
  const card = document.createElement('article');
  card.className = 'text-card';

  const progress = Math.round((text.knownTerms / text.totalTerms) * 100);
  const heading = document.createElement('h2');
  heading.textContent = text.title;

  const language = document.createElement('p');
  language.className = 'text-card__language';
  language.textContent = text.language;

  const meter = document.createElement('progress');
  meter.max = 100;
  meter.value = progress;
  meter.setAttribute('aria-label', `${progress}% known terms`);

  const details = document.createElement('p');
  details.className = 'text-card__details';
  details.textContent = `${text.knownTerms} of ${text.totalTerms} terms known · ${text.lastOpened}`;

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Open text';
  button.disabled = true;
  button.title = 'Reading will be enabled after the Rust text slice is ready';

  card.append(heading, language, meter, details, button);
  return card;
}

async function render(): Promise<void> {
  const gateway = new MockLibraryGateway();
  const texts = await gateway.listTexts();

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
  subtitle.textContent = 'Desktop foundation · offline fixture mode';
  titleGroup.append(title, subtitle);
  header.append(logo, titleGroup);

  const notice = document.createElement('aside');
  notice.className = 'migration-notice';
  notice.textContent =
    'This shell is running without PHP or MySQL. Data is currently read from a typed fixture gateway.';

  const libraryHeading = document.createElement('h2');
  libraryHeading.className = 'section-title';
  libraryHeading.textContent = 'Library';

  const library = document.createElement('section');
  library.className = 'library-grid';
  library.setAttribute('aria-label', 'Text library');
  library.append(...texts.map(createTextCard));

  shell.append(header, notice, libraryHeading, library);
  applicationRoot.replaceChildren(shell);
}

void render();
