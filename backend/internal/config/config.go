package config

import (
	"log"
	"os"
	"strings"
)

const devJWTSecret = "dev-secret-change-me"

type Config struct {
	Port               string
	DatabaseURL        string
	JWTSecret          string
	Env                string
	UploadsDir         string
	TemplatesDir       string
	ChromePath         string
	CORSAllowedOrigins []string
}

func Load() Config {
	cfg := Config{
		Port:         getEnv("PORT", "8080"),
		DatabaseURL:  getEnv("DATABASE_URL", "postgres://petrodata:petrodata@localhost:5432/petrodata?sslmode=disable"),
		JWTSecret:    getEnv("JWT_SECRET", devJWTSecret),
		Env:          getEnv("APP_ENV", "development"),
		UploadsDir:   getEnv("UPLOADS_DIR", "./uploads"),
		TemplatesDir: getEnv("TEMPLATES_DIR", "./templates/pdf"),
		ChromePath:   getEnv("CHROME_PATH", ""),
		// Comma-separated list — only matters for browsers hitting this API
		// directly (bypassing the Caddy reverse proxy, which serves the
		// frontend and backend from the same origin and needs no CORS at
		// all). Defaults to local dev; set for real origins in production.
		CORSAllowedOrigins: strings.Split(getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000"), ","),
	}

	// A default JWT secret in production would let anyone forge valid
	// session tokens, so refuse to boot rather than run insecurely.
	if cfg.Env == "production" && cfg.JWTSecret == devJWTSecret {
		log.Fatal("refusing to start: APP_ENV=production but JWT_SECRET is still the dev default — set a strong secret (see .env.example)")
	}

	return cfg
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
