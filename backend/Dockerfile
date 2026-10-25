FROM node:20-alpine

WORKDIR /app

# Install build dependencies for g++ & python execution inside container
RUN apk add --no-cache g++ python3 make

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

EXPOSE 5000

CMD ["npm", "start"]
