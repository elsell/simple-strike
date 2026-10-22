// Package ports defines the extension boundary for independently supplied sources.
package ports

import (
	"context"
	"github.com/elsell/simple-strike/apps/api/pkg/lightning/domain"
	"time"
)

// Window includes From and excludes Until. All values are observation times.
type Window struct {
	From  time.Time
	Until time.Time
}

// Source is one configured provider. Implementations must honor cancellation.
// This port does not grant client access; the application owns authorization.
type Source interface {
	Read(context.Context, Window) (domain.Batch, error)
}

type Clock interface{ Now() time.Time }
