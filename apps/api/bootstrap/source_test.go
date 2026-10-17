package bootstrap

import (
	"context"
	"errors"
	"github.com/elsell/simple-strike/apps/api/pkg/lightning/domain"
	"github.com/elsell/simple-strike/apps/api/pkg/lightning/ports"
	"testing"
	"time"
)

type fixedClock struct{}

func (fixedClock) Now() time.Time { return time.Unix(1800000000, 0) }

type sourceFixture struct{}

func (sourceFixture) Read(context.Context, ports.Window) (domain.Batch, error) {
	return domain.Batch{Mode: domain.Live}, nil
}
func TestExternalFactoryIsRequiredAndErrorsArePreserved(t *testing.T) {
	if _, err := selectSource(context.Background(), "external", fixedClock{}, nil); err == nil {
		t.Fatal("external mode accepted absent factory")
	}
	failure := errors.New("provider unavailable")
	_, err := selectSource(context.Background(), "external", fixedClock{}, func(context.Context, ports.Clock) (ports.Source, error) { return nil, failure })
	if !errors.Is(err, failure) {
		t.Fatalf("got %v", err)
	}
	source, err := selectSource(context.Background(), "external", fixedClock{}, func(context.Context, ports.Clock) (ports.Source, error) { return sourceFixture{}, nil })
	if err != nil || source == nil {
		t.Fatalf("external factory failed: %v", err)
	}
}
func TestDemoSelectionDoesNotInvokePrivateFactory(t *testing.T) {
	source, err := selectSource(context.Background(), "demo", fixedClock{}, func(context.Context, ports.Clock) (ports.Source, error) {
		t.Fatal("private factory invoked in demo mode")
		return nil, nil
	})
	if err != nil || source == nil {
		t.Fatalf("demo factory failed: %v", err)
	}
	now := fixedClock{}.Now()
	batch, err := source.Read(context.Background(), ports.Window{From: now.Add(-time.Minute), Until: now})
	if err != nil || batch.Mode != domain.Demo {
		t.Fatalf("demo source not labeled: %+v %v", batch, err)
	}
}
