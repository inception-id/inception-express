FROM node:22-alpine as builder

ARG DATABASE_URL=$DATABASE_URL
ARG SUPERTOKENS_CONNECTION_URI=$SUPERTOKENS_CONNECTION_URI
ARG SUPERTOKENS_API_KEY=$SUPERTOKENS_API_KEY
ARG INCEPTION_WHATSAPP_SESSION_ID=$INCEPTION_WHATSAPP_SESSION_ID
ARG DEVELOPMENT_MONTHLY_LIMIT=$DEVELOPMENT_MONTHLY_LIMIT

# Set the working directory inside the container
WORKDIR /app

COPY yarn.lock .
COPY package.json .
RUN yarn
COPY . .
RUN yarn build

FROM node:22-alpine as runner

WORKDIR /app

# Install Chromium + required fonts & deps
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# Set puppeteer to use system chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
COPY --from=builder /app/yarn.lock .
COPY --from=builder /app/dist ./dist

EXPOSE 5500

ENTRYPOINT [ "node" , "dist/index.js" ]
