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
	PublicBaseURL      string
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
		// Base origin used to build the public, unauthenticated invoice link
		// embedded in each PDF's QR code (e.g. a LAN IP or, once Tailscale is
		// set up, its MagicDNS hostname). Empty by default since there's no
		// sensible universal default — the QR simply doesn't render without it.
		PublicBaseURL: strings.TrimSuffix(getEnv("PUBLIC_BASE_URL", ""), "/"),
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
