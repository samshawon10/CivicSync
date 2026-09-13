import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
export const reportUploadDir = path.resolve(serverDir, '..', 'uploads', 'reports');

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime'
]);

fs.mkdirSync(reportUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, reportUploadDir),
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    callback(null, `${Date.now()}-${randomUUID()}${extension}`);
  }
});

function fileFilter(req, file, callback) {
  if (!allowedMimeTypes.has(file.mimetype)) {
    const error = new Error('Only JPG, PNG, WebP, MP4, WebM, and MOV files are allowed.');
    error.statusCode = 400;
    return callback(error);
  }
  return callback(null, true);
}

export const uploadReportMedia = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 5
  }
}).array('media', 5);
