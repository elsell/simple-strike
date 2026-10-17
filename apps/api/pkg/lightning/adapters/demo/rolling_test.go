package demo_test

import (
	"context"
	"github.com/elsell/simple-strike/apps/api/pkg/lightning/adapters/demo"
	"github.com/elsell/simple-strike/apps/api/pkg/lightning/domain"
	"github.com/elsell/simple-strike/apps/api/pkg/lightning/ports"
	"testing"
	"time"
)

func TestRollingScenarioPreservesIdentityAndContinuesAcrossDays(t *testing.T) {
	now := time.Date(2026, 10, 17, 12, 0, 0, 0, time.UTC)
	c := &clock{now: now}
	s, err := demo.NewRolling(c, 10*time.Second, []domain.Position{{Latitude: 27, Longitude: -82}})
	if err != nil {
		t.Fatal(err)
	}
	window := ports.Window{From: now.Add(-30 * time.Second), Until: now}
	a, err := s.Read(context.Background(), window)
	if err != nil {
		t.Fatal(err)
	}
	b, err := s.Read(context.Background(), window)
	if err != nil {
		t.Fatal(err)
	}
	if a.Mode != domain.Demo || len(a.Observations) != 3 || a.Observations[0].ID != b.Observations[0].ID {
		t.Fatalf("unstable scenario %+v %+v", a, b)
	}
	c.now = now.Add(48 * time.Hour)
	next, err := s.Read(context.Background(), ports.Window{From: c.now.Add(-30 * time.Second), Until: c.now})
	if err != nil || len(next.Observations) != 3 || next.Observations[0].ID == a.Observations[0].ID {
		t.Fatalf("scenario did not advance %+v %v", next, err)
	}
}
