// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { AnyARecord } from 'dns';
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels = 'ipc-example';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
    getAds(adType: string) {
      console.log('Type in preload', adType);
      return ipcRenderer.invoke('get-ads', adType);
    },

    renewAds(ads: string, pause: number, adType: any) {
      return ipcRenderer.invoke('renew-ads', ads, pause, adType);
    },

    checkUpdateStatus() {
      return ipcRenderer.invoke('check-update-status');
    },

    // Development testing function
    devTriggerUpdate() {
      return ipcRenderer.invoke('dev-trigger-update');
    },
  },
  store: {
    get(key: any) {
      return ipcRenderer.sendSync('electron-store-get', key);
    },
    set(property: any, val: any) {
      ipcRenderer.send('electron-store-set', property, val);
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

contextBridge.exposeInMainWorld('electronAPI', {
  test: () => ipcRenderer.invoke('test'),
});

export type ElectronHandler = typeof electronHandler;
