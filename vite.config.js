import path, { resolve } from 'node:path';

import { partytownVite } from '@builder.io/partytown/utils';
import legacy from '@vitejs/plugin-legacy';

import _config from './_config.js';

const HOST = _config.server.host;
const PORT = _config.server.port;

export default {
  server: {
    host: HOST,
    port: PORT
  },
  plugins: [
    legacy(),
    partytownVite({
      dest: path.join(__dirname, 'dist', '~partytown')
    })
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        search: resolve(__dirname, 'search.html'),
        thread: resolve(__dirname, 'thread.html')
      }
    }
  }
};
