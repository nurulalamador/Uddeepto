import { listen } from '@uddeepto/common';
import { createServiceApp } from './app.js';
const app = createServiceApp();
listen(app, process.env.COURSES_PORT || 4003, "courses");
