FROM node:22-alpine

WORKDIR /app

# Install root workspace deps
COPY package*.json ./
COPY packages/server/package*.json ./packages/server/
COPY packages/web/package*.json ./packages/web/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/cli/package*.json ./packages/cli/

RUN npm install

# Copy source (overridden by volume mount in dev)
COPY . .

EXPOSE 8787 8788

CMD ["npm", "run", "dev"]
