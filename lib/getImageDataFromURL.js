import sharp from 'sharp';

export async function getImageDataFromURL(imagePath) {
  try {
    const image = sharp(imagePath);
    
    const metadata = await image.metadata();
    
    const { data, info } = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const imageData = {
      data: new Uint8ClampedArray(data),
      width: metadata.width,
      height: metadata.height
    };

    return {
      imageData,
      width: metadata.width
    };
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
}