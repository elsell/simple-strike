package app

import (
	"context"
	"github.com/elsell/simple-strike/apps/api/internal/domain/audit"
	"github.com/elsell/simple-strike/apps/api/internal/domain/identity"
	"github.com/elsell/simple-strike/apps/api/internal/ports"
	"github.com/elsell/simple-strike/apps/api/pkg/lightning/domain"
	lightningports "github.com/elsell/simple-strike/apps/api/pkg/lightning/ports"
	"time"
)

func (a App) RecentLightning(ctx context.Context, authorization string) (domain.Batch, error) {
	if a.Auth == nil || a.Users == nil {
		return domain.Batch{}, ports.ErrAuthorizationPolicyNotConfigured
	}
	user, err := a.authenticateCurrentUser(ctx, authorization)
	if err != nil {
		return domain.Batch{}, err
	}
	if a.Clock == nil || a.Audits == nil || a.Authorizer == nil || a.LightningSource == nil {
		return domain.Batch{}, ports.ErrAuthorizationPolicyNotConfigured
	}
	now := a.Clock.Now().UTC()
	if a.AuditRateLimiter == nil || !a.AuditRateLimiter.Allow(user.ID, now) {
		return domain.Batch{}, ErrRateLimited
	}
	auditFailure := func(cause error, action audit.Action, outcome audit.Outcome) (domain.Batch, error) {
		if auditErr := a.Audits.AppendAuditEvent(ctx, a.auditEvent(ctx, user.ID, user.ID, action, "lightning_feed", "configured", outcome)); auditErr != nil {
			return domain.Batch{}, auditErr
		}
		return domain.Batch{}, cause
	}
	if user.Status != identity.StatusActive {
		return auditFailure(ErrForbidden, audit.ResourceAccessDenied, audit.Denied)
	}
	allowed, err := a.Authorizer.Check(ctx, "lightning_feed", "configured", "view", user.ID)
	if err != nil {
		return auditFailure(err, audit.ResourceViewed, audit.Failed)
	}
	if !allowed {
		return auditFailure(ErrForbidden, audit.ResourceAccessDenied, audit.Denied)
	}
	batch, err := a.LightningSource.Read(ctx, lightningports.Window{From: now.Add(-5 * time.Minute), Until: now})
	if err != nil {
		return auditFailure(err, audit.ResourceViewed, audit.Failed)
	}
	if err := a.Audits.AppendAuditEvent(ctx, a.auditEvent(ctx, user.ID, user.ID, audit.ResourceViewed, "lightning_feed", "configured", audit.Succeeded)); err != nil {
		return domain.Batch{}, err
	}
	return batch, nil
}
