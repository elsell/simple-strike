package demo_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/elsell/simple-strike/apps/api/pkg/lightning/adapters/demo"
	"github.com/elsell/simple-strike/apps/api/pkg/lightning/domain"
	"github.com/elsell/simple-strike/apps/api/pkg/lightning/ports"
)

type clock struct{ now time.Time }

func (c *clock) Now() time.Time { return c.now }

func TestScenarioDeliversOnlyOccurredEventsWithStableIdentity(t *testing.T) {
	start := time.Date(2026, 10, 17, 12, 0, 0, 0, time.UTC)
	c := &clock{now: start.Add(15 * time.Second)}
	source, err := demo.New(c, start, []demo.Event{
		{ID: "first", Offset: 10 * time.Second, Position: domain.Position{Latitude: 27, Longitude: -82}},
		{ID: "next", Offset: 20 * time.Second, Position: domain.Position{Latitude: 28, Longitude: -81}},
	})
	if err != nil {
		t.Fatal(err)
	}
	var provider ports.Source = source
	query := ports.Window{From: start, Until: start.Add(time.Minute)}
	batch, err := provider.Read(context.Background(), query)
	if err != nil {
		t.Fatal(err)
	}
	if batch.Mode != domain.Demo || len(batch.Observations) != 1 || batch.Observations[0].ID != "first" {
		t.Fatalf("unexpected batch: %+v", batch)
	}
	if !batch.Observations[0].OccurredAt.Equal(start.Add(10 * time.Second)) {
		t.Fatal("wrong occurrence time")
	}
	batch.Observations[0].ID = "changed by caller"
	c.now = start.Add(25 * time.Second)
	batch, err = provider.Read(context.Background(), query)
	if err != nil || len(batch.Observations) != 2 || batch.Observations[0].ID != "first" {
		t.Fatalf("scenario changed: %+v, %v", batch, err)
	}
	query.From = start.Add(15 * time.Second)
	batch, err = provider.Read(context.Background(), query)
	if err != nil || len(batch.Observations) != 1 || batch.Observations[0].ID != "next" {
		t.Fatalf("window not applied: %+v, %v", batch, err)
	}
}

func TestCancelledReadDoesNotDeliverData(t *testing.T) {
	now := time.Date(2026, 10, 17, 12, 0, 0, 0, time.UTC)
	source, err := demo.New(&clock{now}, now, nil)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = source.Read(ctx, ports.Window{From: now, Until: now.Add(time.Minute)})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("got %v", err)
	}
}

func TestRejectsInvalidScenarios(t *testing.T) {
	now := time.Now()
	for _, events := range [][]demo.Event{
		{{ID: "", Position: domain.Position{Latitude: 27, Longitude: -82}}},
		{{ID: "a", Offset: -time.Second}},
		{{ID: "a", Position: domain.Position{Latitude: 91}}},
		{{ID: "a"}, {ID: "a"}},
	} {
		if _, err := demo.New(&clock{now}, now, events); err == nil {
			t.Fatalf("accepted invalid scenario %+v", events)
		}
	}
}
