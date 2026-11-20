// Паспорт игры: кто герой, какие места, что где лежит.
// Для другого ребёнка меняются этот файл, strings.js и папка assets — game.js не трогаем.
// Координаты — на «сцене» 720×1280 (ширина × высота), точка [x, y] — центр предмета.
export const PASSPORT = {
  id: "arina-finik",
  seed: 20261120,

  // Готовые рисунки: имя → файл в assets/img. Пока рисунка нет, вместо него рисуется смайлик из emoji.
  images: {},
  // Озвучка: ключ фразы из strings.js → файл в assets/voice.
  voice: {},
  // Фоновая музыка: файл в assets/audio или null.
  music: null,

  emoji: {
    hero_idle: "👧", hero_happy: "👧", hero_think: "👧",
    finik: "🐶", finik_happy: "🐶",
    ball: "⚽", ball2: "🎾", ball3: "🏀",
    bone: "🦴", sock: "🧦", teddy: "🧸", bowl: "🥣", shoe: "👟", cap: "🧢",
    flashlight: "🔦", gift: "🎁", heart: "❤️",
    flower: "🌷", broom: "🧹", basket: "🧺", box: "📦", umbrella: "☂️", apple: "🍎",
    node_porch: "🏠", node_garden: "🌳", node_shed: "🏚️", node_gazebo: "🍇", node_gate: "🚪", node_final: "🎁",
  },

  // Фоны-заглушки: цвета неба и земли, крупный ориентир и мелкий декор [смайлик, x, y, размер].
  bg: {
    bg_map:    { sky: ["#8FD3FF", "#DDF3FF"], ground: ["#9BD98A", "#63B85C"], mark: "", decor: [["🌳", 90, 500, 150], ["🌻", 640, 760, 90], ["🌷", 110, 900, 80], ["🌳", 650, 1120, 170]] },
    bg_porch:  { sky: ["#8FD3FF", "#E6F6FF"], ground: ["#E8C9A0", "#D4A976"], mark: "🏠", decor: [] },
    bg_garden: { sky: ["#9ADCFF", "#E3F7E0"], ground: ["#A6DE8F", "#6CBF5A"], mark: "🌳", decor: [["🌼", 80, 620, 70], ["🌼", 660, 760, 70]] },
    bg_shed:   { sky: ["#5B6B8C", "#8A93A8"], ground: ["#7A6753", "#5E4E3F"], mark: "🏚️", decor: [] },
    bg_gazebo: { sky: ["#8FD3FF", "#E6F6FF"], ground: ["#B6E39C", "#7CC96A"], mark: "🍇", decor: [] },
    bg_gate:   { sky: ["#FFD9A8", "#FFF1DC"], ground: ["#A6DE8F", "#6CBF5A"], mark: "🚪", decor: [] },
    bg_final:  { sky: ["#FFC9DE", "#FFF1DC"], ground: ["#A6DE8F", "#6CBF5A"], mark: "🌳", decor: [["🌷", 100, 1000, 90], ["🌻", 620, 1040, 100]] },
  },

  intro: [
    { bg: "bg_porch", actors: [["hero_idle", 360, 860, 320]], line: "intro1" },
    { bg: "bg_porch", actors: [["hero_think", 240, 860, 300], ["bowl", 500, 960, 170]], line: "intro2" },
    { bg: "bg_map", actors: [["hero_happy", 360, 820, 320]], line: "intro3" },
  ],

  // Точки на карте двора: пять мест с играми и шестая — финал.
  map: {
    nodes: [
      { x: 190, y: 1080, icon: "node_porch" },
      { x: 540, y: 960, icon: "node_garden" },
      { x: 220, y: 810, icon: "node_shed" },
      { x: 530, y: 680, icon: "node_gazebo" },
      { x: 240, y: 540, icon: "node_gate" },
      { x: 500, y: 420, icon: "node_final" },
    ],
  },

  levels: [
    {
      type: "find", bg: "bg_porch", line: "find",
      targets: [["ball", 150, 950, 110], ["bone", 560, 820, 100], ["sock", 330, 560, 90], ["teddy", 600, 480, 110], ["bowl", 120, 640, 110]],
      decoys: [["flower", 640, 1000, 90], ["broom", 90, 420, 130], ["basket", 400, 900, 120], ["box", 250, 760, 120], ["umbrella", 480, 380, 110], ["apple", 470, 680, 70]],
      winSlide: { bg: "bg_porch", actors: [["hero_happy", 250, 840, 300], ["teddy", 500, 930, 170]], line: "win0" },
    },
    {
      type: "tracks", bg: "bg_garden", line: "tracks",
      dog: [[360, 1040], [240, 950], [350, 860], [490, 790], [560, 670], [430, 600], [280, 540], [360, 400]],
      cat: [[120, 820], [610, 930], [150, 620], [600, 440]],
      bird: [[520, 1040], [120, 420], [640, 560], [130, 1010]],
      winSlide: { bg: "bg_garden", actors: [["hero_happy", 360, 840, 320]], line: "win1" },
    },
    {
      type: "memory", bg: "bg_shed", line: "memory",
      pairs: ["ball", "bone", "sock", "teddy", "shoe", "cap"],
      winSlide: { bg: "bg_shed", actors: [["hero_happy", 250, 840, 300], ["flashlight", 500, 900, 190]], line: "win2" },
    },
    {
      type: "catch", bg: "bg_gazebo", line: "catch",
      balls: ["ball", "ball2", "ball3"], need: 8,
      winSlide: { bg: "bg_gazebo", actors: [["hero_happy", 250, 840, 300], ["ball", 500, 930, 170]], line: "win3" },
    },
    {
      type: "puzzle", bg: "bg_gate", line: "puzzle", cols: 2, rows: 3,
      // Картинка-заглушка для пазла на поле 480×720: [смайлик, x, y, размер].
      pic: [["🌳", 110, 260, 260], ["🏡", 330, 300, 300], ["🐶", 230, 530, 210], ["🎁", 390, 580, 140], ["❤️", 300, 120, 90]],
      winSlide: { bg: "bg_gate", actors: [["hero_happy", 360, 840, 320]], line: "win4" },
    },
  ],

  finale: [
    { bg: "bg_final", actors: [["finik_happy", 360, 820, 340]], line: "fin1" },
    { bg: "bg_final", actors: [["finik_happy", 220, 800, 260], ["ball", 470, 900, 110], ["bone", 580, 820, 110], ["teddy", 500, 740, 120], ["gift", 600, 960, 130]], line: "fin2" },
    { bg: "bg_final", actors: [["hero_happy", 250, 830, 300], ["finik_happy", 490, 880, 240], ["heart", 370, 640, 110]], line: "fin3" },
  ],
};
