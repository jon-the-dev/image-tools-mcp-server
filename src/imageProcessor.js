import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  closeSync, existsSync, mkdirSync, openSync, readSync, readdirSync, statSync,
} from 'fs';
import { join, dirname, extname, basename, resolve, delimiter } from 'path';
import { fileURLToPath } from 'url';
import { isSameFile, resolveAllowedPath } from './pathGuard.js';

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 10 * 1024 * 1024;
const POLICY_DIR = fileURLToPath(new URL('../config/', import.meta.url));

const ALLOWED_CODERS = ['PNG', 'JPEG', 'GIF', 'WEBP', 'TIFF', 'BMP', 'ICO'];

const MAGIC_SIGNATURES = [
  { coder: 'PNG', parts: [[0, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]] },
  { coder: 'JPEG', parts: [[0, Buffer.from([0xff, 0xd8, 0xff])]] },
  { coder: 'GIF', parts: [[0, Buffer.from('GIF8')]] },
  { coder: 'WEBP', parts: [[0, Buffer.from('RIFF')], [8, Buffer.from('WEBP')]] },
  { coder: 'TIFF', parts: [[0, Buffer.from([0x49, 0x49, 0x2a, 0x00])]] },
  { coder: 'TIFF', parts: [[0, Buffer.from([0x4d, 0x4d, 0x00, 0x2a])]] },
  { coder: 'BMP', parts: [[0, Buffer.from('BM')]] },
  { coder: 'ICO', parts: [[0, Buffer.from([0x00, 0x00, 0x01, 0x00])]] },
];

/**
 * Writable file extensions and the coder each maps to. The output extension allowlist
 * (supportedFormats) and the output coder prefix both derive from this map.
 */
const EXTENSION_CODERS = {
  png: 'PNG',
  jpg: 'JPEG',
  jpeg: 'JPEG',
  gif: 'GIF',
  webp: 'WEBP',
  tif: 'TIFF',
  tiff: 'TIFF',
  bmp: 'BMP',
  ico: 'ICO',
};

function magickEnv() {
  const existing = process.env.MAGICK_CONFIGURE_PATH;
  const configurePath = existing ? `${POLICY_DIR}${delimiter}${existing}` : POLICY_DIR;
  return { ...process.env, MAGICK_CONFIGURE_PATH: configurePath };
}

function runMagick(args) {
  return execFileAsync('magick', args, { maxBuffer: MAX_BUFFER, env: magickEnv() });
}

function readHeader(filePath, length = 16) {
  const fd = openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const bytesRead = readSync(fd, buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    closeSync(fd);
  }
}

function matchesSignature(header, { parts }) {
  return parts.every(([offset, bytes]) =>
    header.subarray(offset, offset + bytes.length).equals(bytes));
}

/**
 * Detect the raster coder for an input file from its magic number.
 *
 * Args:
 *   filePath: Path of the input image.
 *
 * Returns:
 *   The ImageMagick coder name (one of ALLOWED_CODERS).
 *
 * Throws:
 *   Error if the content does not match an allowed raster format.
 */
function detectInputCoder(filePath) {
  const header = readHeader(filePath);
  const signature = MAGIC_SIGNATURES.find(sig => matchesSignature(header, sig));
  if (!signature) {
    throw new Error(
      `Unsupported or unsafe image type: ${filePath}. ` +
      `Allowed formats: ${ALLOWED_CODERS.join(', ')}.`,
    );
  }
  return signature.coder;
}

/**
 * Map an output path's extension to an allowed raster coder.
 *
 * This is the only output-extension check: resolveOutputPath runs it before anything is
 * written, and outputArg runs it again when building the magick argument.
 *
 * Throws:
 *   Error if the extension is missing or not on the allowlist.
 */
function outputCoder(filePath, label = 'outputPath') {
  const ext = extname(filePath).toLowerCase().substring(1);
  const coder = Object.hasOwn(EXTENSION_CODERS, ext) ? EXTENSION_CODERS[ext] : undefined;
  if (!coder) {
    throw new Error(
      `Unsupported or unsafe output type: ${label} ${filePath} has unsupported extension ` +
      `"${ext}". Use one of: ${Object.keys(EXTENSION_CODERS).join(', ')}.`,
    );
  }
  return coder;
}

/*
 * Every path reaches magick through inputArg/outputArg as `${coder}:${absolutePath}`.
 * Callers pass the real path resolveInputPath/resolveOutputPath validated, never the raw
 * tool argument, so magick opens exactly the file confinement checked. The explicit coder
 * pins the format, and the prefix keeps a leading "-" from being read as an option.
 */
function inputArg(validatedPath) {
  return `${detectInputCoder(validatedPath)}:${resolve(validatedPath)}`;
}

function outputArg(validatedPath) {
  return `${outputCoder(validatedPath)}:${resolve(validatedPath)}`;
}

function formatCommand(args) {
  return ['magick', ...args].join(' ');
}

export class ImageProcessor {
  constructor() {
    this.supportedFormats = Object.keys(EXTENSION_CODERS);
  }

  /**
   * Check if ImageMagick is installed
   */
  async checkImageMagick() {
    try {
      await runMagick(['-version']);
      return true;
    } catch (error) {
      throw new Error('ImageMagick is not installed or not in PATH. Please install ImageMagick first.');
    }
  }

  /**
   * Ensure directory exists
   */
  ensureDirectoryExists(filePath) {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Validate file exists
   */
  validateInputFile(filePath) {
    if (!existsSync(filePath)) {
      // Provide more helpful error information
      const absolutePath = resolve(filePath);
      const currentDir = process.cwd();
      let dirContents = 'Unable to read directory';
      try {
        const allFiles = readdirSync('.');
        const imageFiles = allFiles.filter(f => /\.(jpg|jpeg|png|gif|bmp|tiff|webp|ico)$/i.test(f));
        dirContents = imageFiles.length > 0 
          ? `Image files found: ${imageFiles.join(', ')}`
          : `No image files found. All files: ${allFiles.slice(0, 10).join(', ')}${allFiles.length > 10 ? '...' : ''}`;
      } catch (e) {
        // ignore
      }
      throw new Error(`Input file does not exist: ${filePath}\n\nTroubleshooting:\n- Absolute path: ${absolutePath}\n- Current directory: ${currentDir}\n- ${dirContents}\n\nTip: Make sure the image file exists in the directory where you're running the Q CLI command.`);
    }
  }

  /**
   * Confine an input path to the allowed directories and require that it exists.
   *
   * @param {string} filePath - Path supplied by the tool call.
   * @param {string} [label] - Argument name used in error messages.
   * @returns {string} The resolved real path.
   */
  resolveInputPath(filePath, label = 'inputPath') {
    const realPath = resolveAllowedPath(filePath, label);
    this.validateInputFile(filePath);
    return realPath;
  }

  /**
   * Confine an output path and refuse unsafe writes.
   *
   * Rejects extensions outside EXTENSION_CODERS, the input file itself (even with
   * overwrite), and any existing file unless overwrite is true.
   *
   * @param {string} outputPath - Path supplied by the tool call or derived from it.
   * @param {object} options - Write options.
   * @param {string} options.inputReal - Resolved real path of the input file.
   * @param {boolean} [options.overwrite] - Allow replacing an existing file.
   * @param {string} [options.label] - Argument name used in error messages.
   * @returns {string} The resolved real path.
   */
  resolveOutputPath(outputPath, { inputReal, overwrite = false, label = 'outputPath' }) {
    const realPath = resolveAllowedPath(outputPath, label);
    for (const candidate of new Set([outputPath, realPath])) {
      outputCoder(candidate, label);
    }
    if (isSameFile(inputReal, realPath)) {
      throw new Error(
        `${label} ${outputPath} is the input file. Choose a different output path; ` +
        'overwrite: true does not allow replacing the input.',
      );
    }
    if (!overwrite && existsSync(realPath)) {
      throw new Error(
        `${label} ${outputPath} already exists. Pass overwrite: true to replace it, ` +
        'or choose a different path.',
      );
    }
    return realPath;
  }

  /**
   * Get file size in bytes
   */
  getFileSize(filePath) {
    try {
      const stats = statSync(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Optimize an image to reduce file size
   */
  async optimizeImage({
    inputPath, outputPath, quality = 85, maxWidth, maxHeight, overwrite = false,
  }) {
    await this.checkImageMagick();
    const inputReal = this.resolveInputPath(inputPath);
    const outputReal = this.resolveOutputPath(outputPath, { inputReal, overwrite });
    this.ensureDirectoryExists(outputReal);

    const originalSize = this.getFileSize(inputReal);
    
    const args = [inputArg(inputReal)];
    
    // Add resize if dimensions specified
    if (maxWidth || maxHeight) {
      const resize = maxWidth && maxHeight 
        ? `${maxWidth}x${maxHeight}>`
        : maxWidth 
          ? `${maxWidth}x>`
          : `x${maxHeight}>`;
      args.push('-resize', resize);
    }
    
    // Add quality setting
    args.push('-quality', String(quality));
    
    // Add optimization flags
    args.push('-strip', '-interlace', 'Plane');
    
    args.push(outputArg(outputReal));

    try {
      await runMagick(args);
      const optimizedSize = this.getFileSize(outputReal);
      const compressionRatio = ((originalSize - optimizedSize) / originalSize * 100).toFixed(2);

      return {
        success: true,
        inputPath,
        outputPath,
        originalSize: this.formatFileSize(originalSize),
        optimizedSize: this.formatFileSize(optimizedSize),
        compressionRatio: `${compressionRatio}%`,
        savedBytes: this.formatFileSize(originalSize - optimizedSize),
        quality,
        maxWidth,
        maxHeight,
        command: formatCommand(args),
      };
    } catch (error) {
      throw new Error(`Failed to optimize image: ${error.message}`);
    }
  }

  /**
   * Create a thumbnail from an image
   */
  async createThumbnail({
    inputPath, outputPath, width, height, maintainAspectRatio = true, cropToFit = false,
    overwrite = false,
  }) {
    await this.checkImageMagick();
    const inputReal = this.resolveInputPath(inputPath);
    const outputReal = this.resolveOutputPath(outputPath, { inputReal, overwrite });
    this.ensureDirectoryExists(outputReal);

    const args = [inputArg(inputReal)];
    
    if (cropToFit) {
      // Crop to exact dimensions
      args.push(
        '-resize', `${width}x${height}^`,
        '-gravity', 'center',
        '-crop', `${width}x${height}+0+0`,
      );
    } else if (maintainAspectRatio) {
      // Resize maintaining aspect ratio
      args.push('-resize', `${width}x${height}>`);
    } else {
      // Force exact dimensions (may distort)
      args.push('-resize', `${width}x${height}!`);
    }
    
    args.push(outputArg(outputReal));

    try {
      await runMagick(args);
      const thumbnailSize = this.getFileSize(outputReal);

      return {
        success: true,
        inputPath,
        outputPath,
        dimensions: `${width}x${height}`,
        maintainAspectRatio,
        cropToFit,
        fileSize: this.formatFileSize(thumbnailSize),
        command: formatCommand(args),
      };
    } catch (error) {
      throw new Error(`Failed to create thumbnail: ${error.message}`);
    }
  }

  /**
   * Create icons in multiple sizes
   */
  async createIcon({
    inputPath, outputDir, sizes = [16, 32, 64, 128, 256], format = 'png', overwrite = false,
  }) {
    await this.checkImageMagick();
    const inputReal = this.resolveInputPath(inputPath);
    const outputDirReal = resolveAllowedPath(outputDir, 'outputDir');
    const baseName = basename(inputPath, extname(inputPath));
    const outputReals = sizes.map((size) => {
      const outputPath = join(outputDir, `${baseName}-${size}x${size}.${format}`);
      return this.resolveOutputPath(outputPath, { inputReal, overwrite, label: 'icon outputPath' });
    });

    if (!existsSync(outputDirReal)) {
      mkdirSync(outputDirReal, { recursive: true });
    }

    const results = [];
    const input = inputArg(inputReal);

    for (const [index, size] of sizes.entries()) {
      const outputPath = join(outputDir, `${baseName}-${size}x${size}.${format}`);
      const args = [input, '-resize', `${size}x${size}`, outputArg(outputReals[index])];

      try {
        await runMagick(args);
        const fileSize = this.getFileSize(outputReals[index]);
        
        results.push({
          size: `${size}x${size}`,
          path: outputPath,
          fileSize: this.formatFileSize(fileSize),
        });
      } catch (error) {
        results.push({
          size: `${size}x${size}`,
          path: outputPath,
          error: error.message,
        });
      }
    }

    return {
      success: true,
      inputPath,
      outputDir,
      format,
      icons: results,
    };
  }

  /**
   * Convert image format
   */
  async convertFormat({ inputPath, outputPath, format, quality = 90, overwrite = false }) {
    await this.checkImageMagick();
    const inputReal = this.resolveInputPath(inputPath);
    const outputReal = this.resolveOutputPath(outputPath, { inputReal, overwrite });
    this.ensureDirectoryExists(outputReal);

    if (!this.supportedFormats.includes(format.toLowerCase())) {
      throw new Error(`Unsupported format: ${format}. Supported formats: ${this.supportedFormats.join(', ')}`);
    }

    const originalSize = this.getFileSize(inputReal);
    
    const args = [inputArg(inputReal)];
    
    // Add quality for lossy formats
    if (['jpg', 'jpeg', 'webp'].includes(format.toLowerCase())) {
      args.push('-quality', String(quality));
    }
    
    args.push(outputArg(outputReal));

    try {
      await runMagick(args);
      const convertedSize = this.getFileSize(outputReal);

      return {
        success: true,
        inputPath,
        outputPath,
        format,
        quality: ['jpg', 'jpeg', 'webp'].includes(format.toLowerCase()) ? quality : 'N/A',
        originalSize: this.formatFileSize(originalSize),
        convertedSize: this.formatFileSize(convertedSize),
        command: formatCommand(args),
      };
    } catch (error) {
      throw new Error(`Failed to convert format: ${error.message}`);
    }
  }

  /**
   * Get detailed image information
   */
  async getImageInfo({ imagePath }) {
    await this.checkImageMagick();
    const imageReal = this.resolveInputPath(imagePath, 'imagePath');
    const args = ['identify', '-verbose', inputArg(imageReal)];

    try {
      const { stdout } = await runMagick(args);
      const fileSize = this.getFileSize(imageReal);
      
      // Parse basic info from identify output
      const lines = stdout.split('\n');
      const info = {
        path: imagePath,
        fileSize: this.formatFileSize(fileSize),
        fileSizeBytes: fileSize,
      };

      // Extract key information
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.includes('Format:')) {
          info.format = trimmed.split('Format:')[1].trim().split(' ')[0];
        } else if (trimmed.includes('Geometry:')) {
          const geometry = trimmed.split('Geometry:')[1].trim().split('+')[0];
          info.dimensions = geometry;
          const [width, height] = geometry.split('x');
          info.width = parseInt(width);
          info.height = parseInt(height);
        } else if (trimmed.includes('Resolution:')) {
          info.resolution = trimmed.split('Resolution:')[1].trim();
        } else if (trimmed.includes('Colorspace:')) {
          info.colorspace = trimmed.split('Colorspace:')[1].trim();
        } else if (trimmed.includes('Depth:')) {
          info.depth = trimmed.split('Depth:')[1].trim();
        } else if (trimmed.includes('Quality:')) {
          info.quality = trimmed.split('Quality:')[1].trim();
        }
      }

      return {
        success: true,
        imageInfo: info,
        rawOutput: stdout,
      };
    } catch (error) {
      throw new Error(`Failed to get image info: ${error.message}`);
    }
  }

  /**
   * Batch optimize images in a directory
   */
  async batchOptimize({
    inputDir, outputDir, quality = 85, maxWidth, maxHeight,
    extensions = ['jpg', 'jpeg', 'png', 'webp'], overwrite = false,
  }) {
    await this.checkImageMagick();
    const inputDirReal = resolveAllowedPath(inputDir, 'inputDir');
    const outputDirReal = resolveAllowedPath(outputDir, 'outputDir');

    if (!existsSync(inputDir)) {
      throw new Error(`Input directory does not exist: ${inputDir}`);
    }

    if (isSameFile(inputDirReal, outputDirReal)) {
      throw new Error(
        `outputDir ${outputDir} is the same directory as inputDir. Choose a different ` +
        'outputDir; overwrite: true does not allow replacing the originals.',
      );
    }

    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const files = readdirSync(inputDir);
    const imageFiles = files.filter(file => {
      const ext = extname(file).toLowerCase().substring(1);
      return extensions.includes(ext) && statSync(join(inputDir, file)).isFile();
    });

    if (imageFiles.length === 0) {
      return {
        success: true,
        message: 'No image files found to process',
        inputDir,
        outputDir,
        processedFiles: [],
      };
    }

    const results = [];
    let totalOriginalSize = 0;
    let totalOptimizedSize = 0;

    for (const file of imageFiles) {
      const inputPath = join(inputDir, file);
      const outputPath = join(outputDir, file);

      try {
        const result = await this.optimizeImage({
          inputPath,
          outputPath,
          quality,
          maxWidth,
          maxHeight,
          overwrite,
        });
        
        results.push({
          file,
          success: true,
          ...result,
        });

        totalOriginalSize += this.getFileSize(inputPath);
        totalOptimizedSize += this.getFileSize(outputPath);
      } catch (error) {
        results.push({
          file,
          success: false,
          error: error.message,
        });
      }
    }

    const totalCompressionRatio = totalOriginalSize > 0 
      ? ((totalOriginalSize - totalOptimizedSize) / totalOriginalSize * 100).toFixed(2)
      : '0';

    return {
      success: true,
      inputDir,
      outputDir,
      totalFiles: imageFiles.length,
      processedFiles: results.filter(r => r.success).length,
      failedFiles: results.filter(r => !r.success).length,
      totalOriginalSize: this.formatFileSize(totalOriginalSize),
      totalOptimizedSize: this.formatFileSize(totalOptimizedSize),
      totalCompressionRatio: `${totalCompressionRatio}%`,
      totalSavedBytes: this.formatFileSize(totalOriginalSize - totalOptimizedSize),
      results,
    };
  }
}
