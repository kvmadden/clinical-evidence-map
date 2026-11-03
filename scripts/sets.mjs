// Every set the evaluation can score, and where it lives. Plain JavaScript so
// both the TypeScript scripts and the report can read it.
//
// holdout-v2 is being written blind by other model families. Nothing here
// creates or reads its folder until it exists, and its first scoring run
// needs a committed freeze. heldOut says how a set was built. Whether it still
// counts as held out is in its ROLE.json, if it has one.
export const SETS = {
  development: { root: "eval", label: "Development", heldOut: false },
  holdout: { root: "eval/holdout", label: "First held-out set", heldOut: true },
  "holdout-v2": {
    root: "eval/holdout-v2",
    label: "Second held-out set",
    heldOut: true,
    // Absent until it is written. Every command skips it cleanly until then.
    optional: true,
  },
  multipage: {
    root: "eval/fixtures/multipage",
    label: "Multi-page fixture",
    heldOut: false,
  },
}

export function setNamed(name) {
  const set = SETS[name]
  if (!set)
    throw new Error(
      `Unknown set ${name}. Sets: ${Object.keys(SETS).join(", ")}`,
    )
  return { name, ...set }
}
