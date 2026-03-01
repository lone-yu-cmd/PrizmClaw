import screenshot from 'screenshot-desktop';

export async function captureScreenshot() {
  const image = await screenshot({ format: 'png' });
  const buffer = Buffer.isBuffer(image) ? image : Buffer.from(image);

  return {
    buffer,
    mimeType: 'image/png',
    imageBase64: buffer.toString('base64')
  };
}
