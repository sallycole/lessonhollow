import { fal } from '@fal-ai/client'
import { writeFileSync } from 'fs'

fal.config({ credentials: process.env.FAL_KEY })

const prompt = `A sci-fi exploration game aesthetic with clean starship or lab environment, holographic workbench interfaces, sleek metallic surfaces, cool atmospheric lighting, approachable futuristic detail, and curious-explorer energy. Rendered in the style of a AAA MMO game in-engine character portrait, like EVE Online character art: stylized 3D game character model with smoothed idealized features, subtle painterly shader lighting, soft rim light, clearly a video game character, not a real person. In this scene, a young blonde kid, around 8 years old, sits alone at a chunky industrial workbench inside the engineering bay of a working mining ship. The ship interior is utilitarian: metal bulkheads with visible rivets and panel seams, exposed conduit along the walls, a small porthole showing the dark of space beyond. The kid is absorbed in assembling a chunky colorful beginner robot kit, the parts spread on the bench. The mood is quiet, focused, mid-project wonder aboard a working ship. Composition should feel spacious and industrial. Lighting should feel cool industrial blue from overhead panels mixed with a warm amber work-light over the bench. Avoid photorealism, avoid realistic skin texture, avoid documentary photography, avoid live-action film look, avoid classroom cues, avoid weapons, avoid combat imagery. No text overlays. No watermarks. No distorted hands. No extra fingers.`

const version = process.env.HERO_VERSION || 'v1'
console.log(`Submitting A9 EVE-style industrial mining ship hero (${version}) to fal.ai...`)
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
const outPath = `/home/sal/Documents/obs/ChiefClanker/lessonhollow/blog-assets/start-learning-before-you-finish-planning/start-learning-before-you-finish-planning-hero-${version}.jpg`
writeFileSync(outPath, buf)
console.log('Saved:', outPath, buf.length, 'bytes')
