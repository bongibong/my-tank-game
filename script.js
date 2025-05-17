document.addEventListener('DOMContentLoaded', () => {
    const gameArea = document.getElementById('game-area');
    const powerBarFill = document.getElementById('power-bar-fill'); // Added for power bar
    const activeTankIndicator = document.getElementById('active-tank-indicator');
    const gameOverMessageEl = document.getElementById('game-over-message');
    const winnerTextEl = document.getElementById('winner-text');
    const restartButton = document.getElementById('restart-button');
    const terrainCanvas = document.getElementById('terrain-canvas');
    const terrainCtx = terrainCanvas.getContext('2d');


    // Game constants
    const GAME_WIDTH = 800;
    const GAME_HEIGHT = 600;
    const TANK_WIDTH = 50;
    const TANK_HEIGHT = 30;
    const BARREL_LENGTH = 40;
    const BARREL_VISUAL_HEIGHT = 8; // Visual height of the barrel div
    const BULLET_RADIUS = 5;
    const ANGLE_STEP = 5; // degrees for aiming adjustment

    // Power shot constants
    const MIN_BULLET_SPEED = 3; // Decreased min power
    const MAX_BULLET_SPEED = 10; // Decreased max power
    const MAX_CHARGE_DURATION_MS = 1500; // Max time in ms to hold for full power
    const GRAVITY = 0.1; // Adjust for desired gravity strength

    // Game mechanics constants
    const INITIAL_TANK_HEALTH = 100;
    const BULLET_DAMAGE = 25;
    const TERRAIN_COLOR = '#654321'; // Brownish color for terrain
    const SKY_COLOR = '#87CEEB'; // Light sky blue

    // Helper to convert degrees to radians
    const toRadians = (degrees) => degrees * (Math.PI / 180);
    const toDegrees = (radians) => radians * (180 / Math.PI);

    let tanks = [];
    let terrainHeightMap = []; // Array to store y-values for terrain height
    let bullets = [];
    let activeTankId = 1;
    let gameState = 'playing'; // 'playing', 'gameOver'

    let spacebarPressStartTime = 0;
    let isSpacebarHeld = false;

function generateTerrain() {
        terrainHeightMap = [];
        const baseHeight = GAME_HEIGHT * (0.7 + Math.random() * 0.1); // Base height with slight variation

        // Randomize parameters for the main sine wave
        const mainAmplitude = 60 + Math.random() * 40; // Main hill height (60 to 100)
        const mainWavelength = 150 + Math.random() * 100; // Main hill spread (150 to 250)

        // Randomize parameters for a secondary, smaller sine wave for roughness
        const detailAmplitude = 15 + Math.random() * 15; // Detail hill height (15 to 30)
        const detailWavelength = 40 + Math.random() * 30;  // Detail hill spread (40 to 70)

        // Randomize a slight overall tilt (optional)
        const tiltFactor = (Math.random() - 0.5) * 0.1; // Small tilt, can be positive or negative

        for (let x = 0; x < GAME_WIDTH; x++) {
            let y = baseHeight;
            // Main terrain shape
            y -= Math.sin(x / mainWavelength) * mainAmplitude;
            // Add smaller, rougher variations
            y -= Math.sin(x / detailWavelength) * detailAmplitude;
            // Add a very small random noise for texture
            y += (Math.random() - 0.5) * 5;
            // Apply overall tilt
            y += x * tiltFactor;

            // Clamp height to ensure it's within playable bounds and above a certain minimum
            terrainHeightMap.push(Math.max(GAME_HEIGHT * 0.35, Math.min(GAME_HEIGHT - TANK_HEIGHT * 1.5, y)));
        }
    }

    function drawTerrain() {
        if (!terrainCtx) return;
        terrainCtx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Draw Sky
        terrainCtx.fillStyle = SKY_COLOR;
        terrainCtx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Draw Terrain
        terrainCtx.fillStyle = TERRAIN_COLOR;
        terrainCtx.beginPath();
        terrainCtx.moveTo(0, GAME_HEIGHT); // Start from bottom-left
        for (let x = 0; x < GAME_WIDTH; x++) {
            terrainCtx.lineTo(x, terrainHeightMap[x]);
        }
        terrainCtx.lineTo(GAME_WIDTH, GAME_HEIGHT); // Go to bottom-right
        terrainCtx.closePath();
        terrainCtx.fill();
    }

    function createInitialTanks() {
        return []; // Will be populated in initGameElements after terrain is generated
    }


    function createTankElement(tank) {
        const tankEl = document.createElement('div');
        tankEl.className = 'tank';
        tankEl.style.width = `${TANK_WIDTH}px`;
        tankEl.style.height = `${TANK_HEIGHT}px`;
        tankEl.style.backgroundColor = tank.color;
        tankEl.style.left = `${tank.x - TANK_WIDTH / 2}px`;
        // Tank's y is its center, so top is y - height/2
        tankEl.style.top = `${tank.y - TANK_HEIGHT / 2}px`; 
        tankEl.style.transformOrigin = 'center center'; // Rotate around center
        tank.element = tankEl;


        const barrelEl = document.createElement('div');
        barrelEl.className = 'tank-barrel';
        barrelEl.style.width = `${BARREL_LENGTH}px`;
        // Position barrel to start from the center of the tank body
        barrelEl.style.left = `${TANK_WIDTH / 2}px`;
        barrelEl.style.top = `${TANK_HEIGHT / 2 - BARREL_VISUAL_HEIGHT / 2}px`; // Center barrel vertically
        // Barrel angle is now tank.turretAngle, relative to horizontal
        // The tank body itself will be rotated by tank.bodyAngle
        tank.barrelElement = barrelEl;

        const healthEl = document.createElement('div');
        healthEl.className = 'tank-health';
        healthEl.textContent = tank.health;
        tank.healthElement = healthEl;

        tankEl.appendChild(barrelEl);
        tankEl.appendChild(healthEl);
        gameArea.appendChild(tankEl);

    }

    function updateTankElement(tank) {
        if (tank.element) {
            // Tank's y is its center, so top is y - height/2
            tank.element.style.left = `${tank.x - TANK_WIDTH / 2}px`;
            tank.element.style.top = `${tank.y - TANK_HEIGHT / 2}px`; 
            // Rotate tank body to match terrain slope
            tank.element.style.transform = `rotate(${tank.bodyAngle}deg)`;
        }
        if (tank.barrelElement) {
            // Barrel angle is relative to horizontal.
            // To make it visually correct on a tilted tank, its rotation should be (turretAngle - bodyAngle)
            tank.barrelElement.style.transform = `rotate(${tank.turretAngle - tank.bodyAngle}deg)`;
        }

        if (tank.healthElement) {
            tank.healthElement.textContent = Math.max(0, tank.health); // Don't show negative health
        }
    }

    function createBulletElement(bullet) {
        const bulletEl = document.createElement('div');
        bulletEl.className = 'bullet';
        bulletEl.style.width = `${BULLET_RADIUS * 2}px`;
        bulletEl.style.height = `${BULLET_RADIUS * 2}px`;
        bulletEl.style.left = `${bullet.x - BULLET_RADIUS}px`;
        bulletEl.style.top = `${bullet.y - BULLET_RADIUS}px`;
        bullet.element = bulletEl;
        gameArea.appendChild(bulletEl);
    }

    function updateBulletElement(bullet) {
        if (bullet.element) {
            bullet.element.style.left = `${bullet.x - BULLET_RADIUS}px`;
            bullet.element.style.top = `${bullet.y - BULLET_RADIUS}px`;
        }
    }

    function updateActiveTankIndicator() {
        const currentActiveTank = tanks.find(t => t.id === activeTankId);
        if (activeTankIndicator && currentActiveTank) {
            activeTankIndicator.textContent = activeTankId;
            activeTankIndicator.className = `tank-indicator tank-${activeTankId}-indicator`;
        } else if (activeTankIndicator) {
            activeTankIndicator.textContent = '-'; // No active tank if one is destroyed
        }
    }

    function gameLoop() {
        // --- Bullet Update and Collision ---
        const survivingBullets = [];
        for (let i = 0; i < bullets.length; i++) {
            let bullet = bullets[i];
            let shouldRemoveBullet = false;

            // 1. Move bullet
            bullet.x += bullet.vx;
            bullet.y += bullet.vy;
            bullet.vy += GRAVITY;

            // 2. Check terrain collision
            if (bullet.y > getTerrainHeightAt(Math.round(bullet.x))) {
                shouldRemoveBullet = true;
            }

            // 3. Check tank collision (if not already removed by terrain)
            if (!shouldRemoveBullet) {
                for (let j = 0; j < tanks.length; j++) {
                    let tank = tanks[j];
                    if (bullet.ownerId !== tank.id) { // Tank can't shoot itself
                        const bulletLeft = bullet.x - BULLET_RADIUS;
                        const bulletRight = bullet.x + BULLET_RADIUS;
                        const bulletTop = bullet.y - BULLET_RADIUS;
                        const bulletBottom = bullet.y + BULLET_RADIUS;

                        const tankLeft = tank.x - TANK_WIDTH / 2;
                        const tankRight = tank.x + TANK_WIDTH / 2;
                        const tankTop = tank.y - TANK_HEIGHT / 2;
                        const tankBottom = tank.y + TANK_HEIGHT / 2;

                        if (bulletRight > tankLeft && bulletLeft < tankRight &&
                            bulletBottom > tankTop && bulletTop < tankBottom) {
                            tank.health -= BULLET_DAMAGE;
                            shouldRemoveBullet = true;
                            // console.log(`Tank ${tank.id} hit! Health: ${tank.health}`);
                            break; // Bullet hits one tank, stop checking this bullet against other tanks
                        }
                    }
                }
            }

            // 4. Check off-screen (if not already removed)
            if (!shouldRemoveBullet) {
                if (!(bullet.x > -BULLET_RADIUS && bullet.x < GAME_WIDTH + BULLET_RADIUS &&
                      bullet.y > -BULLET_RADIUS && bullet.y < GAME_HEIGHT + BULLET_RADIUS)) {
                    shouldRemoveBullet = true;
                }
            }

            // 5. Process removal or keep
            if (shouldRemoveBullet) {
                if (bullet.element) {
                    bullet.element.remove();
                }
            } else {
                survivingBullets.push(bullet);
                updateBulletElement(bullet); // Update DOM for bullets that are kept
            }
        }
        bullets = survivingBullets; // Assign the new array of surviving bullets

        // Remove destroyed tanks
        tanks = tanks.filter(tank => {
            if (tank.health <= 0) {
                if (tank.element) tank.element.remove();
                // console.log(`Tank ${tank.id} destroyed!`);
                return false; // Remove from array
            }
            return true;
        });

        // Note: updateBulletElement is now called inside the loop for surviving bullets

        // Update tank DOM elements (mostly for angle changes)
        tanks.forEach(updateTankElement);

        // Update power bar if space is held
        if (isSpacebarHeld && powerBarFill) { // Check if powerBarFill exists
            const pressDuration = Date.now() - spacebarPressStartTime;
            const chargeRatio = Math.min(pressDuration / MAX_CHARGE_DURATION_MS, 1);
            powerBarFill.style.width = `${chargeRatio * 100}%`;
        }

        // Check for game over
        if (tanks.length <= 1 && gameState === 'playing') {
            // UNCOMMENT THE LINE BELOW FOR DEBUGGING:
            // console.log('[DEBUG] Game Over condition met. tanks.length:', tanks.length, 'Active tanks:', tanks.map(t => ({id: t.id, health: t.health})), 'gameState:', gameState);
            endGame();
        }

        if (gameState === 'playing') {
            requestAnimationFrame(gameLoop);
        }
    }

    function handleKeyDown(e) {
        if (gameState === 'gameOver') return; // Don't process input if game is over

        const { key } = e;
        let preventDefault = false;
        const currentTank = tanks.find(tank => tank.id === activeTankId);

        // If active tank was destroyed, try to switch to the other if it exists
        if (!currentTank && tanks.length > 0) {
            activeTankId = tanks[0].id; // Switch to the remaining tank
            updateActiveTankIndicator();
            return; // Skip further processing for this key event
        }
        if (!currentTank) return;

        // Aiming logic
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
            preventDefault = true;
            const angleChange = key === 'ArrowLeft' ? -ANGLE_STEP : ANGLE_STEP;
            currentTank.turretAngle += angleChange;
            // No need to re-render entire tank list, just update this one
            updateTankElement(currentTank);
        }

        // Start charging shot
        if (key === ' ') { // Spacebar
            if (!isSpacebarHeld) { // Only start charging if not already held
                isSpacebarHeld = true;
                spacebarPressStartTime = Date.now();
                if (powerBarFill) { // Check if powerBarFill exists
                    powerBarFill.style.width = '0%'; // Reset bar visually on new press
                }
                preventDefault = true;
            }
        }

        // Switch active tank
        if (key.toLowerCase() === 't') {
            preventDefault = true;
            activeTankId = activeTankId === 1 ? 2 : 1;
            updateActiveTankIndicator();
        }

        if (preventDefault) {
            e.preventDefault();
        }
    }

    function handleKeyUp(e) {
        if (gameState === 'gameOver') return; // Don't process input if game is over

        const { key } = e;
        const currentTank = tanks.find(tank => tank.id === activeTankId);

        if (!currentTank) return;

        // Firing logic on spacebar release
        if (key === ' ' && isSpacebarHeld) {
            isSpacebarHeld = false;
            const pressDuration = Date.now() - spacebarPressStartTime;

            // Calculate shot power (speed)
            const chargeRatio = Math.min(pressDuration / MAX_CHARGE_DURATION_MS, 1); // Cap at 1
            const shotSpeed = MIN_BULLET_SPEED + (MAX_BULLET_SPEED - MIN_BULLET_SPEED) * chargeRatio;

            const launchAngleRadians = toRadians(currentTank.turretAngle);
            const barrelTipX = currentTank.x + BARREL_LENGTH * Math.cos(launchAngleRadians); // Tip relative to tank center
            const barrelTipY = currentTank.y + BARREL_LENGTH * Math.sin(launchAngleRadians); // Tip relative to tank center

            const initialVx = shotSpeed * Math.cos(launchAngleRadians);
            const initialVy = shotSpeed * Math.sin(launchAngleRadians);

            const newBullet = {
                id: Date.now() + Math.random(),
                x: barrelTipX,
                y: barrelTipY,
                vx: initialVx, // Horizontal velocity
                vy: initialVy, // Initial vertical velocity
                ownerId: currentTank.id,
                element: null,
            };
            bullets.push(newBullet);
            createBulletElement(newBullet);
            if (powerBarFill) { // Check if powerBarFill exists
                powerBarFill.style.width = '0%'; // Reset power bar after firing
            }
            e.preventDefault();
        }
    }

    function endGame() {
        console.log("endGame!");
        gameState = 'gameOver';
        if (winnerTextEl && gameOverMessageEl) {
            const remainingTanks = tanks.filter(tank => tank.health > 0); // Ensure we only count healthy tanks
            if (remainingTanks.length === 1) {
                winnerTextEl.textContent = `Player ${tanks[0].id} Wins!`;
            } else { // This covers draws (0 tanks left) or unexpected states
                winnerTextEl.textContent = 'It\'s a Draw!'; // Or "Game Over!" if both destroyed simultaneously
            }
            gameOverMessageEl.style.display = 'block';
        }
        console.log("Game Over!");
    }

    function resetGame() {
        // Clear existing elements
        gameArea.innerHTML = ''; // Clear tanks and bullets from game area
        bullets = [];
        tanks = createInitialTanks();
        
        activeTankId = 1;
        gameState = 'playing';
        isSpacebarHeld = false;
        spacebarPressStartTime = 0;

        if (powerBarFill) powerBarFill.style.width = '0%';
        if (gameOverMessageEl) gameOverMessageEl.style.display = 'none';

        // Re-initialize game elements and start loop
        initGameElements();
        requestAnimationFrame(gameLoop);
    }

    function initGameElements() {
        tanks = [ // Define tanks here after terrain might be generated
            { id: 1, x: 100, turretAngle: -45, color: 'royalblue', health: INITIAL_TANK_HEALTH, element: null, barrelElement: null, healthElement: null, bodyAngle: 0 },
            { id: 2, x: GAME_WIDTH - 100, turretAngle: -135, color: 'firebrick', health: INITIAL_TANK_HEALTH, element: null, barrelElement: null, healthElement: null, bodyAngle: 0 },
        ];

        tanks.forEach(tank => {
            tank.y = getTerrainHeightAt(tank.x) - TANK_HEIGHT / 2; // Place tank on terrain, y is center
            tank.bodyAngle = getTerrainAngleAt(tank.x);
        });

         // Create initial tank elements
        tanks.forEach(createTankElement);
        // Set initial active tank indicator
        updateActiveTankIndicator();
    }

    function getTerrainHeightAt(x) {
        const clampedX = Math.max(0, Math.min(GAME_WIDTH - 1, Math.round(x)));
        return terrainHeightMap[clampedX] || GAME_HEIGHT; // Default to bottom if out of bounds
    }

    function getTerrainAngleAt(x) {
        const x1 = Math.max(0, Math.min(GAME_WIDTH - 1, Math.round(x - 5))); // Point to the left
        const x2 = Math.max(0, Math.min(GAME_WIDTH - 1, Math.round(x + 5))); // Point to the right
        if (x1 === x2) return 0; // Flat if points are the same

        const y1 = terrainHeightMap[x1];
        const y2 = terrainHeightMap[x2];

        const angleRad = Math.atan2(y2 - y1, x2 - x1);
        return toDegrees(angleRad);
    }

    // Initialize Game
    function initGame() {
        // Validate essential DOM elements
        if (!gameArea || !activeTankIndicator || !powerBarFill || !gameOverMessageEl || !winnerTextEl || !restartButton || !terrainCanvas || !terrainCtx) {
            console.error("Essential DOM elements are missing. Game may not function correctly.");
            return; // Halt if critical elements are missing
        }

        // Setup canvas dimensions
        terrainCanvas.width = GAME_WIDTH;
        terrainCanvas.height = GAME_HEIGHT;

        generateTerrain();
        drawTerrain();


        // Set game area dimensions (can also be purely CSS driven)
        gameArea.style.width = `${GAME_WIDTH}px`; // Ensures JS constants drive size if needed
        gameArea.style.height = `${GAME_HEIGHT}px`;
        
        tanks = createInitialTanks(); // Initialize tanks array
        initGameElements();
        
        // Add keyboard listener
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        // Start the game loop
        requestAnimationFrame(gameLoop);

        // Restart button listener
        restartButton.addEventListener('click', resetGame);
    }

    initGame();
});
