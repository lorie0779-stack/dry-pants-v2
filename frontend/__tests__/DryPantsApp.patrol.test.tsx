/**
 * DryPantsApp 晚間巡邏按鈕：4 種 todayLog 狀態測試
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
  fetchCollectionState: jest.fn().mockResolvedValue({
    energy: 0, unlocked_count: 0, coins: 0,
    slot_order: Array.from({ length: 30 }, (_, i) => i),
  }),
  fetchHonorEntries: jest.fn().mockResolvedValue([]),
  fetchTodayPatrolLog: jest.fn(),
  fetchCourageTotal: jest.fn().mockResolvedValue(0),
  submitPatrolLog: jest.fn().mockResolvedValue({}),
  saveCollectionState: jest.fn().mockResolvedValue(undefined),
  claimPatrolEncounter: jest.fn().mockResolvedValue({}),
  addHonorEntry: jest.fn().mockResolvedValue({}),
  resetCollectionState: jest.fn().mockResolvedValue(undefined),
  createErrorRecord: jest.fn().mockResolvedValue({}),
}));

import { fetchTodayPatrolLog } from "@/lib/api";
const mockFetchTodayPatrolLog = fetchTodayPatrolLog as jest.Mock;

const BASE_LOG = {
  id: 1,
  log_date: "2026-05-24",
  block_1: "clean",
  block_2: "clean",
  block_3: "clean",
  regular_stamps: 3,
  courage_stamps: 0,
  encounter_tier: "legendary",
  pokemon_index: 0,
  claimed: false,
  created_at: "2026-05-24T20:00:00",
};

describe("DryPantsApp 晚間巡邏按鈕狀態", () => {
  it("TC-F1: todayLog = null → 「晚間巡邏報告」按鈕", async () => {
    mockFetchTodayPatrolLog.mockResolvedValue(null);
    render(<DryPantsApp />);
    await waitFor(() => {
      expect(screen.getByText(/晚間巡邏報告/)).toBeInTheDocument();
    });
  });

  it("TC-F2: tier = none → 「今日巡邏完成」文字", async () => {
    mockFetchTodayPatrolLog.mockResolvedValue({
      ...BASE_LOG, encounter_tier: "none", pokemon_index: null,
    });
    render(<DryPantsApp />);
    await waitFor(() => {
      expect(screen.getByText(/今日巡邏完成/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/前往揭曉/)).not.toBeInTheDocument();
  });

  it("TC-F3: tier ≠ none + !claimed → 「前往揭曉！」按鈕", async () => {
    mockFetchTodayPatrolLog.mockResolvedValue({ ...BASE_LOG, claimed: false });
    render(<DryPantsApp />);
    await waitFor(() => {
      expect(screen.getByText(/前往揭曉/)).toBeInTheDocument();
    });
  });

  it("TC-F4: claimed = true → 「今日已捕獲」文字", async () => {
    mockFetchTodayPatrolLog.mockResolvedValue({ ...BASE_LOG, claimed: true });
    render(<DryPantsApp />);
    await waitFor(() => {
      expect(screen.getByText(/今日已捕獲/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/晚間巡邏報告/)).not.toBeInTheDocument();
  });
});
