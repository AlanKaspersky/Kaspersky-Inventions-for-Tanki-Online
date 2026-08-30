(function() {
    'use strict';

    if (localStorage.getItem('k_paints') === 'false') return;

    const paintsData: Record<string, { ru: string, en: string }> = {
        "https://s.eu.tankionline.com/610/51502/256/167/30665401302161/image.webp": { ru: "Яблоко", en: "Apple" },
        "https://s.eu.tankionline.com/0/0/345/373/30665401773004/image.webp": { ru: "Чёрный", en: "Black" },
        "https://s.eu.tankionline.com/610/51504/135/233/30665401712275/image.webp": { ru: "Синева", en: "Blueness" },
        "https://s.eu.tankionline.com/610/51505/266/323/30665402212314/image.webp": { ru: "Коралловый", en: "Coral" },
        "https://s.eu.tankionline.com/610/51507/21/304/30665402346630/image.webp": { ru: "Золотой", en: "Gold" },
        "https://s.eu.tankionline.com/0/0/346/26/30665402464532/image.webp": { ru: "Бордовый", en: "Maroon" },
        "https://s.eu.tankionline.com/615/77267/340/1/30665402622031/image.webp": { ru: "Горчичный", en: "Mustard" },
        "https://s.eu.tankionline.com/610/51507/323/254/30665402716674/image.webp": { ru: "Красный", en: "Red" },
        "https://s.eu.tankionline.com/0/0/346/31/30665403002077/image.webp": { ru: "Белый", en: "White" },
        "https://s.eu.tankionline.com/610/51503/307/55/30665401622061/image.webp": { ru: "Морской", en: "Aquamarine" },
        "https://s.eu.tankionline.com/610/51505/36/167/30665402033526/image.webp": { ru: "Синий", en: "Blue" },
        "https://s.eu.tankionline.com/615/77267/164/54/30665402113242/image.webp": { ru: "Штиль", en: "Calm" },
        "https://s.eu.tankionline.com/610/51506/121/154/30665402257565/image.webp": { ru: "Фуксия", en: "Fuchsia" },
        "https://s.eu.tankionline.com/0/0/346/7/30665402406616/image.webp": { ru: "Зелёный", en: "Green" },
        "https://s.eu.tankionline.com/0/0/346/23/30665402552347/image.webp": { ru: "Металлик", en: "Metallic" },
        "https://s.eu.tankionline.com/610/51507/143/230/30665402661542/image.webp": { ru: "Оранжевый", en: "Orange" },
        "https://s.eu.tankionline.com/610/51510/143/147/30665402752466/image.webp": { ru: "Индиго", en: "Violet" },
        "https://s.eu.tankionline.com/610/51510/306/262/30665403031674/image.webp": { ru: "Жёлтый", en: "Yellow" },
        "https://s.eu.tankionline.com/0/114/122/53/27006222460710/image.webp": { ru: "Болотный", en: "Swamp" },
        "https://s.eu.tankionline.com/0/16722/56/160/27006222456766/image.webp": { ru: "Вихрь", en: "Vortex" },
        "https://s.eu.tankionline.com/0/16722/56/147/27006222107011/image.webp": { ru: "Вишня", en: "Cherry" },
        "https://s.eu.tankionline.com/0/114/143/73/27006221272003/image.webp": { ru: "Буря", en: "Storm" },
        "https://s.eu.tankionline.com/0/114/144/10/27006222040251/image.webp": { ru: "Кедр", en: "Cedar" },
        "https://s.eu.tankionline.com/0/16722/363/263/27006221311216/image.webp": { ru: "Конфетти", en: "Confetti" },
        "https://s.eu.tankionline.com/0/114/144/5/27006222511333/image.webp": { ru: "Тина", en: "Clay" },
        "https://s.eu.tankionline.com/0/114/143/71/27006221600016/image.webp": { ru: "Ржавчина", en: "Corrosion" },
        "https://s.eu.tankionline.com/0/114/114/116/27006221345363/image.webp": { ru: "Пустыня", en: "Desert" },
        "https://s.eu.tankionline.com/0/114/122/54/27006222004654/image.webp": { ru: "Грязь", en: "Dirty" },
        "https://s.eu.tankionline.com/0/114/122/35/27006221774672/image.webp": { ru: "Диджитал", en: "Digital" },
        "https://s.eu.tankionline.com/0/0/346/1/27006222172671/image.webp": { ru: "Флора", en: "Flora" },
        "https://s.eu.tankionline.com/0/0/346/4/27006221360532/image.webp": { ru: "Лесник", en: "Forester" },
        "https://s.eu.tankionline.com/0/16723/6/10/27006221675320/image.webp": { ru: "Луга", en: "Grasslands" },
        "https://s.eu.tankionline.com/0/16722/56/150/27006221160055/image.webp": { ru: "Излом", en: "Fracture" },
        "https://s.eu.tankionline.com/0/16722/56/152/27006221620055/image.webp": { ru: "Партизан", en: "Guerrilla" },
        "https://s.eu.tankionline.com/0/114/164/72/27006221465341/image.webp": { ru: "Нефрит", en: "Jade" },
        "https://s.eu.tankionline.com/0/16722/35/13/27006222126710/image.webp": { ru: "Магма", en: "Magma" },
        "https://s.eu.tankionline.com/0/114/143/70/27006221307720/image.webp": { ru: "Глина", en: "Loam" },
        "https://s.eu.tankionline.com/0/114/114/117/27006222147205/image.webp": { ru: "Морпех", en: "Marine" },
        "https://s.eu.tankionline.com/0/16722/35/14/27006221161746/image.webp": { ru: "Марс", en: "Mars" },
        "https://s.eu.tankionline.com/0/114/164/73/27006221641671/image.webp": { ru: "Хвоя", en: "Needle" },
        "https://s.eu.tankionline.com/0/16722/363/270/27006221367462/image.webp": { ru: "Мох", en: "Moss" },
        "https://s.eu.tankionline.com/0/114/164/74/27006221724642/image.webp": { ru: "Пикассо", en: "Picasso" },
        "https://s.eu.tankionline.com/0/16722/35/16/27006222463703/image.webp": { ru: "Пиксель", en: "Pixel" },
        "https://s.eu.tankionline.com/0/16723/6/7/27006222201062/image.webp": { ru: "Кирпич", en: "Red Urban" },
        "https://s.eu.tankionline.com/0/114/144/4/27006222571116/image.webp": { ru: "Продиджи", en: "Prodigi" },
        "https://s.eu.tankionline.com/0/114/144/6/27006222130055/image.webp": { ru: "Скала", en: "Rock" },
        "https://s.eu.tankionline.com/0/114/143/67/27006221553372/image.webp": { ru: "Шелест", en: "Rustle" },
        "https://s.eu.tankionline.com/0/114/114/120/27006221763556/image.webp": { ru: "Саванна", en: "Savanna" },
        "https://s.eu.tankionline.com/0/114/144/7/27006221241430/image.webp": { ru: "Песчаник", en: "Sandstone" },
        "https://s.eu.tankionline.com/0/114/144/23/27006222217203/image.webp": { ru: "Тайга", en: "Taiga" },
        "https://s.eu.tankionline.com/0/114/143/23/27006222577770/image.webp": { ru: "Прибой", en: "Swash" },
        "https://s.eu.tankionline.com/0/114/122/77/27006221506670/image.webp": { ru: "Тундра", en: "Tundra" },
        "https://s.eu.tankionline.com/0/114/114/121/27006222300055/image.webp": { ru: "Урбан", en: "Urban" },
        "https://s.eu.tankionline.com/0/114/122/100/27006222106152/image.webp": { ru: "Метель", en: "Winter" },
        "https://s.eu.tankionline.com/0/16722/56/145/27006221320031/image.webp": { ru: "Африка", en: "Africa" },
        "https://s.eu.tankionline.com/0/114/122/76/27006221421046/image.webp": { ru: "Чужой", en: "Alien" },
        "https://s.eu.tankionline.com/0/16722/56/146/27006221660131/image.webp": { ru: "Кузнец", en: "Blacksmith" },
        "https://s.eu.tankionline.com/0/16722/35/11/27006222260322/image.webp": { ru: "Атом", en: "Atom" },
        "https://s.eu.tankionline.com/0/114/122/33/27006222457574/image.webp": { ru: "Карбон", en: "Carbon" },
        "https://s.eu.tankionline.com/0/16722/35/12/27006221454065/image.webp": { ru: "Кольчуга", en: "Chainmail" },
        "https://s.eu.tankionline.com/0/114/121/374/27006222410011/image.webp": { ru: "Дракон", en: "Dragon" },
        "https://s.eu.tankionline.com/0/16722/363/264/27006221275703/image.webp": { ru: "Диско", en: "Disco" },
        "https://s.eu.tankionline.com/0/114/122/10/27006222065210/image.webp": { ru: "Электра", en: "Electra" },
        "https://s.eu.tankionline.com/0/114/156/132/27006221700047/image.webp": { ru: "Изумруд", en: "Emerald" },
        "https://s.eu.tankionline.com/0/16722/56/151/27006222315470/image.webp": { ru: "Граффити", en: "Graffiti" },
        "https://s.eu.tankionline.com/0/16722/356/145/27006222441570/image.webp": { ru: "Первая любовь", en: "First Love" },
        "https://s.eu.tankionline.com/0/16722/363/262/27006222163347/image.webp": { ru: "Арлекин", en: "Harlequin" },
        "https://s.eu.tankionline.com/0/16722/56/153/27006221251741/image.webp": { ru: "Улей", en: "Hive" },
        "https://s.eu.tankionline.com/0/16722/62/44/27006221522631/image.webp": { ru: "С любовью", en: "In Love" },
        "https://s.eu.tankionline.com/0/114/143/72/27006221077354/image.webp": { ru: "Хохлома", en: "Hohloma" },
        "https://s.eu.tankionline.com/0/114/156/133/27006221515471/image.webp": { ru: "Инферно", en: "Inferno" },
        "https://s.eu.tankionline.com/0/16722/56/154/27006221775651/image.webp": { ru: "Захватчик", en: "Invader" },
        "https://s.eu.tankionline.com/0/114/121/373/27006222104133/image.webp": { ru: "Ягуар", en: "Jaguar" },
        "https://s.eu.tankionline.com/0/114/165/2/27006222043031/image.webp": { ru: "Ирбис", en: "Irbis" },
        "https://s.eu.tankionline.com/0/16722/363/265/27006222076140/image.webp": { ru: "Джинс", en: "Jeans" },
        "https://s.eu.tankionline.com/0/16722/363/266/27006221340470/image.webp": { ru: "Калейдоскоп", en: "Kaleidoscope" },
        "https://s.eu.tankionline.com/0/114/164/364/27006222435677/image.webp": { ru: "Свинец", en: "Lead" },
        "https://s.eu.tankionline.com/0/0/346/15/27006222002672/image.webp": { ru: "Лава", en: "Lava" },
        "https://s.eu.tankionline.com/0/16722/56/155/27006222406427/image.webp": { ru: "Дровосек", en: "Lumberjack" },
        "https://s.eu.tankionline.com/0/114/143/136/27006222514445/image.webp": { ru: "Мэри", en: "Mary" },
        "https://s.eu.tankionline.com/0/16722/356/142/27006221104503/image.webp": { ru: "Ночь", en: "Night" },
        "https://s.eu.tankionline.com/0/16722/35/15/27006222415677/image.webp": { ru: "Нано", en: "Nano" },
        "https://s.eu.tankionline.com/0/16722/356/143/27006221171207/image.webp": { ru: "Пиксельное сердце", en: "Pixel Heart" },
        "https://s.eu.tankionline.com/0/114/143/151/27006222417371/image.webp": { ru: "Питон", en: "Python" },
        "https://s.eu.tankionline.com/0/16722/56/156/27006221113616/image.webp": { ru: "Носорог", en: "Rhino" },
        "https://s.eu.tankionline.com/0/16722/57/136/27006221370133/image.webp": { ru: "Енот", en: "Raccoon" },
        "https://s.eu.tankionline.com/0/114/122/12/27006222631654/image.webp": { ru: "Роджер", en: "Roger" },
        "https://s.eu.tankionline.com/0/114/122/37/27006221321716/image.webp": { ru: "Сафари", en: "Safari" },
        "https://s.eu.tankionline.com/0/16722/56/157/27006221534130/image.webp": { ru: "Сакура", en: "Sakura" },
        "https://s.eu.tankionline.com/0/16722/363/271/27006221167111/image.webp": { ru: "Сахара", en: "Sahara" },
        "https://s.eu.tankionline.com/0/16722/356/144/27006221434314/image.webp": { ru: "Нежные цветы", en: "Soft Flowers" },
        "https://s.eu.tankionline.com/0/16722/356/147/27006221530264/image.webp": { ru: "Космос", en: "Space" },
        "https://s.eu.tankionline.com/0/16722/356/146/27006221314372/image.webp": { ru: "Свитер", en: "Sweater" },
        "https://s.eu.tankionline.com/0/114/143/22/27006222107667/image.webp": { ru: "Искра", en: "Spark" },
        "https://s.eu.tankionline.com/0/16722/35/17/27006221567326/image.webp": { ru: "Тигр", en: "Tiger" },
        "https://s.eu.tankionline.com/0/114/156/131/27006222562045/image.webp": { ru: "Зевс", en: "Zeus" },
        "https://s.eu.tankionline.com/561/25253/244/147/27045325460615/image.webp": { ru: "450 нанометров", en: "450 Nanometers" },
        "https://s.eu.tankionline.com/543/66600/306/44/27006221215024/image.webp": { ru: "Абстрактные линии", en: "Abstract lines" },
        "https://s.eu.tankionline.com/560/100572/177/232/27020213532655/image.webp": { ru: "Кольчуга Чужого", en: "Alien Chainmail" },
        "https://s.eu.tankionline.com/556/15763/63/224/27006222246213/image.webp": { ru: "Адам и Ева", en: "Adam and Eve" },
        "https://s.eu.tankionline.com/557/33756/273/64/27006221337475/image.webp": { ru: "Лакомства", en: "All the Goodies" },
        "https://s.eu.tankionline.com/0/16723/61/231/27006221374725/image.webp": { ru: "All you need is...", en: "All you need is..." },
        "https://s.eu.tankionline.com/551/134547/244/265/27006221220621/image.webp": { ru: "Древний дракон", en: "Ancient dragon" },
        "https://s.eu.tankionline.com/0/16723/6/4/27006221105565/image.webp": { ru: "Янтарь", en: "Amber" },
        "https://s.eu.tankionline.com/554/155641/323/232/27006221714250/image.webp": { ru: "Ролл", en: "And Roll" },
        "https://s.eu.tankionline.com/0/16722/363/261/27006221206475/image.webp": { ru: "Арахнид", en: "Arachnid" },
        "https://s.eu.tankionline.com/566/65737/174/260/27300443007050/image.webp": { ru: "Авангард", en: "Avant-garde" },
        "https://s.eu.tankionline.com/572/34560/260/240/27507134130621/image.webp": { ru: "Зона 52", en: "Area 52" },
        "https://s.eu.tankionline.com/541/26511/305/161/27006222405127/image.webp": { ru: "Лазурь", en: "Azure" },
        "https://s.eu.tankionline.com/562/104265/346/221/27121060073320/image.webp": { ru: "Барбекю", en: "BBQ" },
        "https://s.eu.tankionline.com/561/25253/244/152/27045325474033/image.webp": { ru: "Бабушкин диван", en: "Babushka's Sofa" },
        "https://s.eu.tankionline.com/560/100572/177/216/27020213562773/image.webp": { ru: "Бабушкино одеяло", en: "Babushka's Quilt" },
        "https://s.eu.tankionline.com/0/16723/135/43/27006221404600/image.webp": { ru: "Барбершоп", en: "Barber Shop" },
        "https://s.eu.tankionline.com/565/67401/230/250/27255700314460/image.webp": { ru: "Сигнальная лента", en: "Barricade tape" },
        "https://s.eu.tankionline.com/557/33760/20/363/27006221271365/image.webp": { ru: "Праздничные шарики", en: "Baubles Galore" },
        "https://s.eu.tankionline.com/562/45076/20/327/27111224665461/image.webp": { ru: "Морской бой", en: "Battleship" },
        "https://s.eu.tankionline.com/572/34561/142/36/27507134261373/image.webp": { ru: "Пляж", en: "Beach" },
        "https://s.eu.tankionline.com/0/16723/150/167/27006221656231/image.webp": { ru: "Орнитолог", en: "Birdwatcher" },
        "https://s.eu.tankionline.com/550/121244/103/315/27006221072331/image.webp": { ru: "Синий мармелад", en: "Blue marmalade" },
        "https://s.eu.tankionline.com/575/112017/254/57/27662403726310/image.webp": { ru: "Плед", en: "Blanket" },
        "https://s.eu.tankionline.com/554/41031/240/350/27006222114747/image.webp": { ru: "Голубая планета", en: "Blue planet" },
        "https://s.eu.tankionline.com/543/66601/376/323/27006221623352/image.webp": { ru: "Синий квадрат", en: "Blue square" },
        "https://s.eu.tankionline.com/561/61476/276/67/27054317755011/image.webp": { ru: "Греча", en: "Buckwheat" },
        "https://s.eu.tankionline.com/543/174435/215/332/27006222551734/image.webp": { ru: "Бриз", en: "Breeze" },
        "https://s.eu.tankionline.com/562/104266/247/135/27121057777722/image.webp": { ru: "Торт", en: "Cake" },
        "https://s.eu.tankionline.com/552/51373/273/336/27006222533350/image.webp": { ru: "Кэп", en: "Cap" },
        "https://s.eu.tankionline.com/0/16723/227/135/27006222314020/image.webp": { ru: "Остынь, приятель!", en: "Chill bro!" },
        "https://s.eu.tankionline.com/553/114363/13/372/27006221577644/image.webp": { ru: "Угольный", en: "Charred" },
        "https://s.eu.tankionline.com/575/112017/107/100/27662403644070/image.webp": { ru: "Сочельник", en: "Christmas Eve" },
        "https://s.eu.tankionline.com/543/66607/105/12/27006221477510/image.webp": { ru: "Сгущёнка", en: "Condensed milk" },
        "https://s.eu.tankionline.com/552/51375/14/113/27006221716651/image.webp": { ru: "Крушитель", en: "Crusher" },
        "https://s.eu.tankionline.com/561/142547/136/61/27070551514071/image.webp": { ru: "Креативный инженер", en: "Creative Engineer" },
        "https://s.eu.tankionline.com/562/44013/24/270/27111020506553/image.webp": { ru: "Дартс", en: "Darts" },
        "https://s.eu.tankionline.com/557/163200/333/73/27006222051501/image.webp": { ru: "Тёмно-синий пиксель", en: "Deep blue pixel" },
        "https://s.eu.tankionline.com/0/16722/374/164/27006221345672/image.webp": { ru: "Домино", en: "Domino" },
        "https://s.eu.tankionline.com/561/142545/333/15/27070551403070/image.webp": { ru: "Дизайнерская фантазия", en: "Designer Vibe" },
        "https://s.eu.tankionline.com/0/16723/6/6/27006222505673/image.webp": { ru: "Засуха", en: "Drought" },
        "https://s.eu.tankionline.com/543/66601/113/114/27006221672121/image.webp": { ru: "E236", en: "E236" },
        "https://s.eu.tankionline.com/567/130016/167/105/27366564516722/image.webp": { ru: "Пасха", en: "Easter" },
        "https://s.eu.tankionline.com/564/23017/366/262/27205227064243/image.webp": { ru: "Зоркий глаз", en: "Eagle eye" },
        "https://s.eu.tankionline.com/563/112371/226/202/27162476315066/image.webp": { ru: "Экозащита", en: "Ecofriendly" },
        "https://s.eu.tankionline.com/0/16722/232/2/27042003462661/image.webp": { ru: "Вечность", en: "Eternity" },
        "https://s.eu.tankionline.com/574/31046/56/214/27606211427470/image.webp": { ru: "Листопад", en: "Falling leaves" },
        "https://s.eu.tankionline.com/543/66602/165/224/27006222065140/image.webp": { ru: "Перья", en: "Feathers" },
        "https://s.eu.tankionline.com/0/16722/356/150/27006221203600/image.webp": { ru: "Иней", en: "Frost" },
        "https://s.eu.tankionline.com/543/66603/325/14/27006221425330/image.webp": { ru: "Огненный дракон", en: "Fire dragon" },
        "https://s.eu.tankionline.com/0/16723/104/51/27006221117405/image.webp": { ru: "Аппарат Гагарина", en: "Gagarin's Mount" },
        "https://s.eu.tankionline.com/566/115236/353/122/27322340117345/image.webp": { ru: "Геймпад", en: "Gamepad" },
        "https://s.eu.tankionline.com/561/25253/244/145/27045325501417/image.webp": { ru: "Синяя геометрия", en: "Gemetric Blue" },
        "https://s.eu.tankionline.com/563/112373/23/51/27162476612071/image.webp": { ru: "Геймер", en: "Gamer" },
        "https://s.eu.tankionline.com/553/3675/64/266/27006221716164/image.webp": { ru: "Подарочная упаковка", en: "Gift wrap" },
        "https://s.eu.tankionline.com/0/16723/135/40/27006222224152/image.webp": { ru: "Глитч", en: "Glitch" },
        "https://s.eu.tankionline.com/0/16722/356/151/27006222445101/image.webp": { ru: "Золотая звезда", en: "Golden Star" },
        "https://s.eu.tankionline.com/562/170135/37/100/27136027217677/image.webp": { ru: "Золотоискатель", en: "Gold digger" },
        "https://s.eu.tankionline.com/556/15765/70/16/27006221456716/image.webp": { ru: "Гриль", en: "Griller" },
        "https://s.eu.tankionline.com/541/26511/305/115/27006222173243/image.webp": { ru: "Гуччифляж", en: "Gucciflage" },
        "https://s.eu.tankionline.com/541/26511/305/125/27006221134323/image.webp": { ru: "Глюк", en: "Hallucination" },
        "https://s.eu.tankionline.com/0/16723/5/157/27006222263177/image.webp": { ru: "Хэллоуин", en: "Halloween" },
        "https://s.eu.tankionline.com/541/26511/305/123/27006221265532/image.webp": { ru: "Гиперкуб", en: "Hypercube" },
        "https://s.eu.tankionline.com/553/114364/152/155/27006222417236/image.webp": { ru: "Нефритовые весы", en: "Jade Scales" },
        "https://s.eu.tankionline.com/541/26511/305/137/27006222257104/image.webp": { ru: "Кунгурская пещера", en: "Kungur Ice Cave" },
        "https://s.eu.tankionline.com/554/155643/245/5/27006222241376/image.webp": { ru: "Спасатель", en: "Lifesaver" },
        "https://s.eu.tankionline.com/0/16722/356/162/27006222160273/image.webp": { ru: "Лайм", en: "Lime" },
        "https://s.eu.tankionline.com/0/16723/72/6/27006221753263/image.webp": { ru: "Лепестки сирени", en: "Lilac petals" },
        "https://s.eu.tankionline.com/0/16723/72/4/27006222627444/image.webp": { ru: "Взрыв лайма", en: "Lime burst" },
        "https://s.eu.tankionline.com/0/16722/363/267/27006222350323/image.webp": { ru: "Жидкий металл", en: "Liquid Metal" },
        "https://s.eu.tankionline.com/541/26511/305/145/27006222042110/image.webp": { ru: "Лоллипоп", en: "Lollipop" },
        "https://s.eu.tankionline.com/574/31047/144/204/27606211662506/image.webp": { ru: "Сруб", en: "Log cabin" },
        "https://s.eu.tankionline.com/541/26511/305/157/27006221203125/image.webp": { ru: "Лотос", en: "Lotus" },
        "https://s.eu.tankionline.com/0/16723/135/46/27006221154032/image.webp": { ru: "Лунный грунт", en: "Lunar Soil" },
        "https://s.eu.tankionline.com/543/66606/66/123/27006221146244/image.webp": { ru: "Мегаполис", en: "Megapolis" },
        "https://s.eu.tankionline.com/573/100606/271/263/27560141535043/image.webp": { ru: "Маскарад", en: "Masquerade" },
        "https://s.eu.tankionline.com/556/15765/240/206/27006221060421/image.webp": { ru: "Кирпичная кладка", en: "Miniature Masonry" },
        "https://s.eu.tankionline.com/0/16723/6/5/27006222204460/image.webp": { ru: "Мята", en: "Mint" },
        "https://s.eu.tankionline.com/541/26511/305/163/27006221250163/image.webp": { ru: "Моне", en: "Monet" },
        "https://s.eu.tankionline.com/575/46552/273/254/27652031776223/image.webp": { ru: "Мятный леденец", en: "Mint Candy" },
        "https://s.eu.tankionline.com/0/16717/262/247/27006221231453/image.webp": { ru: "Луноход", en: "Moonwalker" },
        "https://s.eu.tankionline.com/566/65742/2/271/27300443154776/image.webp": { ru: "Нейронная сеть", en: "Neural network" },
        "https://s.eu.tankionline.com/0/16722/356/163/27006222161460/image.webp": { ru: "Нейрон", en: "Neuron" },
        "https://s.eu.tankionline.com/540/66631/104/104/27006222041041/image.webp": { ru: "Новогодний подарок", en: "New Year Gift" },
        "https://s.eu.tankionline.com/571/125007/215/5/27465467435004/image.webp": { ru: "Оазис", en: "Oasis" },
        "https://s.eu.tankionline.com/562/45076/20/332/27111226640020/image.webp": { ru: "Ядерное солнце", en: "Nuclear sun" },
        "https://s.eu.tankionline.com/552/51372/12/247/27006221525437/image.webp": { ru: "Обсидиан", en: "Obsidian" },
        "https://s.eu.tankionline.com/557/163176/52/75/27006221304332/image.webp": { ru: "Океания", en: "Oceania" },
        "https://s.eu.tankionline.com/562/44013/24/264/27111020177566/image.webp": { ru: "Наступление", en: "Offensive" },
        "https://s.eu.tankionline.com/562/170140/73/302/27136033510003/image.webp": { ru: "Внедорожник", en: "Off-road vehicle" },
        "https://s.eu.tankionline.com/557/163200/33/215/27006221705441/image.webp": { ru: "Оранжевый ёж", en: "Orange urchin" },
        "https://s.eu.tankionline.com/571/125005/261/51/27465467536207/image.webp": { ru: "POP IT", en: "POP IT" },
        "https://s.eu.tankionline.com/541/26511/305/155/27006221321222/image.webp": { ru: "Пейсли пламя", en: "Paisley Flame" },
        "https://s.eu.tankionline.com/557/33757/250/160/27006222523131/image.webp": { ru: "Новогодний носок", en: "Packed Stocking" },
        "https://s.eu.tankionline.com/541/26511/305/153/27006221473252/image.webp": { ru: "Пейсли лёд", en: "Paisley Ice" },
        "https://s.eu.tankionline.com/0/16723/135/47/27006221120010/image.webp": { ru: "Пижама", en: "Pajamas" },
        "https://s.eu.tankionline.com/541/26511/305/117/27006221263322/image.webp": { ru: "Пики", en: "Peaks" },
        "https://s.eu.tankionline.com/571/14353/301/314/27443072741162/image.webp": { ru: "Мир, труд, май!", en: "Peace, Work, May!" },
        "https://s.eu.tankionline.com/541/26511/305/151/27006222400241/image.webp": { ru: "Фантом", en: "Phantom" },
        "https://s.eu.tankionline.com/555/102602/164/217/27006221471504/image.webp": { ru: "Розовый слон", en: "Pink Elephant" },
        "https://s.eu.tankionline.com/541/26511/305/121/27006222043465/image.webp": { ru: "Поп-арт", en: "Pop Art" },
        "https://s.eu.tankionline.com/541/26511/305/143/27006221477713/image.webp": { ru: "Пластилин", en: "Play-Doh" },
        "https://s.eu.tankionline.com/541/26511/305/141/27006222421437/image.webp": { ru: "Гончар", en: "Potter" },
        "https://s.eu.tankionline.com/560/100572/177/222/27020213605214/image.webp": { ru: "Драгоценные камни", en: "Precious Studs" },
        "https://s.eu.tankionline.com/541/26511/305/127/27006222271152/image.webp": { ru: "Пульсар", en: "Pulsar" },
        "https://s.eu.tankionline.com/0/16722/221/70/27006222522100/image.webp": { ru: "Премиум краска", en: "Premium paint" },
        "https://s.eu.tankionline.com/567/37634/262/342/27347747132106/image.webp": { ru: "Вопрос", en: "Question" },
        "https://s.eu.tankionline.com/573/100613/307/367/27560142744157/image.webp": { ru: "Красная метка", en: "Red Marks" },
        "https://s.eu.tankionline.com/550/121243/76/201/27006221446651/image.webp": { ru: "Красный мармелад", en: "Red marmalade" },
        "https://s.eu.tankionline.com/0/16722/316/154/27006221217543/image.webp": { ru: "Красный костюм", en: "Red Suit" },
        "https://s.eu.tankionline.com/554/41253/265/310/27006222340462/image.webp": { ru: "Красная планета", en: "Red planet" },
        "https://s.eu.tankionline.com/0/16723/150/165/27006222255511/image.webp": { ru: "Ретина", en: "Retina" },
        "https://s.eu.tankionline.com/541/26511/305/147/27006221262557/image.webp": { ru: "Рябь", en: "Ripple" },
        "https://s.eu.tankionline.com/572/166517/256/34/27535523727317/image.webp": { ru: "Ретровейв", en: "Retrowave" },
        "https://s.eu.tankionline.com/0/16723/135/41/27006222352311/image.webp": { ru: "Коррозия", en: "Rust" },
        "https://s.eu.tankionline.com/0/16723/135/42/27006222376003/image.webp": { ru: "Скандинавия", en: "Scandinavia" },
        "https://s.eu.tankionline.com/555/102601/7/347/27006222561064/image.webp": { ru: "Ночь страха", en: "Scarier Things" },
        "https://s.eu.tankionline.com/0/16723/247/230/27006221277407/image.webp": { ru: "Тайна пришельцев", en: "Secret of the aliens" },
        "https://s.eu.tankionline.com/575/46555/242/41/27652032037172/image.webp": { ru: "Прицел", en: "Sight" },
        "https://s.eu.tankionline.com/561/25253/244/142/27045325521455/image.webp": { ru: "Порезанный", en: "Shredded" },
        "https://s.eu.tankionline.com/541/26511/305/133/27006221345511/image.webp": { ru: "Силикат", en: "Sillicate" },
        "https://s.eu.tankionline.com/550/121245/75/174/27006221622300/image.webp": { ru: "Сингапур", en: "Singapore" },
        "https://s.eu.tankionline.com/0/16723/44/256/27006222314544/image.webp": { ru: "Вьюга", en: "Snowflake" },
        "https://s.eu.tankionline.com/570/61722/240/131/27414734736616/image.webp": { ru: "Скоморох", en: "Skomorokh" },
        "https://s.eu.tankionline.com/562/104265/346/200/27121057602676/image.webp": { ru: "Шипучка", en: "Soda" },
        "https://s.eu.tankionline.com/564/23012/11/216/27204602406375/image.webp": { ru: "Радиолокатор", en: "Sonar" },
        "https://s.eu.tankionline.com/561/142545/333/17/27070551440731/image.webp": { ru: "Мерцание звёзд", en: "Speeding Star" },
        "https://s.eu.tankionline.com/0/16723/23/222/27006222117163/image.webp": { ru: "Блёстки", en: "Spangles" },
        "https://s.eu.tankionline.com/567/130011/174/233/27366564524713/image.webp": { ru: "Весенний букет", en: "Spring bouquet" },
        "https://s.eu.tankionline.com/555/102576/311/233/27006222566342/image.webp": { ru: "Кальмар", en: "Squid Fingers" },
        "https://s.eu.tankionline.com/543/66610/35/62/27006222635760/image.webp": { ru: "Витраж", en: "Stained glass" },
        "https://s.eu.tankionline.com/560/100572/177/224/27020213621647/image.webp": { ru: "Звёзды и пламя", en: "Stars and Flames" },
        "https://s.eu.tankionline.com/0/16723/66/103/27006222461555/image.webp": { ru: "Стальное микроволокно", en: "Steel micro-fibers" },
        "https://s.eu.tankionline.com/0/16723/135/50/27006221702565/image.webp": { ru: "Стейк", en: "Steak" },
        "https://s.eu.tankionline.com/0/16723/135/45/27006221633410/image.webp": { ru: "Клубника", en: "Strawberry" },
        "https://s.eu.tankionline.com/561/142545/333/12/27070551362051/image.webp": { ru: "Стильный танкист", en: "Stylish Tanker" },
        "https://s.eu.tankionline.com/0/16723/66/105/27006221764352/image.webp": { ru: "Вечерний закат", en: "Sunset camouflage" },
        "https://s.eu.tankionline.com/541/26511/305/131/27006222254007/image.webp": { ru: "Судоку", en: "Sudoku" },
        "https://s.eu.tankionline.com/552/51375/362/10/27006222560630/image.webp": { ru: "Тарантул", en: "Tarantula" },
        "https://s.eu.tankionline.com/564/155026/311/101/27233535242303/image.webp": { ru: "Мишень", en: "Target" },
        "https://s.eu.tankionline.com/543/66604/144/13/27006221233210/image.webp": { ru: "Шаровая молния", en: "Thunderball" },
        "https://s.eu.tankionline.com/564/155045/271/143/27233535362310/image.webp": { ru: "Тетрис", en: "Tetris" },
        "https://s.eu.tankionline.com/550/121245/254/153/27006222105355/image.webp": { ru: "Лесной призрак", en: "Timber camo" },
        "https://s.eu.tankionline.com/0/16723/230/43/27006221302543/image.webp": { ru: "Тропическая листва", en: "Tropical Foliage" },
        "https://s.eu.tankionline.com/570/61721/34/177/27414735126051/image.webp": { ru: "НЛО", en: "UFO" },
        "https://s.eu.tankionline.com/565/67400/141/60/27255700060667/image.webp": { ru: "Тропики", en: "Tropics" },
        "https://s.eu.tankionline.com/0/16723/135/44/27006222032035/image.webp": { ru: "Ванадий", en: "Vanadium" },
        "https://s.eu.tankionline.com/561/61551/166/310/27054332366147/image.webp": { ru: "Вирус", en: "Virus" },
        "https://s.eu.tankionline.com/566/115233/43/210/27322340127723/image.webp": { ru: "Извержение вулкана", en: "Volcanic eruption" },
        "https://s.eu.tankionline.com/567/37631/141/325/27347746261730/image.webp": { ru: "Вектор", en: "Vector" },
        "https://s.eu.tankionline.com/0/16722/374/165/27006221666021/image.webp": { ru: "Акварель", en: "Watercolor" },
        "https://s.eu.tankionline.com/571/14366/257/41/27443075527660/image.webp": { ru: "Аллея звёзд", en: "Walk of Fame" },
        "https://s.eu.tankionline.com/553/114361/160/155/27006221205313/image.webp": { ru: "Арбуз", en: "Watermelon" },
        "https://s.eu.tankionline.com/554/41254/55/332/27006221646531/image.webp": { ru: "Белая планета", en: "White planet" },
        "https://s.eu.tankionline.com/572/166517/256/41/27536075120607/image.webp": { ru: "Дикий стиль", en: "Wildstyle" },
        "https://s.eu.tankionline.com/0/16723/247/226/27006222260110/image.webp": { ru: "Дикие джунгли", en: "Wild Jungle" },
        "https://s.eu.tankionline.com/553/3675/302/156/27006221267177/image.webp": { ru: "Чудо-рыба", en: "Wonder fish" },
        "https://s.eu.tankionline.com/554/155644/166/32/27006222147416/image.webp": { ru: "Чудо-птица", en: "Wonderbird" },
        "https://s.eu.tankionline.com/0/16723/5/161/27006222345270/image.webp": { ru: "Зомби", en: "Zombie" },
        "https://s.eu.tankionline.com/541/26511/305/135/27006221144374/image.webp": { ru: "Зигзаг", en: "Zigzag" },
        "https://s.eu.tankionline.com/574/6253/73/215/27602113553573/image.webp": { ru: "Поражающий фактор", en: "Adversity" },
        "https://s.eu.tankionline.com/553/114545/63/226/27006222635041/image.webp": { ru: "Туманность", en: "Alien Nebula" },
        "https://s.eu.tankionline.com/553/116607/12/216/27006221064073/image.webp": { ru: "Кожа инопланетянина", en: "Alien Skin" },
        "https://s.eu.tankionline.com/553/114521/266/63/27006222543366/image.webp": { ru: "Регенерация", en: "Alien Regeneration" },
        "https://s.eu.tankionline.com/552/5401/214/71/27006222503213/image.webp": { ru: "Похищение", en: "Alien abduction" },
        "https://s.eu.tankionline.com/565/67354/367/276/27255673174053/image.webp": { ru: "Сплав", en: "Alloy" },
        "https://s.eu.tankionline.com/557/163337/116/377/27006221612615/image.webp": { ru: "Атмосферные явления", en: "Atmospheric Conditions" },
        "https://s.eu.tankionline.com/546/137356/105/55/27006221600612/image.webp": { ru: "Колючая проволока", en: "Barbed wire" },
        "https://s.eu.tankionline.com/541/107167/201/42/27006221053354/image.webp": { ru: "Биение сердец", en: "Beating Hearts" },
        "https://s.eu.tankionline.com/546/137356/56/326/27006221364671/image.webp": { ru: "Банни", en: "Bunny" },
        "https://s.eu.tankionline.com/564/23562/50/216/27204734424620/image.webp": { ru: "Сирень", en: "Blue lilac" },
        "https://s.eu.tankionline.com/565/67316/325/375/27255663553153/image.webp": { ru: "Вспышка", en: "Burst of Light" },
        "https://s.eu.tankionline.com/554/41031/237/135/27006221073201/image.webp": { ru: "Арестован", en: "Busted" },
        "https://s.eu.tankionline.com/562/44013/24/262/27111011363601/image.webp": { ru: "Карбоновые звёзды", en: "Carbon stars" },
        "https://s.eu.tankionline.com/564/23137/2/12/27204627601405/image.webp": { ru: "Костёр", en: "Campfire" },
        "https://s.eu.tankionline.com/573/10240/175/26/27542050076643/image.webp": { ru: "Кинескоп", en: "Cathode Ray Tube" },
        "https://s.eu.tankionline.com/561/25253/244/135/27045316146637/image.webp": { ru: "Химическая реакция", en: "Chemical Reaction" },
        "https://s.eu.tankionline.com/557/163277/204/145/27006221444234/image.webp": { ru: "Космический взрыв", en: "Cosmic Blast" },
        "https://s.eu.tankionline.com/562/45076/20/306/27111221217077/image.webp": { ru: "Созвездие", en: "Constellation" },
        "https://s.eu.tankionline.com/565/67335/20/34/27255667210211/image.webp": { ru: "Фигурные ножницы", en: "Craft Scissors" },
        "https://s.eu.tankionline.com/561/25253/244/140/27045320163626/image.webp": { ru: "Киберниндзя", en: "Cyber Shuriken" },
        "https://s.eu.tankionline.com/551/134441/174/100/27006221263651/image.webp": { ru: "Бриллиант", en: "Diamond" },
        "https://s.eu.tankionline.com/555/125200/112/312/27006221636176/image.webp": { ru: "Киборг", en: "Cyborg" },
        "https://s.eu.tankionline.com/557/163253/364/266/27006221266743/image.webp": { ru: "Кибернетическое сияние", en: "Digital Borealis" },
        "https://s.eu.tankionline.com/574/6303/366/322/27602117044003/image.webp": { ru: "Привод", en: "Drive" },
        "https://s.eu.tankionline.com/554/156326/105/27/27006222422773/image.webp": { ru: "Электроовцы", en: "Electric Sheep" },
        "https://s.eu.tankionline.com/571/77337/260/262/27457667731175/image.webp": { ru: "Утки", en: "Ducks" },
        "https://s.eu.tankionline.com/545/126733/241/226/27006221063660/image.webp": { ru: "Электроулей", en: "Electrohive" },
        "https://s.eu.tankionline.com/543/66605/321/302/27006221122065/image.webp": { ru: "Извержение", en: "Eruption" },
        "https://s.eu.tankionline.com/562/167467/303/360/27135715742134/image.webp": { ru: "Вентилятор", en: "Fan" },
        "https://s.eu.tankionline.com/545/40720/116/153/27006221147267/image.webp": { ru: "Осенняя листва", en: "Fall leaves" },
        "https://s.eu.tankionline.com/551/134442/20/142/27006222105616/image.webp": { ru: "Крайний Север", en: "Far North" },
        "https://s.eu.tankionline.com/572/14616/220/173/27503143510501/image.webp": { ru: "Антистресс", en: "Fidget toy" },
        "https://s.eu.tankionline.com/550/156234/237/345/27006221375217/image.webp": { ru: "Первый поцелуй", en: "First kiss" },
        "https://s.eu.tankionline.com/551/27317/14/120/27006221162655/image.webp": { ru: "Огненный голем", en: "Fire golem" },
        "https://s.eu.tankionline.com/0/16723/161/100/27006222633303/image.webp": { ru: "Флоу", en: "Flow" },
        "https://s.eu.tankionline.com/560/100572/177/142/27020205723767/image.webp": { ru: "Металлический дождь", en: "Flowing Metal" },
        "https://s.eu.tankionline.com/552/54561/235/227/27006222573543/image.webp": { ru: "Галактический взрыв", en: "Galaxian Explosion" },
        "https://s.eu.tankionline.com/570/61726/363/237/27414731172757/image.webp": { ru: "Маховик", en: "Flywheel" },
        "https://s.eu.tankionline.com/542/132027/0/273/27006222067226/image.webp": { ru: "Галактика", en: "Galaxy" },
        "https://s.eu.tankionline.com/541/175531/252/111/27006221151645/image.webp": { ru: "Джинга", en: "Ginga" },
        "https://s.eu.tankionline.com/552/64054/13/237/27006221703215/image.webp": { ru: "Золотой механизм", en: "Golden Gears" },
        "https://s.eu.tankionline.com/562/167562/332/122/27135734555253/image.webp": { ru: "Золотой сплав", en: "Gold alloy" },
        "https://s.eu.tankionline.com/561/25253/244/123/27045322021177/image.webp": { ru: "Ядовитое море", en: "Green Quads" },
        "https://s.eu.tankionline.com/573/10253/221/41/27542052710643/image.webp": { ru: "Зелёный циркон", en: "Green Zircon" },
        "https://s.eu.tankionline.com/561/142545/333/4/27070543637031/image.webp": { ru: "Палач", en: "Head Ripper" },
        "https://s.eu.tankionline.com/560/100572/177/211/27020207566142/image.webp": { ru: "Неоновая молния", en: "Groovy Neon" },
        "https://s.eu.tankionline.com/540/66764/173/103/27006221166103/image.webp": { ru: "Гирлянда", en: "Holiday lights" },
        "https://s.eu.tankionline.com/551/27324/215/231/27006221422007/image.webp": { ru: "Холо", en: "Holo" },
        "https://s.eu.tankionline.com/570/61724/113/126/27414734473666/image.webp": { ru: "Чип", en: "Integrated circuit" },
        "https://s.eu.tankionline.com/551/5072/7/20/27006222160574/image.webp": { ru: "Честь", en: "Honor" },
        "https://s.eu.tankionline.com/556/131050/2/17/27006222041207/image.webp": { ru: "Весёлое время", en: "Jolly Season" },
        "https://s.eu.tankionline.com/555/102557/217/260/27006221663214/image.webp": { ru: "Фарш", en: "Kapuljat" },
        "https://s.eu.tankionline.com/545/11634/266/74/27006221352635/image.webp": { ru: "Светодиоды", en: "LEDs" },
        "https://s.eu.tankionline.com/547/116334/23/330/27006222557743/image.webp": { ru: "Лава-лампа", en: "Lava Lamp" },
        "https://s.eu.tankionline.com/556/15666/277/75/27006221152035/image.webp": { ru: "Магические круги", en: "Magic Circles" },
        "https://s.eu.tankionline.com/556/15653/72/150/27006221261625/image.webp": { ru: "Живая броня", en: "Living Armor" },
        "https://s.eu.tankionline.com/545/11637/17/302/27006221255520/image.webp": { ru: "Звездопад", en: "Meteor shower" },
        "https://s.eu.tankionline.com/551/134443/11/33/27006221573765/image.webp": { ru: "Микробиология", en: "Microbiology" },
        "https://s.eu.tankionline.com/545/40721/204/340/27006222237552/image.webp": { ru: "Фудзияма", en: "Mount Fuji" },
        "https://s.eu.tankionline.com/554/41014/330/72/27006221346332/image.webp": { ru: "Монохром", en: "Monochrome" },
        "https://s.eu.tankionline.com/561/25253/244/133/27045325441716/image.webp": { ru: "Нанолаборатория", en: "NanoHUD" },
        "https://s.eu.tankionline.com/555/102567/300/350/27006222207616/image.webp": { ru: "Неоновая геометрия", en: "Neon Geometry" },
        "https://s.eu.tankionline.com/554/175557/212/17/27006221622445/image.webp": { ru: "Ночной город", en: "Night City" },
        "https://s.eu.tankionline.com/572/100163/46/345/27520034623546/image.webp": { ru: "Никель", en: "Nickel" },
        "https://s.eu.tankionline.com/550/121250/255/352/27006222365131/image.webp": { ru: "Северное сияние", en: "Northern Lights" },
        "https://s.eu.tankionline.com/564/23104/51/321/27204621025403/image.webp": { ru: "Печатная плата", en: "PCB" },
        "https://s.eu.tankionline.com/561/142545/333/0/27070542052722/image.webp": { ru: "Пиксельная плазма", en: "Pixel Plasma" },
        "https://s.eu.tankionline.com/543/137742/302/13/27006221451300/image.webp": { ru: "Пастила", en: "Pastila" },
        "https://s.eu.tankionline.com/541/134056/335/343/27006222515054/image.webp": { ru: "Продиджи 2.0", en: "Prodigy 2.0" },
        "https://s.eu.tankionline.com/556/42751/263/315/27006222270665/image.webp": { ru: "Квантовый камуфляж", en: "Quantum Camo" },
        "https://s.eu.tankionline.com/576/110301/22/145/27722060211602/image.webp": { ru: "Красный дым", en: "Red smoke" },
        "https://s.eu.tankionline.com/554/67736/267/363/27006222626613/image.webp": { ru: "Радар", en: "Radar" },
        "https://s.eu.tankionline.com/555/102571/41/46/27006221160241/image.webp": { ru: "Весёлые семидесятые", en: "Seventies Fun" },
        "https://s.eu.tankionline.com/543/66606/257/72/27006221135122/image.webp": { ru: "Амурский тигр", en: "Siberian tiger" },
        "https://s.eu.tankionline.com/556/15710/153/1/27006222055570/image.webp": { ru: "Душа", en: "Souls" },
        "https://s.eu.tankionline.com/547/116415/163/70/27006222526160/image.webp": { ru: "Серебряные кирпичи", en: "Silver Bricks" },
        "https://s.eu.tankionline.com/561/142545/333/6/27070545722177/image.webp": { ru: "Поглощение", en: "Spreading Fast" },
        "https://s.eu.tankionline.com/551/24635/26/42/27006221136712/image.webp": { ru: "Весна", en: "Spring" },
        "https://s.eu.tankionline.com/546/34534/61/72/27006221606474/image.webp": { ru: "Симбиот", en: "Symbiote" },
        "https://s.eu.tankionline.com/564/23530/353/164/27204726166310/image.webp": { ru: "Сёрфинг", en: "Surf" },
        "https://s.eu.tankionline.com/540/66633/55/221/27006222576001/image.webp": { ru: "Синестезия", en: "Synesthesia" },
        "https://s.eu.tankionline.com/545/126733/27/326/27006222233466/image.webp": { ru: "Синти-поп", en: "Synth-pop" },
        "https://s.eu.tankionline.com/547/146221/51/60/27006221444421/image.webp": { ru: "Прикосновение холода", en: "Touch of chill" },
        "https://s.eu.tankionline.com/547/116166/351/53/27006221657440/image.webp": { ru: "Тессеракт", en: "Tessaract Camo" },
        "https://s.eu.tankionline.com/556/131022/31/265/27006221105147/image.webp": { ru: "В ловушке", en: "Trapped Inside" },
        "https://s.eu.tankionline.com/556/131072/132/233/27006222453416/image.webp": { ru: "Под ёлкой", en: "Under the Tree" },
        "https://s.eu.tankionline.com/543/174437/247/40/27006221244761/image.webp": { ru: "Доблесть", en: "Valour" },
        "https://s.eu.tankionline.com/541/30734/372/213/27006221242753/image.webp": { ru: "Вертиго", en: "Vertigo" },
        "https://s.eu.tankionline.com/551/132461/354/137/27006221251124/image.webp": { ru: "lol", en: "lol" },
        "https://s.eu.tankionline.com/544/55151/301/253/27006221753027/image.webp": { ru: "Анютины глазки", en: "Beholder" },
        "https://s.eu.tankionline.com/552/54546/72/26/27006222303074/image.webp": { ru: "Жвачка", en: "Bubble gum" },
        "https://s.eu.tankionline.com/572/34572/161/327/27507136471206/image.webp": { ru: "Чёрное море", en: "Black Sea" },
        "https://s.eu.tankionline.com/555/175756/337/316/27006222621337/image.webp": { ru: "Тыквы", en: "Cucurbita Pepo" },
        "https://s.eu.tankionline.com/550/121247/107/213/27006221631475/image.webp": { ru: "Киберпанк", en: "Cyberpunk" },
        "https://s.eu.tankionline.com/561/142545/333/10/27070547604376/image.webp": { ru: "Землянин", en: "Earthling" },
        "https://s.eu.tankionline.com/550/121247/327/43/27006221125222/image.webp": { ru: "Диско 2.0", en: "Disco 2.0" },
        "https://s.eu.tankionline.com/574/50101/372/330/27612512065507/image.webp": { ru: "Глазунья", en: "Fried egg" },
        "https://s.eu.tankionline.com/557/33663/377/245/27006221660512/image.webp": { ru: "Холодный покров", en: "Frigid Coat" },
        "https://s.eu.tankionline.com/545/11636/174/162/27006222412272/image.webp": { ru: "Шестерёнки", en: "Gears" },
        "https://s.eu.tankionline.com/557/163350/114/62/27006221671646/image.webp": { ru: "Странное лекарство", en: "Funky medicine" },
        "https://s.eu.tankionline.com/555/102563/132/116/27006221451423/image.webp": { ru: "Красная палитра", en: "Glam Croc" },
        "https://s.eu.tankionline.com/572/77671/70/327/27517756234532/image.webp": { ru: "Свечение", en: "Glow" },
        "https://s.eu.tankionline.com/557/33643/117/215/27006222232451/image.webp": { ru: "Ледяной вихрь", en: "Ice Flurry" },
        "https://s.eu.tankionline.com/560/100572/177/206/27020211502220/image.webp": { ru: "Стальное сердце", en: "Heart of Steel" },
        "https://s.eu.tankionline.com/565/67302/67/275/27255660434051/image.webp": { ru: "Иероглифы", en: "Katakana" },
        "https://s.eu.tankionline.com/551/27326/221/341/27006221265166/image.webp": { ru: "Лиана", en: "Liana" },
        "https://s.eu.tankionline.com/562/167535/267/252/27135727334011/image.webp": { ru: "Светомузыка", en: "Light organ" },
        "https://s.eu.tankionline.com/547/116435/370/371/27006222240217/image.webp": { ru: "Гроза", en: "Lightning storm" },
        "https://s.eu.tankionline.com/543/421/60/312/27006222146637/image.webp": { ru: "Магнолия", en: "Magnolia" },
        "https://s.eu.tankionline.com/560/100572/177/214/27020213473672/image.webp": { ru: "Розовый камуфляж", en: "Loving Camo" },
        "https://s.eu.tankionline.com/541/30734/302/362/27006221540354/image.webp": { ru: "Матрица", en: "Matrix" },
        "https://s.eu.tankionline.com/541/30734/350/113/27006222204042/image.webp": { ru: "Мозаика", en: "Mosaic" },
        "https://s.eu.tankionline.com/0/16723/270/215/27006221715734/image.webp": { ru: "Кошмар", en: "Nightmare" },
        "https://s.eu.tankionline.com/554/156327/273/12/27006221406451/image.webp": { ru: "Нанокостюм", en: "Nanosuit Armor" },
        "https://s.eu.tankionline.com/554/156330/206/342/27006222023224/image.webp": { ru: "Без фонарей", en: "Not a lantern" },
        "https://s.eu.tankionline.com/545/11635/326/23/27006221116243/image.webp": { ru: "Радиоактивное желе", en: "Radioactive jelly" },
        "https://s.eu.tankionline.com/543/66607/263/64/27006222205740/image.webp": { ru: "Секретный соус", en: "Secret sauce" },
        "https://s.eu.tankionline.com/546/5266/115/372/27006222046566/image.webp": { ru: "Руны", en: "Runes" },
        "https://s.eu.tankionline.com/555/102566/10/263/27006222330022/image.webp": { ru: "Дымовая завеса", en: "Smoke Screen" },
        "https://s.eu.tankionline.com/557/16767/303/253/27006221503663/image.webp": { ru: "Искры", en: "Sparks" },
        "https://s.eu.tankionline.com/545/11560/327/27/27006222202266/image.webp": { ru: "Спиннер", en: "Spinner" },
        "https://s.eu.tankionline.com/537/161126/341/105/27006222025770/image.webp": { ru: "Спектр", en: "Spectrum" },
        "https://s.eu.tankionline.com/556/15723/374/66/27006222550606/image.webp": { ru: "Танкоиновый танк", en: "Tankoin Tank" },
        "https://s.eu.tankionline.com/562/167566/77/60/27135735437610/image.webp": { ru: "Тектонические плиты", en: "Tectonic plates" },
        "https://s.eu.tankionline.com/546/73403/142/220/27006221330173/image.webp": { ru: "Крестики-нолики", en: "Tic-tac-toe" },
        "https://s.eu.tankionline.com/545/11640/53/20/27006221673161/image.webp": { ru: "Щупальца", en: "Tentacles" },
        "https://s.eu.tankionline.com/553/1364/357/16/27006222521372/image.webp": { ru: "Визуальный разрушитель", en: "Visual Disruptor" },
        "https://s.eu.tankionline.com/553/1432/203/174/27006221621075/image.webp": { ru: "Чёрный X", en: "X Noir" },
        "https://s.eu.tankionline.com/626/34322/273/374/31307064536373/image.webp": { ru: "Андромеда", en: "Andromeda" },
        "https://s.eu.tankionline.com/636/64631/20/144/31715146210615/image.webp": { ru: "Чемпион 1", en: "Champion 1" },
        "https://s.eu.tankionline.com/636/64632/40/322/31715146420717/image.webp": { ru: "Чемпион 3", en: "Champion 3" },
        "https://s.eu.tankionline.com/636/64631/271/177/31715146335213/image.webp": { ru: "Чемпион 2", en: "Champion 2" },
        "https://s.eu.tankionline.com/636/64632/204/306/31715146502712/image.webp": { ru: "Чемпион 4", en: "Champion 4" },
        "https://s.eu.tankionline.com/636/64632/341/332/31715146561331/image.webp": { ru: "Чемпион 5", en: "Champion 5" },
        "https://s.eu.tankionline.com/636/113241/254/242/31722650360504/image.webp": { ru: "Чемпион 7", en: "Champion 7" },
        "https://s.eu.tankionline.com/636/64633/124/217/31715146652620/image.webp": { ru: "Чемпион 6", en: "Champion 6" },
        "https://s.eu.tankionline.com/636/64634/266/61/31715147133461/image.webp": { ru: "Чемпион 8", en: "Champion 8" },
        "https://s.eu.tankionline.com/636/20255/22/326/31704053211730/image.webp": { ru: "Бронеблоки", en: "Generic regular paint" },
        "https://s.eu.tankionline.com/616/164773/336/3/30735176757304/image.webp": { ru: "Блеск", en: "Gloss" },
        "https://s.eu.tankionline.com/606/52062/370/75/30312414574376/image.webp": { ru: "Hazels Panzerwerke", en: "Hazel’s Panzerwerke" },
        "https://s.eu.tankionline.com/606/52063/234/116/30312414716416/image.webp": { ru: "Houston Tankin", en: "Houston Tankin" },
        "https://s.eu.tankionline.com/606/52064/104/300/30312415042577/image.webp": { ru: "Llama Tankini", en: "Llama Tankini" },
        "https://s.eu.tankionline.com/635/105542/313/241/31661330546314/image.webp": { ru: "Пространство-время", en: "Space-time" },
        "https://s.eu.tankionline.com/606/52065/331/327/30312415355227/image.webp": { ru: "Tank-Noir", en: "Tank-Noir" },
        "https://s.eu.tankionline.com/606/52064/342/262/30312415161557/image.webp": { ru: "Tanki’s Sun", en: "Tanki’s Sun" },
        "https://s.eu.tankionline.com/565/174716/301/174/27277163541001/image.webp": { ru: "Шоппер", en: "Tote bag" },
        "https://s.eu.tankionline.com/606/52065/140/22/30312415260320/image.webp": { ru: "Tankitty", en: "Tankitty" },
        "https://s.eu.tankionline.com/554/41027/222/240/27006222005546/image.webp": { ru: "Барсук", en: "Badger-badger" },
        "https://s.eu.tankionline.com/552/130105/276/1/27006221126362/image.webp": { ru: "Доспехи Танкоса", en: "Thankos' Armor" },
        "https://s.eu.tankionline.com/571/146107/120/162/27471421650333/image.webp": { ru: "Banguins", en: "Banguins" },
        "https://s.eu.tankionline.com/557/33435/327/166/27042003502540/image.webp": { ru: "Eternity", en: "Eternity" },
        "https://s.eu.tankionline.com/566/16501/275/45/27303520336671/image.webp": { ru: "Flash", en: "Flash" },
        "https://s.eu.tankionline.com/544/1406/301/57/27006221566433/image.webp": { ru: "Prestigio", en: "Prestigio" },
        "https://s.eu.tankionline.com/573/113624/260/274/27562745130504/image.webp": { ru: "Бронзовые доспехи", en: "Bronze armor" },
        "https://s.eu.tankionline.com/607/11377/340/76/30342277760400/image.webp": { ru: "Галактикус", en: "Galacticus" },
        "https://s.eu.tankionline.com/543/420/22/72/27006221577426/image.webp": { ru: "Герой Canyon", en: "Canyon Hero" },
        "https://s.eu.tankionline.com/606/142716/313/333/30330563546232/image.webp": { ru: "Зелёная дружина", en: "Green retinue" },
        "https://s.eu.tankionline.com/557/165265/117/326/27006222021647/image.webp": { ru: "Инь & Янь", en: "Yin & Yang" },
        "https://s.eu.tankionline.com/0/16723/267/303/27006221335606/image.webp": { ru: "Команда ВК", en: "Team VK" },
        "https://s.eu.tankionline.com/606/142720/365/252/30330564173147/image.webp": { ru: "Лепреконовое братство", en: "Leprechaun brotherhood" },
        "https://s.eu.tankionline.com/637/14513/322/52/31743122751445/image.webp": { ru: "Офис", en: "Office" },
        "https://s.eu.tankionline.com/606/142721/275/246/30330564337144/image.webp": { ru: "Отряд трилистника", en: "Shamrock squad" },
        "https://s.eu.tankionline.com/560/117420/343/260/27023704322263/image.webp": { ru: "Пермская езда", en: "City Dweller" },
        "https://s.eu.tankionline.com/554/41031/237/374/27006221661631/image.webp": { ru: "Разрушитель 2.0", en: "Demolisher 2.0" },
        "https://s.eu.tankionline.com/554/41031/240/177/27006221444112/image.webp": { ru: "Разрушитель", en: "Demolisher" },
        "https://s.eu.tankionline.com/577/175111/75/52/27777616243732/image.webp": { ru: "Сингулярность", en: "Singularity" },
        "https://s.eu.tankionline.com/574/114530/336/250/27624215522147/image.webp": { ru: "Сладкая гадость", en: "Sweet trick" },
        "https://s.eu.tankionline.com/554/156200/50/25/27006221151413/image.webp": { ru: "Танки 1.0", en: "Tanks 1.0" },
        "https://s.eu.tankionline.com/554/156201/236/305/27006221071275/image.webp": { ru: "Танки 2.0", en: "Tanks 2.0" },
        "https://s.eu.tankionline.com/0/16717/162/311/27006221312413/image.webp": { ru: "Трейсер", en: "Traceur" },
        "https://s.eu.tankionline.com/604/55511/67/367/30213322234265/image.webp": { ru: "Diamonds", en: "Diamonds" },
        "https://s.eu.tankionline.com/604/55511/301/54/30213322340751/image.webp": { ru: "Guardians Advanced", en: "Guardians Advanced" },
        "https://s.eu.tankionline.com/617/161572/12/27/30774336405330/image.webp": { ru: "KAN", en: "KAN" },
        "https://s.eu.tankionline.com/626/174416/341/37/31337103561042/image.webp": { ru: "Lovesick ", en: "Lovesick " },
        "https://s.eu.tankionline.com/617/161576/310/47/30774337544347/image.webp": { ru: "Lovesick", en: "Lovesick" },
        "https://s.eu.tankionline.com/626/174416/104/362/31337103442766/image.webp": { ru: "Memento mei", en: "Memento mei" },
        "https://s.eu.tankionline.com/626/174414/133/334/31337103056335/image.webp": { ru: "Pepega", en: "Pepega" },
        "https://s.eu.tankionline.com/617/161575/153/113/30774337266012/image.webp": { ru: "Pepega", en: "Pepega" },
        "https://s.eu.tankionline.com/604/55500/13/301/30213320006200/image.webp": { ru: "Pepega", en: "Pepega" },
        "https://s.eu.tankionline.com/617/161573/125/340/30774336653240/image.webp": { ru: "Punishment", en: "Punishment" },
        "https://s.eu.tankionline.com/617/161574/357/332/30774337170236/image.webp": { ru: "Red Notice", en: "Red Notice" },
        "https://s.eu.tankionline.com/604/55507/215/25/30213321706723/image.webp": { ru: "Red Notice", en: "Red Notice" },
        "https://s.eu.tankionline.com/604/55475/145/334/30213317263232/image.webp": { ru: "Retired Bots", en: "Retired Bots" },
        "https://s.eu.tankionline.com/626/174420/12/136/31337104005537/image.webp": { ru: "Sennaar", en: "Sennaar" },
        "https://s.eu.tankionline.com/626/174417/172/341/31337103675744/image.webp": { ru: "Spirit", en: "Spirit" },
        "https://s.eu.tankionline.com/604/55510/201/235/30213322101132/image.webp": { ru: "Team Pointers", en: "Team Pointers" },
        "https://s.eu.tankionline.com/613/145034/52/121/30571207025423/image.webp": { ru: "TeamP", en: "TeamP" },
        "https://s.eu.tankionline.com/617/161573/352/210/30774336765507/image.webp": { ru: "Top25OrNothing", en: "Top25OrNothing" },
        "https://s.eu.tankionline.com/604/55506/341/364/30213321561263/image.webp": { ru: "Toxic", en: "Toxic" },
        "https://s.eu.tankionline.com/626/174413/166/206/31337102673611/image.webp": { ru: "Troublemakers", en: "Troublemakers" },
        "https://s.eu.tankionline.com/613/145035/166/312/30571207273614/image.webp": { ru: "Undervalued", en: "Undervalued" },
        "https://s.eu.tankionline.com/626/174415/37/54/31337103220054/image.webp": { ru: "Vega", en: "Vega" },
        "https://s.eu.tankionline.com/604/116750/270/106/30223572134410/image.webp": { ru: "Зомби", en: "Zombies" },
        "https://s.eu.tankionline.com/604/116747/312/7/30223571745335/image.webp": { ru: "Иммуны", en: "Immunes" }
    };

    function getLang(): string {
        return document.documentElement.lang && document.documentElement.lang.toLowerCase().startsWith('ru') ? 'RU' : 'EN';
    }

    function normalizeText(text: string): string {
        if (!text) return "";
        return text.toLowerCase().replace(/ё/g, 'е');
    }

    const style = document.createElement('style');
    style.textContent = `
        .PaintsCollectionComponentStyle-commonBlockFOrInfoAndCaptionCategory { position: relative !important; }
        .kasp-search-wrapper { position: absolute; left: 0em; top: 50%; transform: translateY(-50%); z-index: 10; }
        .kasp-SearchInputComponentStyle-search { margin: 0; width: 18em; }
        .kasp-SearchInputComponentStyle-searchInput { height: 3.125em; background-color: transparent; border-radius: 0.5rem; box-sizing: border-box; display: flex; align-items: center; position: relative; width: 100%; }
        .kasp-SearchInputComponentStyle-searchInput input { width: 100%; height: 100%; margin: 0; padding-left: 1.063em; padding-right: 3.375em; border: 0 transparent; outline: none; box-sizing: border-box; border-radius: 0.5rem; font-size: 1em; color: rgb(255, 255, 255); background: initial; box-shadow: rgb(255, 255, 255) 0 0 0 1px; transition: box-shadow 0.2s; }
        .kasp-SearchInputComponentStyle-searchInput input:hover, .kasp-SearchInputComponentStyle-searchInput input:focus { box-shadow: rgb(255, 255, 255) 0 0 0 2px !important; }
        .kasp-SearchInputComponentStyle-searchInput input::placeholder { color: rgba(255, 255, 255, 0.5); }
        .kasp-search-icon { position: absolute; right: 0.875em; width: 1.5em; height: 1.5em; background-image: url(https://s.eu.tankionline.com/static/images/search.8c2b7c7b.svg); background-size: contain; background-repeat: no-repeat; background-position: center center; pointer-events: none; }
        .kasp-paints-container { display: flex !important; flex-direction: column !important; flex-wrap: wrap !important; height: 11.875em !important; max-height: 11.875em !important; overflow-x: auto !important; overflow-y: hidden !important; gap: 0.625em !important; }
        .kasp-paints-container > div { display: contents !important; }
        .kasp-paints-container .garage-item { flex: 0 0 auto; }
        .kasp-paints-container .garage-item[style*="display: none"] { display: none !important; }
    `;

    if (document.head) document.head.appendChild(style);
    else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));

    function applySearch() {
        if (typeof paintsData === 'undefined') return;
        const input = document.querySelector('.kasp-search-wrapper input') as HTMLInputElement;
        if (!input) return;

        const rawQuery = input.value.trim();
        const queryWords = normalizeText(rawQuery).split(/\s+/).filter(word => word.length > 0);

        const items = document.querySelectorAll('.kasp-paints-container .garage-item');

        items.forEach(itemEl => {
            const item = itemEl as HTMLElement;
            if (queryWords.length === 0) {
                item.style.display = '';
                return;
            }

            const imgElement = item.querySelector('.GarageItemComponentStyle-mainImg') as HTMLImageElement;
            if (!imgElement) return;

            const src = imgElement.getAttribute('src');
            if(!src) return;

            const paintInfo = paintsData[src];
            let isMatch = false;

            if (paintInfo) {
                const combinedNames = normalizeText(paintInfo.ru + " " + paintInfo.en);
                isMatch = queryWords.every(word => combinedNames.includes(word));
            }

            item.style.display = isMatch ? '' : 'none';
        });

        const columns = document.querySelectorAll('.kasp-paints-container > div');
        columns.forEach(colEl => {
            const col = colEl as HTMLElement;
            const visibleItems = Array.from(col.querySelectorAll('.garage-item')).filter(i => (i as HTMLElement).style.display !== 'none');
            col.style.display = visibleItems.length === 0 ? 'none' : '';
        });
    }

    function addSearchInput() {
        const captionContainer = document.querySelector('.PaintsCollectionComponentStyle-captionPaint');
        if (!captionContainer) return;

        const parentBlock = captionContainer.closest('.PaintsCollectionComponentStyle-commonBlockFOrInfoAndCaptionCategory');
        if (!parentBlock || parentBlock.querySelector('.kasp-search-wrapper')) {
            return;
        }

        const itemsContainer = document.querySelector('.ListItemsComponentStyle-itemsContainer');
        if (itemsContainer) {
            itemsContainer.classList.add('kasp-paints-container');
        }

        const searchWrapper = document.createElement('div');
        searchWrapper.className = 'kasp-search-wrapper';

        const searchContainer = document.createElement('div');
        searchContainer.className = 'kasp-SearchInputComponentStyle-search';

        const searchInputDiv = document.createElement('div');
        searchInputDiv.className = 'kasp-SearchInputComponentStyle-searchInput';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = getLang() === 'RU' ? 'Найти' : 'Search';
        input.className = '-normal';

        input.addEventListener('input', applySearch);

        const searchIcon = document.createElement('div');
        searchIcon.className = 'kasp-search-icon';

        searchInputDiv.appendChild(input);
        searchInputDiv.appendChild(searchIcon);
        searchContainer.appendChild(searchInputDiv);
        searchWrapper.appendChild(searchContainer);

        parentBlock.appendChild(searchWrapper);
    }

    function isBattleActive() {
        return !!document.querySelector('[class*="BattleHud"], [class*="BattleScreen"]');
    }

    let observerAttached = false;
    let rootContainer = null;
    
    const paintsObserver = new MutationObserver((mutations) => {
        if (isBattleActive()) return;
        
        paintsObserver.disconnect();
        observerAttached = false;

        const hasAddedNodes = mutations.some(mutation => mutation.addedNodes.length > 0);
        if (hasAddedNodes) {
            addSearchInput();
            applySearch();
        }

        startObserver();
    });

    function startObserver() {
        const garageContainer = document.querySelector('.GarageComponentStyle-garage') || document.querySelector('.PaintsCollectionComponentStyle-commonBlockFOrInfoAndCaptionCategory');
        if (garageContainer && !observerAttached) {
            paintsObserver.observe(garageContainer, { childList: true, subtree: true });
            observerAttached = true;
        }
    }

    setInterval(() => {
        if (isBattleActive()) return;
        addSearchInput();
        startObserver();
    }, 1000);
    
    startObserver();
})();