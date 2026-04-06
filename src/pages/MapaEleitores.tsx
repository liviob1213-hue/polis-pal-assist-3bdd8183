import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap } from "@vis.gl/react-google-maps";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Phone, Navigation, Users } from "lucide-react";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

interface Eleitor {
  id: string;
  nome: string;
  endereco: string | null;
  telefone: string | null;
  interesse: string | null;
  latitude: number | null;
  longitude: number | null;
}

const interestColors: Record<string, string> = {
  Saúde: "bg-success/10 text-success border-success/20",
  Obras: "bg-warning/10 text-warning border-warning/20",
  Educação: "bg-info/10 text-info border-info/20",
  Segurança: "bg-destructive/10 text-destructive border-destructive/20",
  Transporte: "bg-accent/10 text-accent border-accent/20",
  "Meio Ambiente": "bg-success/10 text-success border-success/20",
};

const MapContent = ({ eleitores }: { eleitores: Eleitor[] }) => {
  const [selectedEleitor, setSelectedEleitor] = useState<Eleitor | null>(null);
  const map = useMap();

  const geoEleitores = eleitores.filter((e) => e.latitude && e.longitude);

  // Fit bounds when markers are available
  const fitBounds = useCallback(() => {
    if (!map || geoEleitores.length === 0) return;
    const bounds = new (window as any).google.maps.LatLngBounds();
    geoEleitores.forEach((e) => bounds.extend({ lat: e.latitude!, lng: e.longitude! }));
    map.fitBounds(bounds, 60);
  }, [map, geoEleitores]);

  // Fit bounds on first load
  useState(() => {
    setTimeout(fitBounds, 500);
  });

  return (
    <>
      {geoEleitores.map((eleitor) => (
        <AdvancedMarker
          key={eleitor.id}
          position={{ lat: eleitor.latitude!, lng: eleitor.longitude! }}
          onClick={() => setSelectedEleitor(eleitor)}
          title={eleitor.nome}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground shadow-lg border-2 border-white cursor-pointer hover:scale-110 transition-transform">
            <MapPin className="h-4 w-4" />
          </div>
        </AdvancedMarker>
      ))}

      {selectedEleitor && selectedEleitor.latitude && selectedEleitor.longitude && (
        <InfoWindow
          position={{ lat: selectedEleitor.latitude, lng: selectedEleitor.longitude }}
          onCloseClick={() => setSelectedEleitor(null)}
        >
          <div className="p-1 min-w-[200px] max-w-[280px]">
            <h3 className="font-bold text-sm text-gray-900 mb-1">{selectedEleitor.nome}</h3>
            {selectedEleitor.interesse && (
              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 mb-2">
                {selectedEleitor.interesse}
              </span>
            )}
            {selectedEleitor.endereco && (
              <p className="text-xs text-gray-600 mb-1.5 flex items-start gap-1">
                <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                {selectedEleitor.endereco}
              </p>
            )}
            {selectedEleitor.telefone && (
              <p className="text-xs text-gray-600 mb-2 flex items-center gap-1">
                <Phone className="h-3 w-3 shrink-0" />
                {selectedEleitor.telefone}
              </p>
            )}
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${selectedEleitor.latitude},${selectedEleitor.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              <Navigation className="h-3 w-3" />
              Abrir no Google Maps
            </a>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

const MapaEleitores = () => {
  const { data: eleitores = [], isLoading } = useQuery({
    queryKey: ["eleitores-mapa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eleitores")
        .select("id, nome, endereco, telefone, interesse, latitude, longitude")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Eleitor[];
    },
  });

  const geoCount = eleitores.filter((e) => e.latitude && e.longitude).length;
  const noGeoCount = eleitores.length - geoCount;

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Mapa de Eleitores</h1>
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Configure a variável <code className="bg-muted px-1 rounded">VITE_GOOGLE_MAPS_API_KEY</code> para usar o mapa.</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Mapa de Eleitores</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Visualize a distribuição geográfica da sua base.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" />
            {geoCount} no mapa
          </Badge>
          {noGeoCount > 0 && (
            <Badge variant="outline" className="gap-1 text-warning border-warning/30">
              {noGeoCount} sem localização
            </Badge>
          )}
        </div>
      </div>

      <Card className="glass-card overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="h-[calc(100vh-220px)] min-h-[400px]">
              <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                <Map
                  defaultCenter={{ lat: -15.78, lng: -47.93 }}
                  defaultZoom={4}
                  gestureHandling="greedy"
                  disableDefaultUI={false}
                  mapId="democrat-eleitores-map"
                  className="w-full h-full rounded-lg"
                >
                  <MapContent eleitores={eleitores} />
                </Map>
              </APIProvider>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default MapaEleitores;
