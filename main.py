import pygame
import os
import random

# Initialize pygame
pygame.font.init()

# Set up window dimensions
WIDTH, HEIGHT = 750, 750
WIN = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Py Shooter")

# Load images
RED_SPACE_SHIP = pygame.image.load(os.path.join("assets", "pixel_ship_red_small.png"))
GREEN_SPACE_SHIP = pygame.image.load(os.path.join("assets", "pixel_ship_green_small.png"))
BLUE_SPACE_SHIP = pygame.image.load(os.path.join("assets", "pixel_ship_blue_small.png"))
YELLOW_SPACE_SHIP = pygame.image.load(os.path.join("assets", "pixel_ship_yellow.png"))

# Load lasers
RED_LASER = pygame.image.load(os.path.join("assets", "pixel_laser_red.png"))
GREEN_LASER = pygame.image.load(os.path.join("assets", "pixel_laser_green.png"))
BLUE_LASER = pygame.image.load(os.path.join("assets", "pixel_laser_blue.png"))
YELLOW_LASER = pygame.image.load(os.path.join("assets", "pixel_laser_yellow.png"))

# Load background and scale it to fit window
BG = pygame.transform.scale(pygame.image.load(os.path.join("assets", "background-black.png")), (WIDTH, HEIGHT))

# Ship class
class Ship:
    def __init__(self, x, y, health=100):
        self.x = x
        self.y = y
        self.health = health
        self.ship_img = None
        self.laser_img = None
        self.lasers = []
        self.cool_down_counter = 0

    def draw(self, window):
        window.blit(self.ship_img, (self.x, self.y))

    def move_lasers(self, velocity, objs):
        self.cooldown()
        for laser in self.lasers:
            laser.move(velocity)
            if laser.off_screen(HEIGHT):
                self.lasers.remove(laser)
            else:
                laser.draw(window)

        # Handle laser collisions with enemies
        for laser in self.lasers:
            for obj in objs:
                if laser.collide(obj):
                    objs.remove(obj)
                    self.lasers.remove(laser)
                    break

    def cooldown(self):
        if self.cool_down_counter >= 5:
            self.cool_down_counter = 0
        elif self.cool_down_counter > 0:
            self.cool_down_counter += 1

    def shoot(self):
        if self.cool_down_counter == 0:
            laser = Laser(self.x + self.ship_img.get_width() // 2 - 2, self.y, self.laser_img)
            self.lasers.append(laser)
            self.cool_down_counter = 1

# Player class
class Player(Ship):
    def __init__(self, x, y, health=100):
        super().__init__(x, y, health)
        self.ship_img = RED_SPACE_SHIP
        self.laser_img = RED_LASER
        self.mask = pygame.mask.from_surface(self.ship_img)
        self.max_health = health

    def move(self, keys, player_vel):
        if keys[pygame.K_UP] and self.y - player_vel > 0:
            self.y -= player_vel
        if keys[pygame.K_DOWN] and self.y + player_vel + self.ship_img.get_height() < HEIGHT:
            self.y += player_vel
        if keys[pygame.K_LEFT] and self.x - player_vel > 0:
            self.x -= player_vel
        if keys[pygame.K_RIGHT] and self.x + player_vel + self.ship_img.get_width() < WIDTH:
            self.x += player_vel

# Enemy class
class Enemy(Ship):
    def __init__(self, x, y, health=100):
        super().__init__(x, y, health)
        self.ship_img = GREEN_SPACE_SHIP
        self.laser_img = GREEN_LASER
        self.mask = pygame.mask.from_surface(self.ship_img)

    def move(self, velocity):
        self.y += velocity

    def shoot(self):
        if random.random() < 0.01:  # Small chance to shoot
            laser = Laser(self.x + self.ship_img.get_width() // 2 - 2, self.y, self.laser_img)
            self.lasers.append(laser)

# Laser class
class Laser:
    def __init__(self, x, y, laser_img):
        self.x = x
        self.y = y
        self.laser_img = laser_img
        self.rect = self.laser_img.get_rect(center=(self.x, self.y))

    def move(self, velocity):
        self.y -= velocity
        self.rect.y = self.y

    def draw(self, window):
        window.blit(self.laser_img, (self.x, self.y))

    def off_screen(self, height):
        return not self.rect.colliderect(pygame.Rect(0, 0, WIDTH, height))

    def collide(self, obj):
        return self.rect.colliderect(obj.rect)

# Draw the window
def DrawWindow(player, enemies, level, lives, mainFont):
    WIN.blit(BG, (0, 0))  # Draw the background

    # Draw player and enemies
    player.draw(WIN)
    for enemy in enemies:
        enemy.draw(WIN)

    # Draw lasers
    player.move_lasers(-7, enemies)  # Player's lasers go up
    for enemy in enemies:
        enemy.move_lasers(3, [])  # Enemy's lasers go down

    # Draw text (level and lives)
    level_label = mainFont.render(f"Level: {level}", 1, (255, 255, 255))
    lives_label = mainFont.render(f"Lives: {lives}", 1, (255, 0, 0))
    WIN.blit(level_label, (10, 10))
    WIN.blit(lives_label, (WIDTH - lives_label.get_width() - 10, 10))

    pygame.display.update()

# Main function
def main():
    run = True
    FPS = 60
    level = 1
    lives = 5
    player_vel = 5
    enemy_vel = 1
    laser_vel = 5
    score = 0
    mainFont = pygame.font.SysFont("arial", 20)

    # Create player
    player = Player(WIDTH // 2, HEIGHT - 100)

    # Create enemies
    enemies = []
    for i in range(5):
        enemy = Enemy(random.randint(50, WIDTH - 50), random.randint(-150, -50))
        enemies.append(enemy)

    clock = pygame.time.Clock()

    while run:
        clock.tick(FPS)

        # Check for game events
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                run = False

        # Player movement
        keys = pygame.key.get_pressed()
        player.move(keys, player_vel)

        # Enemy movement and shooting
        for enemy in enemies:
            enemy.move(enemy_vel)
            enemy.shoot()

            if enemy.y + enemy.ship_img.get_height() > HEIGHT:
                enemy.y = random.randint(-100, -50)
                enemy.x = random.randint(50, WIDTH - 50)

        # Collision detection
        for enemy in enemies:
            if pygame.sprite.collide_mask(player, enemy):
                lives -= 1
                enemies.remove(enemy)
                if lives == 0:
                    print("Game Over!")
                    run = False

        # Draw the window
        DrawWindow(player, enemies, level, lives, mainFont)

    pygame.quit()

if __name__ == "__main__":
    main()
