import { fal } from '@fal-ai/client'
import { writeFileSync } from 'fs'

fal.config({ credentials: process.env.FAL_KEY })

const prompt = `A cozy farm-sim pixel game aesthetic with gentle rhythm, charming domestic warmth, seasonal abundance, handmade detail, soft inviting color logic, and peaceful but lively daily life. In this scene, a single adult curator is sitting at a warm wooden table in a cozy home nook, leaning over an open paper notebook with a hand-penned list visible on it, pen in hand, mid-choice, fully absorbed. The table holds a small stack of books spine-out in an opinionated curated pile, a couple of handmade paper bookmarks, a few postcards and film-ticket stubs tucked into one of the books, a ceramic mug of hot drink steaming gently, a small sprouting potted plant, a pair of tiny glass jars of ink or tea, and a folded handwritten letter. A soft golden-hour afternoon light pours through a window behind the character, warming the whole scene. The home around them is pixel-rendered in the cozy farm-sim style with a sense of seasonal rhythm: a small garden visible through the window, a hanging dried-herb bundle, a ripe fruit bowl on a shelf, and framed seasonal prints on the walls. The mood is restful, satisfied, quietly creative, slow-hobby, and domestically warm, capturing the pleasure of a list-builder mid-curation. Composition should feel like a single cozy vignette with one clear character, one table, and one task, dimensional and story-rich. Lighting should feel warm, golden, soft, and inviting. Avoid classroom cues, school desks, homework vibes, multiple people, rushed energy, crowded composition, readable text on the notebook or books, modern tech devices like laptops or phones, distorted hands, uncanny facial expressions, and stock photo stiffness. No text. No watermark.`

const version = process.env.HERO_VERSION || 'v1'
console.log(`Submitting A2 cozy farm-sim pixel hero (${version}) to fal.ai...`)
const result = await fal.subscribe('fal-ai/flux-pro/v1.1', {
  input: {
    prompt,
    image_size: 'landscape_16_9',
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
const outPath = `/home/sally/Projects/lessonhollow/public/blog/a-new-pastime-for-list-builders-hero-${version}.jpg`
writeFileSync(outPath, buf)
console.log('Saved:', outPath, buf.length, 'bytes')
