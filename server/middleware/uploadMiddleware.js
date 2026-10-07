import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { mediaExtensions, matchesUploadContent } from '../services/uploadContent.js';

function validateUpload(upload) {
  return (req, res, next) => upload(req, res, async (error) => {
    const files = req.file ? [req.file] : req.files || [];
    try {
      if (error) throw error;
      for (const file of files) {
        const handle = await fs.promises.open(file.path, 'r');
        let bytes;
        try {
          const buffer = Buffer.alloc(64);
          const result = await handle.read(buffer, 0, buffer.length, 0);
          bytes = buffer.subarray(0, result.bytesRead);
        } finally { await handle.close(); }
        if (!matchesUploadContent(bytes, file.mimetype)) {
          throw Object.assign(new Error('The file contents do not match a supported media type.'), { statusCode: 400 });
        }
      }
      // Ownership/workflow checks run after parsing multipart bodies. Remove
      // unclaimed files on every rejected request, but keep persisted evidence
      // even if a later notification or audit operation fails.
      res.once('finish', () => {
        if (!req.uploadCommitted) void Promise.all(files.map((file) => fs.promises.unlink(file.path).catch(() => {})));
      });
      return next();
    } catch (failure) {
      await Promise.all(files.map((file) => fs.promises.unlink(file.path).catch(() => {})));
      return next(failure);
    }
  });
}

const serverDir = path.dirname(fileURLToPath(import.meta.url));
export const reportUploadDir = path.resolve(serverDir, '..', 'uploads', 'reports');
export const emergencyUploadDir = path.resolve(serverDir, '..', 'storage', 'emergencies');
export const profileUploadDir = path.resolve(serverDir, '..', 'storage', 'profiles');
export const communityUploadDir = path.resolve(serverDir, '..', 'storage', 'community');

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime'
]);

fs.mkdirSync(reportUploadDir, { recursive: true });
fs.mkdirSync(profileUploadDir, { recursive: true });
fs.mkdirSync(emergencyUploadDir, { recursive: true });
fs.mkdirSync(communityUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, reportUploadDir),
  filename: (req, file, callback) => {
    const extension = mediaExtensions[file.mimetype];
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

export const uploadReportMedia = validateUpload(multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 5
  }
}).array('media', 5));

const communityStorage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, communityUploadDir),
  filename: (req, file, callback) => callback(null, `${Date.now()}-${randomUUID()}${mediaExtensions[file.mimetype]}`)
});
export const uploadCommunityMedia = validateUpload(multer({ storage: communityStorage, fileFilter, limits: { fileSize: 25 * 1024 * 1024, files: 4 } }).array('media', 4));

const emergencyStorage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, emergencyUploadDir),
  filename: (req, file, callback) => callback(null, `${Date.now()}-${randomUUID()}${mediaExtensions[file.mimetype]}`)
});
const emergencyMimeTypes = new Set([...allowedMimeTypes, 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'application/pdf']);
export const uploadEmergencyEvidence = validateUpload(multer({
  storage: emergencyStorage,
  fileFilter: (req, file, callback) => emergencyMimeTypes.has(file.mimetype) ? callback(null, true) : callback(Object.assign(new Error('Only image, video, audio, and PDF evidence files are allowed.'), { statusCode: 400 })),
  limits: { fileSize: 25 * 1024 * 1024, files: 5 }
}).array('evidence', 5));

const profileMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const profileStorage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, profileUploadDir),
  filename: (req, file, callback) => callback(null, `${Date.now()}-${randomUUID()}${mediaExtensions[file.mimetype]}`)
});
export const uploadProfileImage = validateUpload(multer({
  storage: profileStorage,
  fileFilter: (req, file, callback) => profileMimeTypes.has(file.mimetype) ? callback(null, true) : callback(Object.assign(new Error('Only JPG, PNG, and WEBP profile images are allowed.'), { statusCode: 400 })),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }
}).single('photo'));
