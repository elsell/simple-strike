package spicedb

import "testing"

func TestRequiredSchemaComparisonRejectsDrift(t *testing.T) {
	if !schemaCurrent(RequiredSchema) {
		t.Fatal("required schema rejected itself")
	}
	if !schemaCurrent("definition lightning_feed { relation viewer: user | user:* permission view = viewer }\n definition user {}\n\ndefinition resource { relation owner: user permission view = owner permission update = owner permission delete = owner }") {
		t.Fatal("equivalent provider formatting rejected")
	}
	if !schemaCurrent("definition resource { relation owner: user permission view = owner permission update = owner permission delete = owner }\ndefinition user {}\ndefinition lightning_feed { relation viewer: user | user:* permission view = viewer }") {
		t.Fatal("equivalent provider ordering rejected")
	}
	if schemaCurrent("definition user {}") {
		t.Fatal("incomplete schema accepted")
	}
	if schemaCurrent(RequiredSchema + "\ndefinition attacker {}") {
		t.Fatal("unexpected schema expansion accepted")
	}
}
