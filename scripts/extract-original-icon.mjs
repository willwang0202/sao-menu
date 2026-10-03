import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

// Parse PE resource-directory metadata only. Never load, execute, or disassemble
// the Windows image. Layout: https://learn.microsoft.com/windows/win32/debug/pe-format
export function originalIconFrames(image) {
  const range = (offset, size) => {
    if (!Number.isInteger(offset) || offset < 0 || size < 0 || offset + size > image.length) throw new Error('Invalid PE resource bounds.');
    return offset;
  };
  const u16 = offset => image.readUInt16LE(range(offset, 2));
  const u32 = offset => image.readUInt32LE(range(offset, 4));
  if (u16(0) !== 0x5a4d) throw new Error('The original executable has no DOS image header.');
  const pe = u32(0x3c);
  if (u32(pe) !== 0x00004550) throw new Error('The original executable has no PE signature.');
  const count = u16(pe + 6);
  if (count > 96) throw new Error('The PE section count is invalid.');
  const optionalSize = u16(pe + 20);
  const optional = pe + 24;
  range(optional, optionalSize);
  const magic = u16(optional);
  const directories = magic === 0x20b ? 112 : magic === 0x10b ? 96 : 0;
  if (!directories || optionalSize < directories + 24 || u32(optional + directories - 4) < 3) throw new Error('The image has no supported resource data directory.');
  const resourceRva = u32(optional + directories + 16);
  const resourceSize = u32(optional + directories + 20);
  if (!resourceRva || resourceSize < 16) throw new Error('The image contains no resources.');
  const sections = Array.from({ length: count }, (_, index) => {
    const offset = range(optional + optionalSize + index * 40, 40);
    return { virtual: u32(offset + 12), size: u32(offset + 16), raw: u32(offset + 20) };
  });
  function fileOffset(rva, size) {
    const section = sections.find(section => rva >= section.virtual && rva - section.virtual + size <= section.size);
    if (!section) throw new Error('The resource points outside the image section data.');
    return range(section.raw + rva - section.virtual, size);
  }
  const base = fileOffset(resourceRva, 16);
  function resourceOffset(relative, size) {
    if (relative < 0 || relative + size > resourceSize) throw new Error('The resource table offset is invalid.');
    return range(base + relative, size);
  }
  function entries(relative) {
    const offset = resourceOffset(relative, 16);
    const entryCount = u16(offset + 12) + u16(offset + 14);
    if (entryCount > 4096) throw new Error('The resource directory is too large.');
    resourceOffset(relative + 16, entryCount * 8);
    return Array.from({ length: entryCount }, (_, index) => {
      const offset = base + relative + 16 + index * 8;
      const name = u32(offset);
      const target = u32(offset + 4);
      return { id: name & 0x80000000 ? null : name, directory: Boolean(target & 0x80000000), offset: target & 0x7fffffff };
    });
  }
  const iconType = entries(0).find(entry => entry.id === 3 && entry.directory); // RT_ICON
  if (!iconType) throw new Error('The original executable contains no RT_ICON resources.');
  const visited = new Set();
  const frames = [];
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  function visit(relative, ids, depth) {
    if (depth > 3 || visited.has(relative)) return;
    visited.add(relative);
    for (const entry of entries(relative)) {
      const resourceIds = [...ids, entry.id];
      if (entry.directory) { visit(entry.offset, resourceIds, depth + 1); continue; }
      const record = resourceOffset(entry.offset, 16);
      const size = u32(record + 4);
      if (size < 33 || size > 16 * 1024 * 1024) continue;
      const offset = fileOffset(u32(record), size);
      const payload = image.subarray(offset, offset + size);
      if (!payload.subarray(0, 8).equals(pngSignature) || payload.toString('ascii', 12, 16) !== 'IHDR') continue;
      const width = payload.readUInt32BE(16);
      const height = payload.readUInt32BE(20);
      if (width < 1 || height < 1 || width > 4096 || height > 4096) continue;
      frames.push({ width, height, ids: resourceIds, png: payload });
    }
  }
  visit(iconType.offset, [], 0);
  return frames.sort((left, right) => right.width * right.height - left.width * left.height || right.png.length - left.png.length);
}

export async function extractOriginalIcon(bundle, output = fileURLToPath(new URL('../resources/icon.png', import.meta.url))) {
  if (typeof bundle !== 'string' || !bundle) throw new Error('Pass the original SAO Utils 2 Steam directory.');
  const executable = path.join(path.resolve(bundle), 'win64', 'SAO Utils.exe');
  const info = await stat(executable);
  if (!info.isFile() || info.size > 256 * 1024 * 1024) throw new Error('The original executable has an unsupported file size.');
  const frames = originalIconFrames(await readFile(executable));
  const frame = frames[0];
  if (!frame) throw new Error('No PNG RT_ICON frame exists in SAO Utils.exe. No substitute artwork was generated.');
  const target = path.resolve(output);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, frame.png);
  // macOS accepts the original 256px PNG frame in an ic08 ICNS container.
  // This preserves the image bytes rather than inventing a 512px replacement.
  const iconChunk = Buffer.alloc(8);
  iconChunk.write('ic08'); iconChunk.writeUInt32BE(frame.png.length + 8, 4);
  const iconHeader = Buffer.alloc(8);
  iconHeader.write('icns'); iconHeader.writeUInt32BE(frame.png.length + 16, 4);
  await writeFile(path.join(path.dirname(target), 'icon.icns'), Buffer.concat([iconHeader, iconChunk, frame.png]));
  return {
    executable, output: target, width: frame.width, height: frame.height,
    resourceIds: frame.ids, pngFrames: frames.length,
    sha256: createHash('sha256').update(frame.png).digest('hex'),
  };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  if (!process.argv[2]) {
    console.error('Usage: node scripts/extract-original-icon.mjs <SAO Utils 2 Steam directory> [output.png]');
    process.exitCode = 1;
  } else {
    try { console.log(JSON.stringify(await extractOriginalIcon(process.argv[2], process.argv[3]), null, 2)); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
