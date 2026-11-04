import { test } from "node:test";
import assert from "node:assert";
import { effectiveState } from "./categoryTree.ts";
import type { AdminCategory } from "./types.ts";

function cat(p: Partial<AdminCategory> & { id: string; publishState: AdminCategory["publishState"] }): AdminCategory {
  return { name: "x", activeQuestionCount: 0, ...p };
}

test("ebeveyni yok, kendi durumunu döner", () => {
  const a = cat({ id: "a", publishState: "Active" });
  assert.strictEqual(effectiveState(a, [a]), "Active");
});

test("ebeveyn Hidden, kendi Active'i geçersiz kılar", () => {
  const p = cat({ id: "p", publishState: "Hidden" });
  const c = cat({ id: "c", parentCategoryId: "p", publishState: "Active" });
  assert.strictEqual(effectiveState(c, [p, c]), "Hidden");
});

test("büyükebeveyn Hidden, Active ebeveyn üzerinden torunu etkiler (çok seviyeli)", () => {
  const g = cat({ id: "g", publishState: "Hidden" });
  const p = cat({ id: "p", parentCategoryId: "g", publishState: "Active" });
  const c = cat({ id: "c", parentCategoryId: "p", publishState: "Active" });
  assert.strictEqual(effectiveState(c, [g, p, c]), "Hidden");
});

test("listede olmayan ebeveyn id'si — kendi durumuna düşer, çökmez", () => {
  const c = cat({ id: "c", parentCategoryId: "ghost", publishState: "Active" });
  assert.strictEqual(effectiveState(c, [c]), "Active");
});

test("kendi kendinin ebeveyni (self-cycle) — çökmeden kendi durumunu döner", () => {
  const c = cat({ id: "c", parentCategoryId: "c", publishState: "Active" });
  assert.strictEqual(effectiveState(c, [c]), "Active");
});

test("iki kategori birbirinin ebeveyni (A<->B cycle) — çökmeden sonuçlanır", () => {
  const a = cat({ id: "a", parentCategoryId: "b", publishState: "Active" });
  const b = cat({ id: "b", parentCategoryId: "a", publishState: "Hidden" });
  assert.doesNotThrow(() => effectiveState(a, [a, b]));
  assert.doesNotThrow(() => effectiveState(b, [a, b]));
});
