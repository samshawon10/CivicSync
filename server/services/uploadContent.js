export const mediaExtensions = Object.freeze({
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
  'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/wav': '.wav',
  'audio/webm': '.webm', 'application/pdf': '.pdf'
});

export function matchesUploadContent(bytes, mime) {
  const ascii = (start, end) => bytes.subarray(start, end).toString('ascii');
  if (mime === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === 'image/webp') return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
  if (mime === 'audio/wav') return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE';
  if (mime === 'video/webm' || mime === 'audio/webm') return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (['video/mp4', 'audio/mp4', 'video/quicktime'].includes(mime)) return ascii(4, 8) === 'ftyp' || (mime === 'video/quicktime' && ['moov', 'mdat', 'wide'].includes(ascii(4, 8)));
  if (mime === 'audio/mpeg') return ascii(0, 3) === 'ID3' || (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  if (mime === 'application/pdf') return ascii(0, 5) === '%PDF-';
  return false;
}
