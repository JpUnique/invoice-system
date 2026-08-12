package pdf

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/base64"
	"fmt"
	"html/template"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/cdproto/runtime"
	"github.com/chromedp/chromedp"
	qrcode "github.com/skip2/go-qrcode"
)

const pngDataURIPrefix = "data:image/png;base64,"

//go:embed assets/petrodata-logo.png
var petrodataLogoPNG []byte

//go:embed assets/petrodata-seal.png
var petrodataSealPNG []byte

func PetroDataLogoDataURI() template.URL {
	return template.URL(pngDataURIPrefix + base64.StdEncoding.EncodeToString(petrodataLogoPNG))
}

func PetroDataSealDataURI() template.URL {
	return template.URL(pngDataURIPrefix + base64.StdEncoding.EncodeToString(petrodataSealPNG))
}

// QRCodeDataURI generates a QR code encoding content and returns it as a
// data URI, using the same embedding approach as the logo/seal: rendered
// server-side and inlined as an <img>, since the PDF pipeline feeds a fully
// formed HTML string into headless Chrome (a client-side JS QR library would
// risk a race with the "images loaded" wait in GeneratePDF below, which only
// waits on <img> tags).
func QRCodeDataURI(content string, size int) (template.URL, error) {
	png, err := qrcode.Encode(content, qrcode.Medium, size)
	if err != nil {
		return "", err
	}
	return template.URL(pngDataURIPrefix + base64.StdEncoding.EncodeToString(png)), nil
}

// ImageDataURI reads an image file from disk and returns it as a data URI,
// so the headless-Chromium-rendered document doesn't need to fetch local
// files (which is unreliable from an in-memory HTML document). The result
// is wrapped in template.URL so html/template's contextual auto-escaper
// treats it as a trusted URL instead of replacing it with "#ZgotmplZ" (its
// default behavior for dynamically-built data: URIs in src attributes).
func ImageDataURI(path string) (template.URL, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	mime := "image/png"
	switch strings.ToLower(filepath.Ext(path)) {
	case ".jpg", ".jpeg":
		mime = "image/jpeg"
	case ".svg":
		mime = "image/svg+xml"
	case ".webp":
		mime = "image/webp"
	}
	return template.URL("data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(b)), nil
}

func fmtQty(v float64) string {
	if v == 0 {
		return ""
	}
	if v == math.Trunc(v) {
		return strconv.FormatInt(int64(v), 10)
	}
	return fmt.Sprintf("%.2f", v)
}

func fmtMoney(v float64) string {
	neg := v < 0
	if neg {
		v = -v
	}
	whole := int64(math.Trunc(v + 0.005))
	cents := int64(math.Round((v-math.Trunc(v))*100)) % 100
	s := strconv.FormatInt(whole, 10)
	var grouped strings.Builder
	for i, digit := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			grouped.WriteByte(',')
		}
		grouped.WriteRune(digit)
	}
	sign := ""
	if neg {
		sign = "-"
	}
	return fmt.Sprintf("%s%s.%02d", sign, grouped.String(), cents)
}

func fmtDate(iso string) string {
	if iso == "" {
		return ""
	}
	t, err := time.Parse("2006-01-02", iso)
	if err != nil {
		return iso
	}
	return t.Format("2 January 2006")
}

type Renderer struct {
	templates *template.Template
}

func NewRenderer(templatesDir string) (*Renderer, error) {
	tmpl, err := template.New("pdf").Funcs(template.FuncMap{
		"qty":   fmtQty,
		"money": fmtMoney,
		"date":  fmtDate,
	}).ParseGlob(filepath.Join(templatesDir, "*.html"))
	if err != nil {
		return nil, err
	}
	return &Renderer{templates: tmpl}, nil
}

func (r *Renderer) RenderHTML(name string, data any) (string, error) {
	var buf bytes.Buffer
	if err := r.templates.ExecuteTemplate(&buf, name, data); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// Browser keeps a single headless Chromium process warm for the life of the
// server. Launching a fresh Chrome process per PDF request is expensive
// (multiple seconds, and highly variable under load) — each GeneratePDF call
// instead opens a new tab against this already-running browser, which is
// consistently fast (sub-second to a couple seconds).
type Browser struct {
	allocCancel   context.CancelFunc
	browserCtx    context.Context
	browserCancel context.CancelFunc
}

// NewBrowser launches headless Chromium once. chromeExecPath may be empty to
// use chromedp's default discovery.
func NewBrowser(chromeExecPath string) (*Browser, error) {
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.NoSandbox,
		chromedp.DisableGPU,
		chromedp.Flag("disable-dev-shm-usage", true),
	)
	if chromeExecPath != "" {
		opts = append(opts, chromedp.ExecPath(chromeExecPath))
	}

	allocCtx, allocCancel := chromedp.NewExecAllocator(context.Background(), opts...)
	browserCtx, browserCancel := chromedp.NewContext(allocCtx)

	// Force the browser process to actually start now, rather than lazily
	// on the first PDF request (which is exactly the cold-start latency
	// we're trying to avoid).
	if err := chromedp.Run(browserCtx); err != nil {
		browserCancel()
		allocCancel()
		return nil, err
	}

	return &Browser{allocCancel: allocCancel, browserCtx: browserCtx, browserCancel: browserCancel}, nil
}

func (b *Browser) Close() {
	b.browserCancel()
	b.allocCancel()
}

// GeneratePDF opens a new tab against the warm browser instance, loads html
// directly into it, and prints it to PDF. The caller's ctx deadline (if any)
// bounds the operation; chromedp.NewContext is deliberately rooted at
// b.browserCtx rather than ctx so the new tab reuses the already-running
// browser process instead of spawning a new one.
func (b *Browser) GeneratePDF(ctx context.Context, html string) ([]byte, error) {
	taskCtx, cancel := chromedp.NewContext(b.browserCtx)
	defer cancel()

	if deadline, ok := ctx.Deadline(); ok {
		var cancelDeadline context.CancelFunc
		taskCtx, cancelDeadline = context.WithDeadline(taskCtx, deadline)
		defer cancelDeadline()
	}

	var pdfBuf []byte
	err := chromedp.Run(taskCtx,
		chromedp.ActionFunc(func(ctx context.Context) error {
			frameTree, err := page.GetFrameTree().Do(ctx)
			if err != nil {
				return err
			}
			return page.SetDocumentContent(frameTree.Frame.ID, html).Do(ctx)
		}),
		chromedp.Evaluate(`Promise.all(Array.from(document.images).filter(img => !img.complete).map(img => new Promise(resolve => { img.onload = img.onerror = resolve; })))`, nil, func(p *runtime.EvaluateParams) *runtime.EvaluateParams {
			return p.WithAwaitPromise(true)
		}),
		chromedp.ActionFunc(func(ctx context.Context) error {
			buf, _, err := page.PrintToPDF().
				WithPrintBackground(true).
				WithMarginTop(0.4).
				WithMarginBottom(0.4).
				WithMarginLeft(0.35).
				WithMarginRight(0.35).
				Do(ctx)
			if err != nil {
				return err
			}
			pdfBuf = buf
			return nil
		}),
	)
	return pdfBuf, err
}
