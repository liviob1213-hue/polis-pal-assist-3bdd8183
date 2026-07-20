import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

interface AddressComponents {
  rua: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect?: (components: AddressComponents) => void;
  placeholder?: string;
  apiKey: string;
  types?: string[];
}

declare global {
  interface Window {
    __democratGoogleMapsInit?: () => void;
  }
}

let googleMapsPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string) {
  if ((window as any).google?.maps?.importLibrary) return Promise.resolve();
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com/maps/api/js"]');
    window.__democratGoogleMapsInit = () => resolve();

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar Google Maps")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async&callback=__democratGoogleMapsInit`;
    script.async = true;
    script.onerror = () => reject(new Error("Falha ao carregar Google Maps"));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

function extractComponents(place: any): AddressComponents {
  const components: AddressComponents = { rua: "", bairro: "", cidade: "", estado: "", cep: "" };
  const parts = place.address_components || place.addressComponents || [];
  let streetNumber = "";

  for (const c of parts) {
    const types: string[] = c.types;
    const longName = c.long_name || c.longText || "";
    const shortName = c.short_name || c.shortText || longName;
    if (types.includes("route")) components.rua = longName;
    if (types.includes("street_number")) streetNumber = longName;
    if (types.includes("sublocality_level_1") || types.includes("sublocality") || types.includes("neighborhood")) components.bairro = longName;
    if (types.includes("locality") || types.includes("administrative_area_level_2")) {
      if (!components.cidade) components.cidade = longName;
    }
    if (types.includes("administrative_area_level_1")) components.estado = shortName;
    if (types.includes("postal_code")) components.cep = longName;
  }

  if (streetNumber && components.rua) {
    components.rua = `${components.rua}, ${streetNumber}`;
  }

  return components;
}

function extractAddressComponents(parts: any[] = []): AddressComponents {
  return extractComponents({ address_components: parts });
}

function getSelectedLabel(place: any, input: HTMLInputElement | null) {
  return String(place?.formatted_address || place?.formattedAddress || place?.displayName?.text || place?.name || input?.value || "").trim();
}

function applyFallbackComponents(components: AddressComponents, selectedLabel: string) {
  if (!selectedLabel) return components;

  const next = { ...components };
  const pieces = selectedLabel.split(",").map((part) => part.trim()).filter(Boolean);

  if (!next.cidade && pieces[0]) {
    next.cidade = pieces[0];
  }

  if (!next.estado) {
    const stateMatch = selectedLabel.match(/\b([A-Z]{2})\b/);
    if (stateMatch) next.estado = stateMatch[1];
  }

  if (!next.cep) {
    const cepMatch = selectedLabel.match(/\b\d{5}-?\d{3}\b/);
    if (cepMatch) next.cep = cepMatch[0];
  }

  return next;
}

function getIncludedPrimaryTypes(types: string[]) {
  const allowed = types.filter((type) => type && type !== "geocode" && type !== "address");
  return allowed.length ? allowed : undefined;
}

const AddressAutocomplete = ({ value, onChange, onAddressSelect, placeholder = "Digite o endereço...", apiKey, types = ["geocode"] }: AddressAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionTokenRef = useRef<any>(null);
  const placesLibRef = useRef<any>(null);
  const legacyAutocompleteServiceRef = useRef<any>(null);
  const legacyPlacesServiceRef = useRef<any>(null);
  const legacySessionTokenRef = useRef<any>(null);
  const suppressSearchRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const typesKey = types.join("|");

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(async () => {
        const googleMaps = (window as any).google.maps;
        const placesLib = await googleMaps.importLibrary("places");
        if (cancelled) return;
        placesLibRef.current = placesLib;
        if (placesLib.AutocompleteSessionToken) {
          sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
        }
        legacyAutocompleteServiceRef.current = new googleMaps.places.AutocompleteService();
        legacyPlacesServiceRef.current = new googleMaps.places.PlacesService(document.createElement("div"));
        legacySessionTokenRef.current = new googleMaps.places.AutocompleteSessionToken();
        setLoaded(true);
      })
      .catch(() => setLoaded(false));

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    if (!loaded || !placesLibRef.current || suppressSearchRef.current) {
      suppressSearchRef.current = false;
      return;
    }

    const searchText = value.trim();
    if (searchText.length < 3 || document.activeElement !== inputRef.current) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        let results: any[] = [];
        const { AutocompleteSuggestion } = placesLibRef.current;

        if (AutocompleteSuggestion) {
          try {
            const includedPrimaryTypes = getIncludedPrimaryTypes(types);
            const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
              input: searchText,
              ...(includedPrimaryTypes ? { includedPrimaryTypes } : {}),
              includedRegionCodes: ["br"],
              language: "pt-BR",
              sessionToken: sessionTokenRef.current,
            });
            results = (response.suggestions || []).filter((item: any) => item.placePrediction);
          } catch {
            results = [];
          }
        }

        if (!results.length && legacyAutocompleteServiceRef.current) {
          results = await new Promise((resolve) => {
            legacyAutocompleteServiceRef.current.getPlacePredictions(
              {
                input: searchText,
                componentRestrictions: { country: "br" },
                types,
                sessionToken: legacySessionTokenRef.current,
              },
              (predictions: any[] | null, status: string) => {
                if (status === (window as any).google.maps.places.PlacesServiceStatus.OK && predictions) {
                  resolve(predictions.map((prediction) => ({ legacyPrediction: prediction })));
                } else {
                  resolve([]);
                }
              },
            );
          });
        }

        if (!cancelled) {
          setSuggestions(results.slice(0, 6));
          setOpen(true);
        }
      } catch (error) {
        if (!cancelled) {
          setSuggestions([]);
          setOpen(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [loaded, typesKey, value]);

  const handleSelect = async (suggestion: any) => {
    const prediction = suggestion.placePrediction || suggestion.legacyPrediction;
    if (!prediction) return;

    const label = String(prediction.text?.toString?.() || prediction.description || "").trim();
    suppressSearchRef.current = true;
    setSuggestions([]);
    setOpen(false);
    if (label) onChange(label);

    try {
      let place: any = null;
      let selectedLabel = label;

      if (suggestion.placePrediction?.toPlace) {
        place = suggestion.placePrediction.toPlace();
        await place.fetchFields({ fields: ["addressComponents", "formattedAddress", "displayName", "location"] });
        selectedLabel = getSelectedLabel(place, inputRef.current) || label;
      } else if (legacyPlacesServiceRef.current && prediction.place_id) {
        place = await new Promise((resolve, reject) => {
          legacyPlacesServiceRef.current.getDetails(
            {
              placeId: prediction.place_id,
              fields: ["address_components", "formatted_address", "name", "geometry"],
              sessionToken: legacySessionTokenRef.current,
            },
            (details: any, status: string) => {
              if (status === (window as any).google.maps.places.PlacesServiceStatus.OK && details) resolve(details);
              else reject(new Error(status));
            },
          );
        });
        selectedLabel = getSelectedLabel(place, inputRef.current) || label;
      }

      if (onAddressSelect) {
        const components = applyFallbackComponents(extractComponents(place), selectedLabel);
        onAddressSelect(components);
        onChange(components.rua || components.cidade || components.cep || selectedLabel);
      } else {
        onChange(selectedLabel);
      }

      if (placesLibRef.current.AutocompleteSessionToken) {
        sessionTokenRef.current = new placesLibRef.current.AutocompleteSessionToken();
      }
      if ((window as any).google?.maps?.places?.AutocompleteSessionToken) {
        legacySessionTokenRef.current = new (window as any).google.maps.places.AutocompleteSessionToken();
      }
    } catch {
      const components = applyFallbackComponents(extractAddressComponents([]), label);
      if (onAddressSelect) onAddressSelect(components);
      if (label) onChange(components.cidade || components.cep || label);
    }
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        placeholder={loaded ? placeholder : "Carregando autocomplete..."}
        className="bg-background"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-64 overflow-auto rounded-md border border-border bg-popover shadow-lg">
          {suggestions.map((suggestion) => {
            const prediction = suggestion.placePrediction || suggestion.legacyPrediction;
            const label = String(prediction?.text?.toString?.() || prediction?.description || "");
            const id = prediction?.placeId || prediction?.place_id || label;

            return (
              <button
                key={id}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(suggestion)}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
