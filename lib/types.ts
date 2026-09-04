export type KpssType = "Lisans" | "Onlisans" | "Ortaogretim";
export type UserRole = "Standard" | "Premium" | "Admin";
export type ContentStatus = "PendingReview" | "Active" | "Rejected" | "Archived" | "FlaggedForReview";
export type Difficulty = "Easy" | "Medium" | "Hard";
export type QuestionType = "MultipleChoice" | "TrueFalse";

export interface AuthUser {
  email: string;
  role: UserRole;
}

export interface AdminQuestion {
  id: string;
  body: string;
  categoryId: string;
  categoryName: string;
  difficulty: Difficulty;
  type: QuestionType;
  questionType: QuestionType;
  status: ContentStatus;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  year?: number;
  imageUrl?: string;
  createdAt: string;
  verificationStatus?: string | null; // "gecti" | "supheli" | "kontrol_edilemedi" | null
  verificationNote?: string | null;
  sourceText?: string | null; // üretimde kullanılan kaynak metin (yalnız detay endpoint'i döner)
}

export interface AdminCategory {
  id: string;
  name: string;
  parentCategoryId?: string;
  parentCategoryName?: string;
  activeQuestionCount: number;
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  kpssType?: KpssType;
  createdAt: string;
}

export interface AdminUserDetail {
  id: string;
  email: string;
  role: UserRole;
  kpssType: KpssType | null;
  createdAt: string;
  lastLoginAt: string | null;
  solvedCount: number;
  correctCount: number;
}

export interface AdminStats {
  totalUsers: number;
  activeQuestions: number;
  pendingReview: number;
  rejectedQuestions: number;
  dailyActiveUsers: number;
  dailyAnswers: { date: string; count: number }[];
  categoryDistribution: { categoryName: string; count: number }[];
}

export interface ExamDateDto {
  kpssType: string;
  date: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export type LegalDocumentType = "PrivacyPolicy" | "TermsOfService" | "KvkkNotice";

export interface LegalDocument {
  type: LegalDocumentType;
  content: string;
  updatedAt: string;
}

export interface AiFixSuggestion {
  body: string;
  options: string[];
  correctAnswer: string;
  explanation?: string | null;
}

export interface AiFixResult {
  suggestion: AiFixSuggestion;
  changeSummary: string;
  sourceFound: boolean;
}

export type ReportReason = "WrongAnswer" | "Typo" | "Nonsense" | "Inappropriate" | "Other";

export interface ReportedQuestion {
  questionId: string;
  body: string;
  categoryName?: string;
  status: ContentStatus;
  reportCount: number;
  reasonBreakdown: Record<string, number>;
  notes: string[];
}
