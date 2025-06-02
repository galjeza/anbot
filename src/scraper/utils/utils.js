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
  const simpleHash = generateAdHashSimple(carData);
  const legacyV3Hash = generateAdHashLegacyV3(carData);
  const legacyV2Hash = generateAdHashLegacyV2(carData);
  const legacyV1Hash = generateAdHashLegacyV1(carData);

  // Construct directory paths for all hash versions
  const simpleAdImagesDirectory = path.join(
    userDataPath,
    'AdImages',
    simpleHash,
  );
  const legacyV3AdImagesDirectory = path.join(
    userDataPath,
    'AdImages',
    legacyV3Hash,
  );
  const legacyV2AdImagesDirectory = path.join(
    userDataPath,
    'AdImages',
    legacyV2Hash,
  );
  const legacyV1AdImagesDirectory = path.join(
    userDataPath,
    'AdImages',
    legacyV1Hash,
  );

  // Check directories in order of preference
  if (fs.existsSync(simpleAdImagesDirectory)) {
    console.log('Simple hash directory exists:', simpleAdImagesDirectory);
    return simpleAdImagesDirectory;
  }
  if (fs.existsSync(legacyV3AdImagesDirectory)) {
    console.log('Legacy V3 hash directory exists:', legacyV3AdImagesDirectory);
    return legacyV3AdImagesDirectory;
  }
  if (fs.existsSync(legacyV2AdImagesDirectory)) {
    console.log('Legacy V2 hash directory exists:', legacyV2AdImagesDirectory);
    return legacyV2AdImagesDirectory;
  }
  if (fs.existsSync(legacyV1AdImagesDirectory)) {
    console.log('Legacy V1 hash directory exists:', legacyV1AdImagesDirectory);
    return legacyV1AdImagesDirectory;
  }

  // If no existing directory is found, use the new simple hash
  return simpleAdImagesDirectory;
}

export function generateAdHashSimple(adProperties) {
  const relevantProperties = ['znamkavozila', 'modelvozila', 'letoReg'];
  let stringToHash = '';

  adProperties.forEach((prop) => {
    if (relevantProperties.includes(prop.name)) {
      stringToHash += prop.value;
    }
  });

  stringToHash = stringToHash.toLowerCase();
  stringToHash = stringToHash.replace(/\s/g, '_');
  stringToHash = stringToHash.replace(/[^a-zA-Z0-9_]/g, '');

  return stringToHash;
}

export function generateAdHashLegacyV3(adProperties) {
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

export function generateAdHashLegacyV2(adProperties) {
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

export function generateAdHashLegacyV1(adProperties) {
  const relevantProperties = [
    'znamkavozila',
    'modelvozila',
    'prevozenikm',
    'tipvozila',
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
