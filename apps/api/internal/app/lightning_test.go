package app

import (
	"context"
	"errors"
	"github.com/elsell/simple-strike/apps/api/internal/domain/audit"
	"github.com/elsell/simple-strike/apps/api/internal/domain/identity"
	"github.com/elsell/simple-strike/apps/api/internal/ports"
	"github.com/elsell/simple-strike/apps/api/pkg/lightning/adapters/demo"
	"github.com/elsell/simple-strike/apps/api/pkg/lightning/domain"
	"testing"
	"time"
)

func lightningFixture(t *testing.T) (App, *[]audit.Event) {
	t.Helper()
	now := time.Date(2026, 10, 17, 12, 0, 0, 0, time.UTC)
	c := fakeClock{now: now}
	source, err := demo.New(c, now.Add(-time.Minute), []demo.Event{{ID: "demo-1", Offset: time.Second, Position: domain.Position{Latitude: 27, Longitude: -82}}})
	if err != nil {
		t.Fatal(err)
	}
	events := []audit.Event{}
	return App{Auth: fakeAuth{}, Users: fakeUsers{user: identity.User{ID: "owner", Status: identity.StatusActive}}, Authorizer: fakeAuthz{allowed: true}, Clock: c, Audits: fakeAudits{events: &events}, AuditRateLimiter: fakeAuditRateLimiter{}, LightningSource: source}, &events
}

func TestLightningReadReturnsLabeledDemoAndAudit(t *testing.T) {
	a, events := lightningFixture(t)
	batch, err := a.RecentLightning(context.Background(), "Bearer session")
	if err != nil {
		t.Fatal(err)
	}
	if batch.Mode != domain.Demo || len(batch.Observations) != 1 {
		t.Fatalf("unexpected batch %+v", batch)
	}
	if len(*events) != 1 || (*events)[0].Action != audit.ResourceViewed || (*events)[0].TargetType != "lightning_feed" {
		t.Fatalf("missing feed audit %+v", *events)
	}
}

func TestLightningReadFailsClosed(t *testing.T) {
	failure := errors.New("dependency unavailable")
	for _, tc := range []struct {
		name   string
		change func(*App)
		want   error
	}{
		{"unauthenticated", func(a *App) { a.Auth = fakeAuth{err: ports.ErrInvalidCredential} }, ports.ErrInvalidCredential},
		{"wrong scope", func(a *App) {
			a.Auth = fakeAuth{principal: ports.Principal{UserID: "owner", Scopes: []string{"other"}}}
		}, ErrUnauthenticated},
		{"disabled", func(a *App) { a.Users = fakeUsers{user: identity.User{ID: "owner", Status: identity.StatusDisabled}} }, ErrForbidden},
		{"denied", func(a *App) { a.Authorizer = fakeAuthz{} }, ErrForbidden},
		{"authorization unavailable", func(a *App) { a.Authorizer = fakeAuthz{err: failure} }, failure},
		{"audit unavailable", func(a *App) { a.Audits = fakeAudits{err: failure} }, failure},
		{"limited", func(a *App) { a.AuditRateLimiter = fakeAuditRateLimiter{denied: true} }, ErrRateLimited},
		{"source absent", func(a *App) { a.LightningSource = nil }, ports.ErrAuthorizationPolicyNotConfigured},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, _ := lightningFixture(t)
			tc.change(&a)
			batch, err := a.RecentLightning(context.Background(), "Bearer session")
			if !errors.Is(err, tc.want) || len(batch.Observations) != 0 {
				t.Fatalf("got %+v, %v", batch, err)
			}
		})
	}
}

func TestLightningAuthorizationFailureIsAudited(t *testing.T) {
	a, events := lightningFixture(t)
	failure := errors.New("authorization unavailable")
	a.Authorizer = fakeAuthz{err: failure}
	_, err := a.RecentLightning(context.Background(), "Bearer session")
	if !errors.Is(err, failure) {
		t.Fatalf("got %v", err)
	}
	if len(*events) != 1 || (*events)[0].Outcome != audit.Failed {
		t.Fatalf("missing failed-read audit: %+v", *events)
	}
}
