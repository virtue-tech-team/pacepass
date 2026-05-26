import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import { createUploadUrl } from '../utils/s3.js'

const uploadSchema = z.object({
  filename: z.string().trim().min(3),
  contentType: z.string().trim().min(3),
  folder: z.string().trim().min(2).default('events/covers'),
})

function slugifyFilename(filename: string) {
  const extension = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : ''
  const name = filename.replace(extension, '')

  return `${name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()}${extension.toLowerCase()}`
}

export async function createPresignedUpload(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = uploadSchema.parse(req.body)
    const sanitizedName = slugifyFilename(payload.filename)
    const key = `${payload.folder.replace(/\/$/, '')}/${Date.now()}-${sanitizedName}`

    const { uploadUrl, publicUrl } = await createUploadUrl(key, payload.contentType)

    res.status(201).json({
      uploadUrl,
      publicUrl,
      key,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'AWS_S3_NOT_CONFIGURED') {
      res.status(503).json({
        message: 'Upload AWS ainda não configurado. Defina as variáveis AWS_S3_REGION, AWS_S3_BUCKET_NAME, AWS_S3_ACCESS_KEY_ID e AWS_S3_SECRET_ACCESS_KEY.',
      })
      return
    }

    next(error)
  }
}