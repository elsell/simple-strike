// Package demo provides a finite simulated scenario without network access.
package demo

import (
	"context"
	"errors"
	"math"
	"sort"
	"time"

	"github.com/elsell/simple-strike/apps/api/pkg/lightning/domain"
	"github.com/elsell/simple-strike/apps/api/pkg/lightning/ports"
)

type Event struct {
	ID       string
	Offset   time.Duration
	Position domain.Position
}

type Source struct {
	clock        ports.Clock
	observations []domain.Observation
}

func New(clock ports.Clock, start time.Time, events []Event) (*Source, error) {
	if clock == nil || start.IsZero() {
		return nil, errors.New("demo requires a clock and scenario start")
	}
	observations := make([]domain.Observation, 0, len(events))
	ids := make(map[string]bool, len(events))
	for _, event := range events {
		p := event.Position
		if event.ID == "" || ids[event.ID] || event.Offset < 0 ||
			math.IsNaN(p.Latitude) || math.IsNaN(p.Longitude) ||
			math.IsInf(p.Latitude, 0) || math.IsInf(p.Longitude, 0) ||
			math.Abs(p.Latitude) > 90 || math.Abs(p.Longitude) > 180 {
			return nil, errors.New("invalid demo scenario event")
		}
		ids[event.ID] = true
		observations = append(observations, domain.Observation{ID: event.ID, Position: p, OccurredAt: start.Add(event.Offset)})
	}
	sort.SliceStable(observations, func(i, j int) bool { return observations[i].OccurredAt.Before(observations[j].OccurredAt) })
	return &Source{clock: clock, observations: observations}, nil
}

func (s *Source) Read(ctx context.Context, window ports.Window) (domain.Batch, error) {
	if err := ctx.Err(); err != nil {
		return domain.Batch{}, err
	}
	if !window.From.Before(window.Until) {
		return domain.Batch{}, errors.New("invalid observation window")
	}
	now := s.clock.Now()
	batch := domain.Batch{Mode: domain.Demo, Observations: make([]domain.Observation, 0)}
	for _, observation := range s.observations {
		if err := ctx.Err(); err != nil {
			return domain.Batch{}, err
		}
		if observation.OccurredAt.Before(window.From) || !observation.OccurredAt.Before(window.Until) || observation.OccurredAt.After(now) {
			continue
		}
		batch.Observations = append(batch.Observations, observation)
	}
	return batch, nil
}

var _ ports.Source = (*Source)(nil)
