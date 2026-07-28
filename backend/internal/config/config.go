package config

import (
	"os"
)

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
	return Config{
		Port:         getEnv("PORT", "8080"),
		DatabaseURL:  getEnv("DATABASE_URL", "postgres://petrodata:petrodata@localhost:5432/petrodata?sslmode=disable"),
		JWTSecret:    getEnv("JWT_SECRET", "dev-secret-change-me"),
		Env:          getEnv("APP_ENV", "development"),
		UploadsDir:   getEnv("UPLOADS_DIR", "./uploads"),
		TemplatesDir: getEnv("TEMPLATES_DIR", "./templates/pdf"),
		ChromePath:   getEnv("CHROME_PATH", ""),
	}
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
