// Everything the little rover says. Edit freely: each list is used in turn (it cycles, so lines don't repeat
// back to back). Keys of AREA match the stops in ScrollRover.tsx.

export type AreaKey = 'top' | 'meet0' | 'meet1' | 'meet2' | 'meet3' | 'trails' | 'explore' | 'score' | 'boots' | 'end';

/** Said every time you arrive in a part of the page (scrolling there yourself, or following the rover). */
export const AREA: Record<AreaKey, string[]> = {
  top: [
    'Hi! I’m Percy. Tap me and I’ll show you around!',
    'Back at the start! Earth, Mars and the Moon, all in one sky.',
    'Spin the worlds with the arrows. The red one is my favourite.',
  ],
  meet0: [
    'Watch Earth’s land squeeze into one ball!',
    'All of Earth’s continents, rolled up like dough!',
    'Keep scrolling: something magic happens to the land.',
  ],
  meet1: [
    'Ta-da! That ball is the size of Mars!',
    'All of Earth’s land is about as big as all of Mars!',
    'See? Mars is my home, and it’s Earth-land-sized.',
  ],
  meet2: [
    'Mars next to Earth, at true size. Small but mighty!',
    'Mars is about half as wide as Earth.',
    'Earth is the big sister. Mars is the cool little one.',
  ],
  meet3: [
    'And the moons! Phobos and Deimos are tiny potatoes.',
    'Phobos is only about 22 km across. Our Moon is huge next to it!',
    'Deimos is about 12 km wide. You could drive around it in a day... well, not me.',
  ],
  trails: [
    'Six trails: Rust, Soil, Fire, Wind, Water, South Pole. Pick one!',
    'Twin Trails! Let’s see, hear and even smell each world.',
    'I brought microphones to Mars. You can hear my recordings here!',
  ],
  explore: [
    'Pick a place and walk on real Mars ground with me!',
    'I drive around in here too. In 3D, with my big wheels!',
    'Real terrain from orbit cameras. Wheels ready!',
  ],
  score: [
    'Which spot on Earth is my twin? Pick a place!',
    'Numbers time! 100 would be a perfect twin.',
    'We compared hundreds of Earth patches. Science!',
  ],
  boots: [
    'Real boots on real sand. I’m jealous!',
    'The team went to Egypt and Saudi Arabia to find Mars on Earth!',
    'Field trip photos! These places look like home to me.',
  ],
  end: [
    'Touchdown! Tap me and I’ll fly you back to the top.',
    'That’s the whole trip! Thanks for riding along.',
  ],
};

/** Short labels for "Follow me → ..." */
export const AREA_LABEL: Record<AreaKey, string> = {
  top: 'the start', meet0: 'Meet Mars', meet1: 'the Mars-sized ball', meet2: 'Mars and Earth side by side', meet3: 'the moons',
  trails: 'Twin Trails', explore: 'Explore', score: 'Twin Score', boots: 'Our Trip', end: 'the end',
};

/** Said when you tap the rover and it leads you on. "{next}" becomes the next stop's label. */
export const FOLLOW = ['Follow me! Next up: {next}.', 'This way, off to {next}!', 'Come on, next is {next}!', 'Hold on tight, we’re going to {next}!'];
export const BACK_TO_TOP = ['Wheee! Back to the top!', 'Again? Let’s go up!', 'Beam me up! To the start!'];

/** Reactions to what you do on the page. */
export const FAST = ['Wheeeee!', 'Whoa, so fast!', 'My wheels are spinning!', 'Speed run!'];
export const WAKE = ['Huh? I’m up! I’m up!', 'Was I asleep? Just charging.', 'Good morning! Is it a new sol?'];
export const HELLO = ['Hi there!', 'Hello, human!', 'Boop!', 'Hehe, that tickles.'];
export const HINT = [
  'Psst! Tap me and I’ll take you to the next part.',
  'Want a tour? Tap me!',
  'I know the way. Tap me and follow!',
];
export const FACTS = [
  'A day on Mars is 24 h 39 min. Extra nap time.',
  'I landed in Jezero Crater in February 2021.',
  'Mars is red because of rust in the dust.',
  'Sunsets on Mars are blue!',
  'On Mars I weigh only 38% of what I weigh here.',
  'My helicopter friend Ingenuity flew 72 times!',
  'I have 23 cameras. Smile!',
  'My top speed is about 150 metres an hour. Zoom.',
  'A year on Mars lasts 687 Earth days. Long birthday wait.',
  'Olympus Mons is about 22 km tall. Biggest volcano we know!',
];
export const SELFIE = ['Selfie time!', 'Say “regolith”!', 'Click! For the album.'];
export const DANCE = ['Dance break!', 'Rover shuffle!', '♪ beep boop ♪'];

/** When you click things on the page. Keys of TRAIL are the trail tab titles, lower-case. */
export const TRAIL: Record<string, string> = {
  rust: 'Rust! That’s why Mars is red.',
  soil: 'Soil! I scoop that up for science.',
  fire: 'Fire! Mars has the biggest volcano we know.',
  wind: 'Wind! Dust devils love Mars.',
  water: 'Water! There’s ice hiding under the dust.',
  'south pole': 'The South Pole! Ice hides in the shadows there.',
};
export const PICK_MARS = ['Good pick! Let’s find its Earth twin.', 'Ooh, I know that place!', 'Mars choice! Excellent taste.'];
export const PICK_MOON = ['The Moon! Not my planet, but cool.', 'Moon pick! Astronauts will go there.'];
export const SPIN_WORLD = ['Spin, spin!', 'Ooh, a different world!', 'Go, go, red planet!'];
export const PHOTO = ['Nice photo!', 'Looks just like Mars!', 'Ooh, next one!'];
export const SENSES = ['Ooh, senses!', 'Look, listen, sniff!', 'I wish I could smell Mars.'];
export const WORLD_PICK = ['Off we go!', 'Good choice!'];
