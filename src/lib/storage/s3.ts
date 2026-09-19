import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const s3Client = new S3Client({
  region: process.env.S3_REGION ?? "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  },
});

export const IMPORTS_BUCKET = process.env.S3_BUCKET_IMPORTS ?? "trademind-imports";

export async function uploadImportFile(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: IMPORTS_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function downloadImportFile(key: string): Promise<Buffer> {
  const result = await s3Client.send(new GetObjectCommand({ Bucket: IMPORTS_BUCKET, Key: key }));
  const byteArray = await result.Body?.transformToByteArray();
  if (!byteArray) throw new Error(`Empty object body for key: ${key}`);
  return Buffer.from(byteArray);
}

/** Signed URL for a user to re-download their own original uploaded file. */
export async function getSignedImportFileUrl(key: string): Promise<string> {
  return getSignedUrl(s3Client, new GetObjectCommand({ Bucket: IMPORTS_BUCKET, Key: key }), {
    expiresIn: 300,
  });
}

/**
 * Signed URL for the browser to PUT a tradebook file directly to storage,
 * bypassing our Next.js server body entirely. A real ~11,000-row Angel One
 * file sent through a server action's multipart body arrived at the server
 * as a completely empty FormData in production — most likely a proxy-level
 * body size limit ahead of the app silently truncating it — even though the
 * app's own bodySizeLimit config allowed it. Direct-to-storage upload
 * sidesteps that whole class of problem, which is also just the standard
 * pattern for file uploads through an app-router server.
 */
export async function getSignedImportUploadUrl(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    s3Client,
    new PutObjectCommand({ Bucket: IMPORTS_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 300 }
  );
}
