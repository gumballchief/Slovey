import type { Metadata } from "next";
import { PullRequests } from "@/features/pulls/PullRequests";

export const metadata: Metadata = { title: "Pull requests" };

export default function PullRequestsPage() {
  return <PullRequests />;
}
