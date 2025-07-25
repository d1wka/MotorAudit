import type { Metadata } from "next";
import MotorSimulation from "@/components/simulation/MotorSimulation";

export const metadata: Metadata = {
  title: "Motor Simulation — MotorAudit",
};

export default function SimulationPage() {
  return <MotorSimulation />;
}
