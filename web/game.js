const WIDTH = 750
const HEIGHT = 750
const PLAYER_SPEED = 6
const LASER_SPEED = 8
const ENEMY_MIN_SPEED = 1.2
const ENEMY_MAX_SPEED = 2.8
const ENEMY_SHOT_CHANCE = 0.005

const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d')
const scoreEl = document.getElementById('score')
const livesEl = document.getElementById('lives')
const waveEl = document.getElementById('wave')

const keys = new Set()

const bg = new Image()
bg.src = '../assets/background-black.png'

const yellowShip = new Image()
yellowShip.src = '../assets/pixel_ship_yellow.png'

const enemyShips = [
  '../assets/pixel_ship_red_small.png',
  '../assets/pixel_ship_green_small.png',
  '../assets/pixel_ship_blue_small.png',
].map((src) => {
  const img = new Image()
  img.src = src
  return img
})

const yellowLaser = new Image()
yellowLaser.src = '../assets/pixel_laser_yellow.png'

const enemyLasers = [
  '../assets/pixel_laser_red.png',
  '../assets/pixel_laser_green.png',
  '../assets/pixel_laser_blue.png',
].map((src) => {
  const img = new Image()
  img.src = src
  return img
})

let player
let enemies
let shots
let enemyShots
let score
let lives
let wave
let gameOver
let shootCooldown
let waveCooldown

function resetGame() {
  player = { x: WIDTH / 2 - 25, y: HEIGHT - 90, w: 50, h: 38 }
  enemies = []
  shots = []
  enemyShots = []
  score = 0
  lives = 3
  wave = 1
  gameOver = false
  shootCooldown = 0
  waveCooldown = 0
  spawnWave()
  syncHud()
}

function syncHud() {
  scoreEl.textContent = String(score)
  livesEl.textContent = String(lives)
  waveEl.textContent = String(wave)
}

function spawnWave() {
  const rows = Math.min(5, 2 + Math.floor(wave / 2))
  const cols = 8
  const xGap = 74
  const yGap = 64
  const startX = 70
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
        laserImg: enemyLasers[(r + c) % enemyLasers.length],
      })
    }
  }
}

function rectHit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function shootPlayer() {
  shots.push({
    x: player.x + player.w / 2 - 2,
    y: player.y - 12,
    w: 4,
    h: 12,
  })
}

function shootEnemy(enemy) {
  enemyShots.push({
    x: enemy.x + enemy.w / 2 - 2,
    y: enemy.y + enemy.h,
    w: 4,
    h: 12,
  })
}

function handleInput() {
  if (keys.has('arrowleft') || keys.has('a')) player.x -= PLAYER_SPEED
  if (keys.has('arrowright') || keys.has('d')) player.x += PLAYER_SPEED

  if (player.x < 0) player.x = 0
  if (player.x + player.w > WIDTH) player.x = WIDTH - player.w

  if ((keys.has(' ') || keys.has('space')) && shootCooldown <= 0) {
    shootPlayer()
    shootCooldown = 12
  }
}

function update() {
  if (gameOver) return

  handleInput()
  if (shootCooldown > 0) shootCooldown -= 1
  if (waveCooldown > 0) waveCooldown -= 1

  for (const shot of shots) shot.y -= LASER_SPEED
  for (const shot of enemyShots) shot.y += LASER_SPEED * 0.85

  shots = shots.filter((s) => s.y + s.h > 0)
  enemyShots = enemyShots.filter((s) => s.y < HEIGHT)

  for (const enemy of enemies) {
    enemy.x += enemy.speed * enemy.dir
    if (enemy.x <= 0 || enemy.x + enemy.w >= WIDTH) enemy.dir *= -1
    enemy.y += 0.03 + wave * 0.004

    if (Math.random() < ENEMY_SHOT_CHANCE + wave * 0.0009) shootEnemy(enemy)
    if (enemy.y + enemy.h >= player.y) {
      lives = 0
      gameOver = true
    }
  }

  for (let i = shots.length - 1; i >= 0; i -= 1) {
    const shot = shots[i]
    let hit = false
    for (let j = enemies.length - 1; j >= 0; j -= 1) {
      if (rectHit(shot, enemies[j])) {
        shots.splice(i, 1)
        enemies.splice(j, 1)
        score += 100
        hit = true
        break
      }
    }
    if (hit) continue
  }

  for (let i = enemyShots.length - 1; i >= 0; i -= 1) {
    if (rectHit(enemyShots[i], player)) {
      enemyShots.splice(i, 1)
      lives -= 1
      if (lives <= 0) {
        gameOver = true
        break
      }
    }
  }

  if (enemies.length === 0 && waveCooldown <= 0) {
    wave += 1
    waveCooldown = 60
    spawnWave()
  }

  syncHud()
}

function drawLaser(shot, img) {
  if (img.complete) {
    ctx.drawImage(img, shot.x - 3, shot.y, 10, 18)
    return
  }
  ctx.fillStyle = '#facc15'
  ctx.fillRect(shot.x, shot.y, shot.w, shot.h)
}

function draw() {
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

  for (const enemy of enemies) {
    if (enemy.img.complete) ctx.drawImage(enemy.img, enemy.x, enemy.y, enemy.w, enemy.h)
    else {
      ctx.fillStyle = '#22d3ee'
      ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h)
    }
  }

  for (const shot of shots) drawLaser(shot, yellowLaser)
  for (const shot of enemyShots) drawLaser(shot, enemyLasers[0])

  if (gameOver) {
    ctx.fillStyle = 'rgba(2, 6, 23, 0.76)'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    ctx.fillStyle = '#f8fafc'
    ctx.textAlign = 'center'
    ctx.font = 'bold 46px Segoe UI'
    ctx.fillText('GAME OVER', WIDTH / 2, HEIGHT / 2 - 15)
    ctx.font = '24px Segoe UI'
    ctx.fillText(`Score: ${score}`, WIDTH / 2, HEIGHT / 2 + 26)
    ctx.font = '18px Segoe UI'
    ctx.fillStyle = '#cbd5e1'
    ctx.fillText('Press R to restart', WIDTH / 2, HEIGHT / 2 + 58)
  }
}

function tick() {
  update()
  draw()
  requestAnimationFrame(tick)
}

document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase()
  keys.add(key)
  if (key === 'r' && gameOver) resetGame()
  if (key === ' ') event.preventDefault()
})

document.addEventListener('keyup', (event) => {
  keys.delete(event.key.toLowerCase())
})

resetGame()
tick()
