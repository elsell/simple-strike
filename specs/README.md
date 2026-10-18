# Specification Coverage

| Area | Authority | Status |
| --- | --- | --- |
| Public bootstrap | [Bootstrap](platform/bootstrap.spec.md) | Required now |
| Platform boundaries | [Architecture](platform/architecture.spec.md) | Generated |
| Verification | [Testing](platform/testing.spec.md) | Generated |
| Delivery | [Roadmap](platform/roadmap.spec.md) | Navigation in progress; map and connection awaiting verification |
| Lightning map | [Map](lightning/map.spec.md) | Core behavior approved; edge cases open |
| Data source | [Data source](lightning/data-source.spec.md) | Single-adapter backend and OIDC approved |
| Backend connection | [Connection](lightning/connection.spec.md) | Single-backend setup and session isolation |
| Navigation | [Navigation](navigation/navigation.spec.md) | Optional driving navigation and active-route background guidance approved |
| CarPlay | [Native CarPlay](navigation/carplay.spec.md) | Scene integration in progress; native evidence and entitlement pending |
| Audit | [Audit](audit/audit.spec.md) | Generated |

Consequential open questions require explicit product approval. Routine choices
follow established platform conventions under the user's authorization. Other generated domain specs
describe inherited platform capabilities, not product decisions.
