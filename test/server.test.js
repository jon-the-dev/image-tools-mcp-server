import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { ImageToolsServer } from '../src/index.js';

function magickAvailable() {
  try {
    execFileSync('magick', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const hasMagick = magickAvailable();

describe('ImageToolsServer over MCP', () => {
  let client;
  let server;
  let root;
  let outside;

  before(async () => {
    root = mkdtempSync(join(tmpdir(), 'image-tools-server-'));
    outside = mkdtempSync(join(tmpdir(), 'image-tools-server-outside-'));
    process.env.IMAGE_TOOLS_ALLOWED_DIRS = root;
    server = new ImageToolsServer();
    client = new Client({ name: 'test-client', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
  });

  after(async () => {
    await client.close();
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  async function callToolBody(name, args) {
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, true);
    return JSON.parse(result.content[0].text);
  }

  test('tools/list returns all seven tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, [
      'batch_optimize',
      'convert_format',
      'create_icon',
      'create_thumbnail',
      'get_image_info',
      'list_images',
      'optimize_image',
    ]);
  });

  test('unknown tool rejects with MethodNotFound', async () => {
    await assert.rejects(
      client.callTool({ name: 'no_such_tool', arguments: {} }),
      (error) => {
        assert.ok(error instanceof McpError);
        assert.equal(error.code, ErrorCode.MethodNotFound);
        return true;
      }
    );
  });

  test('tool failure resolves as an isError result with the error envelope', async () => {
    const result = await client.callTool({
      name: 'optimize_image',
      arguments: {
        inputPath: join(root, 'does-not-exist.png'),
        outputPath: join(root, 'out.png'),
      },
    });
    assert.equal(result.isError, true);
    const body = JSON.parse(result.content[0].text);
    assert.equal(body.success, false);
    assert.equal(typeof body.error, 'string');
    assert.ok(body.error.length > 0);
    assert.ok(!body.error.includes('    at '), 'error must not include a stack trace');
  });

  test('path outside IMAGE_TOOLS_ALLOWED_DIRS is an isError result', async () => {
    const imagePath = join(outside, 'secret.png');
    const body = await callToolBody('get_image_info', { imagePath });
    assert.equal(body.success, false);
    assert.match(body.error, /^imagePath .*secret\.png.* is outside the allowed directories/);
    assert.match(body.error, /Set IMAGE_TOOLS_ALLOWED_DIRS to permit it\./);
  });

  test('convert_format validation failures are isError results', async () => {
    const body = await callToolBody('convert_format', {
      inputPath: join(root, 'in.png'), outputPath: join(root, 'out.png'), format: 'webp',
    });
    assert.equal(body.error, 'outputPath extension .png does not match format webp');
  });

  const skipNoMagick = { skip: !hasMagick && 'magick not installed' };

  test('successful call has no isError', skipNoMagick, async () => {
    const imagePath = join(root, 'red.png');
    execFileSync('magick', ['-size', '8x8', 'xc:red', imagePath]);
    const result = await client.callTool({
      name: 'get_image_info',
      arguments: { imagePath },
    });
    assert.ok(!result.isError);
    const body = JSON.parse(result.content[0].text);
    assert.equal(body.success, true);
    assert.equal(body.imageInfo.width, 8);
    assert.equal(body.imageInfo.height, 8);
  });
});
