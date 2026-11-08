import { apiRequest, profilePath } from './api-client';
export interface Challenge { id: string; nome: string | null; categoriaId: string; categoriaNome: string; dataInicio: string; dataFim: string; valorReferencia: string; valorMeta: string; valorGastoAtual: string; valorDisponivelAteMeta: string; percentualReducao: number; percentualPeriodoConsumido: number; status: 'EM_ANDAMENTO' | 'CONCLUIDO' | 'NAO_ATINGIDO' }
export interface Candidate { categoriaId: string; categoriaNome: string; valorPlanejado: string; valorRealizado: string; valorExcedente: string; percentualEstouro: number; percentualReducaoSugerida: number; valorMetaSugerido: string }
export interface Candidates { baseline: { startDate: string; endDate: string }; challengePeriod: { startDate: string; endDate: string }; candidates: Candidate[] }
export type Suggestion = { type: 'WEEKLY_TARGET'; valorSemanalAproximado: string } | { type: 'AVERAGE_TRANSACTION'; valorMedioHistorico: string; valorMedioSugerido: string } | { type: 'HIGH_IMPACT_DESCRIPTION'; descricao: string; valorTotal: string; participacaoPercentual: number };
export interface Suggestions { suggestions: Suggestion[] }
const path = (suffix = '') => profilePath(`essential-expense-challenges${suffix}`);
export const getChallenges = () => apiRequest<Challenge[]>(path());
export const getCandidates = () => apiRequest<Candidates>(path('/candidates'));
export const getChallenge = (id: string) => apiRequest<Challenge>(path(`/${encodeURIComponent(id)}`));
export const getSuggestions = (id: string) => apiRequest<Suggestions>(path(`/${encodeURIComponent(id)}/suggestions`));
export const acceptChallenge = (categoriaId: string) => apiRequest<Challenge>(path(), { method: 'POST', body: { categoriaId } });
export const renameChallenge = (id: string, nome: string) => apiRequest<Challenge>(path(`/${encodeURIComponent(id)}`), { method: 'PATCH', body: { nome } });
