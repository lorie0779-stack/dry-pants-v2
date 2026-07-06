/**
 * 「【家長專用】重置所有進度」按鈕，reset 後端呼叫失敗分支
 * （DryPantsApp.tsx reset onClick，非樂觀更新版）。
 *
 * 修復後行為：先 await resetCollectionState()，成功才清畫面狀態；
 * 失敗則保留原狀態、顯示「❌ 重置失敗，請檢查網路後再試」，
 * 且不出現「已重置所有進度」假成功訊息。
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

const NONZERO_STATE = {
  energy: 3,
  unlocked_count: 12,
  coins: 7,
  slot_order: Array.from({ length: 30 }, (_, i) => i),
  courage_bands: 2,
  wild_collection: [],
};

describe("DryPantsApp 重置按鈕：非樂觀更新", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 初次載入給一組非零值，才能觀察「有沒有被清零」
    mockFetchCollectionState.mockResolvedValue(NONZERO_STATE);
    window.confirm = jest.fn().mockReturnValue(true);
  });

  it("resetCollectionState 失敗 → 狀態不清零、顯示錯誤訊息、無假成功訊息", async () => {
    mockResetCollectionState.mockRejectedValue(new Error("重置進度失敗：500"));

    const user = userEvent.setup();
    render(<DryPantsApp />);

    // 等待初次載入完成，扭蛋幣顯示非零值
    await waitFor(() => {
      expect(screen.getByText(/x 7/)).toBeInTheDocument();
    });

    const resetButton = screen.getByText(/家長專用.*重置所有進度/);
    await user.click(resetButton);

    // 顯示可讀錯誤訊息
    await waitFor(() => {
      expect(screen.getByText(/重置失敗，請檢查網路後再試/)).toBeInTheDocument();
    });

    // 狀態未被清零：扭蛋幣仍為 7、傳說進度仍為 12/30
    expect(screen.getByText(/x 7/)).toBeInTheDocument();
    expect(screen.getByText(/\(12\/30\)/)).toBeInTheDocument();

    // 不出現假成功訊息
    expect(screen.queryByText(/已重置所有進度/)).not.toBeInTheDocument();
    expect(mockResetCollectionState).toHaveBeenCalledTimes(1);
  });

  it("resetCollectionState 成功 → 狀態清零並顯示成功訊息", async () => {
    mockResetCollectionState.mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<DryPantsApp />);

    await waitFor(() => {
      expect(screen.getByText(/x 7/)).toBeInTheDocument();
    });

    const resetButton = screen.getByText(/家長專用.*重置所有進度/);
    await user.click(resetButton);

    await waitFor(() => {
      expect(screen.getByText(/已重置所有進度/)).toBeInTheDocument();
    });
    expect(screen.getByText(/x 0/)).toBeInTheDocument();
    expect(screen.getByText(/\(0\/30\)/)).toBeInTheDocument();
    expect(screen.queryByText(/重置失敗/)).not.toBeInTheDocument();
  });
});
