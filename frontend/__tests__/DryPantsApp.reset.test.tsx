/**
 * 「家長專用】重置所有進度」按鈕，reset 後端呼叫失敗分支
 * （DryPantsApp.tsx:1580-1604）。
 *
 * 現況行為：resetCollectionState() 失敗會被 .catch(() => {}) 吞掉，
 * 但後續清零本地 state（energy/coins/unlockedCount/...）與顯示
 * 「🔄 已重置所有進度」訊息完全不受影響——這是「樂觀重置」，前端
 * 不會因為後端失敗而回報使用者任何錯誤，畫面看起來一定成功。
 * 本測試斷言「現況」，此為已知風險（前後端可能不一致），不代表這是預期正確行為。
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const mockResetCollectionState = jest.fn();
const mockFetchCollectionState = jest.fn();

jest.mock("@/lib/api", () => ({
  fetchErrorReasons: jest.fn().mockResolvedValue([]),
  fetchErrorRecords: jest.fn().mockResolvedValue([]),
  fetchCollectionState: (...args: unknown[]) => mockFetchCollectionState(...args),
  fetchHonorEntries: jest.fn().mockResolvedValue([]),
  fetchTodayPatrolLog: jest.fn().mockResolvedValue(null),
  fetchCourageTotal: jest.fn().mockResolvedValue(0),
  submitPatrolLog: jest.fn().mockResolvedValue({}),
  saveCollectionState: jest.fn().mockResolvedValue(undefined),
  claimPatrolEncounter: jest.fn().mockResolvedValue({}),
  addHonorEntry: jest.fn().mockResolvedValue({}),
  resetCollectionState: (...args: unknown[]) => mockResetCollectionState(...args),
  createErrorRecord: jest.fn().mockResolvedValue({}),
}));

describe("DryPantsApp 重置按鈕：後端 reset 失敗時的現況行為", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 初次載入給一組非零值，才能觀察「重置後歸零」有沒有真的發生
    mockFetchCollectionState.mockResolvedValue({
      energy: 3,
      unlocked_count: 12,
      coins: 7,
      slot_order: Array.from({ length: 30 }, (_, i) => i),
      courage_bands: 2,
      wild_collection: [],
    });
    window.confirm = jest.fn().mockReturnValue(true);
  });

  it("resetCollectionState 失敗時，畫面仍樂觀清零並顯示重置成功訊息（現況，非驗證正確性）", async () => {
    mockResetCollectionState.mockRejectedValue(new Error("backend down"));
    // 重置後會再打一次 fetchCollectionState 取得新 slot_order；同樣讓它失敗，
    // 對應 fresh = await fetchCollectionState().catch(() => null) 的 null 分支
    mockFetchCollectionState.mockResolvedValueOnce({
      energy: 3,
      unlocked_count: 12,
      coins: 7,
      slot_order: Array.from({ length: 30 }, (_, i) => i),
      courage_bands: 2,
      wild_collection: [],
    });

    const user = userEvent.setup();
    render(<DryPantsApp />);

    // 等待初次載入完成，扭蛋幣顯示非零值
    await waitFor(() => {
      expect(screen.getByText(/x 7/)).toBeInTheDocument();
    });

    // 第二次呼叫（reset 流程內的 fresh fetch）也失敗，才能驗證 fresh=null 分支
    mockFetchCollectionState.mockRejectedValueOnce(new Error("backend down"));

    const resetButton = screen.getByText(/家長專用.*重置所有進度/);
    await user.click(resetButton);

    await waitFor(() => {
      expect(screen.getByText(/已重置所有進度/)).toBeInTheDocument();
    });

    // 樂觀清零：即使 resetCollectionState 與後續 fetchCollectionState 都失敗，
    // 畫面仍顯示歸零（現況：前後端可能不一致，使用者無感知）
    expect(screen.getByText(/x 0/)).toBeInTheDocument();
    expect(screen.getByText(/\(0\/30\)/)).toBeInTheDocument();

    // 沒有任何錯誤提示
    expect(screen.queryByText(/失敗/)).not.toBeInTheDocument();
    expect(mockResetCollectionState).toHaveBeenCalledTimes(1);
  });
});
