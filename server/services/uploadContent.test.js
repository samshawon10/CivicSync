import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesUploadContent, mediaExtensions } from './uploadContent.js';

test('active content cannot pass by claiming an allowed MIME type', () => {
  for (const mime of Object.keys(mediaExtensions)) {
    assert.equal(matchesUploadContent(Buffer.from('<html><script>alert(1)</script>'), mime), false, mime);
    assert.equal(matchesUploadContent(Buffer.alloc(0), mime), false, mime);
  }
});
test('supported media signatures are recognized and mismatches rejected', () => {
  const samples = [
    ['image/jpeg', Buffer.from([255, 216, 255, 224])],
    ['image/png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
    ['image/webp', Buffer.from('RIFF0000WEBP')],
    ['audio/wav', Buffer.from('RIFF0000WAVE')],
    ['video/mp4', Buffer.from('0000ftypisom')],
    ['audio/mp4', Buffer.from('0000ftypM4A ')],
    ['video/quicktime', Buffer.from('0000ftypqt  ')],
    ['video/webm', Buffer.from([26, 69, 223, 163])],
    ['audio/webm', Buffer.from([26, 69, 223, 163])],
    ['audio/mpeg', Buffer.from('ID3')],
    ['application/pdf', Buffer.from('%PDF-1.7')]
  ];
  for (const [mime, bytes] of samples) assert.equal(matchesUploadContent(bytes, mime), true, mime);
  assert.equal(matchesUploadContent(samples[0][1], 'image/png'), false);
});
