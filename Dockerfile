FROM node:16-buster-slim
LABEL version="0.0.1"

WORKDIR /var/www/lighterpack

COPY . .

RUN npm install

EXPOSE 8080/tcp

CMD ["nodejs", "app.js"]
