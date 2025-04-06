FROM node:20-alpine

WORKDIR /app

# Install sharp dependencies
RUN apk add --no-cache vips-dev

COPY package*.json ./
RUN npm install

COPY . .

CMD ["npm", "start"]
