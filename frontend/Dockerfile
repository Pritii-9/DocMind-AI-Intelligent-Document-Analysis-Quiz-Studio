# Build stage
FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_BASE_URL=http://backend:5000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY package*.json ./
COPY package-lock.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY public ./public
COPY src ./src

RUN npm ci
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
