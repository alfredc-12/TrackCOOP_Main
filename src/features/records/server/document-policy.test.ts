import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessDocument,
  canManageDocument,
  canUploadDocument,
} from "./document-policy";

const chairman = { role: "chairman" as const, userId: 1 };
const bookkeeper = { role: "bookkeeper" as const, userId: 2 };
const member = { role: "member" as const, userId: 3, memberId: 30 };
const otherMember = { role: "member" as const, userId: 4, memberId: 40 };

describe("document access policy", () => {
  it("allows public access but rejects anonymous restricted access", () => {
    const publicDocument = {
      accessLevel: "PUBLIC" as const,
      category: "POLICY",
      documentType: "Public Document",
    };
    const restrictedDocument = {
      ...publicDocument,
      accessLevel: "ADMIN_ONLY" as const,
    };
    assert.equal(canAccessDocument(null, publicDocument), true);
    assert.equal(canAccessDocument(null, restrictedDocument), false);
  });

  it("does not expose another member's private document", () => {
    const receipt = {
      accessLevel: "MEMBER_ONLY" as const,
      category: "RECEIPT",
      documentType: "Receipt",
      memberId: 30,
    };
    assert.equal(canAccessDocument(member, receipt), true);
    assert.equal(canAccessDocument(otherMember, receipt), false);
  });

  it("allows every member to read a general member-only document", () => {
    const announcement = {
      accessLevel: "MEMBER_ONLY" as const,
      category: "ANNOUNCEMENT",
      documentType: "Public Document",
      memberId: null,
    };
    assert.equal(canAccessDocument(member, announcement), true);
    assert.equal(canAccessDocument(otherMember, announcement), true);
  });

  it("keeps admin-only documents unavailable to bookkeepers", () => {
    const adminFinancial = {
      accessLevel: "ADMIN_ONLY" as const,
      category: "FINANCIAL",
      documentType: "Financial Document",
    };
    assert.equal(canAccessDocument(chairman, adminFinancial), true);
    assert.equal(canAccessDocument(bookkeeper, adminFinancial), false);
    assert.equal(canManageDocument(bookkeeper, adminFinancial), false);
  });

  it("limits bookkeeper uploads to non-admin financial records", () => {
    const financial = {
      accessLevel: "BOOKKEEPER_ONLY" as const,
      category: "FINANCIAL",
      documentType: "Financial Document",
    };
    const policy = {
      accessLevel: "PUBLIC" as const,
      category: "POLICY",
      documentType: "Public Document",
    };
    assert.equal(canUploadDocument(bookkeeper, financial), true);
    assert.equal(canUploadDocument(bookkeeper, policy), false);
    assert.equal(canUploadDocument(chairman, policy), true);
  });
});
