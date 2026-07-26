const WIDTH = 1280
const HEIGHT = 720
const PLAYER_SPEED = 6
const LASER_SPEED = 8
const ENEMY_MIN_SPEED = 1.2
const ENEMY_MAX_SPEED = 2.8
const ENEMY_SHOT_CHANCE = 0.005
const POWERUP_DROP_CHANCE = 0.12
const BOSS_BOMB_CHANCE = 0.045

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
let boss

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
  boss = null
  spawnWave()
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
  else if (shieldTimer > 0 && doubleShotTimer > 0) statusEl.textContent = 'Shield + Double shot'
  else if (shieldTimer > 0) statusEl.textContent = 'Shield active'
  else if (doubleShotTimer > 0) statusEl.textContent = 'Double shot active'
  else if (boss) statusEl.textContent = `Boss fight (${boss.hp})`
  else statusEl.textContent = 'Running'
}

function refreshPauseButton() {
  if (pauseBtn) {
    pauseBtn.textContent = paused ? 'Resume' : 'Pause'
  }
}

function refreshAudioButton() {
  if (audioBtn) {
    audioBtn.textContent = `Music: ${audioEnabled ? 'On' : 'Off'}`
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

function spawnWave() {
  const rows = Math.min(5, 2 + Math.floor(wave / 2))
  const cols = 10
  const xGap = 112
  const yGap = 60
  const formationWidth = (cols - 1) * xGap + 40
  const startX = Math.max(24, Math.floor((WIDTH - formationWidth) / 2))
  const startY = 60

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      enemies.push({
        x: startX + c * xGap,
        y: startY + r * yGap,
        w: 40,
        h: 30,
        speed: ENEMY_MIN_SPEED + Math.random() * (ENEMY_MAX_SPEED - ENEMY_MIN_SPEED),
        dir: Math.random() > 0.5 ? 1 : -1,
        img: enemyShips[(r + c) % enemyShips.length],
      })
    }
  }

  function spawnBoss() {
    boss = {
      x: WIDTH / 2 - 130,
      y: 38,
      w: 260,
      h: 88,
      hp: 32 + wave * 6,
      maxHp: 32 + wave * 6,
      speed: 2.2 + wave * 0.18,
      dir: Math.random() > 0.5 ? 1 : -1,
      sprite: enemyShips[wave % enemyShips.length],
    }
  }
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

function maybeDropPowerup(enemy) {
  if (Math.random() > POWERUP_DROP_CHANCE) return
  powerups.push({
    x: enemy.x + enemy.w / 2 - 12,
    y: enemy.y + enemy.h / 2 - 12,
    w: 24,
    h: 24,
    type: Math.random() > 0.5 ? 'shield' : 'double',
  })
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
    shootCooldown = doubleShotTimer > 0 ? 9 : 12
  }
}

function update() {
  if (gameOver || paused) return

  handleInput()
  if (shootCooldown > 0) shootCooldown -= 1
  if (waveCooldown > 0) waveCooldown -= 1
  if (shieldTimer > 0) shieldTimer -= 1
  if (doubleShotTimer > 0) doubleShotTimer -= 1

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

  for (const enemy of enemies) {
    enemy.x += enemy.speed * enemy.dir
    if (enemy.x <= 0 || enemy.x + enemy.w >= WIDTH) enemy.dir *= -1
    enemy.y += 0.03 + wave * 0.004
    if (Math.random() < ENEMY_SHOT_CHANCE + wave * 0.0009) shootEnemy(enemy)
    if (enemy.y + enemy.h >= player.y) {
      lives = 0
      gameOver = true
    }

    if (boss) {
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
        spawnParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, '#facc15')
        boss = null
        wave += 1
        waveCooldown = 45
        spawnWave()
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
    lives -= 1
    if (lives <= 0) {
      gameOver = true
      break
    }
  }

  for (let i = powerups.length - 1; i >= 0; i -= 1) {
    if (!rectHit(powerups[i], player)) continue
    const picked = powerups[i]
    powerups.splice(i, 1)
    if (picked.type === 'shield') shieldTimer = 60 * 8
    else doubleShotTimer = 60 * 8
  }

  if (score > bestScore) {
    bestScore = score
    try {
      localStorage.setItem('pyinvaders-best', String(bestScore))
    } catch {}
  }

  if (enemies.length === 0 && !boss && waveCooldown <= 0) {
    spawnBoss()
    waveCooldown = 60
  }

  syncHud()
}

function drawLaser(shot, img, color = '#facc15') {
  if (!ctx) return
  ctx.save()
  ctx.shadowBlur = 14
  ctx.shadowColor = color
  if (img.complete) {
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
  ctx.save()
  ctx.beginPath()
  ctx.arc(powerup.x + 12, powerup.y + 12, 10, 0, Math.PI * 2)
  ctx.fillStyle = powerup.type === 'shield' ? '#06b6d4' : '#a78bfa'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#e2e8f0'
  ctx.stroke()
  ctx.fillStyle = '#f8fafc'
  ctx.font = 'bold 10px Segoe UI'
  ctx.textAlign = 'center'
  ctx.fillText(powerup.type === 'shield' ? 'S' : '2X', powerup.x + 12, powerup.y + 15)
  ctx.restore()
}

function draw() {
  if (!ctx) return
  if (bg.complete) ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT)
  else {
    ctx.fillStyle = '#020617'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
  }

  if (yellowShip.complete) ctx.drawImage(yellowShip, player.x, player.y, player.w, player.h)
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
    if (enemy.img.complete) ctx.drawImage(enemy.img, enemy.x, enemy.y, enemy.w, enemy.h)
    else {
      ctx.fillStyle = '#22d3ee'
      ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h)
    }

    if (boss) {
      if (boss.sprite.complete) {
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
      const hpWidth = (boss.hp / boss.maxHp) * boss.w
      ctx.fillStyle = '#1f2937'
      ctx.fillRect(barX, barY, boss.w, 8)
      ctx.fillStyle = '#ef4444'
      ctx.fillRect(barX, barY, hpWidth, 8)
    }
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
    ctx.fillStyle = 'rgba(2, 6, 23, 0.76)'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    ctx.fillStyle = '#f8fafc'
    ctx.textAlign = 'center'
    ctx.font = 'bold 46px Segoe UI'
    ctx.fillText(gameOver ? 'GAME OVER' : 'PAUSED', WIDTH / 2, HEIGHT / 2 - 15)
    ctx.font = '24px Segoe UI'
    ctx.fillText(`Score: ${score}`, WIDTH / 2, HEIGHT / 2 + 26)
    ctx.font = '18px Segoe UI'
    ctx.fillStyle = '#cbd5e1'
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
  update()
  draw()
  requestAnimationFrame(tick)
}

function fitCanvasToViewport() {
  if (!canvas) return
  const reserved = 210
  const maxByHeight = Math.max(320, window.innerHeight - reserved)
  const maxByWidth = Math.max(480, window.innerWidth - 24)
  const aspect = WIDTH / HEIGHT
  const byWidthHeight = maxByWidth / aspect
  const renderHeight = Math.min(maxByHeight, byWidthHeight)
  const renderWidth = renderHeight * aspect
  canvas.style.width = `${Math.floor(renderWidth)}px`
  canvas.style.height = `${Math.floor(renderHeight)}px`
  if (appEl) {
    appEl.style.gridTemplateRows = 'auto auto auto 1fr auto'
  }
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

resetGame()
tick()
