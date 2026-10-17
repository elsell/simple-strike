package bootstrap

import (
	"context"
	"errors"
	"github.com/elsell/simple-strike/apps/api/pkg/lightning/adapters/demo"
	"github.com/elsell/simple-strike/apps/api/pkg/lightning/domain"
	"github.com/elsell/simple-strike/apps/api/pkg/lightning/ports"
	"time"
)

type SourceFactory func(context.Context, ports.Clock) (ports.Source, error)

func selectSource(ctx context.Context, mode string, clock ports.Clock, factory SourceFactory) (ports.Source, error) {
	switch mode {
	case "", "disabled":
		return nil, nil
	case "demo":
		return demo.NewRolling(clock, 10*time.Second, []domain.Position{{Latitude: 28.02, Longitude: -82.55}, {Latitude: 27.86, Longitude: -82.38}, {Latitude: 28.12, Longitude: -82.32}, {Latitude: 27.98, Longitude: -82.68}, {Latitude: 27.78, Longitude: -82.54}})
	case "external":
		if factory == nil {
			return nil, errors.New("external source factory is required")
		}
		source, err := factory(ctx, clock)
		if err != nil {
			return nil, err
		}
		if source == nil {
			return nil, errors.New("external source factory returned no source")
		}
		return source, nil
	default:
		return nil, errors.New("unsupported lightning source")
	}
}
