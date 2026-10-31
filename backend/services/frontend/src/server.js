import { listen, attachRealtime } from '@uddeepto/common';
import { createServiceApp } from './app.js';
import { realtimeOptions } from './realtime.js';
const app = createServiceApp();
const server = listen(app, process.env.FRONTEND_API_PORT || 4010, "frontend-api");
attachRealtime(server, realtimeOptions);
