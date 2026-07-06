/**
 * 首次載入失敗分支（DryPantsApp.tsx 初次載入 useEffect）。
 *
 * 修復後行為：載入失敗時畫面維持預設值（energy=0/coins=0/unlockedCount=0/
 * todayLog=null）、stateLoaded.current 保持 false（不觸發 auto-save 覆寫 DB），
 * 但會透過 showMsg 顯示「⚠️ 連線後端失敗，顯示的是預設狀態」可讀提示，
 * 不再無聲吞掉錯誤。
 */
import "@testing-library/jest-dom"; // 讓 tsc 認得 toBeInTheDocument 等 matcher 型別
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
  it("載入全部 reject 後，畫面維持預設值並顯示連線失敗提示", async () => {
    render(<DryPantsApp />);

    // 維持預設值：today 巡邏報告按鈕（todayLog=null 的預設狀態）
    await waitFor(() => {
      expect(screen.getByText(/晚間巡邏報告/)).toBeInTheDocument();
    });

    // 預設扭蛋幣 x 0、傳說寶可夢 (0/30)——fallback 行為不變
    expect(screen.getByText(/x 0/)).toBeInTheDocument();
    expect(screen.getByText(/\(0\/30\)/)).toBeInTheDocument();

    // 修復後：顯示可讀的連線失敗提示（措辭溫和，後端冷啟動屬正常情況）
    await waitFor(() => {
      expect(screen.getByText(/連線後端失敗，顯示的是預設狀態/)).toBeInTheDocument();
    });
  });
});
