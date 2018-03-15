FROM node:8-alpine
LABEL maintainer "Maik Hinrichs <maik@mahiso.de>"

WORKDIR /usr/src/app

VOLUME /usr/src/app/config
VOLUME /usr/src/app/backup

COPY package*.json ./

RUN npm install --only=production

COPY . .

CMD ["npm", "start"]
