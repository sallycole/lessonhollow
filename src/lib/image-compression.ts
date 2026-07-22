'use client'

import imageCompression from 'browser-image-compression'

/**
 * Compress an image file before upload.
 * Max 0.5 MB, max 1200px width/height, converted to WebP, uses web worker.
 */
export async function compressImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1200,
    fileType: 'image/webp' as const,
    useWebWorker: true,
  }

  const compressed = await imageCompression(file, options)

  // Ensure the returned file has a .webp name
  const name = file.name.replace(/\.[^.]+$/, '.webp')
  return new File([compressed], name, { type: 'image/webp' })
}
