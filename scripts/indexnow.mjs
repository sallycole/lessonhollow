#!/usr/bin/env node
// Submits changed public URLs to IndexNow (https://www.indexnow.org) after a deploy.
//
// Usage:
//   node scripts/indexnow.mjs --diff <before-sha> <after-sha>   submit URLs for files changed in that range
//   node scripts/indexnow.mjs --all                             submit every URL in the live sitemap
//   add --dry-run to print the payload without sending it
//
// The key is public by design and is served from public/<key>.txt.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const HOST = 'lessonhollow.com'
const SITE_URL = `https://${HOST}`
const KEY = 'b01f84025d478affd4c11f236baeb2af'
const KEY_LOCATION = `${SITE_URL}/${KEY}.txt`
const ENDPOINT = 'https://api.indexnow.org/indexnow'
const MAX_URLS = 10000

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

async function sitemapUrls() {
  const res = await fetch(`${SITE_URL}/sitemap.xml`)
  if (!res.ok) throw new Error(`sitemap.xml returned ${res.status}`)
  const xml = await res.text()
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())
}

function changedFiles(before, after) {
  const out = execFileSync('git', ['diff', '--name-only', `${before}..${after}`], { encoding: 'utf-8' })
  return out.split('\n').map((l) => l.trim()).filter(Boolean)
}

// Map a changed repo file to the public paths it affects.
export function pathsForFile(file) {
  let m
  if ((m = file.match(/^content\/blog\/([^/]+)\.md$/))) return [`/blog/${m[1]}`, '/blog']
  if ((m = file.match(/^content\/press\/releases\/([^/]+)\.md$/))) return [`/press/releases/${m[1]}`, '/press']
  if (file.startsWith('content/press/')) return ['/press']
  if (file.match(/^src\/content\/curricula\/[^/]+\.tsx$/) && !file.endsWith('index.ts')) {
    const paths = ['/discover']
    if (fs.existsSync(file)) {
      const s = fs.readFileSync(file, 'utf-8').match(/slug:\s*['"]([^'"]+)['"]/)
      if (s) paths.push(`/discover/${s[1]}`)
    }
    return paths
  }
  if (file === 'src/content/homepage.ts' || file === 'src/app/page.tsx') return ['/']
  if ((m = file.match(/^src\/app\/\(public\)\/(.+)\/page\.tsx$/))) {
    const route = m[1].split('/').filter((seg) => !seg.startsWith('(')).join('/')
    if (!route.includes('[')) return [`/${route}`]
  }
  return []
}

async function main() {
  const live = await sitemapUrls()
  let urls
  if (args.includes('--all')) {
    urls = live
  } else {
    const i = args.indexOf('--diff')
    const before = args[i + 1]
    const after = args[i + 2]
    if (i === -1 || !before || !after) {
      console.error('Usage: --diff <before> <after> | --all')
      process.exit(2)
    }
    if (/^0+$/.test(before)) {
      console.log('No previous commit to diff against; skipping IndexNow.')
      return
    }
    const files = changedFiles(before, after)
    const wanted = new Set(files.flatMap(pathsForFile).map((p) => `${SITE_URL}${p === '/' ? '' : p}`))
    const liveSet = new Set(live.map((u) => u.replace(/\/$/, '')))
    urls = [...wanted].filter((u) => liveSet.has(u.replace(/\/$/, '')))
    console.log(`Changed files: ${files.length}; public URLs to submit: ${urls.length}`)
  }
  urls = [...new Set(urls)].slice(0, MAX_URLS)
  if (urls.length === 0) {
    console.log('Nothing to submit to IndexNow.')
    return
  }
  const payload = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: urls }
  urls.forEach((u) => console.log(`  ${u}`))
  if (dryRun) {
    console.log('Dry run; not sending.')
    return
  }
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  })
  console.log(`IndexNow responded ${res.status}`)
  if (res.status !== 200 && res.status !== 202) {
    console.error(await res.text())
    process.exit(1)
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
if (isMain) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
