import { ChartAreaInteractive } from "@//components/chart-area-interactive"
import { DataTable } from "@//components/data-table"
import { SectionCards } from "@//components/section-cards"
import { TradingDashboard } from "@/components/trading-dashboard"
import { SecurityDashboard } from "@/components/security-dashboard"

export default function Page() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <TradingDashboard />
        <SecurityDashboard />
        <div className="px-4 lg:px-6">
          <ChartAreaInteractive />
        </div>
      </div>
    </div>
  )
}