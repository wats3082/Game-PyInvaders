import pygame
import os
import random
import time

# Initialize pygame and font
pygame.font.init()

# Set up window dimensions
WIDTH, HEIGHT = 750, 750
WIN = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Py Shooter")

# Load images for ships and lasers
RED_SPACE_SHIP = pygame.image.load(os.path.join("assets", "pixel_ship_red_small.png"))
GREEN_SPACE_SHIP = pygame.image.load(os.path.join("assets", "pixel_ship_green_small.png"))
BLUE_SPACE_SHIP = pygame.image.load(os.path.join("assets", "pixel_ship_blue_small.png"))
YELLOW_SPACE_SHIP = pygame.image.load(os.path.join("assets", "pixel_ship_yellow.png"))

# Load lasers
RED_LASER = pygame.image.load(os.path.join("assets", "pixel_laser_red.png"))
GREEN_LASER = pygame.image.load(os.path.join("assets", "pixel_laser_green.png"))
BLUE_LASER = pygame.image.load(os.path.join("assets", "pixel_laser_blue.png"))
YELLOW_LASER = pygame.image.load(os.path.join("assets", "pixel_laser_yellow.png"))

# Load power-ups
SHIELD_POWERUP = pygame.image.load(os.path.join("assets", "shield_powerup.png"))
DOUBLE_SHOT_POWERUP = pygame.image.load(os.path.join("assets", "double_shot_powerup.png"))

# Load background and scale it to fit window
BG = pygame.transform.scale(pygame.image.load(os.path.join("assets", "background-black.png")), (WIDTH, HEIGHT))

# Load sounds
pygame.mixer.init()
SHOOT_SOUND = pygame.mixer.Sound(os.path.join("assets", "shoot.wav"))
EXPLOSION_SOUND = pygame.mixer.Sound(os.path.join("assets", "explosion.wav"))
GAME_OVER_SOUND = pygame.mixer.Sound(os.path.join("assets", "game_over.wav"))




def scroll_background():
    global BG_Y
    BG_Y += 1  # Adjust scrolling speed as needed
    if BG_Y > HEIGHT:
        BG_Y = 0
    WIN.blit(BG, (0, BG_Y - HEIGHT))  # Draw the first background
    WIN.blit(BG, (0, BG_Y))  # Draw the second background

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
        self.mask = None
        self.rect = None  # Adding rect to be used for collisions

    def draw(self, window):
        window.blit(self.ship_img, (self.x, self.y))

    def move_lasers(self, velocity, objs, window):  # Add window as parameter
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
            SHOOT_SOUND.play()


# Player class
class Player(Ship):
    def __init__(self, x, y, health=100):
        super().__init__(x, y, health)
        self.ship_img = RED_SPACE_SHIP
        self.laser_img = RED_LASER
        self.mask = pygame.mask.from_surface(self.ship_img)
        self.max_health = health
        self.shield = False  # Whether the player has a shield
        self.double_shot = False  # Whether the player has a double shot power-up
        self.rect = self.ship_img.get_rect(center=(self.x, self.y))  # Adding rect for the player
        self.kills = 0  # Track the number of kills
        self.hits = 0  # Track the number of times the player has been hit

    def move(self, keys, player_vel):
        if keys[pygame.K_UP] and self.y - player_vel > 0:
            self.y -= player_vel
        if keys[pygame.K_DOWN] and self.y + player_vel + self.ship_img.get_height() < HEIGHT:
            self.y += player_vel
        if keys[pygame.K_LEFT] and self.x - player_vel > 0:
            self.x -= player_vel
        if keys[pygame.K_RIGHT] and self.x + player_vel + self.ship_img.get_width() < WIDTH:
            self.x += player_vel

        self.rect.topleft = (self.x, self.y)  # Update rect with new position

    def shoot(self):
        if self.cool_down_counter == 0:
            if self.double_shot:  # If double shot is active, fire two lasers
                laser1 = Laser(self.x + self.ship_img.get_width() // 2 - 20, self.y, self.laser_img)
                laser2 = Laser(self.x + self.ship_img.get_width() // 2 + 10, self.y, self.laser_img)
                self.lasers.append(laser1)
                self.lasers.append(laser2)
            else:
                super().shoot()
            self.cool_down_counter = 1
            SHOOT_SOUND.play()

    def increment_kills(self):
        self.kills += 1
        if self.kills % 2 == 0:  # Spawn power-up every 2 kills
            self.spawn_powerup()

    def spawn_powerup(self):
        power_type = random.choice(["shield", "double_shot"])
        powerup = PowerUp(self.x, self.y, power_type)
        return powerup

    def take_damage(self):
        self.hits += 1
        if self.hits >= 3:
            return True  # Game Over condition
        return False

    def check_collision_with_lasers(self, enemy_lasers):
        for laser in enemy_lasers:
            if laser.collide(self):  # If laser collides with player
                if self.shield:  # If player has a shield, ignore the damage
                    continue
                if self.take_damage():  # If hit 3 times, game over
                    return True
                enemy_lasers.remove(laser)  # Remove laser after collision
        return False

# Enemy class
class Enemy(Ship):
    def __init__(self, x, y, health=100):
        super().__init__(x, y, health)
        self.ship_img = GREEN_SPACE_SHIP
        self.laser_img = GREEN_LASER
        self.mask = pygame.mask.from_surface(self.ship_img)
        self.rect = self.ship_img.get_rect(center=(self.x, self.y))  # Add the rect for collision detection
        self.velocity = random.randint(1, 3)  # Randomize enemy velocity

    def move(self, velocity):
        direction = random.choice([-1, 1])  # Randomly move left or right
        self.x += direction * random.randint(0, 2)  # Move randomly
        self.y += velocity
        self.rect.x = self.x
        self.rect.y = self.y  # Update rect when moving

    def shoot(self):
        if random.random() < 0.01:  # Small chance to shoot
            laser = Laser(self.x + self.ship_img.get_width() // 2 - 2, self.y, self.laser_img)
            self.lasers.append(laser)

    def collide(self, obj):
        return self.rect.colliderect(obj.rect)  # Use the rect attribute for collision


# Power-up class
class PowerUp:
    def __init__(self, x, y, power_type):
        self.x = x
        self.y = y
        self.power_type = power_type
        self.width = 30
        self.height = 30
        if power_type == "shield":
            self.img = SHIELD_POWERUP
        elif power_type == "double_shot":
            self.img = DOUBLE_SHOT_POWERUP
        self.rect = self.img.get_rect(center=(self.x, self.y))  # Add rect for power-up

    def move(self, velocity):
        self.y += velocity
        self.rect.y = self.y  # Update rect when moving

    def draw(self, window):
        window.blit(self.img, (self.x, self.y))

    def off_screen(self, height):
        return self.y > height

    def collide(self, obj):
        return self.rect.colliderect(obj.rect)  # Collision detection with the player's rect


# Laser class
class Laser:
    def __init__(self, x, y, laser_img):
        self.x = x
        self.y = y
        self.laser_img = laser_img
        self.rect = self.laser_img.get_rect(center=(self.x, self.y))  # Create rect for laser

    def move(self, velocity):
        self.y -= velocity
        self.rect.y = self.y  # Update rect when moving

    def draw(self, window):
        window.blit(self.laser_img, (self.x, self.y))

    def off_screen(self, height):
        return not self.rect.colliderect(pygame.Rect(0, 0, WIDTH, height))

    def collide(self, obj):
        return self.rect.colliderect(obj.rect)  # Check for collision with the object's rect


# Draw the window
def DrawWindow(player, enemies, level, lives, hits, powerups, mainFont, score):
   
    
    # WIN.blit(BG, (0, 0))  # Draw the background

    # Draw player and enemies
    player.draw(WIN)
    for enemy in enemies:
        enemy.draw(WIN)

    # Draw power-ups
    for powerup in powerups:
        powerup.draw(WIN)

    # Draw lasers
    player.move_lasers(7, enemies, WIN)  # Player's lasers go up
    for enemy in enemies:
        enemy.move_lasers(-3, [], WIN)  # Enemy's lasers go down

    # Draw text (level, lives, hits, and score)
    level_label = mainFont.render(f"Level: {level}", 1, (255, 255, 255))
    lives_label = mainFont.render(f"Lives: {lives}", 1, (255, 0, 0))
    hits_label = mainFont.render(f"Hits: {hits}", 1, (255, 255, 0))  # Display hit counter
    score_label = mainFont.render(f"Score: {score}", 1, (255, 255, 255))

    WIN.blit(level_label, (10, 10))
    WIN.blit(lives_label, (WIDTH - lives_label.get_width() - 10, 10))
    WIN.blit(hits_label, (WIDTH - hits_label.get_width() - 10, 40))  # Display hits next to lives
    WIN.blit(score_label, (WIDTH // 2 - score_label.get_width() // 2, 10))

    pygame.display.update()


# Game Over screen
def game_over_screen():
    game_over_font = pygame.font.SysFont("arial", 50)
    game_over_label = game_over_font.render("GAME OVER", 1, (255, 0, 0))
    WIN.blit(game_over_label, (WIDTH // 2 - game_over_label.get_width() // 2, HEIGHT // 2 - 50))
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
    hits = 0  # Track player hits
    mainFont = pygame.font.SysFont("arial", 20)

    # Create player
    player = Player(WIDTH // 2, HEIGHT - 100)

    # Create enemies
    def create_enemies(level):
        enemies = []
        num_enemies = 5 + level * 2  # Increase the number of enemies with each level
        for i in range(num_enemies):
            enemy = Enemy(random.randint(50, WIDTH - 50), random.randint(-150, -50))
            enemies.append(enemy)
        return enemies

    enemies = create_enemies(level)

    # Power-ups
    powerups = []

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

        # Player shooting
        if keys[pygame.K_SPACE]:
            player.shoot()

        # Move power-ups
        for powerup in powerups:
            powerup.move(5)
            if powerup.off_screen(HEIGHT):
                powerups.remove(powerup)
            if powerup.collide(player):
                if powerup.power_type == "shield":
                    player.shield = True
                elif powerup.power_type == "double_shot":
                    player.double_shot = True
                powerups.remove(powerup)

        # Check for collision with enemies
        for enemy in enemies:
            enemy.move(enemy_vel)
            if enemy.y > HEIGHT:
                enemy.y = random.randint(-150, -50)
                enemy.x = random.randint(50, WIDTH - 50)
            enemy.shoot()

            # Check for collisions with player lasers
            player.move_lasers(7, enemies, WIN)
            if enemy.collide(player):
                if player.take_damage():
                    run = False  # Game over if hit 3 times
                enemies.remove(enemy)
                EXPLOSION_SOUND.play()

            # Check if player was hit by enemy lasers
            if player.check_collision_with_lasers(enemy.lasers):
                if player.take_damage():
                    run = False  # Game over if hit 3 times
                enemy.lasers.clear()  # Remove all enemy lasers after collision

        # Check if all enemies are defeated
        if len(enemies) == 0:
            level += 1
            enemies = create_enemies(level)  # Create new set of enemies for the next level
mainloop()
        # Draw everything
        DrawWindow(player, enemies, level, lives, hits, powerups, mainFont, score)

    # Game over logic
    GAME_OVER_SOUND.play()
    game_over_screen()
    time.sleep(2)
    pygame.quit()


if __name__ == "__main__":
    main()
