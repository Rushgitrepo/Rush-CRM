import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useUniboxPermission() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["unibox-permission", user?.id],
    queryFn: async () => {
      try {
        console.log('Fetching unibox permission...');
        const response = await api.get('/unibox/permission');
        console.log('Full API response:', response);
        console.log('Response data:', response.data);
        console.log('Response type:', typeof response);

        // The API client returns the data directly, not wrapped in .data
        const result = response || { hasPermission: false, isOwner: false, hasFullAccess: false, canManageFolders: false, isRestricted: false, assignedFolderCount: 0 };
        console.log('Final result:', result);
        return result;
      } catch (error) {
        console.error('Unibox permission check failed:', error);
        return { hasPermission: false, isOwner: false, hasFullAccess: false, canManageFolders: false, isRestricted: false, assignedFolderCount: 0 };
      }
    },
    enabled: !!user,
    staleTime: 0, // Force fresh data
    cacheTime: 0, // Don't cache
  });

  console.log('useUniboxPermission result:', { data, isLoading });

  return {
    hasPermission: data?.hasPermission ?? false,
    isOwner: data?.isOwner ?? false,
    hasFullAccess: data?.hasFullAccess ?? false,
    canManageFolders: data?.canManageFolders ?? data?.hasFullAccess ?? false,
    isRestricted: data?.isRestricted ?? false,
    assignedFolderCount: data?.assignedFolderCount ?? 0,
    isLoading
  };
}
