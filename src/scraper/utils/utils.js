import fs from 'fs';
import axios from 'axios';
import Jimp from 'jimp';
import path from 'path';

export async function saveList(list, filename) {
  await fs.writeFile(filename, JSON.stringify(list), (err) => {
    if (err) {
      console.log(err);
    }
  });
}

// Example function to get the ad images directory path
export function getAdImagesDirectory(carData, userDataPath) {
  const newHash = generateAdHash(carData); // Generate hash without price
  const oldHash = generateAdHashOld(carData); // Assume this function generates a hash with the price included, similar to your original function
  const brandNewHash = generateAdHashBrandNew(carData); // Assume this function generates a hash without the price, similar to your original function

  // Construct directory paths for both old and new hashes
  const newAdImagesDirectory = path.join(userDataPath, 'AdImages', newHash);
  const oldAdImagesDirectory = path.join(userDataPath, 'AdImages', oldHash);
  const brandNewAdImagesDirectory = path.join(
    userDataPath,
    'AdImages',
    brandNewHash,
  );

  // Check if the directory with the old hash exists
  if (fs.existsSync(oldAdImagesDirectory)) {
    console.log('Old hash directory exists:', oldAdImagesDirectory);
    return oldAdImagesDirectory;
  }
  if (fs.existsSync(newAdImagesDirectory)) {
    console.log('Brand new hash directory exists:', brandNewAdImagesDirectory);
    return newAdImagesDirectory;
  }
  console.log('New hash directory exists:', brandNewAdImagesDirectory);
  return brandNewAdImagesDirectory;
}

export function generateAdHashBrandNew(adProperties) {
  const relevantProperties = [
    'znamkavozila',
    'modelvozila',
    'prevozenikm',
    'letoReg',
  ];
  let stringToHash = '';

  adProperties.forEach((prop) => {
    if (relevantProperties.includes(prop.name)) {
      stringToHash += prop.name + prop.value;
    }
  });

  stringToHash = stringToHash.toLowerCase();
  stringToHash = stringToHash.replace(/\s/g, '_');
  stringToHash = stringToHash.replace(/[^a-zA-Z0-9_]/g, '');

  return stringToHash;
}

export function generateAdHashOld(adProperties) {
  const relevantProperties = [
    'znamkavozila',
    'modelvozila',
    'prevozenikm',
    'tipvozila',
    'letoReg',
    'cena',
  ];
  let stringToHash = '';

  adProperties.forEach((prop) => {
    if (relevantProperties.includes(prop.name)) {
      stringToHash += prop.name + prop.value;
    }
  });

  stringToHash = stringToHash.toLowerCase();
  stringToHash = stringToHash.replace(/\s/g, '_');
  stringToHash = stringToHash.replace(/[^a-zA-Z0-9_]/g, '');

  return stringToHash;
}

export function generateAdHash(adProperties) {
  // Define properties relevant for hash calculation, excluding 'cena'
  const relevantProperties = [
    'znamkavozila',
    'modelvozila',
    'prevozenikm',
    'tipvozila',
    'letoReg',
    // 'cena', // Excluded from the hash calculation
  ];
  let stringToHash = '';

  adProperties.forEach((prop) => {
    if (relevantProperties.includes(prop.name)) {
      stringToHash += prop.name + prop.value;
    }
  });

  stringToHash = stringToHash.toLowerCase();
  stringToHash = stringToHash.replace(/\s/g, '_');
  stringToHash = stringToHash.replace(/[^a-zA-Z0-9_]/g, '');

  return stringToHash;
}

export async function downloadImage(url, outputPath) {
  console.log('Image url, outputPath', url, outputPath);
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer',
      timeout: 60000, // 60 seconds timeout
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
        // Add Referrer if necessary
        // 'Referrer': 'https://your-referrer-site.com'
      },
    });
    fs.writeFileSync(outputPath, response.data);
  } catch (error) {
    console.error(
      'An error occurred while downloading the image:',
      error.message,
    );
  }
}

export async function wait(s) {
  return new Promise((resolve) => setTimeout(resolve, s * 1000));
}

export async function randomWait(min, max) {
  const randomTime = Math.random() * (max - min) + min;
  return wait(randomTime);
}

export async function reduceSharpnessDesaturateAndBlurEdges(imagePath) {
  const image = await Jimp.read(imagePath);

  const blurredImage = image.clone().gaussian(1);

  image.composite(blurredImage, 0, 0, {
    mode: Jimp.BLEND_OVERLAY,
    opacitySource: 0.5, // Adjust the opacity to control the amount of sharpness reduction
    opacityDest: 0.5,
  });

  image.color([
    { apply: 'desaturate', params: [4] }, // You might need to adjust this value
  ]);

  const edgeWidth = 2;

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

  await heavilyBlurredEdgesImage.writeAsync(imagePath);
}
