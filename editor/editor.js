// =============================================================
//  CONFIGURAÇÕES DO EDITOR
// =============================================================

/** Pixels por segundo na timeline */
const PX_PER_SEC = 120;

/** Quanto avançar/retroceder ao mover nota (ms) */
const NUDGE_MS = 10;

/** Velocidade das notas no modo teste (px/s) — deve bater com o jogo */
const TEST_NOTE_SPEED = 800;

/** Direções válidas */
const DIRECTIONS = ['left', 'down', 'up', 'right'];

/** Mapeamento: tecla → direção (para criação de notas) */
const KEY_TO_DIR = {
  'a': 'left',
  's': 'down',
  'w': 'up',
  'd': 'right',
};

/** Símbolos visuais por direção */
const DIR_SYMBOL = {
  left: '←',
  down: '↓',
  up: '↑',
  right: '→',
};

// =============================================================
//  ESTADO DO EDITOR
// =============================================================

/** Array de notas: { id, time, direction } */
let notes = [];

/** Próximo ID para novas notas */
let nextNoteId = 1;

/** ID da nota selecionada (null = nenhuma) */
let selectedNoteId = null;

/** Nome da música carregada */
let songName = '';

/** Flag de reprodução */
let isPlaying = false;

/** Flag de seeking (arrastando a barra) */
let isSeeking = false;

/** requestAnimationFrame ID */
let updateFrameId = null;

/** Modo teste ativo */
let testMode = false;
let testFrameId = null;

// =============================================================
//  REFERÊNCIAS DOM
// =============================================================

const audioPlayer     = document.getElementById('audio-player');
const musicInput      = document.getElementById('music-input');
const chartInput      = document.getElementById('chart-input');
const playPauseBtn    = document.getElementById('play-pause-btn');
const stopBtn         = document.getElementById('stop-btn');
const seekBar         = document.getElementById('seek-bar');
const currentTimeEl   = document.getElementById('current-time');
const totalTimeEl     = document.getElementById('total-time');
const saveBtn         = document.getElementById('save-btn');
const clearBtn        = document.getElementById('clear-btn');
const testBtn         = document.getElementById('test-btn');
const noteCountEl     = document.getElementById('note-count');
const songNameDisplay = document.getElementById('song-name-display');
const selectedInfoEl  = document.getElementById('selected-info');
const timelineScroll  = document.getElementById('timeline-scroll');
const timeline        = document.getElementById('timeline');
const playbackCursor  = document.getElementById('playback-cursor');
const testOverlay     = document.getElementById('test-overlay');
const exitTestBtn     = document.getElementById('exit-test-btn');

// =============================================================
//  FORMATAÇÃO DE TEMPO
// =============================================================

/**
 * Formata milissegundos em MM:SS.mmm
 */
function formatTime(ms) {
  if (isNaN(ms) || ms < 0) ms = 0;
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);
  const millis = Math.floor(ms % 1000);
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

// =============================================================
//  CARREGAR MÚSICA
// =============================================================

musicInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  audioPlayer.src = url;

  // Extrai nome da música sem extensão
  songName = file.name.replace(/\.[^.]+$/, '');
  songNameDisplay.textContent = songName;
});

audioPlayer.addEventListener('loadedmetadata', () => {
  const durationMs = audioPlayer.duration * 1000;
  totalTimeEl.textContent = formatTime(durationMs);

  // Habilita controles
  playPauseBtn.disabled = false;
  stopBtn.disabled = false;
  seekBar.disabled = false;
  testBtn.disabled = false;

  // Reconstrói a timeline
  buildTimeline();
});

audioPlayer.addEventListener('ended', () => {
  isPlaying = false;
  playPauseBtn.textContent = '▶ Play';
  stopUpdateLoop();
});

// =============================================================
//  CONTROLES DE REPRODUÇÃO
// =============================================================

playPauseBtn.addEventListener('click', togglePlayPause);

function togglePlayPause() {
  if (!audioPlayer.src) return;

  if (audioPlayer.paused) {
    audioPlayer.play();
    isPlaying = true;
    playPauseBtn.textContent = '⏸ Pause';
    startUpdateLoop();
  } else {
    audioPlayer.pause();
    isPlaying = false;
    playPauseBtn.textContent = '▶ Play';
    stopUpdateLoop();
  }
}

stopBtn.addEventListener('click', () => {
  audioPlayer.pause();
  audioPlayer.currentTime = 0;
  isPlaying = false;
  playPauseBtn.textContent = '▶ Play';
  stopUpdateLoop();
  updateTimeDisplay();
  updateCursorPosition();
});

// Seek bar
seekBar.addEventListener('input', () => {
  isSeeking = true;
  const ratio = seekBar.value / 1000;
  audioPlayer.currentTime = ratio * audioPlayer.duration;
  updateTimeDisplay();
  updateCursorPosition();
});

seekBar.addEventListener('change', () => {
  isSeeking = false;
});

// =============================================================
//  LOOP DE ATUALIZAÇÃO (durante reprodução)
// =============================================================

function startUpdateLoop() {
  if (updateFrameId) return;
  function tick() {
    updateTimeDisplay();
    updateCursorPosition();
    autoScroll();
    updateFrameId = requestAnimationFrame(tick);
  }
  updateFrameId = requestAnimationFrame(tick);
}

function stopUpdateLoop() {
  if (updateFrameId) {
    cancelAnimationFrame(updateFrameId);
    updateFrameId = null;
  }
}

function updateTimeDisplay() {
  const currentMs = audioPlayer.currentTime * 1000;
  currentTimeEl.textContent = formatTime(currentMs);
  if (!isSeeking && audioPlayer.duration) {
    seekBar.value = (audioPlayer.currentTime / audioPlayer.duration) * 1000;
  }
}

function updateCursorPosition() {
  const currentMs = audioPlayer.currentTime * 1000;
  const y = (currentMs / 1000) * PX_PER_SEC;
  playbackCursor.style.top = y + 'px';
}

function autoScroll() {
  const cursorY = parseFloat(playbackCursor.style.top) || 0;
  const scrollTop = timelineScroll.scrollTop;
  const viewHeight = timelineScroll.clientHeight;
  const margin = viewHeight * 0.3;

  if (cursorY < scrollTop + margin || cursorY > scrollTop + viewHeight - margin) {
    timelineScroll.scrollTop = cursorY - viewHeight * 0.3;
  }
}

// =============================================================
//  CONSTRUIR TIMELINE
// =============================================================

function buildTimeline() {
  // Limpa timeline (exceto cursor)
  const children = Array.from(timeline.children);
  children.forEach(child => {
    if (child.id !== 'playback-cursor') child.remove();
  });

  if (!audioPlayer.duration) return;

  const durationSec = audioPlayer.duration;
  const totalHeight = durationSec * PX_PER_SEC;
  timeline.style.height = totalHeight + 'px';

  // Grid lines a cada segundo
  for (let sec = 0; sec <= durationSec; sec++) {
    const y = sec * PX_PER_SEC;

    const line = document.createElement('div');
    line.className = sec % 5 === 0 ? 'grid-line major' : 'grid-line';
    line.style.top = y + 'px';
    timeline.appendChild(line);

    // Label a cada 5 segundos
    if (sec % 5 === 0) {
      const label = document.createElement('div');
      label.className = 'grid-label';
      label.style.top = (y + 2) + 'px';
      label.textContent = formatTime(sec * 1000);
      timeline.appendChild(label);
    }
  }

  // Lane dividers (3 linhas verticais entre as 4 lanes)
  for (let i = 1; i <= 3; i++) {
    const divider = document.createElement('div');
    divider.className = 'lane-divider';
    divider.style.left = (i * 25) + '%';
    timeline.appendChild(divider);
  }

  // Renderiza notas existentes
  renderAllNotes();
}

// =============================================================
//  RENDERIZAÇÃO DE NOTAS
// =============================================================

function renderAllNotes() {
  // Remove todas as note-markers
  timeline.querySelectorAll('.note-marker').forEach(el => el.remove());

  // Renderiza cada nota
  notes.forEach(note => renderNoteOnTimeline(note));
}

function renderNoteOnTimeline(note) {
  const marker = document.createElement('div');
  marker.className = `note-marker dir-${note.direction}`;
  marker.dataset.noteId = note.id;

  // Posição vertical baseada no tempo
  const y = (note.time / 1000) * PX_PER_SEC;
  marker.style.top = (y - 14) + 'px'; // -14 para centralizar (altura 28px / 2)

  // Marca como selecionada se for a nota ativa
  if (note.id === selectedNoteId) {
    marker.classList.add('selected');
  }

  // Click para selecionar
  marker.addEventListener('click', (e) => {
    e.stopPropagation();
    selectNote(note.id);
  });

  timeline.appendChild(marker);
}

function refreshNoteMarker(noteId) {
  // Remove o marker antigo e re-renderiza
  const oldMarker = timeline.querySelector(`.note-marker[data-note-id="${noteId}"]`);
  if (oldMarker) oldMarker.remove();

  const note = notes.find(n => n.id === noteId);
  if (note) renderNoteOnTimeline(note);
}

// =============================================================
//  CRIAR NOTA
// =============================================================

function addNote(direction) {
  if (!audioPlayer.src || audioPlayer.duration === 0) return;

  // Tempo atual do áudio em ms
  const time = Math.round(audioPlayer.currentTime * 1000);

  // Verificar duplicata exata (mesmo tempo + mesma direção)
  const exists = notes.some(n => n.time === time && n.direction === direction);
  if (exists) return;

  const note = {
    id: nextNoteId++,
    time: time,
    direction: direction,
  };

  notes.push(note);
  renderNoteOnTimeline(note);
  updateNoteCount();

  // Auto-seleciona a nota recém-criada
  selectNote(note.id);
}

// =============================================================
//  SELECIONAR NOTA
// =============================================================

function selectNote(noteId) {
  // Deseleciona anterior
  const prev = timeline.querySelector('.note-marker.selected');
  if (prev) prev.classList.remove('selected');

  selectedNoteId = noteId;

  if (noteId !== null) {
    const marker = timeline.querySelector(`.note-marker[data-note-id="${noteId}"]`);
    if (marker) marker.classList.add('selected');

    const note = notes.find(n => n.id === noteId);
    if (note) {
      selectedInfoEl.textContent = `Selecionada: ${DIR_SYMBOL[note.direction]} em ${formatTime(note.time)} (${note.time}ms)`;
    }
  } else {
    selectedInfoEl.textContent = 'Nenhuma nota selecionada';
  }
}

function deselectNote() {
  selectNote(null);
}

// =============================================================
//  EDITAR NOTA
// =============================================================

function deleteSelectedNote() {
  if (selectedNoteId === null) return;

  const idx = notes.findIndex(n => n.id === selectedNoteId);
  if (idx === -1) return;

  // Remove do DOM
  const marker = timeline.querySelector(`.note-marker[data-note-id="${selectedNoteId}"]`);
  if (marker) marker.remove();

  // Remove do array
  notes.splice(idx, 1);

  deselectNote();
  updateNoteCount();
}

function nudgeSelectedNote(deltaMs) {
  if (selectedNoteId === null) return;

  const note = notes.find(n => n.id === selectedNoteId);
  if (!note) return;

  const newTime = Math.max(0, note.time + deltaMs);

  // Verificar duplicata
  const exists = notes.some(n => n.id !== note.id && n.time === newTime && n.direction === note.direction);
  if (exists) return;

  note.time = newTime;
  refreshNoteMarker(note.id);

  selectedInfoEl.textContent = `Selecionada: ${DIR_SYMBOL[note.direction]} em ${formatTime(note.time)} (${note.time}ms)`;
}

// =============================================================
//  SALVAR CHART
// =============================================================

saveBtn.addEventListener('click', () => {
  if (notes.length === 0) {
    alert('Nenhuma nota para salvar!');
    return;
  }

  // Ordena por tempo
  const sortedNotes = [...notes]
    .sort((a, b) => a.time - b.time)
    .map(n => ({ time: n.time, direction: n.direction }));

  const chart = {
    song: songName || 'Sem nome',
    notes: sortedNotes,
  };

  const json = JSON.stringify(chart, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  // Nome do arquivo baseado no nome da música
  const filename = (songName || 'chart').toLowerCase().replace(/\s+/g, '_') + '.json';

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
});

// =============================================================
//  CARREGAR CHART
// =============================================================

chartInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const chart = JSON.parse(event.target.result);

      if (!chart.notes || !Array.isArray(chart.notes)) {
        alert('Arquivo JSON inválido: array "notes" não encontrado.');
        return;
      }

      // Carrega as notas
      notes = chart.notes.map((n, i) => ({
        id: nextNoteId++,
        time: n.time,
        direction: n.direction,
      }));

      if (chart.song) {
        songName = chart.song;
        songNameDisplay.textContent = songName;
      }

      // Reconstrói a timeline
      if (audioPlayer.duration) {
        buildTimeline();
      } else {
        renderAllNotes();
      }

      deselectNote();
      updateNoteCount();

      alert(`Chart carregado: ${notes.length} notas.`);
    } catch (err) {
      alert('Erro ao carregar chart: ' + err.message);
    }
  };
  reader.readAsText(file);

  // Reset input para permitir recarregar o mesmo arquivo
  chartInput.value = '';
});

// =============================================================
//  LIMPAR NOTAS
// =============================================================

clearBtn.addEventListener('click', () => {
  if (notes.length === 0) return;

  if (!confirm(`Tem certeza que deseja apagar todas as ${notes.length} notas?`)) return;

  notes = [];
  nextNoteId = 1;
  deselectNote();
  updateNoteCount();

  // Remove markers do DOM
  timeline.querySelectorAll('.note-marker').forEach(el => el.remove());
});

// =============================================================
//  CONTAGEM DE NOTAS
// =============================================================

function updateNoteCount() {
  noteCountEl.textContent = `Notas: ${notes.length}`;
}

// =============================================================
//  EVENTOS DE TECLADO
// =============================================================

document.addEventListener('keydown', (e) => {
  // Ignora se o modo teste estiver ativo
  if (testMode) return;

  const key = e.key.toLowerCase();

  // Espaço — Play/Pause
  if (e.code === 'Space') {
    e.preventDefault();
    togglePlayPause();
    return;
  }

  // A/S/W/D — Criar nota
  if (KEY_TO_DIR[key]) {
    e.preventDefault();
    addNote(KEY_TO_DIR[key]);
    return;
  }

  // Delete / Backspace — Apagar nota selecionada
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    deleteSelectedNote();
    return;
  }

  // Setas esquerda/direita — Mover nota no tempo
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    nudgeSelectedNote(-NUDGE_MS);
    return;
  }
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    nudgeSelectedNote(NUDGE_MS);
    return;
  }
});

// Click na timeline para deselecionar
timeline.addEventListener('click', (e) => {
  if (e.target === timeline || e.target.classList.contains('grid-line') || e.target.classList.contains('lane-divider')) {
    deselectNote();
  }
});

// =============================================================
//  MODO TESTE
// =============================================================

testBtn.addEventListener('click', startTestMode);
exitTestBtn.addEventListener('click', stopTestMode);

function startTestMode() {
  if (notes.length === 0) {
    alert('Nenhuma nota para testar!');
    return;
  }

  testMode = true;
  testOverlay.classList.remove('hidden');

  // Pausa o player do editor
  audioPlayer.pause();
  isPlaying = false;
  playPauseBtn.textContent = '▶ Play';
  stopUpdateLoop();

  // Reseta o áudio
  audioPlayer.currentTime = 0;

  // Limpa notas visuais anteriores
  testOverlay.querySelectorAll('.test-note').forEach(el => el.remove());

  // Inicia reprodução
  audioPlayer.play().then(() => {
    testFrameId = requestAnimationFrame(testLoop);
  });
}

function stopTestMode() {
  testMode = false;
  testOverlay.classList.add('hidden');
  audioPlayer.pause();

  if (testFrameId) {
    cancelAnimationFrame(testFrameId);
    testFrameId = null;
  }

  // Limpa notas visuais do teste
  testOverlay.querySelectorAll('.test-note').forEach(el => el.remove());

  // Atualiza UI do editor
  updateTimeDisplay();
  updateCursorPosition();
}

function testLoop() {
  if (!testMode) return;

  const currentMs = audioPlayer.currentTime * 1000;
  const testArea = document.getElementById('test-game-area');
  const areaHeight = testArea.clientHeight;
  const receptorY = areaHeight - 120; // Onde fica o receptor

  // Tempo de viagem (quanto tempo uma nota leva pra percorrer a tela toda)
  const travelTimeSec = areaHeight / TEST_NOTE_SPEED;
  const travelTimeMs = travelTimeSec * 1000;

  // Para cada nota, calcular se ela deve ser visível
  notes.forEach(note => {
    const noteStartTime = note.time - travelTimeMs; // Quando a nota aparece no topo
    const noteEndTime = note.time + 500; // Margem para sair da tela

    const noteElId = `test-note-${note.id}`;
    let noteEl = document.getElementById(noteElId);

    if (currentMs >= noteStartTime && currentMs <= noteEndTime) {
      // A nota deve estar visível
      const elapsed = currentMs - noteStartTime;
      const y = (elapsed / 1000) * TEST_NOTE_SPEED;

      if (!noteEl) {
        // Criar o elemento da nota
        noteEl = document.createElement('div');
        noteEl.id = noteElId;
        noteEl.className = `test-note dir-${note.direction}`;

        // Encontrar a lane correta
        const lane = testOverlay.querySelector(`.test-lane[data-dir="${note.direction}"] .test-notes-container`);
        if (lane) lane.appendChild(noteEl);
      }

      noteEl.style.top = y + 'px';
    } else if (noteEl) {
      // Remove se já passou
      noteEl.remove();
    }
  });

  // Verifica se a música acabou
  if (audioPlayer.ended) {
    stopTestMode();
    return;
  }

  testFrameId = requestAnimationFrame(testLoop);
}

// ESC para sair do modo teste
document.addEventListener('keydown', (e) => {
  if (testMode && e.key === 'Escape') {
    stopTestMode();
  }
});

// =============================================================
//  INICIALIZAÇÃO
// =============================================================

updateNoteCount();
