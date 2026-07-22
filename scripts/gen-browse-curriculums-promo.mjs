import { fal } from '@fal-ai/client'
import { writeFileSync } from 'fs'

fal.config({ credentials: process.env.FAL_KEY })

const prompt = `stylized anime open-world adventure game aesthetic with luminous atmosphere, elegant stylization, aspirational exploration, and wide curious vistas. A lone explorer figure, small in frame with back to camera, stands on a grassy overlook as multiple curving stone and earthen paths branch outward into varied landscapes: a forested valley, distant mountain spires, a coastal village in golden light, a wildflower meadow, a ruined library under a hill. Each path invites a different journey. Warm late-afternoon sun, long soft shadows, painterly detail, crisp horizon lines, wide landscape composition, inviting and exploratory mood, high detail without clutter, coherent painterly composition, believable fantasy-adventure environment. Avoid text overlays, watermarks, game UI, HUD elements, minimap, status bars, weapons, combat, violence, Studio Ghibli character likenesses, Genshin Impact characters, specific franchise logos, classroom cues, school desks, childish cartoon proportions, distorted hands, stock-photo stiffness. No text. No watermark.`

const version = process.env.VERSION || 'v1'
console.log(`Submitting A4 anime open-world promo (${version}) to fal.ai...`)

const result = await fal.subscribe('fal-ai/flux-pro/v1.1', {
  input: {
    prompt,
    image_size: { width: 1536, height: 640 },
    num_images: 1,
    safety_tolerance: '5',
    output_format: 'jpeg',
  },
  logs: false,
})

const url = result.data.images[0].url
console.log('Generated:', url)
const res = await fetch(url)
const buf = Buffer.from(await res.arrayBuffer())
const outPath = `/home/sal/Projects/lessonhollow/public/curriculums/browse-curriculums-promo-${version}.jpg`
writeFileSync(outPath, buf)
console.log('Saved:', outPath, buf.length, 'bytes')
