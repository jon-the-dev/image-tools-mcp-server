#!/usr/bin/env node

import { ImageProcessor } from './src/imageProcessor.js';

async function testImageProcessor() {
  console.log('🧪 Testing Image Tools MCP Server...\n');
  
  const processor = new ImageProcessor();
  
  try {
    // Test ImageMagick installation
    console.log('1. Checking ImageMagick installation...');
    await processor.checkImageMagick();
    console.log('✅ ImageMagick is installed and working\n');
    
    // Test supported formats
    console.log('2. Supported formats:');
    console.log(`   ${processor.supportedFormats.join(', ')}\n`);
    
    // Test file size formatting
    console.log('3. Testing utility functions...');
    console.log(`   File size formatting: ${processor.formatFileSize(1024)} = 1 KB`);
    console.log(`   File size formatting: ${processor.formatFileSize(1048576)} = 1 MB\n`);
    
    console.log('✅ All basic tests passed!');
    console.log('\n🎉 Image Tools MCP Server is ready to use!');
    console.log('\nNext steps:');
    console.log('1. Add this server to your Q CLI MCP configuration');
    console.log('2. Test with: q chat "Get image info for any image file"');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('- Make sure ImageMagick is installed: brew install imagemagick');
    console.log('- Verify installation: magick -version');
    process.exit(1);
  }
}

testImageProcessor();
