import type { Metadata } from "next";
import { Tasks } from "@/features/tasks/Tasks";

export const metadata: Metadata = { title: "Agent tasks" };

export default function TasksPage() {
  return <Tasks />;
}
