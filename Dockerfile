FROM node:20
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm install && npm rebuild sqlite3
COPY server/ ./server/
WORKDIR /app/server
EXPOSE 5000
CMD ["node", "index.js"]
