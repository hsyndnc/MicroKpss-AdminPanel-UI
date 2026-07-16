import { apiClient } from "./client";
import type { AdminStats } from "@/lib/types";

// Backend AdminStatsDto şekli (KpssApp.Application/DTOs/Admin/AdminStatsDto.cs)
interface AdminStatsResponse {
  totalUsers: number;
  totalQuestions: { active: number; pendingReview: number; rejected: number };
  dailyActiveUsers: number;
  questionsByCategory: { categoryName: string; count: number }[];
  answersLast7Days: { date: string; count: number }[];
}

export async function getAdminStats(): Promise<AdminStats> {
  const { data } = await apiClient.get<AdminStatsResponse>("/admin/stats");
  return {
    totalUsers: data.totalUsers,
    activeQuestions: data.totalQuestions.active,
    pendingReview: data.totalQuestions.pendingReview,
    dailyActiveUsers: data.dailyActiveUsers,
    categoryDistribution: data.questionsByCategory,
    dailyAnswers: data.answersLast7Days,
  };
}
