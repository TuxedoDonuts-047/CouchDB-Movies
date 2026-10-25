import PouchDB from 'pouchdb-browser';

const database = new PouchDB('schema_a_movies');
const remoteDatabase = new PouchDB(`${window.location.origin}/couch/movies`);
const form = document.querySelector('#movie-form');
const titleInput = document.querySelector('#title');
const actorsInput = document.querySelector('#actors');
const genresInput = document.querySelector('#genres');
const idInput = document.querySelector('#movie-id');
const formTitle = document.querySelector('#form-title');
const saveButton = document.querySelector('#save-button');
const cancelButton = document.querySelector('#cancel-button');
const formMessage = document.querySelector('#form-message');
const movieList = document.querySelector('#movie-list');
const movieCount = document.querySelector('#movie-count');
const emptyState = document.querySelector('#empty-state');
const connectionDot = document.querySelector('#connection-dot');
const connectionLabel = document.querySelector('#connection-label');
const syncCaption = document.querySelector('#sync-caption');
const syncToggle = document.querySelector('#sync-toggle');
const importButton = document.querySelector('#import-button');
const importMessage = document.querySelector('#import-message');
let syncEnabled = localStorage.getItem('movie-sync-enabled') !== 'false';
let sync = null;

function setConnection(state, label) {
  connectionDot.className = `connection-dot ${state}`;
  connectionLabel.textContent = label;
}

function updateSyncToggle() {
  syncToggle.textContent = `Cloud sync: ${syncEnabled ? 'On' : 'Off'}`;
  syncToggle.setAttribute('aria-pressed', String(syncEnabled));
  syncToggle.setAttribute('aria-label', `Turn cloud sync ${syncEnabled ? 'off' : 'on'}`);
}

function setFormMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.classList.toggle('error', isError);
}

function appendMeta(container, value) {
  if (!value) return;
  const item = document.createElement('span');
  item.textContent = value;
  container.append(item);
}

function parseList(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function makeAction(label, icon, className, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `icon-button ${className}`;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = icon;
  button.addEventListener('click', action);
  return button;
}

function renderMovies(movies) {
  movieList.replaceChildren();
  movieCount.textContent = String(movies.length);
  emptyState.classList.toggle('hidden', movies.length > 0);

  for (const [index, movie] of movies.entries()) {
    const row = document.createElement('article');
    row.className = 'movie-row';

    const number = document.createElement('span');
    number.className = 'movie-index';
    number.textContent = String(index + 1).padStart(2, '0');

    const info = document.createElement('div');
    info.className = 'movie-info';
    const title = document.createElement('h3');
    title.className = 'movie-title';
    title.textContent = movie.title;
    const meta = document.createElement('div');
    meta.className = 'movie-meta';
    appendMeta(meta, Array.isArray(movie.actors) ? movie.actors.join(', ') : movie.actors);
    appendMeta(meta, Array.isArray(movie.genres) ? movie.genres.join(', ') : movie.genres);
    info.append(title, meta);

    const actions = document.createElement('div');
    actions.className = 'row-actions';
    actions.append(
      makeAction('Edit movie', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>', '', () => startEditing(movie)),
      makeAction('Delete movie', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>', 'delete', () => deleteMovie(movie))
    );
    row.append(number, info, actions);
    movieList.append(row);
  }
}

async function refreshMovies() {
  const result = await database.allDocs({ include_docs: true });
  const movies = result.rows
    .map(({ doc }) => doc)
    .filter((doc) => (doc.type === 'movie' || typeof doc.title === 'string') && !doc._deleted)
    .sort((first, second) => first.title.localeCompare(second.title));
  renderMovies(movies);
}

async function importDataset() {
  importButton.disabled = true;
  importButton.textContent = 'Importing...';
  importMessage.textContent = 'Loading movie dataset...';

  try {
    const response = await fetch('/schema_a_movies.json');
    if (!response.ok) throw new Error(`Dataset request failed (${response.status}).`);
    const payload = await response.json();
    if (!Array.isArray(payload.docs)) throw new Error('Dataset must contain a docs array.');

    const docs = payload.docs;
    const existing = await database.allDocs({ keys: docs.map((doc) => doc._id) });
    const existingIds = new Set(existing.rows.filter((row) => !row.error).map((row) => row.id));
    const newDocs = docs.filter((doc) => !existingIds.has(doc._id));
    const results = newDocs.length ? await database.bulkDocs(newDocs) : [];
    const failed = results.filter((result) => result.error).length;
    const imported = results.length - failed;

    await refreshMovies();
    importMessage.textContent = `Imported ${imported}; skipped ${existingIds.size} already on this device${failed ? `; ${failed} failed` : ''}.`;
  } catch (error) {
    importMessage.textContent = `Import failed: ${error.message}`;
  } finally {
    importButton.disabled = false;
    importButton.textContent = 'Import dataset';
  }
}

function startEditing(movie) {
  idInput.value = movie._id;
  titleInput.value = movie.title;
  actorsInput.value = Array.isArray(movie.actors) ? movie.actors.join(', ') : movie.actors || '';
  genresInput.value = Array.isArray(movie.genres) ? movie.genres.join(', ') : movie.genres || '';
  formTitle.textContent = 'Edit a movie';
  saveButton.textContent = 'Update movie';
  cancelButton.classList.remove('hidden');
  setFormMessage('');
  titleInput.focus();
}

function resetForm() {
  form.reset();
  idInput.value = '';
  formTitle.textContent = 'Add a movie';
  saveButton.textContent = 'Save movie';
  cancelButton.classList.add('hidden');
}

async function deleteMovie(movie) {
  if (!window.confirm(`Delete “${movie.title}” from your shelf?`)) return;
  try {
    const current = await database.get(movie._id);
    await database.remove(current);
    if (idInput.value === movie._id) resetForm();
    setFormMessage('Movie deleted on this device.');
  } catch (error) {
    setFormMessage(`Could not delete movie: ${error.message}`, true);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  if (!title) {
    setFormMessage('A title is required.', true);
    titleInput.focus();
    return;
  }

  try {
    const existing = idInput.value ? await database.get(idInput.value) : null;
    const now = new Date().toISOString();
    const movie = {
      ...existing,
      _id: existing?._id || crypto.randomUUID(),
      type: existing?.type || 'movie',
      title,
      actors: parseList(actorsInput.value),
      genres: parseList(genresInput.value),
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    delete movie.director;
    if (existing) movie._rev = existing._rev;
    await database.put(movie);
    resetForm();
    setFormMessage(existing ? 'Movie updated on this device.' : 'Movie saved on this device.');
    await refreshMovies();
  } catch (error) {
    setFormMessage(`Could not save movie: ${error.message}`, true);
  }
});

cancelButton.addEventListener('click', () => {
  resetForm();
  setFormMessage('');
});

importButton.addEventListener('click', importDataset);

window.addEventListener('online', () => {
  setConnection(syncEnabled ? 'online' : '', syncEnabled ? 'Network available' : 'Cloud sync disabled');
});
window.addEventListener('offline', () => {
  setConnection('offline', syncEnabled ? 'Offline; changes saved locally' : 'Offline; changes remain local');
});

database.changes({ since: 'now', live: true }).on('change', () => {
  refreshMovies().catch((error) => setFormMessage(`Could not refresh movies: ${error.message}`, true));
});

async function startApp() {
  await refreshMovies();
  if (syncEnabled) {
    startSync();
  } else {
    syncCaption.textContent = 'Sync disabled';
    setConnection(navigator.onLine ? '' : 'offline', navigator.onLine ? 'Cloud sync disabled' : 'Offline; changes remain local');
  }
}

function startSync() {
  if (!syncEnabled || sync) return;
  syncCaption.textContent = 'Connecting to CouchDB';
  if (navigator.onLine) setConnection('', 'Connecting to CouchDB');

  const currentSync = database.sync(remoteDatabase, { live: true, retry: true });
  sync = currentSync;
  const isCurrentSync = () => sync === currentSync && syncEnabled;

  currentSync.on('active', () => {
    if (!isCurrentSync()) return;
    syncCaption.textContent = 'Syncing with CouchDB';
    if (navigator.onLine) setConnection('online', 'Syncing with CouchDB');
  });
  currentSync.on('paused', (error) => {
    if (!isCurrentSync()) return;
    if (error) {
      syncCaption.textContent = 'Waiting for CouchDB';
      setConnection('offline', 'CouchDB unavailable; saved locally');
    } else {
      syncCaption.textContent = 'Up to date';
      if (navigator.onLine) setConnection('online', 'Connected and synced');
    }
  });
  currentSync.on('denied', () => {
    if (!isCurrentSync()) return;
    syncCaption.textContent = 'Sync permission denied';
    setConnection('offline', 'CouchDB rejected sync');
  });
  currentSync.on('error', () => {
    if (!isCurrentSync()) return;
    syncCaption.textContent = 'Waiting for CouchDB';
    setConnection('offline', 'CouchDB unavailable; saved locally');
  });
}

syncToggle.addEventListener('click', () => {
  syncEnabled = !syncEnabled;
  localStorage.setItem('movie-sync-enabled', String(syncEnabled));
  updateSyncToggle();

  if (syncEnabled) {
    setConnection(navigator.onLine ? '' : 'offline', navigator.onLine ? 'Connecting to CouchDB' : 'Offline; changes saved locally');
    startSync();
    return;
  }

  if (sync) {
    sync.cancel();
    sync = null;
  }
  syncCaption.textContent = 'Sync disabled';
  setConnection(navigator.onLine ? '' : 'offline', navigator.onLine ? 'Cloud sync disabled' : 'Offline; changes remain local');
});

updateSyncToggle();

startApp().catch((error) => {
  setConnection('offline', 'Local database unavailable');
  syncCaption.textContent = 'Could not open local database';
  setFormMessage(`Database error: ${error.message}`, true);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}