// =============================================================
//  SISTEMA DE SELEÇÃO DE MÚSICAS
// =============================================================

var SONGS = [
  {
    id: 'day1',
    name: 'Day 1 - Red Velvet',
    chart: 'chartDay1',
    audio: 'Day 1 - Red Velvet [8-bit cover] - Soshu (youtube).mp3',
    cardImg: 'selecione a musica.png',
    background: 'carroselextendido.png'
  },
  {
    id: 'bocchi',
    name: 'Ano Band - Bocchi the Rock',
    chart: 'chartBocchi',
    audio: '\u3010\u30D5\u30A1\u30DF\u30B3\u30F3\u98A8\u3011\u3042\u306E\u30D0\u30F3\u30C9 - \u307C\u3063\u3061\u30FB\u3056\u30FB\u308D\u3063\u304F\uFF01[ FamiTracker 2A03 ].mp3',
    cardImg: 'bocchicapa.png',
    background: 'starry.png'
  },
  {
    id: 'popin2',
    name: 'POP IN 2 - B Komachi',
    chart: 'chartPopin2',
    audio: '\u300CChiptune\u300DOshi no Ko S2 - POP IN 2 B Komachi.mp3',
    cardImg: 'pop.png',
    background: 'palco.png'
  }
];

var currentSongIndex = 0;

/**
 * Atualiza a imagem do card da música na tela de seleção.
 */
function updateSongCard() {
  var cardImg = document.getElementById('song-card-img');
  var song = SONGS[currentSongIndex];
  cardImg.src = song.cardImg;
  cardImg.alt = song.name;
}

/**
 * Navega para a música anterior.
 */
function prevSong() {
  currentSongIndex--;
  if (currentSongIndex < 0) {
    currentSongIndex = SONGS.length - 1;
  }
  updateSongCard();
}

/**
 * Navega para a próxima música.
 */
function nextSong() {
  currentSongIndex++;
  if (currentSongIndex >= SONGS.length) {
    currentSongIndex = 0;
  }
  updateSongCard();
}

/**
 * Retorna os dados da música selecionada atualmente.
 */
function getSelectedSong() {
  return SONGS[currentSongIndex];
}

// Inicializa os botões de navegação quando o DOM estiver pronto
(function() {
  var arrowLeft = document.getElementById('song-arrow-left');
  var arrowRight = document.getElementById('song-arrow-right');

  if (arrowLeft) {
    arrowLeft.addEventListener('click', function() {
      prevSong();
    });
  }

  if (arrowRight) {
    arrowRight.addEventListener('click', function() {
      nextSong();
    });
  }

  // Também suporta setas do teclado na tela de seleção
  document.addEventListener('keydown', function(e) {
    var songSelectScreen = document.getElementById('song-select-screen');
    if (songSelectScreen.classList.contains('hidden')) return;

    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      prevSong();
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      nextSong();
    }
  });
})();
