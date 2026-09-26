import { describe, expect, it } from "vitest";
import { findMatches, hasMatch } from "../matcher";
import { boardFrom, cell, keys } from "./helpers";

// Filler letters a..w are all distinct within each board, so only the intended runs match.

describe("findMatches: basic runs", () => {
  it("finds nothing on a board without runs", () => {
    const board = boardFrom(["abcde", "fghij", "klmno", "pqrst", "uvwxy"]);
    expect(findMatches(board)).toEqual([]);
    expect(hasMatch(board)).toBe(false);
  });

  it("classifies a horizontal 3-run as line3 with no special", () => {
    const board = boardFrom(["abcde", "fghij", "xxxlm", "nopqr", "stuvw"]);
    const [cluster, ...rest] = findMatches(board);
    expect(rest).toHaveLength(0);
    expect(cluster.kind).toBe("line3");
    expect(cluster.spawnAt).toBeNull();
    expect(cluster.spawnSpecial).toBeNull();
    expect(keys(cluster.cells)).toEqual(["2,0", "2,1", "2,2"]);
  });

  it("classifies a vertical 3-run as line3", () => {
    const board = boardFrom(["axcde", "fxhij", "kxmno", "pqrst", "uvwyz"]);
    const [cluster] = findMatches(board);
    expect(cluster.kind).toBe("line3");
    expect(keys(cluster.cells)).toEqual(["0,1", "1,1", "2,1"]);
  });
});

describe("findMatches: 4-runs", () => {
  it("horizontal 4-run spawns striped-row at the near-center cell and excludes it from cells", () => {
    const board = boardFrom(["xxxxa", "bcdef", "ghijk", "lmnop", "qrstu"]);
    const [cluster] = findMatches(board);
    expect(cluster.kind).toBe("line4");
    expect(cluster.spawnSpecial).toBe("striped-row");
    expect(cluster.spawnAt).toEqual(cell(0, 1)); // even length ties toward the earlier cell
    expect(keys(cluster.cells)).toEqual(["0,0", "0,2", "0,3"]);
  });

  it("vertical 4-run spawns striped-col", () => {
    const board = boardFrom(["xabcd", "xefgh", "xijkl", "xmnop", "qrstu"]);
    const [cluster] = findMatches(board);
    expect(cluster.kind).toBe("line4");
    expect(cluster.spawnSpecial).toBe("striped-col");
    expect(cluster.spawnAt).toEqual(cell(1, 0));
    expect(cluster.cells).toHaveLength(3);
  });

  it("prefers the tile the player dragged into", () => {
    const board = boardFrom(["xxxxa", "bcdef", "ghijk", "lmnop", "qrstu"]);
    const [cluster] = findMatches(board, { from: cell(1, 3), to: cell(0, 3) });
    expect(cluster.spawnAt).toEqual(cell(0, 3));
    expect(keys(cluster.cells)).toEqual(["0,0", "0,1", "0,2"]);
  });

  it("falls back to the origin cell when the target is not in the cluster", () => {
    const board = boardFrom(["xxxxa", "bcdef", "ghijk", "lmnop", "qrstu"]);
    const [cluster] = findMatches(board, { from: cell(0, 2), to: cell(1, 2) });
    expect(cluster.spawnAt).toEqual(cell(0, 2));
  });

  it("falls back to the near-center cell when the swap cells are not in the cluster", () => {
    const board = boardFrom(["xxxxa", "bcdef", "ghijk", "lmnop", "qrstu"]);
    const [cluster] = findMatches(board, { from: cell(3, 3), to: cell(3, 4) });
    expect(cluster.spawnAt).toEqual(cell(0, 1));
  });
});

describe("findMatches: 5-runs and priority", () => {
  it("5-run spawns super at the true center", () => {
    const board = boardFrom(["abcde", "fghij", "xxxxx", "klmno", "pqrst"]);
    const [cluster] = findMatches(board);
    expect(cluster.kind).toBe("line5");
    expect(cluster.spawnSpecial).toBe("super");
    expect(cluster.spawnAt).toEqual(cell(2, 2));
    expect(cluster.cells).toHaveLength(4);
  });

  it("a 5-run wins over a crossing perpendicular run and yields exactly one special", () => {
    const board = boardFrom(["abxde", "fgxij", "xxxxx", "klxno", "pqrst"]);
    const clusters = findMatches(board);
    expect(clusters).toHaveLength(1);
    const [cluster] = clusters;
    expect(cluster.kind).toBe("line5");
    expect(cluster.spawnSpecial).toBe("super");
    expect(cluster.spawnAt).toEqual(cell(2, 2));
    // 5-run + 4-run (col 2, rows 0-3) share one cell = 8 tiles; the spawn cell is excluded
    expect(cluster.cells).toHaveLength(7);
  });

  it("6 in a row is still a single line5 cluster", () => {
    const board = boardFrom(["xxxxxxab", "cdefghij", "klmnopqr"]);
    const clusters = findMatches(board);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].kind).toBe("line5");
    expect(clusters[0].spawnAt).toEqual(cell(0, 2));
  });
});

describe("findMatches: L/T shapes", () => {
  it("T-shape spawns wrapped at the intersection", () => {
    const board = boardFrom(["xxxab", "cxdef", "gxhij", "klmno", "pqrst"]);
    const [cluster, ...rest] = findMatches(board);
    expect(rest).toHaveLength(0);
    expect(cluster.kind).toBe("lt-shape");
    expect(cluster.spawnSpecial).toBe("wrapped");
    expect(cluster.spawnAt).toEqual(cell(0, 1));
    expect(cluster.cells).toHaveLength(4);
  });

  it("L-shape spawns wrapped at the corner", () => {
    const board = boardFrom(["xabcd", "xefgh", "xxxij", "klmno", "pqrst"]);
    const [cluster] = findMatches(board);
    expect(cluster.kind).toBe("lt-shape");
    expect(cluster.spawnAt).toEqual(cell(2, 0));
  });

  it("L/T outranks a 4-run inside the same cluster", () => {
    const board = boardFrom(["xxxxa", "bxcde", "fxghi", "jklmn", "opqrs"]);
    const [cluster] = findMatches(board);
    expect(cluster.kind).toBe("lt-shape");
    expect(cluster.spawnSpecial).toBe("wrapped");
    expect(cluster.spawnAt).toEqual(cell(0, 1));
  });

  it("prefers the swap cell over the intersection for the wrapped spawn", () => {
    const board = boardFrom(["xxxab", "cxdef", "gxhij", "klmno", "pqrst"]);
    const [cluster] = findMatches(board, { from: cell(0, 3), to: cell(0, 2) });
    expect(cluster.spawnAt).toEqual(cell(0, 2));
  });
});

describe("findMatches: cluster merging", () => {
  it("does not merge a horizontal and a vertical run that merely touch diagonally", () => {
    const board = boardFrom(["xxxab", "cdexf", "ghixj", "klmxn", "opqrs"]);
    const clusters = findMatches(board);
    expect(clusters).toHaveLength(2);
    expect(clusters.map((c) => c.kind)).toEqual(["line3", "line3"]);
    expect(clusters.every((c) => c.spawnAt === null)).toBe(true);
  });

  it("does not merge runs of different characters that are adjacent", () => {
    const board = boardFrom(["xxxab", "yyycd", "efghi", "jklmn", "opqrs"]);
    expect(findMatches(board)).toHaveLength(2);
  });

  it("keeps two far-apart matches of the same character separate", () => {
    const board = boardFrom(["xxxab", "cdefg", "hijkl", "mnopq", "xxxrs"]);
    expect(findMatches(board)).toHaveLength(2);
  });
});

describe("findMatches: existing specials", () => {
  it("never hosts the new special on a tile that is already special", () => {
    const board = boardFrom(["xxxxa", "bcdef", "ghijk", "lmnop", "qrstu"], { "0,1": "wrapped" });
    const [cluster] = findMatches(board);
    expect(cluster.kind).toBe("line4");
    expect(cluster.spawnAt).not.toEqual(cell(0, 1));
    expect(cluster.spawnAt).not.toBeNull();
    // the existing special stays in `cells` so it gets activated
    expect(keys(cluster.cells)).toContain("0,1");
    expect(cluster.cells).toHaveLength(3);
  });

  it("spawns nothing when every tile in the cluster is already special", () => {
    const board = boardFrom(["xxxxa", "bcdef", "ghijk", "lmnop", "qrstu"], {
      "0,0": "wrapped",
      "0,1": "wrapped",
      "0,2": "wrapped",
      "0,3": "wrapped",
    });
    const [cluster] = findMatches(board);
    expect(cluster.spawnAt).toBeNull();
    expect(cluster.spawnSpecial).toBeNull();
    expect(cluster.cells).toHaveLength(4);
  });
});
