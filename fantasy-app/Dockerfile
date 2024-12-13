FROM node:16

WORKDIR /app
COPY package*.json ./
RUN npm install
RUN npm install serve -g
COPY . .
RUN npm run build

EXPOSE $PORT
CMD ["npm", "run", "start:prod"]