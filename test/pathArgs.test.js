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

function makeImage(path, size = '64x48', cwd = undefined) {
  execFileSync('magick', ['-size', size, 'xc:red', path], { cwd });
}

async function inDir(dir, fn) {
  const previous = process.cwd();
  process.chdir(dir);
  try {
    return await fn();
  } finally {
    process.chdir(previous);
  }
}

async function identify(path) {
  const { imageInfo } = await processor.getImageInfo({ imagePath: path });
  return imageInfo;
}

before(() => {
  root = mkdtempSync(join(tmpdir(), 'image-tools-path-args-'));
});

after(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('paths starting with "-" are not read as magick options', { skip: !hasMagick }, () => {
  test('optimizeImage reads an input file named -help.png', async () => {
    const dir = freshDir('dash-input');
    makeImage('./-help.png', '64x48', dir);
    const output = join(dir, 'out.png');

    const result = await inDir(dir, () => processor.optimizeImage({
      inputPath: '-help.png',
      outputPath: output,
    }));

    assert.equal(result.success, true);
    assert.equal(result.inputPath, '-help.png');
    const info = await identify(output);
    assert.equal(info.format, 'PNG');
    assert.equal(info.dimensions, '64x48');
  });

  test('optimizeImage reads an input file named exactly like an option (-flip)', async () => {
    const dir = freshDir('dash-option-input');
    makeImage('PNG:./-flip', '64x48', dir);
    const output = join(dir, 'out.png');

    const result = await inDir(dir, () => processor.optimizeImage({
      inputPath: '-flip',
      outputPath: output,
    }));

    assert.equal(result.success, true);
    const info = await identify(output);
    assert.equal(info.format, 'PNG');
    assert.equal(info.dimensions, '64x48');
  });

  test('optimizeImage writes a relative outputPath named -out.png', async () => {
    const dir = freshDir('dash-output');
    const input = join(dir, 'in.png');
    makeImage(input);

    const result = await inDir(dir, () => processor.optimizeImage({
      inputPath: input,
      outputPath: '-out.png',
    }));

    assert.equal(result.success, true);
    assert.equal(result.outputPath, '-out.png');
    const written = join(dir, '-out.png');
    assert.ok(existsSync(written));
    const info = await identify(written);
    assert.equal(info.format, 'PNG');
    assert.equal(info.dimensions, '64x48');
  });

  test('batchOptimize processes -strip.jpg and skips a directory named sub.png', async () => {
    const dir = freshDir('dash-batch');
    const inputDir = freshDir('dash-batch/in');
    const outputDir = join(dir, 'out');
    makeImage('./-strip.jpg', '64x48', inputDir);
    mkdirSync(join(inputDir, 'sub.png'));

    const result = await processor.batchOptimize({ inputDir, outputDir });

    assert.equal(result.totalFiles, 1);
    assert.equal(result.processedFiles, 1);
    assert.equal(result.failedFiles, 0);
    assert.equal(result.results[0].file, '-strip.jpg');
    const info = await identify(join(outputDir, '-strip.jpg'));
    assert.equal(info.format, 'JPEG');
    assert.equal(existsSync(join(outputDir, 'sub.png')), false);
  });
});
