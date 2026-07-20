FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/worker-session/package*.json ./apps/worker-session/
COPY apps/worker-notification/package*.json ./apps/worker-notification/
COPY apps/worker-health-sync/package*.json ./apps/worker-health-sync/
COPY apps/worker-link-checker/package*.json ./apps/worker-link-checker/
COPY apps/worker-episode-summary/package*.json ./apps/worker-episode-summary/
COPY libs/shared/package*.json ./libs/shared/
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build:shared && npm run build:worker-session

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/libs/shared/package.json ./libs/shared/package.json
COPY --from=build /app/libs/shared/dist ./libs/shared/dist
COPY --from=build /app/prisma ./prisma

USER node
CMD ["node", "dist/apps/worker-session/main.js"]
