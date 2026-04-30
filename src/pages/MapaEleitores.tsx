import { useState, useCallback, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap } from "@vis.gl/react-google-maps";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, Phone, Navigation, Users, Search, BarChart3 } from "lucide-react";
import { useGoogleMapsKey } from "@/hooks/useGoogleMapsKey";
import { getStatusEleitor, STATUS_ELEITOR_LIST } from "@/lib/statusEleitor";

interface Eleitor {
  id: string;
  nome: string;
  endereco: string | null;
  telefone: string | null;
  interesse: string | null;
  status_eleitor: string | null;
  latitude: number | null;
  longitude: number | null;
}

// Helper: group eleitores by a street/region key
function groupByStreet(eleitores: Eleitor[]) {
  const map = new window.Map<string, number>();
  eleitores.forEach((e) => {
    if (!e.endereco) return;
    // Extract street name (first part before the number/comma)
    const street = e.endereco.split(",")[0]?.trim() || e.endereco;
    map.set(street, (map.get(street) || 0) + 1);
  });
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}

function groupByCity(eleitores: Eleitor[]) {
  const map = new window.Map<string, number>();
  eleitores.forEach((e) => {
    if (!e.endereco) return;
    const parts = e.endereco.split(",");
    // City is usually the 3rd or 4th part
    const city = parts.length >= 3 ? parts[parts.length - 3]?.trim() : parts[0]?.trim();
    if (city) map.set(city, (map.get(city) || 0) + 1);
  });
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
}

const MapContent = ({ eleitores, searchQuery }: { eleitores: Eleitor[]; searchQuery: string }) => {
  const [selectedEleitor, setSelectedEleitor] = useState<Eleitor | null>(null);
  const map = useMap();

  const geoEleitores = eleitores.filter((e) => e.latitude && e.longitude);

  // Fit bounds on first load
  useEffect(() => {
    if (!map || geoEleitores.length === 0) return;
    const timeout = setTimeout(() => {
      const bounds = new (window as any).google.maps.LatLngBounds();
      geoEleitores.forEach((e) => bounds.extend({ lat: e.latitude!, lng: e.longitude! }));
      map.fitBounds(bounds, 60);
    }, 500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Fly to matched eleitor when search changes
  useEffect(() => {
    if (!map || !searchQuery.trim()) return;
    const query = searchQuery.toLowerCase();
    const match = geoEleitores.find((e) => e.nome.toLowerCase().includes(query));
    if (match && match.latitude && match.longitude) {
      map.panTo({ lat: match.latitude, lng: match.longitude });
      // Smooth zoom in
      let currentZoom = map.getZoom() || 4;
      const targetZoom = 17;
      const step = () => {
        if (currentZoom < targetZoom) {
          currentZoom = Math.min(currentZoom + 1, targetZoom);
          map.setZoom(currentZoom);
          setTimeout(step, 200);
        } else {
          setSelectedEleitor(match);
        }
      };
      setTimeout(step, 300);
    }
  }, [map, searchQuery, geoEleitores]);

  return (
    <>
      {geoEleitores.map((eleitor) => (
        <AdvancedMarker
          key={eleitor.id}
          position={{ lat: eleitor.latitude!, lng: eleitor.longitude! }}
          onClick={() => setSelectedEleitor(eleitor)}
          title={eleitor.nome}
        >
          <div className={`flex items-center justify-center w-6 h-6 rounded-full ${getStatusEleitor(eleitor.status_eleitor).pinClass} text-white shadow-md border-[1.5px] border-white cursor-pointer hover:scale-125 transition-transform`} title={getStatusEleitor(eleitor.status_eleitor).label}>
            <span className="text-[10px] font-bold leading-none">E</span>
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
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mb-2" style={{ backgroundColor: `${getStatusEleitor(selectedEleitor.status_eleitor).hex}22`, color: getStatusEleitor(selectedEleitor.status_eleitor).hex }}>
              <span>{getStatusEleitor(selectedEleitor.status_eleitor).emoji}</span>
              {getStatusEleitor(selectedEleitor.status_eleitor).label}
            </span>
            {selectedEleitor.interesse && (
              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 mb-2">
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
  const { data: mapsApiKey = "", isLoading: keyLoading } = useGoogleMapsKey();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data: eleitores = [], isLoading } = useQuery({
    queryKey: ["eleitores-mapa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eleitores")
        .select("id, nome, endereco, telefone, interesse, latitude, longitude, status_eleitor")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Eleitor[];
    },
  });

  // Debounce search for smooth UX
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const geoEleitores = eleitores.filter((e) => e.latitude && e.longitude);
  const geoCount = geoEleitores.length;
  const noGeoCount = eleitores.length - geoCount;

  const streetMetrics = useMemo(() => groupByStreet(geoEleitores), [geoEleitores]);
  const cityMetrics = useMemo(() => groupByCity(geoEleitores), [geoEleitores]);

  // Search suggestions
  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return geoEleitores
      .filter((e) => e.nome.toLowerCase().includes(q))
      .slice(0, 5);
  }, [searchQuery, geoEleitores]);

  if (keyLoading || isLoading) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </motion.div>
    );
  }

  if (!mapsApiKey) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Mapa de Eleitores</h1>
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Google Maps API Key não configurada.</p>
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

      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar eleitor no mapa..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-card border-border"
        />
        {suggestions.length > 0 && searchQuery.trim() && (
          <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden">
            {suggestions.map((e) => (
              <button
                key={e.id}
                className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 transition-colors flex items-center gap-2"
                onClick={() => {
                  setSearchQuery(e.nome);
                  setDebouncedSearch(e.nome);
                }}
              >
                <MapPin className="h-3 w-3 text-accent shrink-0" />
                <span className="truncate">{e.nome}</span>
                <span className="text-xs text-muted-foreground ml-auto truncate max-w-[150px]">{e.endereco}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Map */}
        <Card className="glass-card overflow-hidden lg:col-span-3">
          <CardContent className="p-0">
            <div className="h-[calc(100vh-280px)] min-h-[400px]">
              <APIProvider apiKey={mapsApiKey}>
                <Map
                  defaultCenter={{ lat: -15.78, lng: -47.93 }}
                  defaultZoom={4}
                  gestureHandling="greedy"
                  disableDefaultUI={false}
                  mapId="democrat-eleitores-map"
                  className="w-full h-full rounded-lg"
                >
                  <MapContent eleitores={eleitores} searchQuery={debouncedSearch} />
                </Map>
              </APIProvider>
            </div>
          </CardContent>
        </Card>

        {/* Metrics sidebar */}
        <div className="space-y-4">
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-accent" />
                <h3 className="text-sm font-semibold">Por Região</h3>
              </div>
              {cityMetrics.length > 0 ? (
                <div className="space-y-2">
                  {cityMetrics.map(([city, count]) => (
                    <div key={city} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground truncate flex-1">{city}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 rounded-full bg-accent/20 w-16">
                          <div
                            className="h-full rounded-full bg-accent transition-all"
                            style={{ width: `${Math.min((count / (cityMetrics[0]?.[1] || 1)) * 100, 100)}%` }}
                          />
                        </div>
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 min-w-[28px] justify-center">{count}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sem dados de região.</p>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Por Rua</h3>
              </div>
              {streetMetrics.length > 0 ? (
                <div className="space-y-2">
                  {streetMetrics.map(([street, count]) => (
                    <div key={street} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground truncate flex-1" title={street}>{street}</span>
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 min-w-[28px] justify-center">{count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sem dados de ruas.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
};

export default MapaEleitores;
