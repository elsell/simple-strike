package spicedb

import (
	"context"
	"flag"
	"testing"
	"time"
)

// This test writes a schema. Only point it at a disposable, isolated instance.
var lightningIsolatedEndpoint = flag.String("lightning-isolated-endpoint", "", "disposable SpiceDB for lightning permission lifecycle tests")

func TestLightningFeedPermissionLifecycle(t *testing.T) {
	if *lightningIsolatedEndpoint == "" {
		t.Skip("requires a disposable lightning SpiceDB instance")
	}
	a, err := New(*lightningIsolatedEndpoint, "simple-strike-test-only", true)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	if err = a.WriteSchema(ctx, RequiredSchema); err != nil {
		t.Fatal(err)
	}
	check := func(subject string, want bool) {
		t.Helper()
		got, err := a.Check(ctx, "lightning_feed", "configured", "view", subject)
		if err != nil || got != want {
			t.Fatalf("subject %s: got %v, %v; want %v", subject, got, err, want)
		}
	}
	check("viewer-a", false)
	if err = a.WriteRelationship(ctx, "lightning_feed", "configured", "viewer", "user", "*"); err != nil {
		t.Fatal(err)
	}
	check("viewer-a", true)
	check("viewer-b", true)
	if err = a.WriteRelationship(ctx, "lightning_feed", "configured", "viewer", "user", "viewer-a"); err != nil {
		t.Fatal(err)
	}
	if err = a.DeleteRelationship(ctx, "lightning_feed", "configured", "viewer", "user", "*"); err != nil {
		t.Fatal(err)
	}
	check("viewer-a", true)
	check("viewer-b", false)
	if err = a.DeleteRelationship(ctx, "lightning_feed", "configured", "viewer", "user", "viewer-a"); err != nil {
		t.Fatal(err)
	}
	check("viewer-a", false)
}
