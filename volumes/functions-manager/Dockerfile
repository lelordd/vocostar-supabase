FROM node:20-alpine

WORKDIR /app

# Copy package.json first to leverage layer caching
COPY package.json ./

# Install dependencies inside the image, not on the mounted volume
RUN npm install

# Copy the rest of the application
COPY . .

EXPOSE 8085

CMD ["node", "index.js"]
