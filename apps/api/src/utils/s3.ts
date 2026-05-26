import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { env } from '../config/env.js'

function createPublicUrl(key: string) {
  if (env.awsPublicBaseUrl) {
    return `${env.awsPublicBaseUrl.replace(/\/$/, '')}/${key}`
  }

  return `https://${env.awsBucketName}.s3.${env.awsRegion}.amazonaws.com/${key}`
}

function createS3Client() {
  if (!env.awsRegion || !env.awsBucketName || !env.awsAccessKeyId || !env.awsSecretAccessKey) {
    return null
  }

  return new S3Client({
    region: env.awsRegion,
    credentials: {
      accessKeyId: env.awsAccessKeyId,
      secretAccessKey: env.awsSecretAccessKey,
    },
  })
}

export async function createUploadUrl(key: string, contentType: string) {
  const client = createS3Client()

  if (!client) {
    throw new Error('AWS_S3_NOT_CONFIGURED')
  }

  const command = new PutObjectCommand({
    Bucket: env.awsBucketName,
    Key: key,
    ContentType: contentType,
  })

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: 300,
  })

  return {
    uploadUrl,
    publicUrl: createPublicUrl(key),
  }
}