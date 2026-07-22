export type ArtStyle = {
  name: string
  prompt: string
}

export const ART_STYLES: ArtStyle[] = [
  { name: 'American Impressionism', prompt: 'American Impressionism, loose brushstrokes, plein air light, Childe Hassam and William Merritt Chase style' },
  { name: 'American Regionalism', prompt: 'American Regionalism, rolling landscapes, bold simplified forms, Grant Wood and Thomas Hart Benton style' },
  { name: 'Baroque', prompt: 'Baroque, dramatic chiaroscuro, rich detail, Caravaggio and Rembrandt style' },
  { name: 'Cinematic Anime', prompt: 'Cinematic Anime, lush backgrounds, dramatic lighting, Studio Ghibli and Makoto Shinkai style' },
  { name: 'Fauvism', prompt: 'Fauvism, wild vivid colors, bold outlines, Henri Matisse and André Derain style' },
  { name: 'Golden Age Illustration', prompt: 'Golden Age Illustration, rich detail, storybook quality, N.C. Wyeth and Howard Pyle style' },
  { name: 'Golden Age Watercolor', prompt: 'Golden Age Watercolor, luminous washes, delicate detail, Winslow Homer and John Singer Sargent style' },
  { name: 'Hudson River', prompt: 'Hudson River School, majestic landscapes, golden light, Thomas Cole and Frederic Edwin Church style' },
  { name: 'Impressionism', prompt: 'Impressionism, soft light, visible brushstrokes, Claude Monet and Pierre-Auguste Renoir style' },
  { name: 'Photorealism', prompt: 'Photorealism, hyper-detailed, sharp focus, close to a photograph' },
  { name: 'Pop Art', prompt: 'Pop Art, bold flat colors, Ben-Day dots, Andy Warhol and Roy Lichtenstein style' },
  { name: 'Post-Impressionism', prompt: 'Post-Impressionism, vivid colors, thick paint, Vincent van Gogh and Paul Cézanne style' },
  { name: 'Pre-Raphaelite', prompt: 'Pre-Raphaelite, luminous color, intricate detail, Dante Gabriel Rossetti and John Everett Millais style' },
  { name: 'Realism', prompt: 'Realism, faithful representation, natural lighting, Gustave Courbet style' },
  { name: 'Renaissance', prompt: 'Renaissance, classical composition, sfumato, Leonardo da Vinci and Raphael style' },
  { name: 'Romanticism', prompt: 'Romanticism, dramatic nature, emotional intensity, Caspar David Friedrich and J.M.W. Turner style' },
  { name: 'Surrealism', prompt: 'Surrealism, dreamlike impossible scenes, Salvador Dalí and René Magritte style' },
  { name: 'Tonalism', prompt: 'Tonalism, soft muted tones, atmospheric haze, George Inness and James McNeill Whistler style' },
  { name: 'Ukiyo-e', prompt: 'Ukiyo-e, flat color woodblock print, bold outlines, Hokusai and Hiroshige style' },
]

export const MUSIC_GENRES = [
  '50s Rock',
  '60s Rock',
  '80s Rock',
  'Broadway',
  'Country Pop',
  'Crooner',
  'Disco',
  'Film Score',
  'Folk Rock',
  'Funk',
  'Heavy Metal',
  'Indie',
  'K-Pop',
  'Opera',
  'Outlaw Country',
  'Pop',
  'Progressive House with Vocals',
  'Soul',
  'Swing',
  'Techno Opera',
] as const

export type MusicGenre = (typeof MUSIC_GENRES)[number]
