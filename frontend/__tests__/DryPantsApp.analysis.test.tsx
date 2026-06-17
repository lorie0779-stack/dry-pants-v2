/**
 * 分析模式表單：選擇「➕ 其他（手動輸入）」時應顯示文字輸入框。
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DryPantsApp } from "@/components/DryPantsApp";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/lib/api", () => ({
  fetchErrorReasons: jest.fn().mockResolvedValue([
    { id: 1, reason_text: "廁所都有人" },
    { id: 2, reason_text: "來不及脫褲子" },
  ]),
  fetchErrorRecords: jest.fn().mockResolvedValue([]),
  createErrorRecord: jest.fn().mockResolvedValue({}),
  fetchCollectionState: jest.fn().mockResolvedValue({
    energy: 0, unlocked_count: 0, coins: 0,
    slot_order: Array.from({ length: 30 }, (_, i) => i),
  }),
  fetchHonorEntries: jest.fn().mockResolvedValue([]),
  fetchTodayPatrolLog: jest.fn().mockResolvedValue(null),
  fetchCourageTotal: jest.fn().mockResolvedValue(0),
  saveCollectionState: jest.fn().mockResolvedValue(undefined),
  addHonorEntry: jest.fn().mockResolvedValue({}),
  resetCollectionState: jest.fn().mockResolvedValue(undefined),
  submitPatrolLog: jest.fn().mockResolvedValue({}),
  claimPatrolEncounter: jest.fn().mockResolvedValue({}),
  redeemCourageBand: jest.fn().mockResolvedValue({ courage_bands: 0 }),
}));

jest.mock("recharts", () => {
  const React = require("react");
  const Box = ({ children }: { children?: unknown }) =>
    React.createElement("div", { "data-testid": "recharts-stub" }, children);
  return {
    ResponsiveContainer: Box,
    LineChart: Box,
    BarChart: Box,
    PieChart: Box,
    Line: () => null,
    Bar: () => null,
    Pie: () => null,
    Cell: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

describe("DryPantsApp 分析模式表單", () => {
  it("選擇 ➕ 其他（手動輸入）時會渲染 type=text 的輸入框", async () => {
    const user = userEvent.setup();
    render(<DryPantsApp />);

    const analysisButtons = screen.getAllByRole("button", { name: "分析模式" });
    await user.click(analysisButtons[0]);

    const select = await waitFor(() =>
      screen.getByTestId("analysis-reason-select"),
    );

    await user.selectOptions(select, "__OTHER__");

    const input = await screen.findByTestId("analysis-custom-reason-input");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "text");
  });
});
