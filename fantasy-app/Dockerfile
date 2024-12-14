# fantasy-app/Dockerfile
FROM node:16

WORKDIR /app

# Install serve globally first
RUN npm install -g serve

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

ENV PORT=3000
EXPOSE $PORT

# Use serve directly from the path where it's installed
CMD ["serve", "-s", "build", "-l", "$PORT"]