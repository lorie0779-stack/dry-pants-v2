/**
 * 傳說圖鑑「物種身分制」回歸測試。
 *
 * 修的 bug：舊位置計數制下，slot_order 被後端自癒重洗後，已解鎖格會整批
 * 換成別隻寶可夢（Ryder 抓到的寶可夢與名字對不上）。身分制下，已解鎖格
 * 必須以 unlocked_species（捕獲當下記錄的物種）為準，與 slot_order 無關。
 */
import { render, screen, waitFor } from "@testing-library/react";
import { DryPantsApp } from "@/components/DryPantsApp";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("recharts", () => {
  const React = require("react");
  const Box = ({ children }: { children?: unknown }) =>
    React.createElement("div", { "data-testid": "recharts-stub" }, children);
  return {
    ResponsiveContainer: Box, LineChart: Box, BarChart: Box, PieChart: Box,
    Line: () => null, Bar: () => null, Pie: () => null, Cell: () => null,
    XAxis: () => null, YAxis: () => null, CartesianGrid: () => null,
    Tooltip: () => null, Legend: () => null,
  };
});

jest.mock("@/lib/api", () => ({
  fetchErrorReasons: jest.fn().mockResolvedValue([]),
  fetchErrorRecords: jest.fn().mockResolvedValue([]),
  fetchCollectionState: jest.fn(),
  fetchHonorEntries: jest.fn().mockResolvedValue([]),
  fetchTodayPatrolLog: jest.fn().mockResolvedValue(null),
  fetchCourageTotal: jest.fn().mockResolvedValue(0),
  submitPatrolLog: jest.fn().mockResolvedValue({}),
  saveCollectionState: jest.fn().mockResolvedValue(undefined),
  claimPatrolEncounter: jest.fn().mockResolvedValue({}),
  addHonorEntry: jest.fn().mockResolvedValue({}),
  resetCollectionState: jest.fn().mockResolvedValue(undefined),
  createErrorRecord: jest.fn().mockResolvedValue({}),
}));

import { fetchCollectionState } from "@/lib/api";
const mockFetchCollectionState = fetchCollectionState as jest.Mock;

describe("傳說圖鑑物種身分制", () => {
  it("已解鎖格顯示 unlocked_species 的物種，不受 slot_order 前綴影響（bug 回歸）", async () => {
    // 故意讓兩者不一致：slot_order[0]=0（急凍鳥），但實際捕獲的是 151（夢幻）。
    // 舊位置制會顯示急凍鳥（錯）；身分制必須顯示夢幻。
    mockFetchCollectionState.mockResolvedValue({
      energy: 0,
      unlocked_count: 1,
      coins: 0,
      slot_order: Array.from({ length: 30 }, (_, i) => i),
      unlocked_species: [151], // 夢幻
    });
    render(<DryPantsApp />);

    await waitFor(() => {
      expect(screen.getByAltText("夢幻")).toBeInTheDocument();
    });
    // slot_order[0] 的急凍鳥不得以「已解鎖」樣貌出現（位置制的錯誤行為）
    expect(screen.queryByAltText("急凍鳥")).not.toBeInTheDocument();
    // 計數以身分清單長度為準
    expect(screen.getByText(/1\/30/)).toBeInTheDocument();
  });

  it("後端未帶 unlocked_species（極舊回應）→ 全部視為未解鎖，不崩潰", async () => {
    mockFetchCollectionState.mockResolvedValue({
      energy: 0,
      unlocked_count: 2, // 舊計數存在但無身分清單
      coins: 0,
      slot_order: Array.from({ length: 30 }, (_, i) => i),
    });
    render(<DryPantsApp />);

    await waitFor(() => {
      expect(screen.getByText(/0\/30/)).toBeInTheDocument();
    });
    expect(screen.getAllByAltText("未解鎖").length).toBe(30);
  });
});
