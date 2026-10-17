package httpserver

import (
	"context"
	"github.com/elsell/simple-strike/apps/api/internal/app"
	"github.com/elsell/simple-strike/apps/api/internal/ports"
	"net/http"
	"net/http/httptest"
	"testing"
)

type rejectedLightningSession struct{}

func (rejectedLightningSession) Authenticate(context.Context, string) (ports.Principal, error) {
	return ports.Principal{}, ports.ErrInvalidCredential
}
func TestLightningHTTPRequiresSession(t *testing.T) {
	handler, api := New(app.App{Auth: rejectedLightningSession{}, Users: docsUsers{}}, nil, Options{})
	if api.OpenAPI().Paths["/v1/lightning/strikes"] == nil {
		t.Fatal("missing lightning contract")
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/v1/lightning/strikes", nil))
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("got %d: %s", response.Code, response.Body.String())
	}
}
