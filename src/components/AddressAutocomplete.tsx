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

const AddressAutocomplete = ({ value, onChange, onAddressSelect, placeholder = "Digite o endereço...", apiKey, types = ["geocode"] }: AddressAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionTokenRef = useRef<any>(null);
  const placesLibRef = useRef<any>(null);
  const suppressSearchRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(async () => {
        const placesLib = await (window as any).google.maps.importLibrary("places");
        if (cancelled) return;
        placesLibRef.current = placesLib;
        sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
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
        const { AutocompleteSuggestion } = placesLibRef.current;
        const { suggestions: results = [] } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: searchText,
          includedRegionCodes: ["br"],
          language: "pt-BR",
          sessionToken: sessionTokenRef.current,
        });

        if (!cancelled) {
          setSuggestions(results.filter((item: any) => item.placePrediction).slice(0, 6));
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
  }, [loaded, value]);

  const handleSelect = async (suggestion: any) => {
    const prediction = suggestion.placePrediction;
    if (!prediction) return;

    const label = String(prediction.text?.toString?.() || "").trim();
    suppressSearchRef.current = true;
    setSuggestions([]);
    setOpen(false);
    if (label) onChange(label);

    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ["addressComponents", "formattedAddress", "displayName", "location"] });
      const selectedLabel = getSelectedLabel(place, inputRef.current) || label;

      if (onAddressSelect) {
        const components = applyFallbackComponents(extractComponents(place), selectedLabel);
        onAddressSelect(components);
        onChange(components.rua || components.cidade || components.cep || selectedLabel);
      } else {
        onChange(selectedLabel);
      }

      sessionTokenRef.current = new placesLibRef.current.AutocompleteSessionToken();
    } catch {
      if (label) onChange(label);
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
            const prediction = suggestion.placePrediction;
            const label = String(prediction?.text?.toString?.() || "");
            const id = prediction?.placeId || label;

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
