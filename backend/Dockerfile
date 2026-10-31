FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY packages/common/package.json packages/common/package.json
COPY infrastructure/gateway/package.json infrastructure/gateway/package.json
COPY infrastructure/loadbalancer/package.json infrastructure/loadbalancer/package.json
COPY services/auth/package.json services/auth/package.json
COPY services/users/package.json services/users/package.json
COPY services/courses/package.json services/courses/package.json
COPY services/community/package.json services/community/package.json
COPY services/contests/package.json services/contests/package.json
COPY services/webinars/package.json services/webinars/package.json
COPY services/jobs/package.json services/jobs/package.json
COPY services/messages/package.json services/messages/package.json
COPY services/payments/package.json services/payments/package.json
COPY services/frontend/package.json services/frontend/package.json
RUN npm install --omit=dev
COPY . .
USER node
