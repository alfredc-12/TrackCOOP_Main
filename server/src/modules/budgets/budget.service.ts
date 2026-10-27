import type { AuthContext } from "../auth/auth.types";
import { createBudgetRepository, type BudgetRepository } from "./budget.repository";
import type { BudgetInput, BudgetListQuery } from "./budget.types";

export interface BudgetService {
  list(query: BudgetListQuery): ReturnType<BudgetRepository["list"]>;
  get(id: string): ReturnType<BudgetRepository["get"]>;
  create(input: BudgetInput, auth: AuthContext): ReturnType<BudgetRepository["create"]>;
  transition(id: string, action: "submit" | "approve" | "close", auth: AuthContext): ReturnType<BudgetRepository["transition"]>;
  summary(): ReturnType<BudgetRepository["summary"]>;
}

export function createBudgetService(repository: BudgetRepository = createBudgetRepository()): BudgetService {
  return {
    list: (query) => repository.list(query),
    get: (id) => repository.get(id),
    create: (input, auth) => repository.create(input, auth),
    transition: (id, action, auth) => repository.transition(id, action, auth),
    summary: () => repository.summary(),
  };
}
