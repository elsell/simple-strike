package main

import (
	"encoding/json"
	"github.com/elsell/simple-strike/apps/api/internal/adapters/httpserver"
	"github.com/elsell/simple-strike/apps/api/internal/app"
	"github.com/elsell/simple-strike/apps/api/internal/generated"
	"os"
)

func main() {
	_, api := httpserver.New(app.App{}, generated.Domains, httpserver.Options{OIDCIssuer: "https://id.example.invalid", OIDCAuthorizationURL: "https://id.example.invalid/authorize", OIDCTokenURL: "https://id.example.invalid/token", OIDCDocsClientID: "simple-strike-docs", OIDCDocsRedirectURI: "https://api.example.invalid/docs", PublicBaseURL: "https://api.example.invalid", DomainRegistrations: generated.Registrations(generated.Dependencies{})})
	if err := json.NewEncoder(os.Stdout).Encode(api.OpenAPI()); err != nil {
		panic(err)
	}
}
