import { setupMeetingPlayer } from './meeting-player.js';

export function matchingNotes(notes, query) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return notes.map((text) => words.every((word) => text.toLocaleLowerCase().includes(word)));
}

export function setupMeetingDetail(root) {
  if (!root) return;
  const tabs = [...root.querySelectorAll('[data-tab]')];
  const panels = [...root.querySelectorAll('[data-panel]')];
  const tabList = root.querySelector('[data-meeting-tabs]');
  const search = root.querySelector('[data-notes-search]');
  const notes = [...root.querySelectorAll('[data-note]')];
  const notesPane = root.querySelector('[data-notes-scroll]');
  const status = root.querySelector('[data-search-status]');
  tabList.setAttribute('role', 'tablist');
  tabs.forEach((tab) => {
    tab.id = `tab-${tab.dataset.tab}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', tab.dataset.tab);
  });
  panels.forEach((panel) => {
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `tab-${panel.dataset.panel}`);
  });
  function show(name) {
    tabs.forEach((tab) => {
      const selected = tab.dataset.tab === name;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== name; });
    root.dispatchEvent(new Event('meeting-panel-change'));
  }
  function filter() {
    notesPane.scrollTop = 0;
    const matches = matchingNotes(notes.map((note) => note.textContent), search.value);
    notes.forEach((note, index) => { note.hidden = !matches[index]; });
    const count = matches.filter(Boolean).length;
    status.textContent = search.value.trim() ? `${count} matching section${count === 1 ? '' : 's'}` : '';
    root.querySelector('[data-search-empty]').hidden = count !== 0;
  }
  function fromHash(scroll = false) {
    const hash = location.hash.slice(1);
    const note = notes.find((entry) => entry.id === hash);
    show(note ? 'notes' : tabs.some((tab) => tab.dataset.tab === hash) ? hash : 'about');
    if (note) {
      search.value = '';
      filter();
      notesPane.scrollTo({ top: note.offsetTop, behavior: 'instant' });
      if (scroll) note.focus({ preventScroll: true });
    }
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', (event) => {
      event.preventDefault();
      history.replaceState(null, '', `#${tab.dataset.tab}`);
      show(tab.dataset.tab);
    });
    tab.addEventListener('keydown', (event) => {
      const positions = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 };
      if (!(event.key in positions)) return;
      event.preventDefault();
      tabs[positions[event.key]].click();
      tabs[positions[event.key]].focus();
    });
  });
  root.querySelectorAll('[data-note-link]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      history.pushState(null, '', link.getAttribute('href'));
      fromHash(true);
    });
  });
  search.addEventListener('input', filter);
  window.addEventListener('hashchange', () => fromHash(true));
  window.addEventListener('popstate', () => fromHash(true));
  setupMeetingPlayer(root);
  fromHash();
}

if (typeof document !== 'undefined') setupMeetingDetail(document.querySelector('[data-meeting-detail]'));
