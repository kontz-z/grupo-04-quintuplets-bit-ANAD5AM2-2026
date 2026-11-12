// =============================================================
//  CONFIGURAÇÕES GLOBAIS
// =============================================================

/**
 * Velocidade da nota escalável com a tela.
 * Em 1080p, isso equivale a 800 pixels/segundo (74% da tela por segundo).
 */
function getNoteSpeed() {
  return window.innerHeight * 0.7407;
}

/**
 * Retorna a altura de uma nota em pixels (10vh).
 */
function getNoteHeight() {
  return window.innerHeight * 0.1;
}

/**
 * Janela de precisão PERFECT (proporcional ao tamanho da nota).
 * ~23% da altura da nota.
 */
function getPerfectWindow() {
  return getNoteHeight() * 0.23;
}

/**
 * Janela geral de acerto (EARLY / LATE).
 * ~64% da altura da nota.
 */
function getHitWindow() {
  return getNoteHeight() * 0.64;
}

/**
 * Intervalo médio entre o surgimento de notas (ms).
 * Serve apenas para a demonstração — num jogo real isso viria do beatmap.
 */
const SPAWN_INTERVAL_MIN = 400;
const SPAWN_INTERVAL_MAX = 900;

/** Tempo em ms que o feedback fica visível na tela */
const FEEDBACK_DURATION = 600;

/** Intervalo em ms entre as trocas de sprite da Itsuka enquanto o combo estiver ativo */
const ITSUKA_CYCLE_INTERVAL = 400;

// =============================================================
//  MAPEAMENTO DE TECLAS E ASSETS
// =============================================================

/** Mapeamento: direção → dados da lane */
const LANES = {
  left:  { key: 'ArrowLeft',  noteImg: 'seta esquerdapng.png', containerId: 'lane-left',  receptorId: 'receptor-left'  },
  down:  { key: 'ArrowDown',  noteImg: 'seta baixo.png',       containerId: 'lane-down',  receptorId: 'receptor-down'  },
  up:    { key: 'ArrowUp',    noteImg: 'seta cima.png',        containerId: 'lane-up',    receptorId: 'receptor-up'    },
  right: { key: 'ArrowRight', noteImg: 'seta direita.png',     containerId: 'lane-right', receptorId: 'receptor-right' },
};

/** Tecla → direção (para busca rápida no keydown) */
const KEY_TO_DIRECTION = {};
for (const [dir, data] of Object.entries(LANES)) {
  KEY_TO_DIRECTION[data.key] = dir;
}

// Adiciona suporte a WASD (minúsculo e maiúsculo)
KEY_TO_DIRECTION['a'] = 'left';
KEY_TO_DIRECTION['A'] = 'left';
KEY_TO_DIRECTION['s'] = 'down';
KEY_TO_DIRECTION['S'] = 'down';
KEY_TO_DIRECTION['w'] = 'up';
KEY_TO_DIRECTION['W'] = 'up';
KEY_TO_DIRECTION['d'] = 'right';
KEY_TO_DIRECTION['D'] = 'right';

// =============================================================
//  ESTADO DO JOGO
// =============================================================

let score = 0;
let combo = 0;

/**
 * Lista de notas ativas.
 * Cada nota é um objeto:
 *   { direction, y, element, judged }
 *
 *   direction — 'left' | 'down' | 'up' | 'right'
 *   y         — posição vertical atual (px a partir do topo da lane)
 *   element   — referência ao elemento DOM da nota
 *   judged    — se a nota já foi julgada (evita dupla pontuação)
 */
const notes = [];

/** Timestamp do último frame (para deltaTime) */
let lastFrameTime = 0;

/** Timer do feedback ativo */
let feedbackTimer = null;
let gameStartTimeMs = 0;
let isMusicPlaying = false;
let isPaused = false;
let savedVolume = 1;

/** Timer de spawn da próxima nota (modo aleatório) */
let nextSpawnTimer = null;

/** Chart carregado: array de { time, direction } ordenado por tempo */
let chartNotes = [];

/** Índice da próxima nota do chart a ser spawnada */
let chartNoteIndex = 0;

/** Se true, usa o chart. Se false, usa spawn aleatório. */
let useChart = false;

// =============================================================
//  ESTADO DA ANIMAÇÃO — ITSUKA
// =============================================================

/** Sprites da Itsuka: IDLE e as duas poses de toque */
const ITSUKA_IDLE = 'itsuka.png';

/**
 * Sequência completa do ciclo de animação:
 *   idle → tocado → idle → tocandobaixo → (repete)
 */
const ITSUKA_CYCLE = [
  'itsuka.png',
  'itsukatocado.png',
  'itsuka.png',
  'itsukatocandobaixo.png',
];

/** Deslocamento vertical (px) para cada frame — dá sensação de movimento */
const ITSUKA_DIP = 4;
const ITSUKA_CYCLE_OFFSET = [0, ITSUKA_DIP, 0, ITSUKA_DIP];

/**
 * Índice atual na sequência cíclica.
 */
let itsukaPoseIndex = 0;

/**
 * ID do setInterval ativo que alterna os sprites.
 * null quando a Itsuka está em IDLE (combo = 0).
 */
let itsukaCycleInterval = null;

// =============================================================
//  ESTADO DA ANIMAÇÃO — YOTSUBA
// =============================================================

/** Sprite IDLE da Yotsuba */
const YOTSUBA_IDLE = 'yotsuba.png';

/**
 * Sequência completa do ciclo de animação:
 *   idle → prato → idle → tambor → (repete)
 */
const YOTSUBA_CYCLE = [
  'yotsuba.png',
  'yotsuba prato.png',
  'yotsuba.png',
  'yotsuba tambor.png',
];

/** Deslocamento vertical (px) para cada frame */
const YOTSUBA_DIP = 4;
const YOTSUBA_CYCLE_OFFSET = [0, YOTSUBA_DIP, 0, YOTSUBA_DIP];

/** Intervalo mínimo e máximo de troca de sprite (ms) */
const YOTSUBA_INTERVAL_MIN = 300;
const YOTSUBA_INTERVAL_MAX = 600;

/** Índice atual na sequência cíclica */
let yotsubaPoseIndex = 0;

/** Timeout ativo (usa setTimeout recursivo para variar o intervalo) */
let yotsubaCycleTimeout = null;

// =============================================================
//  ESTADO DA ANIMAÇÃO — MIKU
// =============================================================

/** Sprite IDLE da Miku */
const MIKU_IDLE = 'miku.png';

/** Todos os sprites da Miku apertando */
const MIKU_APERTANDO_SPRITES = [
  'mikuapertando.png',
  'mikuapertando2.png',
  'mikuapertando3.png',
  'mikuapertando4.png',
];

/** Deslocamento vertical (px) durante os frames de aperto */
const MIKU_DIP = 4;

/** Intervalo mínimo e máximo de troca de sprite (ms) */
const MIKU_INTERVAL_MIN = 200;
const MIKU_INTERVAL_MAX = 400;

/** Contadores para o ciclo dinâmico (2 a 3 apertos aleatórios, depois idle) */
let mikuApertandoCount = 0;
let mikuTargetApertando = 0;

/** Timeout ativo */
let mikuCycleTimeout = null;

// =============================================================
//  ESTADO DA ANIMAÇÃO — NINO
// =============================================================

/** Sprite IDLE da Nino */
const NINO_IDLE = 'nino.png';

/**
 * Sequência completa do ciclo de animação (mesmo padrão da Itsuka):
 *   idle → tocando → idle → tocandobaixo → (repete)
 */
const NINO_CYCLE = [
  'nino.png',
  'ninotocando.png',
  'nino.png',
  'ninotocandobaixo.png',
];

/** Deslocamento vertical (px) para cada frame */
const NINO_DIP = 4;
const NINO_CYCLE_OFFSET = [0, NINO_DIP, 0, NINO_DIP];

/**
 * Intervalo de troca aleatório (ms) — diferente da Itsuka (400ms fixo)
 * para garantir que fiquem dessincronizadas.
 */
const NINO_INTERVAL_MIN = 350;
const NINO_INTERVAL_MAX = 500;

/** Índice atual na sequência cíclica */
let ninoPoseIndex = 0;

/** Timeout ativo (setTimeout recursivo para variar o intervalo) */
let ninoCycleTimeout = null;

// =============================================================
//  ESTADO DA ANIMAÇÃO — ICHIKA
// =============================================================

/** Sprite IDLE da Ichika */
const ICHIKA_IDLE = 'ichika.png';

/**
 * Sequência completa do ciclo de animação:
 *   idle → cantando → cantando2 → (repete)
 */
const ICHIKA_CYCLE = [
  'ichika.png',
  'ichikacantando.png',
  'ichikacantando2.png',
];

/** Deslocamento vertical (px) para cada frame — alterna a cada troca */
const ICHIKA_DIP = 4;
const ICHIKA_CYCLE_OFFSET = [0, ICHIKA_DIP, ICHIKA_DIP];

/** Intervalo fixo de troca de sprite (ms) */
const ICHIKA_CYCLE_INTERVAL = 400;

/** Índice atual na sequência cíclica */
let ichikaPoseIndex = 0;

/** ID do setInterval ativo */
let ichikaCycleInterval = null;

// =============================================================
//  REFERÊNCIAS DOM
// =============================================================

const scoreValueEl    = document.getElementById('score-value');
const comboValueEl    = document.getElementById('combo-value');
const feedbackEl      = document.getElementById('judgement-feedback');
const itsukaSpriteEl  = document.getElementById('itsuka-sprite');
const yotsubaSpriteEl = document.getElementById('yotsuba-sprite');
const mikuSpriteEl    = document.getElementById('miku-sprite');
const ninoSpriteEl    = document.getElementById('nino-sprite');
const ichikaSpriteEl  = document.getElementById('ichika-sprite');
const bgMusicEl       = document.getElementById('bg-music');

// =============================================================
//  FUNÇÕES UTILITÁRIAS
// =============================================================

/**
 * Retorna a posição Y do centro do receptor dentro da lane.
 * Como a lane ocupa 100vh e o receptor fica no fundo,
 * calculamos a partir do bottom da lane.
 */
function getReceptorY(direction) {
  const lane      = LANES[direction];
  const receptor  = document.getElementById(lane.receptorId);
  const wrapper   = receptor.parentElement;

  // Usa offsetTop que é relativo ao container (.lane) e não é afetado pelo transform: scale()
  return wrapper.offsetTop + (wrapper.offsetHeight / 2);
}

/**
 * Retorna um número aleatório entre min e max (inclusive).
 */
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// =============================================================
//  CRIAÇÃO DE NOTAS
// =============================================================

/**
 * Cria uma nota visual numa direção específica.
 */
function spawnNote(direction, msLate = 0) {
  // Se não recebeu direção, escolhe aleatória (modo sem chart)
  if (!direction) {
    const directions = Object.keys(LANES);
    direction = directions[Math.floor(Math.random() * directions.length)];
  }

  const lane      = LANES[direction];
  const container = document.getElementById(lane.containerId);

  // Cria o elemento DOM
  const noteEl = document.createElement('div');
  noteEl.classList.add('note');

  const img = document.createElement('img');
  img.src = lane.noteImg;
  img.alt = direction;
  noteEl.appendChild(img);

  // Posição inicial com compensação de lag
  const pixelsLate = msLate * (getNoteSpeed() / 1000);
  const startY = -getNoteHeight() + pixelsLate;
  noteEl.style.top = startY + 'px';

  container.appendChild(noteEl);

  // Objeto da nota
  const note = {
    direction,
    y: startY,
    element: noteEl,
    judged: false,
  };

  notes.push(note);
}

/**
 * Agenda o próximo spawn de nota com intervalo aleatório (modo sem chart).
 */
function scheduleNextSpawn() {
  if (useChart) return; // Não usar spawn aleatório quando tiver chart
  const delay = randomBetween(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX);
  nextSpawnTimer = setTimeout(() => {
    spawnNote();
    scheduleNextSpawn();
  }, delay);
}

/**
 * Carrega o chart a partir da variável global (evita erro de CORS local).
 */
async function loadChart() {
  try {
    // Pega a musica selecionada do sistema de selecao
    var song = (typeof getSelectedSong === 'function') ? getSelectedSong() : null;
    var chartVarName = song ? song.chart : 'chartDay1';
    var chartData = window[chartVarName];

    if (chartData && chartData.notes && chartData.notes.length > 0) {
      // Ordena por tempo e calcula quando spawnar
      chartNotes = chartData.notes
        .sort((a, b) => a.time - b.time)
        .map(n => ({
          time: n.time,
          direction: n.direction,
          spawned: false,
        }));
      chartNoteIndex = 0;
      useChart = true;
      console.log('Chart carregado com sucesso. Musica:', chartVarName, 'Notas:', chartNotes.length);
    } else {
      useChart = false;
      console.log('Chart vazio ou nao encontrado:', chartVarName);
    }
  } catch (e) {
    console.log('Erro ao ler o chart global:', e);
    useChart = false;
  }
}

/**
 * Verifica se há notas do chart para spawnar no momento atual.
 * Deve ser chamada no game loop.
 */
function updateChartSpawner(currentMs) {
  if (!useChart || !bgMusicEl) return;

  // Calcula a distância exata que o centro da nota precisa viajar.
  // Spawn Y = -noteHeight. Centro inicial = -noteHeight + (noteHeight / 2) = -(noteHeight / 2)
  // Distância = receptorY - Centro Inicial = receptorY + (noteHeight / 2)
  const receptorY = getReceptorY('down'); // Todas as lanes são iguais
  const travelDistance = receptorY + (getNoteHeight() / 2);
  const travelTimeMs = (travelDistance / getNoteSpeed()) * 1000;

  // Spawna notas que precisam aparecer agora
  while (chartNoteIndex < chartNotes.length) {
    const chartNote = chartNotes[chartNoteIndex];
    const spawnTime = chartNote.time - travelTimeMs;

    if (currentMs >= spawnTime) {
      const msLate = currentMs - spawnTime;
      spawnNote(chartNote.direction, msLate);
      chartNoteIndex++;
    } else {
      break;
    }
  }
}

// =============================================================
//  MOVIMENTO DAS NOTAS (requestAnimationFrame + deltaTime)
// =============================================================

/**
 * Loop principal do jogo.
 * Atualiza a posição de cada nota usando deltaTime para
 * garantir fluidez independente do FPS.
 */
function gameLoop(timestamp) {
  // Calcula delta time em segundos
  if (lastFrameTime === 0) lastFrameTime = timestamp;
  const deltaTime = (timestamp - lastFrameTime) / 1000;
  lastFrameTime = timestamp;

  let currentMs;
  if (isMusicPlaying) {
    currentMs = bgMusicEl.currentTime * 1000;
  } else {
    currentMs = timestamp - gameStartTimeMs;
  }

  // Spawna notas do chart baseado no tempo da música (suporta valores negativos antes da música tocar)
  updateChartSpawner(currentMs);

  // Atualiza cada nota
  for (let i = notes.length - 1; i >= 0; i--) {
    const note = notes[i];
    if (note.judged) continue;

    // Move a nota para baixo
    note.y += getNoteSpeed() * deltaTime;
    note.element.style.top = note.y + 'px';

    // Verifica se a nota passou completamente do receptor → MISS automático
    const receptorY = getReceptorY(note.direction);
    const noteCenterY = note.y + (getNoteHeight() / 2);
    const distancePastReceptor = noteCenterY - receptorY;

    if (distancePastReceptor > getHitWindow()) {
      // Nota perdida
      judgeNote(note, 'miss');
    }
  }

  requestAnimationFrame(gameLoop);
}

// =============================================================
//  SISTEMA DE JULGAMENTO
// =============================================================

/**
 * Julga uma nota com o resultado dado.
 * Remove a nota do jogo e atualiza pontuação/combo.
 *
 * @param {object} note    — objeto da nota
 * @param {string} result  — 'perfect' | 'early' | 'late' | 'miss'
 */
function judgeNote(note, result) {
  // Evita dupla pontuação
  if (note.judged) return;
  note.judged = true;

  // Remove o elemento DOM
  note.element.remove();

  // Remove do array
  const idx = notes.indexOf(note);
  if (idx !== -1) notes.splice(idx, 1);

  // Pontuação
  let points = 0;
  switch (result) {
    case 'perfect':
      points = 100;
      combo++;
      checkComboAnim();
      break;
    case 'early':
    case 'late':
      points = 50;
      combo++;
      checkComboAnim();
      break;
    case 'miss':
      points = 0;
      combo = 0;
      break;
  }

  // Animação de todas as personagens — ciclo contínuo enquanto combo >= 1
  if (result === 'miss') {
    stopItsukaCycle();
    stopYotsubaCycle();
    stopMikuCycle();
    stopNinoCycle();
    stopIchikaCycle();
  } else {
    startItsukaCycle();
    startYotsubaCycle();
    startMikuCycle();
    startNinoCycle();
    startIchikaCycle();
  }

  score += points;

  // Atualiza HUD
  updateHUD();

  // Mostra feedback visual
  showFeedback(result, points);
}

/**
 * Processa o input do jogador para uma direção específica.
 * Encontra a nota mais próxima do receptor naquela lane
 * e calcula a precisão.
 */
function processInput(direction) {
  // Animação de escala no receptor
  const receptor = document.getElementById(LANES[direction].receptorId);
  receptor.classList.add('pressed');
  setTimeout(() => receptor.classList.remove('pressed'), 100);

  // Encontra a nota não-julgada mais próxima do receptor nesta lane
  const receptorY = getReceptorY(direction);
  let closestNote = null;
  let closestDist = Infinity;

  for (const note of notes) {
    if (note.direction !== direction || note.judged) continue;

    // Centro da nota (nota agora tem altura de 10vh)
    const noteCenterY = note.y + (getNoteHeight() / 2);
    const dist = Math.abs(noteCenterY - receptorY);

    if (dist < closestDist) {
      closestDist = dist;
      closestNote = note;
    }
  }

  // Sem nota nesta lane → nada acontece
  if (!closestNote) return;

  // Diferença com sinal: negativo = nota ainda não chegou (EARLY), positivo = nota já passou (LATE)
  const noteCenterY = closestNote.y + (getNoteHeight() / 2);
  const signedDist  = noteCenterY - receptorY;
  const absDist     = Math.abs(signedDist);

  if (absDist <= getPerfectWindow()) {
    judgeNote(closestNote, 'perfect');
  } else if (absDist <= getHitWindow()) {
    // Nota ainda não chegou ao receptor → jogador apertou cedo
    if (signedDist < 0) {
      judgeNote(closestNote, 'early');
    } else {
      judgeNote(closestNote, 'late');
    }
  }
  // Se absDist > getHitWindow(), o jogador apertou muito longe — ignora
}

// =============================================================
//  HUD E ANIMAÇÕES ESPECIAIS
// =============================================================

/**
 * Dispara animação especial de combo se necessário.
 */
function checkComboAnim() {
  if (combo === 30) {
    const overlay = document.getElementById('ichika-combo-overlay');
    if (overlay) {
      // Remove e adiciona a classe para garantir que a animação rode mesmo se já tiver rodado antes
      overlay.classList.remove('animate');
      // Força um reflow (recalcula estilos) para reiniciar a animação
      void overlay.offsetWidth; 
      overlay.classList.add('animate');
    }
  }
}

/**
 * Atualiza os valores de score e combo na interface.
 */
function updateHUD() {
  scoreValueEl.textContent = score;
  comboValueEl.textContent = combo;
}

// =============================================================
//  ANIMAÇÃO DA ITSUKA
// =============================================================

/**
 * Inicia o ciclo contínuo de animação da Itsuka.
 *
 * Enquanto o combo estiver ativo (>= 1), os sprites alternam
 * automaticamente a cada ITSUKA_CYCLE_INTERVAL ms:
 *
 *   idle → itsukatocado.png → idle → itsukatocandobaixo.png → ...
 *
 * Se o ciclo já estiver rodando, não cria um novo interval.
 */
function startItsukaCycle() {
  // Já está rodando — não duplicar
  if (itsukaCycleInterval !== null) return;

  const container = document.getElementById('itsuka-container');

  // Aplica a primeira pose imediatamente
  itsukaSpriteEl.src = ITSUKA_CYCLE[itsukaPoseIndex];
  container.style.transform = `translateY(${ITSUKA_CYCLE_OFFSET[itsukaPoseIndex]}px)`;
  itsukaPoseIndex = (itsukaPoseIndex + 1) % ITSUKA_CYCLE.length;

  // Inicia o intervalo de alternância
  itsukaCycleInterval = setInterval(() => {
    itsukaSpriteEl.src = ITSUKA_CYCLE[itsukaPoseIndex];
    container.style.transform = `translateY(${ITSUKA_CYCLE_OFFSET[itsukaPoseIndex]}px)`;
    itsukaPoseIndex = (itsukaPoseIndex + 1) % ITSUKA_CYCLE.length;
  }, ITSUKA_CYCLE_INTERVAL);
}

/**
 * Para o ciclo de animação e retorna a Itsuka ao sprite IDLE.
 * Chamada quando o combo é resetado para 0 (MISS).
 */
function stopItsukaCycle() {
  if (itsukaCycleInterval !== null) {
    clearInterval(itsukaCycleInterval);
    itsukaCycleInterval = null;
  }
  itsukaSpriteEl.src = ITSUKA_IDLE;
  document.getElementById('itsuka-container').style.transform = 'translateY(0)';
  itsukaPoseIndex = 0;
}

// =============================================================
//  ANIMAÇÃO DA YOTSUBA
// =============================================================

/**
 * Inicia o ciclo contínuo de animação da Yotsuba.
 *
 * Usa setTimeout recursivo com intervalo aleatório entre
 * YOTSUBA_INTERVAL_MIN e YOTSUBA_INTERVAL_MAX para que ela
 * toque em tempo diferente da Itsuka.
 *
 *   idle → prato → idle → tambor → ...
 */
function startYotsubaCycle() {
  // Já está rodando — não duplicar
  if (yotsubaCycleTimeout !== null) return;

  const container = document.getElementById('yotsuba-container');

  // Aplica a primeira pose imediatamente
  yotsubaSpriteEl.src = YOTSUBA_CYCLE[yotsubaPoseIndex];
  container.style.transform = `translateY(${YOTSUBA_CYCLE_OFFSET[yotsubaPoseIndex]}px)`;
  yotsubaPoseIndex = (yotsubaPoseIndex + 1) % YOTSUBA_CYCLE.length;

  // Função recursiva com intervalo aleatório
  function nextStep() {
    const delay = randomBetween(YOTSUBA_INTERVAL_MIN, YOTSUBA_INTERVAL_MAX);
    yotsubaCycleTimeout = setTimeout(() => {
      yotsubaSpriteEl.src = YOTSUBA_CYCLE[yotsubaPoseIndex];
      container.style.transform = `translateY(${YOTSUBA_CYCLE_OFFSET[yotsubaPoseIndex]}px)`;
      yotsubaPoseIndex = (yotsubaPoseIndex + 1) % YOTSUBA_CYCLE.length;
      nextStep();
    }, delay);
  }
  nextStep();
}

/**
 * Para o ciclo de animação e retorna a Yotsuba ao sprite IDLE.
 */
function stopYotsubaCycle() {
  if (yotsubaCycleTimeout !== null) {
    clearTimeout(yotsubaCycleTimeout);
    yotsubaCycleTimeout = null;
  }
  yotsubaSpriteEl.src = YOTSUBA_IDLE;
  document.getElementById('yotsuba-container').style.transform = 'translateY(0)';
  yotsubaPoseIndex = 0;
}

// =============================================================
//  ANIMAÇÃO DA MIKU
// =============================================================

/**
 * Inicia o ciclo contínuo de animação da Miku.
 * Escolhe aleatoriamente de 2 a 3 poses de aperto dentre todas as disponíveis,
 * exibe-as, depois volta para IDLE, e repete.
 */
function startMikuCycle() {
  if (mikuCycleTimeout !== null) return;

  const container = document.getElementById('miku-container');
  mikuApertandoCount = 0;
  mikuTargetApertando = randomBetween(2, 3); // Decide se fará 2 ou 3 apertos

  function nextStep() {
    let nextSprite;
    let isIdle = false;

    if (mikuApertandoCount < mikuTargetApertando) {
      // Sorteia um dos sprites de aperto
      const randIndex = Math.floor(Math.random() * MIKU_APERTANDO_SPRITES.length);
      nextSprite = MIKU_APERTANDO_SPRITES[randIndex];
      mikuApertandoCount++;
    } else {
      // Concluiu os apertos, agora faz uma pausa no idle
      nextSprite = MIKU_IDLE;
      isIdle = true;
      // Reseta para o próximo ciclo
      mikuApertandoCount = 0;
      mikuTargetApertando = randomBetween(2, 3);
    }

    // Aplica imagem e deslocamento (dip)
    mikuSpriteEl.src = nextSprite;
    container.style.transform = `translateY(${isIdle ? 0 : MIKU_DIP}px)`;

    const delay = randomBetween(MIKU_INTERVAL_MIN, MIKU_INTERVAL_MAX);
    mikuCycleTimeout = setTimeout(nextStep, delay);
  }

  // Aciona o primeiro passo imediatamente
  nextStep();
}

/**
 * Para o ciclo de animação e retorna a Miku ao sprite IDLE.
 */
function stopMikuCycle() {
  if (mikuCycleTimeout !== null) {
    clearTimeout(mikuCycleTimeout);
    mikuCycleTimeout = null;
  }
  mikuSpriteEl.src = MIKU_IDLE;
  document.getElementById('miku-container').style.transform = 'translateY(0)';
  mikuApertandoCount = 0;
}

// =============================================================
//  ANIMAÇÃO DA NINO
// =============================================================

/**
 * Inicia o ciclo contínuo de animação da Nino.
 * Mesmo padrão da Itsuka (idle→tocando→idle→tocandobaixo)
 * mas com intervalo aleatório entre NINO_INTERVAL_MIN e NINO_INTERVAL_MAX
 * para dessincronizar da Itsuka.
 */
function startNinoCycle() {
  if (ninoCycleTimeout !== null) return;

  const container = document.getElementById('nino-container');

  // Aplica a primeira pose imediatamente
  ninoSpriteEl.src = NINO_CYCLE[ninoPoseIndex];
  container.style.transform = `translateY(${NINO_CYCLE_OFFSET[ninoPoseIndex]}px)`;
  ninoPoseIndex = (ninoPoseIndex + 1) % NINO_CYCLE.length;

  function nextStep() {
    const delay = randomBetween(NINO_INTERVAL_MIN, NINO_INTERVAL_MAX);
    ninoCycleTimeout = setTimeout(() => {
      ninoSpriteEl.src = NINO_CYCLE[ninoPoseIndex];
      container.style.transform = `translateY(${NINO_CYCLE_OFFSET[ninoPoseIndex]}px)`;
      ninoPoseIndex = (ninoPoseIndex + 1) % NINO_CYCLE.length;
      nextStep();
    }, delay);
  }
  nextStep();
}

/**
 * Para o ciclo de animação e retorna a Nino ao sprite IDLE.
 */
function stopNinoCycle() {
  if (ninoCycleTimeout !== null) {
    clearTimeout(ninoCycleTimeout);
    ninoCycleTimeout = null;
  }
  ninoSpriteEl.src = NINO_IDLE;
  document.getElementById('nino-container').style.transform = 'translateY(0)';
  ninoPoseIndex = 0;
}

// =============================================================
//  ANIMAÇÃO DA ICHIKA
// =============================================================

/**
 * Inicia o ciclo contínuo de animação da Ichika.
 *   idle → cantando → cantando2 → idle → cantando → cantando2 → ...
 * Intervalo fixo de 400ms. Desce 4px nos sprites cantando.
 */
function startIchikaCycle() {
  if (ichikaCycleInterval !== null) return;

  const container = document.getElementById('ichika-container');

  // Aplica a primeira pose imediatamente
  ichikaSpriteEl.src = ICHIKA_CYCLE[ichikaPoseIndex];
  container.style.transform = `translateY(${ICHIKA_CYCLE_OFFSET[ichikaPoseIndex]}px)`;
  ichikaPoseIndex = (ichikaPoseIndex + 1) % ICHIKA_CYCLE.length;

  // Inicia o intervalo fixo
  ichikaCycleInterval = setInterval(() => {
    ichikaSpriteEl.src = ICHIKA_CYCLE[ichikaPoseIndex];
    container.style.transform = `translateY(${ICHIKA_CYCLE_OFFSET[ichikaPoseIndex]}px)`;
    ichikaPoseIndex = (ichikaPoseIndex + 1) % ICHIKA_CYCLE.length;
  }, ICHIKA_CYCLE_INTERVAL);
}

/**
 * Para o ciclo de animação e retorna a Ichika ao sprite IDLE.
 */
function stopIchikaCycle() {
  if (ichikaCycleInterval !== null) {
    clearInterval(ichikaCycleInterval);
    ichikaCycleInterval = null;
  }
  ichikaSpriteEl.src = ICHIKA_IDLE;
  document.getElementById('ichika-container').style.transform = 'translateY(0)';
  ichikaPoseIndex = 0;
}

// =============================================================
//  FEEDBACK VISUAL
// =============================================================

/**
 * Mostra o feedback de julgamento na tela.
 *
 * @param {string} result — 'perfect' | 'early' | 'late' | 'miss'
 * @param {number} points — pontos ganhos
 */
function showFeedback(result, points) {
  // Limpa feedback anterior
  if (feedbackTimer) clearTimeout(feedbackTimer);

  // Remove classes anteriores
  feedbackEl.className = '';

  // Força reflow para reiniciar animação CSS
  void feedbackEl.offsetWidth;

  // Define conteúdo
  const label = result.toUpperCase();
  feedbackEl.innerHTML = `${label}<span class="points">+${points}</span>`;

  // Adiciona classe do resultado
  feedbackEl.classList.add(result);
  feedbackEl.style.opacity = '1';

  // Esconde após FEEDBACK_DURATION ms
  feedbackTimer = setTimeout(() => {
    feedbackEl.style.opacity = '0';
  }, FEEDBACK_DURATION);
}

// =============================================================
//  EVENTOS DE TECLADO
// =============================================================

document.addEventListener('keydown', (e) => {
  // Só processa inputs do jogo se a tela do jogo estiver visível
  if (document.getElementById('game-screen').classList.contains('hidden')) return;

  // Se o autoplay foi bloqueado, a música começa no primeiro toque de tecla
  if (bgMusicEl.paused) {
    bgMusicEl.volume = 0;
    bgMusicEl.play().then(() => {
      fadeInAudio(bgMusicEl, 1500);
    }).catch(console.error);
  }

  const direction = KEY_TO_DIRECTION[e.key];
  if (!direction) return;

  // Previne scroll da página
  e.preventDefault();

  processInput(direction);
});

// =============================================================
//  SISTEMA DE MENU
// =============================================================

const titleScreen     = document.getElementById('title-screen');
const songSelectScreen = document.getElementById('song-select-screen');
const gameScreen       = document.getElementById('game-screen');
const playBtn          = document.getElementById('play-btn');
const startSongBtn     = document.getElementById('start-song-btn');

/**
 * Tela 1 → Tela 2: Ao clicar no Play
 */
playBtn.addEventListener('click', () => {
  titleScreen.classList.add('hidden');
  songSelectScreen.classList.remove('hidden');
});

/**
 * Tela 2 → Tela 3: Ao clicar em JOGAR
 */
startSongBtn.addEventListener('click', () => {
  songSelectScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');

  // Inicia o jogo
  startGame();
});

// =============================================================
//  INICIALIZAÇÃO DO JOGO
// =============================================================

/**
 * Faz um fade in suave no áudio
 */
function fadeInAudio(audioEl, durationMs) {
  audioEl.volume = 0;
  const steps = 20;
  const stepTime = durationMs / steps;
  let currentStep = 0;

  const fadeInterval = setInterval(() => {
    currentStep++;
    let vol = currentStep / steps;
    if (vol >= 1) {
      vol = 1;
      clearInterval(fadeInterval);
    }
    audioEl.volume = vol;
  }, stepTime);
}

/**
 * Inicia o jogo: carrega o chart, começa o loop de animação e a música.
 */
async function startGame() {
  updateHUD();

  // Pega a musica selecionada e configura audio + background
  var song = (typeof getSelectedSong === 'function') ? getSelectedSong() : null;
  if (song) {
    bgMusicEl.src = song.audio;
    document.getElementById('game-screen').style.backgroundImage = "url('" + song.background + "')";
    // Classe especial para o cenario starry
    if (song.background === 'starry.png') {
      document.getElementById('game-screen').classList.add('starry-stage');
    } else {
      document.getElementById('game-screen').classList.remove('starry-stage');
    }
    if (song.background === 'palco.png') {
      document.getElementById('game-screen').classList.add('palco-stage');
    } else {
      document.getElementById('game-screen').classList.remove('palco-stage');
    }
  }

  // Tenta carregar o chart da música selecionada
  await loadChart();

  // Aguarda 2 segundos antes de iniciar a música e as notas
  gameStartTimeMs = performance.now() + 2000;
  requestAnimationFrame(gameLoop);

  setTimeout(() => {

    // Toca a música com fade-in de 1.5 segundos
    bgMusicEl.currentTime = 0;
    bgMusicEl.playbackRate = 1;
    bgMusicEl.volume = 0; // Garante que comece mudo
    bgMusicEl.play().then(() => {
      gameStartTimeMs = performance.now();
      isMusicPlaying = true;
      fadeInAudio(bgMusicEl, 1500);
    }).catch(() => {
      console.log('Autoplay bloqueado — a música tocará ao pressionar a primeira tecla.');
    });
  }, 2000);
}


