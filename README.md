# B+ tree insert demo — UUIDv4 vs UUIDv7

Static teaching visualization of **leaf-page** insert behavior:

- **Random / UUIDv4** — keys scatter across leaves → mid-page splits, lower fill, more leaf splits
- **Sequential / UUIDv7** — keys append at the right edge → dense packing, higher fill, fewer leaf splits

Mirrors the InnoDB clustered-index insert story without connecting to MySQL.


**Demo:** [https://kleinron.github.io/bplus-tree-demo/](https://kleinron.github.io/bplus-tree-demo/)

## Run

Needs a local static server (ES modules):

```bash
cd bplus-tree-demo
python3 -m http.server 8765
```

Open http://127.0.0.1:8765 — hit **Demo** (default `n=100`, overrideable).

## Controls

- **Capacity** — keys per leaf (4–8, default 6)
- **n** — inserts per Demo run (default 100)
- **Demo** — insert `n` on both panels, then freeze
- Live twin chips in the header: `v7 +N% fill` · `v7 −M% splits` vs v4

## Mechanics (keep honest)

- Keys live only in **leaf** pages; internals are separators
- **Mid-leaf overflow** (~random path): classic ~50/50 leaf split
- **Right-edge append overflow** (~sequential path): leave left leaf full; new right leaf starts with the overflow key (InnoDB-style sequential/optimistic split)
- Metrics shown: **fill %** and **leaf splits** — not AVL/RB rotations
- Header deltas are relative vs the random (v4) arm: fill uplift and split reduction

## Layout

Two panels side by side; each leaf is a fixed-slot bar. Fill and Splits are equal twin heroes; Leaves/`n` stay muted.
