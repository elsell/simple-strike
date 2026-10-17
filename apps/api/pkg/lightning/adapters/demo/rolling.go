package demo

import (
	"context"
	"errors"
	"fmt"
	"github.com/elsell/simple-strike/apps/api/pkg/lightning/domain"
	"github.com/elsell/simple-strike/apps/api/pkg/lightning/ports"
	"time"
)

type Rolling struct {
	clock     ports.Clock
	interval  time.Duration
	positions []domain.Position
}

func NewRolling(clock ports.Clock, interval time.Duration, positions []domain.Position) (*Rolling, error) {
	if interval < time.Second || len(positions) == 0 {
		return nil, errors.New("invalid rolling demo configuration")
	}
	events := make([]Event, len(positions))
	for i, p := range positions {
		events[i] = Event{ID: fmt.Sprint(i), Position: p}
	}
	if _, err := New(clock, time.Unix(0, 0), events); err != nil {
		return nil, err
	}
	return &Rolling{clock: clock, interval: interval, positions: append([]domain.Position(nil), positions...)}, nil
}
func (s *Rolling) Read(ctx context.Context, w ports.Window) (domain.Batch, error) {
	if err := ctx.Err(); err != nil {
		return domain.Batch{}, err
	}
	if w.From.Before(time.Unix(0, 0)) || !w.From.Before(w.Until) || w.Until.Sub(w.From) > time.Hour {
		return domain.Batch{}, errors.New("invalid rolling demo window")
	}
	batch := domain.Batch{Mode: domain.Demo, Observations: []domain.Observation{}}
	now := s.clock.Now()
	first := w.From.UnixNano() / int64(s.interval)
	for sequence := first; ; sequence++ {
		at := time.Unix(0, sequence*int64(s.interval)).UTC()
		if !at.Before(w.Until) || at.After(now) {
			break
		}
		if err := ctx.Err(); err != nil {
			return domain.Batch{}, err
		}
		if at.Before(w.From) {
			continue
		}
		batch.Observations = append(batch.Observations, domain.Observation{ID: fmt.Sprintf("demo-%d", sequence), Position: s.positions[sequence%int64(len(s.positions))], OccurredAt: at})
	}
	return batch, nil
}

var _ ports.Source = (*Rolling)(nil)
