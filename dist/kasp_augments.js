"use strict";
(function () {
    if (window !== window.top) {
        return;
    }
    'use strict';
    if (localStorage.getItem('k_auto_upgrade') !== 'true')
        return;
    function getLang() {
        const htmlLang = document.documentElement.lang || '';
        if (htmlLang.toLowerCase().includes('ru'))
            return 'RU';
        if (window.location.hostname.includes('ru.'))
            return 'RU';
        return 'EN';
    }
    const t = {
        RU: { specsTitle: 'Характеристики', adv: 'Преимущества', disadv: 'Недостатки', empty: 'Нет данных' },
        EN: { specsTitle: 'Specs', adv: 'Advantages', disadv: 'Disadvantages', empty: 'No data' }
    };
    const STAT_DICT = {
        DAMAGE: { RU: "Урон", EN: "Damage" },
        DPS: { RU: "Урон в секунду", EN: "Damage per second" },
        CHARGE_RATE: { RU: "Зарядка", EN: "Charge rate" },
        RELOAD: { RU: ["Перезарядка", "Зарядка"], EN: ["Reload", "Cooldown time"] },
        TURNING_SPEED: { RU: "Скорость поворота", EN: "Turning speed" },
        RANGE: { RU: "Дальность", EN: "Shot range" },
        CRIT_DAMAGE: { RU: "Критический урон", EN: "Critical hit damage" },
        HEALING: { RU: "Лечение в секунду", EN: "Healing per second" },
        IMPACT_FORCE: { RU: "Сила удара", EN: "Impact force" },
        SNIPING_DAMAGE: { RU: "Урон прицельный", EN: ["Aiming mode damage", "Damage in sniping mode"] },
        ARCADE_DAMAGE: { RU: "Урон навскидку", EN: "Normal shot damage" },
        ARMOR: { RU: "Броня", EN: "Armor" },
        TURN_SPEED: { RU: "Скорость поворота", EN: "Turn speed" },
        WEIGHT: { RU: "Масса", EN: "Mass" },
        TOP_SPEED: { RU: "Максимальная скорость", EN: "Max speed" },
        POWER: { RU: "Мощность", EN: "Power" }
    };
    const sharedHullSpecs = {
        heatResistance: {
            name: { RU: "Защита от поджога", EN: "Heat Resistance" },
            advantages: [
                { RU: "Урон получаемый от горения: -50%", EN: "Damage taken from Burning: -50%" },
                { RU: "Скорость нагрева: -50%", EN: "Heating rate: -50%" }
            ],
            disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
        },
        coldResistance: {
            name: { RU: "Защита от заморозки", EN: "Cold Resistance" },
            advantages: [
                { RU: "Замедление от заморозки: -50%", EN: "Slowdown from Freezing: -50%" },
                { RU: "Скорость заморозки: -50%", EN: "Freezing rate: -50%" }
            ],
            disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
        },
        lightweight: {
            name: { RU: "Облегчение конструкции", EN: "Lightweight Construction" },
            advantages: [{ RU: "Ускорение: +15%", EN: "Acceleration: +15%" }],
            disadvantages: [{ RU: "Масса: -30%", EN: "Weight: -30%" }],
            modifiers: { TOP_SPEED: 1.15, WEIGHT: 0.7 }
        },
        heavyweight: {
            name: { RU: "Утяжеление конструкции", EN: "Heavyweight Construction" },
            advantages: [{ RU: "Масса: +30%", EN: "Weight: +30%" }],
            disadvantages: [{ RU: "Ускорение: -15%", EN: "Acceleration: -15%" }],
            modifiers: { WEIGHT: 1.3, TOP_SPEED: 0.85 }
        },
        engineer: {
            name: { RU: "Инженер", EN: "Engineer" },
            advantages: [{ RU: "Подбор любой коробки добавляет 1 000 HP", EN: "Picking up a supply box adds 1000 HP" }],
            disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
        },
        heatImmunity: {
            name: { RU: "Иммунитет от поджога", EN: "Heat Immunity" },
            advantages: [{ RU: "Полная защита от статус-эффекта <span class='text-red'>Горение</span>", EN: "Provides complete immunity from Burning." }],
            disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
        },
        coldImmunity: {
            name: { RU: "Иммунитет от заморозки", EN: "Cold Immunity" },
            advantages: [{ RU: "Полная защита от статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Provides complete immunity from Freezing." }],
            disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
        },
        empImmunity: {
            name: { RU: "Иммунитет от ЭМИ", EN: "EMP Immunity" },
            advantages: [{ RU: "Полная защита от статус-эффекта <span class='text-green'>Электромагнитный импульс</span>", EN: "Provides complete immunity from Electromagnetic Pulse" }],
            disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
        },
        stunImmunity: {
            name: { RU: "Иммунитет от оглушения", EN: "Stun Immunity" },
            advantages: [{ RU: "Полная защита от статус-эффекта <span class='text-yellow'>Оглушение</span>", EN: "Provides complete immunity from Stun" }],
            disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
        },
        apImmunity: {
            name: { RU: "Иммунитет от пробития", EN: "AP Immunity" },
            advantages: [{ RU: "Полная защита от статус-эффекта <span class='text-purple'>Пробитие</span>", EN: "Provides complete immunity from Armor-Piercing" }],
            disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
        },
        jammerImmunity: {
            name: { RU: "Иммунитет от подавления", EN: "Jammer Immunity" },
            advantages: [{ RU: "Полная защита от статус-эффекта <span class='text-pink'>Подавление</span>", EN: "Provides complete immunity from Jammer" }],
            disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
        },
        driver: {
            name: { RU: "Драйвер", EN: "Driver" },
            advantages: [
                {
                    RU: "Ускоряет заряд овердрайва в бою:",
                    EN: "Speed of overdrive reload:",
                    subItems: [
                        { RU: "Заряд овердрайва от времени: +100%", EN: "Speed of overdrive reload (time): +100%" },
                        { RU: "Заряд овердрайва от очков: +50%", EN: "Speed of overdrive reload (score): +50%" }
                    ]
                }
            ],
            disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
        },
        blaster: {
            name: { RU: "Подрывник", EN: "Blaster" },
            advantages: [
                {
                    RU: "Хаос-урон при уничтожении танка:",
                    EN: "Chaos damage on death:",
                    subItems: [
                        { RU: "Лёгкие корпуса: 750–1500 hp", EN: "Light hulls: 750–1500 hp" },
                        { RU: "Средние корпуса: 1125–2250 hp", EN: "Medium hulls: 1125–2250 hp" },
                        { RU: "Тяжёлые корпуса: 1500–3000 hp", EN: "Heavy hulls: 1500–3000 hp" },
                        { RU: "Радиус полного поражения взрывом: 3 м", EN: "Radius of full damage: 3 m" },
                        { RU: "Радиус промежуточного поражения взрывом: 4 м", EN: "Radius of intermediate damage: 4 m" },
                        { RU: "Радиус минимального поражения взрывом: 15 м", EN: "Radius of minimum damage: 15 m" }
                    ]
                }
            ],
            disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
        },
        lifeguard: {
            name: { RU: "Спасатель", EN: "Lifeguard" },
            advantages: [{ RU: "Предотвращает уничтожение и моментально восстанавливает 500 hp один раз за респаун", EN: "Prevents death once per respawn and recovers 500 HP" }],
            disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
        },
        miner: {
            name: { RU: "Минёр", EN: "Miner" },
            advantages: [{ RU: "После уничтожения танка сохраняет 70% установленных мин", EN: "70% of mines survive after death" }],
            disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
        },
        grenadier: {
            name: { RU: "Гренадёр", EN: "Grenadier" },
            advantages: [{ RU: "Перезарядка гранат больше не требует респауна танка", EN: "Grenade reload persists without respawning" }],
            disadvantages: [{ RU: "Отсутствуют", EN: "None" }]
        },
        excelsior: {
            name: { RU: "Эксельсиор", EN: "Excelsior" },
            advantages: [
                { RU: "Броня: +25%", EN: "Health: +25%" },
                { RU: "Максимальная скорость: +10%", EN: "Top speed: +10%" },
                { RU: "Мощность: +15%", EN: "Power: +15%" },
                { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
            ],
            disadvantages: [{ RU: "Отсутствуют", EN: "None" }],
            modifiers: { ARMOR: 1.25, TOP_SPEED: 1.10, POWER: 1.15, TURN_SPEED: 1.15 }
        },
        extremeLightweight: {
            name: { RU: "Экстремальное облегчение", EN: "Extreme Lightweight Construction" },
            advantages: [{ RU: "Масса: 1000 кг (идеально для паркура)", EN: "Weight: 1000 kg, ideal for parkour" }],
            disadvantages: [{ RU: "Слабый в обычных боях", EN: "Weak in regular battles" }],
            modifiers: { WEIGHT: 1000 }
        },
        phoenix: {
            name: { RU: "Феникс", EN: "Phoenix" },
            advantages: [
                { RU: "Скорость нагрева: -50%", EN: "Heating speed: -50%" },
                { RU: "Скорость заморозки: -50%", EN: "Freeze speed: -50%" },
                { RU: "Иммунитет от подавления, ЭМИ, оглушения и пробития", EN: "Immunity from jammer, emp, stun, ap" }
            ],
            disadvantages: [{ RU: "Овердрайв не заряжается со временем", EN: "Overdrive does not charge passively" }]
        }
    };
    const deviceSpecsDB = {
        "https://s.eu.tankionline.com/605/115404/204/34/31771401546541/image.svg": {
            name: { RU: "Адреналин", EN: "Adrenaline" },
            advantages: [
                { RU: "Стандартный и критический урон пушки ближнего боя: +25%", EN: "Regular and critical damage: +25%" }
            ],
            disadvantages: [
                { RU: "Бонус урона активируется только при значении здоровья: ≤35%", EN: "Damage bonus only activates when health is ≤35%" },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect" }
            ],
            modifiers: { DPS: 1.25 }
        },
        "https://s.eu.tankionline.com/605/137574/35/123/31770675422274/image.svg": {
            name: { RU: "Насос повышенного давления", EN: "High-pressure pump" },
            advantages: [
                { RU: "Дальность слабого поражения: +50%", EN: "Range +50%" },
                { RU: "Дальность среднего поражения: +25%", EN: "Range (of minimum damage): +50%" },
                { RU: "Дальность полного поражения: +50%", EN: "Range of maximum damage: +50%" },
                { RU: "Дальность подсветки противника: +20%", EN: "Target illumination range: +20%" }
            ],
            disadvantages: [
                { RU: "Угол конуса: –75%", EN: "Cone angle: -75%" }
            ],
            modifiers: { RANGE: 1.50 }
        },
        "https://s.eu.tankionline.com/605/137574/33/65/31770675342601/image.svg": {
            name: { RU: "Компактные баллоны", EN: "Compact fuel tanks" },
            advantages: [
                { RU: "Скорость нагрева: +100%", EN: "Heating rate: +1.00 / tick" },
                { RU: "Максимальная температура: +100%", EN: "Upper temperature limit: +1.00" }
            ],
            disadvantages: [
                { RU: "Перезарядка: +100%", EN: "Reload: +100%" },
                { RU: "Расход энергии: +50%", EN: "Energy consumption: +50%" }
            ],
            modifiers: { CHARGE_RATE: 2, RELOAD: 2 }
        },
        "https://s.eu.tankionline.com/605/115404/207/251/31770675520406/image.svg": {
            name: { RU: "Зажигательная смесь", EN: "Incendiary mix" },
            advantages: [
                { RU: "Урон: +20%", EN: "Damage: +20%" },
                { RU: "Критический урон: +20%", EN: "Critical damage: +20%" }
            ],
            disadvantages: [
                { RU: "Эффект поджигания: отключён", EN: "Afterburn effect removed" }
            ],
            modifiers: { DAMAGE: 1.2, CRIT_DAMAGE: 1.2 }
        },
        "https://s.eu.tankionline.com/605/115404/212/6/31770675602705/image.svg": {
            name: { RU: "Магнитная смесь", EN: "Magnetic Mix" },
            advantages: [
                {
                    RU: "Критический урон накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span> на вражеский танк",
                    EN: "Critically hitting the enemy activates the <span class='text-green'>Electromagnetic Pulse</span> status effect",
                    subItems: [
                        { RU: "Время действия: 1 сек", EN: "Duration: 1 sec" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                { RU: "Скорость нагрева: -70%", EN: "Heating rate: -70%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115404/213/45/31770676007062/image.svg": {
            name: { RU: "Парализующая смесь", EN: "Paralyzing mix" },
            advantages: [
                {
                    RU: "Критический урон накладывает статус-эффект <span class='text-yellow'>Оглушение</span> на вражеский танк",
                    EN: "Critical hits <span class='text-yellow'>Stun</span> the enemy",
                    subItems: [
                        { RU: "Время действия: 0,4 сек", EN: "Duration: 0.4 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                { RU: "Скорость нагрева: -70%", EN: "Heating rate: -70%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115404/214/131/31770675743176/image.svg": {
            name: { RU: "Токсичная смесь", EN: "Toxic Mix" },
            advantages: [
                {
                    RU: "Критический урон накладывает статус-эффект <span class='text-purple'>Пробитие</span> на вражеский танк",
                    EN: "Critically hitting the enemy activates the <span class='text-purple'>Armor-Piercing</span> status effect",
                    subItems: [
                        { RU: "Время действия: 1,5 сек", EN: "Duration: 1.5 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                { RU: "Скорость нагрева: -70%", EN: "Heating rate: -70%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115404/210/316/31770675661143/image.svg": {
            name: { RU: "Подавляющая смесь", EN: "Jamming Mix" },
            advantages: [
                {
                    RU: "Критический урон накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеский танк",
                    EN: "Critically hitting the enemy activates the <span class='text-pink'>Jammer</span> status effect",
                    subItems: [
                        { RU: "Время действия: 3 сек", EN: "Duration: 3 seconds" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                { RU: "Скорость нагрева: -70%", EN: "Heating rate: -70%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "URL_ПУЛЬСАР": {
            name: { RU: "Пульсар", EN: "Pulsar" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффекты:",
                    EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                    subItems: [
                        { RU: "<span class='text-pink'>Подавление</span>: 3 сек", EN: "<span class='text-pink'>Jammer</span>: 3 sec" },
                        { RU: "<span class='text-green'>Электромагнитный импульс</span>: 1 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 1 sec" },
                        { RU: "<span class='text-yellow'>Оглушение</span>: 0,4 сек", EN: "<span class='text-yellow'>Stun</span>: 0.4 sec" },
                        { RU: "<span class='text-purple'>Пробитие</span>: 1,5 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 1.5 sec" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -90%", EN: "Critical damage: -90%" },
                { RU: "Шанс критического урона: -24%", EN: "Critical chance: -25%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.1 }
        },
        "https://s.eu.tankionline.com/625/153142/22/275/31770676354421/image.svg": {
            name: { RU: "Кемпер", EN: "Camper" },
            advantages: [
                { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
            ],
            disadvantages: [
                { RU: "Бонус урона деактивируется при значении здоровья: ≤50%", EN: "Damage boost is active only while you have at least 50% of your maximum HP" },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect" }
            ],
            modifiers: { DPS: 1.9 }
        },
        "https://s.eu.tankionline.com/605/161407/341/230/31770676077403/image.svg": {
            name: { RU: "Критическая смесь", EN: "Critical Mix" },
            advantages: [
                { RU: "Критический урон: +50%", EN: "Critical damage: +50%" },
                { RU: "Шанс критического урона: +320%", EN: "Max. critical hit chance: +400%" },
                { RU: "Начальный шанс критического урона: +400%", EN: "Starting critical hit chance: +400%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { CRIT_DAMAGE: 1.5 }
        },
        "https://s.eu.tankionline.com/626/14777/75/17/31303177701337/image.svg": {
            name: { RU: "Эксельсиор", EN: "Excelsior" },
            advantages: [
                { RU: "Урон: +25%", EN: "Damage: +25%" },
                { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { DPS: 1.25, TURNING_SPEED: 1.15 }
        },
        "https://s.eu.tankionline.com/605/115404/215/175/31771402004720/image.svg": {
            name: { RU: "Адреналин", EN: "Adrenaline" },
            advantages: [
                { RU: "Стандартный и критический урон пушки ближнего боя: +25%", EN: "Regular and critical damage: +25%" }
            ],
            disadvantages: [
                { RU: "Бонус урона активируется только при значении здоровья: ≤35%", EN: "Damage bonus only activates when health is ≤35%" },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DPS: 1.25, DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
        },
        "https://s.eu.tankionline.com/605/137574/40/217/31770700057303/image.svg": {
            name: { RU: "Насос повышенного давления", EN: "High-pressure pump" },
            advantages: [
                { RU: "Дальность слабого поражения: +50%", EN: "Range (of minimum damage): +50%" },
                { RU: "Дальность среднего поражения: +25%", EN: "Mid-range target distance: +25%" },
                { RU: "Дальность полного поражения: +50%", EN: "Range of maximum damage: +50%" },
                { RU: "Дальность подсветки противника: +20%", EN: "Target illumination range: +20%" }
            ],
            disadvantages: [
                { RU: "Угол конуса: –75%", EN: "Cone angle: -75%" }
            ],
            modifiers: { RANGE: 1.5 }
        },
        "https://s.eu.tankionline.com/605/137574/37/51/31770677767625/image.svg": {
            name: { RU: "Коррозионная смесь", EN: "Corrosive mix" },
            advantages: [
                { RU: "Урон в секунду: +10%", EN: "Damage: +10%" },
                { RU: "Критический урон: +10%", EN: "Critical damage: +10%" }
            ],
            disadvantages: [
                { RU: "Эффект заморозки: отключён", EN: "Freezing effect removed" }
            ],
            modifiers: { DPS: 1.1, DAMAGE: 1.1, CRIT_DAMAGE: 1.1 }
        },
        "https://s.eu.tankionline.com/605/115404/223/146/31770700200611/image.svg": {
            name: { RU: "Шоковая заморозка", EN: "Shock freeze" },
            advantages: [
                { RU: "Скорость заморозки: +100%", EN: "Freezing rate: -1.00 / tick" }
            ],
            disadvantages: [
                { RU: "Урон: -10%", EN: "Damage: -10%" },
                { RU: "Критический урон: отсутствует", EN: "Critical hits removed" }
            ],
            modifiers: { DPS: 0.9, DAMAGE: 0.9, CRIT_DAMAGE: 0 }
        },
        "https://s.eu.tankionline.com/605/115404/217/336/31770700456151/image.svg": {
            name: { RU: "Магнитная смесь", EN: "Magnetic Mix" },
            advantages: [
                {
                    RU: "Критический урон накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span> на вражеский танк",
                    EN: "Critically hitting an enemy activates the <span class='text-green'>Electromagnetic Pulse</span> status effect",
                    subItems: [
                        { RU: "Время действия: 1 сек", EN: "Duration: 2 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                { RU: "Скорость заморозки: -50%", EN: "Freezing rate: -70%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115404/224/216/31770700717251/image.svg": {
            name: { RU: "Парализующая смесь", EN: "Paralyzing Mix" },
            advantages: [
                {
                    RU: "Критический урон накладывает статус-эффект <span class='text-yellow'>Оглушение</span> на вражеский танк",
                    EN: "Critical hits <span class='text-yellow'>Stun</span> the enemy",
                    subItems: [
                        { RU: "Время действия: 0,4 сек", EN: "Duration: 0.4 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                { RU: "Скорость заморозки: -50%", EN: "Freezing rate: -70%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115404/222/102/31770700637565/image.svg": {
            name: { RU: "Токсичная смесь", EN: "Toxic Mix" },
            advantages: [
                {
                    RU: "Критический урон накладывает статус-эффект <span class='text-purple'>Пробитие</span> на вражеский танк",
                    EN: "Critically hitting an enemy will apply the <span class='text-purple'>Armor-Piercing</span> status effect",
                    subItems: [
                        { RU: "Время действия: 1,5 сек", EN: "Duration: 1.5 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                { RU: "Скорость заморозки: -50%", EN: "Freezing rate: -70%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115404/225/307/31770700565213/image.svg": {
            name: { RU: "Подавляющая смесь", EN: "Jamming Mix" },
            advantages: [
                {
                    RU: "Критический урон накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеский танк",
                    EN: "Critically hitting an enemy activates the <span class='text-pink'>Jammer</span> status effect",
                    subItems: [
                        { RU: "Время действия: 3 сек", EN: "Duration: 3 seconds" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                { RU: "Скорость заморозки: -50%", EN: "Freezing rate: -70%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/623/22505/354/320/31770700776133/image.svg": {
            name: { RU: "Критическая смесь", EN: "Critical Mix" },
            advantages: [
                { RU: "Шанс критического урона: +424%", EN: "Critical hit chance: +500%" }
            ],
            disadvantages: [
                { RU: "Скорость заморозки: -50%", EN: "Freeze per tick: -50%" }
            ]
        },
        "https://s.eu.tankionline.com/624/172214/74/266/31770701132467/image.svg": {
            name: { RU: "Стабилизированная смесь", EN: "Stable Mix" },
            advantages: [
                { RU: "Дальность слабого поражения: +50%", EN: "Low damage range: +50%" },
                { RU: "Дальность полного поражения: +100%", EN: "Full damage range: +100%" },
                { RU: "Расход энергии: -50%", EN: "Energy consumption: -50%" }
            ],
            disadvantages: [
                { RU: "Перезарядка: +50%", EN: "Reload time: +50%" },
                { RU: "Скорость заморозки: -50%", EN: "Freezing rate: -50%" }
            ],
            modifiers: { RANGE: 2.0, RELOAD: 1.5 }
        },
        "https://s.eu.tankionline.com/625/153142/104/314/31770701605344/image.svg": {
            name: { RU: "Кемпер", EN: "Camper" },
            advantages: [
                { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
            ],
            disadvantages: [
                { RU: "Бонус урона деактивируется при значении здоровья: ≤50%", EN: "Damage boost is active only while you have at least 50% of your maximum HP." },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DPS: 1.9, DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
        },
        "https://s.eu.tankionline.com/606/113532/200/147/31770701061113/image.svg": {
            name: { RU: "Пульсар", EN: "Pulsar" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффекты:",
                    EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                    subItems: [
                        { RU: "<span class='text-green'>Электромагнитный импульс</span>: 1 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 1 sec" },
                        { RU: "<span class='text-yellow'>Оглушение</span>: 0,4 сек", EN: "<span class='text-yellow'>Stun</span>: 0.4 sec" },
                        { RU: "<span class='text-purple'>Пробитие</span>: 1,5 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 1.5 sec" },
                        { RU: "<span class='text-pink'>Подавление</span>: 3 сек", EN: "<span class='text-pink'>Jammer</span>: 3 sec" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -90%", EN: "Critical damage: -90%" },
                { RU: "Шанс критического урона: -29%", EN: "Critical chance: -30%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.1 }
        },
        "https://s.eu.tankionline.com/626/14777/310/231/31303200003222/image.svg": {
            name: { RU: "Эксельсиор", EN: "Excelsior" },
            advantages: [
                { RU: "Урон: +25%", EN: "Damage: +25%" },
                { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { DPS: 1.25, DAMAGE: 1.25, TURNING_SPEED: 1.15 }
        },
        "https://s.eu.tankionline.com/605/115404/314/361/31771402217212/image.svg": {
            name: { RU: "Адреналин", EN: "Adrenaline" },
            advantages: [
                { RU: "Стандартный и критический урон пушки ближнего боя: +25%", EN: "Regular and critical damage: +25%" }
            ],
            disadvantages: [
                { RU: "Бонус урона активируется только при значении здоровья: ≤35%", EN: "Damage bonus only activates when health is ≤35%" },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DPS: 1.25, DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
        },
        "https://s.eu.tankionline.com/605/137574/47/123/31770712527531/image.svg": {
            name: { RU: "Широкополосные излучатели", EN: "Broadband radiators" },
            advantages: [
                { RU: "Угол конуса: +125%", EN: "Cone angle: +125%" }
            ],
            disadvantages: [
                { RU: "Дальность поражения: -30%", EN: "Range: -30%" }
            ],
            modifiers: { RANGE: 0.7 }
        },
        "https://s.eu.tankionline.com/605/137574/50/260/31770713363621/image.svg": {
            name: { RU: "Наноботы поддержки", EN: "Support nanobots" },
            advantages: [
                { RU: "Расход энергии в режиме лечения: -50%", EN: "Energy consumption when healing: -50%" },
                { RU: "Максимальный шанс критического лечения: +100%", EN: "Maximum critical healing chance: +100%" }
            ],
            disadvantages: [
                { RU: "Урон в секунду: -50%", EN: "Regular damage: -50%" }
            ],
            modifiers: { DPS: 0.5, DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115404/317/105/31770712656611/image.svg": {
            name: { RU: "Реактор наномассы", EN: "Nanomass reactor" },
            advantages: [
                { RU: "Восстановление энергии при уничтожении цели: +50%", EN: "Energy recovery on target destruction: +50%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ]
        },
        "https://s.eu.tankionline.com/611/125417/135/371/31770713630221/image.svg": {
            name: { RU: "Намагничивающие наноботы", EN: "Magnetic Nanobots" },
            advantages: [
                {
                    RU: "Критический урон накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span> на вражеский танк",
                    EN: "Critically hitting an enemy activates the <span class='text-green'>Electromagnetic Pulse</span> effect",
                    subItems: [
                        { RU: "Время действия: 1 сек", EN: "Duration: 1.5 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/613/123104/313/102/31770714144741/image.svg": {
            name: { RU: "Оглушающие наноботы", EN: "Stunning Nanobots" },
            advantages: [
                {
                    RU: "Критический урон накладывает статус-эффект <span class='text-yellow'>Оглушение</span> на вражеский танк",
                    EN: "Critically hitting an enemy activates the <span class='text-yellow'>Stun</span> effect",
                    subItems: [
                        { RU: "Время действия: 0,4 сек", EN: "Duration: 0.4 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/614/1145/57/337/31770714065263/image.svg": {
            name: { RU: "Токсичные наноботы", EN: "Toxic Nanobots" },
            advantages: [
                {
                    RU: "Критический урон накладывает статус-эффект <span class='text-purple'>Пробитие</span> на вражеский танк",
                    EN: "Critically hitting an enemy activates the <span class='text-purple'>Armor-Piercing</span> effect",
                    subItems: [
                        { RU: "Время действия: 1,5 сек", EN: "Duration: 1.5 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/607/7000/376/240/31770713750042/image.svg": {
            name: { RU: "Подавляющие наноботы", EN: "Jamming Nanobots" },
            advantages: [
                {
                    RU: "Критический урон накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеский танк",
                    EN: "Critically hitting an enemy activates the <span class='text-pink'>Jammer</span> effect",
                    subItems: [
                        { RU: "Время действия: 3 сек", EN: "Duration: 3 seconds" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115404/321/240/31770714464257/image.svg": {
            name: { RU: "Вампирские наноботы", EN: "Vampire Nanobots" },
            advantages: [
                { RU: "35% наносимого урона добавляется к здоровью", EN: "Recovers HP at a rate of 35% of your base damage per tick while attacking" },
                { RU: "Перезарядка: -15%", EN: "Energy reload time: -15%" }
            ],
            disadvantages: [
                { RU: "Критический урон и лечение: отсутствуют", EN: "Critical hits removed (damage and healing)" },
                { RU: "Лечение: 1 hp/тик", EN: "Healing rate: -99%" },
                { RU: "Расход энергии в холостом режиме: +200%", EN: "Energy consumption when idle: +200%" },
                { RU: "Расход энергии в режиме атаки: +300%", EN: "Energy consumption when attacking: +300%" }
            ],
            modifiers: { RELOAD: 0.85, CHARGE_RATE: 0.85, CRIT_DAMAGE: 0, HEALING: 0.01 }
        },
        "https://s.eu.tankionline.com/617/5400/231/261/31770714420753/image.svg": {
            name: { RU: "Устойчивые наноботы", EN: "Sustainable Nanobots" },
            advantages: [
                { RU: "Дальность: +60%", EN: "Range: +60%" },
                { RU: "Дальность подсветки противника: +50%", EN: "Enemy highlight range: +50%" },
                { RU: "Расход энергии в режиме лечения: -60%", EN: "Energy consumption when healing: -50%" }
            ],
            disadvantages: [
                { RU: "Угол конуса: -50%", EN: "Cone angle: -60%" },
                { RU: "Расход энергии в холостом режиме: +100%", EN: "Energy consumption when idle: +100%" },
                { RU: "Расход энергии в режиме атаки: +100%", EN: "Energy consumption when attacking: +100%" }
            ],
            modifiers: { RANGE: 1.6 }
        },
        "https://s.eu.tankionline.com/623/61301/132/106/31770714343142/image.svg": {
            name: { RU: "Инъекция ударных нанороботов", EN: "Shock Nanobot Injection" },
            advantages: [
                { RU: "Лечение накладывает на союзника эффект <span class='text-yellow'>Дополнительного урона</span>", EN: "Increases an ally's damage while healing: +25%" },
                { RU: "Расход энергии в режиме лечения: -90%", EN: "Energy consumption during healing: -90%" }
            ],
            disadvantages: [
                { RU: "Лечение за тик (hp): -75%", EN: "Normal healing rate: -75%" },
                { RU: "Критическое лечение (hp): -95%", EN: "Critical healing: -95%" }
            ],
            modifiers: { HEALING: 0.25 }
        },
        "https://s.eu.tankionline.com/625/153142/305/125/31770714533144/image.svg": {
            name: { RU: "Кемпер", EN: "Camper" },
            advantages: [
                { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
            ],
            disadvantages: [
                { RU: "Бонус урона деактивируется при значении здоровья: ≤50%", EN: "Damage boost is active only while you have at least 50% of your maximum HP." },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DPS: 1.9, DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
        },
        "URL_ПУЛЬСАР3": {
            name: { RU: "Пульсар", EN: "Pulsar" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффекты:",
                    EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                    subItems: [
                        { RU: "<span class='text-green'>Электромагнитный импульс</span>: 1 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 1 sec" },
                        { RU: "<span class='text-yellow'>Оглушение</span>: 0,4 сек", EN: "<span class='text-yellow'>Stun</span>: 0.4 sec" },
                        { RU: "<span class='text-purple'>Пробитие</span>: 1,5 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 1.5 sec" },
                        { RU: "<span class='text-pink'>Подавление</span>: 3 сек", EN: "<span class='text-pink'>Jammer</span>: 3 sec" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -90%", EN: "Critical damage: -90%" },
                { RU: "Шанс критического урона: -29%", EN: "Critical chance: -30%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.1 }
        },
        "https://s.eu.tankionline.com/626/15001/352/355/31303200421671/image.svg": {
            name: { RU: "Эксельсиор", EN: "Excelsior" },
            advantages: [
                { RU: "Урон: +25%", EN: "Damage: +25%" },
                { RU: "Лечение за тик (hp): +30%", EN: "Healing per tick: +30%" },
                { RU: "Скорость поворота башни: +15%", EN: "Turning speed: +15%" },
                { RU: "Ускорение поворота башни: +15%", EN: "Turning acceleration: +15%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { DPS: 1.25, DAMAGE: 1.25, HEALING: 1.3, TURNING_SPEED: 1.15 }
        },
        "https://s.eu.tankionline.com/605/115405/105/22/31771402721234/image.svg": {
            name: { RU: "Адреналин", EN: "Adrenaline" },
            advantages: [
                { RU: "Стандартный и критический урон пушки ближнего боя: +25%", EN: "Regular and critical damage: +25%" }
            ],
            disadvantages: [
                { RU: "Бонус урона активируется только при значении здоровья: ≤35%", EN: "Damage bonus only activates when health is ≤35%" },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DPS: 1.25, DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
        },
        "https://s.eu.tankionline.com/605/137574/142/156/31770747140675/image.svg": {
            name: { RU: "Минус-поле", EN: "Minus-field" },
            advantages: [
                {
                    RU: "Шар рикошетит от стен",
                    EN: "Permits ball lightning to bounce off props, similar to Ricochet:",
                    subItems: [
                        { RU: "Максимальное количество рикошетов: 10", EN: "Maximum number of ricochets: 10" }
                    ]
                },
                { RU: "Отсутствует самоурон, если количество рикошетов меньше 10", EN: "An accidental shot towards a wall will no longer deal damage to your tank" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ]
        },
        "https://s.eu.tankionline.com/605/137574/131/63/31770747023171/image.svg": {
            name: { RU: "Ускоряющий протокол", EN: "Acceleration Protocol" },
            advantages: [
                { RU: "Скорость шара: +100%", EN: "Lightning ball speed: +100%" },
                { RU: "Дальность полёта шара: +100%", EN: "Lightning ball range: +100%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ]
        },
        "https://s.eu.tankionline.com/605/137574/133/315/31770747073110/image.svg": {
            name: { RU: "Замедляющий протокол", EN: "Dilatory Protocol" },
            advantages: [
                { RU: "Скорость шара: 1 м/с", EN: "Lightning ball speed: 1 m/s" }
            ],
            disadvantages: [
                { RU: "Дальность полёта шара: 30 м", EN: "Lightning ball range: -50%" },
                { RU: "Время перезарядки шаровой молнии: +50%", EN: "Lightning ball reload: +50%" }
            ]
        },
        "https://s.eu.tankionline.com/605/137574/137/302/31770747222720/image.svg": {
            name: { RU: "Экзотермическая молния", EN: "Exothermic Lightning" },
            advantages: [
                {
                    RU: "Шаровая молния и критический урон накладывают статус-эффект <span class='text-red'>Горение</span> на вражеский танк",
                    EN: "Critical hits (+0.40) and ball lightning (+1.00) raise the temperature of enemies and apply the <span class='text-red'>Burning</span> status effect",
                    subItems: [
                        { RU: "Время действия (критический урон): 4 сек", EN: "Duration (critical hit): 4 sec" },
                        { RU: "Время действия (шаровая молния): 10 сек", EN: "Duration (ball lightning): 10 sec" }
                    ]
                },
                {
                    RU: "Шаровая молния рикошетит от препятствий",
                    EN: "Permits ball lightning to bounce off props, similar to Ricochet:",
                    subItems: [
                        { RU: "Максимальное количество рикошетов: 10", EN: "Maximum number of ricochets: 10" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                { RU: "Радиус добавления шаровой молнии в цепочку: 1 м", EN: "Ball lightning does not burst until the 11th impact and is less likely to cause splash damage (Chain radius: 1m)" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/137574/136/147/31770747367407/image.svg": {
            name: { RU: "Эндотермическая молния", EN: "Endothermic Lightning" },
            advantages: [
                {
                    RU: "Шаровая молния и критический урон накладывают статус-эффект <span class='text-blue'>Заморозка</span> на вражеский танк",
                    EN: "Critical hits and ball lightning lower the temperature (-1.00) and apply the <span class='text-blue'>Freezing</span> status effect",
                    subItems: [
                        { RU: "Время действия (критический урон): 10 сек", EN: "Duration (critical hit): 10 sec" },
                        { RU: "Время действия (шаровая молния): 10 сек", EN: "Duration (ball lightning): 10 sec" }
                    ]
                },
                {
                    RU: "Шаровая молния рикошетит от препятствий",
                    EN: "Permits ball lightning to bounce off props, similar to Ricochet:",
                    subItems: [
                        { RU: "Максимальное количество рикошетов: 10", EN: "Maximum number of ricochets: 10" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                { RU: "Радиус добавления шаровой молнии в цепочку: 1 м", EN: "Ball lightning does not burst until the 11th impact and is less likely to cause splash damage (Chain radius: 1m)" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/137574/147/16/31770747303355/image.svg": {
            name: { RU: "Сверхпроводящий разряд", EN: "Superconducting Discharge" },
            advantages: [
                {
                    RU: "Шаровая молния и критический урон накладывают статус-эффект <span class='text-green'>Электромагнитный импульс</span> на вражеский танк",
                    EN: "Critical hits and ball lightning apply the <span class='text-green'>Electromagnetic Pulse</span> status effect on the enemy",
                    subItems: [
                        { RU: "Время действия (критический урон): 2 сек", EN: "Duration (critical hit): 2 sec" },
                        { RU: "Время действия (шаровая молния): 3 сек", EN: "Duration (ball lightning): 3 sec" }
                    ]
                },
                {
                    RU: "Шаровая молния рикошетит от препятствий",
                    EN: "Permits ball lightning to bounce off props, similar to Ricochet:",
                    subItems: [
                        { RU: "Максимальное количество рикошетов: 10", EN: "Maximum number of ricochets: 10" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                { RU: "Радиус добавления шаровой молнии в цепочку: 1 м", EN: "Ball lightning does not burst until the 11th impact and is less likely to cause splash damage (Chain radius: 1m)" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/137574/145/271/31770747575375/image.svg": {
            name: { RU: "Шоковая молния", EN: "Shocking Lightning" },
            advantages: [
                {
                    RU: "Шаровая молния и критический урон накладывают статус-эффект <span class='text-yellow'>Оглушение</span> на вражеский танк",
                    EN: "Critical hits and ball lightning apply the <span class='text-yellow'>Stun</span> status effect on the enemy",
                    subItems: [
                        { RU: "Время действия (критический урон): 1 сек", EN: "Duration (critical hit): 1 sec" },
                        { RU: "Время действия (шаровая молния): 1,5 сек", EN: "Duration (ball lightning): 1.5 sec" }
                    ]
                },
                {
                    RU: "Шаровая молния рикошетит от препятствий",
                    EN: "Permits ball lightning to bounce off props, similar to Ricochet:",
                    subItems: [
                        { RU: "Максимальное количество рикошетов: 10", EN: "Maximum number of ricochets: 10" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                { RU: "Радиус добавления шаровой молнии в цепочку: 1 м", EN: "Ball lightning does not burst until the 11th impact and is less likely to cause splash damage (Chain radius: 1m)" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/137574/132/177/31770747524141/image.svg": {
            name: { RU: "Бронебойный разряд", EN: "Armor-piercing Discharge" },
            advantages: [
                {
                    RU: "Шаровая молния и критический урон накладывают статус-эффект <span class='text-purple'>Пробитие</span> на вражеский танк",
                    EN: "Critical hits and ball lightning apply the <span class='text-purple'>Armor-Piercing</span> status effect on the enemy",
                    subItems: [
                        { RU: "Время действия (критический урон): 5 сек", EN: "Duration (critical hit): 5 sec" },
                        { RU: "Время действия (шаровая молния): 9 сек", EN: "Duration (ball lightning): 9 sec" }
                    ]
                },
                {
                    RU: "Шаровая молния рикошетит от препятствий",
                    EN: "Permits ball lightning to bounce off props, similar to Ricochet:",
                    subItems: [
                        { RU: "Максимальное количество рикошетов: 10", EN: "Maximum number of ricochets: 10" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                { RU: "Радиус добавления шаровой молнии в цепочку: 1 м", EN: "Ball lightning does not burst until the 11th impact and is less likely to cause splash damage (Chain radius: 1m)" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/137574/141/22/31770747462404/image.svg": {
            name: { RU: "Подавляющий разряд", EN: "Jamming Discharge" },
            advantages: [
                {
                    RU: "Любой урон накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеский танк при полноценном контакте",
                    EN: "Hitting an enemy with either chain or ball lightning applies the <span class='text-pink'>Jammer</span> status effect to them",
                    subItems: [
                        { RU: "Время действия: 3 сек", EN: "Duration: 3 seconds" }
                    ]
                },
                {
                    RU: "Шаровая молния рикошетит от препятствий",
                    EN: "Permits ball lightning to bounce off props, similar to Ricochet:",
                    subItems: [
                        { RU: "Максимальное количество рикошетов: 10", EN: "Maximum number of ricochets: 10" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                { RU: "Меньшая вероятность нанести сплеш-урон", EN: "Ball lightning does not burst until the 11th impact and so is less likely to cause splash damage" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/137574/144/142/31770750004402/image.svg": {
            name: { RU: "Пульсар", EN: "Pulsar" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффекты:",
                    EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                    subItems: [
                        { RU: "<span class='text-green'>Электромагнитный импульс</span>: 2 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 2 sec" },
                        { RU: "<span class='text-yellow'>Оглушение</span>: 1 сек", EN: "<span class='text-yellow'>Stun</span>: 1 sec" },
                        { RU: "<span class='text-purple'>Пробитие</span>: 5 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 5 sec" },
                        { RU: "<span class='text-pink'>Подавление</span>: 3 сек", EN: "<span class='text-pink'>Jammer</span>: 3 sec" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -90%", EN: "Critical damage: -90%" },
                { RU: "Шанс критического урона: -27%", EN: "Critical chance: -30%" },
                { RU: "Радиус добавления шаровой молнии в цепочку: 1 м", EN: "Range from one chain lightning to the next ball lightning: 1 m" }
            ],
            modifiers: { CRIT_DAMAGE: 0.1 }
        },
        "https://s.eu.tankionline.com/625/153144/76/330/31770750125020/image.svg": {
            name: { RU: "Кемпер", EN: "Camper" },
            advantages: [
                { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
            ],
            disadvantages: [
                { RU: "Бонус урона деактивируется при значении здоровья: ≤50%", EN: "Damage boost is active only while you have at least 50% of your maximum HP." },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DPS: 1.9, DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
        },
        "https://s.eu.tankionline.com/605/137574/135/23/31770747650670/image.svg": {
            name: { RU: "Электропушка", EN: "Electroturret" },
            advantages: [
                { RU: "Скорость шара: 75 м/с", EN: "Lightning ball speed: 75 m/s" },
                { RU: "Урон шаровой молнии: +25%", EN: "Lightning ball damage: +25%" },
                { RU: "Перезарядка шаровой молнии: -33%", EN: "Lightning ball reload: -33%" },
                { RU: "Дальность полёта шара: 1000 метров", EN: "Lightning ball range: 1000 m" }
            ],
            disadvantages: [
                { RU: "Время разогрева шара: +200%", EN: "Lightning ball warmup time: +200%" }
            ]
        },
        "https://s.eu.tankionline.com/625/104563/334/216/31770750045516/image.svg": {
            name: { RU: "Шоковая терапия", EN: "Shock therapy" },
            advantages: [
                { RU: "Перезарядка цепной молнии: -75%", EN: "Time between two shots: -75%" },
                { RU: "Урон шаровой молнии: +100%", EN: "Tesla ball lightning damage: +100%" }
            ],
            disadvantages: [
                { RU: "Урон цепной молнии: -30%", EN: "Regular damage: -30%" },
                { RU: "Критический урон: -22,5%", EN: "Critical damage: -22.5%" },
                { RU: "Дальность цепной молнии: 10 м", EN: "Shot range: -60%" },
                { RU: "Дальность подсветки противника: 18 м", EN: "Highlighting distance: -50%" },
                { RU: "Радиус добавления танка в цепочку: 1 м", EN: "Radius of adding a tank to the chain (m): 1 m" },
                { RU: "Радиус добавления шаровой молнии в цепочку: 1 м", EN: "Radius of adding ball lightning to the chain (m): 1 m" }
            ],
            modifiers: { RELOAD: 0.25, DPS: 0.7, DAMAGE: 0.7, CRIT_DAMAGE: 0.775, RANGE: 0.4 }
        },
        "https://s.eu.tankionline.com/634/160343/200/134/31770747740717/image.svg": {
            name: { RU: "Повышенное напряжение", EN: "Increased Voltage" },
            advantages: [
                { RU: "Доп. урон за каждую цель: +100%", EN: "Additional damage: +100%" }
            ],
            disadvantages: [
                { RU: "Урон цепной молнии: 0", EN: "Standard damage: -100%" },
                { RU: "Урон шаровой молнии: -22,5%", EN: "Lightning ball damage: -22.5%" }
            ],
            modifiers: { DPS: 0, DAMAGE: 0 }
        },
        "https://s.eu.tankionline.com/626/15006/236/134/31303201552544/image.svg": {
            name: { RU: "Эксельсиор", EN: "Excelsior" },
            advantages: [
                { RU: "Урон цепной молнии: +25%", EN: "Damage (Chain Lightning): +25%" },
                { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { DPS: 1.25, DAMAGE: 1.25, TURNING_SPEED: 1.15 }
        },
        "https://s.eu.tankionline.com/605/115404/233/226/31771402141070/image.svg": {
            name: { RU: "Адреналин", EN: "Adrenaline" },
            advantages: [
                { RU: "Стандартный и критический урон пушки ближнего боя: +25%", EN: "Regular and critical damage: +25%" }
            ],
            disadvantages: [
                { RU: "Бонус урона активируется только при значении здоровья: ≤35%", EN: "Damage bonus only activates when health is ≤35%" },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DPS: 1.25, DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
        },
        "https://s.eu.tankionline.com/605/137574/44/105/31770707575060/image.svg": {
            name: { RU: "Слаггер", EN: "Slugger" },
            advantages: [
                { RU: "Минимальная дальность поражения: +50%", EN: "Range of minimum damage: +50%" },
                { RU: "Предельная дальность поражения: +50%", EN: "Range of maximum damage: +50%" },
                { RU: "Вертикальный угол разброса: -50%", EN: "Highlighting range: +25%" },
                { RU: "Горизонтальный угол разброса: -75%", EN: "Vertical scatter angle: -50%" },
                { RU: "Горизонтальный угол разброса: -75%", EN: "Horizontal scatter angle: -75%" }
            ],
            disadvantages: [
                { RU: "Сила удара: -50%", EN: "Impact force: -50%" }
            ],
            modifiers: { RANGE: 1.5, IMPACT_FORCE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/137574/42/305/31770707465744/image.svg": {
            name: { RU: "Обойма увеличенной ёмкости", EN: "High-capacity ammo clip" },
            advantages: [
                { RU: "Зарядов в обойме: 5", EN: "Shots per clip: 5" }
            ],
            disadvantages: [
                { RU: "Время перезарядки обоймы: +20%", EN: "Clip reload: +20%" }
            ],
            modifiers: { RELOAD: 1.2 }
        },
        "https://s.eu.tankionline.com/605/115404/300/13/31770707347404/image.svg": {
            name: { RU: "Дуплет", EN: "Duplet" },
            advantages: [
                { RU: "Время перезарядки между выстрелами: -80%", EN: "Shot reload: -80%" }
            ],
            disadvantages: [
                { RU: "Зарядов в обойме: 2", EN: "Shots per clip: 2" },
                { RU: "Время перезарядки обоймы: +25%", EN: "Clip reload: +25%" },
                { RU: "Сила удара одной дробины: -50%", EN: "Impact force: -50%" }
            ],
            modifiers: { RELOAD: 1.25, IMPACT_FORCE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115404/237/42/31770707717716/image.svg": {
            name: { RU: "Дыхание дракона", EN: "Dragon's Breath" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-red'>Горение</span> на вражеский танк",
                    EN: "Critically hitting an enemy raises their temperature by +0.4 and applies the <span class='text-red'>Burning</span> status effect.",
                    subItems: [
                        { RU: "Время действия: 4 сек", EN: "Duration: 4 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115404/247/161/31770710451552/image.svg": {
            name: { RU: "Дыхание Виверны", EN: "Wyvern's Breath" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-blue'>Заморозка</span> на вражеский танк",
                    EN: "Critically hitting an enemy lowers their temperature by -1.00 and applies the <span class='text-blue'>Freezing</span> status effect.",
                    subItems: [
                        { RU: "Время действия: 10 сек", EN: "Duration: 10 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115404/242/247/31770710364730/image.svg": {
            name: { RU: "Магнитная картечь", EN: "Magnetic Pellets" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span> на вражеский танк",
                    EN: "Critically hitting an enemy will apply the <span class='text-green'>Electromagnetic Pulse</span> status effect to them.",
                    subItems: [
                        { RU: "Время действия: 1 сек", EN: "Duration: 1 second" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115404/246/64/31770710722173/image.svg": {
            name: { RU: "Парализующая картечь", EN: "Stunning Pellets" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-yellow'>Оглушение</span> на вражеские танки",
                    EN: "Critically hitting an enemy will apply the <span class='text-yellow'>Stun</span> status effect to them.",
                    subItems: [
                        { RU: "Время действия: 0,8 сек", EN: "Duration: 0.8 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115404/234/317/31770710626307/image.svg": {
            name: { RU: "Бронебойный выстрел", EN: "Armor-Piercing Shot" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-purple'>Пробитие</span> на вражеский танк",
                    EN: "Critically hitting an enemy will apply the <span class='text-purple'>Armor-Piercing</span> status effect to them.",
                    subItems: [
                        { RU: "Время действия: 3 сек", EN: "Duration: 3 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115404/241/156/31770710533541/image.svg": {
            name: { RU: "Подавляющий выстрел", EN: "Jamming Shot" },
            advantages: [
                {
                    RU: "Попадание каждым патроном в обойме накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеский танк",
                    EN: "Hitting an enemy will apply the <span class='text-pink'>Jammer</span> status effect to them.",
                    subItems: [
                        { RU: "Время действия: 3 сек", EN: "Duration: 3 seconds" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "URL_ПУЛЬСАР4": {
            name: { RU: "Пульсар", EN: "Pulsar" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффекты:",
                    EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                    subItems: [
                        { RU: "<span class='text-green'>Электромагнитный импульс</span>: 1 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 1 sec" },
                        { RU: "<span class='text-yellow'>Оглушение</span>: 0,8 сек", EN: "<span class='text-yellow'>Stun</span>: 0.8 sec" },
                        { RU: "<span class='text-purple'>Пробитие</span>: 3 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 3 sec" },
                        { RU: "<span class='text-pink'>Подавление</span>: 3 сек", EN: "<span class='text-pink'>Jammer</span>: 3 sec" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -90%", EN: "Critical damage: -90%" },
                { RU: "Шанс критического урона: -10%", EN: "Critical chance: -12%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.1 }
        },
        "https://s.eu.tankionline.com/625/153142/223/336/31770712366117/image.svg": {
            name: { RU: "Кемпер", EN: "Camper" },
            advantages: [
                { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
            ],
            disadvantages: [
                { RU: "Бонус урона деактивируется при значении здоровья: ≤50%", EN: "Damage boost is active only while you have at least 50% of your maximum HP." },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DPS: 1.9, DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
        },
        "https://s.eu.tankionline.com/605/115404/232/163/31770711027560/image.svg": {
            name: { RU: "Адаптивная перезарядка", EN: "Adaptive reload" },
            advantages: [
                { RU: "Уничтожение противника перезаряжает обойму", EN: "Destroying an enemy reloads the clip" },
                { RU: "Время перезарядки между выстрелами: -20%", EN: "Reload time between shots: -20%" },
                { RU: "Зарядов в обойме: 4", EN: "Shots per clip: 4" }
            ],
            disadvantages: [
                { RU: "Время перезарядки обоймы: +20%", EN: "Clip reload time: +20%" }
            ],
            modifiers: { RELOAD: 1.2 }
        },
        "https://s.eu.tankionline.com/605/115404/235/362/31770711205363/image.svg": {
            name: { RU: "Бландербас", EN: "Blunderbuss" },
            advantages: [
                { RU: "Урон: +80%", EN: "Damage: +80%" },
                { RU: "Критический урон: +40%", EN: "Critical damage: +40%" },
                { RU: "Шанс критического урона: 50%", EN: "Critical chance: 50%" },
                { RU: "Число дробинок на выстрел: +200%", EN: "Pellets per shot: +100% (40)" },
                { RU: "Время перезарядки обоймы: -20%", EN: "Clip reload time: -20%" }
            ],
            disadvantages: [
                { RU: "Зарядов в обойме: 1", EN: "Shots per clip: 1" },
                { RU: "Горизонтальный угол разброса: +100%", EN: "Horizontal Angle of Scatter: +200%" }
            ],
            modifiers: { DPS: 1.8, DAMAGE: 1.8, CRIT_DAMAGE: 1.4, RELOAD: 0.8 }
        },
        "https://s.eu.tankionline.com/606/55122/350/216/31770711074200/image.svg": {
            name: { RU: "Штурмовая кассета", EN: "Assault Magazine" },
            advantages: [
                { RU: "Время перезарядки между выстрелами: -75%", EN: "Shot reload: -75%" },
                { RU: "Время перезарядки обоймы: -25%", EN: "Clip reload: -25%" },
                { RU: "Отдача: -80%", EN: "Recoil: -80%" }
            ],
            disadvantages: [
                { RU: "Шанс критического урона: -46%", EN: "Critical chance: -50%" },
                { RU: "Сила удара: -80%", EN: "Impact force: -80%" },
                { RU: "Число дробинок на выстрел: 10", EN: "Pellets per shot = 10" }
            ],
            modifiers: { RELOAD: 0.75, IMPACT_FORCE: 0.2 }
        },
        "https://s.eu.tankionline.com/606/55122/166/133/31770711757720/image.svg": {
            name: { RU: "Крупнокалиберная картечь", EN: "Large Caliber Pellets" },
            advantages: [
                { RU: "Урон: +70%", EN: "Damage: +70%" },
                { RU: "Критический урон: +20%", EN: "Critical damage: +20%" }
            ],
            disadvantages: [
                { RU: "Время перезарядки между выстрелами: +80%", EN: "Shot reload: +80%" },
                { RU: "Время перезарядки обоймы: +50%", EN: "Clip reload: +50%" }
            ],
            modifiers: { DPS: 1.7, DAMAGE: 1.7, CRIT_DAMAGE: 1.2, RELOAD: 1.5 }
        },
        "https://s.eu.tankionline.com/611/150032/152/234/31770711564644/image.svg": {
            name: { RU: "Тяжёлый Слаггер", EN: "Heavy Slugger" },
            advantages: [
                { RU: "Предельная дальность поражения: +100%", EN: "Range of maximum damage: +100%" },
                { RU: "Дальность полного поражения: +100%", EN: "Range of minimum damage: +100%" },
                { RU: "Дальность подсветки противника: +100%", EN: "Highlighting range: +100%" },
                { RU: "Горизонтальный угол разброса: -75%", EN: "Horizontal scatter angle: -75%" },
                { RU: "Вертикальный угол разброса: -50%", EN: "Vertical scatter angle: -50%" }
            ],
            disadvantages: [
                { RU: "Сила удара: -50%", EN: "Impact force: -50%" },
                { RU: "Скорость поворота: -35%", EN: "Turret rotation speed: -35%" },
                { RU: "Ускорение поворота: -35%", EN: "Turret rotary acceleration: -35%" }
            ],
            modifiers: { RANGE: 2.0, IMPACT_FORCE: 0.5, TURNING_SPEED: 0.65 }
        },
        "https://s.eu.tankionline.com/613/12172/37/254/31770711673252/image.svg": {
            name: { RU: "Охотничий дуплет", EN: "Hunter Duplet" },
            advantages: [
                { RU: "Горизонтальный угол разброса: -50%", EN: "Horizontal scatter angle: -50%" },
                { RU: "Время перезарядки между выстрелами: -80%", EN: "Time between the two shots: -80%" },
                { RU: "Предельная дальность поражения: +100%", EN: "Range of maximum damage: +100%" },
                { RU: "Дистанция отображения метки прицела: +100%", EN: "Highlighting range: +100%" }
            ],
            disadvantages: [
                { RU: "Зарядов в обойме: 2", EN: "Shots per clip: 2" },
                { RU: "Время перезарядки обоймы: +15%", EN: "Clip reload: +15%" },
                { RU: "Сила удара: -50%", EN: "Impact force: -50%" }
            ],
            modifiers: { RANGE: 2.0, RELOAD: 1.15, IMPACT_FORCE: 0.5 }
        },
        "https://s.eu.tankionline.com/622/112605/232/247/31770712275125/image.svg": {
            name: { RU: "Револьвер", EN: "Revolver" },
            advantages: [
                { RU: "Зарядов в обойме: 6", EN: "Shots per clip: 6" },
                { RU: "Каждый третий выстрел имеет критический урон", EN: "Every third shot deals critical damage." },
                { RU: "Время перезарядки между выстрелами: -5%", EN: "Shot reload: -5%" },
                { RU: "Максимальный шанс критического выстрела: +100%", EN: "Max critical chance: +100% (RU only)" },
                { RU: "Прирост шанса критического выстрела: +100%", EN: "Crit chance increase: +100% (RU only)" }
            ],
            disadvantages: [
                { RU: "Время перезарядки обоймы: +25%", EN: "Clip reload: +25%" },
                { RU: "Начальный шанс критического выстрела: -100%", EN: "Initial critical chance: -100% (RU only)" },
                { RU: "Минимальный шанс критического выстрела: -100%", EN: "Min critical chance: -100% (RU only)" }
            ],
            modifiers: { RELOAD: 1.25 }
        },
        "https://s.eu.tankionline.com/627/6071/254/247/31770711354417/image.svg": {
            name: { RU: "Боксёр", EN: "Boxer" },
            advantages: [
                { RU: "Время перезарядки обоймы: -56%", EN: "Clip reload: -56%" },
                { RU: "Сила удара: +40%", EN: "Impact Force: +40%" },
                { RU: "Число дробинок на выстрел: +50%", EN: "Pellets per shot: +50%" }
            ],
            disadvantages: [
                { RU: "Зарядов в обойме: 1", EN: "Shots per clip: 1" },
                { RU: "Отдача: +10%", EN: "Recoil +10%" }
            ],
            modifiers: { RELOAD: 0.44, IMPACT_FORCE: 1.4 }
        },
        "https://s.eu.tankionline.com/635/105570/100/322/31770712106110/image.svg": {
            name: { RU: "Игломёт", EN: "Needle Gun" },
            advantages: [
                { RU: "Зарядов в обойме: 12", EN: "Magazine size = 12" },
                { RU: "Перезарядка между выстрелами: -75%", EN: "Time between two shots: -75%" },
                { RU: "Дальность слабого/предельного/полного поражения: +300%", EN: "Range / Damage degression: +300%" },
                { RU: "Дальность подсветки противника: +300%", EN: "Enemy highlight range: +300%" },
                { RU: "Вертикальный и горизонтальный угол разброса: 0°", EN: "Vertical/Horizontal scattering angle: 0°" },
                { RU: "Отдача: -90%", EN: "No advantage for Recoil in EN" }
            ],
            disadvantages: [
                { RU: "Отдача не указана в минусах", EN: "Recoil -90%" },
                { RU: "Критический урон: -50%", EN: "Critical damage -50%" },
                { RU: "Число дробинок: 5", EN: "Pellets per shot = 5" },
                { RU: "Перезарядка обоймы: +200%", EN: "Reload time +200%" },
                { RU: "Сила удара: -90%", EN: "Impact force -90%" }
            ],
            modifiers: { RANGE: 4.0, CRIT_DAMAGE: 0.5, RELOAD: 3.0, IMPACT_FORCE: 0.1 }
        },
        "https://s.eu.tankionline.com/626/15001/146/305/31303200330516/image.svg": {
            name: { RU: "Эксельсиор", EN: "Excelsior" },
            advantages: [
                { RU: "Урон: +25%", EN: "Damage: +25%" },
                { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { DPS: 1.25, DAMAGE: 1.25, TURNING_SPEED: 1.15 }
        },
        "https://s.eu.tankionline.com/605/115405/160/220/31771403155551/image.svg": {
            name: { RU: "Адреналин", EN: "Adrenaline" },
            advantages: [
                { RU: "Стандартный и критический урон пушки средней дальности: +25%", EN: "Regular and critical damage: +25%" }
            ],
            disadvantages: [
                { RU: "Бонус урона активируется только при значении здоровья: ≤25%", EN: "Damage bonus only activates when health is ≤25%" },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DPS: 1.25, DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
        },
        "https://s.eu.tankionline.com/605/137574/161/215/31770765303354/image.svg": {
            name: { RU: "Стабилизированная плазма", EN: "Stabilized plasma" },
            advantages: [
                { RU: "Сила удара: +20%", EN: "Impact force: +20%" },
                { RU: "Самоурон: отсутствует", EN: "Self-damage removed" },
                { RU: "Начальная скорость снаряда: +20%", EN: "Initial projectile speed: +20% (RU only)" }
            ],
            disadvantages: [
                { RU: "Сплеш-урон: отсутствует", EN: "Splash damage removed" }
            ],
            modifiers: { IMPACT_FORCE: 1.2 }
        },
        "https://s.eu.tankionline.com/605/137574/160/13/31770764774116/image.svg": {
            name: { RU: "Ускорители плазмы", EN: "Plasma accelerators" },
            advantages: [
                { RU: "Начальная скорость снаряда: +100%", EN: "Initial projectile speed: +100%" },
                { RU: "Дальность среднего поражения: +50%", EN: "Range of minimum damage: +50%" },
                { RU: "Дальность полного поражения: +50%", EN: "Range: +50%" },
                { RU: "Дальность подсветки противника: +50%", EN: "Highlighting distance: +50%" },
                { RU: "Разгон снарядов увеличен", EN: "Projectile acceleration: +20%" }
            ],
            disadvantages: [
                { RU: "Время перезарядки: +20%", EN: "Reload: +20%" }
            ],
            modifiers: { RANGE: 1.5, RELOAD: 1.2 }
        },
        "https://s.eu.tankionline.com/605/115405/162/364/31770764517664/image.svg": {
            name: { RU: "Тяжёлый плазмомёт", EN: "Heavy Plasmagun" },
            advantages: [
                { RU: "Урон: +35%", EN: "Regular damage: +35%" },
                { RU: "Критический урон: +35%", EN: "Critical damage: +35%" }
            ],
            disadvantages: [
                { RU: "Дальность слабого поражения: -45%", EN: "Range: -45%" },
                { RU: "Дальность среднего поражения: -45%", EN: "Range of minimum damage: -45%" },
                { RU: "Дальность подсветки противника: -45%", EN: "Highlighting distance: -45%" },
                { RU: "Начальная скорость снаряда: -50%", EN: "Initial projectile speed: -50%" }
            ],
            modifiers: { DPS: 1.35, DAMAGE: 1.35, CRIT_DAMAGE: 1.35, RANGE: 0.55 }
        },
        "https://s.eu.tankionline.com/605/115405/173/35/31770766062223/image.svg": {
            name: { RU: "Испепелятор", EN: "Vaporizer" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-red'>Горение</span> на вражеский танк",
                    EN: "Critical hits increase the target's temperature by +0.4 and ignite the target",
                    subItems: [
                        { RU: "Время действия: 4 сек", EN: "Duration: 4 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/161/300/31770767066504/image.svg": {
            name: { RU: "Криотрон", EN: "Cryotron" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-blue'>Заморозка</span> на вражеский танк",
                    EN: "Critical hits decrease the target's temperature by -1.0 and freeze the target",
                    subItems: [
                        { RU: "Время действия: 10 сек", EN: "Duration: 10 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/164/34/31770766236506/image.svg": {
            name: { RU: "Магнетрон", EN: "Magnetron" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span> на вражеский танк",
                    EN: "Critical hits activate the <span class='text-green'>Electromagnetic Pulse</span> status effect",
                    subItems: [
                        { RU: "Время действия: 1 сек", EN: "Duration: 1 second" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/575/72435/73/200/31770767460751/image.svg": {
            name: { RU: "Тектоническая плазма", EN: "Tectonic Plasma" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-yellow'>Оглушение</span> на вражеский танк",
                    EN: "Critical hits <span class='text-yellow'>Stun</span> the enemy",
                    subItems: [
                        { RU: "Время действия: 0,4 сек", EN: "Duration: 0.4 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/167/254/31770767211562/image.svg": {
            name: { RU: "Плазменный инжектор", EN: "Plasma Injector" },
            advantages: [
                {
                    RU: "Критический урон накладывает статус-эффект <span class='text-purple'>Пробитие</span> на вражеский танк",
                    EN: "Critically hitting an enemy applies the <span class='text-purple'>Armor-Piercing</span> status effect to them",
                    subItems: [
                        { RU: "Время действия: 1,5 сек", EN: "Duration: 1.5 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/166/171/31770767144522/image.svg": {
            name: { RU: "Плазменный дизруптор", EN: "Plasma Disruptor" },
            advantages: [
                {
                    RU: "Критический урон накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеский танк",
                    EN: "Critically hitting an enemy activates the <span class='text-pink'>Jammer</span> status effect",
                    subItems: [
                        { RU: "Время действия: 3 сек", EN: "Duration: 3 seconds" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "URL_ПУЛЬСАР5": {
            name: { RU: "Пульсар", EN: "Pulsar" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффекты:",
                    EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                    subItems: [
                        { RU: "<span class='text-green'>Электромагнитный импульс</span>: 1 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 1 sec" },
                        { RU: "<span class='text-yellow'>Оглушение</span>: 0,4 сек", EN: "<span class='text-yellow'>Stun</span>: 0.4 sec" },
                        { RU: "<span class='text-purple'>Пробитие</span>: 1,5 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 1.5 sec" },
                        { RU: "<span class='text-pink'>Подавление</span>: 3 сек", EN: "<span class='text-pink'>Jammer</span>: 1 sec (EN) / 3 sec (RU)" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -90%", EN: "Critical damage: -90%" },
                { RU: "Шанс критического урона: -24%", EN: "Critical chance: -25%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.1 }
        },
        "https://s.eu.tankionline.com/625/153144/214/177/31770771217767/image.svg": {
            name: { RU: "Кемпер", EN: "Camper" },
            advantages: [
                { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
            ],
            disadvantages: [
                { RU: "Бонус урона деактивируется при значении здоровья: ≤85%", EN: "Damage boost is active only while you have at least 85% of your maximum HP." },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DPS: 1.9, DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
        },
        "https://s.eu.tankionline.com/605/115405/170/320/31770770413006/image.svg": {
            name: { RU: "Турбоускорители плазмы", EN: "Plasma Turbo Accelerators" },
            advantages: [
                { RU: "Критический урон: +25%", EN: "Critical damage: +25%" },
                { RU: "Время перезарядки: -50%", EN: "Reload: -50%" },
                { RU: "Сила отдачи: -80%", EN: "Recoil: -80%" },
                { RU: "Начальная скорость снаряда: +125%", EN: "Initial projectile speed: +125%" },
                { RU: "Дальность слабого поражения: +100%", EN: "Range (of minimum damage): +100%" },
                { RU: "Дальность среднего поражения: +100%", EN: "Range of average damage: +100% (RU only)" },
                { RU: "Дальность подсветки противника: +100%", EN: "Highlighting distance: +100% (RU only)" }
            ],
            disadvantages: [
                { RU: "Урон: -60%", EN: "Regular damage: -60%" },
                { RU: "Сила удара: -70%", EN: "Impact force: -70%" }
            ],
            modifiers: { DPS: 0.4, DAMAGE: 0.4, CRIT_DAMAGE: 1.25, RELOAD: 0.5, RANGE: 2.0, IMPACT_FORCE: 0.3 }
        },
        "https://s.eu.tankionline.com/616/75433/17/170/31770770726027/image.svg": {
            name: { RU: "Плазмотрон", EN: "Plasmatron" },
            advantages: [
                { RU: "Стандартный урон: +250%", EN: "Standard damage: +250%" },
                { RU: "Начальная скорость снаряда: +50%", EN: "Initial projectile speed: +50%" }
            ],
            disadvantages: [
                { RU: "Время перезарядки: +300%", EN: "Recharge time: +300%" }
            ],
            modifiers: { DPS: 3.5, DAMAGE: 3.5, RELOAD: 4.0 }
        },
        "https://s.eu.tankionline.com/546/137515/247/264/31770770773144/image.svg": {
            name: { RU: "Буря", EN: "Tempest" },
            advantages: [
                { RU: "Урон: +35%", EN: "Normal damage: +35%" },
                { RU: "Критический урон: +125%", EN: "Critical damage: +125%" },
                { RU: "Шанс критического урона: +91%", EN: "Chance of critical damage: +100%" },
                { RU: "Сила удара снаряда: +100%", EN: "Impact force: +100%" },
                { RU: "Конечная скорость снаряда: +1200%", EN: "Target speed: +1200%" }
            ],
            disadvantages: [
                { RU: "Начальная скорость снаряда: -95%", EN: "Initial projectile speed: -95%" },
                { RU: "Время разгона снаряда: +25%", EN: "Projectile acceleration time: +25%" }
            ],
            modifiers: { DPS: 1.35, DAMAGE: 1.35, CRIT_DAMAGE: 2.25, IMPACT_FORCE: 2.0 }
        },
        "https://s.eu.tankionline.com/626/15007/216/65/31303201745262/image.svg": {
            name: { RU: "Эксельсиор", EN: "Excelsior" },
            advantages: [
                { RU: "Урон: +25%", EN: "Damage: +25%" },
                { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { DPS: 1.25, DAMAGE: 1.25, TURNING_SPEED: 1.15 }
        },
        "https://s.eu.tankionline.com/605/115405/3/3/31771402401736/image.svg": {
            name: { RU: "Адреналин", EN: "Adrenaline" },
            advantages: [
                { RU: "Стандартный и критический урон пушки средней дальности: +25%", EN: "Regular and critical damage: +25%" }
            ],
            disadvantages: [
                { RU: "Бонус урона активируется только при значении здоровья: ≤25%", EN: "Damage bonus only activates when health is ≤25%" },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DPS: 1.25, DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
        },
        "https://s.eu.tankionline.com/605/137574/60/51/31770731767017/image.svg": {
            name: { RU: "Дестабилизированная плазма", EN: "Destabilized plasma" },
            advantages: [
                {
                    RU: "Добавлен сплеш-урон",
                    EN: "Splash damage added:",
                    subItems: [
                        { RU: "Радиус полного поражения взрыва: 1 м", EN: "Maximum splash damage radius: 1 m" },
                        { RU: "Радиус среднего поражения взрыва: 7 м", EN: "Average splash damage radius: 2 m (RU: 7 m)" },
                        { RU: "Радиус слабого поражения взрыва: 2 м", EN: "Minimum and critical splash damage radius: 7 m (RU: 2 m)" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Максимальное число рикошетов: 1", EN: "Maximum number of ricochets: 1" },
                { RU: "Добавлен самоурон на близком расстоянии", EN: "Self-damage possible at close range" }
            ]
        },
        "https://s.eu.tankionline.com/605/137574/61/262/31770731621706/image.svg": {
            name: { RU: "Стабилизация минус-поля", EN: "Minus-field stabilization" },
            advantages: [
                { RU: "Начальная и конечная скорость снаряда: +50%", EN: "Projectile speed: +100%" },
                { RU: "Дальность слабого и среднего поражения: +50%", EN: "Range / Range of minimum damage: +50%" },
                { RU: "Дальность подсветки противника: +50%", EN: "Highlighting distance: +50% (RU only)" }
            ],
            disadvantages: [
                { RU: "Время перезарядки: +10%", EN: "Shot reload: +10%" }
            ],
            modifiers: { RANGE: 1.5, RELOAD: 1.1 }
        },
        "https://s.eu.tankionline.com/605/115405/14/146/31770731702645/image.svg": {
            name: { RU: "Плазма-факел", EN: "Plasma-torch" },
            advantages: [
                { RU: "Время перезарядки: -50%", EN: "Shot reload: -50%" },
                { RU: "Расход энергии на выстрел: -30%", EN: "Energy consumed per shot: -30%" },
                { RU: "Отдача: -50%", EN: "Recoil: -50%" }
            ],
            disadvantages: [
                { RU: "Урон и критический урон: -25%", EN: "Regular and critical damage: -25%" },
                { RU: "Дальность поражения и подсветки: -35%", EN: "Range: -35%" },
                { RU: "Сила удара снаряда: -50%", EN: "Projectile impact force: -50%" },
                { RU: "Начальная и конечная скорость снаряда: -50%", EN: "Projectile speed: -50%" },
                { RU: "Скорость снаряда после рикошета: -50%", EN: "Projectile speed after ricochet: -50%" },
                { RU: "Максимальное число рикошетов: 1", EN: "Maximum number of ricochets: 1" }
            ],
            modifiers: { RELOAD: 0.5, DPS: 0.75, DAMAGE: 0.75, CRIT_DAMAGE: 0.75, RANGE: 0.65, IMPACT_FORCE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/16/316/31770732051322/image.svg": {
            name: { RU: "Испепеляющее поле", EN: "Sizzling Field" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-red'>Горение</span> на вражеский танк",
                    EN: "Hitting an enemy with a critical shot raises their temperature by +0.5 and applies the <span class='text-red'>Burning</span> effect.",
                    subItems: [
                        { RU: "Время действия: 4 сек", EN: "Duration: 4 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/5/131/31770732175146/image.svg": {
            name: { RU: "Криополе", EN: "Cryo field" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-blue'>Заморозка</span> на вражеский танк",
                    EN: "Hitting an enemy with a critical shot lowers their temperature by -1 and freezes the target.",
                    subItems: [
                        { RU: "Время действия: 10 сек", EN: "Duration: 10 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/12/25/31770732120152/image.svg": {
            name: { RU: "Магнетрон", EN: "Magnetron" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span> на вражеский танк",
                    EN: "Hitting an enemy with a critical shot will apply the <span class='text-green'>Electromagnetic Pulse</span> status effect.",
                    subItems: [
                        { RU: "Время действия: 2 сек", EN: "Duration: 2 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/21/37/31770732403450/image.svg": {
            name: { RU: "Тектоническое поле", EN: "Tectonic field" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-yellow'>Оглушение</span> на вражеский танк",
                    EN: "Hitting an enemy with a critical shot will apply the <span class='text-yellow'>Stun</span> status effect.",
                    subItems: [
                        { RU: "Время действия: 1 сек", EN: "Duration: 1 second" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/17/370/31770732340245/image.svg": {
            name: { RU: "Сверхумное минус-поле", EN: "Super-smart Minus-Field" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-purple'>Пробитие</span> на вражеский танк",
                    EN: "Hitting an enemy with a critical shot may apply the <span class='text-purple'>Armor-Piercing</span> status effect.",
                    subItems: [
                        { RU: "Время действия: 5 сек", EN: "Duration: 5 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/10/340/31770732255760/image.svg": {
            name: { RU: "Подавляющее поле", EN: "Jamming field" },
            advantages: [
                {
                    RU: "Каждое попадание снарядом накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеский танк",
                    EN: "Hitting an enemy will apply the <span class='text-pink'>Jammer</span> status effect to them.",
                    subItems: [
                        { RU: "Время действия: 1 сек", EN: "Duration: 1 second" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "URL_ПУЛЬСАР6": {
            name: { RU: "Пульсар", EN: "Pulsar" },
            advantages: [
                {
                    RU: "Критическое попадание снарядом накладывает статус-эффекты:",
                    EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                    subItems: [
                        { RU: "<span class='text-green'>Электромагнитный импульс</span>: 1 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 1 sec" },
                        { RU: "<span class='text-yellow'>Оглушение</span>: 0,4 сек", EN: "<span class='text-yellow'>Stun</span>: 0.4 sec" },
                        { RU: "<span class='text-purple'>Пробитие</span>: 3 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 3 sec" },
                        { RU: "<span class='text-pink'>Подавление</span>: 1 сек", EN: "<span class='text-pink'>Jammer</span>: 1 sec" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -90%", EN: "Critical damage: -90%" },
                { RU: "Шанс критического урона: -39%", EN: "Critical chance: -40%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.1 }
        },
        "https://s.eu.tankionline.com/625/153143/105/74/31770733223722/image.svg": {
            name: { RU: "Кемпер", EN: "Camper" },
            advantages: [
                { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
            ],
            disadvantages: [
                { RU: "Бонус урона деактивируется при значении здоровья: ≤85%", EN: "Damage boost is active only while you have at least 85% of your maximum HP." },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DPS: 1.9, DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
        },
        "https://s.eu.tankionline.com/605/115405/4/66/31770732500552/image.svg": {
            name: { RU: "Берсерк", EN: "Berserk" },
            advantages: [
                { RU: "Уничтожение противника восполняет 100% баллона", EN: "Destroying an enemy refills the energy tank immediately" },
                { RU: "Перезарядка: -30%", EN: "Shot reload: -30%" },
                { RU: "Скорость заряда баллона: +7%", EN: "Charge rate: +7%" }
            ],
            disadvantages: [
                { RU: "Ускоренный расход энергии", EN: "Runs out of energy faster" }
            ],
            modifiers: { RELOAD: 0.7 }
        },
        "https://s.eu.tankionline.com/605/115405/7/261/31770732743374/image.svg": {
            name: { RU: "Гелиос", EN: "Helios" },
            advantages: [
                { RU: "Перезарядка: -80%", EN: "Shot reload: -80%" },
                { RU: "Расход энергии на выстрел: -15%", EN: "Energy consumed per shot: -15%" },
                { RU: "Начальная и конечная скорость снаряда: +50%", EN: "Projectile speed: +50%" },
                { RU: "Дальность слабого, среднего поражения и подсветки: +100%", EN: "Range of minimum damage: +100%" },
                { RU: "Отдача: -80%", EN: "Recoil: -80%" }
            ],
            disadvantages: [
                { RU: "Зарядка баллона: -32%", EN: "Energy recovery rate: -32%" },
                { RU: "Максимальное число рикошетов: 1", EN: "Maximum number of ricochets: 1" },
                { RU: "Сила удара: -80%", EN: "Impact force: -80%" }
            ],
            modifiers: { RELOAD: 0.2, RANGE: 2.0, IMPACT_FORCE: 0.2 }
        },
        "https://s.eu.tankionline.com/623/53773/111/315/31770733074352/image.svg": {
            name: { RU: "Плазменный резонатор", EN: "Plasma Resonator" },
            advantages: [
                { RU: "Процент слабого поражения: 300%", EN: "Damage percentage at the range of min. damage: 300%" },
                { RU: "Дальность полного поражения: 10 м", EN: "Range of max. damage: 10 meters" },
                { RU: "Дальность слабого поражения: 80 м", EN: "Range of min. damage: 80 meters" }
            ],
            disadvantages: [
                { RU: "Стандартный урон: -30%", EN: "Damage: -30%" },
                { RU: "Критический урон: отсутствует", EN: "Critical hits removed" }
            ],
            modifiers: { DPS: 0.7, DAMAGE: 0.7, CRIT_DAMAGE: 0 }
        },
        "https://s.eu.tankionline.com/631/160736/322/206/31770732611417/image.svg": {
            name: { RU: "Боксёр", EN: "BOXER" },
            advantages: [
                { RU: "Шанс критического урона: +23%", EN: "Critical chance: +23%" },
                { RU: "Перезарядка: -25%", EN: "Reload time: -25%" },
                { RU: "Зарядка баллона: 3000 усл. ед/с", EN: "Energy reload speed accelerated" },
                { RU: "Конечная скорость снаряда: 120 м/с", EN: "Final projectile speed: 120 m/s" },
                { RU: "Сила удара: +120%", EN: "Impact force: +120%" }
            ],
            disadvantages: [
                { RU: "Начальная скорость снаряда: 30 м/с", EN: "Initial projectile speed = 30 m/s" },
                { RU: "Время ускорения снаряда: 1,5 сек", EN: "Projectile acceleration time = 1.5 s" },
                { RU: "Запаса энергии хватит только на один выстрел", EN: "One shot at a time" }
            ],
            modifiers: { RELOAD: 0.75, IMPACT_FORCE: 2.2 }
        },
        "https://s.eu.tankionline.com/626/15003/334/245/31303201007577/image.svg": {
            name: { RU: "Эксельсиор", EN: "Excelsior" },
            advantages: [
                { RU: "Урон: +25%", EN: "Damage: +25%" },
                { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { DPS: 1.25, DAMAGE: 1.25, TURNING_SPEED: 1.15 }
        },
        "https://s.eu.tankionline.com/605/115405/207/363/31771403230017/image.svg": {
            name: { RU: "Адреналин", EN: "Adrenaline" },
            advantages: [
                { RU: "Стандартный и критический урон пушки средней дальности: +25%", EN: "Regular and critical damage: +25%" }
            ],
            disadvantages: [
                { RU: "Бонус урона активируется только при значении здоровья: ≤25%", EN: "Damage bonus only activates when health is ≤25%" },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DPS: 1.25, DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
        },
        "https://s.eu.tankionline.com/605/137574/164/322/31770773077325/image.svg": {
            name: { RU: "Регулятор скорости стрельбы", EN: "Shooting Speed Regulator" },
            advantages: [
                { RU: "Урон: +50%", EN: "Regular damage: +50%" },
                { RU: "Шанс критического урона: +49%", EN: "Critical chance: +50%" },
                { RU: "Время раскрутки стволов: -50%", EN: "Barrel startup time: -50%" },
                { RU: "Время остановки стволов: -50%", EN: "Barrel slowdown time: -50%" },
                { RU: "Время до перегрева: +50%", EN: "Time to overheating: +50%" }
            ],
            disadvantages: [
                { RU: "Перезарядка: +50%", EN: "Bullet reload: +50%" }
            ],
            modifiers: { DPS: 1.5, DAMAGE: 1.5, RELOAD: 1.5 }
        },
        "https://s.eu.tankionline.com/605/137574/163/164/31770773003115/image.svg": {
            name: { RU: "Усиленные приводы наводки", EN: "Reinforced aiming transmission" },
            advantages: [
                { RU: "Скорость поворота: +50%", EN: "Turret rotation speed: +50%" },
                { RU: "Ускорение поворота: +50%", EN: "Turret rotary acceleration: +50%" },
                { RU: "Коэффициент скорости поворота башни при стрельбе: +50%", EN: "Coefficient of turret rotation slowdown while shooting: -50% (optimized)" }
            ],
            disadvantages: [
                { RU: "Автоприцел угол вверх: -80%", EN: "Upward auto-aim: -80%" }
            ],
            modifiers: { TURNING_SPEED: 1.5 }
        },
        "https://s.eu.tankionline.com/605/115405/212/113/31771403422474/image.svg": {
            name: { RU: "Зажигательная лента", EN: "Incendiary band" },
            advantages: [
                {
                    RU: "Попадание при перегреве накладывает статус-эффект <span class='text-red'>Горение</span> на вражеский танк",
                    EN: "Each bullet that hits an enemy while your own tank is under the <span class='text-red'>Burning</span> status effect increases their temperature",
                    subItems: [
                        { RU: "Прирост температуры за попадание: +0.07", EN: "Temperature increase per hit: +0.07" },
                        { RU: "Время действия: 0,7 сек", EN: "Duration: 0.7 sec" }
                    ]
                },
                { RU: "Время до перегрева: -75%", EN: "Time to overheat: -75%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" },
                { RU: "Ограничение на температуру: 1", EN: "Temperature limit: 1" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/617/163556/127/124/31770773202461/image.svg": {
            name: { RU: "Замораживающая лента", EN: "Freezing Band" },
            advantages: [
                {
                    RU: "Критический урон накладывает статус-эффект <span class='text-blue'>Заморозка</span> на вражеский танк",
                    EN: "Critical damage imposes <span class='text-blue'>Freezing</span> status effect on an enemy tank",
                    subItems: [
                        { RU: "Время действия: 5 сек", EN: "Duration: 5 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/615/75332/4/347/31770773144012/image.svg": {
            name: { RU: "Магнитная лента", EN: "Magnetic Band" },
            advantages: [
                {
                    RU: "Критический урон накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span> на вражеский танк",
                    EN: "Critically hitting the enemy activates the <span class='text-green'>Electromagnetic Pulse</span> status effect",
                    subItems: [
                        { RU: "Время действия: 1 сек", EN: "Duration: 1 second" }
                    ]
                },
                { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/616/75405/214/251/31770773747123/image.svg": {
            name: { RU: "Оглушающая лента", EN: "Stunning Band" },
            advantages: [
                {
                    RU: "Критический урон накладывает статус-эффект <span class='text-yellow'>Оглушение</span> на вражеский танк",
                    EN: "Critical damage imposes Status Effect <span class='text-yellow'>Stun</span> on an enemy tank",
                    subItems: [
                        { RU: "Время действия: 0,4 сек", EN: "Critical stun: 0.4 sec" }
                    ]
                },
                { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/613/12170/376/100/31770773661430/image.svg": {
            name: { RU: "Бронебойная лента", EN: "Armor-Piercing Band" },
            advantages: [
                {
                    RU: "Критический урон накладывает статус-эффект <span class='text-purple'>Пробитие</span> на вражеский танк",
                    EN: "Critically hitting the enemy activates the <span class='text-purple'>Armor-Piercing</span> status effect",
                    subItems: [
                        { RU: "Время действия: 1,5 сек", EN: "Duration: 1.5 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/606/55123/317/310/31770773424402/image.svg": {
            name: { RU: "Подавляющая лента", EN: "Jamming Band" },
            advantages: [
                {
                    RU: "Критический урон накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеский танк",
                    EN: "Critically hitting the enemy activates the <span class='text-pink'>Jammer</span> status effect",
                    subItems: [
                        { RU: "Время действия: 3 сек", EN: "Duration: 3 seconds" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "URL_ПУЛЬСАР7": {
            name: { RU: "Пульсар", EN: "Pulsar" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффекты:",
                    EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                    subItems: [
                        { RU: "<span class='text-green'>Электромагнитный импульс</span>: 1 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 1 sec" },
                        { RU: "<span class='text-yellow'>Оглушение</span>: 0,4 сек", EN: "<span class='text-yellow'>Stun</span>: 0.4 sec" },
                        { RU: "<span class='text-purple'>Пробитие</span>: 1,5 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 1.5 sec" },
                        { RU: "<span class='text-pink'>Подавление</span>: 3 сек", EN: "<span class='text-pink'>Jammer</span>: 3 sec" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -90%", EN: "Critical damage: -90%" },
                { RU: "Шанс критического урона: -40%", EN: "Critical chance: -40%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.1 }
        },
        "https://s.eu.tankionline.com/625/153144/264/41/31770774323205/image.svg": {
            name: { RU: "Кемпер", EN: "Camper" },
            advantages: [
                { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
            ],
            disadvantages: [
                { RU: "Бонус урона деактивируется при значении здоровья: ≤85%", EN: "Damage boost is active only while you have at least 85% of your maximum HP." },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DPS: 1.9, DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
        },
        "https://s.eu.tankionline.com/605/115405/214/246/31770774222751/image.svg": {
            name: { RU: "Прорезиненные снаряды", EN: "Rubberized Rounds" },
            advantages: [
                { RU: "Максимальное число рикошетов: +4 (всего 5)", EN: "Maximum number of projectile bounces: 5" },
                { RU: "Минимальный угол рикошета: 1°", EN: "Minimum ricochet angle: 1°" },
                { RU: "Критический урон: +50%", EN: "Critical damage: +50%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { CRIT_DAMAGE: 1.5 }
        },
        "https://s.eu.tankionline.com/613/61333/55/135/31770774265545/image.svg": {
            name: { RU: "Шреддер", EN: "Shredder" },
            advantages: [
                { RU: "Урон: +13%", EN: "Damage: +13%" },
                { RU: "Перезарядка: -35%", EN: "Reload: -35%" },
                { RU: "Начальная и конечная скорость снаряда: +50%", EN: "Projectile speed: +50%" },
                { RU: "Дальность полного и слабого поражения: +50%", EN: "Min. and max. damage range: +50%" }
            ],
            disadvantages: [
                { RU: "Время раскрутки стволов: +900%", EN: "Barrel startup time: +900%" },
                { RU: "Время остановки стволов: +50%", EN: "Barrel slowdown time: +50%" },
                { RU: "Башня не может вращаться во время стрельбы", EN: "Turret slowdown when firing = 100%" }
            ],
            modifiers: { DPS: 1.13, DAMAGE: 1.13, RELOAD: 0.65, RANGE: 1.5 }
        },
        "https://s.eu.tankionline.com/613/62100/344/43/31770774063200/image.svg": {
            name: { RU: "Разрывная лента", EN: "Explosive Band" },
            advantages: [
                { RU: "Урон: +10%", EN: "Damage: +10%" },
                { RU: "Максимальный угол рикошета: 45°", EN: "Minimum ricochet angle: 45°" },
                {
                    RU: "Добавлен сплеш-урон:",
                    EN: "Splash damage added:",
                    subItems: [
                        { RU: "Радиус максимального сплеш-урона (2м): 100%", EN: "Damage at 2m: 100%" },
                        { RU: "Радиус промежуточного поражения (4м): 50%", EN: "Damage at 4m: 50%" },
                        { RU: "Радиус минимального поражения (6м): 50%", EN: "Damage at 6m (outer radius): 50%" },
                        { RU: "Критический урон на 4м: 100%", EN: "Critical damage at 4m: 100%" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { DPS: 1.1, DAMAGE: 1.1 }
        },
        "https://s.eu.tankionline.com/620/116140/342/103/31770774122744/image.svg": {
            name: { RU: "Крупный калибр", EN: "Large Caliber" },
            advantages: [
                { RU: "Урон: +140%", EN: "Damage: +140%" },
                { RU: "Время раскрутки и остановки стволов: -20%", EN: "Barrel startup/slowdown time: -20%" },
                { RU: "Сила удара: +300%", EN: "Impact force: +300%" }
            ],
            disadvantages: [
                { RU: "Перезарядка: +100%", EN: "Reload: +100%" },
                { RU: "Отдача: +100%", EN: "Recoil: +100%" },
                { RU: "Скорость поворота: -50%", EN: "Rotation speed: -50%" },
                { RU: "Ускорение поворота: -50%", EN: "Rotation acceleration: -50%" }
            ],
            modifiers: { DPS: 2.4, DAMAGE: 2.4, IMPACT_FORCE: 4.0, RELOAD: 2.0, TURNING_SPEED: 0.5 }
        },
        "https://s.eu.tankionline.com/626/15010/4/6/31303202037143/image.svg": {
            name: { RU: "Эксельсиор", EN: "Excelsior" },
            advantages: [
                { RU: "Урон: +30%", EN: "Damage: +25%" },
                { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { DPS: 1.3, DAMAGE: 1.3, TURNING_SPEED: 1.15 }
        },
        "https://s.eu.tankionline.com/605/115405/54/102/31771402570343/image.svg": {
            name: { RU: "Адреналин", EN: "Adrenaline" },
            advantages: [
                { RU: "Стандартный и критический урон пушки средней дальности: +25%", EN: "Regular and critical damage: +25%" }
            ],
            disadvantages: [
                { RU: "Бонус урона активируется только при значении здоровья: ≤25%", EN: "Damage bonus only activates when health is ≤25%" },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
        },
        "https://s.eu.tankionline.com/605/137574/125/317/31770741145711/image.svg": {
            name: { RU: "Штурмовые снаряды", EN: "Assault rounds" },
            advantages: [
                { RU: "Сила удара: +35%", EN: "Impact force: +35%" },
                { RU: "Начальная и конечная скорость снаряда: +50%", EN: "Initial and final projectile speed: +50%" }
            ],
            disadvantages: [
                { RU: "Критический урон: отсутствует", EN: "Critical hits disabled" }
            ],
            modifiers: { IMPACT_FORCE: 1.35, CRIT_DAMAGE: 0 }
        },
        "https://s.eu.tankionline.com/605/137574/127/144/31770741213466/image.svg": {
            name: { RU: "Система высокоточного прицеливания", EN: "High-precision aiming system" },
            advantages: [
                { RU: "Урон: +27%", EN: "Regular damage: +27%" },
                { RU: "Критический урон: +29%", EN: "Critical damage: +29%" }
            ],
            disadvantages: [
                { RU: "Время перезарядки: +64%", EN: "Reload time: +64%" },
                { RU: "Начальная и конечная скорость снаряда: -30%", EN: "Projectile speed: -30%" }
            ],
            modifiers: { DAMAGE: 1.27, CRIT_DAMAGE: 1.29, RELOAD: 1.64 }
        },
        "https://s.eu.tankionline.com/605/115405/72/161/31770741274422/image.svg": {
            name: { RU: "Суперкумулятивные снаряды", EN: "Supercumulative rounds" },
            advantages: [
                { RU: "Критический урон: +35%", EN: "Critical damage: +35%" }
            ],
            disadvantages: [
                { RU: "Шанс критического урона: -57%", EN: "Critical chance step: -60%" }
            ],
            modifiers: { CRIT_DAMAGE: 1.35 }
        },
        "https://s.eu.tankionline.com/605/115405/63/66/31770741343376/image.svg": {
            name: { RU: "Зажигательные снаряды", EN: "Incendiary rounds" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-red'>Горение</span> на вражеский танк",
                    EN: "Critical hits raise the target's temperature by +0.40 and apply <span class='text-red'>Burning</span>",
                    subItems: [
                        { RU: "Время действия: 4 сек", EN: "Duration: 4 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/57/305/31770741454377/image.svg": {
            name: { RU: "Криоснаряды", EN: "Cryo rounds" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-blue'>Заморозка</span> на вражеский танк",
                    EN: "Critical hits lower the target's temperature by -1.00 and apply <span class='text-blue'>Freezing</span>",
                    subItems: [
                        { RU: "Время действия: 10 сек", EN: "Duration: 10 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/60/355/31770741407663/image.svg": {
            name: { RU: "EMP-снаряды", EN: "EMP Rounds" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span> на вражеский танк",
                    EN: "Critically hitting an enemy will apply the <span class='text-green'>Electromagnetic Pulse</span> status effect to them",
                    subItems: [
                        { RU: "Время действия: 1 сек", EN: "Duration: 1 second" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/64/140/31770741670645/image.svg": {
            name: { RU: "Парализующие снаряды", EN: "Paralyzing Rounds" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-yellow'>Оглушение</span> на вражеский танк",
                    EN: "Critical hits <span class='text-yellow'>Stun</span> the enemy",
                    subItems: [
                        { RU: "Время действия: 1 сек", EN: "Duration: 1 second" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/65/227/31770741615650/image.svg": {
            name: { RU: "Бронебойные снаряды", EN: "Armor-Piercing Rounds" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-purple'>Пробитие</span> на вражеский танк",
                    EN: "Critically hitting an enemy will apply the <span class='text-purple'>Armor-Piercing</span> status effect to them",
                    subItems: [
                        { RU: "Время действия: 2 сек", EN: "Duration: 2 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115537/140/243/31770741550412/image.svg": {
            name: { RU: "Подавляющие снаряды", EN: "Jamming Rounds" },
            advantages: [
                {
                    RU: "Каждое попадание накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеский танк",
                    EN: "Hitting an enemy will apply the <span class='text-pink'>Jammer</span> status effect to them",
                    subItems: [
                        { RU: "Время действия: 2 сек", EN: "Duration: 2 seconds" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "URL_ПУЛЬСАР8": {
            name: { RU: "Пульсар", EN: "Pulsar" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффекты:",
                    EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                    subItems: [
                        { RU: "<span class='text-green'>Электромагнитный импульс</span>: 1 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 1 sec" },
                        { RU: "<span class='text-yellow'>Оглушение</span>: 1 сек", EN: "<span class='text-yellow'>Stun</span>: 1 sec" },
                        { RU: "<span class='text-purple'>Пробитие</span>: 2 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 2 sec" },
                        { RU: "<span class='text-pink'>Подавление</span>: 2 сек", EN: "<span class='text-pink'>Jammer</span>: 2 sec" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -90%", EN: "Critical damage: -90%" },
                { RU: "Шанс критического урона: -42%", EN: "Critical chance: -45%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.1 }
        },
        "https://s.eu.tankionline.com/625/153143/312/335/31770742374535/image.svg": {
            name: { RU: "Кемпер", EN: "Camper" },
            advantages: [
                { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
            ],
            disadvantages: [
                { RU: "Бонус урона деактивируется при значении здоровья: ≤85%", EN: "Damage boost is active only while you have at least 85% of your maximum HP." },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
        },
        "https://s.eu.tankionline.com/605/115405/56/233/31770741742137/image.svg": {
            name: { RU: "Автопушка", EN: "Autocannon" },
            advantages: [
                { RU: "Время перезарядки: -55%", EN: "Reload: -55%" },
                { RU: "Отдача: -25%", EN: "Recoil: -25%" }
            ],
            disadvantages: [
                { RU: "Урон: -35%", EN: "Regular damage: -35%" },
                { RU: "Сила удара: -66%", EN: "Impact force: -66%" },
                { RU: "Автоприцел угол по горизонтали: ±0,6°", EN: "Horizontal auto-aim angle: ±0.6°" }
            ],
            modifiers: { RELOAD: 0.45, DAMAGE: 0.65, IMPACT_FORCE: 0.34 }
        },
        "https://s.eu.tankionline.com/605/115405/67/356/31770742204030/image.svg": {
            name: { RU: "Прорезиненные снаряды", EN: "Rubberized Rounds" },
            advantages: [
                { RU: "Критический урон: +50%", EN: "Critical damage: +50%" },
                { RU: "Максимальное число рикошетов: 3", EN: "Maximum number of projectile bounces: 3" },
                { RU: "Минимальный угол рикошета: 5°", EN: "Minimum ricochet angle: 5°" },
                { RU: "Начальная и конечная скорость снаряда: +100%", EN: "Initial/Final projectile speed: +100%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { CRIT_DAMAGE: 1.5 }
        },
        "https://s.eu.tankionline.com/605/115405/62/23/31770742023352/image.svg": {
            name: { RU: "Разрывные снаряды", EN: "Explosive Rounds" },
            advantages: [
                { RU: "Критический урон: +25%", EN: "Critical damage: +25%" },
                {
                    RU: "Добавлен сплеш-урон:",
                    EN: "Splash damage added:",
                    subItems: [
                        { RU: "Радиус максимального поражения: 3 м (100%)", EN: "Damage at 3m: 100%" },
                        { RU: "Радиус среднего поражения: 6 м (50%)", EN: "Damage at 6m: 50%" },
                        { RU: "Радиус минимального поражения: 9 м (50%)", EN: "Damage at 9m (outer radius): 50%" },
                        { RU: "Радиус взрыва критического урона: 3 м", EN: "Critical damage explosion radius: 3 m" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Добавлен самоурон на близком расстоянии", EN: "Self damage at close range" },
                { RU: "Рикошет снарядов отключён", EN: "Rounds do not ricochet" }
            ],
            modifiers: { CRIT_DAMAGE: 1.25 }
        },
        "https://s.eu.tankionline.com/605/115405/71/50/31770742270265/image.svg": {
            name: { RU: "Упорядоченная боеукладка", EN: "Sorted Ammunition" },
            advantages: [
                { RU: "Каждое четвёртое попадание гарантированно критическое", EN: "Every fourth hit is guaranteed to be a critical" },
                { RU: "Первый выстрел после спавна будет критическим", EN: "The first shot after spawning will be a critical" },
                { RU: "Время перезарядки: -10%", EN: "Reload time: -10%" }
            ],
            disadvantages: [
                { RU: "Стартовый шанс критического выстрела: -200%", EN: "Initial critical chance penalty (RU specific)" }
            ],
            modifiers: { RELOAD: 0.9 }
        },
        "https://s.eu.tankionline.com/617/163647/140/233/31770742075111/image.svg": {
            name: { RU: "Гиперскоростные снаряды", EN: "Hyperspeed Rounds" },
            advantages: [
                { RU: "Начальная и конечная скорость снаряда: +100%", EN: "Initial/Final projectile speed: +100%" },
                { RU: "Процент слабого поражения в конце дегрессии: 300%", EN: "Damage percentage at the end of the degression: 300%" },
                { RU: "Дальность подсветки противника: +100%", EN: "Range of enemy highlighting +100%" }
            ],
            disadvantages: [
                { RU: "Нормальный урон: -50%", EN: "Normal damage: -50%" },
                { RU: "Критический урон: отсутствует", EN: "Critical hits disabled" },
                { RU: "Автоприцел угол по горизонтали: ±0,4°", EN: "Horizontal auto-aim angle: ±0.4°" }
            ],
            modifiers: { DAMAGE: 0.5, CRIT_DAMAGE: 0 }
        },
        "https://s.eu.tankionline.com/626/15005/127/361/31303201332146/image.svg": {
            name: { RU: "Эксельсиор", EN: "Excelsior" },
            advantages: [
                { RU: "Урон: +25%", EN: "Damage: +25%" },
                { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { DAMAGE: 1.25, TURNING_SPEED: 1.15 }
        },
        "https://s.eu.tankionline.com/605/115405/73/237/31771402636052/image.svg": {
            name: { RU: "Адреналин", EN: "Adrenaline" },
            advantages: [
                { RU: "Стандартный и критический урон пушки средней дальности: +25%", EN: "Regular and critical damage: +25%" }
            ],
            disadvantages: [
                { RU: "Бонус урона активируется только при значении здоровья: ≤25%", EN: "Damage bonus only activates when health is ≤25%" },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
        },
        "https://s.eu.tankionline.com/605/115405/100/152/31770745176156/image.svg": {
            name: { RU: "Дистанционный подрыв ракет", EN: "Remote rocket explosives" },
            advantages: [
                { RU: "Бесконтактный дистанционный подрыв (двойное нажатие)", EN: "Rockets will explode upon double-pressing fire button" },
                { RU: "Мин. скорость ракеты: 20 м/с", EN: "Minimum rocket speed: 20 m/s" }
            ],
            disadvantages: [
                { RU: "Время ускорения ракеты: 1,5 сек", EN: "Rocket acceleration time: 1.5 s" },
                { RU: "Возможность самоурона при неосторожности", EN: "Possibility of self-damage if not careful" },
                { RU: "Угол автоприцела по горизонтали: ±0°", EN: "Horizontal auto-aim angle: ±0°" }
            ]
        },
        "https://s.eu.tankionline.com/605/115405/77/36/31770743054711/image.svg": {
            name: { RU: "Пусковая установка «Охотник»", EN: "Missile launcher «Hunter»" },
            advantages: [
                { RU: "Время наведения: -75%", EN: "Aiming time: -75%" },
                { RU: "Время перезарядки после залпа: -40%", EN: "Salvo reload time: -40%" }
            ],
            disadvantages: [
                { RU: "Ракет в залпе: 1", EN: "Rockets per salvo: 1" },
                { RU: "Время удержания наведения: -30%", EN: "Aiming recovery time: -30%" }
            ]
        },
        "https://s.eu.tankionline.com/605/115405/75/361/31770742767604/image.svg": {
            name: { RU: "Пусковая установка «Циклон»", EN: "Missile launcher «Cyclone»" },
            advantages: [
                { RU: "Ракет в залпе: 8", EN: "Rockets per salvo: 8" },
                { RU: "Пауза между ракетами в залпе: -40% (0,15 с)", EN: "Pause between salvo's rockets: -40%" },
                { RU: "Время удержания цели в наведении: +50%", EN: "Aiming recovery time: +50%" }
            ],
            disadvantages: [
                { RU: "Время наведения: +20%", EN: "Aiming time: +20%" }
            ]
        },
        "https://s.eu.tankionline.com/612/150610/365/312/31770745325311/image.svg": {
            name: { RU: "Поджигающие боеголовки", EN: "Incendiary Missiles" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-red'>Горение</span> на вражеский танк",
                    EN: "Critical hits raise the temperature of all damaged enemy tanks and apply <span class='text-red'>Burning</span>",
                    subItems: [
                        { RU: "Прирост температуры: +0.4", EN: "Temperature increase: +0.4" },
                        { RU: "Время действия: 4 сек", EN: "Duration: 4 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/620/156734/156/340/31770745442552/image.svg": {
            name: { RU: "Крио боеголовки", EN: "Cryo Missiles" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-blue'>Заморозка</span> на вражеский танк",
                    EN: "Critical hits lower the temperature of all damaged enemy tanks and apply <span class='text-blue'>Freezing</span>",
                    subItems: [
                        { RU: "Снижение температуры: 1", EN: "Temperature reduction: 1" },
                        { RU: "Время действия: 10 сек", EN: "Duration: 10 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/612/127056/213/323/31770745375216/image.svg": {
            name: { RU: "Магнитные боеголовки", EN: "Magnetic Missiles" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span> на вражеский танк",
                    EN: "Critically hitting an enemy will apply the <span class='text-green'>Electromagnetic Pulse</span> status effect to them",
                    subItems: [
                        { RU: "Время действия: 3 сек", EN: "Duration: 3 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/101/222/31770745654021/image.svg": {
            name: { RU: "Обездвиживающие боеголовки", EN: "Stunning Missiles" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-yellow'>Оглушение</span> на вражеский танк",
                    EN: "Critically hitting an enemy will apply the <span class='text-yellow'>Stun</span> status effect to them",
                    subItems: [
                        { RU: "Время действия: 1,5 сек", EN: "Duration: 1.5 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/74/316/31770745577212/image.svg": {
            name: { RU: "Бронебойная боеголовка", EN: "Armor-Piercing Missiles" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-purple'>Пробитие</span> на вражеский танк",
                    EN: "Critically hitting an enemy will apply the <span class='text-purple'>Armor-Piercing</span> status effect to them",
                    subItems: [
                        { RU: "Время действия: 9 сек", EN: "Duration: 9 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/622/20176/45/174/31770745506225/image.svg": {
            name: { RU: "Подавляющие боеголовки", EN: "Jamming Missiles" },
            advantages: [
                {
                    RU: "Любой урон накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеский танк",
                    EN: "Critically hitting an enemy will apply the <span class='text-pink'>Jammer</span> status effect to them",
                    subItems: [
                        { RU: "Время действия (обычный урон): 2 сек", EN: "Duration (normal): 2 sec (EN: 5 sec)" },
                        { RU: "Время действия (критический урон): 5 сек", EN: "Duration (critical): 5 sec" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/147224/331/326/31770746373364/image.svg": {
            name: { RU: "Пульсар", EN: "Pulsar" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффекты:",
                    EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                    subItems: [
                        { RU: "<span class='text-green'>Электромагнитный импульс</span>: 3 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 3 sec" },
                        { RU: "<span class='text-yellow'>Оглушение</span>: 1,5 сек", EN: "<span class='text-yellow'>Stun</span>: 1.5 sec" },
                        { RU: "<span class='text-purple'>Пробитие</span>: 9 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 9 sec" },
                        { RU: "<span class='text-pink'>Подавление</span>: 5 сек", EN: "<span class='text-pink'>Jammer</span>: 5 sec" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -90%", EN: "Critical damage: -90%" },
                { RU: "Шанс критического урона: -8%", EN: "Critical chance: -9%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.1 }
        },
        "https://s.eu.tankionline.com/625/153144/23/215/31770746676445/image.svg": {
            name: { RU: "Кемпер", EN: "Camper" },
            advantages: [
                { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
            ],
            disadvantages: [
                { RU: "Бонус урона деактивируется при значении здоровья: ≤85%", EN: "Damage boost is active only while you have at least 85% of your maximum HP." },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
        },
        "https://s.eu.tankionline.com/605/115405/102/310/31770746521303/image.svg": {
            name: { RU: "Пусковая установка «Уран»", EN: "Missile launcher «Uranium»" },
            advantages: [
                { RU: "Урон: +125%", EN: "Damage: +125%" },
                { RU: "Критический урон: +160%", EN: "Critical damage: +160%" },
                { RU: "Время наведения: -30%", EN: "Aiming time: -30%" },
                { RU: "Макс. скорость ракеты: 350 м/с", EN: "Maximum projectile speed: 350 m/s" },
                { RU: "Радиус взрыва ракеты: +50%", EN: "Minimum splash damage radius: +50%" }
            ],
            disadvantages: [
                { RU: "Время ускорения снаряда: +700%", EN: "Projectile acceleration time: +700%" },
                { RU: "Пауза между ракетами в залпе: +400%", EN: "Pause between salvo's rockets: +400%" },
                { RU: "Время перезарядки: +12%", EN: "Single-shot reload time: +12%" }
            ],
            modifiers: { DAMAGE: 2.25, CRIT_DAMAGE: 2.6, RELOAD: 1.12 }
        },
        "https://s.eu.tankionline.com/605/147222/345/214/31770746451665/image.svg": {
            name: { RU: "Пусковая установка «Тандем»", EN: "Missile launcher «Tandem»" },
            advantages: [
                { RU: "Шанс критического урона: +20%", EN: "Critical hit chance: +25%" },
                { RU: "Перезарядка ракет: -12%", EN: "Reload time: -12%" },
                { RU: "Пауза между ракетами в залпе: -100%", EN: "Pause between salvo's rockets: -100%" },
                { RU: "Наведение: -75%", EN: "Aiming time: -75%" },
                { RU: "Угловая скорость ракеты: +25%", EN: "Rocket angular velocity: +25%" }
            ],
            disadvantages: [
                { RU: "Ракет в залпе: 2", EN: "Rockets per salvo: 2" },
                { RU: "Перезарядка после залпа: +35%", EN: "Recharge time after salvo: +35%" }
            ],
            modifiers: { RELOAD: 0.88 }
        },
        "https://s.eu.tankionline.com/610/176122/121/70/31770746104146/image.svg": {
            name: { RU: "Пусковая установка «Гидра»", EN: "Missile launcher «Hydra»" },
            advantages: [
                { RU: "Ракет в залпе: 20", EN: "Rockets per salvo = 20" },
                { RU: "Сила удара: +50%", EN: "Impact force increased" },
                { RU: "Наведение: -50%", EN: "Aiming time: -50%" },
                { RU: "Перезарядка: -40%", EN: "Single-shot reload time: -40%" },
                { RU: "Пауза между ракетами в залпе: -20%", EN: "Pause between salvo's rockets: -20%" }
            ],
            disadvantages: [
                { RU: "Урон: -40%", EN: "Normal and critical damage: -40%" },
                { RU: "Критический урон: -50%", EN: "Critical damage decrease" },
                { RU: "Перезарядка после залпа: +80%", EN: "Recharge time after salvo: +80%" },
                { RU: "Угловая скорость ракеты: 3°/сек", EN: "Rockets angular velocity = 3°/sec" }
            ],
            modifiers: { DAMAGE: 0.6, CRIT_DAMAGE: 0.5, RELOAD: 0.4, IMPACT_FORCE: 1.5 }
        },
        "https://s.eu.tankionline.com/612/127056/353/361/31770746031351/image.svg": {
            name: { RU: "Пусковая установка «Фауст»", EN: "Missile launcher «Faust»" },
            advantages: [
                { RU: "Перезарядка: -50%", EN: "Reload time: -50%" },
                { RU: "Наведение: -50%", EN: "Aiming time: -50%" },
                { RU: "Пауза между ракетами в залпе: -50%", EN: "Pause between salvo's rockets: -50%" }
            ],
            disadvantages: [
                { RU: "Дальность: 40 м", EN: "Range = 40m" },
                { RU: "Перезарядка после залпа: +100%", EN: "Reload after salvo: +100%" }
            ],
            modifiers: { RELOAD: 0.5 }
        },
        "https://s.eu.tankionline.com/614/76403/251/210/31770746577776/image.svg": {
            name: { RU: "Вакуумные боеголовки", EN: "Vacuum Missiles" },
            advantages: [
                { RU: "Критический урон: +25%", EN: "Critical damage: +25%" },
                { RU: "Бесконтактный дистанционный подрыв", EN: "Rockets will explode upon double-pressing fire button" },
                { RU: "Мин. скорость ракеты: 20 м/с", EN: "Minimum rocket speed: 20 m/s" },
                {
                    RU: "Параметры сплеш-урона:",
                    EN: "Average and minimal splash damage:",
                    subItems: [
                        { RU: "Радиус промежуточного поражения: 5 м", EN: "Average splash damage" },
                        { RU: "Предельный радиус поражения: 8 м", EN: "Minimal splash damage" },
                        { RU: "Процент промежуточного/слабого поражения: ~230-235%", EN: "Percentage: 235%" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Урон: -30%", EN: "Damage: -30%" },
                { RU: "Перезарядка: +6%", EN: "Pause between salvo rockets: +6%" },
                { RU: "Время ускорения ракеты: 1,5 сек", EN: "Rocket acceleration time: 1.5 s" }
            ],
            modifiers: { DAMAGE: 0.7, CRIT_DAMAGE: 1.25, RELOAD: 1.06 }
        },
        "https://s.eu.tankionline.com/615/6647/254/11/31770746305363/image.svg": {
            name: { RU: "Пусковая установка «Метеор»", EN: "Missile Launcher «Meteor»" },
            advantages: [
                { RU: "Урон: +25%", EN: "Damage: +25%" },
                { RU: "Сила удара: +50%", EN: "Impact force: +50%" },
                { RU: "Мин. скорость ракеты: 90 м/с", EN: "Minimum rocket speed = 90 m/s" },
                { RU: "Макс. скорость ракеты: 350 м/с", EN: "Maximum speed" },
                { RU: "Пауза между ракетами в залпе: 0,05 сек", EN: "Pause between rockets in salvo = 50 ms" }
            ],
            disadvantages: [
                {
                    RU: "Радиусы взрыва (сплеш сильно уменьшен): 1,5 м",
                    EN: "Splash radius = 1m",
                    subItems: [
                        { RU: "Радиус полного/промежуточного/предельного/критического поражения: 1,5 м", EN: "All radius values: 1.5m" }
                    ]
                }
            ],
            modifiers: { DAMAGE: 1.25, IMPACT_FORCE: 1.5 }
        },
        "https://s.eu.tankionline.com/626/66003/354/107/31770746163342/image.svg": {
            name: { RU: "Пусковая установка «Кастет»", EN: "Missile Launcher «Brass Knuckles»" },
            advantages: [
                { RU: "Бесконтактный дистанционный подрыв", EN: "Rockets will explode upon double-pressing fire button" },
                { RU: "Перезарядка ракет: -12%", EN: "Reload time: -12%" },
                { RU: "Наведение: -62%", EN: "Aiming time: -62%" },
                { RU: "Пауза между ракетами в залпе: -20%", EN: "Pause between salvo's rockets: -20%" },
                { RU: "Начальная скорость ракеты: 20 м/с", EN: "Minimum rocket speed: 20 m/s" },
                { RU: "Максимальный шанс крит. урона: 100%", EN: "Maximum chance of critical hit = 100%" }
            ],
            disadvantages: [
                { RU: "Время ускорения ракеты: 1,5 сек", EN: "Rocket acceleration time: 1.5 s" },
                { RU: "Перезарядка после залпа: +111%", EN: "Reload time after salvo: +111%" }
            ],
            modifiers: { RELOAD: 0.88 }
        },
        "https://s.eu.tankionline.com/626/15006/46/161/31303201457152/image.svg": {
            name: { RU: "Эксельсиор", EN: "Excelsior" },
            advantages: [
                { RU: "Урон: +25%", EN: "Damage: +25%" },
                { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { DAMAGE: 1.25, TURNING_SPEED: 1.15 }
        },
        "https://s.eu.tankionline.com/605/115405/123/31/31771402775040/image.svg": {
            name: { RU: "Адреналин", EN: "Adrenaline" },
            advantages: [
                { RU: "Стандартный и критический урон пушки средней дальности: +25%", EN: "Regular and critical damage: +25%" }
            ],
            disadvantages: [
                { RU: "Бонус урона активируется только при значении здоровья: ≤25%", EN: "Damage bonus only activates when health is ≤25%" },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
        },
        "https://s.eu.tankionline.com/605/137574/151/362/31770750272437/image.svg": {
            name: { RU: "Автомат заряжания малого калибра", EN: "Small caliber charging machine" },
            advantages: [
                { RU: "Время перезарядки: -20%", EN: "Reload time: -20%" }
            ],
            disadvantages: [
                { RU: "Урон: -30%", EN: "Regular damage: -30%" }
            ],
            modifiers: { RELOAD: 0.8, DAMAGE: 0.7 }
        },
        "https://s.eu.tankionline.com/605/137574/150/212/31770750223672/image.svg": {
            name: { RU: "Подкалиберные снаряды", EN: "Subcaliber rounds" },
            advantages: [
                { RU: "Время перезарядки: -10%", EN: "Reload time: -10%" },
                { RU: "Начальная и конечная скорость снаряда: +100%", EN: "Projectile speed: +100%" },
                { RU: "Сила удара: +25%", EN: "Impact force: +25%" },
                { RU: "Скорость стрельбы: +100%", EN: "Firing speed: +100%" },
                { RU: "Самоурон отсутствует", EN: "Self damage removed" }
            ],
            disadvantages: [
                { RU: "Сплеш-урон отсутствует", EN: "Splash damage removed" }
            ],
            modifiers: { RELOAD: 0.9, IMPACT_FORCE: 1.25 }
        },
        "https://s.eu.tankionline.com/605/115405/141/126/31770750343375/image.svg": {
            name: { RU: "Снаряды «Кувалда»", EN: "«Sledgehammer» rounds" },
            advantages: [
                { RU: "Урон: +35%", EN: "Regular damage: +35%" }
            ],
            disadvantages: [
                { RU: "Дальность слабого поражения: -60%", EN: "Range of minimum damage: -60%" },
                { RU: "Дальность полного поражения: -60%", EN: "Range of maximum damage: -60%" },
                { RU: "Скорость снаряда: -50%", EN: "Projectile speed: -50%" },
                { RU: "Критический урон отключен", EN: "Critical hits disabled" },
                { RU: "Начальная скорость: -50", EN: "Launch speed -50" }
            ],
            modifiers: { DAMAGE: 1.35, RANGE: 0.4, CRIT_DAMAGE: 0 }
        },
        "https://s.eu.tankionline.com/605/115405/144/333/31770750567612/image.svg": {
            name: { RU: "Снаряды «Виверна»", EN: "«Wyvern» shells" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-blue'>Заморозка</span> на все цели в радиусе 12 метров",
                    EN: "Critical hits lower the temperature of all enemy tanks in a 12 meter radius and apply <span class='text-blue'>Freezing</span>",
                    subItems: [
                        { RU: "Снижение температуры: -1.00", EN: "Temperature reduction: -1.00" },
                        { RU: "Радиус сплеша критического урона: 12 м", EN: "Critical splash damage radius: 12 m" }
                    ]
                },
                { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/140/45/31770750417461/image.svg": {
            name: { RU: "Снаряды «Саламандра»", EN: "«Salamander» shells" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-red'>Горение</span> на все цели в радиусе 12 метров",
                    EN: "Critical hits raise the temperature of all enemy tanks in a 12 meter radius and apply <span class='text-red'>Burning</span>",
                    subItems: [
                        { RU: "Прирост температуры: +0.40", EN: "Temperature increase: +0.40" },
                        { RU: "Радиус сплеша критического урона: 12 м", EN: "Critical splash damage radius: 12 m" }
                    ]
                },
                { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/132/42/31770750500676/image.svg": {
            name: { RU: "Снаряды «Магнето»", EN: "«Magneto» shells" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span> на все цели в радиусе 12 метров",
                    EN: "Critical hits apply the <span class='text-green'>Electromagnetic Pulse</span> status effect to all enemies in a 12 meter radius",
                    subItems: [
                        { RU: "Время действия: 2 сек", EN: "Duration: 2 seconds" },
                        { RU: "Радиус сплеша критического урона: 12 м", EN: "Critical splash damage radius: 12 m" }
                    ]
                },
                { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/135/271/31770750754561/image.svg": {
            name: { RU: "Снаряды «Миротворец»", EN: "«Peacekeeper» shells" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-yellow'>Оглушение</span> на все цели в радиусе 12 метров",
                    EN: "Critical hits apply the <span class='text-yellow'>Stun</span> status effect to all enemies in a 12 meter radius",
                    subItems: [
                        { RU: "Время действия: 1 сек", EN: "Duration: 1 second" },
                        { RU: "Радиус сплеша критического урона: 12 м", EN: "Critical splash damage radius: 12 m" }
                    ]
                },
                { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/126/246/31770750676002/image.svg": {
            name: { RU: "Снаряды «Коррозия»", EN: "«Corrosion» shells" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-purple'>Пробитие</span> на все цели в радиусе 12 метров",
                    EN: "Critical hits apply the <span class='text-purple'>Armor-Piercing</span> status effect to all enemies in a 12 meter radius",
                    subItems: [
                        { RU: "Время действия: 5 сек", EN: "Duration: 5 seconds" },
                        { RU: "Радиус сплеша критического урона: 12 м", EN: "Critical splash damage radius: 12 m" }
                    ]
                },
                { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/134/201/31770750633625/image.svg": {
            name: { RU: "Снаряды «Шум»", EN: "«Noise» shells" },
            advantages: [
                {
                    RU: "Попадание накладывает статус-эффект <span class='text-pink'>Подавление</span> на цель и все цели в радиусе 12 метров",
                    EN: "Hitting an enemy tank applies the <span class='text-pink'>Jammer</span> status effect to them and all enemies in a 12 meter radius",
                    subItems: [
                        { RU: "Время действия: 3 сек", EN: "Duration: 3 seconds" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/142/164/31770751432372/image.svg": {
            name: { RU: "Строгая погрузка боеприпасов", EN: "Strict Ammunition Load" },
            advantages: [
                { RU: "Каждое третье попадание гарантированно критическое", EN: "Every third hit is guaranteed to be a critical" },
                { RU: "Первый выстрел после спавна будет критическим", EN: "The first shot after spawning will be a critical" },
                { RU: "Время перезарядки: -20%", EN: "Reload time: -20%" },
                { RU: "Критический урон: +25%", EN: "Critical damage: +25%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { RELOAD: 0.8, CRIT_DAMAGE: 1.25 }
        },
        "https://s.eu.tankionline.com/605/115405/127/312/31770751230522/image.svg": {
            name: { RU: "Гиперскоростные снаряды", EN: "Hyperspeed shells" },
            advantages: [
                { RU: "Начальная скорость запуска: +100%", EN: "Launch speed +100%" },
                { RU: "Скорость цели: +100%", EN: "Target velocity +100%" },
                { RU: "Процент дегрессии урона в конце: 300%", EN: "Damage percentage at the end of the degression = 300%" },
                { RU: "Дальность подсветки противника: +100%", EN: "Range of enemy highlighting +100%" }
            ],
            disadvantages: [
                { RU: "Нормальный урон: -50%", EN: "Regular damage: -50%" },
                { RU: "Критический урон отключен", EN: "Critical hits removed" },
                { RU: "Автоприцел угол по горизонтали: ±0.2°", EN: "Horizontal auto-aim angle: ±0.2°" }
            ],
            modifiers: { DAMAGE: 0.5, CRIT_DAMAGE: 0 }
        },
        "https://s.eu.tankionline.com/605/115405/143/251/31770751505446/image.svg": {
            name: { RU: "Вакуумный снаряд", EN: "Vacuum shells" },
            advantages: [
                { RU: "Радиус сплеш-урона: 12 м", EN: "Splash damage radius: 12 m" },
                { RU: "Радиус среднего сплеш-урона: 9 м", EN: "Radius of average splash damage: 9 m" },
                { RU: "Средний и минимальный сплеш-урон: 250%", EN: "Average and minimal splash damage: 250%" },
                { RU: "Автоприцел угол по горизонтали: ±0°", EN: "Horizontal auto-aim angle: ±0°" }
            ],
            disadvantages: [
                { RU: "Урон: -15%", EN: "Damage: -15%" }
            ],
            modifiers: { DAMAGE: 0.85 }
        },
        "https://s.eu.tankionline.com/605/115405/121/362/31770751023605/image.svg": {
            name: { RU: "Адаптивная перезарядка", EN: "Adaptive reload" },
            advantages: [
                { RU: "Сокращение перезарядки при нанесении урона врагу: 33%", EN: "Reload reduction per enemy damaged: 33%" }
            ],
            disadvantages: [
                { RU: "Базовое время перезарядки: +15%", EN: "Base reload time: +15%" },
                { RU: "Радиус сплеш-урона: -25%", EN: "Splash damage radius: -25%" }
            ],
            modifiers: { RELOAD: 1.15 }
        },
        "https://s.eu.tankionline.com/605/115405/133/111/31770751305066/image.svg": {
            name: { RU: "Снаряды «Нанотек»", EN: "«Nanotech» shells" },
            advantages: [
                { RU: "Стрельба по союзникам лечит их на количество урона по небронированной цели", EN: "Shooting a teammate heals them the same amount it would damage an unarmored enemy" },
                { RU: "Лечение приносит очки репутации и опыта (от 1 до 20)", EN: "Healing gives reputation and experience points" },
                { RU: "Лечение не зависит от дальности", EN: "Healing is not affected by range" }
            ],
            disadvantages: [
                { RU: "Урон: -20%", EN: "Damage: -20%" },
                { RU: "Сила удара отключена", EN: "Impact force disabled" },
                { RU: "Критический урон отключен", EN: "Critical hits removed" },
                { RU: "Сплеш-урон не лечит союзников", EN: "Splash damage does not heal allied tanks" },
                { RU: "Автоприцел угол по горизонтали: ±0°", EN: "Horizontal auto-aim angle: ±0°" }
            ],
            modifiers: { DAMAGE: 0.8, IMPACT_FORCE: 0, CRIT_DAMAGE: 0 }
        },
        "https://s.eu.tankionline.com/605/115405/124/105/31770751064115/image.svg": {
            name: { RU: "Снаряды «Наковальня»", EN: "«Anvil» shells" },
            advantages: [
                { RU: "Время перезарядки: -10%", EN: "Reload time: -10%" },
                { RU: "Урон: +35%", EN: "Regular damage: +35%" },
                { RU: "Критический урон: +30%", EN: "Critical damage: +30%" },
                { RU: "Радиус критического сплеша: 12 м", EN: "Critical splash radius: 12m" }
            ],
            disadvantages: [
                { RU: "Максимальная дальность поражения: -50%", EN: "Range of maximum damage: -50%" },
                { RU: "Минимальная дальность поражения: -25%", EN: "Range of minimum damage: -25%" }
            ],
            modifiers: { RELOAD: 0.9, DAMAGE: 1.35, CRIT_DAMAGE: 1.3, RANGE: 0.5 }
        },
        "https://s.eu.tankionline.com/623/154746/364/11/31770751146513/image.svg": {
            name: { RU: "Болтер", EN: "Bolter" },
            advantages: [
                { RU: "Максимальная скорость снаряда: 700 м/с", EN: "Max shell speed: 700 m/s" },
                { RU: "Длительность фазы ускорения: 2.5 с", EN: "Shell acceleration phase duration: 2.5s" },
                { RU: "Время перезарядки: -45%", EN: "Reload time: -45%" },
                { RU: "Сила удара: +25%", EN: "Impact force: +25%" },
                { RU: "Сила удара сплеша: +25%", EN: "Splash damage impact force: +25%" }
            ],
            disadvantages: [
                { RU: "Минимальная скорость снаряда: 10 м/с", EN: "Min shell speed: 10 m/s" },
                { RU: "Сила отдачи: +15%", EN: "Recoil force: +15%" }
            ],
            modifiers: { RELOAD: 0.55, IMPACT_FORCE: 1.25 }
        },
        "https://s.eu.tankionline.com/634/24211/5/226/31770751547170/image.svg": {
            name: { RU: "Ямато", EN: "Yamato" },
            advantages: [
                { RU: "Урон: +60%", EN: "Damage: +60%" },
                { RU: "Критический урон: +50%", EN: "Critical damage: +50%" },
                { RU: "Начальная и конечная скорость снаряда: +100%", EN: "Initial and final projectile speed: +100%" },
                { RU: "Минимальный радиус сплеша: +50%", EN: "Minimum splash damage radius: +50%" }
            ],
            disadvantages: [
                { RU: "Перезарядка: +80%", EN: "Reload: +80%" },
                { RU: "Скорость поворота: -25%", EN: "Rotation speed: -25%" },
                { RU: "Ускорение поворота: -25%", EN: "Rotation acceleration: -25%" }
            ],
            modifiers: { DAMAGE: 1.6, CRIT_DAMAGE: 1.5, RELOAD: 1.8, TURNING_SPEED: 0.75 }
        },
        "https://s.eu.tankionline.com/605/115405/136/373/31770751355652/image.svg": {
            name: { RU: "Пульсар", EN: "Pulsar" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффекты:",
                    EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                    subItems: [
                        { RU: "<span class='text-pink'>Подавление</span>: 5 сек", EN: "<span class='text-pink'>Jammer</span>: 5 sec" },
                        { RU: "<span class='text-green'>Электромагнитный импульс</span>: 2 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 2 sec" },
                        { RU: "<span class='text-yellow'>Оглушение</span>: 1 сек", EN: "<span class='text-yellow'>Stun</span>: 1 sec" },
                        { RU: "<span class='text-purple'>Пробитие</span>: 5 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 5 sec" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Шанс крита: -12%", EN: "Critical chance: -12%" },
                { RU: "Критический урон: -90%", EN: "Critical damage: -90%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.1 }
        },
        "https://s.eu.tankionline.com/625/153144/145/41/31770751703724/image.svg": {
            name: { RU: "Кемпер", EN: "Camper" },
            advantages: [
                { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
            ],
            disadvantages: [
                { RU: "Бонус урона деактивируется при значении здоровья: ≤85%", EN: "Damage boost is active only while you have at least 85% of your maximum HP." },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
        },
        "https://s.eu.tankionline.com/626/15007/17/150/31303201645022/image.svg": {
            name: { RU: "Эксельсиор", EN: "Excelsior" },
            advantages: [
                { RU: "Урон: +25%", EN: "Damage: +25%" },
                { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { DAMAGE: 1.25, TURNING_SPEED: 1.15 }
        },
        "https://s.eu.tankionline.com/634/112236/325/324/31771403052177/image.svg": {
            name: { RU: "Адреналин", EN: "Adrenaline" },
            advantages: [
                { RU: "Стандартный и критический урон пушки большой дальности: +25%", EN: "Regular and critical damage: +25%" }
            ],
            disadvantages: [
                { RU: "Бонус урона активируется только при значении здоровья: ≤20%", EN: "Damage bonus only activates when health is ≤20%" },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
        },
        "https://s.eu.tankionline.com/634/112242/333/350/31770755431040/image.svg": {
            name: { RU: "Ручной режим стрельбы", EN: "Manual Firing Mode" },
            advantages: [
                { RU: "Время перезарядки: -25%", EN: "Reload time -25%" }
            ],
            disadvantages: [
                { RU: "Число зарядов: 1", EN: "Magazine size = 1" },
                { RU: "Доп. урон: отсутствует", EN: "Additional combo damage: 0" }
            ],
            modifiers: { RELOAD: 0.75 }
        },
        "https://s.eu.tankionline.com/634/112242/54/34/31770755346510/image.svg": {
            name: { RU: "Разрывные снаряды", EN: "Explosive Shells" },
            advantages: [
                {
                    RU: "Добавлен сплеш-урон:",
                    EN: "Explosive Shells standard shots can deal damage to multiple targets:",
                    subItems: [
                        { RU: "Радиус полного поражения: 3 м (100%)", EN: "Radius of maximum area damage = 3 m" },
                        { RU: "Радиус среднего поражения: 6 м (50%)", EN: "Radius of the average area of damage = 6 m" },
                        { RU: "Радиус минимального поражения: 9 м (50%)", EN: "Radius of minimum area damage = 9 m" },
                        { RU: "Радиус критического сплеша: 3 м", EN: "Radius of critical area damage = 3 m" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Рикошет снарядов отключён", EN: "Projectiles can no longer ricochet" },
                { RU: "Добавлен самоурон на близком расстоянии", EN: "The blast radius damage can cause self-damage" }
            ]
        },
        "https://s.eu.tankionline.com/634/112244/77/41/31770755531642/image.svg": {
            name: { RU: "Снаряды с вольфрамовым сердечником", EN: "Tungsten Shells" },
            advantages: [
                { RU: "Максимальное число рикошетов: 2", EN: "Maximum number of ricochets = 2" },
                { RU: "Минимальный угол рикошета: 5°", EN: "Min ricochet angle: 5°" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ]
        },
        "https://s.eu.tankionline.com/634/112242/156/41/31770755601436/image.svg": {
            name: { RU: "Снаряды «Жара»", EN: "\"Heat\" Shells" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-red'>Горение</span> на вражеский танк",
                    EN: "Critically hit enemies are heated up by +0.4 and apply <span class='text-red'>Burning</span>",
                    subItems: [
                        { RU: "Прирост температуры: +0.4", EN: "Temperature increase: +0.4" },
                        { RU: "Время действия: 4 сек", EN: "Duration: 4 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical damage chance +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/634/112242/222/234/31770756111100/image.svg": {
            name: { RU: "Снаряды «Крио»", EN: "\"Cryo\" Shells" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-blue'>Заморозка</span> на вражеский танк",
                    EN: "Critically hit enemies are frozen by -1.0 and apply <span class='text-blue'>Freezing</span>",
                    subItems: [
                        { RU: "Снижение температуры: -1.0", EN: "Temperature reduction: -1.0" },
                        { RU: "Время действия: 10 сек", EN: "Duration: 10 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical damage chance +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/634/112243/103/56/31770756613244/image.svg": {
            name: { RU: "Снаряды «Сверло»", EN: "\"Drill\" Shells" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-purple'>Пробитие</span> на вражеский танк",
                    EN: "For critically hit enemies, the <span class='text-purple'>Armor-Piercing</span> status effect is activated",
                    subItems: [
                        { RU: "Время действия: 5 сек", EN: "Duration: 5 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical damage chance +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/634/112243/341/120/31770756707226/image.svg": {
            name: { RU: "Снаряды «Шок»", EN: "\"Shock\" Shells" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-yellow'>Оглушение</span> на вражеский танк",
                    EN: "When enemies are hit critically, the <span class='text-yellow'>Stun</span> status effect is activated",
                    subItems: [
                        { RU: "Время действия: 1 сек", EN: "Duration: 1 second" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical Hit Chance +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical Damage -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/634/112241/213/12/31770755656427/image.svg": {
            name: { RU: "Снаряды «Молния»", EN: "\"Lightning\" Shells" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span> на вражеский танк",
                    EN: "When enemies are hit critically, the <span class='text-green'>EMP</span> status effect is activated",
                    subItems: [
                        { RU: "Время действия: 2 сек", EN: "Duration: 2 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical Hit Chance +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical Damage -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/634/112244/3/272/31770756343255/image.svg": {
            name: { RU: "Снаряды «Шум»", EN: "\"Noise\" Shells" },
            advantages: [
                {
                    RU: "Попадание накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеский танк",
                    EN: "Applies the <span class='text-pink'>Jammer</span> status effect to hit enemies",
                    subItems: [
                        { RU: "Время действия: 4,5 сек", EN: "Duration: 4.5 seconds" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical Damage -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/634/112243/205/350/31770762402270/image.svg": {
            name: { RU: "Пульсар", EN: "Pulsar" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффекты:",
                    EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                    subItems: [
                        { RU: "<span class='text-pink'>Подавление</span>: 4,5 сек", EN: "<span class='text-pink'>Jammer</span>: 5 sec" },
                        { RU: "<span class='text-green'>Электромагнитный импульс</span>: 2 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 2 sec" },
                        { RU: "<span class='text-yellow'>Оглушение</span>: 1,5 сек", EN: "<span class='text-yellow'>Stun</span>: 1.5 sec" },
                        { RU: "<span class='text-purple'>Пробитие</span>: 5 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 9 sec" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Шанс критического урона: -27%", EN: "Critical chance: -8%" },
                { RU: "Критический урон: -90%", EN: "Critical damage: -90%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.1 }
        },
        "https://s.eu.tankionline.com/634/112237/40/362/31770757017104/image.svg": {
            name: { RU: "Кемпер", EN: "Camper" },
            advantages: [
                { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
            ],
            disadvantages: [
                { RU: "Бонус урона деактивируется при значении здоровья: ≤95%", EN: "Damage boost is active only while you have at least 95% of your maximum HP." },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
        },
        "https://s.eu.tankionline.com/634/112241/153/137/31770761101650/image.svg": {
            name: { RU: "Режим стрельбы «Дуплет»", EN: "Duplet" },
            advantages: [
                { RU: "Время между двумя выстрелами: -92%", EN: "Time between two shots: -92%" },
                { RU: "Отдача: -50%", EN: "Recoil: -50%" }
            ],
            disadvantages: [
                { RU: "Доп. урон: 0", EN: "Additional combo damage: 0" },
                { RU: "Перезарядка: +15%", EN: "Reload time: +15%" },
                { RU: "Сила удара снаряда: -25%", EN: "Impact force: -25%" }
            ],
            modifiers: { RELOAD: 1.15, IMPACT_FORCE: 0.75 }
        },
        "https://s.eu.tankionline.com/634/112243/16/24/31770761737654/image.svg": {
            name: { RU: "Мегацунами", EN: "Megatsunami" },
            advantages: [
                { RU: "Урон: +100%", EN: "Damage +100%" },
                { RU: "Доп. урон: +100%", EN: "Additional combo damage = +100%" },
                { RU: "Критический урон: +25%", EN: "Critical damage +25%" },
                {
                    RU: "Параметры сплеш-урона:",
                    EN: "Area damage parameters:",
                    subItems: [
                        { RU: "Радиус полного поражения: 3 м", EN: "Radius of max. area damage = 3 m" },
                        { RU: "Радиус среднего поражения: 6 м (50%)", EN: "Radius of the avg. area of damage = 6 m" },
                        { RU: "Радиус минимального поражения: 9 м (50%)", EN: "Radius of min. area damage = 9 m" },
                        { RU: "Радиус критического сплеша: 3 м", EN: "Radius of critical area damage = 3 m" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Перезарядка: +50%", EN: "Reload time +50%" },
                { RU: "Время между двумя выстрелами: +50%", EN: "Time between two shots +50%" },
                { RU: "Рикошет снарядов отключён", EN: "Shots do not ricochet." },
                { RU: "Добавлен самоурон от сплеша", EN: "Area damage can cause self-damage" }
            ],
            modifiers: { DAMAGE: 2.0, CRIT_DAMAGE: 1.25, RELOAD: 1.5 }
        },
        "URL_РЕЖИМ_ТРИПЛЕТ": {
            name: { RU: "Режим стрельбы «Триплет»", EN: "Triplet Firing Mode" },
            advantages: [
                { RU: "Число зарядов в магазине: 3", EN: "Magazine size: 3" },
                { RU: "Время между двумя выстрелами: -60%", EN: "Time between two shots: -60%" },
                { RU: "Отдача: -25%", EN: "Recoil: -25%" }
            ],
            disadvantages: [
                { RU: "Доп. урон: 0", EN: "Additional combo damage: 0" },
                { RU: "Перезарядка: +25%", EN: "Reload time: +25%" }
            ],
            modifiers: { RELOAD: 1.25 }
        },
        "https://s.eu.tankionline.com/634/112241/340/366/31622455332636/image.svg": {
            name: { RU: "Эксельсиор", EN: "Excelsior" },
            advantages: [
                { RU: "Урон: +25%", EN: "Damage: +25%" },
                { RU: "Дополнительный урон: +30%", EN: "Additional combo damage increase" },
                { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { DAMAGE: 1.25, TURNING_SPEED: 1.15 }
        },
        "https://s.eu.tankionline.com/605/115405/22/130/31771402454100/image.svg": {
            name: { RU: "Адреналин", EN: "Adrenaline" },
            advantages: [
                { RU: "Стандартный и критический урон пушки большой дальности: +25%", EN: "Regular and critical damage: +25%" }
            ],
            disadvantages: [
                { RU: "Бонус урона активируется только при значении здоровья: ≤20%", EN: "Damage bonus only activates when health is ≤20%" },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
        },
        "https://s.eu.tankionline.com/605/115405/27/5/31770734615030/image.svg": {
            name: { RU: "Разрывные снаряды", EN: "Explosive Shells" },
            advantages: [
                {
                    RU: "Добавлен сплеш-урон:",
                    EN: "Splash damage is added:",
                    subItems: [
                        { RU: "Минимальный радиус сплеша в аркадном режиме: 10 м", EN: "Arcade minimum splash damage radius: 10 m" },
                        { RU: "Средний радиус сплеша в аркадном режиме: 2 м", EN: "Arcade average splash damage radius: 2 m" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Скорость снаряда: -50%", EN: "Projectile speed: -50%" },
                { RU: "Рикошет снарядов отключён", EN: "Ricochet effect disabled" }
            ]
        },
        "https://s.eu.tankionline.com/605/115405/30/57/31770734702442/image.svg": {
            name: { RU: "Разрывные боеголовки", EN: "Explosive warheads" },
            advantages: [
                {
                    RU: "Увеличен радиус взрыва ракет:",
                    EN: "Explosion radius significantly increases:",
                    subItems: [
                        { RU: "Минимальный радиус сплеша ракет: 10 м", EN: "Rocket minimum splash damage radius: 10 m" },
                        { RU: "Средний радиус сплеша ракет: 3 м", EN: "Rocket average splash damage radius: 3 m" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ]
        },
        "https://s.eu.tankionline.com/605/115405/37/105/31770734762213/image.svg": {
            name: { RU: "Пусковая установка «Стая»", EN: "Missile launcher «Wolfpack»" },
            advantages: [
                { RU: "Максимальная скорость ракет: 50 м/с", EN: "Maximum rocket speed: = 50 m/s" },
                { RU: "Минимальная скорость ракеты: 20 м/с", EN: "Minimum rocket speed = 20 m/s" }
            ],
            disadvantages: [
                { RU: "Пауза между ракетами в залпе: +20%", EN: "Pause between salvo's rockets: +20%" }
            ]
        },
        "https://s.eu.tankionline.com/605/115405/24/252/31770735224121/image.svg": {
            name: { RU: "Замораживающие снаряды", EN: "Cryo Shells" },
            advantages: [
                {
                    RU: "Критическое попадание и попадание ракетами накладывают статус-эффект <span class='text-blue'>Заморозка</span>",
                    EN: "Critical hits and rocket hits in a 5 meter splash radius lower the temperature and apply <span class='text-blue'>Freezing</span>",
                    subItems: [
                        { RU: "Время действия: 10 сек", EN: "Duration: 10 seconds" },
                        { RU: "Радиус сплеша крит. урона: 5 м", EN: "Splash radius: 5 m" }
                    ]
                },
                { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/31/122/31770735046605/image.svg": {
            name: { RU: "Поджигающие снаряды", EN: "Incendiary shells" },
            advantages: [
                {
                    RU: "Критическое попадание и попадание ракетами накладывают статус-эффект <span class='text-red'>Горение</span>",
                    EN: "Critical hits and rocket hits in a 5 meter splash radius raise the temperature and apply <span class='text-red'>Burning</span>",
                    subItems: [
                        { RU: "Длительность (залп): 9 тиков", EN: "Salvo: 9 ticks of burn" },
                        { RU: "Длительность (аркада / ракета): 5 тиков", EN: "Arcade / single rocket: 5 ticks" },
                        { RU: "Радиус сплеша: 5 м", EN: "Splash radius: 5 m" }
                    ]
                },
                { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/25/341/31770735113661/image.svg": {
            name: { RU: "EMP-снаряды", EN: "EMP shells" },
            advantages: [
                {
                    RU: "Критическое попадание и попадание ракетами накладывают статус-эффект <span class='text-green'>Электромагнитный импульс</span>",
                    EN: "Critical hits and rocket hits apply <span class='text-green'>Electromagnetic Pulse</span>",
                    subItems: [
                        { RU: "Время действия (критический урон): 2 сек", EN: "Critical hits: 2 seconds" },
                        { RU: "Время действия (ракеты): 1 сек", EN: "Rocket hits (5m radius): 1 second" }
                    ]
                },
                { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/41/227/31770735453757/image.svg": {
            name: { RU: "Стан-снаряды", EN: "Stun shells" },
            advantages: [
                {
                    RU: "Критическое попадание и попадание ракетами накладывают статус-эффект <span class='text-yellow'>Оглушение</span>",
                    EN: "Critical hits and rocket hits apply <span class='text-yellow'>Stun</span>",
                    subItems: [
                        { RU: "Время действия (критический урон): 1,5 сек", EN: "Critical hits: 1.5 seconds" },
                        { RU: "Время действия (ракеты): 0,4 сек", EN: "Rocket hits (5m radius): 0.4 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/23/205/31770735364602/image.svg": {
            name: { RU: "Бронебойные снаряды", EN: "Armor-piercing shells" },
            advantages: [
                {
                    RU: "Критическое попадание и попадание ракетами накладывают статус-эффект <span class='text-purple'>Пробитие</span>",
                    EN: "Critical hits and rocket hits apply <span class='text-purple'>Armor-Piercing</span>",
                    subItems: [
                        { RU: "Время действия (критический урон): 10 сек", EN: "Critical hits: 10 seconds" },
                        { RU: "Время действия (ракеты): 1 сек", EN: "Rocket hits: 1 second" }
                    ]
                },
                { RU: "Шанс критического урона: +10%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/32/201/31770735321653/image.svg": {
            name: { RU: "Подавляющие снаряды", EN: "Jamming Shells" },
            advantages: [
                {
                    RU: "Попадания накладывают статус-эффект <span class='text-pink'>Подавление</span>",
                    EN: "Normal/critical and rocket hits apply <span class='text-pink'>Jammer</span>",
                    subItems: [
                        { RU: "Время действия (обычный/критический урон): 5 сек", EN: "Normal and critical hits: 5 seconds" },
                        { RU: "Время действия (ракеты, радиус 5 м): 1 сек", EN: "Rocket hits in a 5 meter radius: 1 second" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "URL_ПУЛЬСАР9": {
            name: { RU: "Пульсар", EN: "Pulsar" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффекты:",
                    EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                    subItems: [
                        { RU: "<span class='text-pink'>Подавление</span>: 5 сек", EN: "<span class='text-pink'>Jammer</span>: 5 sec" },
                        { RU: "<span class='text-green'>Электромагнитный импульс</span>: 2 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 2 sec" },
                        { RU: "<span class='text-yellow'>Оглушение</span>: 1,5 сек", EN: "<span class='text-yellow'>Stun</span>: 1.5 sec" },
                        { RU: "<span class='text-purple'>Пробитие</span>: 10 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 9 sec" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Шанс критического урона: -7%", EN: "Critical chance: -8%" },
                { RU: "Критический урон: -90%", EN: "Critical damage: -90%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.1 }
        },
        "https://s.eu.tankionline.com/625/153143/163/245/31770736115621/image.svg": {
            name: { RU: "Кемпер", EN: "Camper" },
            advantages: [
                { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
            ],
            disadvantages: [
                { RU: "Бонус урона деактивируется при значении здоровья: ≤95%", EN: "Damage boost is active only while you have at least 95% of your maximum HP." },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
        },
        "https://s.eu.tankionline.com/605/115405/36/26/31770735645262/image.svg": {
            name: { RU: "Пусковая установка «Торнадо»", EN: "Missile launcher «Tornado»" },
            advantages: [
                { RU: "Ракет в залпе: 20", EN: "Rockets in salvo: +10" },
                { RU: "Перезарядка залпа: -12%", EN: "Salvo reload time: -12%" },
                { RU: "Пауза между ракетами в залпе: -30%", EN: "Pause between salvo's rockets: -30%" },
                { RU: "Начальная скорость ракеты: 70 м/с", EN: "Initial rocket speed = 70 m/s" },
                { RU: "Время восстановления наведения: +30%", EN: "Aiming recovery time: +30%" },
                { RU: "Радиус сплеша ракет (промежуточный/предельный): 5 м / 10 м", EN: "Rocket min/avg splash radius: 10m / 5m" },
                { RU: "Конечная угловая скорость ракеты: 17 °/с", EN: "Final rocket angular speed = 17 °/s" }
            ],
            disadvantages: [
                { RU: "Время наведения: +50%", EN: "Aiming time: +50%" },
                { RU: "Начальная угловая скорость ракеты: 80 °/с", EN: "Initial rocket angular speed = 80 °/s" }
            ]
        },
        "https://s.eu.tankionline.com/605/115405/34/350/31770735575570/image.svg": {
            name: { RU: "Пусковая установка «Рой»", EN: "Missile launcher «Swarm»" },
            advantages: [
                { RU: "Ракет в залпе: 20", EN: "Rockets per salvo: +10" },
                { RU: "Время наведения: -50%", EN: "Aiming time: -50%" },
                { RU: "Перезарядка залпа: -50%", EN: "Salvo reload time: -50%" },
                { RU: "Пауза между ракетами в залпе: -30%", EN: "Pause between salvo's rockets: -30%" },
                { RU: "Максимальная угловая скорость ракеты: +400%", EN: "Final rocket angular speed: +400%" }
            ],
            disadvantages: [
                { RU: "Максимальная скорость ракеты: -20%", EN: "Final rocket speed: -20%" },
                { RU: "Начальная угловая скорость ракеты: -10%", EN: "Initial rocket angular speed: -10%" }
            ]
        },
        "https://s.eu.tankionline.com/605/115405/42/324/31770736001344/image.svg": {
            name: { RU: "Урановые снаряды", EN: "Uranium Shells" },
            advantages: [
                { RU: "Максимальное число рикошетов: 3", EN: "Max ricochet count: 3" },
                { RU: "Минимальный угол рикошета: 5°", EN: "Shell minimum ricochet angle: 5°" },
                { RU: "Радиус полного поражения: 12 м", EN: "Minimum area damage radius in normal mode = 12 meters" },
                { RU: "Радиус среднего поражения: 2 м", EN: "Radius of mean area damage in normal mode = 2 meters" },
                { RU: "Максимальный шанс крита: 100%", EN: "Maximum Critical Damage Chance = 100%" },
                { RU: "Начальный шанс крита: 100%", EN: "Initial Critical Damage Chance = 100%" },
                { RU: "Прирост шанса крита: +100%", EN: "Critical Damage Chance Increase: +100%" }
            ],
            disadvantages: [
                { RU: "Стартовый шанс критического урона: -100%", EN: "Minimum Critical Damage Chance: -100%" }
            ]
        },
        "https://s.eu.tankionline.com/605/115405/33/271/31770735527104/image.svg": {
            name: { RU: "Пусковая установка «Копьё»", EN: "Missile launcher «Spear»" },
            advantages: [
                { RU: "Перезарядка залпа: -20%", EN: "Salvo reload time: -20%" },
                { RU: "Время наведения: -50%", EN: "Aiming time: -50%" },
                { RU: "Минимальная скорость ракеты: 45 м/с", EN: "Initial rocket speed: 45 m/s" },
                { RU: "Максимальная скорость ракеты: 30 м/с", EN: "Maximum rocket speed: 30 m/s" },
                { RU: "Конечная угловая скорость ракеты: 120 °/с", EN: "Initial rocket max. angular velocity: 120 °/s" },
                { RU: "Длительность фазы ускорения ракеты: -50%", EN: "Rocket acceleration phase duration: -50%" }
            ],
            disadvantages: [
                { RU: "Ракет в залпе: 6", EN: "Rockets in salvo: -4" },
                { RU: "Пауза между ракетами в залпе: +30%", EN: "Pause between salvo's rockets: +30%" },
                { RU: "Время ускорения ракеты: -50%", EN: "Projectile acceleration time: -50%" },
                { RU: "Начальная угловая скорость ракеты: 30 °/с", EN: "Initial rocket min. angular velocity: 30 °/s" }
            ]
        },
        "https://s.eu.tankionline.com/634/63466/6/312/31770736053513/image.svg": {
            name: { RU: "Вакуумный снаряд", EN: "Vacuum shell" },
            advantages: [
                { RU: "Радиус сплеш-урона: 12 м", EN: "Splash damage radius: 12 meters" },
                { RU: "Средний радиус сплеш-урона: 9 м", EN: "Average Splash damage radius: 9 meters" },
                { RU: "Средний и минимальный сплеш-урон: 250%", EN: "Average and minimum splash damage: 250%" }
            ],
            disadvantages: [
                { RU: "Урон: -15%", EN: "Damage: -15%" }
            ],
            modifiers: { DAMAGE: 0.85 }
        },
        "https://s.eu.tankionline.com/626/15004/132/112/31303201111474/image.svg": {
            name: { RU: "Эксельсиор", EN: "Excelsior" },
            advantages: [
                { RU: "Урон: +25%", EN: "Damage: +25%" },
                { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                { RU: "Скорость ускорения поворота: +15%", EN: "Turning acceleration: +15%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { DAMAGE: 1.25, TURNING_SPEED: 1.15 }
        },
        "https://s.eu.tankionline.com/605/115404/322/317/31771402271740/image.svg": {
            name: { RU: "Адреналин", EN: "Adrenaline" },
            advantages: [
                { RU: "Стандартный и критический урон пушки большой дальности: +25%", EN: "Regular and critical damage: +25%" }
            ],
            disadvantages: [
                { RU: "Бонус урона активируется только при значении здоровья: ≤20%", EN: "Damage bonus only activates when health is ≤20%" },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
        },
        "https://s.eu.tankionline.com/605/115404/332/363/31770724151741/image.svg": {
            name: { RU: "Усиленный лафет", EN: "Reinforced gun carriage" },
            advantages: [
                { RU: "Тип управления: вертикальная наводка", EN: "Control mode: vertical aiming" },
                { RU: "Гравитация для снаряда: -50%", EN: "Elevation mechanism adjustment" }
            ],
            disadvantages: [
                { RU: "Горизонтальный поворот башни только поворотом корпуса", EN: "Horizontal rotation only by turning the hull" }
            ]
        },
        "https://s.eu.tankionline.com/605/115404/325/44/31770723761303/image.svg": {
            name: { RU: "Автоматизированный механизм загрузки пороха", EN: "Automated gunpowder loading mechanism" },
            advantages: [
                { RU: "Тип управления: вертикальная наводка", EN: "Control mode: vertical aiming" },
                { RU: "Время усиления: -15%", EN: "Amplification time: -15%" }
            ],
            disadvantages: [
                { RU: "Сложнее избежать перелёта или недолёта снаряда", EN: "Harder to avoid overshooting or undershooting" }
            ]
        },
        "https://s.eu.tankionline.com/546/137515/231/276/31770724065077/image.svg": {
            name: { RU: "Гарпун", EN: "Harpoon" },
            advantages: [
                { RU: "Фиксированный угол ствола: 1°", EN: "Turret elevation: 1º" },
                { RU: "Гравитация для снаряда: 1", EN: "Projectile gravitation: 1" },
                { RU: "Время усиления: -70%", EN: "Amplification time: -70%" },
                { RU: "Число шагов набора заряда: 10", EN: "Number of steps when charging = 10" },
                { RU: "Мин. и макс. скорость снаряда: +100% / +50%", EN: "Minimum/Maximum projectile speed increase" },
                { RU: "Сила удара снаряда и взрыва: +50%", EN: "Impact force: +50%" }
            ],
            disadvantages: [
                { RU: "Время перезарядки: +10%", EN: "Reload time: +10%" },
                { RU: "Критический урон наносится только при прямом попадании", EN: "Critical damage applies only on direct hits" },
                { RU: "Радиус сплеша и крит. урона: -60%", EN: "Splash and critical damage radiuses: -60%" },
                { RU: "Отдача: +50%", EN: "Recoil increase" }
            ],
            modifiers: { RELOAD: 1.1 }
        },
        "https://s.eu.tankionline.com/605/115404/330/255/31770724262074/image.svg": {
            name: { RU: "Поджигающий сердечник", EN: "Incendiary core" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-red'>Горение</span> на вражеские танки в радиусе 10 метров",
                    EN: "Critical hits (10m radius from explosion) raise the temperature of all damaged enemy tanks and apply <span class='text-red'>Burning</span>",
                    subItems: [
                        { RU: "Время действия: 10 сек", EN: "Duration: 10 seconds" },
                        { RU: "Прирост температуры: +1", EN: "Temperature increase: +1" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115404/326/126/31770724441303/image.svg": {
            name: { RU: "Криоснаряды", EN: "Freezing Core" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-blue'>Заморозка</span> на вражеские танки в радиусе 10 метров",
                    EN: "Critical hits apply the <span class='text-blue'>Freezing</span> status effect to all enemies within a 10 meter radius",
                    subItems: [
                        { RU: "Время действия: 8-10 сек", EN: "Duration: 10 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/611/44450/377/277/31770724362673/image.svg": {
            name: { RU: "Магнитный сердечник", EN: "Magnetic core" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span> на вражеские танки в радиусе 10 метров",
                    EN: "Critical hits (10m radius from explosion) apply the <span class='text-green'>Electromagnetic Pulse</span> status effect",
                    subItems: [
                        { RU: "Время действия: 3 сек", EN: "Duration: 3 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/616/4250/5/63/31770724665043/image.svg": {
            name: { RU: "Оглушающий сердечник", EN: "Stunning Core" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-yellow'>Оглушение</span> на вражеские танки в радиусе 10 метров",
                    EN: "Critical hits (10m radius from explosion) apply the <span class='text-yellow'>Stun</span> status effect",
                    subItems: [
                        { RU: "Время действия: 1,5 сек", EN: "Duration: 1.5 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115404/324/1/31770724616150/image.svg": {
            name: { RU: "Бронебойный сердечник", EN: "Armor-Piercing Core" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-purple'>Пробитие</span> на вражеские танки в радиусе 10 метров",
                    EN: "On a critical hit, applies the <span class='text-purple'>Armor-Piercing</span> status effect",
                    subItems: [
                        { RU: "Время действия: 9 сек", EN: "Duration: 9 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/613/123105/147/37/31770724520004/image.svg": {
            name: { RU: "Подавляющий сердечник", EN: "Jamming Core" },
            advantages: [
                {
                    RU: "Попадание накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеские танки в радиусе 10 метров",
                    EN: "Applies the <span class='text-pink'>Jammer</span> status effect to all enemies within a 10 meter radius",
                    subItems: [
                        { RU: "Время действия (обычный выстрел): 6 сек", EN: "Normal hit duration: 6 seconds" },
                        { RU: "Время действия (критический урон): 10 сек", EN: "Critical hit duration: 10 seconds" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "URL_ПУЛЬСАР10": {
            name: { RU: "Пульсар", EN: "Pulsar" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффекты:",
                    EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                    subItems: [
                        { RU: "<span class='text-pink'>Подавление</span>: 12 сек", EN: "<span class='text-pink'>Jammer</span>: 12 sec" },
                        { RU: "<span class='text-green'>Электромагнитный импульс</span>: 3 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 3 sec" },
                        { RU: "<span class='text-yellow'>Оглушение</span>: 1,5 сек", EN: "<span class='text-yellow'>Stun</span>: 1.5 sec" },
                        { RU: "<span class='text-purple'>Пробитие</span>: 9 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 9 sec" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Шанс критического урона: -7%", EN: "Critical chance: -8%" },
                { RU: "Критический урон: -90%", EN: "Critical damage: -90%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.1 }
        },
        "https://s.eu.tankionline.com/625/153142/357/251/31770725375555/image.svg": {
            name: { RU: "Кемпер", EN: "Camper" },
            advantages: [
                { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
            ],
            disadvantages: [
                { RU: "Бонус урона деактивируется при значении здоровья: ≤95%", EN: "Damage boost is active only while you have at least 95% of your maximum HP." },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
        },
        "https://s.eu.tankionline.com/605/115404/331/327/31770725211757/image.svg": {
            name: { RU: "Миномёт", EN: "Mortar" },
            advantages: [
                { RU: "Тип управления: вертикальная наводка", EN: "Control mode: vertical aiming" },
                { RU: "Установка мин в точке промаха (время жизни 120 сек)", EN: "Lay mines when a tank is not hit (mine lifetime 120 seconds)" }
            ],
            disadvantages: [
                { RU: "Радиус критического урона: -50%", EN: "Critical splash damage radius: -50%" }
            ]
        },
        "https://s.eu.tankionline.com/612/41746/164/263/31770725324705/image.svg": {
            name: { RU: "Вакуумный сердечник", EN: "Vacuum core" },
            advantages: [
                { RU: "Радиус среднего сплеша: 15 м", EN: "Radius of average splash damage: 15 m" },
                { RU: "Средний сплеш-урон: 250%", EN: "Average splash damage: 250%" }
            ],
            disadvantages: [
                { RU: "Урон: -45%", EN: "Damage: -45%" }
            ],
            modifiers: { DAMAGE: 0.55 }
        },
        "https://s.eu.tankionline.com/621/133301/74/107/31770724767107/image.svg": {
            name: { RU: "Бомбарда", EN: "Bombard" },
            advantages: [
                { RU: "Перезарядка: -45%", EN: "Reload time: -45%" },
                { RU: "Время усиления: -50%", EN: "Time to maximum charge level: -50%" }
            ],
            disadvantages: [
                { RU: "Минимальный и начальный угол ствола: 45°", EN: "Minimum angle of elevation: 45°" },
                { RU: "Мин. и макс. скорость снаряда: -40%", EN: "Max/Min projectile speed: -40%" },
                { RU: "Гравитация для снаряда: +50%", EN: "Projectile gravity: +50%" }
            ],
            modifiers: { RELOAD: 0.55 }
        },
        "https://s.eu.tankionline.com/622/165764/376/133/31770725136276/image.svg": {
            name: { RU: "Разрушитель", EN: "Destroyer" },
            advantages: [
                { RU: "Угол ствола фиксированный: 6°", EN: "Initial Turret Angle: 6" },
                { RU: "Урон: +120%", EN: "Damage: +120%" },
                { RU: "Критический урон: +150%", EN: "Critical Hit Damage: +150%" },
                { RU: "Сила удара снаряда и взрыва: +33%", EN: "Impact Force / Splash Damage Impact: +33%" },
                { RU: "Время усиления: -70%", EN: "Weapon Charging Time: -70%" },
                { RU: "Гравитация для снаряда: -50%", EN: "Shell Gravity Coefficient: -50%" }
            ],
            disadvantages: [
                { RU: "Скорость и ускорение поворота башни: -50%", EN: "Turret Rotation Speed/Acceleration: -50%" },
                { RU: "Мин. и макс. скорость снаряда: -30% / -50%", EN: "Minimum/Maximum Shell Speed reduction" },
                { RU: "Перезарядка: +90%", EN: "Weapon Reload Time: +90%" },
                { RU: "Отдача: +33%", EN: "Recoil force: +33%" },
                { RU: "Радиус сплеша: -55%", EN: "Splash Damage Radius: -55%" }
            ],
            modifiers: { DAMAGE: 2.2, CRIT_DAMAGE: 2.5, RELOAD: 1.9, TURNING_SPEED: 0.5 }
        },
        "https://s.eu.tankionline.com/633/20351/64/220/31770725101242/image.svg": {
            name: { RU: "Карронада", EN: "Carronade" },
            advantages: [
                { RU: "Перезарядка: -60%", EN: "Reload time: -60%" },
                { RU: "Время усиления: -60%", EN: "Time to maximum charge level: -60%" },
                { RU: "Отдача: -30%", EN: "Recoil: -30%" },
                { RU: "Скорость и ускорение поворота башни: +33%", EN: "Rotation speed/acceleration: +33%" },
                { RU: "Минимальная скорость снаряда: +50%", EN: "Minimum projectile speed: +50%" }
            ],
            disadvantages: [
                { RU: "Урон: -35%", EN: "Damage: -35%" },
                { RU: "Максимальная скорость снаряда: -9% (100 м/с)", EN: "Maximum projectile speed: -9%" }
            ],
            modifiers: { RELOAD: 0.4, DAMAGE: 0.65, TURNING_SPEED: 1.33 }
        },
        "https://s.eu.tankionline.com/626/15002/341/363/31303200612111/image.svg": {
            name: { RU: "Эксельсиор", EN: "Excelsior" },
            advantages: [
                { RU: "Урон: +25%", EN: "Damage: +25%" },
                { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { DAMAGE: 1.25, TURNING_SPEED: 1.15 }
        },
        "https://s.eu.tankionline.com/605/115404/363/257/31771402336676/image.svg": {
            name: { RU: "Адреналин", EN: "Adrenaline" },
            advantages: [
                { RU: "Стандартный и критический урон пушки большой дальности: +25%", EN: "Regular and critical damage: +25%" }
            ],
            disadvantages: [
                { RU: "Бонус урона активируется только при значении здоровья: ≤20%", EN: "Damage bonus only activates when health is ≤20%" },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
        },
        "https://s.eu.tankionline.com/605/137574/56/244/31770727266522/image.svg": {
            name: { RU: "Стабилизация снаряда", EN: "Round stabilization" },
            advantages: [
                { RU: "Процент урона после прострела: 100%", EN: "Penetration: 100%" },
                { RU: "Урон от расстояния не снижается", EN: "Damage is not distance-dependent" }
            ],
            disadvantages: [
                { RU: "Урон: -5%", EN: "Regular damage: -5%" },
                { RU: "Критический урон: -24%", EN: "Critical damage: -24%" }
            ],
            modifiers: { DAMAGE: 0.95, CRIT_DAMAGE: 0.76 }
        },
        "https://s.eu.tankionline.com/605/137574/53/256/31770727132303/image.svg": {
            name: { RU: "Усиленные приводы наводки", EN: "Reinforced aiming transmission" },
            advantages: [
                { RU: "Скорость поворота башни: +50%", EN: "Turret rotation speed: +50%" },
                { RU: "Ускорение поворота башни: +50%", EN: "Turret rotatory acceleration: +50%" },
                { RU: "Автоприцел угол вверх и вниз: +50%", EN: "Vertical auto-aim: +50%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { TURNING_SPEED: 1.5 }
        },
        "https://s.eu.tankionline.com/605/115404/377/146/31770727203236/image.svg": {
            name: { RU: "Электромагнитный ускоритель «Скаут»", EN: "Electromagnetic accelerator «Scout»" },
            advantages: [
                { RU: "Перезарядка: -15%", EN: "Reload time: -15%" },
                { RU: "Разогрев выстрела: -15%", EN: "Shot warmup time: -15%" }
            ],
            disadvantages: [
                { RU: "Урон: -15%", EN: "Regular damage: -15%" },
                { RU: "Критический урон: -15%", EN: "Critical damage: -15%" }
            ],
            modifiers: { RELOAD: 0.85, DAMAGE: 0.85, CRIT_DAMAGE: 0.85 }
        },
        "https://s.eu.tankionline.com/605/115404/364/322/31770727472472/image.svg": {
            name: { RU: "Криоснаряды", EN: "Cryo Rounds" },
            advantages: [
                {
                    RU: "Попадание обычным и критическим выстрелом накладывает статус-эффект <span class='text-blue'>Заморозка</span>",
                    EN: "Hitting an enemy lowers their temperature and applies <span class='text-blue'>Freezing</span>",
                    subItems: [
                        { RU: "Время действия (обычный выстрел): 4 сек", EN: "Normal hit: -0.40 temperature" },
                        { RU: "Время действия (критический урон): 10 сек", EN: "Critical hit: -1.00 temperature" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115404/373/360/31770727352052/image.svg": {
            name: { RU: "Поджигающие снаряды", EN: "Incendiary Rounds" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-red'>Горение</span> на вражеский танк",
                    EN: "Critically hitting an enemy raises temperature by +0.40 and applies <span class='text-red'>Burning</span> (max 2 tanks)",
                    subItems: [
                        { RU: "Время действия: 4 сек", EN: "Duration: 4 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115404/367/60/31770727420710/image.svg": {
            name: { RU: "ЭМИ-снаряды", EN: "EMP Rounds" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-green'>Электромагнитный импульс</span>",
                    EN: "Critically hitting an enemy applies the <span class='text-green'>Electromagnetic Pulse</span> status effect",
                    subItems: [
                        { RU: "Время действия: 2 сек", EN: "Duration: 2 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/1/317/31770727676401/image.svg": {
            name: { RU: "Оглушающие снаряды", EN: "Stun Rounds" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-yellow'>Оглушение</span>",
                    EN: "Critically hitting an enemy applies the <span class='text-yellow'>Stun</span> status effect",
                    subItems: [
                        { RU: "Время действия: 1 сек", EN: "Duration: 1 second" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115404/375/32/31770727623103/image.svg": {
            name: { RU: "Суперпробивающие снаряды", EN: "Super Armor-Piercing Rounds" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффект <span class='text-purple'>Пробитие</span> (работает при простреле нескольких целей)",
                    EN: "Critically hitting an enemy will apply the <span class='text-purple'>Armor-Piercing</span> status effect to all pierced targets",
                    subItems: [
                        { RU: "Время действия: 5 сек", EN: "Duration: 5 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +8%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115537/27/314/31770727553130/image.svg": {
            name: { RU: "Подавляющие снаряды", EN: "Jamming Shells" },
            advantages: [
                {
                    RU: "Попадание накладывает статус-эффект <span class='text-pink'>Подавление</span>",
                    EN: "Hitting an enemy applies the <span class='text-pink'>Jammer</span> status effect",
                    subItems: [
                        { RU: "Время действия: 9 сек", EN: "Duration: 9 seconds" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "URL_ПУЛЬСАР11": {
            name: { RU: "Пульсар", EN: "Pulsar" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффекты:",
                    EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                    subItems: [
                        { RU: "<span class='text-pink'>Подавление</span>: 9 сек", EN: "<span class='text-pink'>Jammer</span>: 9 sec" },
                        { RU: "<span class='text-green'>Электромагнитный импульс</span>: 2 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 2 sec" },
                        { RU: "<span class='text-yellow'>Оглушение</span>: 1 сек", EN: "<span class='text-yellow'>Stun</span>: 1 sec" },
                        { RU: "<span class='text-purple'>Пробитие</span>: 5 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 5 sec" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Шанс критического урона: -7%", EN: "Critical chance: -8%" },
                { RU: "Критический урон: -90%", EN: "Critical damage: -90%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.1 }
        },
        "https://s.eu.tankionline.com/625/153143/35/151/31770730545515/image.svg": {
            name: { RU: "Кемпер", EN: "Camper" },
            advantages: [
                { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
            ],
            disadvantages: [
                { RU: "Бонус урона деактивируется при значении здоровья: ≤95%", EN: "Damage boost is active only while you have at least 95% of your maximum HP." },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
        },
        "https://s.eu.tankionline.com/605/137574/55/32/31770730155004/image.svg": {
            name: { RU: "Крупнокалиберные снаряды", EN: "Large caliber rounds" },
            advantages: [
                { RU: "Урон: +50%", EN: "Regular damage: +50%" },
                { RU: "Критический урон: +20%", EN: "Critical damage: +20%" },
                { RU: "Шанс критического урона: +37%", EN: "Critical Hit Chance: +50% (RU: +37%)" }
            ],
            disadvantages: [
                { RU: "Перезарядка: +16%", EN: "Reload time: +16%" },
                { RU: "Разогрев выстрела: +15%", EN: "Shot warmup time: +15%" }
            ],
            modifiers: { DAMAGE: 1.5, CRIT_DAMAGE: 1.2, RELOAD: 1.16 }
        },
        "https://s.eu.tankionline.com/605/115404/376/102/31770730423373/image.svg": {
            name: { RU: "Дестабилизация снаряда", EN: "Round destabilization" },
            advantages: [
                { RU: "Критический урон: +20%", EN: "Critical damage: +20%" },
                { RU: "Шанс критического урона: 50%", EN: "Fixed critical chance: 50%" },
                { RU: "Сила удара: +60%", EN: "Impact force: +60%" }
            ],
            disadvantages: [
                { RU: "Урон: -25%", EN: "Regular damage: -25%" }
            ],
            modifiers: { CRIT_DAMAGE: 1.2, IMPACT_FORCE: 1.6, DAMAGE: 0.75 }
        },
        "https://s.eu.tankionline.com/605/115404/366/0/31770727757202/image.svg": {
            name: { RU: "Компульсатор «Вестник смерти»", EN: "«Death Herald» compulsator" },
            advantages: [
                { RU: "Уничтожение противника мгновенно перезаряжает пушку", EN: "Destroying an enemy fully reloads the turret" },
                { RU: "Перезарядка: -40%", EN: "Reload time: -40%" },
                { RU: "Разогрев выстрела: -25%", EN: "Shot warmup time: -25%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { RELOAD: 0.6 }
        },
        "https://s.eu.tankionline.com/605/115404/372/302/31770730224632/image.svg": {
            name: { RU: "Гиперпространственные снаряды", EN: "Hyperspace rounds" },
            advantages: [
                { RU: "Процент урона после прострела: +200%", EN: "Penetration: +200%" },
                { RU: "Разогрев выстрела: -25%", EN: "Shot warmup time: -25%" }
            ],
            disadvantages: [
                { RU: "Сила удара: -100%", EN: "Impact force removed" },
                { RU: "Критический урон отключен", EN: "Critical hits disabled" }
            ],
            modifiers: { IMPACT_FORCE: 0, CRIT_DAMAGE: 0 }
        },
        "https://s.eu.tankionline.com/606/25171/245/307/31770730303124/image.svg": {
            name: { RU: "Гиперскоростные снаряды", EN: "Hyperspeed shells" },
            advantages: [
                { RU: "Процент слабого поражения: 300%", EN: "Weak damage: 300%" },
                { RU: "Дальность слабого поражения: -60%", EN: "Range of minimum damage: -60%" },
                { RU: "Дальность полного поражения: -70%", EN: "Range of maximum damage: -70%" },
                { RU: "Дальность подсветки противника: +100%", EN: "Highlighting range: +100%" }
            ],
            disadvantages: [
                { RU: "Урон: -50%", EN: "Regular damage: -50%" }
            ],
            modifiers: { DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/614/1144/200/261/31770730464352/image.svg": {
            name: { RU: "Снаряды «Дробовик»", EN: "«Shotgun» rounds" },
            advantages: [
                { RU: "Урон: +50%", EN: "Normal damage: +50%" },
                { RU: "Перезарядка: -10%", EN: "Reload time: -10%" }
            ],
            disadvantages: [
                { RU: "Дальность полного поражения: -80%", EN: "Range of maximum damage: -80%" },
                { RU: "Дальность слабого поражения: -50%", EN: "Range of minimum damage: -50%" },
                { RU: "Процент слабого поражения: 25%", EN: "Weak damage = 25%" }
            ],
            modifiers: { DAMAGE: 1.5, RELOAD: 0.9 }
        },
        "https://s.eu.tankionline.com/627/142531/56/121/31770730077111/image.svg": {
            name: { RU: "Снаряды «Экскалибур»", EN: "Excalibur rounds" },
            advantages: [
                { RU: "Критический урон: +129.9%", EN: "Critical damage: +129.9%" },
                { RU: "Максимальный шанс критического выстрела: 99%", EN: "Maximum chance of critical damage: 99%" },
                { RU: "Прирост шанса критического выстрела: +45%", EN: "Increased chance of critical damage: +45%" },
                { RU: "Минимальный шанс критического выстрела: 5%", EN: "Minimum chance of critical damage: 5%" }
            ],
            disadvantages: [
                { RU: "Перезарядка: +17%", EN: "Reload time: +17%" },
                { RU: "Разогрев выстрела: +25%", EN: "Shot warmup time: +25%" },
                { RU: "Начальный шанс критического выстрела: 5%", EN: "Initial chance of critical damage: 5%" }
            ],
            modifiers: { CRIT_DAMAGE: 2.3, RELOAD: 1.17 }
        },
        "https://s.eu.tankionline.com/633/10556/24/206/31770730034472/image.svg": {
            name: { RU: "Детонатор", EN: "Detonator" },
            advantages: [
                { RU: "Урон комбинированного выстрела (по гранате): +100%", EN: "Damage (Combo Shot with grenade): +100%" },
                { RU: "Разогрев перед выстрелом: 0,5 сек", EN: "Shot warmup time: 0.5s" },
                { RU: "Радиус макс. и сред. сплеша гранаты: +100%", EN: "Max/Avg area damage radius of the grenade: +100%" },
                { RU: "Радиус мин. сплеша гранаты: +30%", EN: "Min. area damage radius of the grenade: +30%" },
                { RU: "Ускорение поворота башни: +100%", EN: "Rotational acceleration: +100%" }
            ],
            disadvantages: [
                { RU: "Требуется попадание по собственной гранате", EN: "Requires hitting own grenade" }
            ]
        },
        "https://s.eu.tankionline.com/626/15003/117/47/31303200712152/image.svg": {
            name: { RU: "Эксельсиор", EN: "Excelsior" },
            advantages: [
                { RU: "Урон: +25%", EN: "Damage: +25%" },
                { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { DAMAGE: 1.25, TURNING_SPEED: 1.15 }
        },
        "https://s.eu.tankionline.com/605/115404/226/374/31771402064201/image.svg": {
            name: { RU: "Адреналин", EN: "Adrenaline" },
            advantages: [
                { RU: "Стандартный и критический урон пушки большой дальности: +25%", EN: "Regular and critical damage: +25%" }
            ],
            disadvantages: [
                { RU: "Бонус урона активируется только при значении здоровья: ≤20%", EN: "Damage bonus only activates when health is ≤20%" },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
        },
        "https://s.eu.tankionline.com/611/67026/233/112/31770705760344/image.svg": {
            name: { RU: "Улучшенное горизонтальное сопровождение", EN: "Faster Horizontal Tracking" },
            advantages: [
                { RU: "Скорость и ускорение поворота башни: +100%", EN: "Turret rotation speed and acceleration: +100%" },
                { RU: "Автоприцел угол вверх и вниз: +50%", EN: "Vertical auto-aim: +50%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { TURNING_SPEED: 2.0 }
        },
        "https://s.eu.tankionline.com/611/67027/21/56/31770706032426/image.svg": {
            name: { RU: "Взломанный процессор наведения", EN: "Hacked Aiming Processor" },
            advantages: [
                { RU: "Время восстановления наведения: 10 сек", EN: "Aiming recovery time: +400%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ]
        },
        "https://s.eu.tankionline.com/611/67030/36/256/31770706161602/image.svg": {
            name: { RU: "Крупный калибр", EN: "Large Caliber" },
            advantages: [
                { RU: "Урон стандартного выстрела: +27%", EN: "Arcade normal damage: +27%" },
                { RU: "Критический урон: +29%", EN: "Critical damage: +29%" }
            ],
            disadvantages: [
                { RU: "Перезарядка стандартного выстрела: +54%", EN: "Arcade reload time: +54%" }
            ],
            modifiers: { DAMAGE: 1.27, CRIT_DAMAGE: 1.29, RELOAD: 1.54 }
        },
        "https://s.eu.tankionline.com/611/66627/105/110/31770706237122/image.svg": {
            name: { RU: "Поджигающий залп", EN: "Incendiary Salvo" },
            advantages: [
                {
                    RU: "Критический урон и прицельный выстрел накладывают статус-эффект <span class='text-red'>Горение</span> на вражеский танк",
                    EN: "Sniping/critically hitting an enemy raises temperature by +0.40 and applies <span class='text-red'>Burning</span>",
                    subItems: [
                        { RU: "Время действия (критический урон): 4 сек", EN: "Critical hit duration: 4 sec" },
                        { RU: "Время действия (прицельный выстрел): 4 сек", EN: "Sniping shot duration: 4 sec" },
                        { RU: "Радиус эффекта прицельного залпа: 15 м", EN: "Area radius (15 meters)" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/611/66630/64/264/31770706363322/image.svg": {
            name: { RU: "Криозалп", EN: "Freezing Salvo" },
            advantages: [
                {
                    RU: "Критический урон и прицельный выстрел накладывают статус-эффект <span class='text-blue'>Заморозка</span> на вражеский танк",
                    EN: "Sniping/critically hitting lowers temperature by -1.0 and applies <span class='text-blue'>Freezing</span>",
                    subItems: [
                        { RU: "Время действия (критический урон): 10 сек", EN: "Critical hit duration: 10 sec" },
                        { RU: "Время действия (прицельный выстрел): 10 сек", EN: "Sniping shot duration: 10 sec" },
                        { RU: "Радиус эффекта прицельного залпа: 15 м", EN: "Area radius (15 meters)" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115404/231/123/31770706313356/image.svg": {
            name: { RU: "Электромагнитный залп", EN: "Electromagnetic salvo" },
            advantages: [
                {
                    RU: "Критический урон и прицельный выстрел накладывают статус-эффект <span class='text-green'>Электромагнитный импульс</span>",
                    EN: "Sniping/critically hitting applies the <span class='text-green'>Electromagnetic Pulse</span> status effect",
                    subItems: [
                        { RU: "Время действия (критический урон): 2 сек", EN: "Critical hit duration: 2 sec" },
                        { RU: "Время действия (прицельный выстрел): 3 сек", EN: "Sniping shot duration: 3 sec" },
                        { RU: "Радиус поражения: 15 м", EN: "Area radius: 15 meters" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/607/131160/264/374/31770706563445/image.svg": {
            name: { RU: "Оглушающий залп", EN: "Stunning Salvo" },
            advantages: [
                {
                    RU: "Критический урон и прицельный выстрел накладывают статус-эффект <span class='text-yellow'>Оглушение</span>",
                    EN: "Sniping/critically hitting applies the <span class='text-yellow'>Stun</span> status effect",
                    subItems: [
                        { RU: "Время действия (критический урон): 1 сек", EN: "Critical hit duration: 1 sec" },
                        { RU: "Время действия (прицельный выстрел): 1,5 сек", EN: "Sniping shot duration: 1.5 sec" },
                        { RU: "Радиус поражения: 15 м", EN: "Area radius: 15 meters" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115404/230/55/31770706521011/image.svg": {
            name: { RU: "Бронебойный залп", EN: "Armor-Piercing Salvo" },
            advantages: [
                {
                    RU: "Критический урон и прицельный выстрел накладывают статус-эффект <span class='text-purple'>Пробитие</span>",
                    EN: "Sniping/critically hitting applies the <span class='text-purple'>Armor-Piercing</span> status effect",
                    subItems: [
                        { RU: "Время действия (критический урон): 5 сек", EN: "Critical hit duration: 5 sec" },
                        { RU: "Время действия (прицельный выстрел): 9 сек", EN: "Sniping shot duration: 9 sec" },
                        { RU: "Радиус поражения: 15 м", EN: "Area radius: 15 meters" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/611/67027/312/216/31770706445402/image.svg": {
            name: { RU: "Подавляющий залп", EN: "Jamming Salvo" },
            advantages: [
                {
                    RU: "Любой урон накладывает статус-эффект <span class='text-pink'>Подавление</span>",
                    EN: "Any hit applies the <span class='text-pink'>Jammer</span> status effect",
                    subItems: [
                        { RU: "Время действия (обычный урон): 3 сек", EN: "Normal hit: 3 sec" },
                        { RU: "Время действия (критический урон): 9 сек", EN: "Critical hit: 9 sec" },
                        { RU: "Время действия (прицельный выстрел): 12 сек", EN: "Sniping shot: 12 sec" },
                        { RU: "Радиус поражения: 15 м", EN: "Area radius: 15 meters" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/606/113532/321/357/31771404320730/image.svg": {
            name: { RU: "Пульсар", EN: "Pulsar" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффекты:",
                    EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                    subItems: [
                        { RU: "<span class='text-pink'>Подавление</span>: 9 сек", EN: "<span class='text-pink'>Jammer</span>: 9 sec" },
                        { RU: "<span class='text-green'>Электромагнитный импульс</span>: 1 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 1 sec" },
                        { RU: "<span class='text-yellow'>Оглушение</span>: 0,4 сек", EN: "<span class='text-yellow'>Stun</span>: 0.4 sec" },
                        { RU: "<span class='text-purple'>Пробитие</span>: 5 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 5 sec" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Шанс критического урона: -11%", EN: "Critical chance: -12%" },
                { RU: "Критический урон: -90%", EN: "Critical damage: -90%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.1 }
        },
        "https://s.eu.tankionline.com/625/153142/155/344/31770706700310/image.svg": {
            name: { RU: "Кемпер", EN: "Camper" },
            advantages: [
                { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
            ],
            disadvantages: [
                { RU: "Бонус урона деактивируется при значении здоровья: ≤95%", EN: "Damage boost is active only while you have at least 95% of your maximum HP." },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
        },
        "https://s.eu.tankionline.com/606/113476/60/105/31771404470272/image.svg": {
            name: { RU: "Суперсоленоиды", EN: "Super Solenoids" },
            advantages: [
                { RU: "Урон прицельного выстрела: +50%", EN: "Salvo damage: +50%" },
                { RU: "Перезарядка прицельного выстрела: -36%", EN: "Salvo reload: -36%" }
            ],
            disadvantages: [
                { RU: "Радиус сплеш-урона (макс/сред/мин): -90%", EN: "Splash damage radius (max/avg/min): -90%" }
            ],
            modifiers: { SNIPING_DAMAGE: 1.5 }
        },
        "https://s.eu.tankionline.com/611/67027/162/134/31771404150746/image.svg": {
            name: { RU: "Гиперскоростные снаряды", EN: "Hyperspeed Shells" },
            advantages: [
                { RU: "Скорость снаряда: +100%", EN: "Projectile speed: +100%" },
                { RU: "Процент слабого поражения: 300%", EN: "Weak damage percentage = 300%" },
                { RU: "Дальность полного/слабого поражения: -50% / -25%", EN: "Range of max/min damage reduction" }
            ],
            disadvantages: [
                { RU: "Урон стандартного выстрела: -50%", EN: "Normal damage: -50%" },
                { RU: "Критический урон отключен", EN: "Critical hit removed" },
                { RU: "Автоприцел угол по горизонтали: ±0,2°", EN: "Horizontal auto-aim angle: ±0.2°" }
            ],
            modifiers: { DAMAGE: 0.5, CRIT_DAMAGE: 0 }
        },
        "https://s.eu.tankionline.com/611/67030/210/164/31771404376342/image.svg": {
            name: { RU: "Охлаждение соленоидов", EN: "Solenoid Cooling" },
            advantages: [
                { RU: "Перезарядка прицельного выстрела: -50%", EN: "Salvo reload: -50%" },
                { RU: "Наведение: -50%", EN: "Aiming time: -50%" }
            ],
            disadvantages: [
                { RU: "Урон прицельного выстрела: -20%", EN: "Salvo damage: -20%" }
            ],
            modifiers: { SNIPING_DAMAGE: 0.8 }
        },
        "https://s.eu.tankionline.com/623/44244/2/213/31771404241071/image.svg": {
            name: { RU: "Немезида", EN: "Nemesis" },
            advantages: [
                { RU: "Урон прицельного выстрела: +140%", EN: "Salvo damage: +140%" },
                { RU: "Время восстановления наведения: 10 сек", EN: "Aiming recovery time: +400%" },
                { RU: "Перезарядка прицельного выстрела: -70%", EN: "Salvo reload: -70%" }
            ],
            disadvantages: [
                { RU: "Время наведения: +120%", EN: "Aiming time: +120%" },
                { RU: "Отдача прицельного выстрела: +150%", EN: "Recoil: +150%" }
            ],
            modifiers: { SNIPING_DAMAGE: 2.4 }
        },
        "https://s.eu.tankionline.com/632/120275/211/15/31771404077132/image.svg": {
            name: { RU: "Боксёр", EN: "Boxer" },
            advantages: [
                { RU: "Урон стандартного выстрела: +27%", EN: "Arcade Shot damage: +27%" },
                { RU: "Критический урон: +29%", EN: "Arcade Critical Shot damage: +29%" },
                { RU: "Перезарядка прицельного выстрела: -30%", EN: "Salvo reload: -30%" },
                { RU: "Наведение: -10%", EN: "Aiming time: -10%" },
                { RU: "Сила удара прицельного выстрела: +200%", EN: "Salvo impact force: +200%" },
                { RU: "Сила удара: +50%", EN: "Arcade impact force: +50%" }
            ],
            disadvantages: [
                { RU: "Перезарядка стандартного выстрела: +15%", EN: "Reload time in Arcade mode: +15%" }
            ],
            modifiers: { DAMAGE: 1.27, CRIT_DAMAGE: 1.29, RELOAD: 1.15, IMPACT_FORCE: 1.5 }
        },
        "https://s.eu.tankionline.com/626/15000/104/132/31303200102114/image.svg": {
            name: { RU: "Эксельсиор", EN: "Excelsior" },
            advantages: [
                { RU: "Урон стандартного выстрела: +25%", EN: "Arcade Shot Damage: +25%" },
                { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { DAMAGE: 1.25, TURNING_SPEED: 1.15 }
        },
        "https://s.eu.tankionline.com/605/115405/43/367/31771402525043/image.svg": {
            name: { RU: "Адреналин", EN: "Adrenaline" },
            advantages: [
                { RU: "Стандартный и критический урон пушки большой дальности: +25%", EN: "Regular and critical damage: +25%" }
            ],
            disadvantages: [
                { RU: "Бонус урона активируется только при значении здоровья: ≤20%", EN: "Damage bonus only activates when health is ≤20%" },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DAMAGE: 1.25, CRIT_DAMAGE: 1.25 }
        },
        "https://s.eu.tankionline.com/605/137574/124/170/31770737107437/image.svg": {
            name: { RU: "Короткополосный эмиттер", EN: "Short-band emitter" },
            advantages: [
                { RU: "Урон навскидку: +30%", EN: "Arcade damage: +30%" },
                { RU: "Урон критического выстрела навскидку: +29%", EN: "Arcade critical damage: +29%" },
                { RU: "Минимальный прицельный урон: +30%", EN: "Minimum sniping damage: +30%" }
            ],
            disadvantages: [
                { RU: "Время перезарядки между выстрелами навскидку: +15%", EN: "Arcade reload: +15%" }
            ],
            modifiers: { ARCADE_DAMAGE: 1.3, CRIT_DAMAGE: 1.29 }
        },
        "https://s.eu.tankionline.com/605/137574/122/354/31770736731242/image.svg": {
            name: { RU: "Тяжёлые конденсаторы", EN: "Heavy capacitors" },
            advantages: [
                { RU: "Максимальный прицельный урон: +25%", EN: "Maximum sniping damage: +25%" }
            ],
            disadvantages: [
                { RU: "Скорость заряда в прицельном режиме: -25%", EN: "Charge rate in aiming mode: -25%" },
                { RU: "Энергия на прицельный выстрел: +100%", EN: "Energy consumed by sniping shot: +100%" },
                { RU: "Скорость восстановления после прицельного выстрела: -20%", EN: "Recharge rate after sniping shot: -20%" }
            ],
            modifiers: { SNIPING_DAMAGE: 1.25, CHARGE_RATE: 0.8 }
        },
        "https://s.eu.tankionline.com/605/115405/47/222/31770737017704/image.svg": {
            name: { RU: "Лёгкие конденсаторы", EN: "Light capacitors" },
            advantages: [
                { RU: "Скорость заряда в прицельном режиме: +50%", EN: "Charge rate in aiming mode: +50%" },
                { RU: "Скорость восстановления после прицельного выстрела: +20%", EN: "Recharge rate after sniping shot: +20%" },
                { RU: "Энергия на прицельный выстрел: -50%", EN: "Energy consumed by sniping shot: -50%" },
                { RU: "Скорость прицеливания по горизонтали: +100%", EN: "Horizontal aiming speed: +100%" }
            ],
            disadvantages: [
                { RU: "Максимальный прицельный урон: -25%", EN: "Maximum sniping damage: -25%" }
            ],
            modifiers: { CHARGE_RATE: 1.2, SNIPING_DAMAGE: 0.75 }
        },
        "https://s.eu.tankionline.com/607/65044/323/337/31770737157450/image.svg": {
            name: { RU: "Поджигающая фокусировка", EN: "Incendiary Sight" },
            advantages: [
                {
                    RU: "Критический урон и прицельный выстрел накладывают статус-эффект <span class='text-red'>Горение</span> на вражеский танк",
                    EN: "Critically hitting or sniping an enemy raises their temperature by +0.4 and applies <span class='text-red'>Burning</span>",
                    subItems: [
                        { RU: "Время действия (прицельный / крит): 5 сек", EN: "Duration: up to 5 sec" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/621/45765/150/23/31770737303451/image.svg": {
            name: { RU: "Замораживающая фокусировка", EN: "Freezing Sight" },
            advantages: [
                {
                    RU: "Критический урон и прицельный выстрел накладывают статус-эффект <span class='text-blue'>Заморозка</span> на вражеский танк",
                    EN: "Sniping or hitting an enemy with a critical arcade shot applies <span class='text-blue'>Freezing</span>",
                    subItems: [
                        { RU: "Время действия: 10 сек", EN: "Duration: 10 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/620/44540/243/134/31770737240573/image.svg": {
            name: { RU: "Электризующая фокусировка", EN: "Electrifying Sight" },
            advantages: [
                {
                    RU: "Критический урон и прицельный выстрел накладывают статус-эффект <span class='text-green'>Электромагнитный импульс</span>",
                    EN: "Sniping or hitting an enemy with a critical arcade shot applies <span class='text-green'>Electromagnetic Pulse</span>",
                    subItems: [
                        { RU: "Время действия (прицельный): 3 сек", EN: "Sniping duration: 3 seconds" },
                        { RU: "Время действия (критический): 2 сек", EN: "Critical hit duration: 2 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/612/5273/330/266/31770737463446/image.svg": {
            name: { RU: "Оглушающая фокусировка", EN: "Stunning Sight" },
            advantages: [
                {
                    RU: "Критический урон и прицельный выстрел накладывают статус-эффект <span class='text-yellow'>Оглушение</span>",
                    EN: "Sniping or hitting an enemy with a critical arcade shot applies the <span class='text-yellow'>Stun</span> effect",
                    subItems: [
                        { RU: "Время действия (прицельный): 1,5 сек", EN: "Sniping duration: 1.5 seconds" },
                        { RU: "Время действия (критический): 1 сек", EN: "Critical hit duration: 1 second" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/605/115405/50/303/31770737420124/image.svg": {
            name: { RU: "Бронебойная фокусировка", EN: "Armor-Piercing Sight" },
            advantages: [
                {
                    RU: "Критический урон и прицельный выстрел накладывают статус-эффект <span class='text-purple'>Пробитие</span>",
                    EN: "Sniping or hitting with critical arcade shots applies the <span class='text-purple'>Armor-Piercing</span> effect",
                    subItems: [
                        { RU: "Время действия (прицельный): 9 сек", EN: "Sniping duration: 9 seconds" },
                        { RU: "Время действия (критический): 5 сек", EN: "Critical hit duration: 5 seconds" }
                    ]
                },
                { RU: "Шанс критического урона: +9%", EN: "Critical hit chance: +10%" }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "https://s.eu.tankionline.com/617/163550/12/157/31770737356413/image.svg": {
            name: { RU: "Подавляющая фокусировка", EN: "Jamming Sight" },
            advantages: [
                {
                    RU: "Любой урон накладывает статус-эффект <span class='text-pink'>Подавление</span> на вражеский танк",
                    EN: "Applies the <span class='text-pink'>Jammer</span> status effect to the target",
                    subItems: [
                        { RU: "Время действия (обычный выстрел): 3 сек", EN: "Arcade hit duration: 3 seconds" },
                        { RU: "Время действия (критический урон): 9 сек", EN: "Critical hit duration: 9 seconds" },
                        { RU: "Время действия (прицельный выстрел): 12 сек", EN: "Sniping hit duration: 12 seconds" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Критический урон: -50%", EN: "Critical damage: -50%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.5 }
        },
        "URL_ПУЛЬСАР12": {
            name: { RU: "Пульсар", EN: "Pulsar" },
            advantages: [
                {
                    RU: "Критическое попадание накладывает статус-эффекты:",
                    EN: "Hitting an enemy with a critical shot will apply the following status effects:",
                    subItems: [
                        { RU: "<span class='text-pink'>Подавление</span>: 9 сек", EN: "<span class='text-pink'>Jammer</span>: 9 sec" },
                        { RU: "<span class='text-green'>Электромагнитный импульс</span>: 2 сек", EN: "<span class='text-green'>Electromagnetic Pulse</span>: 2 sec" },
                        { RU: "<span class='text-yellow'>Оглушение</span>: 1 сек", EN: "<span class='text-yellow'>Stun</span>: 1 sec" },
                        { RU: "<span class='text-purple'>Пробитие</span>: 5 сек", EN: "<span class='text-purple'>Armor-Piercing</span>: 5 sec" }
                    ]
                }
            ],
            disadvantages: [
                { RU: "Шанс критического урона: -11%", EN: "Critical chance: -12%" },
                { RU: "Критический урон: -90%", EN: "Critical damage: -90%" }
            ],
            modifiers: { CRIT_DAMAGE: 0.1 }
        },
        "https://s.eu.tankionline.com/625/153143/235/270/31770740077771/image.svg": {
            name: { RU: "Кемпер", EN: "Camper" },
            advantages: [
                { RU: "Стандартный урон: +90%", EN: "Normal and critical damage increase: +90%" }
            ],
            disadvantages: [
                { RU: "Бонус урона деактивируется при значении здоровья: ≤95%", EN: "Damage boost is active only while you have at least 95% of your maximum HP." },
                { RU: "Эффект деактивируется при попадании под воздействие статус-эффекта <span class='text-blue'>Заморозка</span>", EN: "Effect is disabled when the tank has the <span class='text-blue'>Freezing</span> status effect." }
            ],
            modifiers: { DAMAGE: 1.9, CRIT_DAMAGE: 1.9 }
        },
        "https://s.eu.tankionline.com/605/115405/51/352/31770737750144/image.svg": {
            name: { RU: "Режим серийного огня", EN: "Rapid-fire mode" },
            advantages: [
                { RU: "Перезарядка между выстрелами навскидку: -83%", EN: "Arcade shot reload: -83%" },
                { RU: "Скорость восстановления энергии: +100%", EN: "Energy recovery rate: +100%" }
            ],
            disadvantages: [
                { RU: "Урон прицельный макс: -40%", EN: "Maximum sniping damage: -40%" },
                { RU: "Энергия на выстрел навскидку: 369 ед.", EN: "Energy consumed per arcade shot: 369" },
                { RU: "Энергия на прицельный выстрел: 1000 ед.", EN: "Energy consumed per sniping shot: 1000" }
            ],
            modifiers: { CHARGE_RATE: 2, SNIPING_DAMAGE: 0.6 }
        },
        "https://s.eu.tankionline.com/605/115405/45/51/31770737552234/image.svg": {
            name: { RU: "Восстанавливающие излучатели", EN: "Healing Emitters" },
            advantages: [
                { RU: "Выстрелы по союзникам лечат их на количество наносимого урона", EN: "Shooting a teammate heals them the same amount it would damage" },
                { RU: "Лечение приносит очки репутации и опыта (от 1 до 20)", EN: "Healing gives reputation and experience points" },
                { RU: "Отдача отсутствует", EN: "No recoil" }
            ],
            disadvantages: [
                { RU: "Урон навскидку и прицельный: -15%", EN: "Arcade/Max sniping damage: -15%" },
                { RU: "Критический урон отключён", EN: "Critical damage removed" },
                { RU: "Сила удара отсутствует", EN: "No impact force" },
                { RU: "Перезарядка навскидку: +15%", EN: "Arcade shot reload: +15%" },
                { RU: "Автоприцел угол по горизонтали: ±0°", EN: "Horizontal auto-aim angle: ±0°" }
            ],
            modifiers: { SNIPING_DAMAGE: 0.85, ARCADE_DAMAGE: 0.85, CRIT_DAMAGE: 0, IMPACT_FORCE: 0 }
        },
        "https://s.eu.tankionline.com/623/154745/143/361/31770737674426/image.svg": {
            name: { RU: "Квазар", EN: "Quasar" },
            advantages: [
                { RU: "Урон навскидку: +60%", EN: "Arcade damage: +60%" },
                { RU: "Критический урон навскидку: +55%", EN: "Arcade critical damage: +55%" },
                { RU: "Прицельный урон (мин/макс): +60% / +51.5%", EN: "Min/Max sniping damage increase: +60% / +51.5%" },
                { RU: "Расход энергии: +50%", EN: "Energy consumption: +50%" }
            ],
            disadvantages: [
                { RU: "Зарядка прицельного выстрела: -33.3%", EN: "Sniping shot reload time: +33.3%" },
                { RU: "Перезарядка навскидку: +70%", EN: "Arcade shot reload time: +70%" },
                { RU: "Ускорение поворота башни: -25%", EN: "Turret rotation speed: -25%" }
            ],
            modifiers: { ARCADE_DAMAGE: 1.6, SNIPING_DAMAGE: 1.515, CRIT_DAMAGE: 1.55, CHARGE_RATE: 0.667 }
        },
        "https://s.eu.tankionline.com/627/115736/0/267/31770740020031/image.svg": {
            name: { RU: "Стелларатор", EN: "Stellarator" },
            advantages: [
                { RU: "Минимальный прицельный урон: +300%", EN: "Initial sniping damage: +300%" },
                { RU: "Скорость потребления энергии: 200 ед/с", EN: "Energy consumed = 200 units/sec" }
            ],
            disadvantages: [
                { RU: "Максимальный прицельный урон: -15%", EN: "Final sniping damage: -15%" },
                { RU: "Энергия на прицельный выстрел: +60%", EN: "Energy consumed per sniping shot: +60%" }
            ],
            modifiers: { SNIPING_DAMAGE: 0.85 }
        },
        "https://s.eu.tankionline.com/626/15004/330/76/31303201216215/image.svg": {
            name: { RU: "Эксельсиор", EN: "Excelsior" },
            advantages: [
                { RU: "Урон стандартного выстрела: +25%", EN: "Arcade Shot Damage: +25%" },
                { RU: "Скорость поворота: +15%", EN: "Turning speed: +15%" },
                { RU: "Ускорение поворота: +15%", EN: "Turning acceleration: +15%" }
            ],
            disadvantages: [
                { RU: "Отсутствуют", EN: "None" }
            ],
            modifiers: { DAMAGE: 1.25, TURNING_SPEED: 1.15 }
        },
        "https://s.eu.tankionline.com/615/13537/46/256/31766327050313/image.svg": sharedHullSpecs.extremeLightweight,
        "https://s.eu.tankionline.com/607/52626/355/111/31766330501540/image.svg": sharedHullSpecs.driver,
        "https://s.eu.tankionline.com/607/52626/353/345/31766330711714/image.svg": sharedHullSpecs.lifeguard,
        "https://s.eu.tankionline.com/605/115405/222/233/31766327747313/image.svg": sharedHullSpecs.heatImmunity,
        "https://s.eu.tankionline.com/605/115405/217/1/31766330026650/image.svg": sharedHullSpecs.coldImmunity,
        "https://s.eu.tankionline.com/605/115405/221/162/31766330117470/image.svg": sharedHullSpecs.empImmunity,
        "https://s.eu.tankionline.com/605/115405/230/162/31766330336234/image.svg": sharedHullSpecs.stunImmunity,
        "https://s.eu.tankionline.com/605/115405/215/334/31766330253155/image.svg": sharedHullSpecs.apImmunity,
        "https://s.eu.tankionline.com/605/115405/226/26/31766330200477/image.svg": sharedHullSpecs.jammerImmunity,
        "https://s.eu.tankionline.com/607/52626/352/170/31766327467052/image.svg": sharedHullSpecs.engineer,
        "https://s.eu.tankionline.com/605/115405/223/302/31766327322346/image.svg": sharedHullSpecs.heatResistance,
        "https://s.eu.tankionline.com/605/115405/220/55/31766327402020/image.svg": sharedHullSpecs.coldResistance,
        "https://s.eu.tankionline.com/605/115405/227/110/31766327560021/image.svg": sharedHullSpecs.lightweight,
        "https://s.eu.tankionline.com/605/115405/224/357/31766327640451/image.svg": sharedHullSpecs.heavyweight,
        "https://s.eu.tankionline.com/615/13535/121/235/31766275260712/image.svg": sharedHullSpecs.extremeLightweight,
        "https://s.eu.tankionline.com/607/52626/346/113/31766277306520/image.svg": sharedHullSpecs.driver,
        "https://s.eu.tankionline.com/607/52626/330/66/31766304664657/image.svg": sharedHullSpecs.driver,
        "https://s.eu.tankionline.com/607/52626/267/303/31766307451743/image.svg": sharedHullSpecs.driver,
        "https://s.eu.tankionline.com/607/52626/364/144/31766313030407/image.svg": sharedHullSpecs.driver,
        "https://s.eu.tankionline.com/607/52626/373/202/31766320252533/image.svg": sharedHullSpecs.driver,
        "https://s.eu.tankionline.com/607/52627/1/55/31766252272742/image.svg": sharedHullSpecs.lifeguard,
        "https://s.eu.tankionline.com/607/52626/335/352/31766275130427/image.svg": sharedHullSpecs.lifeguard,
        "https://s.eu.tankionline.com/607/52626/344/341/31766277604702/image.svg": sharedHullSpecs.lifeguard,
        "https://s.eu.tankionline.com/607/52626/314/224/31766270066136/image.svg": sharedHullSpecs.blaster,
        "https://s.eu.tankionline.com/607/52626/342/12/31766274536373/image.svg": sharedHullSpecs.blaster,
        "https://s.eu.tankionline.com/607/52626/351/13/31766277235607/image.svg": sharedHullSpecs.blaster,
        "https://s.eu.tankionline.com/607/52626/333/7/31766304524016/image.svg": sharedHullSpecs.blaster,
        "https://s.eu.tankionline.com/607/52626/367/101/31766312632013/image.svg": sharedHullSpecs.blaster,
        "https://s.eu.tankionline.com/607/52626/376/110/31766320151337/image.svg": sharedHullSpecs.blaster,
        "https://s.eu.tankionline.com/607/52626/304/160/31766326437213/image.svg": sharedHullSpecs.blaster,
        "https://s.eu.tankionline.com/607/52626/360/43/31766330424075/image.svg": sharedHullSpecs.blaster,
        "https://s.eu.tankionline.com/607/52627/3/366/31766252206443/image.svg": sharedHullSpecs.miner,
        "https://s.eu.tankionline.com/607/52626/313/26/31766271431403/image.svg": sharedHullSpecs.miner,
        "https://s.eu.tankionline.com/607/52626/340/224/31766275016373/image.svg": sharedHullSpecs.miner,
        "https://s.eu.tankionline.com/625/153441/322/26/31766330554432/image.svg": sharedHullSpecs.grenadier,
        "https://s.eu.tankionline.com/625/153434/211/174/31766305002430/image.svg": sharedHullSpecs.grenadier,
        "https://s.eu.tankionline.com/625/153432/123/23/31766271350475/image.svg": sharedHullSpecs.grenadier,
        "https://s.eu.tankionline.com/625/153435/56/204/31766307562214/image.svg": sharedHullSpecs.grenadier,
        "https://s.eu.tankionline.com/625/153432/353/164/31766274735212/image.svg": sharedHullSpecs.grenadier,
        "https://s.eu.tankionline.com/625/153437/257/205/31766320353033/image.svg": sharedHullSpecs.grenadier,
        "https://s.eu.tankionline.com/625/153431/244/273/31766252074314/image.svg": sharedHullSpecs.grenadier,
        "https://s.eu.tankionline.com/625/153436/225/317/31766313134356/image.svg": sharedHullSpecs.grenadier,
        "https://s.eu.tankionline.com/607/52626/331/234/31766305066210/image.svg": sharedHullSpecs.miner,
        "https://s.eu.tankionline.com/607/52626/322/171/31766315520416/image.svg": sharedHullSpecs.miner,
        "https://s.eu.tankionline.com/607/52626/374/331/31766320473457/image.svg": sharedHullSpecs.miner,
        "https://s.eu.tankionline.com/607/52626/300/70/31766326656325/image.svg": sharedHullSpecs.miner,
        "https://s.eu.tankionline.com/607/52626/356/271/31766330630270/image.svg": sharedHullSpecs.miner,
        "https://s.eu.tankionline.com/625/153433/270/213/31766277441416/image.svg": sharedHullSpecs.grenadier,
        "https://s.eu.tankionline.com/607/52626/347/254/31766277517450/image.svg": sharedHullSpecs.miner,
        "https://s.eu.tankionline.com/605/115404/255/112/31766276374365/image.svg": sharedHullSpecs.heatImmunity,
        "https://s.eu.tankionline.com/605/115404/251/274/31766276515545/image.svg": sharedHullSpecs.coldImmunity,
        "https://s.eu.tankionline.com/605/115404/254/37/31766276640751/image.svg": sharedHullSpecs.empImmunity,
        "https://s.eu.tankionline.com/605/115404/263/32/31766277136143/image.svg": sharedHullSpecs.stunImmunity,
        "https://s.eu.tankionline.com/605/115404/250/232/31766277026137/image.svg": sharedHullSpecs.apImmunity,
        "https://s.eu.tankionline.com/605/115404/260/303/31766276737213/image.svg": sharedHullSpecs.jammerImmunity,
        "https://s.eu.tankionline.com/607/52626/343/154/31766276045327/image.svg": sharedHullSpecs.engineer,
        "https://s.eu.tankionline.com/605/115404/256/156/31766275630266/image.svg": sharedHullSpecs.heatResistance,
        "https://s.eu.tankionline.com/605/115404/252/351/31766275733170/image.svg": sharedHullSpecs.coldResistance,
        "https://s.eu.tankionline.com/605/115404/261/363/31766276145114/image.svg": sharedHullSpecs.lightweight,
        "https://s.eu.tankionline.com/605/115404/257/232/31766276250353/image.svg": sharedHullSpecs.heavyweight,
        "https://s.eu.tankionline.com/615/13535/232/61/31766301413021/image.svg": sharedHullSpecs.extremeLightweight,
        "https://s.eu.tankionline.com/607/52626/326/312/31766305153550/image.svg": sharedHullSpecs.lifeguard,
        "https://s.eu.tankionline.com/626/14763/222/273/31303174776207/image.svg": sharedHullSpecs.excelsior,
        "https://s.eu.tankionline.com/605/115404/271/2/31766303351066/image.svg": sharedHullSpecs.heatImmunity,
        "https://s.eu.tankionline.com/605/115404/265/163/31766303441366/image.svg": sharedHullSpecs.coldImmunity,
        "https://s.eu.tankionline.com/605/115404/267/326/31773311346741/image.svg": sharedHullSpecs.empImmunity,
        "https://s.eu.tankionline.com/605/115404/276/325/31766304070150/image.svg": sharedHullSpecs.stunImmunity,
        "https://s.eu.tankionline.com/605/115404/264/114/31766303750551/image.svg": sharedHullSpecs.apImmunity,
        "https://s.eu.tankionline.com/605/115404/274/173/31766303633046/image.svg": sharedHullSpecs.jammerImmunity,
        "https://s.eu.tankionline.com/607/52626/325/132/31766302722064/image.svg": sharedHullSpecs.engineer,
        "https://s.eu.tankionline.com/605/115404/272/45/31766301572647/image.svg": sharedHullSpecs.heatResistance,
        "https://s.eu.tankionline.com/605/115404/266/244/31766302600226/image.svg": sharedHullSpecs.coldResistance,
        "https://s.eu.tankionline.com/605/115404/275/253/31766303116267/image.svg": sharedHullSpecs.lightweight,
        "https://s.eu.tankionline.com/605/115404/273/122/31766303241735/image.svg": sharedHullSpecs.heavyweight,
        "https://s.eu.tankionline.com/615/13536/347/303/31766324070273/image.svg": sharedHullSpecs.extremeLightweight,
        "https://s.eu.tankionline.com/607/52626/276/325/31766326520415/image.svg": sharedHullSpecs.driver,
        "https://s.eu.tankionline.com/625/153440/130/316/31766326600612/image.svg": sharedHullSpecs.grenadier,
        "https://s.eu.tankionline.com/607/52626/275/155/31766326743766/image.svg": sharedHullSpecs.lifeguard,
        "https://s.eu.tankionline.com/626/14775/270/340/31303177425217/image.svg": sharedHullSpecs.excelsior,
        "https://s.eu.tankionline.com/626/14776/162/300/31303177563156/image.svg": sharedHullSpecs.excelsior,
        "https://s.eu.tankionline.com/626/14763/0/105/31303174636476/image.svg": sharedHullSpecs.excelsior,
        "https://s.eu.tankionline.com/626/14773/203/76/31303176751641/image.svg": sharedHullSpecs.excelsior,
        "https://s.eu.tankionline.com/626/14774/252/246/31303177163004/image.svg": sharedHullSpecs.excelsior,
        "https://s.eu.tankionline.com/626/14760/353/56/31303174244125/image.svg": sharedHullSpecs.excelsior,
        "https://s.eu.tankionline.com/626/14775/64/127/31303177275076/image.svg": sharedHullSpecs.excelsior,
        "https://s.eu.tankionline.com/626/14757/7/353/31303173653776/image.svg": sharedHullSpecs.excelsior,
        "https://s.eu.tankionline.com/626/14774/57/121/31303177061063/image.svg": sharedHullSpecs.excelsior,
        "https://s.eu.tankionline.com/605/115405/200/351/31766325745206/image.svg": sharedHullSpecs.heatImmunity,
        "https://s.eu.tankionline.com/605/115405/175/147/31766326031401/image.svg": sharedHullSpecs.coldImmunity,
        "https://s.eu.tankionline.com/605/115405/177/303/31766326123603/image.svg": sharedHullSpecs.empImmunity,
        "https://s.eu.tankionline.com/605/115405/206/277/31766326341374/image.svg": sharedHullSpecs.stunImmunity,
        "https://s.eu.tankionline.com/605/115405/174/105/31766326262726/image.svg": sharedHullSpecs.apImmunity,
        "https://s.eu.tankionline.com/605/115405/204/144/31766326203045/image.svg": sharedHullSpecs.jammerImmunity,
        "https://s.eu.tankionline.com/607/52626/273/364/31766324601137/image.svg": sharedHullSpecs.engineer,
        "https://s.eu.tankionline.com/605/115405/202/17/31766324321024/image.svg": sharedHullSpecs.heatResistance,
        "https://s.eu.tankionline.com/605/115405/176/222/31766324435437/image.svg": sharedHullSpecs.coldResistance,
        "https://s.eu.tankionline.com/605/115405/205/223/31766324676724/image.svg": sharedHullSpecs.lightweight,
        "https://s.eu.tankionline.com/605/115405/203/72/31766325625702/image.svg": sharedHullSpecs.heavyweight,
        "https://s.eu.tankionline.com/615/13534/331/62/31766252731606/image.svg": sharedHullSpecs.extremeLightweight,
        "https://s.eu.tankionline.com/607/52626/311/141/31766270415747/image.svg": sharedHullSpecs.driver,
        "https://s.eu.tankionline.com/607/52626/307/301/31766271515232/image.svg": sharedHullSpecs.lifeguard,
        "https://s.eu.tankionline.com/626/14757/372/20/31303174034500/image.svg": sharedHullSpecs.excelsior,
        "https://s.eu.tankionline.com/605/115404/161/51/31766263640146/image.svg": sharedHullSpecs.heatImmunity,
        "https://s.eu.tankionline.com/605/115404/155/230/31766263745525/image.svg": sharedHullSpecs.coldImmunity,
        "https://s.eu.tankionline.com/605/115404/157/376/31766264071161/image.svg": sharedHullSpecs.empImmunity,
        "https://s.eu.tankionline.com/605/115404/167/3/31766267711246/image.svg": sharedHullSpecs.stunImmunity,
        "https://s.eu.tankionline.com/605/115404/154/161/31766267516227/image.svg": sharedHullSpecs.apImmunity,
        "https://s.eu.tankionline.com/605/115404/164/240/31766264244210/image.svg": sharedHullSpecs.jammerImmunity,
        "https://s.eu.tankionline.com/607/52626/306/22/31766263372714/image.svg": sharedHullSpecs.engineer,
        "https://s.eu.tankionline.com/605/115404/162/117/31766263137210/image.svg": sharedHullSpecs.heatResistance,
        "https://s.eu.tankionline.com/605/115404/156/315/31766263225534/image.svg": sharedHullSpecs.coldResistance,
        "https://s.eu.tankionline.com/605/115404/165/323/31766263461506/image.svg": sharedHullSpecs.lightweight,
        "https://s.eu.tankionline.com/605/115404/163/173/31766263543757/image.svg": sharedHullSpecs.heavyweight,
        "https://s.eu.tankionline.com/615/13535/337/124/31766305716424/image.svg": sharedHullSpecs.extremeLightweight,
        "https://s.eu.tankionline.com/607/52626/266/125/31766307751231/image.svg": sharedHullSpecs.lifeguard,
        "https://s.eu.tankionline.com/607/52626/272/222/31766307360573/image.svg": sharedHullSpecs.blaster,
        "https://s.eu.tankionline.com/607/52626/271/51/31766307657046/image.svg": sharedHullSpecs.miner,
        "https://s.eu.tankionline.com/605/115404/305/361/31766306540617/image.svg": sharedHullSpecs.heatImmunity,
        "https://s.eu.tankionline.com/605/115404/302/147/31766306640200/image.svg": sharedHullSpecs.coldImmunity,
        "https://s.eu.tankionline.com/605/115404/304/306/31766306745453/image.svg": sharedHullSpecs.empImmunity,
        "https://s.eu.tankionline.com/605/115404/313/302/31766307262732/image.svg": sharedHullSpecs.stunImmunity,
        "https://s.eu.tankionline.com/605/115404/301/77/31766307137537/image.svg": sharedHullSpecs.apImmunity,
        "https://s.eu.tankionline.com/605/115404/311/152/31766307040730/image.svg": sharedHullSpecs.jammerImmunity,
        "https://s.eu.tankionline.com/607/52626/264/207/31766306176176/image.svg": sharedHullSpecs.engineer,
        "https://s.eu.tankionline.com/605/115404/307/27/31766306011421/image.svg": sharedHullSpecs.heatResistance,
        "https://s.eu.tankionline.com/605/115404/303/226/31771405137507/image.svg": sharedHullSpecs.coldResistance,
        "https://s.eu.tankionline.com/605/115404/312/223/31766306314401/image.svg": sharedHullSpecs.lightweight,
        "https://s.eu.tankionline.com/605/115404/310/101/31766306402030/image.svg": sharedHullSpecs.heavyweight,
        "https://s.eu.tankionline.com/615/13536/157/317/31766313525335/image.svg": sharedHullSpecs.extremeLightweight,
        "https://s.eu.tankionline.com/607/52626/321/33/31766315260326/image.svg": sharedHullSpecs.driver,
        "https://s.eu.tankionline.com/625/153437/45/146/31766315415525/image.svg": sharedHullSpecs.grenadier,
        "https://s.eu.tankionline.com/607/52626/317/260/31766315601553/image.svg": sharedHullSpecs.lifeguard,
        "https://s.eu.tankionline.com/607/52626/323/353/31766315166437/image.svg": sharedHullSpecs.blaster,
        "https://s.eu.tankionline.com/605/115404/354/246/31766314347600/image.svg": sharedHullSpecs.heatImmunity,
        "https://s.eu.tankionline.com/605/115404/351/35/31766314504401/image.svg": sharedHullSpecs.coldImmunity,
        "https://s.eu.tankionline.com/605/115404/353/176/31766314601235/image.svg": sharedHullSpecs.empImmunity,
        "https://s.eu.tankionline.com/605/115404/362/172/31766315072610/image.svg": sharedHullSpecs.stunImmunity,
        "https://s.eu.tankionline.com/605/115404/347/366/31766314771264/image.svg": sharedHullSpecs.apImmunity,
        "https://s.eu.tankionline.com/605/115404/360/42/31766314674575/image.svg": sharedHullSpecs.jammerImmunity,
        "https://s.eu.tankionline.com/607/52626/316/33/31766313775764/image.svg": sharedHullSpecs.engineer,
        "https://s.eu.tankionline.com/605/115404/355/316/31766313624736/image.svg": sharedHullSpecs.heatResistance,
        "https://s.eu.tankionline.com/605/115404/352/112/31766313716404/image.svg": sharedHullSpecs.coldResistance,
        "https://s.eu.tankionline.com/605/115404/361/120/31766314064546/image.svg": sharedHullSpecs.lightweight,
        "https://s.eu.tankionline.com/605/115404/356/372/31766314203753/image.svg": sharedHullSpecs.heavyweight,
        "https://s.eu.tankionline.com/615/13535/31/115/31766272136011/image.svg": sharedHullSpecs.extremeLightweight,
        "https://s.eu.tankionline.com/607/52626/337/100/31766274645601/image.svg": sharedHullSpecs.driver,
        "https://s.eu.tankionline.com/605/115404/175/3/31766273756434/image.svg": sharedHullSpecs.heatImmunity,
        "https://s.eu.tankionline.com/605/115404/171/147/31766274052527/image.svg": sharedHullSpecs.coldImmunity,
        "https://s.eu.tankionline.com/605/115404/173/326/31766274162553/image.svg": sharedHullSpecs.empImmunity,
        "https://s.eu.tankionline.com/605/115404/202/353/31766274425040/image.svg": sharedHullSpecs.stunImmunity,
        "https://s.eu.tankionline.com/605/115404/170/74/31766274330006/image.svg": sharedHullSpecs.apImmunity,
        "https://s.eu.tankionline.com/605/115404/200/211/31766274243725/image.svg": sharedHullSpecs.jammerImmunity,
        "https://s.eu.tankionline.com/607/52626/334/161/31766272563444/image.svg": sharedHullSpecs.engineer,
        "https://s.eu.tankionline.com/605/115404/176/56/31766272242251/image.svg": sharedHullSpecs.heatResistance,
        "https://s.eu.tankionline.com/605/115404/172/240/31766272474513/image.svg": sharedHullSpecs.coldResistance,
        "https://s.eu.tankionline.com/605/115404/201/275/31766272651655/image.svg": sharedHullSpecs.lightweight,
        "https://s.eu.tankionline.com/605/115404/177/134/31766272740347/image.svg": sharedHullSpecs.heavyweight,
        "https://s.eu.tankionline.com/615/13536/263/135/31766315774712/image.svg": sharedHullSpecs.extremeLightweight,
        "https://s.eu.tankionline.com/607/52626/372/40/31766320560110/image.svg": sharedHullSpecs.lifeguard,
        "https://s.eu.tankionline.com/605/115405/152/265/31766317240576/image.svg": sharedHullSpecs.heatImmunity,
        "https://s.eu.tankionline.com/605/115405/147/52/31766317346645/image.svg": sharedHullSpecs.coldImmunity,
        "https://s.eu.tankionline.com/605/115405/151/210/31766317475152/image.svg": sharedHullSpecs.empImmunity,
        "https://s.eu.tankionline.com/605/144203/5/124/31766320065417/image.svg": sharedHullSpecs.stunImmunity,
        "https://s.eu.tankionline.com/605/115405/146/1/31766317734316/image.svg": sharedHullSpecs.apImmunity,
        "https://s.eu.tankionline.com/605/115405/156/63/31766317647646/image.svg": sharedHullSpecs.jammerImmunity,
        "https://s.eu.tankionline.com/607/52626/370/255/31766316413112/image.svg": sharedHullSpecs.engineer,
        "https://s.eu.tankionline.com/605/115405/153/333/31766316247101/image.svg": sharedHullSpecs.heatResistance,
        "https://s.eu.tankionline.com/605/115405/150/131/31766316333200/image.svg": sharedHullSpecs.coldResistance,
        "https://s.eu.tankionline.com/605/115405/157/142/31766316506302/image.svg": sharedHullSpecs.lightweight,
        "https://s.eu.tankionline.com/605/115405/155/6/31766316571614/image.svg": sharedHullSpecs.heavyweight,
        "https://s.eu.tankionline.com/615/13534/124/206/31766252442620/image.svg": sharedHullSpecs.extremeLightweight,
        "https://s.eu.tankionline.com/607/52627/2/224/31766251765336/image.svg": sharedHullSpecs.driver,
        "https://s.eu.tankionline.com/607/52627/5/137/31766251677753/image.svg": sharedHullSpecs.blaster,
        "https://s.eu.tankionline.com/605/115404/145/136/31766250710525/image.svg": sharedHullSpecs.heatImmunity,
        "https://s.eu.tankionline.com/605/115404/141/307/31766251112607/image.svg": sharedHullSpecs.coldImmunity,
        "https://s.eu.tankionline.com/605/115404/144/63/31766251170516/image.svg": sharedHullSpecs.empImmunity,
        "https://s.eu.tankionline.com/605/115404/153/100/31766251601424/image.svg": sharedHullSpecs.stunImmunity,
        "https://s.eu.tankionline.com/605/115404/132/344/31766251505217/image.svg": sharedHullSpecs.apImmunity,
        "https://s.eu.tankionline.com/605/115404/150/335/31766251265704/image.svg": sharedHullSpecs.jammerImmunity,
        "https://s.eu.tankionline.com/607/52626/377/265/31766247400410/image.svg": sharedHullSpecs.engineer,
        "https://s.eu.tankionline.com/605/115404/146/210/31766250614230/image.svg": sharedHullSpecs.heatResistance,
        "https://s.eu.tankionline.com/605/115404/142/374/31766247316713/image.svg": sharedHullSpecs.coldResistance,
        "https://s.eu.tankionline.com/605/115404/152/21/31766247562001/image.svg": sharedHullSpecs.lightweight,
        "https://s.eu.tankionline.com/605/115404/147/265/31766247656275/image.svg": sharedHullSpecs.heavyweight,
        "https://s.eu.tankionline.com/615/13536/66/55/31766310170275/image.svg": sharedHullSpecs.extremeLightweight,
        "https://s.eu.tankionline.com/607/52626/362/366/31766313401007/image.svg": sharedHullSpecs.lifeguard,
        "https://s.eu.tankionline.com/607/52626/365/305/31766313242776/image.svg": sharedHullSpecs.miner,
        "https://s.eu.tankionline.com/605/115404/340/343/31766311235243/image.svg": sharedHullSpecs.heatImmunity,
        "https://s.eu.tankionline.com/605/115404/335/127/31766311455615/image.svg": sharedHullSpecs.coldImmunity,
        "https://s.eu.tankionline.com/605/115404/337/266/31766311541406/image.svg": sharedHullSpecs.empImmunity,
        "https://s.eu.tankionline.com/605/115404/346/302/31766312431275/image.svg": sharedHullSpecs.stunImmunity,
        "https://s.eu.tankionline.com/605/115404/334/54/31766312222752/image.svg": sharedHullSpecs.apImmunity,
        "https://s.eu.tankionline.com/605/115404/344/142/31766311632562/image.svg": sharedHullSpecs.jammerImmunity,
        "https://s.eu.tankionline.com/607/52626/361/203/31766310663474/image.svg": sharedHullSpecs.engineer,
        "https://s.eu.tankionline.com/605/115404/342/11/31766310302045/image.svg": sharedHullSpecs.heatResistance,
        "https://s.eu.tankionline.com/605/115404/336/205/31766310504724/image.svg": sharedHullSpecs.coldResistance,
        "https://s.eu.tankionline.com/605/115404/345/225/31766311004730/image.svg": sharedHullSpecs.lightweight,
        "https://s.eu.tankionline.com/605/115404/343/73/31766311076052/image.svg": sharedHullSpecs.heavyweight
    };
    const addCustomStyles = () => {
        if (document.getElementById('custom-specs-styles'))
            return;
        const style = document.createElement('style');
        style.id = 'custom-specs-styles';
        style.innerHTML = `
            .custom-card-specs-btn {
                position: absolute;
                bottom: 0.5em;
                left: 0.5em;
                width: 2.5em;
                height: 2.5em;
                border-radius: 30%;
                background-color: rgba(0, 25, 38, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: 10;
                border: 0.063em solid rgba(191, 213, 255, 0.5);
                transition: all 0.4s ease;
            }
            .custom-card-specs-btn:hover,
            .custom-card-specs-btn.active {
                background-color: rgb(119, 254, 51);
                border-color: transparent;
                box-shadow: 0 0 10px rgba(119, 254, 51, 0.4);
            }

            .custom-card-specs-icon {
                width: 1.3em;
                height: 1.3em;
                display: block;
                background-color: rgb(191, 213, 255);
                -webkit-mask-image: url(https://s.eu.tankionline.com/static/images/unavailable.5c3ecd75.svg);
                mask-image: url(https://s.eu.tankionline.com/static/images/unavailable.5c3ecd75.svg);
                -webkit-mask-position: center;
                mask-position: center;
                -webkit-mask-repeat: no-repeat;
                mask-repeat: no-repeat;
                -webkit-mask-size: contain;
                mask-size: contain;
                transition: background-color 0.4s ease;
            }
            .custom-card-specs-btn:hover .custom-card-specs-icon,
            .custom-card-specs-btn.active .custom-card-specs-icon {
                background-color: rgb(7, 26, 40);
            }

            .custom-specs-modal-wrapper {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0, 0, 0, 0.7); z-index: 99999; display: flex; justify-content: flex-end;
            }
            .custom-specs-modal-content {
                user-select: none; font-size: max(min(1.48148vh, 1vw), 3px); font-family: BaseFontRegular, FallbackFontRegular; pointer-events: auto;
                display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start;
                background: radial-gradient(192.86% 100% at 0% 100%, rgba(191, 213, 255, 0.25) 0%, rgba(191, 213, 255, 0) 100%), rgb(0, 25, 38);
                height: 100%; max-width: 57em; position: absolute; right: 0px; width: 57em; padding: 2em; box-sizing: border-box; color: white;
            }

            .custom-specs-close-btn {
                position: absolute; top: 2em; right: 2em; width: 1.5em; height: 1.5em; cursor: pointer;
                background-image: url(https://s.eu.tankionline.com/static/images/iconDelete.b879b0ab.svg);
                background-repeat: no-repeat; background-size: contain; background-position: center center; z-index: 10;
            }
            .custom-specs-close-btn:hover { background-image: url(https://s.eu.tankionline.com/static/images/deleteHoverModal.3aceb055.svg); }

            .device-container { display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-start; border: .063rem solid rgba(125, 157, 186, .4); background: #1a324466; border-radius: .375rem; position: relative; overflow: hidden; margin-top: 3em; font-family: BaseFontMedium, FallbackFontMedium, sans-serif; }
            .device-stats-wrapper { display: flex; width: 100%; box-sizing: border-box; }
            .device-stats { padding: 1.125rem 1.25rem; flex: 1; }
            .device-stats:first-child { border-right: .063rem solid rgba(125, 157, 186, .4); }
            .device-stats .heading { font-weight: 600; font-family: BaseFontBold, FallbackFontBold, sans-serif; text-transform: uppercase; color: #46df11; display: flex; align-items: center; margin-bottom: .625rem; font-size: 1.1em; }
            .device-stats.negative .heading { color: #f33; }

            .device-stats .heading::before {
                content: ""; min-width: 1.2rem; min-height: 1.2rem; width: 1.2rem; height: 1.2rem; margin-right: .625rem;
                background-image: url('data:image/svg+xml;utf8,<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="%2346df11"/><path d="M12 7V17M7 12H17" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>');
                background-size: contain; background-position: center; background-repeat: no-repeat;
            }
            .device-stats.negative .heading::before { background-image: url('data:image/svg+xml;utf8,<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="%23f33"/><path d="M7 12H17" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>'); }

            .device-stats ul { list-style: none; padding: 0; margin: 0; }
            .device-stats ul li { position: relative; padding-left: 1.2rem; margin-bottom: 0.4rem; font-size: 1.05em; line-height: 1.4; color: white; }
            .device-stats ul li::before { content: "\\25b8"; color: #46df11; position: absolute; left: 0; top: 0; font-size: 1.2em; line-height: 1.1; }
            .device-stats.negative ul li::before { color: #f33; }

            .device-stats ul ul { margin-top: 0.4rem; margin-bottom: 0.2rem; margin-left: 0.5rem; }

            .text-pink { color: #ff33cc; }
            .text-green { color: #df9e11; }
            .text-yellow { color: #ffcc00; }
            .text-purple { color: #cc66ff; }
            .text-blue { color: #0095ff; }
            .text-red { color: #e00b0b; }
            .inline-icon { width: 1.2em; height: 1.2em; vertical-align: middle; margin-right: 0.3em; margin-top: -0.2em; }
        `;
        document.head ? document.head.appendChild(style) : document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
    };
    const renderList = (items, lang) => {
        if (!items || items.length === 0)
            return `<li>${t[lang].empty}</li>`;
        return items.map(item => {
            let html = `<li>${item[lang] || item['EN']}`;
            if (item.subItems && item.subItems.length > 0) {
                html += `<ul>${item.subItems.map(sub => `<li>${sub[lang] || sub['EN']}</li>`).join('')}</ul>`;
            }
            html += `</li>`;
            return html;
        }).join('');
    };
    const closeSpecsModal = () => {
        const overlay = document.querySelector('.custom-specs-modal-wrapper');
        if (overlay)
            overlay.remove();
        document.querySelectorAll('.custom-card-specs-btn.active').forEach(btn => {
            btn.classList.remove('active');
        });
    };
    const openSpecsModal = (deviceData, deviceUrl) => {
        if (!deviceData)
            return;
        closeSpecsModal();
        const lang = getLang();
        const wrapper = document.createElement('div');
        wrapper.className = 'custom-specs-modal-wrapper';
        const localizedName = deviceData.name[lang] || deviceData.name['EN'] || "Unknown Device";
        const advList = renderList(deviceData.advantages, lang);
        const disadvList = renderList(deviceData.disadvantages, lang);
        let htmlContent = `
            <div class="custom-specs-modal-content">
                <div class="custom-specs-close-btn"></div>
                <h1 style="font-family: BaseFontBold; text-transform: uppercase; font-size: 3em; margin-bottom: 0;">${localizedName}</h1>
                <span style="color: rgb(191, 213, 255); font-size: 1.2em; text-transform: uppercase;">${t[lang].specsTitle}</span>

                <div class="device-container">
                    <div class="device-stats-wrapper">
                        <div class="device-stats">
                            <div class="heading">${t[lang].adv}</div>
                            <ul>${advList}</ul>
                        </div>
                        <div class="device-stats negative">
                            <div class="heading">${t[lang].disadv}</div>
                            <ul>${disadvList}</ul>
                        </div>
                    </div>
                </div>
            </div>
        `;
        wrapper.innerHTML = htmlContent;
        wrapper.addEventListener('click', (e) => {
            if (e.target === wrapper || e.target.classList.contains('custom-specs-close-btn')) {
                closeSpecsModal();
            }
        });
        document.body.appendChild(wrapper);
        if (deviceUrl) {
            const activeCardBtn = document.querySelector(`.custom-card-specs-btn[data-url="${deviceUrl}"]`);
            if (activeCardBtn)
                activeCardBtn.classList.add('active');
        }
    };
    const injectButtons = () => {
        if (localStorage.getItem('k_augments') !== 'true')
            return;
        const cardsImgs = document.querySelectorAll('img.SkinCellStyle-iconCell');
        cardsImgs.forEach(img => {
            const card = img.parentElement;
            const url = img.src;
            let existingBtn = card.querySelector('.custom-card-specs-btn');
            if (existingBtn && existingBtn.dataset.url !== url) {
                existingBtn.remove();
                existingBtn = null;
            }
            if (!existingBtn && deviceSpecsDB[url]) {
                if (window.getComputedStyle(card).position === 'static') {
                    card.style.position = 'relative';
                }
                const btn = document.createElement('div');
                btn.className = 'custom-card-specs-btn';
                btn.title = "Specs";
                btn.dataset.url = url;
                btn.innerHTML = `<div class="custom-card-specs-icon"></div>`;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    openSpecsModal(deviceSpecsDB[url], url);
                });
                card.appendChild(btn);
            }
        });
    };
    const initNavigationListeners = () => {
        window.addEventListener('keydown', (e) => {
            const overlay = document.querySelector('.custom-specs-modal-wrapper');
            if (overlay) {
                if (e.code === 'Escape' || e.key === 'Escape' || e.code === 'KeyZ' || e.key.toLowerCase() === 'z') {
                    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName))
                        return;
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    closeSpecsModal();
                }
            }
        }, true);
        window.addEventListener('mousedown', (e) => {
            const overlay = document.querySelector('.custom-specs-modal-wrapper');
            if (overlay && (e.button === 3 || e.button === 4)) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        }, true);
        window.addEventListener('mouseup', (e) => {
            const overlay = document.querySelector('.custom-specs-modal-wrapper');
            if (overlay && (e.button === 3 || e.button === 4)) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                closeSpecsModal();
            }
        }, true);
    };
    function updateLiveStats() {
        if (localStorage.getItem('k_augments') !== 'true')
            return;
        document.querySelectorAll('.custom-live-stat').forEach(el => el.remove());
        document.querySelectorAll('.hidden-by-script').forEach(el => {
            el.classList.remove('hidden-by-script');
            el.style.display = '';
        });
        const deviceImg = document.querySelector('.DeviceButtonComponentStyle-deviceIcon');
        if (!deviceImg)
            return;
        const deviceData = deviceSpecsDB[deviceImg.src];
        if (!deviceData || !deviceData.modifiers)
            return;
        const allSpans = Array.from(document.querySelectorAll('span')).filter(s => !s.classList.contains('custom-live-stat'));
        allSpans.forEach(nameSpan => {
            const text = nameSpan.textContent.trim().toLowerCase();
            let matchedTag = null;
            for (const [tag, translations] of Object.entries(STAT_DICT)) {
                const allVariants = [].concat(translations.RU, translations.EN)
                    .filter(Boolean)
                    .map(s => s.toLowerCase());
                if (allVariants.includes(text)) {
                    matchedTag = tag;
                    break;
                }
            }
            if (matchedTag && deviceData.modifiers && (matchedTag in deviceData.modifiers)) {
                const multiplier = deviceData.modifiers[matchedTag];
                const valueSpan = nameSpan.parentElement.nextElementSibling;
                if (valueSpan && valueSpan.tagName === 'SPAN' && !valueSpan.classList.contains('hidden-by-script')) {
                    const cleanStr = valueSpan.innerText.replace(/\s/g, '').replace(/\u00A0/g, '').replace(',', '.');
                    const origNumber = parseFloat(cleanStr);
                    if (!isNaN(origNumber)) {
                        let newVal;
                        if (matchedTag === 'WEIGHT' && multiplier >= 10) {
                            newVal = multiplier;
                        }
                        else {
                            newVal = origNumber * multiplier;
                        }
                        let formattedVal = Number.isInteger(newVal) ? newVal : parseFloat(newVal.toFixed(2));
                        formattedVal = formattedVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
                        let isBuff = multiplier > 1;
                        if (['RELOAD'].includes(matchedTag)) {
                            isBuff = multiplier < 1;
                        }
                        if (matchedTag === 'WEIGHT' && multiplier < origNumber) {
                            isBuff = false;
                        }
                        const color = isBuff ? '#00ff38' : '#fe6666';
                        valueSpan.classList.add('hidden-by-script');
                        valueSpan.style.display = 'none';
                        const customSpan = document.createElement('span');
                        customSpan.className = valueSpan.className + ' custom-live-stat';
                        customSpan.innerHTML = `<span style="color: ${color}; text-shadow: 0 0 5px ${color}40;">${formattedVal}</span>`;
                        valueSpan.parentNode.insertBefore(customSpan, valueSpan.nextSibling);
                    }
                }
            }
        });
    }
    function isBattleActive() {
        return !!document.querySelector('.BattleHudComponentStyle-hudContainer');
    }
    const initObserver = () => {
        const observerConfig = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['src', 'class'] };
        let rootContainer = document.getElementById('app-root') || document.body;
        const observer = new MutationObserver(() => {
            const loadingScreen = document.querySelector('.ApplicationLoaderComponentStyle-container.-background');
            if (loadingScreen) {
                closeSpecsModal();
            }
            if (isBattleActive())
                return;
            if (localStorage.getItem('k_augments') !== 'true')
                return;
            observer.disconnect();
            injectButtons();
            updateLiveStats();
            if (rootContainer)
                observer.observe(rootContainer, observerConfig);
        });
        const attachObserver = () => {
            rootContainer = document.getElementById('app-root') || document.body;
            if (rootContainer)
                observer.observe(rootContainer, observerConfig);
        };
        if (document.body || document.getElementById('app-root'))
            attachObserver();
        else
            document.addEventListener('DOMContentLoaded', attachObserver);
    };
    addCustomStyles();
    initNavigationListeners();
    initObserver();
})();
