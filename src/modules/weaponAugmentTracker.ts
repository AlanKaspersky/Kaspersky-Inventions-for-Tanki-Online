import { gameDOM } from '../core/gameDOM';
import { state } from '../core/state';

export const weaponAugmentTracker = (() => {
    const STORAGE_KEY = 'kasp_weapon_augment_tracker';
    let lastSignature = '';
    let currentReloadTime = 0;
    let barContainer = null;
    let barFill = null;
    let currentTurret = '';
    let isPressed = false;
    let pressTime = 0;
    let reloadStart = 0;
    let initialized = false;

    const TURRETS = [
        'firebird', 'freeze', 'isida', 'tesla', 'hammer', 'twins', 'ricochet', 'vulcan',
        'smoky', 'striker', 'thunder', 'tsunami', 'scorpion', 'magnum', 'railgun', 'gauss', 'shaft'
    ];

    const NAME_TRANSLATE = {
        "огнемёт": "firebird", "firebird": "firebird",
        "фриз": "freeze", "freeze": "freeze",
        "изида": "isida", "isida": "isida",
        "тесла": "tesla", "tesla": "tesla",
        "молот": "hammer", "hammer": "hammer",
        "твинс": "twins", "twins": "twins",
        "рикошет": "ricochet", "ricochet": "ricochet",
        "вулкан": "vulcan", "vulcan": "vulcan",
        "смоки": "smoky", "smoky": "smoky",
        "страйкер": "striker", "striker": "striker",
        "гром": "thunder", "thunder": "thunder",
        "цунами": "tsunami", "tsunami": "tsunami",
        "скорпион": "scorpion", "scorpion": "scorpion",
        "магнум": "magnum", "magnum": "magnum",
        "рельса": "railgun", "railgun": "railgun",
        "гаусс": "gauss", "gauss": "gauss",
        "шафт": "shaft", "shaft": "shaft"
    };

    const RELOAD_BASE_STEPS = {
        'shaft': {
            1: [2.70, 2.62, 2.54, 2.46],
            2: [2.45, 2.43, 2.42, 2.40, 2.39, 2.37],
            3: [2.36, 2.34, 2.33, 2.32, 2.30, 2.29, 2.28, 2.26, 2.25],
            4: [2.24, 2.22, 2.21, 2.20, 2.18, 2.17, 2.15, 2.14, 2.13, 2.11, 2.10],
            5: [2.09, 2.09, 2.08, 2.07, 2.06, 2.06, 2.05, 2.04, 2.03, 2.03, 2.02, 2.01],
            6: [2.00, 2.00, 1.99, 1.98, 1.98, 1.97, 1.96, 1.95, 1.95, 1.94, 1.93, 1.93, 1.92],
            7: [1.91, 1.91, 1.90, 1.90, 1.89, 1.89, 1.88, 1.87, 1.87, 1.86, 1.86, 1.85, 1.85, 1.84, 1.83, 1.83, 1.82, 1.82, 1.81, 1.81, 1.80]
        },
        'scorpion': {
            1: [4.05, 3.93, 3.81, 3.69],
            2: [3.67, 3.64, 3.62, 3.60, 3.57, 3.55],
            3: [3.54, 3.52, 3.51, 3.49, 3.48, 3.46, 3.45, 3.43, 3.42],
            4: [3.41, 3.39, 3.38, 3.37, 3.36, 3.34, 3.33, 3.32, 3.31, 3.29, 3.28],
            5: [3.27, 3.25, 3.24, 3.22, 3.21, 3.20, 3.18, 3.17, 3.15, 3.14, 3.12, 3.11],
            6: [3.09, 3.07, 3.06, 3.04, 3.02, 3.00, 2.99, 2.97, 2.95, 2.93, 2.92, 2.90, 2.88],
            7: [2.87, 2.86, 2.85, 2.85, 2.84, 2.83, 2.82, 2.81, 2.80, 2.79, 2.79, 2.78, 2.77, 2.76, 2.75, 2.74, 2.73, 2.73, 2.72, 2.71, 2.70]
        }
    };

    const AUGMENT_MODIFIERS = {
        'https://s.eu.tankionline.com/605/115405/45/51/31770737552234/image.svg': 1.15,
        'https://s.eu.tankionline.com/623/154745/143/361/31770737674426/image.svg': 1.70,
        'https://s.eu.tankionline.com/605/137574/124/170/31770737107437/image.svg': 1.15
    };

    const DISABLE_TIMER_AUGMENTS = [
        'https://s.eu.tankionline.com/605/115405/51/352/31770737750144/image.svg'
    ];

    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (data && typeof data.reloadTime === 'number') {
            currentReloadTime = data.reloadTime;
        }
    } catch (e) { }

    function createBar() {
        if (document.getElementById('kasp-reload-bar-container')) return;

        barContainer = document.createElement('div');
        barContainer.id = 'kasp-reload-bar-container';
        barContainer.style.cssText = `
                    position: fixed;
                    bottom: 20%;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 20em;
                    height: 0.35em;
                    background: rgb(0, 0, 0);
                    box-shadow: 0 0 0 0.2em rgb(0, 0, 0);
                    border-radius: 0.25em;
                    z-index: 9999;
                    pointer-events: none;
                    display: none;
                    overflow: hidden;
                `;

        barFill = document.createElement('div');
        barFill.id = 'kasp-reload-bar-fill';
        barFill.style.cssText = `
                    width: 0%;
                    height: 100%;
                    border-radius: 0.25em;
                    background-color: #FFFF00;
                    box-shadow: 0 0 0.25em rgb(29, 29, 29);
                `;

        barContainer.appendChild(barFill);
        document.body.appendChild(barContainer);
    }

    function renderLoop() {
        requestAnimationFrame(renderLoop);

        if (!currentReloadTime || !document.pointerLockElement) {
            if (barContainer && barContainer.style.display !== 'none') {
                barContainer.style.display = 'none';
            }
            return;
        }

        const now = Date.now();
        const elapsed = now - reloadStart;
        const durationMs = currentReloadTime * 1000;

        if (elapsed < durationMs && reloadStart > 0) {
            if (!barContainer) createBar();
            if (barContainer.style.display !== 'block') barContainer.style.display = 'block';

            const progress = Math.min(1, elapsed / durationMs);
            barFill.style.width = (progress * 100).toFixed(1) + '%';
        } else {
            if (barContainer && barContainer.style.display !== 'none') {
                barContainer.style.display = 'none';
            }
        }
    }

    function trackGarage() {
        if (state.currentScreen !== 'garage') return;

        const nameEl = document.querySelector(gameDOM.garage.weaponName);
        if (!nameEl) return;

        const rawName = nameEl.textContent.trim().toLowerCase();
        const firstWord = rawName.split(/\s+/)[0];
        const itemNameEN = NAME_TRANSLATE[firstWord] || firstWord;

        if (!TURRETS.includes(itemNameEN)) return;

        const buttons = document.querySelectorAll(gameDOM.garage.weaponActions);
        let isEquipped = false;

        buttons.forEach(btn => {
            const text = btn.textContent?.toLowerCase() || '';
            if (text.includes('equipped') || text.includes('установлено') || text.includes('снять') || text.includes('unequip')) {
                isEquipped = true;
            }
        });

        if (!isEquipped) return;

        const deviceIconEl = document.querySelector(gameDOM.garage.deviceIcon);
        let augmentSrc = 'default';
        if (deviceIconEl) augmentSrc = deviceIconEl.getAttribute('src') || 'default';

        let mkLevel = 7;
        let mkStep = 0;

        if (rawName.includes('max')) {
            mkLevel = 7;
            mkStep = 20;
        } else {
            const mkMatch = rawName.match(/mk\s*(\d+)(?:-(\d+))?/i);
            if (mkMatch) {
                mkLevel = parseInt(mkMatch[1]) || 7;
                mkStep = mkMatch[2] ? parseInt(mkMatch[2]) : 0;
            }
        }

        const currentSignature = `${itemNameEN}_mk${mkLevel}-${mkStep}_${augmentSrc}`;
        if (currentSignature === lastSignature) return;

        let reloadTime = null;

        if (DISABLE_TIMER_AUGMENTS.includes(augmentSrc)) {
            reloadTime = 0;
        } else if (RELOAD_BASE_STEPS[itemNameEN] && RELOAD_BASE_STEPS[itemNameEN][mkLevel]) {
            const stepsArray = RELOAD_BASE_STEPS[itemNameEN][mkLevel];
            const safeStep = Math.min(mkStep, stepsArray.length - 1);
            const baseTime = stepsArray[safeStep];

            const modifier = AUGMENT_MODIFIERS[augmentSrc] || 1.0;
            reloadTime = Math.round(baseTime * modifier * 100) / 100;
        }

        currentReloadTime = reloadTime;
        currentTurret = itemNameEN;

        const dataToSave = {
            turret: itemNameEN,
            augment: augmentSrc,
            mk: mkLevel,
            step: mkStep,
            reloadTime: reloadTime,
            timestamp: Date.now()
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
        lastSignature = currentSignature;
    }

    return () => {
        if (!initialized) {
            initialized = true;
            requestAnimationFrame(renderLoop);

            const onPointerDown = (e) => {
                if (e.type === 'pointerdown' && (e.button !== 0 || e.pointerType === 'touch')) return;
                if (e.type === 'keydown' && (e.code !== 'Space' || e.repeat)) return;

                if (!document.pointerLockElement) return;

                isPressed = true;
                pressTime = Date.now();
            };

            const onPointerUp = (e) => {
                if (e.type === 'pointerup' && e.button !== 0) return;
                if (e.type === 'keyup' && e.code !== 'Space') return;

                if (!isPressed) return;
                isPressed = false;

                if (!document.pointerLockElement) return;
                if (!currentReloadTime) return;

                const holdTime = Date.now() - pressTime;

                if (holdTime > 200) {
                    if (currentTurret !== 'shaft') return;
                }

                const durationMs = currentReloadTime * 1000;
                if (reloadStart && (Date.now() - reloadStart) < durationMs) return;

                reloadStart = Date.now();
            };

            document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
            document.addEventListener('keydown', onPointerDown, { capture: true, passive: true });
            document.addEventListener('pointerup', onPointerUp, { capture: true, passive: true });
            document.addEventListener('keyup', onPointerUp, { capture: true, passive: true });
        }

        if (state.currentScreen === 'garage') {
            trackGarage();
        }
    };
})();