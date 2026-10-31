import { listen } from '@uddeepto/common';
import { createServiceApp } from './app.js';
const app = createServiceApp();
listen(app, process.env.MESSAGES_PORT || 4008, "messages");
