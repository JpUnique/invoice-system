FROM golang:1.25-alpine AS build
ENV GOTOOLCHAIN=auto
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/api ./cmd/api

FROM alpine:3.20
RUN apk add --no-cache ca-certificates chromium nss freetype ttf-freefont font-noto-emoji
ENV CHROME_PATH=/usr/bin/chromium-browser
WORKDIR /app
COPY --from=build /out/api ./api
COPY migrations ./migrations
COPY templates ./templates
EXPOSE 8080
ENTRYPOINT ["./api"]
