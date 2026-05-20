const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const INPUT_DIR = path.resolve(process.env.INPUT_DIR || './input');
const OUTPUT_DIR = path.resolve(process.env.OUTPUT_DIR || './output');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const GEMINI_PROMPT = process.env.GEMINI_PROMPT || 'Please make this image look like it is in a Paper Mario Style';

const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

const processing = new Set();

function isSupportedImage(filename) {
  return SUPPORTED_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

async function ensureDirectories() {
  await Promise.all([
    fsp.mkdir(INPUT_DIR, { recursive: true }),
    fsp.mkdir(OUTPUT_DIR, { recursive: true })
  ]);
}

async function waitForStableFile(filePath, checks = 5, delayMs = 400) {
  let previousSize = -1;

  for (let i = 0; i < checks; i++) {
    let stats;
    try {
      stats = await fsp.stat(filePath);
      if (!stats.isFile()) {
        return false;
      }
    } catch {
      return false;
    }

    if (stats.size > 0 && stats.size === previousSize) {
      return true;
    }

    previousSize = stats.size;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return false;
}

async function callGeminiToAlterImage(fileBuffer, mimeType) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: GEMINI_PROMPT },
            {
              inlineData: {
                mimeType,
                data: fileBuffer.toString('base64')
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE']
      }
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `Gemini request failed with status ${response.status}`;
    throw new Error(message);
  }

  const imagePart = payload?.candidates
    ?.flatMap((candidate) => candidate?.content?.parts || [])
    ?.find((part) => part?.inlineData?.mimeType?.startsWith('image/'));

  if (!imagePart?.inlineData?.data) {
    throw new Error('Gemini did not return an altered image.');
  }

  return {
    mimeType: imagePart.inlineData.mimeType,
    data: Buffer.from(imagePart.inlineData.data, 'base64')
  };
}

function extensionFromMimeType(mimeType, fallbackExt) {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/jpeg') return '.jpg';
  return fallbackExt;
}

async function processImage(filePath) {
  const fileName = path.basename(filePath);
  if (!isSupportedImage(fileName)) {
    return;
  }

  if (processing.has(filePath)) {
    return;
  }

  processing.add(filePath);
  try {
    const stable = await waitForStableFile(filePath);
    if (!stable) {
      return;
    }

    const extension = path.extname(fileName).toLowerCase();
    const inputMimeType = MIME_TYPES[extension] || 'application/octet-stream';
    const inputBuffer = await fsp.readFile(filePath);

    const alteredImage = await callGeminiToAlterImage(inputBuffer, inputMimeType);

    const outputExt = extensionFromMimeType(alteredImage.mimeType, extension);
    const outputName = `${path.basename(fileName, extension)}-altered${outputExt}`;
    const outputPath = path.join(OUTPUT_DIR, outputName);

    await fsp.writeFile(outputPath, alteredImage.data);
    console.log(`Processed ${fileName} -> ${outputName}`);
  } catch (error) {
    console.error(`Failed to process ${fileName}:`, error.message);
  } finally {
    processing.delete(filePath);
  }
}

async function start() {
  if (!GEMINI_API_KEY) {
    console.error('Missing GEMINI_API_KEY environment variable.');
    process.exit(1);
  }

  await ensureDirectories();

  console.log(`Watching ${INPUT_DIR} for new images...`);
  console.log(`Altered images will be written to ${OUTPUT_DIR}`);

  // Process any existing unprocessed images on startup
  try {
    console.log('Checking for unprocessed images...');
    const inputFiles = await fsp.readdir(INPUT_DIR);
    const outputFiles = await fsp.readdir(OUTPUT_DIR);
    
    const outputSet = new Set(outputFiles);
    
    for (const file of inputFiles) {
      if (!isSupportedImage(file)) {
        continue;
      }
      
      const extension = path.extname(file).toLowerCase();
      const baseName = path.basename(file, extension);
      
      // Check if the altered version exists in output
      const hasAltered = Array.from(outputSet).some(outFile => {
        return outFile.startsWith(baseName + '-altered');
      });
      
      if (!hasAltered) {
        const inputPath = path.join(INPUT_DIR, file);
        console.log(`Found unprocessed image: ${file}`);
        processImage(inputPath);
      }
    }
  } catch (error) {
    console.error('Error checking for unprocessed images:', error.message);
  }

  fs.watch(INPUT_DIR, (eventType, filename) => {
    if (eventType !== 'rename' || !filename) {
      return;
    }

    const fullPath = path.join(INPUT_DIR, filename);
    processImage(fullPath);
  });
}

start().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
