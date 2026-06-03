/**
 * 为 electron-builder / @electron/get 设置国内镜像（npmmirror）。
 * 若环境变量已存在则尊重调用方配置，便于海外 CI 直连 GitHub。
 */
const ELECTRON_MIRROR_DEFAULT = "https://npmmirror.com/mirrors/electron/";
const ELECTRON_BUILDER_BINARIES_MIRROR_DEFAULT =
  "https://npmmirror.com/mirrors/electron-builder-binaries/";

if (!process.env.ELECTRON_MIRROR) {
  process.env.ELECTRON_MIRROR = ELECTRON_MIRROR_DEFAULT;
}
if (!process.env.ELECTRON_BUILDER_BINARIES_MIRROR) {
  process.env.ELECTRON_BUILDER_BINARIES_MIRROR = ELECTRON_BUILDER_BINARIES_MIRROR_DEFAULT;
}

module.exports = {
  ELECTRON_MIRROR_DEFAULT,
  ELECTRON_BUILDER_BINARIES_MIRROR_DEFAULT,
};
