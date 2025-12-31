const { ipcRenderer } = require('electron');

function initAutoUpdate(updateObj) {
    const { updateNotification, updateMessage, restartButton } = updateObj;

    ipcRenderer.on('update_available', () => {
        ipcRenderer.removeAllListeners('update_available');
        updateMessage.innerText = 'A new update is available. Downloading now...';
        updateNotification.classList.remove('hidden');
    });

    ipcRenderer.on('update_downloaded', () => {
        ipcRenderer.removeAllListeners('update_downloaded');
        updateMessage.innerText = 'Update Downloaded. Restart to install.';
        restartButton.classList.remove('hidden');
        updateNotification.classList.remove('hidden');
    });

    ipcRenderer.on('download_progress', (event, progress) => {
        if (updateMessage) updateMessage.innerText = 'Downloading update: ' + Math.round(progress) + '%';
    });

    ipcRenderer.on('update_message', (event, message) => {
        console.log('AutoUpdate:', message);
        if (message.startsWith('Error')) {
            if (updateMessage) updateMessage.innerText = message;
            updateNotification.classList.remove('hidden');
            setTimeout(() => {
                if (updateNotification && restartButton.classList.contains('hidden')) {
                    updateNotification.classList.add('hidden');
                }
            }, 10000);
        }
    });

    // Return control functions
    return {
        closeUpdateNotification: () => {
            updateNotification.classList.add('hidden');
        },
        restartApp: () => {
            ipcRenderer.send('restart_app');
        }
    };
}

module.exports = {
    initAutoUpdate
};
