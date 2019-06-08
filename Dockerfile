FROM node:lts as base

WORKDIR /app

ADD package.json package-lock.json ./
RUN npm install
