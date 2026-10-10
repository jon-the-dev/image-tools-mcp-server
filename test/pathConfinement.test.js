import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, delimiter, join } from 'node:path';
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
const OUTSIDE = /outside the allowed directories .*IMAGE_TOOLS_ALLOWED_DIRS/s;
let root;
let outside;

function freshDir(base, name) {
  const dir = join(base, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeImage(path, size = '64x48') {
  execFileSync('magick', ['-size', size, 'xc:red', path]);
}

before(() => {
  root = mkdtempSync(join(tmpdir(), 'image-tools-root-'));
  outside = mkdtempSync(join(tmpdir(), 'image-tools-outside-'));
  process.env.IMAGE_TOOLS_ALLOWED_DIRS = root;
});

after(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

describe('paths outside the allowed directories are rejected', { skip: !hasMagick }, () => {
  test('input outside the root', async () => {
    const input = join(freshDir(outside, 'in-outside'), 'secret.png');
    const output = join(freshDir(root, 'in-outside'), 'out.png');
    makeImage(input);

    await assert.rejects(
      processor.optimizeImage({ inputPath: input, outputPath: output }),
      OUTSIDE,
    );
    await assert.rejects(processor.getImageInfo({ imagePath: input }), OUTSIDE);
    assert.equal(existsSync(output), false);
  });

  test('output outside the root', async () => {
    const input = join(freshDir(root, 'out-outside'), 'in.png');
    const output = join(outside, 'out-outside', 'out.png');
    makeImage(input);

    await assert.rejects(
      processor.createThumbnail({ inputPath: input, outputPath: output, width: 8, height: 8 }),
      OUTSIDE,
    );
    assert.equal(existsSync(join(outside, 'out-outside')), false);
  });

  test('symlink inside the root pointing outside', async () => {
    const dir = freshDir(root, 'symlink');
    const target = freshDir(outside, 'symlink-target');
    makeImage(join(target, 'secret.png'));
    symlinkSync(target, join(dir, 'link'));
    const input = join(dir, 'in.png');
    makeImage(input);

    await assert.rejects(
      processor.getImageInfo({ imagePath: join(dir, 'link', 'secret.png') }),
      OUTSIDE,
    );
    await assert.rejects(
      processor.optimizeImage({ inputPath: input, outputPath: join(dir, 'link', 'out.png') }),
      OUTSIDE,
    );
    assert.equal(existsSync(join(target, 'out.png')), false);
  });

  test('../ escape', async () => {
    const input = join(freshDir(root, 'dotdot'), 'in.png');
    makeImage(input);
    const escaped = join(root, 'dotdot', '..', '..', basename(outside), 'escaped.png');

    await assert.rejects(
      processor.convertFormat({ inputPath: input, outputPath: escaped, format: 'png' }),
      OUTSIDE,
    );
    assert.equal(existsSync(join(outside, 'escaped.png')), false);
  });

  test('createIcon outputDir outside the root is not created', async () => {
    const input = join(freshDir(root, 'icon-outside'), 'logo.png');
    makeImage(input, '32x32');
    const outputDir = join(outside, 'icons', 'nested');

    await assert.rejects(
      processor.createIcon({ inputPath: input, outputDir, sizes: [16] }),
      OUTSIDE,
    );
    assert.equal(existsSync(join(outside, 'icons')), false);
  });

  test('batch inputDir outside the root', async () => {
    const inputDir = freshDir(outside, 'batch-in');
    makeImage(join(inputDir, 'a.png'));

    await assert.rejects(
      processor.batchOptimize({ inputDir, outputDir: join(root, 'batch-out') }),
      OUTSIDE,
    );
    assert.equal(existsSync(join(root, 'batch-out')), false);
  });
});

describe('overwrite rules', { skip: !hasMagick }, () => {
  test('existing output is kept unless overwrite is true', async () => {
    const dir = freshDir(root, 'overwrite');
    const input = join(dir, 'in.png');
    const output = join(dir, 'out.png');
    makeImage(input, '64x48');
    makeImage(output, '10x10');
    const before = readFileSync(output);

    await assert.rejects(
      processor.optimizeImage({ inputPath: input, outputPath: output }),
      /already exists\. Pass overwrite: true/,
    );
    assert.deepEqual(readFileSync(output), before);

    const result = await processor.optimizeImage({
      inputPath: input, outputPath: output, overwrite: true,
    });
    assert.equal(result.success, true);
    const { imageInfo } = await processor.getImageInfo({ imagePath: output });
    assert.equal(imageInfo.dimensions, '64x48');
  });

  test('output equal to input is rejected even with overwrite', async () => {
    const dir = freshDir(root, 'same-file');
    const input = join(dir, 'in.png');
    makeImage(input);
    const original = readFileSync(input);

    for (const outputPath of [input, join(dir, '.', 'in.png')]) {
      await assert.rejects(
        processor.optimizeImage({ inputPath: input, outputPath, overwrite: true, quality: 5 }),
        /is the input file/,
      );
    }
    assert.deepEqual(readFileSync(input), original);
  });

  test('batch outputDir equal to inputDir is rejected even with overwrite', async () => {
    const inputDir = freshDir(root, 'batch-same');
    makeImage(join(inputDir, 'a.png'));
    const original = readFileSync(join(inputDir, 'a.png'));

    await assert.rejects(
      processor.batchOptimize({
        inputDir, outputDir: `${inputDir}/`, overwrite: true, quality: 5,
      }),
      /same directory as inputDir/,
    );
    assert.deepEqual(readFileSync(join(inputDir, 'a.png')), original);
  });

  test('output with a non-image extension is rejected', async () => {
    const dir = freshDir(root, 'extension');
    const input = join(dir, 'in.png');
    makeImage(input);

    await assert.rejects(
      processor.optimizeImage({ inputPath: input, outputPath: join(dir, 'run.sh') }),
      /unsupported extension "sh"/,
    );
    await assert.rejects(
      processor.createIcon({ inputPath: input, outputDir: dir, sizes: [16], format: 'sh' }),
      /unsupported extension "sh"/,
    );
    assert.equal(existsSync(join(dir, 'run.sh')), false);
    assert.equal(existsSync(join(dir, 'in-16x16.sh')), false);
  });
});

describe('paths inside the allowed directories still work', { skip: !hasMagick }, () => {
  test('optimize, convert, icon and batch inside the root', async () => {
    const dir = freshDir(root, 'happy');
    const input = join(dir, 'in.png');
    makeImage(input);

    const optimized = await processor.optimizeImage({
      inputPath: input, outputPath: join(dir, 'new', 'out.png'),
    });
    const converted = await processor.convertFormat({
      inputPath: input, outputPath: join(dir, 'out.webp'), format: 'webp',
    });
    const icons = await processor.createIcon({
      inputPath: input, outputDir: join(dir, 'icons'), sizes: [16],
    });
    const batch = await processor.batchOptimize({
      inputDir: dir, outputDir: join(dir, 'batch'),
    });

    assert.equal(optimized.success, true);
    assert.equal(converted.success, true);
    assert.equal(icons.icons[0].error, undefined);
    assert.equal(batch.processedFiles, batch.totalFiles);
    assert.ok(existsSync(join(dir, 'batch', 'in.png')));
  });

  test('relative paths resolve against the working directory', async () => {
    const dir = freshDir(root, 'relative');
    makeImage(join(dir, 'in.png'));
    const previous = process.cwd();
    process.chdir(dir);
    try {
      const result = await processor.optimizeImage({
        inputPath: 'in.png', outputPath: 'sub/out.png',
      });
      assert.equal(result.success, true);
    } finally {
      process.chdir(previous);
    }
    assert.ok(existsSync(join(dir, 'sub', 'out.png')));
  });

  test('magick receives the validated real path, not the requested one', async () => {
    const dir = freshDir(root, 'validated');
    const real = freshDir(dir, 'real');
    symlinkSync(real, join(dir, 'link'));
    makeImage(join(real, 'in.png'));

    const result = await processor.optimizeImage({
      inputPath: join(dir, 'link', 'in.png'), outputPath: join(dir, 'link', 'out.png'),
    });

    const realDir = realpathSync(real);
    assert.equal(result.command.split(' ')[1], join(realDir, 'in.png'));
    assert.equal(result.command.split(' ').at(-1), join(realDir, 'out.png'));
  });

  test('any entry in a multi-root list is allowed', async () => {
    const extra = mkdtempSync(join(tmpdir(), 'image-tools-extra-'));
    const input = join(freshDir(root, 'multi'), 'in.png');
    makeImage(input);
    process.env.IMAGE_TOOLS_ALLOWED_DIRS = [root, extra].join(delimiter);
    try {
      const result = await processor.optimizeImage({
        inputPath: input, outputPath: join(extra, 'out.png'),
      });
      assert.equal(result.success, true);
    } finally {
      process.env.IMAGE_TOOLS_ALLOWED_DIRS = root;
      rmSync(extra, { recursive: true, force: true });
    }
  });
});

describe('resolveAllowedPath (used by list_images)', () => {
  async function loadGuard() {
    return import('../src/pathGuard.js');
  }

  test('rejects a directory outside the root', async () => {
    const { resolveAllowedPath } = await loadGuard();
    assert.throws(() => resolveAllowedPath(outside, 'directory'), OUTSIDE);
    assert.throws(() => resolveAllowedPath('/', 'directory'), OUTSIDE);
  });

  test('rejects a dangling symlink instead of following it', async () => {
    const { resolveAllowedPath } = await loadGuard();
    const dir = freshDir(root, 'dangling');
    symlinkSync(join(outside, 'not-there.png'), join(dir, 'dangling.png'));
    assert.throws(
      () => resolveAllowedPath(join(dir, 'dangling.png'), 'outputPath'),
      /broken or looping symlink/,
    );
  });

  test('accepts the root itself and names starting with two dots', async () => {
    const { resolveAllowedPath } = await loadGuard();
    const realRoot = realpathSync(root);
    assert.equal(resolveAllowedPath(root, 'directory'), realRoot);
    assert.equal(resolveAllowedPath(join(root, '..foo.png'), 'outputPath'),
      join(realRoot, '..foo.png'));
  });

  test('defaults to the working directory when the variable is unset', async () => {
    const { resolveAllowedPath } = await loadGuard();
    delete process.env.IMAGE_TOOLS_ALLOWED_DIRS;
    const previous = process.cwd();
    process.chdir(outside);
    try {
      assert.equal(resolveAllowedPath('x.png', 'outputPath'),
        join(realpathSync(outside), 'x.png'));
      assert.throws(() => resolveAllowedPath(root, 'directory'), OUTSIDE);
    } finally {
      process.chdir(previous);
      process.env.IMAGE_TOOLS_ALLOWED_DIRS = root;
    }
  });
});
