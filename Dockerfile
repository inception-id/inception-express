FROM node:22-alpine as builder

ARG DATABASE_URL=$DATABASE_URL
ARG SUPERTOKENS_CONNECTION_URI=$SUPERTOKENS_CONNECTION_URI
ARG SUPERTOKENS_API_KEY=$SUPERTOKENS_API_KEY

# Set the working directory inside the container
WORKDIR /app

COPY yarn.lock .
COPY package.json .
RUN yarn
COPY . .
RUN yarn build

FROM node:22-alpine as runner

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
COPY --from=builder /app/yarn.lock .
COPY --from=builder /app/dist ./dist

EXPOSE 5500

ENTRYPOINT [ "node" , "dist/index.js" ]
