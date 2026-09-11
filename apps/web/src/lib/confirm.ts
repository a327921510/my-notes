import type { App } from "antd";
import type { ModalFuncProps } from "antd/es/modal";

type ModalApi = ReturnType<typeof App.useApp>["modal"];

/**
 * antd 的 modal.confirm 返回实例而非 Promise，危险操作里需要等用户选择，
 * 统一在这里包成布尔 Promise。
 */
export function confirmAsync(modal: ModalApi, props: ModalFuncProps): Promise<boolean> {
  return new Promise((resolve) => {
    modal.confirm({
      ...props,
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}
