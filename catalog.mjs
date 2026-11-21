const template = `
  <div class="catalog-head">
    <h2 id="catalog-title">Фонотека</h2>
    <button class="icon-button" type="button" data-close aria-label="Закрыть фонотеку">×</button>
  </div>
  <div class="catalog-tools">
    <div class="catalog-search-row">
      <input class="catalog-search" type="search" aria-label="Поиск звуков" placeholder="Поиск звуков">
      <p class="catalog-count" aria-live="polite"></p>
    </div>
    <div class="catalog-filters" role="group" aria-label="Категории звуков"></div>
  </div>
  <div class="catalog-results">
    <p class="catalog-empty" hidden>Звуки не найдены. Измени запрос или выбери другую категорию.</p>
    <ul class="catalog-list" aria-label="Звуки"></ul>
  </div>
  <p class="catalog-status" role="status"></p>
  <template>
    <li class="catalog-sound">
      <div class="catalog-sound-icon" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      <div class="catalog-sound-text">
        <p class="catalog-sound-title"></p>
        <p class="catalog-sound-description"></p>
      </div>
      <div class="catalog-actions">
        <button class="button secondary catalog-preview" type="button">
          <span aria-hidden="true">▷</span><span data-preview-label>Слушать</span>
        </button>
        <button class="button catalog-practice" type="button">Тренировать</button>
      </div>
    </li>
  </template>
`;

function searchable(text) {
  return text.toLocaleLowerCase('ru').replaceAll('ё', 'е');
}

export function createCatalog({ trigger, sounds, getTarget, playSamples, onPractice }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'catalog-dialog';
  dialog.setAttribute('aria-labelledby', 'catalog-title');
  dialog.innerHTML = template;

  const search = dialog.querySelector('.catalog-search');
  const count = dialog.querySelector('.catalog-count');
  const filters = dialog.querySelector('.catalog-filters');
  const results = dialog.querySelector('.catalog-results');
  const list = dialog.querySelector('.catalog-list');
  const empty = dialog.querySelector('.catalog-empty');
  const status = dialog.querySelector('.catalog-status');
  const close = dialog.querySelector('[data-close]');
  const soundTemplate = dialog.querySelector('template');
  const categories = [...new Set(sounds.map(sound => sound.category))];
  let category = '';
  let previewing = null;

  const rows = sounds.map(sound => {
    const item = soundTemplate.content.firstElementChild.cloneNode(true);
    const title = item.querySelector('.catalog-sound-title');
    const description = item.querySelector('.catalog-sound-description');
    const preview = item.querySelector('.catalog-preview');
    const practice = item.querySelector('.catalog-practice');
    const previewLabel = item.querySelector('[data-preview-label]');
    title.textContent = sound.label;
    description.textContent = sound.category + ' · ' + sound.description;
    item.dataset.accent = String(categories.indexOf(sound.category) % 6);
    preview.setAttribute('aria-label', 'Слушать «' + sound.label + '»');
    practice.setAttribute('aria-label', 'Тренировать «' + sound.label + '»');
    preview.addEventListener('click', () => play(sound));
    practice.addEventListener('click', () => {
      if (previewing) return;
      if (onPractice(sound.id) === false) {
        status.textContent = 'Выбрать звук можно в режиме тренировки между записями.';
        return;
      }
      dialog.close();
    });
    list.append(item);
    return { sound, item, preview, practice, previewLabel, searchText: searchable(sound.label + ' ' + sound.category + ' ' + sound.description) };
  });

  const categoryButtons = ['', ...categories].map(label => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tab';
    button.textContent = label || 'Все звуки';
    button.addEventListener('click', () => {
      category = label;
      filter();
    });
    filters.append(button);
    return { label, button };
  });

  function filter() {
    const words = searchable(search.value).trim().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const { sound, item, searchText } of rows) {
      const matches = (!category || sound.category === category) && words.every(word => searchText.includes(word));
      item.hidden = !matches;
      if (matches) shown++;
    }
    for (const { label, button } of categoryButtons) {
      button.classList.toggle('active', label === category);
      button.setAttribute('aria-pressed', String(label === category));
    }
    empty.hidden = shown !== 0;
    count.textContent = shown + ' из ' + sounds.length;
    results.scrollTop = 0;
  }

  function renderPreview() {
    for (const { sound, item, preview, practice, previewLabel } of rows) {
      const playing = previewing === sound;
      item.classList.toggle('playing', playing);
      preview.disabled = Boolean(previewing) && !playing;
      preview.setAttribute('aria-disabled', String(playing));
      practice.disabled = Boolean(previewing);
      previewLabel.textContent = playing ? 'Играет…' : 'Слушать';
    }
  }

  async function play(sound) {
    if (previewing) return;
    previewing = sound;
    status.textContent = 'Воспроизводится «' + sound.label + '».';
    renderPreview();
    try {
      await playSamples(await getTarget(sound.id));
      status.textContent = '';
    } catch {
      status.textContent = 'Звук сейчас недоступен. Попробуй ещё раз.';
    } finally {
      previewing = null;
      renderPreview();
    }
  }

  search.addEventListener('input', filter);
  trigger.addEventListener('click', () => {
    if (dialog.open) return;
    if (!previewing) status.textContent = '';
    dialog.showModal();
    close.focus({ preventScroll: true });
  });
  close.addEventListener('click', () => dialog.close());
  document.body.append(dialog);
  filter();
}
