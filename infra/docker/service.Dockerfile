FROM node:20-alpine
WORKDIR /app

# Copy root manifest and local shared packages
COPY package*.json ./
COPY packages/ ./packages/

ARG SERVICE_NAME
ARG SERVICE_PORT

# Copy the specific service code
COPY services/${SERVICE_NAME}/ ./services/${SERVICE_NAME}/

# Install dependencies with monorepo workspace linking
RUN npm install

WORKDIR /app/services/${SERVICE_NAME}

EXPOSE ${SERVICE_PORT}
CMD ["npm", "run", "dev"]
