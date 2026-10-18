package httpserver

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

type ClientConfigurationDTO struct {
	Version      int    `json:"version" enum:"1"`
	OIDCIssuer   string `json:"oidcIssuer"`
	OIDCClientID string `json:"oidcClientId"`
}

type ClientConfigurationOutput struct {
	Body struct {
		Data ClientConfigurationDTO `json:"data"`
	}
}

func registerClientConfiguration(api huma.API, options Options) {
	huma.Register(api, huma.Operation{OperationID: "get-client-configuration", Method: http.MethodGet, Path: "/v1/client-configuration", Summary: "Get public mobile sign-in configuration"}, func(_ context.Context, _ *struct{}) (*ClientConfigurationOutput, error) {
		if options.OIDCIssuer == "" || options.OIDCMobileClientID == "" {
			return nil, newCodedAPIError(http.StatusServiceUnavailable, "unavailable", "client configuration unavailable")
		}
		out := &ClientConfigurationOutput{}
		out.Body.Data.Version = 1
		out.Body.Data.OIDCIssuer = options.OIDCIssuer
		out.Body.Data.OIDCClientID = options.OIDCMobileClientID
		return out, nil
	})
}
