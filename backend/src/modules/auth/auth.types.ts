export interface AuthenticatedRequest {
  headers: { authorization?: string };
  user: { id: string };
}
