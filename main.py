import pygame
import os
import random
import time

# THIS WILL IMPORT FONT
pygame.font.init()
WIDTH, HEIGHT = 750, 750
WIN = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption(("Py Shooter"))

# LOAD IMAGES
RED_SPACE_SHIP = pygame.image.load(os.path.join("assets", "pixel_ship_red_small.png"))
GREEN_SPACE_SHIP = pygame.image.load(os.path.join("assets", "pixel_ship_green_small.png"))
BLUE_SPACE_SHIP = pygame.image.load(os.path.join("assets", "pixel_ship_blue_small.png"))
YELLOW_SPACE_SHIP = pygame.image.load(os.path.join("assets", "pixel_ship_yellow.png"))
# LOAD LASERS AND BOMBS
RED_LASER = pygame.image.load(os.path.join("assets", "pixel_laser_red.png"))
GREEN_LASER = pygame.image.load(os.path.join("assets", "pixel_laser_green.png"))
BLUE_LASER = pygame.image.load(os.path.join("assets", "pixel_laser_blue.png"))
YELLOW_LASER = pygame.image.load(os.path.join("assets", "pixel_laser_yellow.png"))
# LOAD BACKGROUND AND SCALE IT TO FIT WINDOW
BG = pygame.transform.scale(pygame.image.load(os.path.join("assets", "background-black.png")), (WIDTH, HEIGHT))

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
        #pygame.draw.rect(window, (255,0,0), (self.x, self.y, 50,50), 15) #DRAW A TEST RECTANGLE
        window.blit(self.ship_img, (self.x, self.y))

class Player(Ship):
    def __init__(self, x, y, health=100):
        super().__init__(x, y, health)
        self.ship_img = RED_SPACE_SHIP
        self.laser_img = RED_LASER
        self.mask = pygame.mask.from_surface(self.ship_img) #this will check for collisions
        self.max_health = health

def main():
    run = True
    FPS = 40
    level = 1
    lives = 5
    player_vel = 5
    mainFont = pygame.font.SysFont("arial", 20)

    player = Player(300,500)
    clock = pygame.time.Clock()

    def DrawWindow():
        # FIRST REDRAW WINDOW WITH BACKGROUND IMAGE TO ERASE
        WIN.blit(BG, (0,0))
        #DRAW TEXT AND SCORE
        livesLabel = mainFont.render(f"Level: {lives}", 1, (255,0,255))
        levelLabel = mainFont.render(f"Lives: {level}", 1, (255,255,255))
        WIN.blit(livesLabel, (10, 10))
        WIN.blit(levelLabel, (WIDTH - levelLabel.get_width() - 10, 10))
        player.draw(WIN)


        pygame.display.update()

    while run:
        clock.tick(FPS)
        DrawWindow()

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                run = False

        keys = pygame.key.get_pressed()
        # IF KEY IS PRESSED, MOVE SHIP.Y or X COORDINATE +1
        # THE AND PARAMETERS KEEP THE SHIP ON THE SCREEN
        if keys[pygame.K_UP] and player.y + player_vel - 10 > 0:
            player.y -= player_vel
        if keys[pygame.K_DOWN] and player.y + player_vel + 50 < HEIGHT:
            player.y += player_vel
        if keys[pygame.K_LEFT] and player.x + player_vel - 10 > 0:
            player.x -= player_vel
        if keys[pygame.K_RIGHT] and player.x + player_vel + 50 < WIDTH:
            player.x += player_vel

main()