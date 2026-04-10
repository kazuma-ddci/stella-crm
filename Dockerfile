FROM node:20-alpine

WORKDIR /app

ENV TZ=Asia/Tokyo

# ghostscript: PDF アップロード時の自動圧縮で使用
RUN apk add --no-cache openssl ghostscript

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "dev"]
