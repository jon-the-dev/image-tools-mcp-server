import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, extname, basename } from 'path';

const execAsync = promisify(exec);

export class ImageProcessor {
  constructor() {
    this.supportedFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'ico'];
  }

  /**
   * Check if ImageMagick is installed
   */
  async checkImageMagick() {
    try {
      await execAsync('magick -version');
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
      throw new Error(`Input file does not exist: ${filePath}`);
    }
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
  async optimizeImage({ inputPath, outputPath, quality = 85, maxWidth, maxHeight }) {
    await this.checkImageMagick();
    this.validateInputFile(inputPath);
    this.ensureDirectoryExists(outputPath);

    const originalSize = this.getFileSize(inputPath);
    
    let command = `magick "${inputPath}"`;
    
    // Add resize if dimensions specified
    if (maxWidth || maxHeight) {
      const resize = maxWidth && maxHeight 
        ? `${maxWidth}x${maxHeight}>`
        : maxWidth 
          ? `${maxWidth}x>`
          : `x${maxHeight}>`;
      command += ` -resize "${resize}"`;
    }
    
    // Add quality setting
    command += ` -quality ${quality}`;
    
    // Add optimization flags
    command += ` -strip -interlace Plane`;
    
    command += ` "${outputPath}"`;

    try {
      const { stdout, stderr } = await execAsync(command);
      const optimizedSize = this.getFileSize(outputPath);
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
        command: command.replace(/"/g, ''),
      };
    } catch (error) {
      throw new Error(`Failed to optimize image: ${error.message}`);
    }
  }

  /**
   * Create a thumbnail from an image
   */
  async createThumbnail({ inputPath, outputPath, width, height, maintainAspectRatio = true, cropToFit = false }) {
    await this.checkImageMagick();
    this.validateInputFile(inputPath);
    this.ensureDirectoryExists(outputPath);

    let command = `magick "${inputPath}"`;
    
    if (cropToFit) {
      // Crop to exact dimensions
      command += ` -resize "${width}x${height}^" -gravity center -crop "${width}x${height}+0+0"`;
    } else if (maintainAspectRatio) {
      // Resize maintaining aspect ratio
      command += ` -resize "${width}x${height}>"`;
    } else {
      // Force exact dimensions (may distort)
      command += ` -resize "${width}x${height}!"`;
    }
    
    command += ` "${outputPath}"`;

    try {
      const { stdout, stderr } = await execAsync(command);
      const thumbnailSize = this.getFileSize(outputPath);

      return {
        success: true,
        inputPath,
        outputPath,
        dimensions: `${width}x${height}`,
        maintainAspectRatio,
        cropToFit,
        fileSize: this.formatFileSize(thumbnailSize),
        command: command.replace(/"/g, ''),
      };
    } catch (error) {
      throw new Error(`Failed to create thumbnail: ${error.message}`);
    }
  }

  /**
   * Create icons in multiple sizes
   */
  async createIcon({ inputPath, outputDir, sizes = [16, 32, 64, 128, 256], format = 'png' }) {
    await this.checkImageMagick();
    this.validateInputFile(inputPath);
    
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const results = [];
    const baseName = basename(inputPath, extname(inputPath));

    for (const size of sizes) {
      const outputPath = join(outputDir, `${baseName}-${size}x${size}.${format}`);
      
      let command = `magick "${inputPath}" -resize "${size}x${size}" "${outputPath}"`;

      try {
        await execAsync(command);
        const fileSize = this.getFileSize(outputPath);
        
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
  async convertFormat({ inputPath, outputPath, format, quality = 90 }) {
    await this.checkImageMagick();
    this.validateInputFile(inputPath);
    this.ensureDirectoryExists(outputPath);

    if (!this.supportedFormats.includes(format.toLowerCase())) {
      throw new Error(`Unsupported format: ${format}. Supported formats: ${this.supportedFormats.join(', ')}`);
    }

    const originalSize = this.getFileSize(inputPath);
    
    let command = `magick "${inputPath}"`;
    
    // Add quality for lossy formats
    if (['jpg', 'jpeg', 'webp'].includes(format.toLowerCase())) {
      command += ` -quality ${quality}`;
    }
    
    command += ` "${outputPath}"`;

    try {
      const { stdout, stderr } = await execAsync(command);
      const convertedSize = this.getFileSize(outputPath);

      return {
        success: true,
        inputPath,
        outputPath,
        format,
        quality: ['jpg', 'jpeg', 'webp'].includes(format.toLowerCase()) ? quality : 'N/A',
        originalSize: this.formatFileSize(originalSize),
        convertedSize: this.formatFileSize(convertedSize),
        command: command.replace(/"/g, ''),
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
    this.validateInputFile(imagePath);

    const command = `magick identify -verbose "${imagePath}"`;

    try {
      const { stdout } = await execAsync(command);
      const fileSize = this.getFileSize(imagePath);
      
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
  async batchOptimize({ inputDir, outputDir, quality = 85, maxWidth, maxHeight, extensions = ['jpg', 'jpeg', 'png', 'webp'] }) {
    await this.checkImageMagick();
    
    if (!existsSync(inputDir)) {
      throw new Error(`Input directory does not exist: ${inputDir}`);
    }

    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const files = readdirSync(inputDir);
    const imageFiles = files.filter(file => {
      const ext = extname(file).toLowerCase().substring(1);
      return extensions.includes(ext);
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
