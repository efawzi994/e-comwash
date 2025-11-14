const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('desktop', { /* add safe APIs if needed */ });
