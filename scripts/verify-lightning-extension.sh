#!/usr/bin/env bash
set -euo pipefail
repository_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
probe_dir="$(mktemp -d "${TMPDIR:-/tmp}/simple-strike-extension.XXXXXXXX")"
trap 'rm -rf -- "$probe_dir"' EXIT
cd "$probe_dir"
go mod init example.test/private-lightning-adapter
go mod edit -require=github.com/elsell/simple-strike/apps/api@v0.0.0
go mod edit "-replace=github.com/elsell/simple-strike/apps/api=$repository_root/apps/api"
cat > source_test.go <<'GO'
package extension_test

import (
 "context"
 "github.com/elsell/simple-strike/apps/api/bootstrap"
 "testing"

 "github.com/elsell/simple-strike/apps/api/pkg/lightning/domain"
 "github.com/elsell/simple-strike/apps/api/pkg/lightning/ports"
)

type independentSource struct{}
func (independentSource) Read(ctx context.Context, _ ports.Window) (domain.Batch,error) {
 if err:=ctx.Err();err!=nil {return domain.Batch{},err}
 return domain.Batch{Mode:domain.Demo,Observations:[]domain.Observation{}},nil
}

func TestExternalAdapterCanImplementSource(t *testing.T) {
 var factory bootstrap.SourceFactory=func(context.Context,ports.Clock)(ports.Source,error){return independentSource{},nil}
 _=factory
 var source ports.Source=independentSource{}
 batch,err:=source.Read(context.Background(),ports.Window{})
 if err!=nil || batch.Mode!=domain.Demo {t.Fatalf("unexpected adapter result: %+v, %v",batch,err)}
}
GO
go test -mod=mod ./...
