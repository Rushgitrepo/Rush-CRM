import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useUniboxPermission() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["unibox-permission", user?.id],
    queryFn: async () => {
      const response = await api.get('/unibox/permission');
      return response.data;
    },
    enabled: !!user,
  });

  return { 
    hasPermission: data?.hasPermission ?? false, 
    isOwner: data?.isOwner ?? false,
    isLoading 
  };
}
