import fs from 'fs';
import axios from 'axios';
import Jimp from 'jimp';
import path from 'path';

export async function saveList(list, filename) {
  await fs.writeFile(filename, JSON.stringify(list), (err) => {
    if (err) {
      
    }
  });
}

export function getAdImagesDirectory(carData, userDataPath) {
  const relevantFields = [
    'znamkavozila',
    'modelvozila',
    'prevozenikm',
    'tipvozila',
    'letoReg',
    'cena',
  ];
  
  relevantFields.forEach((field) => {
    const fieldData = carData.find((data) => data.name === field);
    
  });

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

  // First check if any legacy directories exist
  if (fs.existsSync(legacyV3AdImagesDirectory)) {
    
    return legacyV3AdImagesDirectory;
  }
  if (fs.existsSync(legacyV2AdImagesDirectory)) {
    
    return legacyV2AdImagesDirectory;
  }
  if (fs.existsSync(legacyV1AdImagesDirectory)) {
    
    return legacyV1AdImagesDirectory;
  }

  // Only if no legacy directories exist, check for or create simple hash directory
  if (fs.existsSync(simpleAdImagesDirectory)) {
    
    return simpleAdImagesDirectory;
  }

  // If no directories exist at all, use legacy V3 format for consistency
  return legacyV3AdImagesDirectory;
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
