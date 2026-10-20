# Dockerfile for VANNI SI Voice Gateway (Azure Container Apps)
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
COPY apps/voice-gateway/ ./apps/voice-gateway/

RUN npm install --ignore-scripts
RUN npm run build --prefix packages/shared --if-present
RUN npm run build --prefix apps/voice-gateway --if-present

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4200

COPY --from=builder /app ./

EXPOSE 4200

CMD ["npm", "run", "start", "--prefix", "apps/voice-gateway"]
