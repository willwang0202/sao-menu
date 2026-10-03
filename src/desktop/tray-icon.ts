import { nativeImage } from 'electron';
import path from 'node:path';

/** Use the original executable's icon image, retained by the resource importer. */
export function createTrayIcon() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '../resources/icon.png'));
  if (icon.isEmpty()) throw new Error('Import the original SAO Utils 2 icon before building.');
  return icon.resize({ width: 18, height: 18 });
}
