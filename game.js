const WIDTH = 1280
const HEIGHT = 720
const PLAYER_SPEED = 6
const LASER_SPEED = 8
const ENEMY_MIN_SPEED = 1.2
const ENEMY_MAX_SPEED = 2.8
const ENEMY_SHOT_CHANCE = 0.005
const POWERUP_DROP_CHANCE = 0.12
const BOSS_BOMB_CHANCE = 0.02
const BASE_SHOOT_COOLDOWN = 12
const RAPID_SHOOT_COOLDOWN = 7
const QUICK_TEST_MODE = false
const BOSS_WAVE_INTERVAL = QUICK_TEST_MODE ? 2 : 3

const canvas = document.getElementById('game')
const ctx = canvas ? canvas.getContext('2d') : null
const scoreEl = document.getElementById('score')
const bestEl = document.getElementById('best')
const livesEl = document.getElementById('lives')
const waveEl = document.getElementById('wave')
const statusEl = document.getElementById('status')
const pauseBtn = document.getElementById('pause-btn')
const audioBtn = document.getElementById('audio-btn')
const keys = new Set()
const appEl = document.querySelector('.app')
const headerEl = document.querySelector('.header')
const hudEl = document.querySelector('.hud')
const controlsEl = document.querySelector('.controls')
const stageEl = document.querySelector('.stage')
const footerEl = document.querySelector('.footer')

const bg = new Image()
bg.src = './assets/background-black.png'
const yellowShip = new Image()
yellowShip.src = './assets/pixel_ship_yellow.png'
const enemyShips = [
  './assets/pixel_ship_red_small.png',
  './assets/pixel_ship_green_small.png',
  './assets/pixel_ship_blue_small.png',
].map((src) => {
  const img = new Image()
  img.src = src
  return img
})
const yellowLaser = new Image()
yellowLaser.src = './assets/pixel_laser_yellow.png'
const enemyLasers = [
  './assets/pixel_laser_red.png',
  './assets/pixel_laser_green.png',
  './assets/pixel_laser_blue.png',
].map((src) => {
  const img = new Image()
  img.src = src
  return img
})

const bgMusic = new Audio('./assets/background_music.mp3')
bgMusic.loop = true
bgMusic.volume = 0.35

const POWERUP_STYLES = {
  shield: { color: '#06b6d4', label: 'S' },
  double: { color: '#a78bfa', label: '2X' },
  rapid: { color: '#f97316', label: 'RF' },
  life: { color: '#34d399', label: '1UP' },
}

function isImageReady(img) {
  return Boolean(img && img.complete && img.naturalWidth > 0)
}

let player
let enemies
let shots
let enemyShots
let bossBombs
let powerups
let particles
let score
let bestScore = 0
try {
  bestScore = Number(localStorage.getItem('pyinvaders-best') || '0')
} catch {
  bestScore = 0
}
let lives
let wave
let gameOver
let paused
let audioEnabled
let shootCooldown
let waveCooldown
let shieldTimer
let doubleShotTimer
let rapidFireTimer
let boss
let bossTimer
let emptyFieldFrames
let currentPhase
let statusFlash
let statusFlashTimer

function resetGame() {
  player = { x: WIDTH / 2 - 30, y: HEIGHT - 88, w: 60, h: 44 }
  enemies = []
  shots = []
  enemyShots = []
  bossBombs = []
  powerups = []
  particles = []
  score = 0
  lives = 3
  wave = 1
  gameOver = false
  paused = false
  audioEnabled = false
  shootCooldown = 0
  waveCooldown = 0
  shieldTimer = 0
  doubleShotTimer = 0
  rapidFireTimer = 0
  boss = null
  bossTimer = 0
  emptyFieldFrames = 0
  currentPhase = 'wave'
  statusFlash = ''
  statusFlashTimer = 0
  startWave()
  syncHud()
  refreshAudioButton()
  refreshPauseButton()
}

function syncHud() {
  if (scoreEl) scoreEl.textContent = String(score)
  if (bestEl) bestEl.textContent = String(bestScore)
  if (livesEl) livesEl.textContent = String(lives)
  if (waveEl) waveEl.textContent = String(wave)
  if (!statusEl) return
  if (gameOver) statusEl.textContent = 'Game over'
  else if (paused) statusEl.textContent = 'Paused'
  else if (statusFlashTimer > 0 && statusFlash) statusEl.textContent = statusFlash
  else if (boss) {
    const hp = Number.isFinite(boss.hp) ? Math.max(0, Math.floor(boss.hp)) : 0
    statusEl.textContent = `Boss fight (${hp})`
  }
  else if (currentPhase === 'cleared') statusEl.textContent = `Wave ${wave} incoming`
  else if (shieldTimer > 0 || doubleShotTimer > 0 || rapidFireTimer > 0) {
    const effects = []
    if (shieldTimer > 0) effects.push('Shield')
    if (doubleShotTimer > 0) effects.push('Double shot')
    if (rapidFireTimer > 0) effects.push('Rapid fire')
    statusEl.textContent = effects.join(' + ')
  }
  else statusEl.textContent = 'Running'
}

function refreshPauseButton() {
  if (pauseBtn) {
    pauseBtn.textContent = paused ? 'Resume' : 'Pause'
    pauseBtn.setAttribute('aria-pressed', paused ? 'true' : 'false')
  }
}

function refreshAudioButton() {
  if (audioBtn) {
    audioBtn.textContent = `Music: ${audioEnabled ? 'On' : 'Off'}`
    audioBtn.setAttribute('aria-pressed', audioEnabled ? 'true' : 'false')
  }
}

function setAudioEnabled(enabled) {
  audioEnabled = enabled
  if (audioEnabled) {
    bgMusic.play().catch(() => {})
  } else {
    bgMusic.pause()
  }
  refreshAudioButton()
}

function isBossWave(level) {
  return level > 1 && level % BOSS_WAVE_INTERVAL === 0
}

function setStatusFlash(message, frames = 120) {
  statusFlash = message
  statusFlashTimer = frames
}

function spawnEnemyWave() {
  const rows = QUICK_TEST_MODE ? 1 : Math.min(5, 2 + Math.floor(wave / 2))
  const cols = QUICK_TEST_MODE ? 4 : 10
  const xGap = QUICK_TEST_MODE ? 142 : 112
  const yGap = 60
  const formationWidth = (cols - 1) * xGap + 40
  const startX = Math.max(24, Math.floor((WIDTH - formationWidth) / 2))
  const startY = 60

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const roll = Math.random()
      const pattern = roll > 0.86 ? 'dive' : roll > 0.54 ? 'zigzag' : 'sine'
      enemies.push({
        x: startX + c * xGap,
        y: startY + r * yGap,
        w: 40,
        h: 30,
        speed: ENEMY_MIN_SPEED + Math.random() * (ENEMY_MAX_SPEED - ENEMY_MIN_SPEED),
        dir: Math.random() > 0.5 ? 1 : -1,
        img: enemyShips[(r + c) % enemyShips.length],
        pattern,
        step: Math.floor(Math.random() * 120),
        swayAmp: 0.3 + Math.random() * 0.7,
        swayFreq: 0.03 + Math.random() * 0.025,
        swayPhase: Math.random() * Math.PI * 2,
        zigzagPeriod: 28 + Math.floor(Math.random() * 28),
        diveTimer: 0,
        diveChance: 0.00045 + wave * 0.00008,
        dropRate: 0.03 + wave * 0.004,
      })
    }
  }
}

function spawnBoss() {
  boss = {
    x: WIDTH / 2 - 130,
    y: 38,
    w: 260,
    h: 88,
    hp: 12 + wave * 3,
    maxHp: 12 + wave * 3,
    speed: 2.2 + wave * 0.18,
    dir: Math.random() > 0.5 ? 1 : -1,
    sprite: enemyShips[wave % enemyShips.length] || null,
  }
  bossTimer = 0
  emptyFieldFrames = 0
  setStatusFlash(`Boss wave ${wave}!`, 110)
}

function startWave() {
  enemies = []
  boss = null
  shots = []
  enemyShots = []
  bossBombs = []
  powerups = []
  bossTimer = 0
  emptyFieldFrames = 0
  waveCooldown = 0
  currentPhase = isBossWave(wave) ? 'boss' : 'wave'
  if (currentPhase === 'boss') spawnBoss()
  else spawnEnemyWave()
}

function queueNextWave() {
  if (currentPhase === 'cleared') return
  currentPhase = 'cleared'
  wave += 1
  waveCooldown = 54
  enemyShots = []
  bossBombs = []
  powerups = []
}

function rectHit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function spawnParticles(x, y, color) {
  for (let i = 0; i < 8; i += 1) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3,
      life: 24,
      color,
    })
  }
}

function rollPowerupType() {
  const roll = Math.random()
  if (roll < 0.3) return 'shield'
  if (roll < 0.58) return 'double'
  if (roll < 0.85) return 'rapid'
  return 'life'
}

function maybeDropPowerup(enemy, chance = POWERUP_DROP_CHANCE) {
  if (Math.random() > chance) return
  powerups.push({
    x: enemy.x + enemy.w / 2 - 12,
    y: enemy.y + enemy.h / 2 - 12,
    w: 24,
    h: 24,
    type: rollPowerupType(),
  })
}

function applyPowerup(type) {
  if (type === 'shield') {
    shieldTimer = Math.max(shieldTimer, 60 * 8)
    setStatusFlash('Picked up Shield', 100)
    return
  }
  if (type === 'double') {
    doubleShotTimer = Math.max(doubleShotTimer, 60 * 8)
    setStatusFlash('Picked up Double shot', 100)
    return
  }
  if (type === 'rapid') {
    rapidFireTimer = Math.max(rapidFireTimer, 60 * 8)
    setStatusFlash('Picked up Rapid fire', 100)
    return
  }
  lives = Math.min(5, lives + 1)
  setStatusFlash('Picked up Extra life', 100)
}

function shootPlayer() {
  const centerX = player.x + player.w / 2 - 2
  shots.push({ x: centerX, y: player.y - 16, w: 6, h: 16 })
  if (doubleShotTimer > 0) {
    shots.push({ x: centerX - 14, y: player.y - 12, w: 6, h: 16 })
    shots.push({ x: centerX + 14, y: player.y - 12, w: 6, h: 16 })
  }
}

function shootEnemy(enemy) {
  enemyShots.push({
    x: enemy.x + enemy.w / 2 - 2,
    y: enemy.y + enemy.h,
    w: 6,
    h: 16,
  })
}

function handleInput() {
  if (keys.has('arrowleft') || keys.has('a')) player.x -= PLAYER_SPEED
  if (keys.has('arrowright') || keys.has('d')) player.x += PLAYER_SPEED
  if (player.x < 0) player.x = 0
  if (player.x + player.w > WIDTH) player.x = WIDTH - player.w

  if ((keys.has(' ') || keys.has('space')) && shootCooldown <= 0) {
    shootPlayer()
    shootCooldown = rapidFireTimer > 0 ? RAPID_SHOOT_COOLDOWN : BASE_SHOOT_COOLDOWN
  }
}

function update() {
  if (gameOver || paused) return

  handleInput()
  if (shootCooldown > 0) shootCooldown -= 1
  if (waveCooldown > 0) waveCooldown -= 1
  if (shieldTimer > 0) shieldTimer -= 1
  if (doubleShotTimer > 0) doubleShotTimer -= 1
  if (rapidFireTimer > 0) rapidFireTimer -= 1
  if (statusFlashTimer > 0) statusFlashTimer -= 1

  if (currentPhase === 'cleared') {
    if (waveCooldown <= 0) {
      startWave()
    }
    syncHud()
    return
  }

  for (const shot of shots) shot.y -= LASER_SPEED
  for (const shot of enemyShots) shot.y += LASER_SPEED * 0.85
  for (const bomb of bossBombs) bomb.y += bomb.vy
  for (const powerup of powerups) powerup.y += 1.8
  for (const p of particles) {
    p.x += p.vx
    p.y += p.vy
    p.life -= 1
  }

  shots = shots.filter((s) => s.y + s.h > 0)
  enemyShots = enemyShots.filter((s) => s.y < HEIGHT)
  bossBombs = bossBombs.filter((b) => b.y < HEIGHT + 60)
  powerups = powerups.filter((p) => p.y < HEIGHT + 30)
  particles = particles.filter((p) => p.life > 0)
  if (bossBombs.length > 80) {
    bossBombs.splice(0, bossBombs.length - 80)
  }
  if (particles.length > 400) {
    particles.splice(0, particles.length - 400)
  }

  for (const enemy of enemies) {
    enemy.step += 1
    const swayOffset = Math.sin(enemy.step * enemy.swayFreq + enemy.swayPhase) * enemy.swayAmp
    enemy.x += enemy.speed * enemy.dir + swayOffset
    if (enemy.pattern === 'zigzag' && enemy.step % enemy.zigzagPeriod === 0) enemy.dir *= -1
    if (enemy.pattern === 'dive' && enemy.diveTimer <= 0 && enemy.y < HEIGHT * 0.58 && Math.random() < enemy.diveChance) {
      enemy.diveTimer = 22 + Math.floor(Math.random() * 18)
    }
    if (enemy.diveTimer > 0) {
      enemy.y += 1.45
      enemy.diveTimer -= 1
    } else {
      enemy.y += enemy.dropRate
    }
    if (enemy.x <= 0 || enemy.x + enemy.w >= WIDTH) enemy.dir *= -1
    if (Math.random() < ENEMY_SHOT_CHANCE + wave * 0.00075) shootEnemy(enemy)
    if (enemy.y + enemy.h >= player.y) {
      lives = 0
      gameOver = true
    }
  }

  if (boss) {
    bossTimer += 1
    if (!Number.isFinite(boss.hp) || !Number.isFinite(boss.maxHp) || boss.maxHp <= 0) {
      boss = null
      queueNextWave()
      syncHud()
      return
    }

    boss.x += boss.speed * boss.dir
    if (boss.x <= 0 || boss.x + boss.w >= WIDTH) boss.dir *= -1
    if (Math.random() < BOSS_BOMB_CHANCE + wave * 0.0035) {
      bossBombs.push({
        x: boss.x + boss.w * (0.2 + Math.random() * 0.6),
        y: boss.y + boss.h - 8,
        w: 18,
        h: 22,
        vy: 4.2 + Math.random() * 2.4,
      })
    }

    // Failsafe so a run cannot stay in boss mode indefinitely.
    if (bossTimer > 3600) {
      score += 500
      boss = null
      setStatusFlash('Boss retreated', 120)
      queueNextWave()
      syncHud()
      return
    }
  }

  for (let i = shots.length - 1; i >= 0; i -= 1) {
    const shot = shots[i]
    if (boss && rectHit(shot, boss)) {
      shots.splice(i, 1)
      boss.hp -= 1
      spawnParticles(shot.x, shot.y, '#f97316')
      if (boss.hp <= 0) {
        score += 1400 + wave * 120
        maybeDropPowerup({ x: boss.x, y: boss.y, w: boss.w, h: boss.h }, 0.5)
        spawnParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, '#facc15')
        boss = null
        queueNextWave()
      }
      continue
    }

    for (let j = enemies.length - 1; j >= 0; j -= 1) {
      if (!rectHit(shot, enemies[j])) continue
      const hitEnemy = enemies[j]
      shots.splice(i, 1)
      enemies.splice(j, 1)
      score += 100
      spawnParticles(hitEnemy.x + hitEnemy.w / 2, hitEnemy.y + hitEnemy.h / 2, '#fb7185')
      maybeDropPowerup(hitEnemy)
      break
    }
  }

  for (let i = enemyShots.length - 1; i >= 0; i -= 1) {
    if (!rectHit(enemyShots[i], player)) continue
    enemyShots.splice(i, 1)
    if (shieldTimer > 0) {
      spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#22d3ee')
      continue
    }
    lives -= 1
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#ef4444')
    if (lives <= 0) {
      gameOver = true
      break
    }
  }

  for (let i = bossBombs.length - 1; i >= 0; i -= 1) {
    if (!rectHit(bossBombs[i], player)) continue
    bossBombs.splice(i, 1)
    if (shieldTimer > 0) {
      spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#22d3ee')
      continue
    }
    lives -= 1
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#ef4444')
    if (lives <= 0) {
      gameOver = true
      break
    }
  }

  for (let i = powerups.length - 1; i >= 0; i -= 1) {
    if (!rectHit(powerups[i], player)) continue
    const picked = powerups[i]
    powerups.splice(i, 1)
    applyPowerup(picked.type)
  }

  if (score > bestScore) {
    bestScore = score
    try {
      localStorage.setItem('pyinvaders-best', String(bestScore))
    } catch {}
  }

  if (!boss && enemies.length === 0 && currentPhase === 'wave' && waveCooldown <= 0) {
    emptyFieldFrames += 1
    if (emptyFieldFrames > 15) queueNextWave()
  } else {
    emptyFieldFrames = 0
  }

  syncHud()
}

function drawLaser(shot, img, color = '#facc15') {
  if (!ctx) return
  ctx.save()
  ctx.shadowBlur = 14
  ctx.shadowColor = color
  if (isImageReady(img)) {
    ctx.drawImage(img, shot.x - 3, shot.y, 10, 18)
    ctx.globalAlpha = 0.7
    ctx.fillStyle = color
    ctx.fillRect(shot.x + 1, shot.y, 4, 16)
    ctx.restore()
    return
  }
  ctx.fillStyle = color
  ctx.fillRect(shot.x, shot.y, shot.w, shot.h)
  ctx.restore()
}

function drawBossBomb(bomb) {
  if (!ctx) return
  ctx.save()
  ctx.shadowBlur = 16
  ctx.shadowColor = '#fb923c'
  ctx.fillStyle = '#fb923c'
  ctx.beginPath()
  ctx.ellipse(bomb.x, bomb.y, 10, 14, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff7ed'
  ctx.fillRect(bomb.x - 2, bomb.y - 8, 4, 6)
  ctx.restore()
}

function drawPowerup(powerup) {
  if (!ctx) return
  const style = POWERUP_STYLES[powerup.type] || POWERUP_STYLES.double
  ctx.save()
  ctx.beginPath()
  ctx.arc(powerup.x + 12, powerup.y + 12, 10, 0, Math.PI * 2)
  ctx.fillStyle = style.color
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#e2e8f0'
  ctx.stroke()
  ctx.fillStyle = '#f8fafc'
  ctx.font = 'bold 9px Segoe UI'
  ctx.textAlign = 'center'
  ctx.fillText(style.label, powerup.x + 12, powerup.y + 15)
  ctx.restore()
}

function draw() {
  if (!ctx) return
  if (isImageReady(bg)) ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT)
  else {
    ctx.fillStyle = '#020617'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
  }

  if (isImageReady(yellowShip)) ctx.drawImage(yellowShip, player.x, player.y, player.w, player.h)
  else {
    ctx.fillStyle = '#f59e0b'
    ctx.fillRect(player.x, player.y, player.w, player.h)
  }

  if (shieldTimer > 0) {
    ctx.beginPath()
    ctx.arc(player.x + player.w / 2, player.y + player.h / 2, 34, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.8)'
    ctx.lineWidth = 3
    ctx.stroke()
  }

  for (const enemy of enemies) {
    if (isImageReady(enemy.img)) ctx.drawImage(enemy.img, enemy.x, enemy.y, enemy.w, enemy.h)
    else {
      ctx.fillStyle = '#22d3ee'
      ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h)
    }
  }

  if (boss) {
    if (isImageReady(boss.sprite)) {
      ctx.drawImage(boss.sprite, boss.x, boss.y, boss.w, boss.h)
    } else {
      ctx.fillStyle = '#7f1d1d'
      ctx.fillRect(boss.x, boss.y, boss.w, boss.h)
    }
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 3
    ctx.strokeRect(boss.x, boss.y, boss.w, boss.h)

    const barX = boss.x
    const barY = boss.y - 14
    const hpCurrent = Number.isFinite(boss.hp) ? Math.max(0, boss.hp) : 0
    const hpMax = Number.isFinite(boss.maxHp) && boss.maxHp > 0 ? boss.maxHp : 1
    const hpWidth = (hpCurrent / hpMax) * boss.w
    ctx.fillStyle = '#1f2937'
    ctx.fillRect(barX, barY, boss.w, 8)
    ctx.fillStyle = '#ef4444'
    ctx.fillRect(barX, barY, hpWidth, 8)
  }

  for (const shot of shots) drawLaser(shot, yellowLaser, '#fde047')
  for (const shot of enemyShots) drawLaser(shot, enemyLasers[0], '#fb7185')
  for (const bomb of bossBombs) drawBossBomb(bomb)
  for (const powerup of powerups) drawPowerup(powerup)

  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / 24)
    ctx.fillStyle = p.color
    ctx.fillRect(p.x, p.y, 3, 3)
    ctx.globalAlpha = 1
  }

  if (paused || gameOver) {
    ctx.fillStyle = 'rgba(8, 2, 18, 0.78)'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    ctx.fillStyle = '#f5e9ff'
    ctx.textAlign = 'center'
    ctx.font = '700 50px Segoe UI'
    ctx.fillText(gameOver ? 'GAME OVER' : 'PAUSED', WIDTH / 2, HEIGHT / 2 - 15)
    ctx.font = '600 24px Segoe UI'
    ctx.fillText(`Score: ${score}`, WIDTH / 2, HEIGHT / 2 + 26)
    ctx.font = '18px Segoe UI'
    ctx.fillStyle = '#d8b4fe'
    ctx.fillText(gameOver ? 'Press R to restart' : 'Press P to resume', WIDTH / 2, HEIGHT / 2 + 58)
  }
}

function togglePause() {
  if (gameOver) return
  paused = !paused
  refreshPauseButton()
  syncHud()
}

function tick() {
  try {
    update()
    draw()
  } catch (error) {
    console.error('Frame error recovered:', error)
    enemyShots = []
    bossBombs = []
    particles = []
    boss = null
    powerups = []
    currentPhase = 'cleared'
    waveCooldown = Math.max(waveCooldown, 45)
    if (statusEl) {
      statusEl.textContent = 'Recovered from frame fault'
    }
  }
  requestAnimationFrame(tick)
}

function fitCanvasToViewport() {
  if (!canvas) return
  const compact = window.innerWidth <= 900
  const sidePadding = compact ? 22 : 30
  let maxByHeight = Math.max(250, window.innerHeight - (compact ? 320 : 280))
  if (!compact && appEl && stageEl) {
    const appStyle = window.getComputedStyle(appEl)
    const stageStyle = window.getComputedStyle(stageEl)
    const gridGap = Number.parseFloat(appStyle.rowGap || appStyle.gap || '0') || 0
    const appPaddingTop = Number.parseFloat(appStyle.paddingTop || '0') || 0
    const appPaddingBottom = Number.parseFloat(appStyle.paddingBottom || '0') || 0
    const stageChrome =
      (Number.parseFloat(stageStyle.paddingTop || '0') || 0) +
      (Number.parseFloat(stageStyle.paddingBottom || '0') || 0) +
      (Number.parseFloat(stageStyle.borderTopWidth || '0') || 0) +
      (Number.parseFloat(stageStyle.borderBottomWidth || '0') || 0)
    const chromeBlocks = [headerEl, hudEl, controlsEl, footerEl]
      .filter(Boolean)
      .reduce((sum, el) => sum + el.getBoundingClientRect().height, 0)
    const totalChromeHeight = appPaddingTop + appPaddingBottom + chromeBlocks + gridGap * 4 + stageChrome + 6
    maxByHeight = Math.max(240, window.innerHeight - totalChromeHeight)
  }
  const maxByWidth = Math.max(320, window.innerWidth - sidePadding)
  const aspect = WIDTH / HEIGHT
  const byWidthHeight = maxByWidth / aspect
  const renderHeight = Math.min(maxByHeight, byWidthHeight)
  const renderWidth = renderHeight * aspect
  canvas.style.width = `${Math.floor(renderWidth)}px`
  canvas.style.height = `${Math.floor(renderHeight)}px`
}

if (pauseBtn) {
  pauseBtn.addEventListener('click', togglePause)
}
if (audioBtn) {
  audioBtn.addEventListener('click', () => setAudioEnabled(!audioEnabled))
}

document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase()
  keys.add(key)
  if (key === 'r' && gameOver) resetGame()
  if (key === 'p') togglePause()
  if (key === 'm') setAudioEnabled(!audioEnabled)
  if (key === ' ') event.preventDefault()
})

document.addEventListener('keyup', (event) => {
  keys.delete(event.key.toLowerCase())
})

if (!canvas || !ctx) {
  throw new Error('Game canvas not available in DOM.')
}

fitCanvasToViewport()
window.addEventListener('resize', fitCanvasToViewport)
window.addEventListener('load', fitCanvasToViewport)
if (document.fonts && typeof document.fonts.ready?.then === 'function') {
  document.fonts.ready.then(fitCanvasToViewport).catch(() => {})
}

resetGame()
tick()
