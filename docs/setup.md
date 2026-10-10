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

   **If using npx (recommended - no installation required):**
   ```json
   {
     "mcpServers": {
       "image-tools": {
         "command": "npx",
         "args": ["image-tools-mcp-server"],
         "env": {
           "IMAGE_TOOLS_ALLOWED_DIRS": "/Users/you/test-images:/Users/you/Pictures"
         }
       }
     }
   }
   ```

   Set `IMAGE_TOOLS_ALLOWED_DIRS` in every variant below as well. See
   [Allowed Directories](#allowed-directories).

   **If installed globally:**
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

### "outside the allowed directories"
The path resolved (after following symlinks) to somewhere not listed in
`IMAGE_TOOLS_ALLOWED_DIRS`, or, if the variable is unset, outside the server's working directory.
Add the directory to `IMAGE_TOOLS_ALLOWED_DIRS` in your MCP client config and restart the client.

### "already exists. Pass overwrite: true"
Write tools no longer replace existing files by default. Ask for `overwrite: true` or choose a
new output path. Writing over the input file, or batch optimizing into the input directory, is
always refused.

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
This server requires Node.js 20.0.0 or higher:

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

# Make sure IMAGE_TOOLS_ALLOWED_DIRS in your MCP config includes ~/test-images (as an absolute path)

# Test through Q CLI
q chat "Optimize the image at ~/test-images/input/test.jpg and save it to ~/test-images/output/test-optimized.jpg"
```

## Configuration Options

### Allowed Directories
`IMAGE_TOOLS_ALLOWED_DIRS` is a list of directories, separated by `:` (`;` on Windows). The server
only reads, writes, lists, and creates directories inside them. Each entry must exist when a tool
runs. Relative entries resolve against the server's working directory, so use absolute paths.

If the variable is unset, only the server's working directory is allowed. Many MCP clients launch
servers with a working directory of `/` or of the client's own install folder, which makes that
default either useless or far too broad. Set the variable explicitly.

### Overwriting Files
`optimize_image`, `create_thumbnail`, `create_icon`, `convert_format` and `batch_optimize` accept
`overwrite` (default `false`). Without it, an existing output file is left alone and the call
fails. Even with it, the output can't be the input file, and `batch_optimize` can't write into
its own `inputDir`. Output files must use a supported image extension (jpg, jpeg, png, webp, gif,
bmp, tif, tiff, ico).

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
