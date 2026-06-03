import { nativeImage, type NativeImage } from "electron";

/** 16×16 品牌色占位托盘图标；正式资源就绪后由 resources/icon.png 覆盖 */
export function createPlaceholderTrayIcon(): NativeImage {
  const size = 16;
  const r = 79;
  const g = 70;
  const b = 229;
  const a = 255;
  const buffer = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const offset = i * 4;
    buffer[offset] = r;
    buffer[offset + 1] = g;
    buffer[offset + 2] = b;
    buffer[offset + 3] = a;
  }
  return nativeImage.createFromBitmap(buffer, { width: size, height: size });
}
