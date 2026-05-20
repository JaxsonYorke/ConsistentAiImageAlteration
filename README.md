# ConsistentAiImageAlteration

A small Node.js watcher that monitors an input folder for new image files. When a new image appears, it sends the image to Gemini with a static prompt, then writes the altered image into an output folder.

## Setup

1. Install dependencies (none required beyond Node.js 18+).
2. Set your Gemini API key:

```bash
export GEMINI_API_KEY="your_api_key"
```

Optional environment variables:

- `INPUT_DIR` (default: `./input`)
- `OUTPUT_DIR` (default: `./output`)
- `GEMINI_MODEL` (default: `gemini-2.0-flash-preview-image-generation`)
- `GEMINI_PROMPT` (default static prompt in `index.js`)

## Run

```bash
npm start
```

Drop a `.png`, `.jpg`, `.jpeg`, or `.webp` file into the input directory. The altered image will be saved in the output directory with `-altered` added to the filename.
