(() => {
  const ns = (window.AnBot = window.AnBot || {});

  // Canvas-based approximation of
  // src/scraper/utils/utils.js#reduceSharpnessDesaturateAndBlurEdges.
  // The Jimp pipeline was: gaussian(1) overlay at 0.5 alpha → desaturate(4) →
  // gaussian(1) full-image, then paste an inner-cropped sharp center over the
  // blurred copy with a 2px edge ring. Canvas filters approximate the look
  // closely enough to evade duplicate-detection without harming the photo.
  const reduceSharpnessDesaturateAndBlurEdges = async (blob) => {
    const bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;
    const edge = 2;

    const sharp = new OffscreenCanvas(width, height);
    const sharpCtx = sharp.getContext('2d');
    sharpCtx.drawImage(bitmap, 0, 0);

    // Overlay slight blur to soften sharpness.
    sharpCtx.save();
    sharpCtx.filter = 'blur(1px)';
    sharpCtx.globalAlpha = 0.5;
    sharpCtx.globalCompositeOperation = 'overlay';
    sharpCtx.drawImage(bitmap, 0, 0);
    sharpCtx.restore();

    // Apply a small desaturation by redrawing through a saturate filter.
    const desat = new OffscreenCanvas(width, height);
    const desatCtx = desat.getContext('2d');
    desatCtx.filter = 'saturate(0.96)';
    desatCtx.drawImage(sharp, 0, 0);

    // Blurred copy used for the edge ring.
    const final = new OffscreenCanvas(width, height);
    const fctx = final.getContext('2d');
    fctx.filter = 'blur(1px)';
    fctx.drawImage(desat, 0, 0);

    // Paste the un-blurred center on top so only the ring stays blurred.
    fctx.filter = 'none';
    fctx.drawImage(
      desat,
      edge,
      edge,
      width - 2 * edge,
      height - 2 * edge,
      edge,
      edge,
      width - 2 * edge,
      height - 2 * edge,
    );

    return await final.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
  };

  ns.imageProcess = { reduceSharpnessDesaturateAndBlurEdges };
})();
