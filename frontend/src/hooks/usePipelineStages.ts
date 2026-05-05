import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api } from '@/lib/api';

export interface PipelineStage {
  id: string;
  pipeline: string;
  stage_key: string;
  stage_label: string;
  sort_order: number;
  color: string;
}

export function usePipelineStages(pipeline = 'default') {
  return useQuery({
    queryKey: ['pipeline_stages', pipeline],
    queryFn: async () => {
      const data = await api.get<PipelineStage[]>('/leads/stages').catch(() => [] as PipelineStage[]);
      return data || [];
    },
  });
}

export function useDealPipelineStages() {
  return useQuery({
    queryKey: ['pipeline_stages', 'deals'],
    queryFn: async () => {
      const data = await api.get<PipelineStage[]>('/deals/stages').catch(() => [] as PipelineStage[]);
      return data || [];
    },
  });
}

export function useCreatePipelineStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ stageName }: { stageName: string }) => {
      const data = await api.post<PipelineStage>('/leads/stages', { stageName }).catch(() => null);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_stages'] });
      toast.success('Stage created successfully');
    },
    onError: (error: Error) => toast.error('Failed to create stage: ' + error.message),
  });
}

export function useCreateDealPipelineStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ stageName }: { stageName: string }) => {
      const data = await api.post<PipelineStage>('/deals/stages', { stageName }).catch(() => null);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_stages', 'deals'] });
      toast.success('Stage created successfully');
    },
    onError: (error: Error) => toast.error('Failed to create stage: ' + error.message),
  });
}

export function useUpdatePipelineStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stageName }: { id: string; stageName: string }) => {
      const data = await api.put<PipelineStage>(`/leads/stages/${id}`, { stageName });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_stages'] });
      toast.success('Stage updated successfully');
    },
    onError: (error: Error) => toast.error('Failed to update stage: ' + error.message),
  });
}

export function useUpdateDealPipelineStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stageName }: { id: string; stageName: string }) => {
      const data = await api.put<PipelineStage>(`/deals/stages/${id}`, { stageName });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_stages', 'deals'] });
      toast.success('Stage updated successfully');
    },
    onError: (error: Error) => toast.error('Failed to update stage: ' + error.message),
  });
}

export function useDeletePipelineStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stageId: string) => {
      await api.delete(`/leads/stages/${stageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_stages'] });
      toast.success('Stage deleted successfully');
    },
    onError: (error: Error) => toast.error('Failed to delete stage: ' + error.message),
  });
}

export function useDeleteDealPipelineStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stageId: string) => {
      await api.delete(`/deals/stages/${stageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_stages', 'deals'] });
      toast.success('Stage deleted successfully');
    },
    onError: (error: Error) => toast.error('Failed to delete stage: ' + error.message),
  });
}
