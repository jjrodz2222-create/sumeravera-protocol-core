# Governance Issue Draft: Fraud Defense Rollout

Use this body when opening the tracking issue in GitHub.

## Title
`Governance: Fraud Defense Rollout Approval and Pilot Tracking`

## Body
### Context
Roll out governed fraud-defense controls for ingress and settlement with measurable quality and safety gates.

### RFC
- `/docs/governance/fraud-defense-rfc.md`

### Scope
- [ ] Auth model and key lifecycle controls
- [ ] Replay controls across ingress paths
- [ ] Quarantine/rebalancing policy and handling
- [ ] KPI definitions and reporting cadence
- [ ] Analyst workflow onboarding and runbooks
- [ ] Pilot execution and go/no-go decision

### Owners
- Backend owner: @<owner>
- Security owner: @<owner>
- Fraud/Risk operations owner: @<owner>
- Platform/DevOps owner: @<owner>
- Program/PM owner: @<owner>

### Milestones
- [ ] M1: RFC approval
- [ ] M2: Pilot readiness
- [ ] M3: Pilot complete
- [ ] M4: Executive checkpoint
- [ ] M5: Full rollout approval

### Acceptance Criteria
- [ ] Validation gates pass per phase (`npm test`, `npm run lint`, `npm run build`)
- [ ] CI green on `verify.yml` and `codeql.yml`
- [ ] False-positive rate within approved threshold
- [ ] Review latency within approved threshold
- [ ] No unresolved high-severity security concerns
- [ ] Executive sign-off recorded

### Reviewer Sign-off Required
- [ ] Backend: auth model, replay controls
- [ ] Security: key revocation, mTLS assumptions, abuse paths
- [ ] Fraud/Risk Ops: quarantine policy, case operations, KPI meaning
- [ ] Platform/DevOps: rollout safety, observability, rollback

### Risks / Mitigations
- Risk:
- Mitigation:

### Decision Log
- Date:
- Decision:
- Participants:
- Notes:
