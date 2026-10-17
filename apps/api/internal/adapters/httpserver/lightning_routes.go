package httpserver

import (
	"context"
	"github.com/danielgtaylor/huma/v2"
	"github.com/elsell/simple-strike/apps/api/internal/app"
	"net/http"
	"time"
)

type lightningInput struct {
	Authorization string `header:"Authorization"`
}
type lightningObservationDTO struct {
	ID         string    `json:"id"`
	Latitude   float64   `json:"latitude"`
	Longitude  float64   `json:"longitude"`
	OccurredAt time.Time `json:"occurredAt"`
}
type lightningDataDTO struct {
	Mode         string                    `json:"mode" enum:"demo,live"`
	Observations []lightningObservationDTO `json:"observations" nullable:"false"`
}
type lightningOutput struct {
	Body struct {
		Data lightningDataDTO `json:"data"`
	}
}

func registerLightningRoutes(api huma.API, application app.App) {
	huma.Register(api, huma.Operation{OperationID: "recent-lightning", Method: http.MethodGet, Path: "/v1/lightning/strikes", Summary: "Read recent observations from the configured source", Security: []map[string][]string{{"oidc": {}}}}, func(ctx context.Context, input *lightningInput) (*lightningOutput, error) {
		batch, err := application.RecentLightning(ctx, input.Authorization)
		if err != nil {
			return nil, mapError(err, false)
		}
		out := &lightningOutput{}
		out.Body.Data.Mode = string(batch.Mode)
		out.Body.Data.Observations = make([]lightningObservationDTO, len(batch.Observations))
		for i, observation := range batch.Observations {
			out.Body.Data.Observations[i] = lightningObservationDTO{ID: observation.ID, Latitude: observation.Position.Latitude, Longitude: observation.Position.Longitude, OccurredAt: observation.OccurredAt}
		}
		return out, nil
	})
}
