package httpserver

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"

	"github.com/elsell/simple-strike/apps/api/internal/app"
)

func TestClientConfigurationPublicBootstrap(t *testing.T) {
	for _, docsDisabled := range []bool{false, true} {
		handler, _ := New(app.App{}, nil, Options{OIDCIssuer: "https://identity.example/dex", OIDCMobileClientID: "mobile", DisableDocs: docsDisabled})
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/v1/client-configuration?oidcIssuer=https://attacker.example&oidcClientId=other", nil))
		if response.Code != http.StatusOK {
			t.Fatalf("bootstrap status %d: %s", response.Code, response.Body.String())
		}
		var body map[string]any
		if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		want := map[string]any{"version": float64(1), "oidcIssuer": "https://identity.example/dex", "oidcClientId": "mobile"}
		if !reflect.DeepEqual(body["data"], want) {
			t.Fatalf("unexpected public metadata: %#v", body)
		}
	}
}

func TestClientConfigurationUnavailableWithoutSettings(t *testing.T) {
	for _, options := range []Options{{}, {OIDCIssuer: "https://identity.example"}, {OIDCMobileClientID: "mobile"}} {
		handler, _ := New(app.App{}, nil, options)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/v1/client-configuration", nil))
		if response.Code != http.StatusServiceUnavailable {
			t.Fatalf("incomplete bootstrap status %d", response.Code)
		}
	}
}

func TestClientConfigurationUsesRequestLimiter(t *testing.T) {
	handler, _ := New(app.App{}, nil, Options{OIDCIssuer: "https://identity.example", OIDCMobileClientID: "mobile", RequestRateLimiter: denyLimiter{}, Clock: docsClock{now: time.Unix(1, 0)}})
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/v1/client-configuration", nil))
	if response.Code != http.StatusTooManyRequests {
		t.Fatalf("bootstrap bypassed limiter: %d", response.Code)
	}
}
