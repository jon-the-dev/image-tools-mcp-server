import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
const UNSAFE_INPUT = /unsupported or unsafe image type/i;
const UNSAFE_OUTPUT = /unsupported or unsafe output type/i;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const MVG = [
  'push graphic-context',
  'viewbox 0 0 64 64',
  'image over 0,0 0,0 \'text:/etc/passwd\'',
  'pop graphic-context',
].join('\n');

const SVG = [
  '<?xml version="1.0" standalone="no"?>',
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"',
  '  width="64" height="64">',
  '  <image xlink:href="text:/etc/passwd" x="0" y="0" width="64" height="64"/>',
  '</svg>',
].join('\n');

const PS = '%!PS\n/Courier findfont 12 scalefont setfont\n72 72 moveto (x) show\nshowpage\n';

let root;

function freshDir(name) {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeImage(path, coder = '') {
  const target = coder ? `${coder}:${path}` : path;
  execFileSync('magick', ['-size', '64x48', 'xc:red', target]);
}

function startsWithPng(path) {
  return readFileSync(path).subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC);
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
  root = mkdtempSync(join(tmpdir(), 'image-tools-coder-'));
  process.env.IMAGE_TOOLS_ALLOWED_DIRS = root;
});

after(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('input coder allowlist rejects non-raster content', { skip: !hasMagick }, () => {
  test('MVG disguised as .png is rejected by optimizeImage and getImageInfo', async () => {
    const dir = freshDir('mvg');
    const input = join(dir, 'evil.png');
    const output = join(dir, 'out.png');
    writeFileSync(input, MVG);

    await assert.rejects(
      processor.optimizeImage({ inputPath: input, outputPath: output }),
      UNSAFE_INPUT,
    );
    await assert.rejects(processor.getImageInfo({ imagePath: input }), UNSAFE_INPUT);
    assert.equal(existsSync(output), false);
  });

  test('MVG disguised as .png is rejected by thumbnail, icon and convert', async () => {
    const dir = freshDir('mvg-other');
    const input = join(dir, 'evil.png');
    writeFileSync(input, MVG);

    await assert.rejects(processor.createThumbnail({
      inputPath: input, outputPath: join(dir, 't.png'), width: 8, height: 8,
    }), UNSAFE_INPUT);
    await assert.rejects(processor.createIcon({
      inputPath: input, outputDir: join(dir, 'icons'), sizes: [16],
    }), UNSAFE_INPUT);
    await assert.rejects(processor.convertFormat({
      inputPath: input, outputPath: join(dir, 'c.jpg'), format: 'jpg',
    }), UNSAFE_INPUT);
  });

  test('SVG disguised as .jpg is rejected', async () => {
    const dir = freshDir('svg');
    const input = join(dir, 'evil.jpg');
    writeFileSync(input, SVG);

    await assert.rejects(
      processor.optimizeImage({ inputPath: input, outputPath: join(dir, 'out.jpg') }),
      UNSAFE_INPUT,
    );
    await assert.rejects(processor.getImageInfo({ imagePath: input }), UNSAFE_INPUT);
  });

  test('PostScript disguised as .png is rejected', async () => {
    const dir = freshDir('ps');
    const input = join(dir, 'evil.png');
    writeFileSync(input, PS);

    await assert.rejects(
      processor.optimizeImage({ inputPath: input, outputPath: join(dir, 'out.png') }),
      UNSAFE_INPUT,
    );
    await assert.rejects(processor.getImageInfo({ imagePath: input }), UNSAFE_INPUT);
  });

  test('empty file is rejected', async () => {
    const dir = freshDir('empty');
    const input = join(dir, 'empty.png');
    writeFileSync(input, '');

    await assert.rejects(processor.getImageInfo({ imagePath: input }), UNSAFE_INPUT);
  });

  test('batchOptimize reports the disguised file as failed', async () => {
    const dir = freshDir('batch-evil');
    const inputDir = freshDir('batch-evil/in');
    writeFileSync(join(inputDir, 'evil.png'), MVG);
    makeImage(join(inputDir, 'good.png'));

    const result = await processor.batchOptimize({ inputDir, outputDir: join(dir, 'out') });

    assert.equal(result.processedFiles, 1);
    assert.equal(result.failedFiles, 1);
    const failed = result.results.find(r => r.file === 'evil.png');
    assert.match(failed.error, UNSAFE_INPUT);
  });
});

describe('coder prefixes in paths do not select a coder', { skip: !hasMagick }, () => {
  for (const name of ['text:out.png', 'msl:out.png']) {
    test(`outputPath ${name} is written as a PNG file of that name`, async () => {
      const dir = freshDir(`out-${name.split(':')[0]}`);
      makeImage(join(dir, 'in.png'));

      await inDir(dir, () => processor.optimizeImage({ inputPath: 'in.png', outputPath: name }));

      assert.ok(existsSync(join(dir, name)));
      assert.ok(startsWithPng(join(dir, name)));
    });
  }

  test('inputPath msl:in.png is decoded as PNG from the file of that name', async () => {
    const dir = freshDir('in-msl');
    makeImage(join(dir, 'msl:in.png'));

    let result;
    await inDir(dir, async () => {
      result = await processor.getImageInfo({ imagePath: 'msl:in.png' });
    });

    assert.equal(result.imageInfo.format, 'PNG');
  });

  test('output extensions outside the allowlist are rejected', async () => {
    const dir = freshDir('bad-ext');
    const input = join(dir, 'in.png');
    makeImage(input);

    for (const output of ['out.svg', 'out.mvg', 'out.txt', 'out.pdf', 'out']) {
      await assert.rejects(
        processor.optimizeImage({ inputPath: input, outputPath: join(dir, output) }),
        UNSAFE_OUTPUT,
      );
      assert.equal(existsSync(join(dir, output)), false);
    }
  });
});

describe('real raster inputs still work', { skip: !hasMagick }, () => {
  const cases = [
    ['png', 'PNG'],
    ['jpg', 'JPEG'],
    ['gif', 'GIF'],
    ['webp', 'WEBP'],
  ];

  for (const [ext, format] of cases) {
    test(`${format} input optimizes and reports its format`, async () => {
      const dir = freshDir(`real-${ext}`);
      const input = join(dir, `in.${ext}`);
      const output = join(dir, `out.${ext}`);
      makeImage(input);

      const result = await processor.optimizeImage({ inputPath: input, outputPath: output });
      const info = await processor.getImageInfo({ imagePath: output });

      assert.equal(result.success, true);
      assert.equal(info.imageInfo.format, format);
    });
  }

  test('a PNG named .jpg decodes as PNG', async () => {
    const dir = freshDir('png-as-jpg');
    const input = join(dir, 'actually-png.jpg');
    makeImage(input, 'PNG');

    const info = await processor.getImageInfo({ imagePath: input });
    const result = await processor.convertFormat({
      inputPath: input, outputPath: join(dir, 'out.png'), format: 'png',
    });

    assert.equal(info.imageInfo.format, 'PNG');
    assert.equal(info.imageInfo.width, 64);
    assert.ok(result.command.includes(`PNG:${realpathSync(input)}`));
  });
});

describe('shipped policy.xml', { skip: !hasMagick }, () => {
  test('ImageMagick loads it and it denies the dangerous coders', () => {
    const configDir = fileURLToPath(new URL('../config/', import.meta.url));
    const listing = execFileSync('magick', ['-list', 'policy'], {
      env: { ...process.env, MAGICK_CONFIGURE_PATH: configDir },
      encoding: 'utf8',
    });

    assert.ok(listing.includes(join(configDir, 'policy.xml')));
    for (const coder of ['MVG', 'MSL', 'SVG', 'TEXT', 'URL', 'PS', 'EPS', 'PDF', 'XPS']) {
      assert.match(listing, new RegExp(`[{,]${coder}[,}]`));
    }
    assert.match(listing, /pattern: @\*/);
  });
});
