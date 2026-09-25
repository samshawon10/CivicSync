import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';

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

const communityStorage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, communityUploadDir),
  filename: (req, file, callback) => callback(null, `${Date.now()}-${randomUUID()}${path.extname(file.originalname || '').toLowerCase()}`)
});
export const uploadCommunityMedia = multer({ storage: communityStorage, fileFilter, limits: { fileSize: 25 * 1024 * 1024, files: 4 } }).array('media', 4);

const emergencyStorage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, emergencyUploadDir),
  filename: (req, file, callback) => callback(null, `${Date.now()}-${randomUUID()}${path.extname(file.originalname || '').toLowerCase()}`)
});
const emergencyMimeTypes = new Set([...allowedMimeTypes, 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'application/pdf']);
export const uploadEmergencyEvidence = multer({
  storage: emergencyStorage,
  fileFilter: (req, file, callback) => emergencyMimeTypes.has(file.mimetype) ? callback(null, true) : callback(Object.assign(new Error('Only image, video, audio, and PDF evidence files are allowed.'), { statusCode: 400 })),
  limits: { fileSize: 25 * 1024 * 1024, files: 5 }
}).array('evidence', 5);

const profileMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const profileStorage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, profileUploadDir),
  filename: (req, file, callback) => callback(null, `${Date.now()}-${randomUUID()}${path.extname(file.originalname || '').toLowerCase()}`)
});
export const uploadProfileImage = multer({
  storage: profileStorage,
  fileFilter: (req, file, callback) => profileMimeTypes.has(file.mimetype) ? callback(null, true) : callback(Object.assign(new Error('Only JPG, PNG, and WEBP profile images are allowed.'), { statusCode: 400 })),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }
}).single('photo');
