# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Copy package configuration files
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy the rest of the application files
COPY . .

# Set up build argument and inject environment variable
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build the frontend application for production
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
