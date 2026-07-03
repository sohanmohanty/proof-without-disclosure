/** Merkle trees, byte-identical to the Python implementation.
 *
 * Design choices (details in docs/format-spec.md and the MerkleLab page):
 *  - RFC 6962 domain separation: leaf = H(0x00 || item),
 *    node = H(0x01 || left || right) — blocks node-as-leaf proof forgery;
 *  - odd nodes are promoted, not duplicated — avoids the ambiguity behind
 *    Bitcoin's CVE-2012-2459.
 */

import { sha256Bytes } from "./hash";
import { bytesToHex, concatBytes, hexToBytes, utf8 } from "./hex";

const LEAF_PREFIX = new Uint8Array([0x00]);
const NODE_PREFIX = new Uint8Array([0x01]);

export interface ProofStep {
  position: "left" | "right"; // which side the sibling sits on
  hash: string;               // sibling hash, hex
}

export interface MerkleTree {
  items: string[];
  levels: Uint8Array[][]; // levels[0] = leaves, levels[last] = [root]
}

export async function hashLeaf(item: string): Promise<Uint8Array> {
  return sha256Bytes(concatBytes(LEAF_PREFIX, utf8(item)));
}

export async function hashNode(
  left: Uint8Array,
  right: Uint8Array,
): Promise<Uint8Array> {
  return sha256Bytes(concatBytes(NODE_PREFIX, left, right));
}

export function rootOf(tree: MerkleTree): string {
  return bytesToHex(tree.levels[tree.levels.length - 1][0]);
}

export async function buildTree(items: string[]): Promise<MerkleTree> {
  if (items.length === 0) {
    throw new Error("cannot build a Merkle tree from an empty list");
  }
  const leaves = await Promise.all(items.map(hashLeaf));
  const levels: Uint8Array[][] = [leaves];
  while (levels[levels.length - 1].length > 1) {
    const current = levels[levels.length - 1];
    const parents: Uint8Array[] = [];
    for (let i = 0; i + 1 < current.length; i += 2) {
      parents.push(await hashNode(current[i], current[i + 1]));
    }
    if (current.length % 2 === 1) {
      parents.push(current[current.length - 1]); // promote unchanged
    }
    levels.push(parents);
  }
  return { items: [...items], levels };
}

export function generateProof(tree: MerkleTree, index: number): ProofStep[] {
  if (index < 0 || index >= tree.levels[0].length) {
    throw new Error(`leaf index ${index} out of range`);
  }
  const path: ProofStep[] = [];
  for (let levelIdx = 0; levelIdx < tree.levels.length - 1; levelIdx++) {
    const level = tree.levels[levelIdx];
    const sibling = index ^ 1;
    if (sibling < level.length) {
      path.push({
        position: sibling < index ? "left" : "right",
        hash: bytesToHex(level[sibling]),
      });
    }
    index = Math.floor(index / 2);
  }
  return path;
}

export async function verifyProof(
  item: string,
  path: ProofStep[],
  root: string,
): Promise<boolean> {
  let current = await hashLeaf(item);
  for (const step of path) {
    const sibling = hexToBytes(step.hash);
    if (step.position === "left") {
      current = await hashNode(sibling, current);
    } else if (step.position === "right") {
      current = await hashNode(current, sibling);
    } else {
      throw new Error(`invalid proof position: ${String(step.position)}`);
    }
  }
  return bytesToHex(current) === root.trim().toLowerCase();
}
