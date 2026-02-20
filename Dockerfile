FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source
COPY dist/ ./dist/

# Expose port
EXPOSE 8000

CMD ["node", "dist/api/server.js"]
