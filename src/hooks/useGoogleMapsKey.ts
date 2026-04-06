import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useGoogleMapsKey() {
  return useQuery({
    queryKey: ["google-maps-key"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("maps-key");
      if (error) throw error;
      return (data as { key: string }).key || "";
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
