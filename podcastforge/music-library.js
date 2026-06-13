/* PodcastForge — Royalty-free music sources
   A curated list of reputable libraries the user can pull background music
   from, each with its license model and a function to build a keyword-seeded
   search URL. We link to sources rather than hotlinking tracks so attribution
   and licensing are always verified at the source. Loaded before music.js. */
window.PF_MUSIC_SOURCES = [
  {
    name: 'YouTube Audio Library',
    license: 'Royalty-free (some require attribution)',
    note: 'Free for any use including monetized videos; check the per-track attribution flag.',
    home: 'https://studio.youtube.com/channel/UC/music',
    search: (q) => `https://studio.youtube.com/channel/UC/music?q=${encodeURIComponent(q)}`
  },
  {
    name: 'Pixabay Music',
    license: 'Pixabay Content License (no attribution required)',
    note: 'Free for commercial use, no attribution needed.',
    home: 'https://pixabay.com/music/',
    search: (q) => `https://pixabay.com/music/search/${encodeURIComponent(q)}/`
  },
  {
    name: 'Free Music Archive',
    license: 'Creative Commons (varies by track)',
    note: 'Filter to CC0 / CC-BY; attribution required for CC-BY.',
    home: 'https://freemusicarchive.org/',
    search: (q) => `https://freemusicarchive.org/search/?quicksearch=${encodeURIComponent(q)}`
  },
  {
    name: 'ccMixter',
    license: 'Creative Commons (attribution usually required)',
    note: 'Community remixes; great for unique beds. Check each track’s CC terms.',
    home: 'https://dig.ccmixter.org/',
    search: (q) => `https://dig.ccmixter.org/search?searchp=${encodeURIComponent(q)}`
  },
  {
    name: 'Incompetech (Kevin MacLeod)',
    license: 'CC-BY 4.0 (attribution required)',
    note: 'Huge, well-documented library; attribution line provided per track.',
    home: 'https://incompetech.com/music/royalty-free/music.html',
    search: (q) => `https://incompetech.com/music/royalty-free/music.html?genre=${encodeURIComponent(q)}`
  },
  {
    name: 'Chosic',
    license: 'CC / royalty-free (varies)',
    note: 'Aggregator with mood/genre filters and clear license labels.',
    home: 'https://www.chosic.com/free-music/all/',
    search: (q) => `https://www.chosic.com/free-music/all/?keyword=${encodeURIComponent(q)}`
  }
];
