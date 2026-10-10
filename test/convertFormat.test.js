import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ImageProcessor } from '../src/imageProcessor.js';

function magickAvailable() {
  try {
    execFileSync('magick', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const processor = new ImageProcessor();
let root;
let input;

async function writtenFormat(path) {
  const { imageInfo } = await processor.getImageInfo({ imagePath: path });
  return imageInfo.format;
}

describe('convertFormat', { skip: !magickAvailable() && 'ImageMagick not installed' }, () => {
  before(() => {
    root = mkdtempSync(join(tmpdir(), 'convert-format-'));
    process.env.IMAGE_TOOLS_ALLOWED_DIRS = root;
    input = join(root, 'in.png');
    execFileSync('magick', ['-size', '32x32', 'xc:red', input]);
  });

  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test('rejects an outputPath extension that does not match format', async () => {
    const outputPath = join(root, 'mismatch.png');
    await assert.rejects(
      processor.convertFormat({ inputPath: input, outputPath, format: 'webp' }),
      { message: 'outputPath extension .png does not match format webp' },
    );
    assert.equal(existsSync(outputPath), false);
  });

  test('appends the format extension when outputPath has none', async () => {
    const result = await processor.convertFormat({
      inputPath: input,
      outputPath: join(root, 'out'),
      format: 'webp',
    });
    const expected = join(root, 'out.webp');
    assert.equal(result.outputPath, expected);
    assert.equal(existsSync(expected), true);
    assert.equal(await writtenFormat(expected), 'WEBP');
    assert.equal(result.format, 'webp');
    assert.equal(result.quality, 90);
  });

  test('confinement and overwrite checks run on the path with the appended extension', async () => {
    const existing = join(root, 'taken.webp');
    execFileSync('magick', ['-size', '8x8', 'xc:blue', existing]);
    await assert.rejects(
      processor.convertFormat({
        inputPath: input, outputPath: join(root, 'taken'), format: 'webp',
      }),
      /taken\.webp already exists/,
    );

    const outside = mkdtempSync(join(tmpdir(), 'convert-format-outside-'));
    try {
      await assert.rejects(
        processor.convertFormat({
          inputPath: input, outputPath: join(outside, 'o'), format: 'png',
        }),
        /outside the allowed directories/,
      );
      assert.equal(existsSync(join(outside, 'o.png')), false);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test('extensionless output gets the coder for the requested format', async () => {
    const result = await processor.convertFormat({
      inputPath: input, outputPath: join(root, 'coded'), format: 'jpeg',
    });
    const expected = `JPEG:${join(realpathSync(root), 'coded.jpeg')}`;
    assert.equal(result.command.split(' ').at(-1), expected);
    assert.equal(result.format, 'jpeg');
  });

  test('treats jpeg and jpg as the same format', async () => {
    const outputPath = join(root, 'photo.jpg');
    const result = await processor.convertFormat({ inputPath: input, outputPath, format: 'jpeg' });
    assert.equal(result.outputPath, outputPath);
    assert.equal(await writtenFormat(outputPath), 'JPEG');
  });

  test('treats tif and tiff as the same format', async () => {
    const outputPath = join(root, 'scan.tif');
    await processor.convertFormat({ inputPath: input, outputPath, format: 'tiff' });
    assert.equal(await writtenFormat(outputPath), 'TIFF');
  });

  test('accepts an uppercase format', async () => {
    const outputPath = join(root, 'upper.png');
    const result = await processor.convertFormat({ inputPath: input, outputPath, format: 'PNG' });
    assert.equal(await writtenFormat(outputPath), 'PNG');
    assert.equal(result.quality, 'N/A');
  });

  test('converts to ico', async () => {
    const outputPath = join(root, 'icon.ico');
    const result = await processor.convertFormat({ inputPath: input, outputPath, format: 'ico' });
    assert.equal(result.format, 'ico');
  });

  for (const format of [undefined, null, 42, '']) {
    test(`rejects format=${JSON.stringify(format)} with a clear error`, async () => {
      await assert.rejects(
        processor.convertFormat({ inputPath: input, outputPath: join(root, 'x.png'), format }),
        (error) => {
          assert.equal(error instanceof TypeError, false);
          assert.match(error.message, /format is required/);
          return true;
        },
      );
    });
  }

  test('rejects an unsupported format', async () => {
    const outputPath = join(root, 'x.avif');
    await assert.rejects(
      processor.convertFormat({ inputPath: input, outputPath, format: 'avif' }),
      /Unsupported format: avif/,
    );
  });

  test('reports the format actually written', async () => {
    for (const [format, file] of [['webp', 'r.webp'], ['jpg', 'r.jpeg'], ['gif', 'r.gif']]) {
      const outputPath = join(root, file);
      const result = await processor.convertFormat({ inputPath: input, outputPath, format });
      assert.equal(result.format, (await writtenFormat(outputPath)).toLowerCase());
    }
  });
});
