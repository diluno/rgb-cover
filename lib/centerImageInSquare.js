import sharp from 'sharp';

async function centerImageInSquare(
  inputPath,
  outputPath,
  size = 64,
  kernel = 'nearest'
) {
  try {
    // Get the metadata of the input image
    const metadata = await sharp(inputPath).metadata();

    // Calculate scaling dimensions while maintaining aspect ratio
    const scale = Math.min(size / metadata.width, size / metadata.height);
    const scaledWidth = Math.round(metadata.width * scale);
    const scaledHeight = Math.round(metadata.height * scale);

    // Calculate positioning for centering
    const left = Math.round((size - scaledWidth) / 2);
    const top = Math.round((size - scaledHeight) / 2);

    // Process the image with high quality settings
    await sharp(inputPath)
      // First resize the input image with high-quality settings
      .resize(scaledWidth, scaledHeight, {
        fit: 'fill',
        //kernel: 'lanczos3', // Use high-quality resampling
        kernel: 'nearest', // pixelated

        fastShrinkOnLoad: false, // Disable fast shrink for better quality
      })
      // Extend the canvas to our target size
      .extend({
        top: top,
        bottom: size - scaledHeight - top,
        left: left,
        right: size - scaledWidth - left,
        background: { r: 0, g: 0, b: 0 },
      })
      // Output with high quality settings
      .jpeg({
        quality: 100,
        chromaSubsampling: '4:4:4', // Prevent color artifacts
      })
      .toFile(outputPath);

    return true;
  } catch (error) {
    console.error('Error processing image:', error);
    return false;
  }
}

export { centerImageInSquare };
