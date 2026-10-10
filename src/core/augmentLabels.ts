/** Semantic protocol names stay stable even when generated JavaScript fields change. */
// RU terminology: https://ru.tankiwiki.com/Ustroystva (weapon and hull tabs).
// Keep protocol distinctions when the wiki groups several fields under one heading.
const russian: Record<string, string> = {
    HULL_ARMOR: 'Броня', HULL_SPEED: 'Максимальная скорость корпуса', HULL_MASS: 'Масса корпуса',
    HULL_ACCELERATION: 'Ускорение корпуса', HULL_TURN_ACCELERATION: 'Ускорение поворота корпуса',
    HULL_TURN_SPEED: 'Скорость поворота корпуса', TURRET_TURN_SPEED: 'Скорость поворота башни',
    TURRET_ROTATION_ACCELERATION: 'Ускорение поворота башни', INITIAL_TURRET_ANGLE: 'Начальный угол ствола',
    DAMAGE_FIXED: 'Урон', DAMAGE_FROM: 'Минимальный урон', DAMAGE_TO: 'Максимальный урон',
    DAMAGE_PER_HIT: 'Урон за попадание', DAMAGE_PER_PERIOD: 'Урон за тик', DAMAGE_PER_SECOND: 'Урон в секунду',
    CRITICAL_HIT_DAMAGE: 'Критический урон', MAX_CRITICAL_HIT_CHANCE: 'Максимальный шанс критического выстрела',
    START_CRITICAL_HIT_CHANCE: 'Начальный шанс критического выстрела', CRITICAL_CHANCE_DELTA: 'Прирост шанса критического выстрела',
    AFTER_CRIT_CRITICAL_HIT_CHANCE: 'Шанс критического выстрела после критического попадания',
    CRITICAL_HIT_CHANCE: 'Шанс критического выстрела', WEAPON_RELOAD_TIME: 'Время перезарядки',
    WEAPON_CHARGING_TIME: 'Разогрев перед выстрелом', WEAPON_CHARGE_RATE: 'Скорость восстановления энергии', WEAPON_DISCHARGE_RATE: 'Расход энергии',
    DISCHARGE_SPEED: 'Расход энергии в режиме атаки', ENERGY_PER_SHOT: 'Расход энергии на выстрел',
    CONE_ANGLE: 'Угол конуса', SHOT_RANGE: 'Дальность поражения', HIGHLIGHTING_DISTANCE: 'Дальность подсветки противника',
    WEAPON_MAX_DAMAGE_RADIUS: 'Дальность полного поражения', WEAPON_MIN_DAMAGE_RADIUS: 'Дальность слабого поражения',
    WEAPON_MIN_DAMAGE_PERCENT: 'Процент слабого поражения', WEAPON_WEAKENING_COEFF: 'Коэффициент ослабления урона при простреле',
    WEAPON_ANGLE_UP: 'Угол автоприцела вверх', WEAPON_ANGLE_DOWN: 'Угол автоприцела вниз',
    HEAT_PER_PERIOD: 'Скорость нагрева', FREEZE_PER_TICK: 'Скорость заморозки', FLAME_TEMPERATURE_LIMIT: 'Максимальная температура',
    IMPACT_FORCE: 'Сила удара', WEAPON_KICKBACK: 'Отдача пушки', GRENADE_DAMAGE: 'Урон гранаты',
    ISIS_HEALING_PER_PERIOD: 'Лечение за тик', ISIS_DISCHARGE_SPEED_HEALING: 'Расход энергии в режиме лечения',
    ISIS_DISCHARGE_SPEED_IDLE: 'Расход энергии в холостом режиме', ISIS_VAMPIRING_PERCENT: 'Доля наносимого урона, восстанавливающая здоровье',
    CRITICAL_HEALING_HITS: 'Критическое лечение', MAX_CRITICAL_HEALING_CHANCE: 'Максимальный шанс критического лечения',
    START_CRITICAL_HEALING_CHANCE: 'Начальный шанс критического лечения',
    CRITICAL_HEALING_CHANCE_DELTA: 'Прирост шанса критического лечения',
    TESLA_GLOBE_SPEED: 'Скорость шаровой молнии', TESLA_GLOBE_DISTANCE: 'Дальность полёта шаровой молнии',
    TESLA_GLOBE_DAMAGE: 'Урон шаровой молнии', TESLA_GLOBE_CHARGE_MS: 'Время перезарядки шаровой молнии',
    TESLA_GLOBE_PREPARE_MS: 'Время разогрева шаровой молнии', TESLA_EACH_TARGET_DAMAGE: 'Дополнительный урон за каждую цель в цепочке',
    TESLA_CASCADE_GLOBE_RADIUS: 'Радиус добавления шаровой молнии в цепочку', TESLA_CASCADE_ALLY_TANK_RADIUS: 'Радиус добавления союзника в цепочку',
    TESLA_CASCADE_ENEMY_TANK_RADIUS: 'Радиус добавления противника в цепочку', MAX_RICOCHET_COUNT: 'Максимальное число рикошетов',
    SHELL_SPEED: 'Скорость снаряда', MIN_SHELL_SPEED: 'Минимальная скорость снаряда', MAX_SHELL_SPEED: 'Максимальная скорость снаряда',
    SHELL_SPEED_AFTER_RICOCHET: 'Скорость снаряда после рикошета', SHELL_BOOST_PHASE_DURATION: 'Время разгона снаряда',
    SHELL_MAX_RICOCHET_ANGLE: 'Предельный угол рикошета', SHELL_GRAVITY_COEF: 'Коэффициент гравитации снаряда',
    SHELL_SPEEDS_COUNT: 'Число шагов набора заряда', SHELL_RADIUS: 'Радиус снаряда',
    SPLASH_DAMAGE_RADIUS: 'Предельный радиус поражения взрывом', CRITICAL_SPLASH_DAMAGE_RADIUS: 'Радиус критического поражения взрывом',
    RADIUS_OF_MAX_SPLASH_DAMAGE: 'Радиус полного поражения взрывом',
    RADIUS_OF_FIRST_DIMINUTION_SPLASH_DAMAGE: 'Радиус промежуточного поражения взрывом',
    FIRST_DIMINUTION_SPLASH_DAMAGE_PERCENT: 'Процент промежуточного поражения взрывом',
    MIN_SPLASH_DAMAGE_PERCENT: 'Процент слабого поражения взрывом', SPLASH_DAMAGE_IMPACT: 'Сила удара взрыва',
    ELLIPTIC_CONE_HORIZONTAL_ANGLE: 'Горизонтальный угол разброса', ELLIPTIC_CONE_VERTICAL_ANGLE: 'Вертикальный угол разброса',
    SHOTGUN_MAGAZINE_SIZE: 'Зарядов в обойме', SHOTGUN_PELLET_COUNT: 'Число дробинок на выстрел',
    MAGAZINE_RELOAD_TIME: 'Время перезарядки обоймы', SALVO_SIZE: 'Ракет в залпе',
    SALVO_AIMING_TIME: 'Время наведения', SALVO_AIMING_GRACE_PERIOD: 'Время восстановления наведения',
    TIME_BETWEEN_SHOTS_OF_SALVO: 'Пауза между выстрелами в залпе', SALVO_RELOAD_TIME: 'Время перезарядки после залпа',
    ROCKET_MIN_ANGULAR_SPEED: 'Начальная угловая скорость ракеты', ROCKET_MAX_ANGULAR_SPEED: 'Конечная угловая скорость ракеты',
    MACHINE_GUN_WEAPON_TURN_DECELERATION_COEFF: 'Коэффициент замедления поворота пулемёта',
    MACHINE_GUN_SPIN_DOWN_TIME_SECOND: 'Время остановки стволов', MACHINE_GUN_SPIN_UP_TIME_SECOND: 'Время раскрутки стволов',
    MACHINE_GUN_TEMPERATURE_HITTING_TIME_SECOND: 'Время до перегрева',
    DEVICE_TARGET_HEAT_DELTA_ON_SELF_OVERHEAT: 'Нагрев цели при собственном перегреве',
    DEVICE_BONUS_ENERGY_ON_KILL: 'Восстановление энергии при уничтожении цели', DEVICE_BONUS_ENERGY_ON_DAMAGE: 'Восстановление энергии при нанесении урона',
    ALLY_HEALING_MODE: 'Режим лечения союзников', CASSETTE_COMBO_ADDITIONAL_DAMAGE: 'Дополнительный урон комбо',
    CASSETTE_HOLD: 'Удержание кассеты', AIMED_RADIUS_OF_FIRST_DIMINUTION_SPLASH_DAMAGE: 'Радиус промежуточного поражения взрывом прицельного выстрела',
    AIMED_SPLASH_DAMAGE_RADIUS: 'Предельный радиус поражения взрывом прицельного выстрела', AIMED_RADIUS_OF_MAX_SPLASH_DAMAGE: 'Радиус полного поражения взрывом прицельного выстрела',
    AIMED_SHOT_IMPACT: 'Сила удара прицельного выстрела', AIMED_SPLASH_DAMAGE_IMPACT: 'Сила удара взрыва прицельного выстрела',
    SECONDARY_MAX_SHELL_SPEED: 'Максимальная скорость вторичного снаряда', SECONDARY_MIN_SHELL_SPEED: 'Минимальная скорость вторичного снаряда',
    SECONDARY_SHELL_BOOST_PHASE_DURATION: 'Время разгона вторичного снаряда',
    SECONDARY_DAMAGE_FIXED: 'Урон вторичного выстрела', SECONDARY_WEAPON_KICKBACK: 'Отдача вторичного выстрела',
    SHAFT_AIMING_MODE_MAX_DAMAGE: 'Максимальный урон прицельного выстрела', SHAFT_AIMING_MODE_MIN_DAMAGE: 'Минимальный урон прицельного выстрела',
    SHAFT_MIN_AIMED_SHOT_ENERGY: 'Минимальная энергия на прицельный выстрел', SHAFT_FAST_SHOT_ENERGY: 'Энергия на выстрел навскидку',
    SHAFT_HORIZONTAL_TARGETING_SPEED: 'Скорость прицеливания по горизонтали', SHAFT_AIMED_SHOT_IMPACT: 'Сила удара прицельного выстрела Шафта',
    ULTIMATE_CHARGE_PER_SEC: 'Заряд овердрайва от времени', ULTIMATE_CHARGE_PER_SCORE_POINT: 'Заряд овердрайва от очков',
    HULL_SIDE_ACCELERATION: 'Боковое ускорение корпуса', HULL_REVERSE_TURN_ACCELERATION: 'Ускорение обратного поворота корпуса',
    HULL_TURN_STABILIZATION_ACCELERATION: 'Ускорение стабилизации поворота', HULL_REVERSE_ACCELERATION: 'Ускорение заднего хода',
    HULL_DECELERATION: 'Замедление корпуса', FIREBIRD_RESISTANCE: 'Защита от Огнемёта',
    FIREBIRD_OVERHEAT_RESISTANCE: 'Защита от урона горения', SMOKY_RESISTANCE: 'Защита от Смоки',
    TSUNAMI_RESISTANCE: 'Защита от Цунами', SCORPIO_RESISTANCE: 'Защита от Скорпиона', TWINS_RESISTANCE: 'Защита от Твинса',
    RAILGUN_RESISTANCE: 'Защита от Рельсы', ISIS_RESISTANCE: 'Защита от Изиды', MINE_RESISTANCE: 'Защита от мин',
    THUNDER_RESISTANCE: 'Защита от Грома', FREEZE_RESISTANCE: 'Защита от Фриза', RICOCHET_RESISTANCE: 'Защита от Рикошета',
    SHAFT_RESISTANCE: 'Защита от Шафта', MACHINE_GUN_RESISTANCE: 'Защита от Вулкана', SHOTGUN_RESISTANCE: 'Защита от Молота',
    ROCKET_LAUNCHER_RESISTANCE: 'Защита от Страйкера', ARTILLERY_RESISTANCE: 'Защита от Магнума',
    TERMINATOR_RESISTANCE: 'Защита от Терминатора', GAUSS_RESISTANCE: 'Защита от Гаусса', TESLA_RESISTANCE: 'Защита от Теслы',
    CRITICAL_RESISTANCE: 'Защита от критического урона', ALL_RESISTANCE: 'Защита от всех видов урона', CHAOS_RESISTANCE: 'Защита от Хаоса',
    SHAFT_VERTICAL_TARGETING_SPEED: 'Скорость прицеливания по вертикали',
    SHAFT_AIMING_MODE_CHARGE_RATE: 'Скорость зарядки прицельного выстрела', SHAFT_ROTATION_DECELERATION_COEFF: 'Коэффициент замедления поворота башни в прицельном режиме',
    EFFECT_RADIUS: 'Радиус эффекта', EFFECT_TIME_MS: 'Время действия эффекта',
    AFTER_CRIT_CRITICAL_HEALING_CHANCE: 'Шанс критического лечения после критического лечения', CRITICAL_HEALING_CHANCE: 'Шанс критического лечения',
    DETONATE_CRITICAL_SPLASH_DAMAGE_RADIUS: 'Радиус критического взрыва при детонации',
    DETONATE_SPLASH_DAMAGE_RADIUS: 'Предельный радиус поражения взрывом при детонации', DETONATE_RADIUS_OF_MAX_SPLASH_DAMAGE: 'Радиус полного поражения взрывом при детонации',
    DETONATE_RADIUS_OF_FIRST_DIMINUTION_SPLASH_DAMAGE: 'Радиус промежуточного поражения взрывом при детонации',
    DETONATE_FIRST_DIMINUTION_SPLASH_DAMAGE_PERCENT: 'Процент промежуточного поражения взрывом при детонации',
    DETONATE_MIN_SPLASH_DAMAGE_PERCENT: 'Процент слабого поражения взрывом при детонации', DETONATE_SPLASH_DAMAGE_IMPACT: 'Сила удара взрыва при детонации',
    ISIS_INCREASE_TARGET_TEMPERATURE_PER_TICK: 'Скорость нагрева цели Изидой',
    ISIS_DECREASE_TARGET_TEMPERATURE_PER_TICK: 'Скорость охлаждения цели Изидой',
    MACHINE_GUN_SELF_TEMPERATURE_INCREASE_PER_SECOND: 'Собственный нагрев Вулкана в секунду',
    MACHINE_GUN_OVERHEAT_DAMAGE_COEFF: 'Коэффициент урона при перегреве Вулкана',
    MACHINE_GUN_POWER_WHEN_TANK_TEMPERATURE_START_INCREASE: 'Мощность Вулкана при начале нагрева',
    SHOTGUN_MAX_DAMAGING_PELLET_COUNT: 'Максимальное число дробин, наносящих урон', DURATION_IN_TICKS: 'Длительность в тактах',
    MOVEMENT_SPEED_SCALE: 'Множитель скорости движения', RICOCHET_SPEED_SCALE_MIN: 'Минимальный множитель скорости после рикошета',
    RICOCHET_SPEED_SCALE_MAX: 'Максимальный множитель скорости после рикошета', STOP_SPEED: 'Скорость остановки', MAX_TIME_MS: 'Предельное время',
    SECONDARY_DAMAGE_FROM: 'Минимальный урон вторичного выстрела', SECONDARY_DAMAGE_TO: 'Максимальный урон вторичного выстрела',
    DRONE_RELOAD: 'Перезарядка дрона', DRONE_REPAIR_HEALTH: 'Лечение дрона', DRONE_REPAIR_RADIUS: 'Радиус лечения дрона',
    DRONE_INVENTORY: 'Запас припасов дрона', DRONE_INVENTORY_ADD: 'Дополнительные припасы дрона',
    DRONE_BONUS_ADD: 'Дополнительные бонусы дрона', DRONE_FIRST_AID_BONUS_ADD: 'Дополнительные аптечки дрона',
    DRONE_OVERDRIVE_BOOST: 'Ускорение овердрайва дроном', DRONE_INVENTORY_RADIUS: 'Радиус действия припасов дрона',
    DRONE_COOLDOWN_RADIUS: 'Радиус ускорения перезарядки припасов', DRONE_DEFEND: 'Защита дрона', DRONE_ARMOR_BOOST: 'Усиление брони дроном',
    DRONE_MINE: 'Мины дрона', DRONE_ADDITIONAL_MINES: 'Дополнительные мины дрона', DRONE_MINES_ACTIVATION_DELAY: 'Задержка активации мин дрона',
    DRONE_INVENTORY_COOLDOWN_BOOST: 'Ускорение перезарядки припасов дроном',
    DRONE_INVENTORY_COOLDOWN_SUBTRACTION_ON_KILL: 'Сокращение перезарядки припасов за уничтожение',
    DRONE_INVENTORY_COOLDOWN_SUBTRACTION: 'Сокращение перезарядки припасов', DRONE_MINES_PLACEMENT_RADIUS: 'Радиус установки мин дрона',
    DRONE_POWER_BOOST: 'Усиление урона дроном', DRONE_POWER_DURATION: 'Длительность усиления урона дроном',
    DRONE_CRITICAL_HEALTH: 'Порог критического здоровья дрона', DRONE_CONSTANT_ARMOR_PERCENT: 'Постоянное усиление брони дроном',
    DRONE_CONSTANT_POWER_PERCENT: 'Постоянное усиление урона дроном', DRONE_SUPPORT_SCORE_FACTOR: 'Множитель очков поддержки дрона',
    DRONE_ARMOR_PERCENT: 'Усиление брони дроном', DRONE_DAMAGE_PERCENT: 'Усиление урона дроном',
    DRONE_HULL_SPEED_PERCENT: 'Усиление скорости корпуса дроном', DRONE_HULL_ACCELERATION_PERCENT: 'Усиление ускорения корпуса дроном',
    DRONE_TURRET_ROTATION_SPEED_PERCENT: 'Усиление поворота башни дроном',
    DRONE_DEPENDENT_INVENTORY_COOLDOWN: 'Связанная перезарядка припасов',
    DRONE_DOUBLE_DAMAGE_COOLDOWN_BOOST_PERCENT: 'Ускорение перезарядки двойного урона',
    ULTIMATE_HEAL_HP: 'Лечение овердрайвом', DEVICE_TEMPERATURE_NORMALIZATION: 'Нормализация температуры устройством',
    DEVICE_HEAT_PER_PELLET: 'Нагрев за дробину', DEVICE_SMOKY_TEMPERATURE_DELTA_ON_CRITICAL: 'Изменение температуры от крита Смоки',
    ULTIMATE_SCORE_COOLDOWN_SEC: 'Интервал зарядки овердрайва за очки',
    ULTIMATE_ACTIVATION_DISCHARGE_PER_SEC: 'Расход заряда активного овердрайва в секунду', ULTIMATE_SPLASH_DAMAGE: 'Взрывной урон овердрайва',
    AIMED_MIN_SPLASH_DAMAGE_PERCENT: 'Процент слабого поражения взрывом прицельного выстрела',
    AIMED_FIRST_DIMINUTION_SPLASH_DAMAGE_PERCENT: 'Процент промежуточного поражения взрывом прицельного выстрела',
    TESLA_GLOBE_VERTICAL_AIMING_DISTANCE: 'Вертикальная дальность наведения шаровой молнии',
    AURA_ALLY_RADIUS: 'Радиус ауры для союзников', AURA_ENEMY_RADIUS: 'Радиус ауры для противников',
    PALADIN_HEALING_PER_PERIOD: 'Лечение Паладина за тик', MAX_ROCKET_RISING_AFTER_DESCENT: 'Предельный подъём ракеты после снижения',
    EMP_ENABLED: 'Электромагнитный импульс', MINE_DISPEL_RADIUS: 'Радиус обезвреживания мин',
    AUTOFIRE_RECHARGE_INTERVAL_MS: 'Интервал перезарядки автоматического огня',
    DRONE_DEPENDENT_INVENTORY_COOLDOWN_DAMAGE_TO_ARMOR: 'Связь перезарядки урона с бронёй',
    DRONE_DEPENDENT_INVENTORY_COOLDOWN_DAMAGE_TO_SPEED: 'Связь перезарядки урона со скоростью',
    DRONE_DEPENDENT_INVENTORY_COOLDOWN_ARMOR_TO_DAMAGE: 'Связь перезарядки брони с уроном',
    DRONE_DEPENDENT_INVENTORY_COOLDOWN_ARMOR_TO_SPEED: 'Связь перезарядки брони со скоростью',
    DRONE_DEPENDENT_INVENTORY_COOLDOWN_SPEED_TO_ARMOR: 'Связь перезарядки скорости с бронёй',
    DRONE_DEPENDENT_INVENTORY_COOLDOWN_SPEED_TO_DAMAGE: 'Связь перезарядки скорости с уроном',
};

export function augmentPropertyLabel(property: string, language: 'RU' | 'EN'): string {
    if (language === 'RU' && russian[property]) return russian[property];
    const text = property.replace(/^ISIS_/, 'ISIDA_').replace(/^MACHINE_GUN_/, 'VULCAN_')
        .replace(/^SHOTGUN_/, 'HAMMER_').replace(/^ROCKET_LAUNCHER_/, 'STRIKER_')
        .replace(/^SCORPIO_/, 'SCORPION_').toLowerCase().replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Localized names are accepted only when they resolve to exactly one protocol property. */
export function resolveAugmentProperty(input: string): string | null {
    const text = input.trim();
    if (/^[A-Z][A-Z0-9_]{0,100}$/.test(text)) return text;
    const normalized = text.toLowerCase().replace(/\s+/g, ' ');
    const matches = Object.keys(russian).filter(property => ['RU', 'EN'].some(language =>
        augmentPropertyLabel(property, language as 'RU' | 'EN').toLowerCase().replace(/\s+/g, ' ') === normalized));
    return matches.length === 1 ? matches[0] : null;
}

const higherBetter = new Set(['HULL_ARMOR', 'HULL_SPEED', 'HULL_ACCELERATION', 'HULL_TURN_SPEED',
    'TURRET_TURN_SPEED', 'TURRET_ROTATION_ACCELERATION', 'DAMAGE_FIXED', 'DAMAGE_FROM', 'DAMAGE_TO',
    'DAMAGE_PER_HIT', 'DAMAGE_PER_PERIOD', 'DAMAGE_PER_SECOND', 'CRITICAL_HIT_DAMAGE', 'SHOT_RANGE',
    'WEAPON_MAX_DAMAGE_RADIUS', 'WEAPON_MIN_DAMAGE_RADIUS', 'ISIS_HEALING_PER_PERIOD', 'IMPACT_FORCE',
    'WEAPON_ANGLE_UP', 'WEAPON_ANGLE_DOWN']);
const lowerBetter = new Set(['WEAPON_RELOAD_TIME', 'WEAPON_CHARGING_TIME', 'MAGAZINE_RELOAD_TIME',
    'SALVO_RELOAD_TIME', 'ENERGY_PER_SHOT', 'DISCHARGE_SPEED', 'ISIS_DISCHARGE_SPEED_HEALING']);

[
    'HULL_SIDE_ACCELERATION', 'HULL_TURN_ACCELERATION', 'HULL_REVERSE_TURN_ACCELERATION', 'HULL_REVERSE_ACCELERATION',
    'MAX_CRITICAL_HIT_CHANCE', 'START_CRITICAL_HIT_CHANCE', 'AFTER_CRIT_CRITICAL_HIT_CHANCE', 'CRITICAL_CHANCE_DELTA', 'CRITICAL_HIT_CHANCE',
    'CRITICAL_HEALING_HITS', 'MAX_CRITICAL_HEALING_CHANCE', 'START_CRITICAL_HEALING_CHANCE',
    'AFTER_CRIT_CRITICAL_HEALING_CHANCE', 'CRITICAL_HEALING_CHANCE_DELTA', 'CRITICAL_HEALING_CHANCE',
    'HEAT_PER_PERIOD', 'FREEZE_PER_TICK', 'FLAME_TEMPERATURE_LIMIT', 'WEAPON_CHARGE_RATE',
    'GRENADE_DAMAGE', 'WEAPON_MIN_DAMAGE_PERCENT', 'ISIS_VAMPIRING_PERCENT', 'TESLA_GLOBE_DAMAGE',
    'TESLA_GLOBE_SPEED', 'TESLA_GLOBE_DISTANCE', 'TESLA_EACH_TARGET_DAMAGE', 'TESLA_CASCADE_ENEMY_TANK_RADIUS',
    'TESLA_CASCADE_ALLY_TANK_RADIUS', 'TESLA_CASCADE_GLOBE_RADIUS', 'TESLA_GLOBE_VERTICAL_AIMING_DISTANCE',
    'SHAFT_AIMING_MODE_MIN_DAMAGE', 'SHAFT_AIMING_MODE_MAX_DAMAGE', 'SHAFT_AIMING_MODE_CHARGE_RATE',
    'SHAFT_VERTICAL_TARGETING_SPEED', 'SHAFT_HORIZONTAL_TARGETING_SPEED', 'SHAFT_AIMED_SHOT_IMPACT',
    'SHELL_SPEED', 'MIN_SHELL_SPEED', 'MAX_SHELL_SPEED', 'SHELL_SPEED_AFTER_RICOCHET', 'MAX_RICOCHET_COUNT',
    'SECONDARY_MIN_SHELL_SPEED', 'SECONDARY_MAX_SHELL_SPEED', 'SECONDARY_DAMAGE_FROM', 'SECONDARY_DAMAGE_TO', 'SECONDARY_DAMAGE_FIXED',
    'SHOTGUN_MAGAZINE_SIZE', 'SHOTGUN_PELLET_COUNT', 'SHOTGUN_MAX_DAMAGING_PELLET_COUNT', 'SALVO_SIZE',
    'ROCKET_MIN_ANGULAR_SPEED', 'ROCKET_MAX_ANGULAR_SPEED', 'SALVO_AIMING_GRACE_PERIOD', 'HIGHLIGHTING_DISTANCE',
    'ULTIMATE_CHARGE_PER_SEC', 'ULTIMATE_CHARGE_PER_SCORE_POINT', 'ULTIMATE_HEAL_HP', 'ULTIMATE_SPLASH_DAMAGE',
    'PALADIN_HEALING_PER_PERIOD', 'DEVICE_BONUS_ENERGY_ON_KILL', 'DEVICE_BONUS_ENERGY_ON_DAMAGE',
    'CASSETTE_COMBO_ADDITIONAL_DAMAGE', 'MINE_DISPEL_RADIUS', 'DRONE_REPAIR_HEALTH', 'DRONE_REPAIR_RADIUS',
].forEach(property => higherBetter.add(property));
Object.keys(russian).filter(property => property.endsWith('_RESISTANCE')).forEach(property => higherBetter.add(property));
[
    'TIME_BETWEEN_SHOTS_OF_SALVO', 'SALVO_AIMING_TIME', 'TESLA_GLOBE_CHARGE_MS', 'TESLA_GLOBE_PREPARE_MS',
    'ISIS_DISCHARGE_SPEED_IDLE', 'MACHINE_GUN_SPIN_UP_TIME_SECOND', 'MACHINE_GUN_SELF_TEMPERATURE_INCREASE_PER_SECOND',
    'SHAFT_FAST_SHOT_ENERGY', 'SHAFT_MIN_AIMED_SHOT_ENERGY', 'SHAFT_ROTATION_DECELERATION_COEFF',
    'MACHINE_GUN_WEAPON_TURN_DECELERATION_COEFF', 'DRONE_RELOAD', 'ULTIMATE_SCORE_COOLDOWN_SEC',
    'ULTIMATE_ACTIVATION_DISCHARGE_PER_SEC', 'AUTOFIRE_RECHARGE_INTERVAL_MS',
].forEach(property => lowerBetter.add(property));
Object.keys(russian).filter(property => /SPLASH_DAMAGE_RADIUS|RADIUS_OF_MAX_SPLASH_DAMAGE|MIN_SPLASH_DAMAGE_PERCENT|SPLASH_DAMAGE_IMPACT/.test(property))
    .forEach(property => higherBetter.add(property));

export function augmentPropertyBenefit(property: string, delta: number): 'advantage' | 'disadvantage' | 'neutral' {
    if (!delta || !higherBetter.has(property) && !lowerBetter.has(property)) return 'neutral';
    return (higherBetter.has(property) ? delta > 0 : delta < 0) ? 'advantage' : 'disadvantage';
}
