import { listen } from '@uddeepto/common';
import { createServiceApp } from './app.js';
const app = createServiceApp();
listen(app, process.env.JOBS_PORT || 4007, "jobs");
