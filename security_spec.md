# Security Specification & Threat Model

This document outlines the security invariants, threat models, and validation tests for the **Smart Yield & Cost Tracker Pro** Firestore database schema.

## 1. Data Invariants

1. **User Isolation (Identity Safeguard)**: An ingredient document's `uid` must strictly match the authenticated user's `request.auth.uid`. No user can create, read, update, or delete another user's ingredients.
2. **Positive Weights & Prices (Integrity Safeguard)**: Both `grossWeight`, `netWeight`, and `totalPurchasePrice` must be numbers greater than zero.
3. **Yield Boundary Integrity (Logic Invariant)**: `netWeight` must be less than or equal to `grossWeight`.
4. **Strict Schema Constraints**: No undefined or "ghost" fields are allowed. All updates must limit affected keys to recognized fields.
5. **Immutable Identity**: Once created, the owner field `uid` cannot be modified or re-assigned to another user.

---

## 2. The "Dirty Dozen" Payloads (Threat Vectors)

Here are twelve payloads designed to bypass the database invariants. The security rules are configured to reject all of them with `PERMISSION_DENIED`.

### Payload 1: Identity Hijack (Create)
Attempting to create an ingredient where `uid` belongs to a different user.
```json
{
  "name": "Salmon",
  "category": "seafood",
  "grossWeight": 10.0,
  "netWeight": 8.0,
  "totalPurchasePrice": 3000,
  "date": "2026-07-01",
  "uid": "attacker_uid_123"
}
```

### Payload 2: Yield Law Violation (Create)
Attempting to save an ingredient where `netWeight` is greater than `grossWeight` (physically impossible yield > 100%).
```json
{
  "name": "Salmon",
  "category": "seafood",
  "grossWeight": 5.0,
  "netWeight": 6.5,
  "totalPurchasePrice": 2200,
  "date": "2026-07-01",
  "uid": "current_user_uid"
}
```

### Payload 3: Negative Weight (Create)
Attempting to insert a negative `grossWeight`.
```json
{
  "name": "Salmon",
  "category": "seafood",
  "grossWeight": -1.0,
  "netWeight": 0.8,
  "totalPurchasePrice": 2200,
  "date": "2026-07-01",
  "uid": "current_user_uid"
}
```

### Payload 4: Ghost Field Injection (Create)
Attempting to inject a hidden admin flag or shadow property (`isAdmin: true`) during ingredient registration.
```json
{
  "name": "Beef",
  "category": "meat",
  "grossWeight": 2.0,
  "netWeight": 1.5,
  "totalPurchasePrice": 900,
  "date": "2026-07-01",
  "uid": "current_user_uid",
  "isAdmin": true
}
```

### Payload 5: PII Exposure & Read Scraping (List/Get)
Attempting to fetch another user's ingredients without matching their owner `uid`.
```json
// Query
db.collection("ingredients").where("uid", "==", "victim_uid_999").get()
```

### Payload 6: Ownership Stealing (Update)
Attempting to modify the `uid` of an existing ingredient to transfer ownership.
```json
// Original has uid: "current_user_uid"
// Incoming update payload:
{
  "uid": "attacker_uid_123"
}
```

### Payload 7: Invalid Category (Create)
Attempting to set an unsupported category like `hazardous_chemical`.
```json
{
  "name": "Salmon",
  "category": "hazardous_chemical",
  "grossWeight": 5.0,
  "netWeight": 3.6,
  "totalPurchasePrice": 2200,
  "date": "2026-07-01",
  "uid": "current_user_uid"
}
```

### Payload 8: Deny-of-Wallet Long ID (Create)
Attempting to use a 1MB string as a document ID.
```json
// Document ID size limit exceeded
```

### Payload 9: Empty Name String (Create)
Attempting to save an ingredient with an empty name.
```json
{
  "name": "",
  "category": "seafood",
  "grossWeight": 5.0,
  "netWeight": 3.6,
  "totalPurchasePrice": 2200,
  "date": "2026-07-01",
  "uid": "current_user_uid"
}
```

### Payload 10: Value Poisoning (Update)
Attempting to update `totalPurchasePrice` to a string type.
```json
{
  "totalPurchasePrice": "five thousand"
}
```

### Payload 11: Future Date Injection (Create)
Attempting to insert invalid formatting for date.
```json
{
  "name": "Salmon",
  "category": "seafood",
  "grossWeight": 5.0,
  "netWeight": 3.6,
  "totalPurchasePrice": 2200,
  "date": "not_a_date",
  "uid": "current_user_uid"
}
```

### Payload 12: Unauthenticated Write (Create/Update)
Attempting to save or update any ingredients when not signed in at all.

---

## 3. Test Runner Definition

The security tests are implemented to assert `PERMISSION_DENIED` on all Twelve threats above.
Below is the virtual test suite configuration verifying rule integrity.
