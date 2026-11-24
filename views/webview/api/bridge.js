/** Own the VS Code webview API and message transport. */
export function createBridge(api) {
  return {
    send: message => api.postMessage(message),
    load: () => api.getState() || {},
    save: state => api.setState(state),
    onSnapshot(handler) {
      window.addEventListener("message", event => {
        const data = event.data;
        if (data?.type === "snapshot" && Number.isSafeInteger(data.revision) && Array.isArray(data.files)) handler(data);
      });
    },
  };
}
