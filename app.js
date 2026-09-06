import { BPlusTree } from "./bptree.js";

const $ = (id) => document.getElementById(id);

const DEMO_INTERVAL_MS = 50;

const state = {
  capacity: 6,
  random: null,
  seq: null,
  seqCounter: 0,
  running: false,
  demoMode: false,
  timer: null,
  speed: 280,
  targetN: 100,
};

function readTargetN() {
  const raw = Number($("n-target").value);
  const n = Number.isFinite(raw) ? Math.round(raw) : 100;
  return Math.min(5000, Math.max(10, n));
}

function makeTrees() {
  state.capacity = Number($("capacity").value);
  state.random = new BPlusTree(state.capacity);
  state.seq = new BPlusTree(state.capacity);
  state.seqCounter = 0;
  updateVerdict();
  renderBoth();
}

function randomKey() {
  return (Math.random() * 0xffffffff) >>> 0;
}

function nextSeqKey() {
  state.seqCounter += 1;
  return state.seqCounter;
}

function fmtKey(k) {
  if (k == null) return "—";
  return "0x" + (k >>> 0).toString(16).padStart(8, "0");
}

function updateVerdict() {
  const v4 = state.random;
  const v7 = state.seq;
  const bar = $("verdict");

  if (!v4 || v4.insertCount === 0) {
    $("verdict-fill").textContent = "v7 — fill";
    $("verdict-splits").textContent = "v7 — splits";
    bar.classList.add("is-empty");
    return;
  }

  bar.classList.remove("is-empty");
  const fill4 = v4.fillFactor();
  const fill7 = v7.fillFactor();
  const splits4 = v4.splitCount;
  const splits7 = v7.splitCount;

  let fillDeltaPct = 0;
  if (fill4 > 0) {
    fillDeltaPct = Math.round(((fill7 - fill4) / fill4) * 100);
  } else if (fill7 > 0) {
    fillDeltaPct = 100;
  }

  let splitsDeltaPct = 0;
  if (splits4 > 0) {
    splitsDeltaPct = Math.round(((splits4 - splits7) / splits4) * 100);
  }

  const fillSign = fillDeltaPct >= 0 ? "+" : "";
  const splitsSign = splitsDeltaPct >= 0 ? "−" : "+";
  const splitsAbs = Math.abs(splitsDeltaPct);

  $("verdict-fill").textContent = `v7 ${fillSign}${fillDeltaPct}% fill`;
  $("verdict-splits").textContent =
    splits4 === 0 && splits7 === 0
      ? `v7 0% splits`
      : `v7 ${splitsSign}${splitsAbs}% splits`;
}

function renderTree(tree, viewId, fillId, leavesId, splitsId, nId, lastId, justKey) {
  const view = $(viewId);
  const leaves = tree.leaves();
  const cap = tree.capacity;

  view.innerHTML = "";
  for (const leaf of leaves) {
    const row = document.createElement("div");
    row.className = "leaf";
    row.dataset.id = leaf.id;
    if (leaf.id === tree.lastTargetLeafId) row.classList.add("target");
    if (tree.lastSplitLeafIds.includes(leaf.id)) row.classList.add("split-pulse");

    for (let s = 0; s < cap; s++) {
      const slot = document.createElement("div");
      slot.className = "slot";
      if (s < leaf.keys.length) {
        slot.classList.add("filled");
        const k = leaf.keys[s];
        slot.textContent = k > 0xffff ? k.toString(16).slice(-4) : String(k);
        if (justKey != null && k === justKey) slot.classList.add("just-in");
      }
      row.appendChild(slot);
    }
    view.appendChild(row);
  }

  const fill = tree.fillFactor();
  $(fillId).textContent = Math.round(fill * 100) + "%";
  $(leavesId).textContent = String(tree.leafCount);
  $(splitsId).textContent = String(tree.splitCount);
  $(nId).textContent = String(tree.insertCount);
  $(lastId).textContent = "last " + fmtKey(tree.lastKey);
}

function renderBoth(justRandom, justSeq) {
  renderTree(
    state.random,
    "leaves-random-view",
    "fill-random",
    "leaves-random",
    "splits-random",
    "n-random",
    "last-random",
    justRandom
  );
  renderTree(
    state.seq,
    "leaves-seq-view",
    "fill-seq",
    "leaves-seq",
    "splits-seq",
    "n-seq",
    "last-seq",
    justSeq
  );
  updateVerdict();
}

function stepOnce() {
  let rk;
  do {
    rk = randomKey();
  } while (state.random.findLeaf(rk).keys.includes(rk));

  const sk = nextSeqKey();
  state.random.insert(rk);
  state.seq.insert(sk);
  renderBoth(rk, sk);
}

function clearTimer() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

function setControlsForRun(on, { demo = false } = {}) {
  state.running = on;
  state.demoMode = demo && on;
  $("btn-demo").disabled = on;
  $("btn-start").disabled = on;
  $("btn-pause").disabled = !on;
  $("btn-step").disabled = on;
  $("btn-burst").disabled = on;
  $("capacity").disabled = on || state.random.insertCount > 0;
  $("n-target").disabled = on || state.random.insertCount > 0;
  $("btn-demo").classList.toggle("demo-running", state.demoMode);
}

function setRunning(on) {
  clearTimer();
  setControlsForRun(on, { demo: false });
  if (on) {
    state.timer = setInterval(stepOnce, state.speed);
  }
}

function freeze() {
  clearTimer();
  setControlsForRun(false, { demo: false });
  updateVerdict();
}

function runDemo() {
  clearTimer();
  state.targetN = readTargetN();
  $("n-target").value = String(state.targetN);
  makeTrees();
  $("capacity").disabled = true;
  $("n-target").disabled = true;
  setControlsForRun(true, { demo: true });

  state.timer = setInterval(() => {
    if (state.random.insertCount >= state.targetN) {
      freeze();
      return;
    }
    stepOnce();
    if (state.random.insertCount >= state.targetN) {
      freeze();
    }
  }, DEMO_INTERVAL_MS);
}

$("btn-demo").addEventListener("click", () => runDemo());
$("btn-start").addEventListener("click", () => setRunning(true));
$("btn-pause").addEventListener("click", () => freeze());
$("btn-step").addEventListener("click", () => {
  if (!state.running) stepOnce();
});
$("btn-reset").addEventListener("click", () => {
  freeze();
  makeTrees();
  $("capacity").disabled = false;
  $("n-target").disabled = false;
});
$("btn-burst").addEventListener("click", () => {
  if (state.running) return;
  for (let i = 0; i < 20; i++) stepOnce();
});
$("capacity").addEventListener("change", () => {
  if (state.random.insertCount === 0) makeTrees();
});
$("n-target").addEventListener("change", () => {
  $("n-target").value = String(readTargetN());
});
$("speed").addEventListener("input", (e) => {
  state.speed = Number(e.target.value);
  if (state.running && !state.demoMode) {
    setRunning(false);
    setRunning(true);
  }
});

makeTrees();
