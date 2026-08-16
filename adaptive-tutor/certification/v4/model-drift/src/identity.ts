import { createHash } from "node:crypto";
import {
  CERTIFICATION_IDENTITY_FIELDS,
  type CertificationIdentity,
  type CertificationIdentityField,
  type Sha256Digest,
} from "./contracts.js";

function canonicalIdentity(identity: CertificationIdentity): Record<CertificationIdentityField, string> {
  return Object.fromEntries(CERTIFICATION_IDENTITY_FIELDS.map((field) => [field, identity[field]])) as
    Record<CertificationIdentityField, string>;
}

export function computeCertificationIdentityDigest(identity: CertificationIdentity): Sha256Digest {
  const digest = createHash("sha256")
    .update(JSON.stringify(canonicalIdentity(identity)), "utf8")
    .digest("hex");
  return `sha256:${digest}`;
}

export function changedCertificationIdentityFields(
  certified: CertificationIdentity,
  observed: CertificationIdentity,
): readonly CertificationIdentityField[] {
  return CERTIFICATION_IDENTITY_FIELDS.filter((field) => certified[field] !== observed[field]);
}

export function certificationIdentitiesEqual(
  left: CertificationIdentity,
  right: CertificationIdentity,
): boolean {
  return changedCertificationIdentityFields(left, right).length === 0;
}
