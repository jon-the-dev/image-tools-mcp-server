# Image Tools MCP Server

A Model Context Protocol (MCP) server that provides powerful image processing capabilities using ImageMagick. This server enables AI assistants to perform image optimization, thumbnail generation, format conversion, and batch processing operations.

## Quick Install

```bash
# Install globally
npm install -g image-tools-mcp-server

# Or run directly without installing
npx image-tools-mcp-server
```

Then add to your Q CLI MCP configuration:
```json
{
  "mcpServers": {
    "image-tools": {
      "command": "image-tools-mcp-server",
      "args": [],
      "env": {}
    }
  }
}
```

## Features

- **Image Optimization**: Reduce file sizes while maintaining quality
- **Thumbnail Generation**: Create thumbnails with flexible sizing options
- **Icon Creation**: Generate icons in standard sizes (16x16, 32x32, 64x64, 128x128, 256x256)
- **Format Conversion**: Convert between popular image formats (JPG, PNG, WebP, GIF, BMP, TIFF, ICO)
- **Image Information**: Extract detailed metadata and properties
- **Batch Processing**: Process multiple images in directories

## Prerequisites

### ImageMagick Installation

This server requires ImageMagick to be installed on your system.

#### macOS
```bash
# Using Homebrew
brew install imagemagick

# Using MacPorts
sudo port install ImageMagick
```

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install imagemagick
```

#### Windows
Download and install from: https://imagemagick.org/script/download.php#windows

#### Verify Installation
```bash
magick -version
```

### Node.js
Requires Node.js 18.0.0 or higher.

## Installation

### Option 1: Install via npm (Recommended)

```bash
# Install globally
npm install -g image-tools-mcp-server

# Or run directly with npx (no installation required)
npx image-tools-mcp-server
```

### Option 2: Install from source

1. Clone the repository:
```bash
git clone https://github.com/jon-the-dev/image-tools-mcp-server.git
cd image-tools-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Test the installation:
```bash
npm start
```

## Configuration

### Adding to Q CLI

To use this MCP server with Amazon Q CLI, add it to your MCP configuration:

#### If installed globally:
```json
{
  "mcpServers": {
    "image-tools": {
      "command": "image-tools-mcp-server",
      "args": [],
      "env": {}
    }
  }
}
```

#### If running from source:
```json
{
  "mcpServers": {
    "image-tools": {
      "command": "node",
      "args": ["/path/to/image-tools-mcp-server/src/index.js"],
      "env": {}
    }
  }
}
```

### Environment Variables

No environment variables are required for basic operation.

## Available Tools

### 1. optimize_image

Optimize an image to reduce file size while maintaining quality.

**Parameters:**
- `inputPath` (required): Path to the input image file
- `outputPath` (required): Path for the optimized output image
- `quality` (optional): Quality level (1-100, default: 85)
- `maxWidth` (optional): Maximum width in pixels
- `maxHeight` (optional): Maximum height in pixels

**Example:**
```javascript
{
  "inputPath": "/path/to/image.jpg",
  "outputPath": "/path/to/optimized.jpg",
  "quality": 80,
  "maxWidth": 1920,
  "maxHeight": 1080
}
```

### 2. create_thumbnail

Create a thumbnail from an image with specified dimensions.

**Parameters:**
- `inputPath` (required): Path to the input image file
- `outputPath` (required): Path for the thumbnail output
- `width` (required): Thumbnail width in pixels
- `height` (required): Thumbnail height in pixels
- `maintainAspectRatio` (optional): Whether to maintain aspect ratio (default: true)
- `cropToFit` (optional): Whether to crop to fit exact dimensions (default: false)

**Example:**
```javascript
{
  "inputPath": "/path/to/image.jpg",
  "outputPath": "/path/to/thumbnail.jpg",
  "width": 300,
  "height": 200,
  "maintainAspectRatio": true,
  "cropToFit": false
}
```

### 3. create_icon

Create icons in standard sizes from an image.

**Parameters:**
- `inputPath` (required): Path to the input image file
- `outputDir` (required): Directory to save icon files
- `sizes` (optional): Array of icon sizes to generate (default: [16, 32, 64, 128, 256])
- `format` (optional): Output format (png, ico, default: png)

**Example:**
```javascript
{
  "inputPath": "/path/to/logo.png",
  "outputDir": "/path/to/icons/",
  "sizes": [16, 32, 64, 128, 256],
  "format": "png"
}
```

### 4. convert_format

Convert an image from one format to another.

**Parameters:**
- `inputPath` (required): Path to the input image file
- `outputPath` (required): Path for the converted output image
- `format` (required): Target format (jpg, png, webp, gif, bmp, tiff)
- `quality` (optional): Quality level for lossy formats (1-100, default: 90)

**Example:**
```javascript
{
  "inputPath": "/path/to/image.png",
  "outputPath": "/path/to/image.webp",
  "format": "webp",
  "quality": 85
}
```

### 5. get_image_info

Get detailed information about an image file.

**Parameters:**
- `imagePath` (required): Path to the image file

**Example:**
```javascript
{
  "imagePath": "/path/to/image.jpg"
}
```

### 6. batch_optimize

Optimize multiple images in a directory.

**Parameters:**
- `inputDir` (required): Directory containing images to optimize
- `outputDir` (required): Directory to save optimized images
- `quality` (optional): Quality level (1-100, default: 85)
- `maxWidth` (optional): Maximum width in pixels
- `maxHeight` (optional): Maximum height in pixels
- `extensions` (optional): File extensions to process (default: [jpg, jpeg, png, webp])

**Example:**
```javascript
{
  "inputDir": "/path/to/input/images/",
  "outputDir": "/path/to/output/images/",
  "quality": 80,
  "maxWidth": 1920,
  "extensions": ["jpg", "jpeg", "png", "webp"]
}
```

## Usage Examples

### Basic Image Optimization
```bash
# After installing and configuring with Q CLI
q chat "Optimize the image at /Users/jon/photos/vacation.jpg and save it to /Users/jon/photos/vacation-optimized.jpg with 80% quality"
```

### Creating Thumbnails
```bash
q chat "Create a 300x200 thumbnail from /Users/jon/photos/landscape.jpg and save it to /Users/jon/photos/landscape-thumb.jpg"
```

### Batch Processing
```bash
q chat "Optimize all images in /Users/jon/photos/raw/ and save them to /Users/jon/photos/optimized/ with 85% quality"
```

### Getting Started
1. Install: `npm install -g image-tools-mcp-server`
2. Configure with Q CLI (see configuration section above)
3. Start using: `q chat "Get image info for any image file"`

## Development

### Running in Development Mode
```bash
npm run dev
```

### Project Structure
```
image-tools-mcp-server/
├── src/
│   ├── index.js           # Main MCP server
│   └── imageProcessor.js  # ImageMagick wrapper
├── docs/                  # Documentation
├── package.json
├── README.md
└── .gitignore
```

### Adding New Features

1. Add new tool definitions in `src/index.js`
2. Implement the processing logic in `src/imageProcessor.js`
3. Add corresponding handler methods in the main server class
4. Update documentation

## Error Handling

The server includes comprehensive error handling for:
- Missing ImageMagick installation
- Invalid file paths
- Unsupported image formats
- Processing failures
- Directory creation issues

## Performance Considerations

- Large images may take significant time to process
- Batch operations process files sequentially to avoid memory issues
- Consider using appropriate quality settings to balance file size and image quality
- Monitor disk space when processing large batches

## Supported Image Formats

**Input formats:** JPG, JPEG, PNG, WebP, GIF, BMP, TIFF, ICO
**Output formats:** JPG, JPEG, PNG, WebP, GIF, BMP, TIFF, ICO

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and feature requests, please create an issue in the GitHub repository.
