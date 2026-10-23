FROM node:24

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Generate the Prisma client
RUN npx prisma generate

RUN npm run build

ENV PORT=8080

EXPOSE 8080

CMD ["npm", "run", "start:prod"]