package main

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"strconv"
	"time"

	spice "github.com/elsell/simple-strike/apps/api/internal/adapters/spicedb"
)

func main() {
	feedAccess := os.Getenv("SIMPLE_STRIKE_FEED_ACCESS")
	if feedAccess != "" && feedAccess != "authenticated" {
		slog.Error("invalid feed access configuration")
		os.Exit(1)
	}
	endpoint := os.Getenv("SIMPLE_STRIKE_SPICEDB_ENDPOINT")
	token := os.Getenv("SIMPLE_STRIKE_SPICEDB_SCHEMA_TOKEN")
	insecureTransport, parseErr := strconv.ParseBool(os.Getenv("SIMPLE_STRIKE_SPICEDB_INSECURE"))
	if endpoint == "" || token == "" || parseErr != nil {
		slog.Error("schema configuration invalid")
		os.Exit(1)
	}
	authorizer, err := spice.New(endpoint, token, insecureTransport)
	if err != nil {
		slog.Error("schema client failed", "error", err)
		os.Exit(1)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	for {
		err = authorizer.WriteSchema(ctx, spice.RequiredSchema)
		if err == nil {
			if feedAccess == "authenticated" {
				err = authorizer.WriteRelationship(ctx, "lightning_feed", "configured", "viewer", "user", "*")
			} else {
				err = authorizer.DeleteRelationship(ctx, "lightning_feed", "configured", "viewer", "user", "*")
			}
			if err != nil {
				slog.Error("feed permission bootstrap failed", "error", err)
				os.Exit(1)
			}
			return
		}
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			slog.Error("schema application failed", "error", err)
			os.Exit(1)
		}
		select {
		case <-ctx.Done():
			slog.Error("schema application failed", "error", err)
			os.Exit(1)
		case <-time.After(time.Second):
		}
	}
}
