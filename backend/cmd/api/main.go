package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"github.com/petrodata/invoice-transmittal/internal/audit"
	"github.com/petrodata/invoice-transmittal/internal/auth"
	"github.com/petrodata/invoice-transmittal/internal/bankaccount"
	"github.com/petrodata/invoice-transmittal/internal/client"
	"github.com/petrodata/invoice-transmittal/internal/companysettings"
	"github.com/petrodata/invoice-transmittal/internal/config"
	"github.com/petrodata/invoice-transmittal/internal/dashboard"
	"github.com/petrodata/invoice-transmittal/internal/db"
	"github.com/petrodata/invoice-transmittal/internal/db/sqlc"
	"github.com/petrodata/invoice-transmittal/internal/invoice"
	"github.com/petrodata/invoice-transmittal/internal/pdf"
	"github.com/petrodata/invoice-transmittal/internal/storage"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Retries internally for up to the context deadline above (e.g. while
	// postgres is still recovering from an ungraceful restart). If it's
	// still unreachable after that, fail hard rather than serve requests
	// against a nil pool forever — `restart: unless-stopped` will keep
	// retrying the whole process until the database comes back.
	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("could not connect to database: %v", err)
	}

	store, err := storage.New(cfg.UploadsDir)
	if err != nil {
		log.Fatalf("could not initialize uploads storage: %v", err)
	}

	queries := sqlc.New(pool)

	pdfRenderer, err := pdf.NewRenderer(cfg.TemplatesDir)
	if err != nil {
		log.Fatalf("could not load pdf templates: %v", err)
	}

	browser, err := pdf.NewBrowser(cfg.ChromePath)
	if err != nil {
		log.Fatalf("could not launch headless chromium for pdf rendering: %v", err)
	}
	defer browser.Close()

	authHandler := auth.NewHandler(queries, cfg.JWTSecret)
	clientHandler := client.NewHandler(queries, store)
	invoiceHandler := invoice.NewHandler(pool, queries, store, pdfRenderer, browser, cfg.PublicBaseURL)
	dashboardHandler := dashboard.NewHandler(queries)
	auditHandler := audit.NewHandler(queries)
	bankAccountHandler := bankaccount.NewHandler(queries)
	companySettingsHandler := companysettings.NewHandler(queries, store)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSAllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		// Content-Disposition isn't on the CORS-safelisted response header
		// list, so cross-origin fetches (the "bypassing Caddy" setup in
		// .env.example) can't read the server-computed PDF filename off the
		// response without this — same-origin requests are unaffected either
		// way since CORS doesn't apply to them.
		ExposedHeaders:   []string{"Content-Disposition"},
		AllowCredentials: true,
	}))

	r.Get("/health", healthHandler(pool))

	r.Handle("/uploads/*", http.StripPrefix("/uploads/", http.FileServer(http.Dir(cfg.UploadsDir))))

	r.Route("/api/v1", func(r chi.Router) {
		r.Post("/auth/login", authHandler.Login)

		// Unauthenticated: reachable via the QR code printed on every
		// invoice PDF, so anyone with the link/QR (internal staff, the MD
		// remotely over Tailscale) can view/download the soft copy without
		// logging in. Guarded by an unguessable per-invoice token, not a
		// sequential id.
		r.Get("/public/invoices/{token}", invoiceHandler.PublicView)
		r.Get("/public/invoices/{token}/pdf", invoiceHandler.PublicPDF)

		r.Group(func(r chi.Router) {
			r.Use(auth.RequireAuth(cfg.JWTSecret))

			r.Get("/auth/me", authHandler.Me)

			r.Get("/clients", clientHandler.List)
			r.Get("/clients/{id}", clientHandler.Get)
			r.Get("/clients/{id}/addresses", clientHandler.ListAddresses)

			r.Group(func(r chi.Router) {
				r.Use(auth.RequireRole("admin", "gm"))
				r.Post("/clients", clientHandler.Create)
				r.Put("/clients/{id}", clientHandler.Update)
				r.Delete("/clients/{id}", clientHandler.Delete)
			})

			r.Get("/invoices", invoiceHandler.List)
			r.Get("/invoices/{id}", invoiceHandler.Get)
			r.Post("/invoices", invoiceHandler.Create)
			r.Get("/invoices/{id}/pdf", invoiceHandler.PDF)

			r.Get("/dashboard/summary", dashboardHandler.Summary)

			r.Get("/bank-accounts", bankAccountHandler.List)
			r.Get("/company-settings", companySettingsHandler.Get)

			r.Group(func(r chi.Router) {
				r.Use(auth.RequireRole("admin", "gm"))
				r.Patch("/invoices/{id}/status", invoiceHandler.UpdateStatus)
				r.Patch("/invoices/{id}/seal", invoiceHandler.Seal)
				r.Delete("/invoices/{id}/seal", invoiceHandler.Unseal)
				r.Post("/bank-accounts", bankAccountHandler.Create)
				r.Put("/bank-accounts/{id}", bankAccountHandler.Update)
				r.Delete("/bank-accounts/{id}", bankAccountHandler.Delete)
				r.Put("/company-settings", companySettingsHandler.Update)
			})

			r.Group(func(r chi.Router) {
				r.Use(auth.RequireRole("admin"))
				r.Get("/audit-log", auditHandler.List)
				r.Get("/users", authHandler.ListUsers)
				r.Post("/users", authHandler.CreateUser)
			})
		})
	})

	log.Printf("petrodata invoice-transmittal api listening on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, r); err != nil {
		log.Fatal(err)
	}
}

func healthHandler(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := "ok"
		dbStatus := "unreachable"
		if pool != nil {
			if err := pool.Ping(r.Context()); err == nil {
				dbStatus = "ok"
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status": status,
			"db":     dbStatus,
		})
	}
}
