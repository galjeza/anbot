/**
 * updater.ts
 *
 * Please use manual update only when it is really required, otherwise please use recommended non-intrusive auto update.
 */
import { dialog, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';

let updater: any;
export let updateAvailable = false;
autoUpdater.autoDownload = false;

autoUpdater.on('error', (error) => {
  dialog.showErrorBox(
    'Error: ',
    error == null ? 'unknown' : (error.stack || error).toString(),
  );
});

autoUpdater.on('update-available', () => {
  updateAvailable = true;
  dialog
    .showMessageBox({
      type: 'info',
      title: 'Nova verzija na voljo',
      message:
        'Na voljo je nova verzija programa. Ali jo želite namestiti zdaj?',
      buttons: ['Da', 'Ne'],
    })
    .then(async (buttonIndex) => {
      if (buttonIndex.response === 0) {
        try {
          await autoUpdater.checkForUpdates();
          await autoUpdater.downloadUpdate();
        } catch (error) {
          console.error('Error downloading update:', error);
          dialog.showErrorBox(
            'Napaka pri posodobitvi',
            'Prišlo je do napake pri prenosu posodobitve. Prosimo, poskusite ponovno.',
          );
        }
      }
      if (updater) {
        updater.enabled = true;
        updater = null;
      }
    });
});

autoUpdater.on('update-not-available', () => {
  updateAvailable = false;
  dialog.showMessageBox({
    title: 'Ni posodobitev',
    message: 'Uporabljate najnovejšo verzijo programa.',
  });
  if (updater) {
    updater.enabled = true;
    updater = null;
  }
});

autoUpdater.on('update-downloaded', () => {
  dialog
    .showMessageBox({
      title: 'Namestitev posodobitve',
      message:
        'Posodobitev je pripravljena. Program se bo zdaj zaprl in posodobil...',
    })
    .then(() => {
      setImmediate(() => autoUpdater.quitAndInstall());
    });
});

// export this to MenuItem click callback
export function checkForUpdates(menuItem: any, focusedWindow: any, event: any) {
  updater = menuItem;
  updater.enabled = false;
  autoUpdater.checkForUpdates();
}
