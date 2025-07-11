# API Documentation

## Tool Reference

### optimize_image

Optimize an image to reduce file size while maintaining visual quality.

**Input Schema:**
```json
{
  "inputPath": "string (required)",
  "outputPath": "string (required)", 
  "quality": "number (optional, 1-100, default: 85)",
  "maxWidth": "number (optional)",
  "maxHeight": "number (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "inputPath": "/path/to/input.jpg",
  "outputPath": "/path/to/output.jpg",
  "originalSize": "2.5 MB",
  "optimizedSize": "1.8 MB",
  "compressionRatio": "28.00%",
  "savedBytes": "700 KB",
  "quality": 85,
  "maxWidth": 1920,
  "maxHeight": 1080,
  "command": "magick input.jpg -resize 1920x1080> -quality 85 -strip -interlace Plane output.jpg"
}
```

### create_thumbnail

Create a thumbnail with specified dimensions.

**Input Schema:**
```json
{
  "inputPath": "string (required)",
  "outputPath": "string (required)",
  "width": "number (required)",
  "height": "number (required)",
  "maintainAspectRatio": "boolean (optional, default: true)",
  "cropToFit": "boolean (optional, default: false)"
}
```

**Response:**
```json
{
  "success": true,
  "inputPath": "/path/to/input.jpg",
  "outputPath": "/path/to/thumbnail.jpg",
  "dimensions": "300x200",
  "maintainAspectRatio": true,
  "cropToFit": false,
  "fileSize": "45 KB",
  "command": "magick input.jpg -resize 300x200> thumbnail.jpg"
}
```

### create_icon

Generate icons in multiple standard sizes.

**Input Schema:**
```json
{
  "inputPath": "string (required)",
  "outputDir": "string (required)",
  "sizes": "array of numbers (optional, default: [16, 32, 64, 128, 256])",
  "format": "string (optional, 'png' or 'ico', default: 'png')"
}
```

**Response:**
```json
{
  "success": true,
  "inputPath": "/path/to/logo.png",
  "outputDir": "/path/to/icons/",
  "format": "png",
  "icons": [
    {
      "size": "16x16",
      "path": "/path/to/icons/logo-16x16.png",
      "fileSize": "1.2 KB"
    },
    {
      "size": "32x32", 
      "path": "/path/to/icons/logo-32x32.png",
      "fileSize": "2.8 KB"
    }
  ]
}
```

### convert_format

Convert an image from one format to another.

**Input Schema:**
```json
{
  "inputPath": "string (required)",
  "outputPath": "string (required)",
  "format": "string (required, one of: jpg, jpeg, png, webp, gif, bmp, tiff)",
  "quality": "number (optional, 1-100, default: 90, for lossy formats)"
}
```

**Response:**
```json
{
  "success": true,
  "inputPath": "/path/to/input.png",
  "outputPath": "/path/to/output.webp",
  "format": "webp",
  "quality": 85,
  "originalSize": "1.2 MB",
  "convertedSize": "456 KB",
  "command": "magick input.png -quality 85 output.webp"
}
```

### get_image_info

Extract detailed metadata and properties from an image.

**Input Schema:**
```json
{
  "imagePath": "string (required)"
}
```

**Response:**
```json
{
  "success": true,
  "imageInfo": {
    "path": "/path/to/image.jpg",
    "fileSize": "2.5 MB",
    "fileSizeBytes": 2621440,
    "format": "JPEG",
    "dimensions": "1920x1080",
    "width": 1920,
    "height": 1080,
    "resolution": "72x72",
    "colorspace": "sRGB",
    "depth": "8-bit",
    "quality": "92"
  },
  "rawOutput": "... full ImageMagick identify output ..."
}
```

### batch_optimize

Optimize multiple images in a directory.

**Input Schema:**
```json
{
  "inputDir": "string (required)",
  "outputDir": "string (required)",
  "quality": "number (optional, 1-100, default: 85)",
  "maxWidth": "number (optional)",
  "maxHeight": "number (optional)",
  "extensions": "array of strings (optional, default: ['jpg', 'jpeg', 'png', 'webp'])"
}
```

**Response:**
```json
{
  "success": true,
  "inputDir": "/path/to/input/",
  "outputDir": "/path/to/output/",
  "totalFiles": 10,
  "processedFiles": 9,
  "failedFiles": 1,
  "totalOriginalSize": "25.6 MB",
  "totalOptimizedSize": "18.2 MB",
  "totalCompressionRatio": "28.91%",
  "totalSavedBytes": "7.4 MB",
  "results": [
    {
      "file": "image1.jpg",
      "success": true,
      "originalSize": "2.5 MB",
      "optimizedSize": "1.8 MB",
      "compressionRatio": "28.00%"
    }
  ]
}
```

## Error Handling

All tools return consistent error responses:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

Common error scenarios:
- **File not found**: Input file doesn't exist
- **Permission denied**: Cannot read input or write output
- **Invalid format**: Unsupported image format
- **ImageMagick not found**: ImageMagick not installed or not in PATH
- **Processing failed**: ImageMagick command failed

## ImageMagick Commands

The server uses these ImageMagick commands internally:

### Optimization
```bash
magick "input.jpg" -resize "1920x1080>" -quality 85 -strip -interlace Plane "output.jpg"
```

### Thumbnail (maintain aspect ratio)
```bash
magick "input.jpg" -resize "300x200>" "thumbnail.jpg"
```

### Thumbnail (crop to fit)
```bash
magick "input.jpg" -resize "300x200^" -gravity center -crop "300x200+0+0" "thumbnail.jpg"
```

### Format conversion
```bash
magick "input.png" -quality 90 "output.webp"
```

### Image information
```bash
magick identify -verbose "image.jpg"
```

## Performance Notes

- **Large images**: Processing time increases with image size
- **Batch operations**: Files are processed sequentially to manage memory
- **Quality settings**: Higher quality = larger files, longer processing time
- **Format conversion**: Some formats (WebP, AVIF) may take longer to encode
- **Disk space**: Ensure adequate space for output files, especially for batch operations
