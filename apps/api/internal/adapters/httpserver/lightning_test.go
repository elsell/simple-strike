package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/elsell/simple-strike/apps/api/internal/app"
	"github.com/elsell/simple-strike/apps/api/internal/domain/audit"
	"github.com/elsell/simple-strike/apps/api/internal/domain/identity"
	"github.com/elsell/simple-strike/apps/api/internal/ports"
	"github.com/elsell/simple-strike/apps/api/pkg/lightning/domain"
	lightningports "github.com/elsell/simple-strike/apps/api/pkg/lightning/ports"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type rejectedLightningSession struct{}

func (rejectedLightningSession) Authenticate(context.Context, string) (ports.Principal, error) {
	return ports.Principal{}, ports.ErrInvalidCredential
}
func TestLightningHTTPRequiresSession(t *testing.T) {
	handler, api := New(app.App{Auth: rejectedLightningSession{}, Users: docsUsers{}}, nil, Options{})
	if api.OpenAPI().Paths["/v1/lightning/strikes"] == nil {
		t.Fatal("missing lightning contract")
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/v1/lightning/strikes", nil))
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("got %d: %s", response.Code, response.Body.String())
	}
}

// Controlled dependencies exercise the real route and application boundary.
type lightningPermissions struct {
	allowed bool
	failure error
}

func (p *lightningPermissions) Check(context.Context, string, string, string, string) (bool, error) {
	return p.allowed, p.failure
}
func (*lightningPermissions) WriteRelationship(context.Context, string, string, string, string, string) error {
	return errors.New("unsupported write")
}
func (*lightningPermissions) DeleteRelationship(context.Context, string, string, string, string, string) error {
	return errors.New("unsupported delete")
}

type lightningAuditStore struct {
	events  []audit.Event
	failure error
}

func (s *lightningAuditStore) AppendAuditEvent(_ context.Context, event audit.Event) error {
	if s.failure != nil {
		return s.failure
	}
	s.events = append(s.events, event)
	return nil
}
func (s *lightningAuditStore) ListAuditEvents(context.Context, string, ports.PageRequest) (audit.Page, error) {
	return audit.Page{}, errors.New("unsupported list")
}

type lightningHTTPSource struct {
	calls   int
	failure error
	now     time.Time
}

func (s *lightningHTTPSource) Read(context.Context, lightningports.Window) (domain.Batch, error) {
	s.calls++
	return domain.Batch{Mode: domain.Demo, Observations: []domain.Observation{{ID: "visible-strike", Position: domain.Position{Latitude: 27, Longitude: -82}, OccurredAt: s.now.Add(-time.Second)}}}, s.failure
}
func TestLightningHTTPFailsClosedAtDependencyBoundaries(t *testing.T) {
	for _, scenario := range []string{"success", "source failure", "audit failure", "authorization failure", "revoked permission"} {
		t.Run(scenario, func(t *testing.T) {
			now := time.Date(2026, 10, 17, 12, 0, 0, 0, time.UTC)
			permissions := &lightningPermissions{allowed: true}
			audits := &lightningAuditStore{}
			source := &lightningHTTPSource{now: now}
			handler, _ := New(app.App{
				Auth:  invitationAuthenticator{principal: ports.Principal{UserID: "user", Scopes: []string{"api:user"}}},
				Users: invitationUsers{user: identity.User{ID: "user", Status: identity.StatusActive}},
				Clock: docsClock{now: now}, AuditRateLimiter: docsLimiter{},
				Audits: audits, Authorizer: permissions, LightningSource: source,
			}, nil, Options{})
			read := func() *httptest.ResponseRecorder {
				request := httptest.NewRequest(http.MethodGet, "/v1/lightning/strikes", nil)
				request.Header.Set("Authorization", "Bearer session")
				response := httptest.NewRecorder()
				handler.ServeHTTP(response, request)
				return response
			}
			failure := errors.New("private upstream credential must not escape")
			want := http.StatusInternalServerError
			switch scenario {
			case "success":
				want = http.StatusOK
			case "source failure":
				source.failure = failure
			case "audit failure":
				audits.failure = failure
			case "authorization failure":
				permissions.failure = failure
			case "revoked permission":
				if response := read(); response.Code != http.StatusOK {
					t.Fatalf("initial read: %d", response.Code)
				}
				permissions.allowed = false
				source.calls = 0
				audits.events = nil
				want = http.StatusForbidden
			}
			response := read()
			if response.Code != want {
				t.Fatalf("got %d: %s", response.Code, response.Body.String())
			}
			if strings.Contains(response.Body.String(), failure.Error()) {
				t.Fatal("leaked private dependency error")
			}
			if scenario == "success" {
				var body lightningOutput
				if err := json.Unmarshal(response.Body.Bytes(), &body.Body); err != nil {
					t.Fatal(err)
				}
				if body.Body.Data.Mode != "demo" || len(body.Body.Data.Observations) != 1 {
					t.Fatalf("wrong successful body: %s", response.Body.String())
				}
			} else if strings.Contains(response.Body.String(), "visible-strike") || strings.Contains(response.Body.String(), `"observations"`) {
				t.Fatal("failed read exposed observations")
			}
			if (scenario == "revoked permission" || scenario == "authorization failure") && source.calls != 0 {
				t.Fatal("source consulted before authorization")
			}
			if scenario != "audit failure" {
				outcome := audit.Failed
				if scenario == "success" {
					outcome = audit.Succeeded
				}
				if scenario == "revoked permission" {
					outcome = audit.Denied
				}
				if len(audits.events) != 1 || audits.events[0].Outcome != outcome {
					t.Fatalf("incorrect audit: %+v", audits.events)
				}
			}
		})
	}
}
