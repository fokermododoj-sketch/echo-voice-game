export const SAMPLE_RATE = 16000;

const FORMANTS = {
  ah: [720, 1220, 2480],
  eh: [485, 1940, 2570],
  ee: [300, 2240, 2960],
  oh: [480, 880, 2520],
  oo: [335, 690, 2200],
  mm: [235, 1080, 2130],
};

function syllable(ms, start, end, vowel, options = {}) {
  return { ms, start, end, vowel, ...options };
}

function effect(ms, start, end, style, options = {}) {
  return syllable(ms, start, end, 'oo', { style, ...options });
}

const RECIPES = [
  {
    id: 'cold-reboot', label: 'Холодный старт', category: 'Роботы',
    description: 'Два коротких «би», потом длинное «ву» с падением тона.',
    parts: [syllable(165, 360, 340, 'ee'), 105, syllable(170, 400, 385, 'ee'), 135, syllable(640, 285, 105, 'oo', { style: 'robot' })],
  },
  {
    id: 'drone-sneeze', label: 'Дрон чихнул', category: 'Роботы',
    description: 'Тихое «м-м-м» вверх, пауза и резкое «пфу!».',
    parts: [syllable(540, 155, 310, 'mm', { style: 'robot', gain: 0.56 }), 135, syllable(285, 340, 105, 'oo', { air: 0.57, attack: 13, gain: 1 })],
  },
  {
    id: 'elevator-fault', label: 'Лифт застрял', category: 'Роботы',
    description: 'Протяни «э-э» и три раза резко сбрось тон.',
    parts: [syllable(470, 220, 224, 'eh', { style: 'robot' }), 65, syllable(220, 242, 178, 'eh'), 65, syllable(205, 200, 149, 'eh'), 75, syllable(285, 163, 95, 'oh', { style: 'robot' })],
  },
  {
    id: 'mood-bot', label: 'Робот обиделся', category: 'Роботы',
    description: 'Низкое «бум», высокое «и», потом недовольное «мм».',
    parts: [syllable(240, 150, 112, 'oh', { style: 'robot' }), 100, syllable(210, 340, 382, 'ee'), 135, syllable(525, 206, 144, 'mm', { style: 'robot', wobble: 0.05 })],
  },
  {
    id: 'curious-owl', label: 'Любопытная сова', category: 'Звери',
    description: 'Мягкое «ху», пауза, затем длинное «ху-у?» с подъёмом.',
    parts: [syllable(305, 286, 220, 'oo', { air: 0.1 }), 225, syllable(605, 220, 331, 'oo', { air: 0.1, wobble: 0.025 })],
  },
  {
    id: 'sleepy-frog', label: 'Сонная жаба', category: 'Звери',
    description: 'Два горловых «ква», второе длиннее и ниже.',
    parts: [syllable(340, 160, 110, 'ah', { style: 'rough', wobble: 0.06 }), 210, syllable(500, 150, 78, 'ah', { style: 'rough', wobble: 0.05 })],
  },
  {
    id: 'fox-signal', label: 'Лисёнок зовёт', category: 'Звери',
    description: 'Два писка «и» и одно протяжное «а» с горкой.',
    parts: [syllable(180, 310, 463, 'ee'), 90, syllable(185, 335, 496, 'ee'), 135, syllable(615, 314, 288, 'ah', { arc: 148, air: 0.09, wobble: 0.035 })],
  },
  {
    id: 'grumpy-seal', label: 'Сердитый тюлень', category: 'Звери',
    description: 'Три отрывистых «ау», каждый чуть выше предыдущего.',
    parts: [syllable(210, 235, 152, 'oh', { style: 'rough' }), 115, syllable(220, 274, 180, 'oh', { style: 'rough' }), 125, syllable(365, 320, 212, 'oh', { style: 'rough', air: 0.12 })],
  },
  {
    id: 'tram-conductor', label: 'Кондуктор спешит', category: 'Голоса',
    description: 'Удивлённое «о-о?», затем два коротких «а! а!».',
    parts: [syllable(525, 145, 298, 'oh', { wobble: 0.03 }), 185, syllable(175, 244, 182, 'ah'), 105, syllable(230, 225, 145, 'ah')],
  },
  {
    id: 'small-ghost', label: 'Робкое привидение', category: 'Голоса',
    description: 'Два тихих «у»: первое взлетает, второе дрожит и падает.',
    parts: [syllable(455, 210, 373, 'oo', { air: 0.15 }), 170, syllable(660, 347, 166, 'oo', { air: 0.15, wobble: 0.065 })],
  },
  {
    id: 'space-yawn', label: 'Космический зевок', category: 'Голоса',
    description: '«А-а-а» набирает высоту и переходит в низкое «о».',
    parts: [syllable(710, 132, 256, 'ah', { air: 0.13, release: 75 }), syllable(560, 256, 100, 'oh', { attack: 40, air: 0.17 })],
  },
  {
    id: 'secret-laugh', label: 'Сдержанный смешок', category: 'Голоса',
    description: 'Три тихих «хе», последнее перескакивает в «хи».',
    parts: [syllable(195, 210, 185, 'eh', { air: 0.19 }), 95, syllable(210, 240, 207, 'eh', { air: 0.22 }), 100, syllable(395, 267, 360, 'ee', { air: 0.23, wobble: 0.06 })],
  },
  {
    id: 'tiny-modem', label: 'Модем выходит в эфир', category: 'Роботы',
    description: 'Короткие «би-боп», затем рваное стрекотание.',
    parts: [effect(135, 632, 580, 'whistle'), 75, effect(170, 560, 320, 'robot'), 70, effect(610, 360, 610, 'pulse', { pulseRate: 18, air: 0.34 })],
  },
  {
    id: 'scanner-sweep', label: 'Сканер ищет метку', category: 'Роботы',
    description: 'Две высокие «пи», потом сползи тоном вниз на «вжж».',
    parts: [effect(130, 510, 570, 'whistle'), 88, effect(140, 610, 640, 'whistle'), 93, effect(660, 590, 162, 'pulse', { pulseRate: 26, air: 0.14 })],
  },
  {
    id: 'robot-battery', label: 'Села батарейка', category: 'Роботы',
    description: 'Три короткие ноты вниз и низкий дрожащий хвост.',
    parts: [effect(150, 451, 431, 'robot'), 75, effect(150, 347, 326, 'robot'), 75, effect(160, 250, 224, 'robot'), 105, effect(440, 166, 77, 'pulse', { pulseRate: 12 })],
  },
  {
    id: 'robot-heart', label: 'Сердце андроида', category: 'Роботы',
    description: 'Спокойное «бум-бум» дважды, как сердцебиение.',
    parts: [effect(133, 170, 96, 'drum'), 65, effect(140, 135, 80, 'drum'), 375, effect(129, 168, 99, 'drum'), 65, effect(165, 131, 75, 'drum')],
  },
  {
    id: 'rover-turn', label: 'Марсоход разворачивается', category: 'Роботы',
    description: 'Разгони низкое «в-р-р», удержи и медленно затихни.',
    parts: [effect(1285, 86, 135, 'pulse', { arc: 122, pulseRate: 36, air: 0.22, attack: 155, release: 260 })],
  },
  {
    id: 'servo-jam', label: 'Заклинило манипулятор', category: 'Роботы',
    description: 'Три всё более коротких рывка «вжик», затем сухой щелчок.',
    parts: [effect(385, 278, 160, 'reed', { arc: 105, air: 0.27 }), 120, effect(240, 325, 198, 'reed', { air: 0.3 }), 80, effect(144, 355, 242, 'reed', { air: 0.3 }), 85, effect(90, 150, 80, 'drum', { air: 0.62 })],
  },
  {
    id: 'cat-protest', label: 'Кошка требует ужин', category: 'Звери',
    description: 'Подними «мя» до писка и растяни «у» вниз.',
    parts: [syllable(150, 209, 435, 'mm', { gain: 0.61 }), syllable(445, 440, 330, 'ah', { attack: 35, wobble: 0.052 }), syllable(325, 331, 135, 'oo', { air: 0.23, release: 126 })],
  },
  {
    id: 'backyard-duck', label: 'Утка возмущается', category: 'Звери',
    description: 'Три носовых «кря», последнее протяни.',
    parts: [syllable(178, 310, 188, 'eh', { style: 'rough', attack: 9, air: 0.18 }), 87, syllable(179, 289, 173, 'eh', { style: 'rough', attack: 9, air: 0.21 }), 114, syllable(400, 327, 158, 'eh', { style: 'rough', attack: 11, air: 0.22 })],
  },
  {
    id: 'lost-puppy', label: 'Щенок зовёт хозяина', category: 'Звери',
    description: 'Два коротких «аф», потом жалобное «у-у».',
    parts: [syllable(147, 245, 144, 'ah', { style: 'rough', attack: 8, air: 0.35 }), 110, syllable(165, 283, 171, 'ah', { style: 'rough', attack: 8, air: 0.31 }), 230, syllable(655, 249, 290, 'oo', { arc: 133, wobble: 0.035 })],
  },
  {
    id: 'bee-patrol', label: 'Шмель облетает цветок', category: 'Звери',
    description: 'Гуди непрерывно: вверх, вниз и снова немного вверх.',
    parts: [effect(1365, 125, 157, 'reed', { arc: 90, air: 0.17, attack: 135, release: 212, wobble: 0.12 })],
  },
  {
    id: 'goat-at-gate', label: 'Коза за воротами', category: 'Звери',
    description: 'Короткое низкое «мэ» и длинное дрожащее «э-э-э».',
    parts: [syllable(270, 248, 271, 'mm', { wobble: 0.068 }), 170, syllable(770, 300, 167, 'eh', { style: 'rough', arc: 58, wobble: 0.115, air: 0.1 })],
  },
  {
    id: 'pigeon-pair', label: 'Голубь на подоконнике', category: 'Звери',
    description: 'Скругли губы и прокатай два «гу-р-р» разной длины.',
    parts: [syllable(340, 172, 127, 'oo', { style: 'rough', wobble: 0.078, air: 0.145 }), 210, syllable(615, 148, 103, 'oo', { style: 'rough', arc: 83, wobble: 0.09, air: 0.12 })],
  },
  {
    id: 'sudden-hiccup', label: 'Икота посреди фразы', category: 'Голоса',
    description: 'Тихое «м-м», внезапное «ик» и ещё одно повыше.',
    parts: [syllable(415, 137, 145, 'mm', { gain: 0.46 }), 130, syllable(152, 209, 453, 'ee', { attack: 9, release: 83, air: 0.23 }), 260, syllable(134, 265, 520, 'ee', { attack: 9, release: 78, air: 0.22 })],
  },
  {
    id: 'stage-whisper', label: 'Тише за кулисами', category: 'Голоса',
    description: 'Короткое шёпотное «тс» и длинное «ш-ш-ш».',
    parts: [effect(165, 430, 530, 'hiss', { air: 0.94, attack: 11, release: 70 }), 255, effect(770, 280, 180, 'hiss', { air: 0.81, attack: 90, release: 180 })],
  },
  {
    id: 'worried-question', label: 'Что-то я сомневаюсь', category: 'Голоса',
    description: 'Закрой рот и протяни «м-м-м», подняв конец как в вопросе.',
    parts: [syllable(340, 185, 122, 'mm', { gain: 0.54 }), 70, syllable(910, 126, 337, 'mm', { wobble: 0.035, attack: 80 })],
  },
  {
    id: 'grand-sigh', label: 'Вздох после работы', category: 'Голоса',
    description: 'Короткий шумный вдох, затем длинное усталое «фух».',
    parts: [effect(310, 210, 320, 'wind', { air: 0.82, attack: 65, release: 70 }), 150, syllable(815, 218, 81, 'oo', { air: 0.72, attack: 115, release: 245, gain: 0.67 })],
  },
  {
    id: 'villain-giggle', label: 'Злодей не сдержался', category: 'Голоса',
    description: 'Три низких «ха-ха-ха», последний сорвётся вверх.',
    parts: [syllable(228, 158, 112, 'ah', { air: 0.27, attack: 19, style: 'rough' }), 75, syllable(230, 169, 125, 'ah', { air: 0.25, attack: 17, style: 'rough' }), 70, syllable(480, 171, 302, 'ah', { arc: 72, air: 0.33, wobble: 0.057 })],
  },
  {
    id: 'cold-stutter', label: 'Зуб на зуб не попадает', category: 'Голоса',
    description: 'Быстрое «д-д-д», пауза и длинное дрожащее «бр-р».',
    parts: [effect(365, 182, 168, 'pulse', { pulseRate: 10, air: 0.32 }), 215, syllable(780, 154, 91, 'oh', { style: 'pulse', pulseRate: 14, wobble: 0.11, air: 0.21 })],
  },
  {
    id: 'old-door', label: 'Скрипучая дверь', category: 'Быт',
    description: 'Низкий скрип набирает высоту, затем затихает на выдохе.',
    parts: [effect(920, 103, 422, 'reed', { wobble: 0.1, air: 0.37, attack: 125, release: 220 }), 75, effect(230, 240, 130, 'wind', { air: 0.53, attack: 30 })],
  },
  {
    id: 'boiling-kettle', label: 'Чайник вскипел', category: 'Быт',
    description: 'Мягкое шипение переходит в долгий высокий свист.',
    parts: [effect(380, 140, 255, 'wind', { air: 0.75, attack: 130 }), effect(820, 371, 687, 'whistle', { air: 0.28, attack: 135, release: 180 })],
  },
  {
    id: 'zipper-jacket', label: 'Молния на куртке', category: 'Быт',
    description: 'Один длинный «з-з-зип» вверх и короткий щелчок.',
    parts: [effect(770, 115, 430, 'pulse', { pulseRate: 42, air: 0.61, attack: 85, release: 125 }), 120, effect(90, 185, 77, 'drum', { air: 0.88, attack: 3, release: 65 })],
  },
  {
    id: 'drippy-tap', label: 'Капает кран', category: 'Быт',
    description: 'Три «плюк»: два близко, третий после паузы и ниже.',
    parts: [effect(120, 358, 184, 'pluck', { attack: 8 }), 145, effect(106, 434, 196, 'pluck', { attack: 8 }), 355, effect(155, 304, 138, 'pluck', { attack: 8 })],
  },
  {
    id: 'train-brakes', label: 'Трамвай тормозит', category: 'Быт',
    description: 'Сначала глухой гул, затем высокий скрип и резкая тишина.',
    parts: [effect(495, 135, 112, 'reed', { air: 0.28, attack: 75 }), effect(720, 317, 642, 'reed', { air: 0.45, attack: 118, release: 65, wobble: 0.075 })],
  },
  {
    id: 'cafe-fizz', label: 'Газировка шипит', category: 'Быт',
    description: 'Резкое «пш», потом тихие пузырьки в три толчка.',
    parts: [effect(205, 190, 100, 'hiss', { air: 1, attack: 7, release: 154 }), 75, effect(740, 118, 81, 'wind', { air: 0.64, pulseRate: 4.3, release: 295 })],
  },
  {
    id: 'woodpecker-clock', label: 'Тикают настенные часы', category: 'Быт',
    description: 'Ровное «тик-так, тик-так» с двумя разными высотами.',
    parts: [effect(100, 338, 290, 'metal', { attack: 6 }), 210, effect(100, 219, 171, 'drum'), 210, effect(100, 350, 291, 'metal', { attack: 6 }), 210, effect(105, 211, 160, 'drum')],
  },
  {
    id: 'distant-siren', label: 'Сирена на соседней улице', category: 'Быт',
    description: 'Две мягкие волны свиста: вверх, вниз, вверх, вниз.',
    parts: [effect(730, 260, 262, 'whistle', { arc: 235, attack: 92, release: 105, gain: 0.69 }), 80, effect(730, 242, 231, 'whistle', { arc: 203, attack: 76, release: 180, gain: 0.57 })],
  },
  {
    id: 'rustling-paper', label: 'Комкают бумагу', category: 'Быт',
    description: 'Два коротких шороха и ещё один длинный, с треском.',
    parts: [effect(192, 130, 73, 'hiss', { air: 0.85, pulseRate: 29, attack: 11 }), 121, effect(255, 95, 102, 'hiss', { air: 0.75, pulseRate: 22, attack: 18 }), 133, effect(491, 104, 85, 'hiss', { air: 0.93, pulseRate: 17, attack: 42, release: 185 })],
  },
  {
    id: 'doorbell-double', label: 'Звонят в дверь', category: 'Быт',
    description: 'Два «динь-дон»: высокая нота короткая, низкая длиннее.',
    parts: [effect(200, 535, 530, 'metal'), 52, effect(335, 333, 328, 'metal'), 185, effect(180, 540, 537, 'metal'), 57, effect(360, 336, 330, 'metal')],
  },
  {
    id: 'rubber-bass', label: 'Пружинящий бас', category: 'Музыка',
    description: 'Два коротких низких «бу» и третье длинное, со спуском.',
    parts: [effect(188, 164, 109, 'reed'), 65, effect(204, 172, 111, 'reed'), 125, effect(616, 220, 87, 'reed', { arc: 49, wobble: 0.032 })],
  },
  {
    id: 'gentle-flute', label: 'Флейта на репетиции', category: 'Музыка',
    description: 'Посвисти четыре ноты: низко, выше, ещё выше, снова низко.',
    parts: [effect(240, 294, 294, 'whistle'), 45, effect(230, 349, 349, 'whistle'), 45, effect(250, 440, 440, 'whistle'), 60, effect(465, 294, 294, 'whistle', { wobble: 0.021 })],
  },
  {
    id: 'pocket-beat', label: 'Битбокс на ходу', category: 'Музыка',
    description: 'Ртом сыграй «бум-тс-бум-тс»: чередуй бас и щелчок.',
    parts: [effect(192, 177, 70, 'drum'), 85, effect(149, 180, 90, 'hiss', { air: 0.9, attack: 7 }), 105, effect(206, 178, 75, 'drum'), 85, effect(155, 170, 95, 'hiss', { air: 0.89, attack: 6 })],
  },
  {
    id: 'tiny-trumpet', label: 'Карманная труба', category: 'Музыка',
    description: 'Губами сыграй три «па»: два коротких и одно торжественное.',
    parts: [effect(209, 260, 262, 'reed', { air: 0.07, attack: 16 }), 70, effect(199, 262, 260, 'reed', { air: 0.07, attack: 15 }), 90, effect(590, 349, 393, 'reed', { wobble: 0.025, air: 0.09 })],
  },
  {
    id: 'clipped-melody', label: 'Мелодия на ксилофоне', category: 'Музыка',
    description: '«Тинь-тон-тон-тинь»: первая и последняя ноты выше.',
    parts: [effect(169, 392, 392, 'metal'), 95, effect(150, 294, 294, 'metal'), 95, effect(150, 294, 294, 'metal'), 122, effect(245, 494, 494, 'metal')],
  },
  {
    id: 'slide-whistle', label: 'Свисток с поршнем', category: 'Музыка',
    description: 'Плавно взлети на свисте и неожиданно сбрось ноту.',
    parts: [effect(580, 175, 650, 'whistle', { wobble: 0.007 }), 50, effect(393, 631, 172, 'whistle', { wobble: 0.013, release: 125 })],
  },
  {
    id: 'triangle-taps', label: 'Музыкальный треугольник', category: 'Музыка',
    description: 'Три светлых «тинь», после последнего дай звуку затухнуть.',
    parts: [effect(175, 550, 550, 'metal'), 95, effect(172, 550, 550, 'metal'), 100, effect(660, 595, 590, 'metal', { decay: 1.9, release: 190 })],
  },
  {
    id: 'harmonica-breath', label: 'Губная гармошка', category: 'Музыка',
    description: 'Одна нота вперёд, короткая пауза и чуть более низкая назад.',
    parts: [effect(545, 385, 394, 'reed', { air: 0.19, attack: 80, wobble: 0.025 }), 180, effect(740, 340, 274, 'reed', { air: 0.21, attack: 110, release: 190, wobble: 0.036 })],
  },
  {
    id: 'drum-fill', label: 'Барабанная сбивка', category: 'Музыка',
    description: 'Четыре удара «та-та-там-бум», последний заметно ниже.',
    parts: [effect(120, 240, 122, 'drum', { air: 0.76 }), 70, effect(125, 228, 121, 'drum', { air: 0.76 }), 63, effect(190, 160, 98, 'drum', { air: 0.38 }), 92, effect(440, 118, 68, 'drum', { air: 0.16, decay: 2.45 })],
  },
  {
    id: 'string-twang', label: 'Одна гитарная струна', category: 'Музыка',
    description: 'Сымитируй два «дзынь» и натяни последний вверх.',
    parts: [effect(240, 191, 184, 'pluck'), 113, effect(236, 245, 237, 'pluck'), 144, effect(651, 195, 317, 'pluck', { decay: 2.1, wobble: 0.017 })],
  },
  {
    id: 'transit-portal', label: 'Портал раскрывается', category: 'Фантастика',
    description: 'Низкое «вууу» тянется вверх и исчезает с придыханием.',
    parts: [syllable(1010, 91, 331, 'oo', { style: 'pulse', pulseRate: 8, arc: 67, air: 0.18, attack: 160, release: 150, wobble: 0.048 }), effect(290, 220, 87, 'wind', { air: 0.61, release: 200 })],
  },
  {
    id: 'space-leviathan', label: 'Космический кит', category: 'Фантастика',
    description: 'Длинный плавный зов волной, потом тихий ответ ниже.',
    parts: [syllable(840, 137, 156, 'oh', { arc: 187, air: 0.18, attack: 100, release: 130, wobble: 0.025 }), 190, syllable(625, 174, 91, 'oo', { arc: 40, air: 0.16, gain: 0.54, release: 160 })],
  },
  {
    id: 'mirror-spark', label: 'Искра в кривом зеркале', category: 'Фантастика',
    description: 'Высокое «пьи», короткое эхо и треск на выдохе.',
    parts: [effect(236, 604, 305, 'whistle', { arc: 95, attack: 13 }), 145, effect(207, 457, 278, 'metal', { gain: 0.57 }), 165, effect(431, 170, 83, 'hiss', { air: 0.63, pulseRate: 18, release: 190 })],
  },
  {
    id: 'swamp-witch', label: 'Ведьма из болота', category: 'Фантастика',
    description: 'Хриплое «кхе», пауза и дрожащий смешок повыше.',
    parts: [syllable(335, 128, 92, 'eh', { style: 'rough', air: 0.52, attack: 22 }), 180, syllable(275, 245, 207, 'eh', { style: 'rough', air: 0.32, wobble: 0.082 }), 80, syllable(477, 309, 177, 'ee', { style: 'rough', air: 0.35, wobble: 0.12 })],
  },
  {
    id: 'moon-drops', label: 'Лунные капли', category: 'Фантастика',
    description: 'Три лёгких «плин» летят вверх; последнее дрожит.',
    parts: [effect(175, 191, 250, 'pluck'), 101, effect(185, 285, 355, 'pluck'), 115, effect(525, 398, 572, 'pluck', { decay: 2, wobble: 0.038 })],
  },
  {
    id: 'wind-in-helmet', label: 'Ветер в скафандре', category: 'Фантастика',
    description: 'Два порыва «ф-ф», второй громче и с коротким свистом.',
    parts: [effect(435, 145, 185, 'wind', { air: 0.57, attack: 120, release: 130 }), 155, effect(770, 190, 225, 'wind', { air: 0.96, pulseRate: 4, attack: 100, release: 210 }), effect(210, 443, 357, 'whistle', { air: 0.17, gain: 0.48 })],
  },
  {
    id: 'alien-hello', label: 'Инопланетянин здоровается', category: 'Фантастика',
    description: '«Уа-а? И-и! Мм» — три разных голоса в одном приветствии.',
    parts: [syllable(472, 110, 305, 'ah', { style: 'reed', wobble: 0.035 }), 90, syllable(240, 480, 571, 'ee', { arc: 45, air: 0.16, attack: 15 }), 140, syllable(460, 230, 100, 'mm', { style: 'pulse', pulseRate: 9, wobble: 0.07 })],
  },
  {
    id: 'starship-passing', label: 'Звездолёт пролетает', category: 'Фантастика',
    description: 'Длинное «ш-вууу-ш»: громче в середине, высота резко падает.',
    parts: [effect(337, 125, 250, 'wind', { air: 0.68, attack: 165 }), effect(780, 520, 138, 'reed', { wobble: 0.039, air: 0.49, attack: 125, release: 160 }), effect(415, 150, 77, 'wind', { air: 0.5, attack: 160, release: 260 })],
  },
  {
    id: 'miniature-thunder', label: 'Гроза в банке', category: 'Фантастика',
    description: 'Громкое «бах», за ним два спадающих раската.',
    parts: [effect(210, 172, 75, 'drum', { air: 1.15, attack: 7 }), 132, effect(435, 108, 73, 'wind', { air: 0.79, pulseRate: 13, attack: 38 }), 90, effect(522, 91, 70, 'wind', { air: 0.55, pulseRate: 7, attack: 68, release: 240 })],
  },
  {
    id: 'time-rewinds', label: 'Время перематывается', category: 'Фантастика',
    description: 'Нервное «вж-ж-ж» разгоняется, затем всё обрывает низкий «буп».',
    parts: [effect(820, 143, 581, 'pulse', { pulseRate: 18, pulseSweep: 23, air: 0.19, wobble: 0.055, attack: 90 }), 125, effect(270, 240, 84, 'drum', { air: 0.39, attack: 8 })],
  },
];

export const SOUNDS = Object.freeze(RECIPES.map(({ id, label, category, description }) => (
  Object.freeze({ id, label, category, description })
)));

const targets = new Map();
const TWO_PI = Math.PI * 2;
const FIXED_HARMONICS = {
  whistle: [0.94, 0.14, 0.03],
  drum: [0.93, 0.23, 0.065],
  reed: [0.93, 0.38, 0.43, 0.16, 0.22, 0.1, 0.08],
};

function spectralWeight(harmonic, frequency, formants, style) {
  if (style === 'robot') {
    return harmonic === 1 ? 0.9 : (harmonic % 2 ? 0.77 : 0.15) / harmonic;
  }
  if (FIXED_HARMONICS[style]) return FIXED_HARMONICS[style][harmonic - 1];
  if (style === 'pluck') return Math.exp(-0.24 * harmonic) * (1 + 0.2 * Math.sin(harmonic * 1.4)) / harmonic;
  const bands = [195, 255, 415];
  let resonance = 0;
  for (let band = 0; band < bands.length; band += 1) {
    const distance = (frequency - formants[band]) / bands[band];
    resonance += Math.exp(-0.5 * distance ** 2) / (1 + band * 0.7);
  }
  return (harmonic === 1 ? 0.8 : 0.13) / harmonic + resonance * 0.8 / Math.sqrt(harmonic);
}

function renderTarget(parts) {
  const size = parts.reduce((sum, part) => sum + (typeof part === 'number' ? part : part.ms), 90);
  const samples = new Float32Array(Math.round(SAMPLE_RATE * size / 1000));
  let offset = Math.round(SAMPLE_RATE * 0.035);
  let randomState = 38976;
  let noiseMemory = 0;
  let lowNoise = 0;
  for (const part of parts) {
    if (typeof part === 'number') {
      offset += Math.round(SAMPLE_RATE * part / 1000);
      continue;
    }
    const { ms, start, end, vowel, style, arc = 0, wobble = 0.012, gain = 0.83 } = part;
    const percussive = style === 'drum' || style === 'pluck' || style === 'metal';
    const { air = style === 'drum' ? 0.43 : 0.055, attack = percussive ? 9 : 43, release = 95, decay = percussive ? 3.35 : 0 } = part;
    const { pulseRate = style === 'pulse' ? 15 : 0, pulseSweep = 0 } = part;
    const length = Math.round(SAMPLE_RATE * ms / 1000);
    const hasPartials = style !== 'hiss' && style !== 'wind' && style !== 'metal';
    const partials = hasPartials ? Math.min(FIXED_HARMONICS[style]?.length ?? 16, Math.floor(7500 / (Math.max(start, end) + arc))) : 0;
    const harmonics = new Float32Array(partials);
    const formants = FORMANTS[vowel];
    let phase = 0;
    for (let i = 0; i < length; i += 1) {
      const time = i / SAMPLE_RATE;
      const progress = i / length;
      const curve = progress * progress * (3 - 2 * progress);
      const base = start + (end - start) * curve + arc * Math.sin(Math.PI * progress);
      const frequency = base * (1 + wobble * Math.sin(TWO_PI * 6.2 * time));
      phase += TWO_PI * frequency / SAMPLE_RATE;
      if (i % 32 === 0) {
        for (let harmonic = 1; harmonic <= harmonics.length; harmonic += 1) {
          harmonics[harmonic - 1] = spectralWeight(harmonic, harmonic * frequency, formants, style);
        }
      }
      let waveform = 0;
      for (let harmonic = 1; harmonic <= harmonics.length; harmonic += 1) {
        waveform += harmonics[harmonic - 1] * Math.sin(harmonic * phase + harmonic * 0.2);
      }
      if (style === 'metal') {
        waveform = 0.85 * Math.sin(phase) + Math.exp(-4 * progress) * (0.44 * Math.sin(phase * 2.73) + 0.24 * Math.sin(phase * 4.18));
      }
      if (style === 'rough') waveform *= 0.77 + 0.23 * Math.sin(TWO_PI * 27 * time);
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      const noise = randomState / 2147483648 - 1;
      noiseMemory += 0.32 * (noise - noiseMemory);
      const onset = Math.sin(Math.PI / 2 * Math.min(1, time * 1000 / attack));
      const tail = Math.sin(Math.PI / 2 * Math.min(1, (ms - time * 1000) / release));
      let breath = (noiseMemory * 0.79 + noise * 0.21) * air;
      if (style === 'hiss' || style === 'wind') {
        const response = Math.min(0.42, TWO_PI * frequency / SAMPLE_RATE);
        lowNoise += response * (noise - lowNoise);
        breath = (style === 'hiss' ? (noise - lowNoise) * 0.82 : lowNoise * 1.65 + noiseMemory * 0.32) * air;
      }
      const pulseTime = time * (pulseRate + 0.5 * pulseSweep * progress);
      const pulse = pulseRate ? 0.24 + 0.76 * (0.5 + 0.5 * Math.sin(TWO_PI * pulseTime)) ** 2 : 1;
      samples[offset + i] = Math.tanh((waveform + breath) * gain) * onset * tail * pulse * Math.exp(-decay * progress);
    }
    offset += length;
  }
  return samples;
}

export function getTarget(id) {
  if (!targets.has(id)) {
    const recipe = RECIPES.find((entry) => entry.id === id);
    if (!recipe) throw new RangeError('Этот звук уже недоступен.');
    targets.set(id, renderTarget(recipe.parts));
  }
  return targets.get(id).slice();
}

let audioContext;
let recordingInProgress = false;

function openAudioContext() {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) throw new Error('Этот браузер не поддерживает обработку звука.');
  if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContextClass();
  return audioContext;
}

export async function playSamples(samples, sampleRate = SAMPLE_RATE) {
  if (samples.length === 0) return;
  const context = openAudioContext();
  if (context.state !== 'running') await context.resume();
  const buffer = context.createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(samples, 0);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  await new Promise((resolve) => {
    source.onended = () => {
      source.disconnect();
      resolve();
    };
    source.start();
  });
}

function resample(samples, inputRate) {
  if (inputRate === SAMPLE_RATE) return samples;
  const step = inputRate / SAMPLE_RATE;
  const output = new Float32Array(Math.floor(samples.length / step));
  for (let i = 0; i < output.length; i += 1) {
    const start = i * step;
    const end = start + step;
    let total = 0;
    for (let j = Math.floor(start); j < end; j += 1) {
      const weight = Math.min(end, j + 1) - Math.max(start, j);
      total += weight * (samples[j] ?? 0);
    }
    output[i] = total / step;
  }
  return output;
}

export async function recordSamples(durationMs, onLevel = () => {}) {
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 12000) {
    throw new RangeError('Некорректное время записи.');
  }
  if (recordingInProgress) throw new Error('Запись уже идёт.');
  if (!globalThis.navigator?.mediaDevices?.getUserMedia) {
    throw new Error('Микрофон доступен на HTTPS или localhost.');
  }

  recordingInProgress = true;
  let stream;
  let source;
  let processor;
  let muted;
  let timer;
  try {
    const context = openAudioContext();
    const resume = context.state === 'running' ? Promise.resolve() : context.resume();
    // Observe rejection while the permission dialog is open.
    resume.catch(() => {});
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    await resume;

    const frames = new Float32Array(Math.round(context.sampleRate * durationMs / 1000));
    source = context.createMediaStreamSource(stream);
    processor = context.createScriptProcessor(2048, 1, 1);
    muted = context.createGain();
    muted.gain.value = 0;
    const capture = await new Promise((resolve, reject) => {
      let position = 0;
      const finish = () => {
        if (position < frames.length * 0.7) {
          reject(new Error('Микрофон не успел передать запись. Попробуй ещё раз.'));
          return;
        }
        resolve(frames.subarray(0, position));
      };
      processor.onaudioprocess = ({ inputBuffer }) => {
        const input = inputBuffer.getChannelData(0).subarray(0, frames.length - position);
        frames.set(input, position);
        position += input.length;
        let squares = 0;
        for (const sample of input) squares += sample * sample;
        try {
          onLevel(Math.min(1, 4 * Math.sqrt(squares / Math.max(1, input.length))));
        } catch (error) {
          reject(error);
        }
        if (position === frames.length) finish();
      };
      source.connect(processor);
      processor.connect(muted);
      muted.connect(context.destination);
      timer = setTimeout(finish, durationMs + 1150);
    });
    return resample(capture, context.sampleRate);
  } finally {
    clearTimeout(timer);
    if (processor) processor.onaudioprocess = null;
    source?.disconnect();
    processor?.disconnect();
    muted?.disconnect();
    stream?.getTracks().forEach((track) => track.stop());
    recordingInProgress = false;
  }
}

const WINDOW = 640;
const STRIDE = 320;
const NO_SCORE = Object.freeze({ total: 0, rhythm: 0, pitch: 0, tone: 0 });

function detectPitch(samples, start) {
  const reducedRate = SAMPLE_RATE / 2;
  const window = new Float32Array(WINDOW / 2);
  let mean = 0;
  for (let i = 0; i < window.length; i += 1) {
    window[i] = ((samples[start + i * 2] ?? 0) + (samples[start + i * 2 + 1] ?? 0)) / 2;
    mean += window[i];
  }
  mean /= window.length;
  for (let i = 0; i < window.length; i += 1) window[i] -= mean;

  const minLag = Math.floor(reducedRate / 710);
  const maxLag = Math.ceil(reducedRate / 68);
  const correlations = new Float32Array(maxLag + 2);
  let strongest = 0;
  for (let lag = minLag - 1; lag <= maxLag + 1; lag += 1) {
    let product = 0;
    let energyA = 0;
    let energyB = 0;
    for (let i = 0; i < window.length - lag; i += 1) {
      const a = window[i];
      const b = window[i + lag];
      product += a * b;
      energyA += a * a;
      energyB += b * b;
    }
    correlations[lag] = (product / (Math.sqrt(energyA * energyB) + 1e-10)) * (1 - lag / window.length * 0.14);
    strongest = Math.max(strongest, correlations[lag]);
  }
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    const left = correlations[lag - 1];
    const middle = correlations[lag];
    const right = correlations[lag + 1];
    if (middle >= Math.max(0.57, strongest * 0.89) && middle >= left && middle >= right) {
      const curve = left - 2 * middle + right;
      const adjustment = curve ? 0.5 * (left - right) / curve : 0;
      return { note: 12 * Math.log2(reducedRate / (lag + adjustment) / 440), clarity: middle };
    }
  }
  return { note: null, clarity: Math.max(0, strongest) };
}

function analyze(samples) {
  const frames = [];
  let peak = 0;
  for (let start = 0; start + WINDOW / 2 <= samples.length; start += STRIDE) {
    let sum = 0;
    let squares = 0;
    let motion = 0;
    let last = samples[start] ?? 0;
    for (let i = start; i < start + WINDOW; i += 1) {
      const current = samples[i] ?? 0;
      sum += current;
      squares += current * current;
      motion += (current - last) ** 2;
      last = current;
    }
    const rms = Math.sqrt(Math.max(0, squares / WINDOW - (sum / WINDOW) ** 2));
    const brightness = Math.sqrt(motion / WINDOW) / (rms + 1e-9);
    frames.push({ start, rms, brightness });
    peak = Math.max(peak, rms);
  }

  if (peak < 0.006) return null;
  const floor = Math.max(0.004, peak * 0.11);
  const first = frames.findIndex((frame) => frame.rms >= floor);
  if (first === -1) return null;
  let last = frames.length - 1;
  while (last > first && frames[last].rms < floor) last -= 1;
  const active = frames.slice(first, last + 1);
  if (active.length < 4) return null;
  for (const frame of active) {
    const voiced = frame.rms >= floor;
    frame.envelope = Math.sqrt(frame.rms / peak);
    const { note, clarity } = voiced ? detectPitch(samples, frame.start) : { note: null, clarity: 0 };
    frame.note = note;
    frame.clarity = clarity;
    frame.active = voiced;
  }
  return active;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function estimateTone(frames) {
  const active = frames.filter((frame) => frame.active);
  return {
    clarity: mean(active.map((frame) => frame.clarity)),
    brightness: mean(active.map((frame) => Math.log(frame.brightness + 0.045))),
  };
}

function roundScore(fraction) {
  return Math.round(Math.max(0, Math.min(1, fraction)) * 100);
}

export function scoreSamples(recording, target) {
  const attempt = analyze(recording);
  const reference = analyze(target);
  if (!attempt || !reference) return { ...NO_SCORE };

  const contourErrors = [];
  const envelopeErrors = [];
  const activityErrors = [];
  let pairedPitch = 0;
  let referencePitch = 0;
  let referenceNoise = 0;
  let pairedNoise = 0;
  for (let bin = 0; bin < 40; bin += 1) {
    const point = bin / 39;
    const actual = attempt[Math.round(point * (attempt.length - 1))];
    const expected = reference[Math.round(point * (reference.length - 1))];
    envelopeErrors.push(Math.abs(actual.envelope - expected.envelope));
    activityErrors.push(Number(actual.active !== expected.active));
    if (expected.note !== null) {
      referencePitch += 1;
      if (actual.note !== null) {
        pairedPitch += 1;
        contourErrors.push(actual.note - expected.note);
      }
    } else if (expected.active) {
      referenceNoise += 1;
      if (actual.active && actual.note === null) pairedNoise += 1;
    }
  }

  const durationSimilarity = Math.exp(-1.25 * Math.abs(Math.log(attempt.length / reference.length)));
  const rhythm = roundScore(durationSimilarity * 0.45 + Math.max(0, 1 - 1.7 * mean(envelopeErrors)) * 0.4 + (1 - mean(activityErrors)) * 0.15);

  const offset = mean(contourErrors);
  const octaveOffset = offset - 12 * Math.round(offset / 12);
  const matchingRegister = 0.7 * Math.exp(-Math.abs(offset) / 14) + 0.3 * Math.exp(-Math.abs(octaveOffset) / 4.5);
  const curveSimilarity = Math.exp(-mean(contourErrors.map((error) => Math.abs(error - offset))) / 5.2);
  const matchedPitch = pairedPitch * (matchingRegister * 0.35 + curveSimilarity * 0.65);
  const pitch = roundScore((matchedPitch + pairedNoise) / Math.max(1, referencePitch + referenceNoise));

  const actualTone = estimateTone(attempt);
  const expectedTone = estimateTone(reference);
  const brightnessSimilarity = Math.exp(-0.85 * Math.abs(actualTone.brightness - expectedTone.brightness));
  const claritySimilarity = 1 - Math.min(1, Math.abs(actualTone.clarity - expectedTone.clarity) * 1.6);
  const tone = roundScore(brightnessSimilarity * 0.64 + claritySimilarity * 0.36);
  const total = Math.round(rhythm * 0.33 + pitch * 0.45 + tone * 0.22);
  return { total, rhythm, pitch, tone };
}

export function encodeSamples(samples) {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  const chunks = [];
  for (let i = 0; i < bytes.length; i += 16384) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 16384)));
  return btoa(chunks.join(''));
}

export function decodeSamples(encoded) {
  if (typeof encoded !== 'string' || encoded.length > SAMPLE_RATE * 12 * 2 * 4 / 3 + 4) {
    throw new TypeError('Запись повреждена или слишком длинная.');
  }
  const decoded = atob(encoded);
  if (decoded.length % 2 !== 0) throw new TypeError('Запись повреждена.');
  const samples = new Float32Array(decoded.length / 2);
  for (let i = 0; i < samples.length; i += 1) {
    const unsigned = decoded.charCodeAt(i * 2) | decoded.charCodeAt(i * 2 + 1) << 8;
    samples[i] = (unsigned >= 32768 ? unsigned - 65536 : unsigned) / 32768;
  }
  return samples;
}
