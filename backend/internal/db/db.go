package db

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// NewPool connects and retries the initial ping until ctx is done. Postgres
// can still be mid crash-recovery when this process starts (e.g. after a
// host reboot restarts both containers independently of docker-compose's
// startup ordering), so a single failed ping shouldn't be permanent — the
// caller is expected to bound ctx and fail hard if it's exceeded, letting
// the container's restart policy retry the whole process.
func NewPool(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}

	for {
		pingErr := pool.Ping(ctx)
		if pingErr == nil {
			return pool, nil
		}
		select {
		case <-ctx.Done():
			pool.Close()
			return nil, pingErr
		case <-time.After(2 * time.Second):
			log.Printf("database not ready yet, retrying: %v", pingErr)
		}
	}
}
