import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
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

const hasMagick = magickAvailable();
const processor = new ImageProcessor();
let root;

function freshDir(name) {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeImage(path, size = '64x48') {
  execFileSync('magick', ['-size', size, 'xc:red', path]);
}

async function settle(promise) {
  await promise.catch(() => undefined);
}

async function inDir(dir, fn) {
  const previous = process.cwd();
  process.chdir(dir);
  try {
    await fn();
  } finally {
    process.chdir(previous);
  }
}

before(() => {
  root = mkdtempSync(join(tmpdir(), 'image-tools-test-'));
});

after(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('ImageProcessor happy paths', { skip: !hasMagick }, () => {
  test('optimizeImage resizes and reports the argv command', async () => {
    const dir = freshDir('optimize');
    const input = join(dir, 'in.png');
    const output = join(dir, 'out.png');
    makeImage(input);

    const result = await processor.optimizeImage({
      inputPath: input,
      outputPath: output,
      maxWidth: 32,
    });

    assert.equal(result.success, true);
    assert.ok(existsSync(output));
    assert.equal(
      result.command,
      `magick ${input} -resize 32x> -quality 85 -strip -interlace Plane ${output}`,
    );
    const { imageInfo } = await processor.getImageInfo({ imagePath: output });
    assert.equal(imageInfo.width, 32);
    assert.equal(imageInfo.height, 24);
  });

  test('createThumbnail crops to exact dimensions', async () => {
    const dir = freshDir('thumbnail');
    const input = join(dir, 'in.png');
    const output = join(dir, 'thumb.png');
    makeImage(input);

    const result = await processor.createThumbnail({
      inputPath: input,
      outputPath: output,
      width: 16,
      height: 16,
      cropToFit: true,
    });

    assert.equal(result.success, true);
    assert.equal(result.dimensions, '16x16');
    const { imageInfo } = await processor.getImageInfo({ imagePath: output });
    assert.equal(imageInfo.dimensions, '16x16');
  });

  test('createIcon writes one file per size', async () => {
    const dir = freshDir('icon');
    const input = join(dir, 'logo.png');
    const outputDir = join(dir, 'icons');
    makeImage(input, '64x64');

    const result = await processor.createIcon({
      inputPath: input,
      outputDir,
      sizes: [16, 32],
    });

    assert.equal(result.success, true);
    assert.equal(result.icons.length, 2);
    for (const icon of result.icons) {
      assert.equal(icon.error, undefined);
      assert.ok(existsSync(icon.path));
    }
    const { imageInfo } = await processor.getImageInfo({ imagePath: result.icons[1].path });
    assert.equal(imageInfo.dimensions, '32x32');
  });

  test('convertFormat converts PNG to JPEG', async () => {
    const dir = freshDir('convert');
    const input = join(dir, 'in.png');
    const output = join(dir, 'out.jpg');
    makeImage(input);

    const result = await processor.convertFormat({
      inputPath: input,
      outputPath: output,
      format: 'jpg',
    });

    assert.equal(result.success, true);
    assert.equal(result.quality, 90);
    assert.equal(result.command, `magick ${input} -quality 90 ${output}`);
    const { imageInfo } = await processor.getImageInfo({ imagePath: output });
    assert.equal(imageInfo.format, 'JPEG');
  });

  test('getImageInfo reports format and dimensions', async () => {
    const dir = freshDir('info');
    const input = join(dir, 'in.png');
    makeImage(input);

    const result = await processor.getImageInfo({ imagePath: input });

    assert.equal(result.success, true);
    assert.equal(result.imageInfo.format, 'PNG');
    assert.equal(result.imageInfo.width, 64);
    assert.equal(result.imageInfo.height, 48);
    assert.ok(result.rawOutput.length > 0);
  });

  test('batchOptimize processes PNG and JPEG files', async () => {
    const dir = freshDir('batch');
    const inputDir = freshDir('batch/in');
    const outputDir = join(dir, 'out');
    makeImage(join(inputDir, 'a.png'));
    makeImage(join(inputDir, 'b.jpg'));

    const result = await processor.batchOptimize({ inputDir, outputDir });

    assert.equal(result.success, true);
    assert.equal(result.totalFiles, 2);
    assert.equal(result.processedFiles, 2);
    assert.equal(result.failedFiles, 0);
    assert.ok(existsSync(join(outputDir, 'a.png')));
    assert.ok(existsSync(join(outputDir, 'b.jpg')));
  });
});

describe('ImageProcessor does not pass arguments through a shell', { skip: !hasMagick }, () => {
  test('quality with shell metacharacters runs no command', async () => {
    const dir = freshDir('inject-quality');
    const input = join(dir, 'in.png');
    const sentinel = join(dir, 'pwned');
    makeImage(input);

    await settle(processor.optimizeImage({
      inputPath: input,
      outputPath: join(dir, 'out.png'),
      quality: `85; touch ${sentinel}`,
    }));

    assert.equal(existsSync(sentinel), false);
  });

  test('outputPath with embedded quotes runs no command', async () => {
    const dir = freshDir('inject-output');
    const input = join(dir, 'in.png');
    const sentinel = join(dir, 'pwned');
    makeImage(input);

    await settle(processor.optimizeImage({
      inputPath: input,
      outputPath: join(dir, `out"; touch ${sentinel}; ".png`),
    }));

    assert.equal(existsSync(sentinel), false);
  });

  test('optimizeImage on a file named with $() runs no command', async () => {
    const dir = freshDir('inject-input');
    const input = join(dir, '$(touch pwned).png');
    makeImage(input);

    await inDir(dir, () => settle(processor.optimizeImage({
      inputPath: input,
      outputPath: join(dir, 'out.png'),
    })));

    assert.equal(existsSync(join(dir, 'pwned')), false);
  });

  test('batchOptimize on a file named with $() runs no command', async () => {
    const dir = freshDir('inject-batch');
    const inputDir = freshDir('inject-batch/in');
    makeImage(join(inputDir, '$(touch pwned).png'));

    await inDir(dir, () => settle(processor.batchOptimize({
      inputDir,
      outputDir: join(dir, 'out'),
    })));

    assert.equal(existsSync(join(dir, 'pwned')), false);
  });
});
