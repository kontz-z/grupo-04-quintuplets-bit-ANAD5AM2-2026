// =============================================================
//  SISTEMA DE RESULTADO (FIM DA MÚSICA)
// =============================================================

var maxCombo = 0;
var gameEnded = false;

// Rastreia o maior combo durante o jogo
(function() {
  // Intercepta updateHUD para rastrear maxCombo
  var _origUpdateHUD = updateHUD;
  updateHUD = function() {
    if (combo > maxCombo) {
      maxCombo = combo;
    }
    _origUpdateHUD();
  };

  var resultOverlay = document.getElementById('result-overlay');
  var resultScoreVal = document.getElementById('result-score-value');
  var resultComboVal = document.getElementById('result-combo-value');
  var resultMenuBtn = document.getElementById('result-menu-btn');

  // Detecta quando a música termina
  bgMusicEl.addEventListener('ended', function() {
    if (gameEnded) return;
    // Espera 2 segundos após a música acabar para mostrar o resultado
    setTimeout(function() {
      showResult();
    }, 2000);
  });

  function showResult() {
    gameEnded = true;
    isPaused = true; // Para o game loop

    // Atualiza maxCombo uma última vez
    if (combo > maxCombo) maxCombo = combo;

    // Preenche os valores
    resultScoreVal.textContent = score;
    resultComboVal.textContent = maxCombo;

    // Mostra o overlay
    resultOverlay.classList.remove('hidden');
  }

  // Botão menu do resultado: volta à seleção de música
  resultMenuBtn.addEventListener('click', function() {
    gameEnded = false;
    isPaused = false;
    resultOverlay.classList.add('hidden');

    bgMusicEl.pause();
    bgMusicEl.currentTime = 0;
    isMusicPlaying = false;

    // Limpa notas
    for (var i = 0; i < notes.length; i++) {
      notes[i].element.remove();
    }
    notes.length = 0;

    // Reseta estado
    score = 0;
    combo = 0;
    maxCombo = 0;
    chartNoteIndex = 0;
    lastFrameTime = 0;
    updateHUD();

    // Remove classes de cenario
    document.getElementById('game-screen').classList.remove('starry-stage');
    document.getElementById('game-screen').classList.remove('palco-stage');

    // Volta para a seleção de música
    gameScreen.classList.add('hidden');
    songSelectScreen.classList.remove('hidden');
  });
})();
