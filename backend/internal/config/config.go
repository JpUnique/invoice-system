package config

import (
	"log"
	"os"
)

const devJWTSecret = "dev-secret-change-me"

type Config struct {
	Port         string
	DatabaseURL  string
	JWTSecret    string
	Env          string
	UploadsDir   string
	TemplatesDir string
	ChromePath   string
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
