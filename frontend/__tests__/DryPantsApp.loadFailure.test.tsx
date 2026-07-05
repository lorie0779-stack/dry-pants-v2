/**
 * 首次載入失敗分支（DryPantsApp.tsx:531-547）。
 *
 * 現況行為：Promise.all([...]).catch(() => {}) 靜默吞掉錯誤——不顯示任何
 * 錯誤訊息，畫面維持預設值（energy=0/coins=0/unlockedCount=0/todayLog=null），
 * 且 stateLoaded.current 保持 false（不會觸發後續 auto-save 覆寫 DB）。
 * 本測試斷言「現況」：確認使用者看不到任何錯誤提示。
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
  fetchCollectionState: jest.fn().mockRejectedValue(new Error("network down")),
  fetchHonorEntries: jest.fn().mockResolvedValue([]),
  fetchTodayPatrolLog: jest.fn().mockRejectedValue(new Error("network down")),
  fetchCourageTotal: jest.fn().mockResolvedValue(0),
  submitPatrolLog: jest.fn().mockResolvedValue({}),
  saveCollectionState: jest.fn().mockResolvedValue(undefined),
  claimPatrolEncounter: jest.fn().mockResolvedValue({}),
  addHonorEntry: jest.fn().mockResolvedValue({}),
  resetCollectionState: jest.fn().mockResolvedValue(undefined),
  createErrorRecord: jest.fn().mockResolvedValue({}),
}));

describe("DryPantsApp 首次載入失敗（現況：靜默失敗，無錯誤提示）", () => {
  it("載入全部 reject 後，畫面維持預設值且沒有任何錯誤訊息", async () => {
    render(<DryPantsApp />);

    // 維持預設值：today 巡邏報告按鈕（todayLog=null 的預設狀態）
    await waitFor(() => {
      expect(screen.getByText(/晚間巡邏報告/)).toBeInTheDocument();
    });

    // 預設扭蛋幣 x 0、傳說寶可夢 (0/30)
    expect(screen.getByText(/x 0/)).toBeInTheDocument();
    expect(screen.getByText(/\(0\/30\)/)).toBeInTheDocument();

    // 現況：沒有任何錯誤提示文字（載入失敗被 .catch(() => {}) 靜默吞掉）
    expect(screen.queryByText(/失敗/)).not.toBeInTheDocument();
    expect(screen.queryByText(/錯誤/)).not.toBeInTheDocument();
    expect(screen.queryByText(/network down/)).not.toBeInTheDocument();
  });
});
