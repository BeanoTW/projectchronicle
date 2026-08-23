// Phase 1 — source-agnostic ports only. There is intentionally no storage
// implementation and no production import of these interfaces.
import type {
  DossierMembership,
  OrganisationalDetails,
  V2Clarification,
  V2Media,
  V2Proposal,
  V2Record,
  V2RecordEvent,
  V2RecordRelationship,
  Uuid,
} from './schema';

export interface SealRecordInput {
  id: Uuid;
  owner_id: Uuid;
  kind: V2Record['kind'];
  original: V2Record['original'];
  captured_at: string;
  sealed_at: string;
}

/** Read access may be backed by legacy, canonical or compatibility sources. */
export interface CanonicalRecordReader {
  get(ownerId: Uuid, recordId: Uuid): Promise<V2Record | null>;
  list(ownerId: Uuid): Promise<readonly V2Record[]>;
}

/** The writer exposes no operation capable of replacing `original`. */
export interface CanonicalRecordWriter {
  seal(input: SealRecordInput): Promise<V2Record>;
  updateDetails(ownerId: Uuid, recordId: Uuid, expectedRevision: number, patch: Partial<Omit<OrganisationalDetails, 'revision_count'>>): Promise<V2Record>;
  appendClarification(value: V2Clarification): Promise<void>;
  setDossierMembership(ownerId: Uuid, recordId: Uuid, membership: DossierMembership): Promise<void>;
  appendMedia(value: V2Media): Promise<void>;
  appendHistory(value: V2RecordEvent): Promise<void>;
}

export interface ProposalPort {
  listProposed(ownerId: Uuid, recordId: Uuid): Promise<readonly V2Proposal[]>;
  accept(ownerId: Uuid, proposalId: Uuid, acceptedValue: unknown): Promise<void>;
  dismiss(ownerId: Uuid, proposalId: Uuid): Promise<void>;
}

export interface RelationshipPort {
  listForRecord(ownerId: Uuid, recordId: Uuid): Promise<readonly V2RecordRelationship[]>;
  add(value: V2RecordRelationship): Promise<void>;
  remove(ownerId: Uuid, relationshipId: Uuid, removedAt: string): Promise<void>;
}

/** Derived systems can read canonical records but cannot write them. */
export interface DerivedRecordSource {
  getForDerivation(ownerId: Uuid, recordId: Uuid): Promise<Readonly<V2Record> | null>;
}
