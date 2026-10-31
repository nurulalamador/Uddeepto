import { listen } from '@uddeepto/common';
import { createServiceApp } from './app.js';
const app = createServiceApp();
listen(app, process.env.USERS_PORT || 4002, "users");
