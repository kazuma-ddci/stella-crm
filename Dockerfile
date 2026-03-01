FROM node:20-alpine

WORKDIR /app

ENV TZ=Asia/Tokyo

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "dev"]
