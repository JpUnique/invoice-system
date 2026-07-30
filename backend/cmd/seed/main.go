// Seeds clients from the logo files in assets/logos/, matching each
// filename to a known company name via clientsByFile below. Safe to re-run:
// any file whose client code already exists is skipped (relies on the
// unique constraint on clients.code), so this can be used both for the
// initial seed and to pick up newly-added logo files later.
package main

import (
	"context"
	"errors"
	"log"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/joho/godotenv"

	"github.com/petrodata/invoice-transmittal/internal/config"
	"github.com/petrodata/invoice-transmittal/internal/db"
	"github.com/petrodata/invoice-transmittal/internal/db/sqlc"
	"github.com/petrodata/invoice-transmittal/internal/storage"
)

type clientSeed struct {
	Code string
	Name string
}

// Best-effort mapping from logo filename (without extension) to the real
// company name and a short client code. A handful of these (frazoil,
// greenenergy, waep, snh-benin) are low-confidence guesses — correct them
// via `UPDATE clients SET name = ... WHERE code = ...` if wrong.
var clientsByFile = map[string]clientSeed{
	"airtel":      {"AIRTEL", "Airtel Nigeria"},
	"aiteo":       {"AITEO", "Aiteo Eastern E&P Company Limited"},
	"aradel":      {"ARADEL", "Aradel Holdings Plc"},
	"belema":      {"BELEMA", "Belemaoil Producing Limited"},
	"chappal":     {"CHAPPAL", "Chappal Energies"},
	"chevron":     {"CHEVRON", "Chevron Nigeria Limited"},
	"conoil":      {"CONOIL", "Conoil Producing Limited"},
	"eroton":      {"EROTON", "Eroton Exploration & Production Company Limited"},
	"exxonmobil":  {"MOBIL", "ExxonMobil (Mobil Producing Nigeria Unlimited)"},
	"fhn":         {"FHN", "First Hydrocarbon Nigeria Limited"},
	"firstep":     {"FIRSTEP", "First E&P Limited"},
	"frazoil":     {"FRAZOIL", "Frazoil Nigeria Limited"},
	"frontier":    {"FRONTIER", "Frontier Oil Limited"},
	"greenenergy": {"GREENENERGY", "Green Energy International Limited"},
	"heirs":       {"HEIRS", "Heirs Energies Limited"},
	"ibm":         {"IBM", "IBM"},
	"lekoil":      {"LEKOIL", "Lekoil Nigeria Limited"},
	"monipulo":    {"MONIPULO", "Monipulo Limited"},
	"naoc":        {"NAOC", "Nigerian Agip Oil Company Limited"},
	"neconde":     {"NECONDE", "Neconde Energy Limited"},
	"newcross":    {"NEWCROSS", "Newcross Petroleum Limited"},
	"nlng":        {"NLNG", "Nigeria LNG Limited"},
	"nnpc":        {"NNPC", "Nigerian National Petroleum Company Limited"},
	"nuprc":       {"NUPRC", "Nigerian Upstream Petroleum Regulatory Commission"},
	"oando":       {"OANDO", "Oando PLC"},
	"panocean":    {"PANOCEAN", "Pan Ocean Oil Corporation (Nigeria) Limited"},
	"renaissance": {"RENAISSANCE", "Renaissance Africa Energy Company Limited"},
	"sahara":      {"SAHARA", "Sahara Energy Resource Limited"},
	"sapetro":     {"SAPETRO", "South Atlantic Petroleum Limited"},
	"seplat":      {"SEPLAT", "Seplat Energy Plc"},
	"shell":       {"SHELL", "Shell Petroleum Development Company of Nigeria Limited"},
	"snh-benin":   {"SNHBENIN", "Societe Nationale des Hydrocarbures (Benin)"},
	"tgs":         {"TGS", "TGS ASA"},
	"total":       {"TOTAL", "TotalEnergies EP Nigeria Limited"},
	"waep":        {"WAEP", "WAEP"},
}

const uniqueViolation = "23505"

func main() {
	_ = godotenv.Load()
	cfg := config.Load()

	logosDir := os.Getenv("SEED_LOGOS_DIR")
	if logosDir == "" {
		logosDir = "./assets/logos"
	}

	ctx := context.Background()
	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("could not connect to database: %v", err)
	}
	defer pool.Close()
	queries := sqlc.New(pool)

	store, err := storage.New(cfg.UploadsDir)
	if err != nil {
		log.Fatalf("could not init storage: %v", err)
	}

	entries, err := os.ReadDir(logosDir)
	if err != nil {
		log.Fatalf("could not read logos dir %s: %v", logosDir, err)
	}

	created, skipped, unmapped := 0, 0, 0
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		ext := strings.ToLower(filepath.Ext(entry.Name()))
		if ext != ".png" && ext != ".jpg" && ext != ".jpeg" {
			continue
		}
		base := strings.TrimSuffix(strings.ToLower(entry.Name()), ext)

		seed, ok := clientsByFile[base]
		if !ok {
			log.Printf("skip: no name mapping for %s", entry.Name())
			unmapped++
			continue
		}

		logoPath, err := copyLogo(store, seed.Code, filepath.Join(logosDir, entry.Name()))
		if err != nil {
			log.Printf("skip %s: could not copy logo: %v", entry.Name(), err)
			continue
		}

		_, err = queries.CreateClient(ctx, sqlc.CreateClientParams{
			Name:            seed.Name,
			Code:            seed.Code,
			LogoPath:        db.TextOrNil(logoPath),
			DefaultCurrency: "USD",
		})
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation {
				log.Printf("skip %s: client code %s already exists", entry.Name(), seed.Code)
				skipped++
				continue
			}
			log.Printf("error creating client for %s: %v", entry.Name(), err)
			continue
		}
		created++
		log.Printf("created client: %s (%s)", seed.Name, seed.Code)
	}

	log.Printf("done: %d created, %d skipped (already existed), %d unmapped", created, skipped, unmapped)
}

func copyLogo(store *storage.Store, code, srcPath string) (string, error) {
	f, err := os.Open(srcPath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	header := &multipart.FileHeader{Filename: filepath.Base(srcPath)}
	return store.SaveLogo(code, f, header)
}
