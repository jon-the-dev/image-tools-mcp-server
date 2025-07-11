# Setup Guide

## Quick Start

1. **Install ImageMagick**
   ```bash
   # macOS
   brew install imagemagick
   
   # Verify installation
   magick -version
   ```

2. **Install the MCP server**
   ```bash
   # Option 1: Install globally (recommended)
   npm install -g image-tools-mcp-server
   
   # Option 2: Run directly with npx (no installation)
   npx image-tools-mcp-server
   
   # Option 3: Install from source
   git clone https://github.com/jon-the-dev/image-tools-mcp-server.git
   cd image-tools-mcp-server
   npm install
   ```

3. **Test the server**
   ```bash
   # If installed globally
   image-tools-mcp-server
   
   # If installed from source
   npm start
   ```

## Adding to Amazon Q CLI

1. **Locate your Q CLI configuration**
   - The configuration file is typically located at `~/.amazonq/mcp.json`
   - If it doesn't exist, create it

2. **Add the MCP server configuration**

   **If installed globally (recommended):**
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

   **If running from source:**
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

3. **Restart Q CLI**
   ```bash
   q --help
   ```

## Troubleshooting

### ImageMagick Not Found
If you get an error about ImageMagick not being found:

1. **Check if ImageMagick is installed**
   ```bash
   which magick
   magick -version
   ```

2. **Install ImageMagick if missing**
   ```bash
   # macOS with Homebrew
   brew install imagemagick
   
   # macOS with MacPorts
   sudo port install ImageMagick
   
   # Ubuntu/Debian
   sudo apt-get install imagemagick
   ```

3. **Check PATH**
   Make sure ImageMagick is in your PATH:
   ```bash
   echo $PATH
   ```

### Permission Issues
If you encounter permission errors:

1. **Check file permissions**
   ```bash
   ls -la /path/to/your/images/
   ```

2. **Ensure output directories are writable**
   ```bash
   mkdir -p /path/to/output/directory
   chmod 755 /path/to/output/directory
   ```

### Node.js Version Issues
This server requires Node.js 18.0.0 or higher:

```bash
node --version
```

If you need to upgrade Node.js:
- Use [nvm](https://github.com/nvm-sh/nvm) for version management
- Or download from [nodejs.org](https://nodejs.org/)

## Testing the Installation

Create a test image and try the optimization:

```bash
# Create a test directory
mkdir -p ~/test-images/input ~/test-images/output

# Download a test image (or copy one you have)
curl -o ~/test-images/input/test.jpg "https://via.placeholder.com/1920x1080/0000FF/FFFFFF?text=Test+Image"

# Test through Q CLI
q chat "Optimize the image at ~/test-images/input/test.jpg and save it to ~/test-images/output/test-optimized.jpg"
```

## Configuration Options

### Quality Settings
- **High Quality (90-100)**: Minimal compression, larger files
- **Good Quality (80-90)**: Balanced compression and quality
- **Web Quality (70-80)**: Good for web use, smaller files
- **Low Quality (50-70)**: High compression, smaller files

### Thumbnail Settings
- **Maintain Aspect Ratio**: Prevents distortion but may not fill exact dimensions
- **Crop to Fit**: Ensures exact dimensions but may crop parts of the image
- **Force Dimensions**: May distort the image to fit exact dimensions

### Batch Processing
- Process files sequentially to avoid memory issues
- Monitor disk space for large batches
- Use appropriate extensions filter to process only desired formats
