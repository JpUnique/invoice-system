package storage

import (
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Store struct {
	BaseDir string
}

func New(baseDir string) (*Store, error) {
	if err := os.MkdirAll(filepath.Join(baseDir, "logos"), 0o755); err != nil {
		return nil, err
	}
	return &Store{BaseDir: baseDir}, nil
}

// SaveLogo writes an uploaded logo file under <baseDir>/logos and returns
// the path relative to BaseDir (suitable for storing in the DB and for
// building a public /uploads/... URL).
func (s *Store) SaveLogo(clientCode string, file multipart.File, header *multipart.FileHeader) (string, error) {
	ext := strings.ToLower(filepath.Ext(header.Filename))
	switch ext {
	case ".png", ".jpg", ".jpeg", ".svg", ".webp":
	default:
		return "", fmt.Errorf("unsupported logo file type %q", ext)
	}

	filename := fmt.Sprintf("%s-%d%s", strings.ToLower(clientCode), time.Now().UnixNano(), ext)
	relPath := filepath.Join("logos", filename)
	fullPath := filepath.Join(s.BaseDir, relPath)

	dst, err := os.Create(fullPath)
	if err != nil {
		return "", err
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		return "", err
	}

	return relPath, nil
}
