import multer from 'multer';

export function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(error);
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ success: false, message: req.originalUrl.startsWith('/api/users/me/photo') ? 'Profile images must be 5 MB or smaller.' : 'Each media file must be 25 MB or smaller.' });
    if (error.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ success: false, message: req.originalUrl.startsWith('/api/users/me/photo') ? 'Upload one profile image at a time.' : 'You can upload up to 5 media files per report.' });
    return res.status(400).json({ success: false, message: 'Could not upload the selected media files.' });
  }
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
  if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: Object.values(error.errors)[0].message });
  if (error.code === 11000) return res.status(409).json({ success: false, message: 'A record with that value already exists.' });
  return res.status(500).json({ success: false, message: 'An unexpected server error occurred.' });
}
