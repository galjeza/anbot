const Jimp = require('jimp');

async function reduceSharpnessDesaturateAndBlurEdges(imagePath) {
  // Read the image
  const image = await Jimp.read(imagePath);

  // Clone the original image and apply Gaussian blur with radius 1 for the whole image
  const blurredImage = image.clone().gaussian(1);

  // Blend the blurred image with the original using a low opacity
  image.composite(blurredImage, 0, 0, {
    mode: Jimp.BLEND_OVERLAY,
    opacitySource: 0.5, // Adjust the opacity to control the amount of sharpness reduction
    opacityDest: 0.5,
  });

  // Reduce saturation by desaturating the image
  image.color([
    { apply: 'desaturate', params: [7] }, // You might need to adjust this value
  ]);

  // Define the edge width for blurring
  const edgeWidth = 2;

  // Apply heavy Gaussian blur on the edges
  // Clone the less sharp and desaturated image, apply heavy blur, and then composite the center back
  const heavilyBlurredEdgesImage = image.clone().gaussian(1); // Adjust the radius for desired blur amount on edges
  const center = image
    .clone()
    .crop(
      edgeWidth,
      edgeWidth,
      image.bitmap.width - 2 * edgeWidth,
      image.bitmap.height - 2 * edgeWidth,
    );
  heavilyBlurredEdgesImage.composite(center, edgeWidth, edgeWidth);

  // Save the result
  await heavilyBlurredEdgesImage.writeAsync('./data/edge_blurred_image.jpg');
}

// Use the function with the path to your augmented image
async function test() {
  await reduceSharpnessDesaturateAndBlurEdges('./data/2.jpg');
}

test();
