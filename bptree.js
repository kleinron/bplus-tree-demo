/**
 * In-memory B+ tree for leaf-page insert demos (InnoDB-flavored splits).
 *
 * - All keys live in leaves; internal nodes hold separators only.
 * - Leaves are doubly linked left → right.
 *
 * Leaf split when capacity+1 keys:
 *   • Append at the rightmost leaf (sequential / time-ordered path):
 *     InnoDB-style — leave the left page full, put the overflow key(s)
 *     alone on a new right page → dense packing / high fill factor.
 *   • Mid-tree insert (random / scatter path):
 *     Classic ~50/50 split → pages end ~half full.
 *
 * Separator for a leaf split is always the first key of the new right leaf
 * (copied into the parent). Internal overflow moves the middle key up.
 */

export class BPlusTree {
  /** @param {number} capacity max keys per leaf / max separators per internal */
  constructor(capacity = 6) {
    if (capacity < 2) throw new Error("capacity must be >= 2");
    this.capacity = capacity;
    this.root = this._newLeaf();
    this.leafCount = 1;
    this.splitCount = 0; // leaf splits only (the InnoDB story)
    this.internalSplitCount = 0;
    this.insertCount = 0;
    this.lastKey = null;
    /** @type {string[]} */
    this.lastSplitLeafIds = [];
    /** @type {string|null} */
    this.lastTargetLeafId = null;
  }

  _newLeaf() {
    return {
      id: crypto.randomUUID(),
      type: "leaf",
      keys: /** @type {number[]} */ ([]),
      prev: null,
      next: null,
      parent: null,
    };
  }

  _newInternal() {
    return {
      id: crypto.randomUUID(),
      type: "internal",
      keys: /** @type {number[]} */ ([]),
      children: /** @type {any[]} */ ([]),
      parent: null,
    };
  }

  leftmostLeaf() {
    let n = this.root;
    while (n.type === "internal") n = n.children[0];
    return n;
  }

  rightmostLeaf() {
    let n = this.root;
    while (n.type === "internal") n = n.children[n.children.length - 1];
    return n;
  }

  leaves() {
    const out = [];
    for (let L = this.leftmostLeaf(); L; L = L.next) out.push(L);
    return out;
  }

  fillFactor() {
    const leaves = this.leaves();
    if (!leaves.length) return 0;
    const occ = leaves.reduce((s, l) => s + l.keys.length, 0);
    return occ / (leaves.length * this.capacity);
  }

  findLeaf(key) {
    let n = this.root;
    while (n.type === "internal") {
      let i = 0;
      while (i < n.keys.length && key >= n.keys[i]) i++;
      n = n.children[i];
    }
    return n;
  }

  /** @returns {{ split: boolean, mode: 'none'|'append'|'mid' }} */
  insert(key) {
    this.lastSplitLeafIds = [];
    const leaf = this.findLeaf(key);
    this.lastTargetLeafId = leaf.id;

    if (leaf.keys.includes(key)) return { split: false, mode: "none" };

    let i = 0;
    while (i < leaf.keys.length && leaf.keys[i] < key) i++;
    leaf.keys.splice(i, 0, key);

    this.insertCount++;
    this.lastKey = key;

    if (leaf.keys.length <= this.capacity) return { split: false, mode: "none" };

    const mode = this._splitLeaf(leaf);
    return { split: true, mode };
  }

  /**
   * Decide append vs mid split, then split.
   * Append = this is the rightmost leaf AND the inserted key is the max
   * (i.e. we appended at the right edge) — InnoDB optimistic/sequential path.
   */
  _splitLeaf(leaf) {
    const all = leaf.keys.slice(); // length === capacity + 1
    const isRightmost = leaf === this.rightmostLeaf() || leaf.next === null;
    // After insert, if the max key is at the end and we are rightmost, it's an append overflow.
    // More precisely: the new key landed at the last position.
    const appended =
      isRightmost && all[all.length - 1] === this.lastKey;

    let leftKeys;
    let rightKeys;
    let mode;

    if (appended) {
      // InnoDB-style: keep left page full; new page starts with the overflow key.
      leftKeys = all.slice(0, this.capacity);
      rightKeys = all.slice(this.capacity);
      mode = "append";
    } else {
      const mid = Math.floor(all.length / 2);
      leftKeys = all.slice(0, mid);
      rightKeys = all.slice(mid);
      mode = "mid";
    }

    leaf.keys = leftKeys;

    const right = this._newLeaf();
    right.keys = rightKeys;
    right.next = leaf.next;
    right.prev = leaf;
    if (leaf.next) leaf.next.prev = right;
    leaf.next = right;

    this.leafCount++;
    this.splitCount++;
    this.lastSplitLeafIds = [leaf.id, right.id];

    const separator = right.keys[0];

    if (!leaf.parent) {
      const root = this._newInternal();
      root.keys = [separator];
      root.children = [leaf, right];
      leaf.parent = root;
      right.parent = root;
      this.root = root;
      return mode;
    }

    right.parent = leaf.parent;
    this._insertIntoParent(leaf.parent, leaf, separator, right);
    return mode;
  }

  _insertIntoParent(parent, leftChild, separator, rightChild) {
    const idx = parent.children.indexOf(leftChild);
    if (idx < 0) throw new Error("left child not in parent");
    parent.keys.splice(idx, 0, separator);
    parent.children.splice(idx + 1, 0, rightChild);
    rightChild.parent = parent;

    if (parent.keys.length <= this.capacity) return;
    this._splitInternal(parent);
  }

  _splitInternal(node) {
    const keys = node.keys.slice();
    const children = node.children.slice();
    const mid = Math.floor(keys.length / 2);
    const upKey = keys[mid];

    const leftKeys = keys.slice(0, mid);
    const rightKeys = keys.slice(mid + 1);
    const leftChildren = children.slice(0, mid + 1);
    const rightChildren = children.slice(mid + 1);

    node.keys = leftKeys;
    node.children = leftChildren;
    for (const c of leftChildren) c.parent = node;

    const right = this._newInternal();
    right.keys = rightKeys;
    right.children = rightChildren;
    for (const c of rightChildren) c.parent = right;

    this.internalSplitCount++;

    if (!node.parent) {
      const root = this._newInternal();
      root.keys = [upKey];
      root.children = [node, right];
      node.parent = root;
      right.parent = root;
      this.root = root;
      return;
    }

    right.parent = node.parent;
    this._insertIntoParent(node.parent, node, upKey, right);
  }
}
