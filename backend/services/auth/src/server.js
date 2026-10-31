import { listen } from '@uddeepto/common';
import { createServiceApp } from './app.js';
const app = createServiceApp();
listen(app, process.env.AUTH_PORT || 4001, "auth");
