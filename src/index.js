#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { ImageProcessor } from './imageProcessor.js';

class ImageToolsServer {
  constructor() {
    this.server = new Server(
      {
        name: 'image-tools-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.imageProcessor = new ImageProcessor();
    this.setupToolHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'optimize_image',
            description: 'Optimize an image to reduce file size while maintaining quality',
            inputSchema: {
              type: 'object',
              properties: {
                inputPath: {
                  type: 'string',
                  description: 'Path to the input image file',
                },
                outputPath: {
                  type: 'string',
                  description: 'Path for the optimized output image',
                },
                quality: {
                  type: 'number',
                  description: 'Quality level (1-100, default: 85)',
                  minimum: 1,
                  maximum: 100,
                  default: 85,
                },
                maxWidth: {
                  type: 'number',
                  description: 'Maximum width in pixels (optional)',
                },
                maxHeight: {
                  type: 'number',
                  description: 'Maximum height in pixels (optional)',
                },
              },
              required: ['inputPath', 'outputPath'],
            },
          },
          {
            name: 'create_thumbnail',
            description: 'Create a thumbnail from an image with specified dimensions',
            inputSchema: {
              type: 'object',
              properties: {
                inputPath: {
                  type: 'string',
                  description: 'Path to the input image file',
                },
                outputPath: {
                  type: 'string',
                  description: 'Path for the thumbnail output',
                },
                width: {
                  type: 'number',
                  description: 'Thumbnail width in pixels',
                },
                height: {
                  type: 'number',
                  description: 'Thumbnail height in pixels',
                },
                maintainAspectRatio: {
                  type: 'boolean',
                  description: 'Whether to maintain aspect ratio (default: true)',
                  default: true,
                },
                cropToFit: {
                  type: 'boolean',
                  description: 'Whether to crop to fit exact dimensions (default: false)',
                  default: false,
                },
              },
              required: ['inputPath', 'outputPath', 'width', 'height'],
            },
          },
          {
            name: 'create_icon',
            description: 'Create icons in standard sizes (16x16, 32x32, 64x64, 128x128, 256x256)',
            inputSchema: {
              type: 'object',
              properties: {
                inputPath: {
                  type: 'string',
                  description: 'Path to the input image file',
                },
                outputDir: {
                  type: 'string',
                  description: 'Directory to save icon files',
                },
                sizes: {
                  type: 'array',
                  items: {
                    type: 'number',
                  },
                  description: 'Array of icon sizes to generate (default: [16, 32, 64, 128, 256])',
                  default: [16, 32, 64, 128, 256],
                },
                format: {
                  type: 'string',
                  description: 'Output format (png, ico, default: png)',
                  enum: ['png', 'ico'],
                  default: 'png',
                },
              },
              required: ['inputPath', 'outputDir'],
            },
          },
          {
            name: 'convert_format',
            description: 'Convert an image from one format to another',
            inputSchema: {
              type: 'object',
              properties: {
                inputPath: {
                  type: 'string',
                  description: 'Path to the input image file',
                },
                outputPath: {
                  type: 'string',
                  description: 'Path for the converted output image',
                },
                format: {
                  type: 'string',
                  description: 'Target format (jpg, png, webp, gif, bmp, tiff)',
                  enum: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff'],
                },
                quality: {
                  type: 'number',
                  description: 'Quality level for lossy formats (1-100, default: 90)',
                  minimum: 1,
                  maximum: 100,
                  default: 90,
                },
              },
              required: ['inputPath', 'outputPath', 'format'],
            },
          },
          {
            name: 'get_image_info',
            description: 'Get detailed information about an image file',
            inputSchema: {
              type: 'object',
              properties: {
                imagePath: {
                  type: 'string',
                  description: 'Path to the image file',
                },
              },
              required: ['imagePath'],
            },
          },
          {
            name: 'batch_optimize',
            description: 'Optimize multiple images in a directory',
            inputSchema: {
              type: 'object',
              properties: {
                inputDir: {
                  type: 'string',
                  description: 'Directory containing images to optimize',
                },
                outputDir: {
                  type: 'string',
                  description: 'Directory to save optimized images',
                },
                quality: {
                  type: 'number',
                  description: 'Quality level (1-100, default: 85)',
                  minimum: 1,
                  maximum: 100,
                  default: 85,
                },
                maxWidth: {
                  type: 'number',
                  description: 'Maximum width in pixels (optional)',
                },
                maxHeight: {
                  type: 'number',
                  description: 'Maximum height in pixels (optional)',
                },
                extensions: {
                  type: 'array',
                  items: {
                    type: 'string',
                  },
                  description: 'File extensions to process (default: [jpg, jpeg, png, webp])',
                  default: ['jpg', 'jpeg', 'png', 'webp'],
                },
              },
              required: ['inputDir', 'outputDir'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'optimize_image':
            return await this.handleOptimizeImage(args);
          case 'create_thumbnail':
            return await this.handleCreateThumbnail(args);
          case 'create_icon':
            return await this.handleCreateIcon(args);
          case 'convert_format':
            return await this.handleConvertFormat(args);
          case 'get_image_info':
            return await this.handleGetImageInfo(args);
          case 'batch_optimize':
            return await this.handleBatchOptimize(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing ${name}: ${error.message}`
        );
      }
    });
  }

  async handleOptimizeImage(args) {
    const result = await this.imageProcessor.optimizeImage(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async handleCreateThumbnail(args) {
    const result = await this.imageProcessor.createThumbnail(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async handleCreateIcon(args) {
    const result = await this.imageProcessor.createIcon(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async handleConvertFormat(args) {
    const result = await this.imageProcessor.convertFormat(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async handleGetImageInfo(args) {
    const result = await this.imageProcessor.getImageInfo(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async handleBatchOptimize(args) {
    const result = await this.imageProcessor.batchOptimize(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Image Tools MCP server running on stdio');
  }
}

const server = new ImageToolsServer();
server.run().catch(console.error);
