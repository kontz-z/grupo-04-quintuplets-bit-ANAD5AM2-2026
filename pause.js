// =============================================================
//  SISTEMA DE PAUSA
// =============================================================

(function() {
  var pauseOverlay = document.getElementById('pause-overlay');
  var menuBtnEl    = document.getElementById('menu-btn');
  var volSlider    = document.getElementById('volume-slider');
  var volValue     = document.getElementById('volume-value');
  var volIcon      = document.getElementById('volume-icon');

  // Guarda o gameLoop original e injeta check de pausa
  var _origLoop = gameLoop;
  gameLoop = function(timestamp) {
    if (isPaused) {
      lastFrameTime = 0;
      requestAnimationFrame(gameLoop);
      return;
    }
    _origLoop(timestamp);
  };

  function togglePause() {
    if (isPaused) {
      resumeGame();
    } else {
      pauseGame();
    }
  }

  function pauseGame() {
    isPaused = true;
    pauseOverlay.classList.remove('hidden');
    if (isMusicPlaying && !bgMusicEl.paused) {
      bgMusicEl.pause();
    }
  }

  function resumeGame() {
    isPaused = false;
    pauseOverlay.classList.add('hidden');
    if (isMusicPlaying) {
      bgMusicEl.play();
    }
    lastFrameTime = 0;
  }

  // ESC para pausar/despausar (captura antes do handler do jogo)
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !document.getElementById('game-screen').classList.contains('hidden')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      togglePause();
      return;
    }
    // Bloqueia inputs do jogo durante a pausa
    if (isPaused) {
      e.stopImmediatePropagation();
    }
  }, true);

  // Botao Menu: volta ao menu principal
  menuBtnEl.addEventListener('click', function() {
    isPaused = false;
    pauseOverlay.classList.add('hidden');

    bgMusicEl.pause();
    bgMusicEl.currentTime = 0;
    isMusicPlaying = false;

    for (var i = 0; i < notes.length; i++) {
      notes[i].element.remove();
    }
    notes.length = 0;

    score = 0;
    combo = 0;
    chartNoteIndex = 0;
    lastFrameTime = 0;
    updateHUD();

    gameScreen.classList.remove('starry-stage');
    gameScreen.classList.remove('palco-stage');
    gameScreen.classList.add('hidden');
    songSelectScreen.classList.remove('hidden');
  });

  // Volume slider
  volSlider.addEventListener('input', function() {
    var vol = volSlider.value / 100;
    bgMusicEl.volume = vol;
    savedVolume = vol;
    volValue.textContent = volSlider.value + '%';
    if (vol === 0) {
      volIcon.innerHTML = '&#128263;';
    } else if (vol < 0.5) {
      volIcon.innerHTML = '&#128265;';
    } else {
      volIcon.innerHTML = '&#128266;';
    }
  });

  // Clicar no icone para mutar/desmutar
  volIcon.addEventListener('click', function() {
    if (bgMusicEl.volume > 0) {
      savedVolume = bgMusicEl.volume;
      bgMusicEl.volume = 0;
      volSlider.value = 0;
      volValue.textContent = '0%';
      volIcon.innerHTML = '&#128263;';
    } else {
      bgMusicEl.volume = savedVolume || 1;
      volSlider.value = Math.round(bgMusicEl.volume * 100);
      volValue.textContent = volSlider.value + '%';
      volIcon.innerHTML = '&#128266;';
    }
  });

})();
