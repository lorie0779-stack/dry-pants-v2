/**
 * 前後端傳說池同步測試：LEGENDARY_POOL 的 id 順序必須與
 * shared/legendary_pool_ids.json 逐項一致（後端 pytest 有對稱測試）。
 *
 * 為什麼：slot_order / pokemon_index 是「指進這張表的索引」，兩邊內容漂移
 * （換隻、調序）時 claim 會把錯誤的 species_id 永久寫進身分清單——
 * 長度 assert 擋不住同長度的內容改動，只有逐項比對能在 CI 攔截。
 */
import fs from "fs";
import path from "path";
import { LEGENDARY_POOL } from "@/components/DryPantsApp";

describe("傳說池前後端同步", () => {
  it("LEGENDARY_POOL 的 id 序列與 shared fixture 逐項一致", () => {
    const fixturePath = path.join(
      __dirname,
      "..",
      "..",
      "shared",
      "legendary_pool_ids.json",
    );
    const shared: number[] = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    expect(LEGENDARY_POOL.map((p) => p.id)).toEqual(shared);
  });

  it("無重複 id（species 身分空間必須唯一）", () => {
    const ids = LEGENDARY_POOL.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
